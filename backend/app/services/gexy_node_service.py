import os
import duckdb
import psutil
import networkx as nx

class GexfNodeGenerator:
    def __init__(self):
        self.save_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'gexf')
        os.makedirs(self.save_dir, exist_ok=True)
        self.gexf_path = os.path.join(self.save_dir, 'generated_nodes.gexf')

        # DuckDB connection (copied from TopicService)
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'public', 'data', 'github_meta.duckdb')
        if os.path.exists(db_path):
            self.con = duckdb.connect(database=db_path, read_only=True)
            available_memory = psutil.virtual_memory().available
            memory_limit = min(available_memory * 0.3, 0.5 * 1024 * 1024 * 1024)
            self.con.execute(f"SET memory_limit TO '{int(memory_limit)}B'")
            cpu_count = psutil.cpu_count(logical=False) or 1
            thread_count = max(1, min(cpu_count, 2))
            self.con.execute(f"SET threads TO {thread_count}")
        else:
            raise FileNotFoundError(f"Database not found at {db_path}. Please ensure the database file exists before running the application.")

    def generate_gexf_nodes_for_topics(self, topics):
        """
        Generate and store a GEXF file for all repos containing any of the given topics.
        Returns the path to the generated GEXF file.
        """
        if not topics:
            return None
        topics_lower = [t.lower() for t in topics]
        placeholders = ','.join(['?'] * len(topics_lower))
        query = f'''
            SELECT DISTINCT r.nameWithOwner, r.stars, r.forks, r.watchers, r.isFork, r.isArchived, r.languageCount, r.pullRequests, r.issues, r.primaryLanguage, r.createdAt, r.license, r.codeOfConduct
            FROM repos r
            JOIN repo_topics t ON r.nameWithOwner = t.repo
            WHERE LOWER(t.topic) IN ({placeholders})
        '''
        result = self.con.execute(query, topics_lower).fetchall()
        columns = ["nameWithOwner", "stars", "forks", "watchers", "isFork", "isArchived", "languageCount", "pullRequests", "issues", "primaryLanguage", "createdAt", "license", "codeOfConduct"]
        G = nx.Graph()
        
        # Define default values for each column type
        default_values = {
            "stars": 0,
            "forks": 0,
            "watchers": 0,
            "isFork": False,
            "isArchived": False,
            "languageCount": 0,
            "pullRequests": 0,
            "issues": 0,
            "primaryLanguage": "",
            "createdAt": "",
            "license": "",
            "codeOfConduct": ""
        }
        
        for row in result:
            node_attrs = {}
            for col, val in zip(columns, row):
                if col == "nameWithOwner":
                    repo_name = val
                else:
                    # Use default value if the value is None
                    node_attrs[col] = default_values[col] if val is None else val
            G.add_node(repo_name, **node_attrs)
        
        nx.write_gexf(G, self.gexf_path)
        return self.gexf_path  # Return the file path 