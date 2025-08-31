import os
import duckdb
import psutil
import networkx as nx
import pandas as pd
from datetime import datetime
import hashlib
from pathlib import Path
import gzip
import time

class GexfNodeGenerator:
    def __init__(self):
        self.save_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "gexf")
        os.makedirs(self.save_dir, exist_ok=True)

        db_path = os.path.join(
            os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            ),
            "public",
            "data",
            "github_meta.duckdb",
        )
        if os.path.exists(db_path):
            self.con = duckdb.connect(database=db_path, read_only=True)
            available_memory = psutil.virtual_memory().available
            memory_limit = min(available_memory * 0.3, 0.5 * 1024 * 1024 * 1024)  # Use 30% of available memory, max 0.5GB
            self.con.execute(f"SET memory_limit TO '{int(memory_limit)}B'")
            
            # Set conservative thread count
            cpu_count = psutil.cpu_count(logical=False) or 1
            thread_count = max(1, min(cpu_count, 2))  # Use at most 2 threads
            self.con.execute(f"SET threads TO {thread_count}")
        else:
            raise FileNotFoundError(
                f"Database not found at {db_path}. Please ensure the database file exists before running the application."
            )

    def get_unique_filename(self, topics):
        """Generate a unique filename based on the topics"""
        sorted_topics = sorted(topics)
        topics_str = "|".join(sorted_topics)
        hash_object = hashlib.md5(topics_str.encode())
        hash_hex = hash_object.hexdigest()[:12]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"topics_{hash_hex}_{timestamp}.gexf"

    def generate_gexf_nodes_for_topics(self, topics):
        """
        Generate and store a GEXF file for all repos containing any of the given topics.
        Returns the path to the generated GEXF file.
        """
        if not topics:
            return None

        start_time = time.time()
        
        filename = self.get_unique_filename(topics)
        gexf_path = os.path.join(self.save_dir, filename)

        topics_lower = [t.lower() for t in topics]
        placeholders = ",".join(["?"] * len(topics_lower))

        # Two-step query process for better performance
        try:
            # Step 1: Create a temporary table of matching repos. This is fast.
            # Drop the table if it exists to avoid conflicts
            self.con.execute("DROP TABLE IF EXISTS matching_repos;")
            
            # Create a more flexible search pattern using OR conditions
            temp_table_query = """
                CREATE TEMP TABLE matching_repos AS
                SELECT DISTINCT r.nameWithOwner
                FROM repos r
                INNER JOIN repo_topics t ON r.nameWithOwner = t.repo
                WHERE (
            """
            
            # Add each topic as a separate OR condition with exact matching
            conditions = []
            for topic in topics_lower:
                conditions.append(f"LOWER(t.topics) LIKE '%|{topic}|%' OR LOWER(t.topics) LIKE '{topic}|%' OR LOWER(t.topics) LIKE '%|{topic}' OR LOWER(t.topics) = '{topic}'")
            
            temp_table_query += " OR ".join(conditions) + ");"
            self.con.execute(temp_table_query)

            # Step 2: Use the temporary table for aggregation. This is also fast.
            final_query = """
                SELECT
                    r.nameWithOwner,
                    COALESCE(r.stars, 0) as stars,
                    COALESCE(r.forks, 0) as forks,
                    COALESCE(r.watchers, 0) as watchers,
                    COALESCE(r.isArchived, false) as isArchived,
                    COALESCE(r.languageCount, 0) as languageCount,
                    COALESCE(r.pullRequests, 0) as pullRequests,
                    COALESCE(r.issues, 0) as issues,
                    COALESCE(r.primaryLanguage, '') as primaryLanguage,
                    r.createdAt_year,
                    COALESCE(r.license, '') as license,
                    t.topics,
                    COALESCE(array_to_string(r.bigquery_contributors, ','), '') as contributors,
                    COALESCE(array_to_string(r.bigquery_stargazers, ','), '') as stargazers
                FROM repos r
                INNER JOIN matching_repos mr ON r.nameWithOwner = mr.nameWithOwner
                INNER JOIN repo_topics t ON r.nameWithOwner = t.repo;
            """
            df = self.con.execute(final_query).fetchdf()

            query_time = time.time()
            # print(f"Query and DataFrame creation took {query_time - start_time:.2f} seconds.")
        except duckdb.duckdb.OutOfMemoryException as e:
            print(f"DuckDB Out of Memory Error: {e}")
            return None
        except Exception as e:
            print(f"Query failed with a general error: {e}")
            return None
        
        if df.empty:
            # print("No results found for the given topics.")
            return None

        df['github_url'] = 'https://github.com/' + df['nameWithOwner']
        
        # Reorder columns to put github_url first
        column_order = ['nameWithOwner', 'github_url', 'stars', 'forks', 'watchers', 'isArchived', 
                       'languageCount', 'pullRequests', 'issues', 'primaryLanguage', 'createdAt_year', 
                       'license', 'topics', 'contributors', 'stargazers']
        df = df[column_order]
        
        G = nx.Graph()
        G.graph['has_edges'] = False

        G.graph['node_attributes'] = {
            'github_url': {'type': 'string'},
            'stars': {'type': 'integer'},
            'forks': {'type': 'integer'},
            'watchers': {'type': 'integer'},
            'isArchived': {'type': 'boolean'},
            'languageCount': {'type': 'integer'},
            'pullRequests': {'type': 'integer'},
            'issues': {'type': 'integer'},
            'primaryLanguage': {'type': 'string'},
            'createdAt_year': {'type': 'integer'},
            'license': {'type': 'string'},
            'topics': {'type': 'string'},
            'contributors': {'type': 'string'},
            'stargazers': {'type': 'string'},
        }

        nodes_with_attributes = [
            (row['nameWithOwner'], row.drop('nameWithOwner').to_dict())
            for _, row in df.iterrows()
        ]
        
        G.add_nodes_from(nodes_with_attributes)
        graph_creation_time = time.time()
        # print(f"Graph creation took {graph_creation_time - query_time:.2f} seconds.")

        nx.write_gexf(G, gexf_path, encoding="utf-8", prettyprint=False)
        gexf_writing_time = time.time()
        # print(f"GEXF file writing took {gexf_writing_time - graph_creation_time:.2f} seconds.")
        
        compressed_path = gexf_path + '.gz'
        with open(gexf_path, 'rb') as f_in:
            with gzip.open(compressed_path, 'wb', compresslevel=6) as f_out:
                f_out.writelines(f_in)
        
        compression_time = time.time()
        # print(f"File compression took {compression_time - gexf_writing_time:.2f} seconds.")
        # print(f"Total process time: {compression_time - start_time:.2f} seconds.")
        
        return gexf_path