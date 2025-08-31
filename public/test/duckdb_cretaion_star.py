import os
import duckdb
import pandas as pd
import json
from google.cloud import bigquery
from tqdm import tqdm
from datetime import datetime
import time
from sqlalchemy import create_engine, text

# Initialize BigQuery client
client = bigquery.Client()

# BigQuery configuration
BQ_PROJECT = 'deepgit'  
BQ_DATASET = 'githubwithstar'     
REPO_LIST_TABLE = f'{BQ_PROJECT}.{BQ_DATASET}.repo_list'

# Paths
json_path = '../../public/data/repo_metadata.json'
db_path = 'github_metadata_star.duckdb'

# -----------------------------------
# Data Loading and Initial Processing
# -----------------------------------
start_load_time = time.time()
try:
    with open(json_path, 'r') as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    print(f"Loaded {len(data)} repositories from JSON file.")
except FileNotFoundError:
    print(f"Error: JSON file not found at {json_path}")
    exit()

repos_list = []
languages_list = []
topics_list = []

print("Flattening and pre-processing JSON data into DataFrames...")
for repo in tqdm(data, desc="Pre-processing repo data"):
    repo_owner = repo.get("nameWithOwner")
    
    # Pre-process fields for direct writing to DuckDB
    created_at_year = datetime.strptime(repo.get("createdAt"), "%Y-%m-%dT%H:%M:%SZ").year if repo.get("createdAt") else 0
    license_str = str(repo.get("license", ''))
    
    repos_list.append({
        "nameWithOwner": repo_owner,
        "owner": repo.get("owner"),
        "name": repo.get("name"),
        "stars": repo.get("stars", 0),
        "forks": repo.get("forks", 0),
        "watchers": repo.get("watchers", 0),
        "isFork": repo.get("isFork", False),
        "isArchived": repo.get("isArchived", False),
        "languageCount": repo.get("languageCount", 0),
        "topicCount": repo.get("topicCount", 0),
        "diskUsageKb": repo.get("diskUsageKb", 0),
        "pullRequests": repo.get("pullRequests", 0),
        "issues": repo.get("issues", 0),
        "description": repo.get("description", ''),
        "primaryLanguage": repo.get("primaryLanguage", ''),
        "createdAt_year": created_at_year, # Store pre-converted year
        "pushedAt": repo.get("pushedAt", ''),
        "defaultBranchCommitCount": repo.get("defaultBranchCommitCount", 0),
        "license": license_str, # Store pre-converted string
        "assignableUserCount": repo.get("assignableUserCount", 0),
        "codeOfConduct": str(repo.get("codeOfConduct", '')),
        "forkingAllowed": repo.get("forkingAllowed", False),
        "parent": str(repo.get("parent", ''))
    })
    
    if "languages" in repo and repo["languages"]:
        for lang in repo["languages"]:
            languages_list.append({
                "repo": repo_owner,
                "language": lang.get("name", ''),
                "size": lang.get("size", 0)
            })

    if "topics" in repo and repo["topics"]:
        seen_topics = set()
        for topic in repo["topics"]:
            topic_name = topic.get("name")
            if topic_name and topic_name not in seen_topics:
                seen_topics.add(topic_name)
                topics_list.append({
                    "repo": repo_owner,
                    "topic": topic_name.lower(), # Store topics in lowercase
                    "stars": topic.get("stars", 0)
                })

df_repos = pd.DataFrame(repos_list)
df_languages = pd.DataFrame(languages_list)
df_topics = pd.DataFrame(topics_list)

end_load_time = time.time()
print(f"JSON data flattening and pre-processing took {end_load_time - start_load_time:.2f} seconds.")

# -----------------------------------
# BigQuery Operations
# -----------------------------------
def create_bigquery_tables(repos_df):
    start_bq_setup = time.time()
    try:
        dataset_id = bigquery.Dataset(f"{BQ_PROJECT}.{BQ_DATASET}")
        dataset_id.location = "US"
        client.create_dataset(dataset_id, exists_ok=True)
        print(f"Dataset {BQ_DATASET} is ready.")

        repo_names_df = repos_df[['nameWithOwner']].copy()
        repo_names_df.rename(columns={'nameWithOwner': 'repo_name'}, inplace=True)

        job_config = bigquery.LoadJobConfig(
            schema=[bigquery.SchemaField("repo_name", "STRING")],
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE
        )
        
        load_job = client.load_table_from_dataframe(repo_names_df, REPO_LIST_TABLE, job_config=job_config)
        load_job.result()
        print(f"BigQuery setup completed in {time.time() - start_bq_setup:.2f} seconds.")
        
    except Exception as e:
        print(f"Error setting up BigQuery environment: {e}")
        raise

def get_bq_data_optimized(repos_df):
    create_bigquery_tables(repos_df)
    
    start_bq_query = time.time()
    try:
        combined_query = f"""
            SELECT
                t2.repo_name AS repo,
                STRING_AGG(DISTINCT CASE WHEN t1.type = 'PullRequestEvent' THEN t1.actor.login END, ',') AS contributors,
                STRING_AGG(DISTINCT CASE WHEN t1.type = 'WatchEvent' THEN t1.actor.login END, ',') AS stargazers
            FROM
                `githubarchive.month.2024*` AS t1
            JOIN
                `{REPO_LIST_TABLE}` AS t2
            ON
                LOWER(t1.repo.name) = LOWER(t2.repo_name)
            WHERE
                t1.type IN ('PullRequestEvent', 'WatchEvent')
            GROUP BY
                repo
        """
        
        print("Executing BigQuery query with aggregation...")
        df = client.query(combined_query).to_dataframe()
        
        if not df.empty:
            df['contributors'] = df['contributors'].apply(lambda x: x.split(',') if pd.notna(x) else [])
            df['stargazers'] = df['stargazers'].apply(lambda x: x.split(',') if pd.notna(x) else [])
            print(f"BigQuery query and DataFrame creation took {time.time() - start_bq_query:.2f} seconds.")
        
        return df
        
    except Exception as e:
        print(f"Error in BigQuery query: {e}")
        return pd.DataFrame()

# -----------------------------------
# Main execution flow
# -----------------------------------
start_total_time = time.time()
print("Starting all operations...")

bigquery_df = get_bq_data_optimized(df_repos)

print("Merging BigQuery data with main repository metadata...")
df_repos = pd.merge(df_repos, bigquery_df, 
                    left_on='nameWithOwner', right_on='repo', how='left')

df_repos.drop('repo', axis=1, inplace=True)
df_repos.rename(columns={'contributors': 'bigquery_contributors', 'stargazers': 'bigquery_stargazers'}, inplace=True)

df_repos.loc[:, 'bigquery_contributors'] = df_repos['bigquery_contributors'].apply(lambda x: x if isinstance(x, list) else [])
df_repos.loc[:, 'bigquery_stargazers'] = df_repos['bigquery_stargazers'].apply(lambda x: x if isinstance(x, list) else [])

# -----------------------------------
# Final DataFrame Preparation
# -----------------------------------
# Pre-aggregate topics before writing to DuckDB
print("Pre-aggregating topics DataFrame...")
df_topics_agg = df_topics.groupby('repo')['topic'].apply(lambda x: '|'.join(x)).reset_index(name='topics')

# -----------------------------------
# Write to DuckDB with INDEXING (Using SQLAlchemy)
# -----------------------------------
start_duckdb_time = time.time()
print("Connecting to DuckDB using SQLAlchemy...")
engine = create_engine(f"duckdb:///{db_path}")
con = engine.connect()

print("Writing DataFrames to DuckDB...")
df_repos.to_sql("repos", con, if_exists='replace', index=False)
df_languages.to_sql("repo_languages", con, if_exists='replace', index=False)
df_topics_agg.to_sql("repo_topics", con, if_exists='replace', index=False)

# --- ADDED INDEXING STEP (Still crucial) ---
print("Creating index on repo_topics table...")
con.execute(text("CREATE INDEX topic_idx ON repo_topics (topics);"))
print("Index created successfully!")
# ---------------------------

con.close()
end_duckdb_time = time.time()
print(f"DuckDB database creation took {end_duckdb_time - start_duckdb_time:.2f} seconds.")
print(f"Total script execution time: {time.time() - start_total_time:.2f} seconds.")

print(f"DuckDB database created at {db_path}")