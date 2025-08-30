import duckdb
import pandas as pd
import json
from google.cloud import bigquery
from tqdm import tqdm
from datetime import datetime

# Initialize BigQuery client
client = bigquery.Client()

# BigQuery configuration
BQ_PROJECT = 'deepgit'  
BQ_DATASET = 'githubwithstar'     
REPO_LIST_TABLE = f'{BQ_PROJECT}.{BQ_DATASET}.repo_list'

# Paths
json_path = '../../public/data/repo_metadata.json'
db_path = 'github_metadata_star.duckdb'

# Load JSON data
with open(json_path, 'r') as f:
    data = json.load(f)

if isinstance(data, dict):
    data = [data]

# Collect all repo IDs
repo_ids = [repo.get("nameWithOwner") for repo in data]
print(f"Total repos to process: {len(repo_ids)}")

# -----------------------------------
# Create repo_list table in BigQuery
# -----------------------------------
def create_dataset_and_table():
    """Create BigQuery dataset and repo_list table using efficient methods."""
    try:
        dataset_id = bigquery.Dataset(f"{BQ_PROJECT}.{BQ_DATASET}")
        dataset_id.location = "US"
        client.create_dataset(dataset_id, exists_ok=True)
        print(f"Dataset {BQ_DATASET} is ready.")

        df_repo_list = pd.DataFrame(repo_ids, columns=['repo_name'])

        job_config = bigquery.LoadJobConfig()
        job_config.schema = [
            bigquery.SchemaField("repo_name", "STRING")
        ]
        job_config.write_disposition = bigquery.WriteDisposition.WRITE_TRUNCATE
        
        print(f"Loading {len(df_repo_list)} repos to BigQuery table `{REPO_LIST_TABLE}`...")
        
        load_job = client.load_table_from_dataframe(
            df_repo_list,
            REPO_LIST_TABLE,
            job_config=job_config
        )
        load_job.result()  # Wait for the job to complete
        
        print("repo_list table created and populated successfully!")
        
    except Exception as e:
        print(f"Error setting up BigQuery environment: {e}")
        raise

# -----------------------------------
# Single BigQuery query function using JOIN and AGGREGATION
# -----------------------------------
def get_contributors_and_stargazers_optimized():
    """Get all contributors and stargazers using an optimized JOIN and aggregation query."""
    try:
        combined_query = f"""
            SELECT
                t2.repo_name AS repo,
                STRING_AGG(DISTINCT CASE WHEN t1.type = 'PullRequestEvent' THEN t1.actor.login END, ',') AS contributors,
                STRING_AGG(DISTINCT CASE WHEN t1.type = 'WatchEvent' THEN t1.actor.login END, ',') AS stargazers
            FROM
                `githubarchive.month.*` AS t1
            JOIN
                `{REPO_LIST_TABLE}` AS t2
            ON
                LOWER(t1.repo.name) = LOWER(t2.repo_name)
            WHERE
                t1.type IN ('PullRequestEvent', 'WatchEvent')
                AND t1._TABLE_SUFFIX >= '2015'
            GROUP BY
                repo
        """
        
        print("Executing BigQuery query with aggregation...")
        # Use to_dataframe with a large chunk size or no chunking
        df = client.query(combined_query).to_dataframe()
        
        # Split the aggregated strings back into lists
        if not df.empty:
            df['contributors'] = df['contributors'].apply(lambda x: x.split(',') if pd.notna(x) else [])
            df['stargazers'] = df['stargazers'].apply(lambda x: x.split(',') if pd.notna(x) else [])
        
        return df
        
    except Exception as e:
        print(f"Error in BigQuery query: {e}")
        return pd.DataFrame()

# -----------------------------------
# Main execution flow
# -----------------------------------
print("Starting BigQuery operations...")
start_time = datetime.now()

# Step 1: Create and populate repo_list table
create_dataset_and_table()

# Step 2: Execute optimized query
bigquery_df = get_contributors_and_stargazers_optimized()

end_time = datetime.now()
processing_time = end_time - start_time
print(f"BigQuery operations completed in: {processing_time}")

# -----------------------------------
# Flatten repo metadata and merge
# -----------------------------------
repos, languages, topics = [], [], []

for repo in tqdm(data, desc="Processing repos"):
    repos.append({
        "nameWithOwner": repo.get("nameWithOwner"),
        # ... all other fields from your original script ...
        "owner": repo.get("owner"),
        "name": repo.get("name"),
        "stars": repo.get("stars"),
        "forks": repo.get("forks"),
        "watchers": repo.get("watchers"),
        "isFork": repo.get("isFork"),
        "isArchived": repo.get("isArchived"),
        "languageCount": repo.get("languageCount"),
        "topicCount": repo.get("topicCount"),
        "diskUsageKb": repo.get("diskUsageKb"),
        "pullRequests": repo.get("pullRequests"),
        "issues": repo.get("issues"),
        "description": repo.get("description"),
        "primaryLanguage": repo.get("primaryLanguage"),
        "createdAt": repo.get("createdAt"),
        "pushedAt": repo.get("pushedAt"),
        "defaultBranchCommitCount": repo.get("defaultBranchCommitCount"),
        "license": str(repo.get("license")),
        "assignableUserCount": repo.get("assignableUserCount"),
        "codeOfConduct": str(repo.get("codeOfConduct")),
        "forkingAllowed": repo.get("forkingAllowed"),
        "parent": str(repo.get("parent"))
    })
    
    for lang in repo.get("languages", []):
        languages.append({
            "repo": repo.get("nameWithOwner"),
            "language": lang.get("name"),
            "size": lang.get("size")
        })

    seen_topics = set()
    for topic in repo.get("topics", []):
        topic_name = topic.get("name")
        if topic_name and topic_name not in seen_topics:
            seen_topics.add(topic_name)
            topics.append({
                "repo": repo.get("nameWithOwner"),
                "topic": topic_name,
                "stars": topic.get("stars")
            })

df_repos = pd.DataFrame(repos)
df_languages = pd.DataFrame(languages)
df_topics = pd.DataFrame(topics)

# Perform a single, efficient merge
print("Merging BigQuery data with main repository metadata...")
df_repos = pd.merge(df_repos, bigquery_df, 
                    left_on='nameWithOwner', right_on='repo', how='left')
df_repos.drop('repo', axis=1, inplace=True)
df_repos.rename(columns={'contributors': 'bigquery_contributors', 'stargazers': 'bigquery_stargazers'}, inplace=True)
# Fill NaN lists with empty lists
df_repos['bigquery_contributors'] = df_repos['bigquery_contributors'].apply(lambda x: x if isinstance(x, list) else [])
df_repos['bigquery_stargazers'] = df_repos['bigquery_stargazers'].apply(lambda x: x if isinstance(x, list) else [])

# -----------------------------------
# Write to DuckDB (more efficiently)
# -----------------------------------
con = duckdb.connect(db_path)
con.execute("SET threads TO 4;")

# Helper to insert directly
def insert_df(df, table_name):
    print(f"Writing {len(df)} rows to {table_name}...")
    # Use DuckDB's built-in function to register and write
    # This is much faster than manual chunking and INSERT
    con.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM df;")

# Write repos
insert_df(df_repos, "repos")

# Write languages (if any)
if not df_languages.empty:
    insert_df(df_languages, "repo_languages")

# Write topics (if any)
if not df_topics.empty:
    insert_df(df_topics, "repo_topics")

con.close()
print(f"DuckDB database created at {db_path}")