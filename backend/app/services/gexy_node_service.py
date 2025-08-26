import os
import duckdb
import psutil
import networkx as nx
from datetime import datetime
import hashlib
from pathlib import Path


class GexfNodeGenerator:
    def __init__(self):
        self.save_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "gexf")
        os.makedirs(self.save_dir, exist_ok=True)

        # DuckDB connection (copied from TopicService)
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
            memory_limit = min(available_memory * 0.3, 0.5 * 1024 * 1024 * 1024)
            self.con.execute(f"SET memory_limit TO '{int(memory_limit)}B'")
            cpu_count = psutil.cpu_count(logical=False) or 1
            thread_count = max(1, min(cpu_count, 2))
            self.con.execute(f"SET threads TO {thread_count}")
        else:
            raise FileNotFoundError(
                f"Database not found at {db_path}. Please ensure the database file exists before running the application."
            )

    def get_unique_filename(self, topics):
        """Generate a unique filename based on the topics"""
        # Sort topics to ensure consistent hash for same topics in different order
        sorted_topics = sorted(topics)
        # Create a hash of the topics
        topics_str = "|".join(sorted_topics)
        hash_object = hashlib.md5(topics_str.encode())
        hash_hex = hash_object.hexdigest()[:12]  # Use first 12 characters of hash
        # Include timestamp to ensure uniqueness even for same topics
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"topics_{hash_hex}_{timestamp}.gexf"

    def generate_gexf_nodes_for_topics(self, topics):
        """
        Generate and store a GEXF file for all repos containing any of the given topics.
        Returns the path to the generated GEXF file.
        """
        if not topics:
            return None

        # Generate unique filename for this search
        filename = self.get_unique_filename(topics)
        gexf_path = os.path.join(self.save_dir, filename)

        topics_lower = [t.lower() for t in topics]
        placeholders = ",".join(["?"] * len(topics_lower))

        # Debug: Check what columns actually exist in the repos table
        schema_query = "DESCRIBE repos"
        # try:
        #     schema_result = self.con.execute(schema_query).fetchall()
        #     # print("Repos table schema:")
        #     # for col in schema_result:
        #     #     print(f"  {col}")
        # except Exception as e:
        #     print(f"Could not get schema: {e}")

        query = f"""
           WITH matching_repos AS (
                SELECT DISTINCT r.nameWithOwner
                FROM repos r
                JOIN repo_topics t ON r.nameWithOwner = t.repo
                WHERE LOWER(t.topic) IN ({placeholders})
            ),
            repo_topics_agg AS (
                SELECT 
                    r.nameWithOwner,
                    GROUP_CONCAT(t.topic, '|') AS topics
                FROM repos r
                JOIN repo_topics t ON r.nameWithOwner = t.repo
                JOIN matching_repos mr ON r.nameWithOwner = mr.nameWithOwner
                GROUP BY r.nameWithOwner
            )
            SELECT 
                r.nameWithOwner,
                r.stars,
                r.forks,
                r.watchers,
                r.isArchived,
                r.languageCount,
                r.pullRequests,
                r.issues,
                r.primaryLanguage,
                r.createdAt,
                r.license,
                rt.topics
            FROM repos r
            JOIN matching_repos mr ON r.nameWithOwner = mr.nameWithOwner
            JOIN repo_topics_agg rt ON r.nameWithOwner = rt.nameWithOwner;
        """
        result = self.con.execute(query, topics_lower).fetchall()
        
        # Debug: Print the first few rows to see what we're getting
        # if result:
        #     print(f"First row sample: {result[0]}")
        #     print(f"Number of results: {len(result)}")
        
        columns = [
            "nameWithOwner",
            "stars",
            "forks",
            "watchers",
            "isArchived",
            "languageCount",
            "pullRequests",
            "issues",
            "primaryLanguage",
            "createdAt",
            "license",
            "topics",
        ]
        G = nx.Graph()
        G.graph['has_edges'] = False  # Add this attribute to indicate no edges in this graph

        # Define default values for each column type
        default_values = {
            "stars": 0,
            "forks": 0,
            "watchers": 0,
            "isArchived": False,
            "languageCount": 0,
            "pullRequests": 0,
            "issues": 0,
            "primaryLanguage": "",
            "createdAt_year": 0,  # Keep only year
            "license": "",
            "topics": "",  # Default empty string for topics
        }

        # Add attributes to the graph
        G.graph['node_attributes'] = {
            'createdAt_year': {'type': 'integer'},  # Keep only year
            'stars': {'type': 'integer'},
            'forks': {'type': 'integer'},
            'watchers': {'type': 'integer'},
            'isArchived': {'type': 'boolean'},
            'languageCount': {'type': 'integer'},
            'pullRequests': {'type': 'integer'},
            'issues': {'type': 'integer'},
            'primaryLanguage': {'type': 'string'},
            'license': {'type': 'string'},
            'github_url': {'type': 'string'},
            'topics': {'type': 'string'},  # Add topics as a string attribute
        }

        for row in result:
            node_attrs = {}
            for col, val in zip(columns, row):
                if col == "nameWithOwner":
                    repo_name = val
                    # Add GitHub URL using nameWithOwner
                    node_attrs["github_url"] = f"https://github.com/{val}"
                elif col == "createdAt":
                    # Only extract year from the date
                    if val:
                        try:
                            # Handle both string and datetime objects
                            if isinstance(val, str):
                                # Parse ISO format date (e.g., "2018-06-02T04:08:16Z")
                                date = datetime.strptime(val.split('T')[0], "%Y-%m-%d")
                            else:
                                date = val  # Assume it's already a datetime object
                            node_attrs["createdAt_year"] = date.year
                        except (ValueError, TypeError) as e:
                            print(f"Error processing date for {repo_name}: {e}")
                            # If date parsing fails, use default value
                            node_attrs["createdAt_year"] = 0
                    else:
                        node_attrs["createdAt_year"] = 0
                elif col == "topics":
                    # Store topics as a comma-separated string
                    node_attrs[col] = val if val else default_values[col]
                elif col == "isArchived":
                    # Ensure isArchived is always a boolean value
                    node_attrs[col] = bool(val) if val is not None else False
                else:
                    # Use default value if the value is None
                    node_attrs[col] = default_values[col] if val is None else val
            G.add_node(repo_name, **node_attrs)

        # Print some statistics about the years
        years = [attrs.get("createdAt_year", 0) for _, attrs in G.nodes(data=True)]
        # print(f"Date statistics:")
        # print(f"Years range: {min(years)} to {max(years)}")
        # print(f"Number of nodes with year=0: {years.count(0)}")

        nx.write_gexf(G, gexf_path)
        return gexf_path  # Return the unique file path
