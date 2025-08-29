import duckdb
import pandas as pd
import json
from google.cloud import bigquery
from tqdm import tqdm
import concurrent.futures
from datetime import datetime, timedelta

# Initialize BigQuery client
client = bigquery.Client()

# BigQuery configuration
BQ_PROJECT = 'deepgit'  # Replace with your actual project ID
BQ_DATASET = 'githubwithstar'     # Replace with your actual dataset name
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
# Create repo_list table in BigQuery first
# -----------------------------------
def create_repo_list_table():
    """Create a temporary repo_list table in BigQuery for efficient JOINs"""
    try:
        # Create the repo_list table
        create_table_query = f"""
        CREATE OR REPLACE TABLE `{REPO_LIST_TABLE}` (
            repo_name STRING
        )
        """
        
        print("Creating repo_list table in BigQuery...")
        client.query(create_table_query).result()
        
        # Insert repo IDs into the table
        if repo_ids:
            # Convert repo_ids to a format suitable for BigQuery
            repo_values = [f"('{repo}')" for repo in repo_ids]
            insert_query = f"""
            INSERT INTO `{REPO_LIST_TABLE}` (repo_name)
            VALUES {','.join(repo_values)}
            """
            
            print(f"Inserting {len(repo_ids)} repos into repo_list table...")
            client.query(insert_query).result()
            print("repo_list table created and populated successfully!")
        else:
            print("No repo IDs to insert!")
            
    except Exception as e:
        print(f"Error creating repo_list table: {e}")
        raise

# -----------------------------------
# Single BigQuery query function using JOIN
# -----------------------------------
def get_contributors_and_stargazers():
    """Get all contributors and stargazers using JOIN with repo_list table"""
    try:
        # Use JOIN instead of IN UNNEST for better performance
        combined_query = f"""
            SELECT
                t1.repo.name AS repo,
                t1.type,
                t1.actor.login AS username
            FROM
                `githubarchive.month.*` AS t1
            JOIN
                `{REPO_LIST_TABLE}` AS t2
            ON
                t1.repo.name = t2.repo_name
            WHERE
                t1.type IN ('PullRequestEvent', 'WatchEvent')
                AND t1._TABLE_SUFFIX >= '2015'
            GROUP BY
                repo,
                type,
                username
        """
        
        print("Executing BigQuery query using JOIN with repo_list table...")
        df = client.query(combined_query).to_dataframe()
        
        # Separate contributors and stargazers
        if not df.empty:
            contributors = df[df.type == 'PullRequestEvent'][['repo', 'username']].rename(columns={'username': 'contributor'})
            stargazers = df[df.type == 'WatchEvent'][['repo', 'username']].rename(columns={'username': 'stargazer'})
        else:
            contributors = pd.DataFrame(columns=['repo', 'contributor'])
            stargazers = pd.DataFrame(columns=['repo', 'stargazer'])
        
        return contributors, stargazers
        
    except Exception as e:
        print(f"Error in BigQuery query: {e}")
        return pd.DataFrame(), pd.DataFrame()

# -----------------------------------
# Execute BigQuery operations
# -----------------------------------
print("Starting BigQuery operations...")
start_time = datetime.now()

# Step 1: Create and populate repo_list table
create_repo_list_table()

# Step 2: Execute query using JOIN
contributors_df, stargazers_df = get_contributors_and_stargazers()

end_time = datetime.now()
processing_time = end_time - start_time
print(f"BigQuery operations completed in: {processing_time}")

print(f"Total contributors found: {len(contributors_df)}")
print(f"Total stargazers found: {len(stargazers_df)}")

# Show results for the first repo
if not contributors_df.empty and not stargazers_df.empty:
    first_repo = repo_ids[0]
    print(f"\n=== BigQuery Results for First Repo: {first_repo} ===")
    
    # Get contributors for first repo
    first_repo_contribs = contributors_df[contributors_df.repo == first_repo]
    if not first_repo_contribs.empty:
        print(f"Contributors ({len(first_repo_contribs)}):")
        for _, row in first_repo_contribs.iterrows():
            print(f"  - {row.contributor}")
    else:
        print("Contributors: 0 (no data found)")
    
    # Get stargazers for first repo
    first_repo_stars = stargazers_df[stargazers_df.repo == first_repo]
    if not first_repo_stars.empty:
        print(f"\nStargazers ({len(first_repo_stars)}):")
        for _, row in first_repo_stars.iterrows():
            print(f"  - {row.stargazer}")
    else:
        print("Stargazers: 0 (no data found)")
    
    print("=" * 50)

# Build lookup maps - now we need to group by repo and get lists
contributors_map = {}
stargazers_map = {}

for repo in contributors_df.repo.unique():
    repo_contribs = contributors_df[contributors_df.repo == repo]['contributor'].tolist()
    contributors_map[repo] = repo_contribs

for repo in stargazers_df.repo.unique():
    repo_stars = stargazers_df[stargazers_df.repo == repo]['stargazer'].tolist()
    stargazers_map[repo] = repo_stars

# -----------------------------------
# Flatten repo metadata (with progress bar)
# -----------------------------------
repos, languages, topics = [], [], []

for repo in tqdm(data, desc="Processing repos"):
    repo_id = repo.get("nameWithOwner")

    repos.append({
        "nameWithOwner": repo_id,
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
        "parent": str(repo.get("parent")),
        "bigquery_contributors": contributors_map.get(repo_id, []),
        "bigquery_stargazers": stargazers_map.get(repo_id, []),
    })

    for lang in repo.get("languages", []):
        languages.append({
            "repo": repo_id,
            "language": lang.get("name"),
            "size": lang.get("size")
        })

    seen_topics = set()
    for topic in repo.get("topics", []):
        topic_name = topic.get("name")
        if topic_name and topic_name not in seen_topics:
            seen_topics.add(topic_name)
            topics.append({
                "repo": repo_id,
                "topic": topic_name,
                "stars": topic.get("stars")
            })

# -----------------------------------
# Convert to DataFrames
# -----------------------------------
df_repos = pd.DataFrame(repos)
df_languages = pd.DataFrame(languages)
df_topics = pd.DataFrame(topics)

# -----------------------------------
# Write to DuckDB
# -----------------------------------
con = duckdb.connect(db_path)
con.execute("SET threads TO 4;")

con.register('df_repos', df_repos)
con.execute("CREATE OR REPLACE TABLE repos AS SELECT * FROM df_repos;")

if not df_languages.empty:
    con.register('df_languages', df_languages)
    con.execute("CREATE OR REPLACE TABLE repo_languages AS SELECT * FROM df_languages;")

if not df_topics.empty:
    con.register('df_topics', df_topics)
    con.execute("CREATE OR REPLACE TABLE repo_topics AS SELECT * FROM df_topics;")

con.close()
print(f"DuckDB database created at {db_path}")
