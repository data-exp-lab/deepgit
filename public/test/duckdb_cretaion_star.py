import duckdb
import pandas as pd
import json
from google.cloud import bigquery
from tqdm import tqdm
import concurrent.futures
from datetime import datetime, timedelta

# Initialize BigQuery client
client = bigquery.Client()

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
# Helper: chunked list with much larger chunks
# -----------------------------------
def chunked(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

# -----------------------------------
# Optimized BigQuery query function
# -----------------------------------
def process_chunk(chunk):
    """Process a chunk of repos with optimized queries"""
    try:
        job_config = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ArrayQueryParameter("repo_ids", "STRING", chunk)]
        )
        
        # Combined query for both contributors and stargazers - much more efficient!
        combined_query = """
            SELECT 
                repo.name AS repo,
                type,
                actor.login AS username
            FROM `githubarchive.month.*`
            WHERE (type = 'PullRequestEvent' OR type = 'WatchEvent')
              AND repo.name IN UNNEST(@repo_ids)
              AND _TABLE_SUFFIX >= '2015'
            GROUP BY repo, type, actor.login
        """
        
        df = client.query(combined_query, job_config=job_config).to_dataframe()
        
        # Separate contributors and stargazers
        contributors = df[df.type == 'PullRequestEvent'][['repo', 'username']].rename(columns={'username': 'contributor'})
        stargazers = df[df.type == 'WatchEvent'][['repo', 'username']].rename(columns={'username': 'stargazer'})
        
        return contributors, stargazers
        
    except Exception as e:
        print(f"Error processing chunk: {e}")
        return pd.DataFrame(), pd.DataFrame()

# -----------------------------------
# Run BigQuery queries with much larger chunks and parallel processing
# -----------------------------------
print("Starting BigQuery processing...")
start_time = datetime.now()

CHUNK_SIZE = 500000 
chunks = list(chunked(repo_ids, CHUNK_SIZE))
print(f"Processing {len(chunks)} chunks of {CHUNK_SIZE} repos each")

all_contribs = []
all_stars = []

# Process chunks in parallel for much faster execution
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    # Submit all chunks to the thread pool
    future_to_chunk = {executor.submit(process_chunk, chunk): chunk for chunk in chunks}
    
    # Process completed chunks with progress bar
    for future in tqdm(concurrent.futures.as_completed(future_to_chunk), 
                      total=len(chunks), 
                      desc="BigQuery chunks"):
        chunk = future_to_chunk[future]
        try:
            contributors, stargazers = future.result()
            if not contributors.empty:
                all_contribs.append(contributors)
            if not stargazers.empty:
                all_stars.append(stargazers)
        except Exception as e:
            print(f"Chunk failed: {e}")

end_time = datetime.now()
processing_time = end_time - start_time
print(f"BigQuery processing completed in: {processing_time}")

# Merge results from all chunks
if all_contribs:
    contributors_df = pd.concat(all_contribs, ignore_index=True)
else:
    contributors_df = pd.DataFrame(columns=['repo', 'contributor'])

if all_stars:
    stargazers_df = pd.concat(all_stars, ignore_index=True)
else:
    stargazers_df = pd.DataFrame(columns=['repo', 'stargazer'])

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
