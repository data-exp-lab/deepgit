import os
import tempfile
import json
# import sys  # Removed unused import
import xml.etree.ElementTree as ET
import requests
import base64
import time
import re
import csv
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from config_manager import ConfigManager
# from collections import defaultdict  # Removed unused import

# Import required libraries
try:
    import kuzu
except ImportError as e:
    print(f"❌ Failed to import kuzu: {e}")
    kuzu = None

try:
    import pandas as pd
except ImportError as e:
    print(f"❌ Failed to import pandas: {e}")
    pd = None

try:
    import networkx as nx
except ImportError as e:
    print(f"❌ Failed to import networkx: {e}")
    nx = None

# LangGraph imports
try:
    from langgraph.graph import StateGraph, END
    from langgraph.prebuilt import ToolNode
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
    from langchain_core.tools import tool
    from langchain_core.output_parsers import JsonOutputParser
    from langchain_community.embeddings import HuggingFaceEmbeddings
    from pydantic import BaseModel, Field
except ImportError as e:
    print(f"❌ Failed to import LangGraph modules: {e}")
    StateGraph = None
    END = None
    ToolNode = None
    HumanMessage = None
    AIMessage = None
    SystemMessage = None
    ChatPromptTemplate = None
    MessagesPlaceholder = None
    ChatOpenAI = None
    ChatGoogleGenerativeAI = None
    OpenAIEmbeddings = None
    GoogleGenerativeAIEmbeddings = None
    HuggingFaceEmbeddings = None
    tool = None
    JsonOutputParser = None
    BaseModel = None
    Field = None

@dataclass
class DeepGitAIState:
    """State for the DeepGitAI workflow."""
    messages: list = None
    query: str = ""
    graph_results: dict = None
    readme_content: list = None
    final_answer: str = ""
    error: str = ""
    
    def __post_init__(self):
        if self.messages is None:
            self.messages = []
        if self.graph_results is None:
            self.graph_results = {}
        if self.readme_content is None:
            self.readme_content = []

class DeepGitAIService:
    """Service for handling DeepGitAI operations."""
    
    def __init__(self):
        self.db_path = None
        self.deepgit_ai_instance = None
        self.session_id = None  # Track which session owns this database
        # Use DuckDB in cache folder for README storage
        self.cache_dir = Path(__file__).parent.parent / "cache"
        self.cache_dir.mkdir(exist_ok=True)
        self.readme_cache_db_path = self.cache_dir / "readme_cache.duckdb"
        self._cache_stats = {"hits": 0, "misses": 0}
        # Embedding model for README content
        self.embedding_model = None
        self.embedding_provider = None
    
    def get_cache_key(self, owner, repo):
        """Generate a cache key for a repository."""
        return hashlib.md5(f"{owner}/{repo}".encode()).hexdigest()
    
    def initialize_embeddings(self, provider: str, api_keys: Dict[str, str]) -> Dict[str, Any]:
        """Initialize the embedding model based on the provider."""
        try:
            if provider == "openai":
                api_key = api_keys.get("openaiKey", "")
                if not api_key:
                    return {"success": False, "error": "OpenAI API key not provided"}
                
                self.embedding_model = OpenAIEmbeddings(
                    model="text-embedding-3-small",
                    api_key=api_key
                )
                self.embedding_provider = "openai"
                
            elif provider == "azure_openai":
                api_key = api_keys.get("azureOpenAIKey", "")
                endpoint = api_keys.get("azureOpenAIEndpoint", "")
                deployment = api_keys.get("azureOpenAIDeployment", "")
                
                if not api_key or not endpoint or not deployment:
                    return {"success": False, "error": "Azure OpenAI credentials not provided"}
                
                self.embedding_model = OpenAIEmbeddings(
                    model=deployment,
                    api_key=api_key,
                    azure_endpoint=endpoint.rstrip('/'),
                    api_version="2024-02-15-preview"
                )
                self.embedding_provider = "azure_openai"
                
            elif provider == "gemini":
                api_key = api_keys.get("geminiKey", "")
                if not api_key:
                    return {"success": False, "error": "Gemini API key not provided"}
                
                self.embedding_model = GoogleGenerativeAIEmbeddings(
                    model="models/embedding-001",
                    google_api_key=api_key
                )
                self.embedding_provider = "gemini"
                
            else:
                # Fallback to HuggingFace embeddings (no API key required)
                try:
                    self.embedding_model = HuggingFaceEmbeddings(
                        model_name="sentence-transformers/all-MiniLM-L6-v2",
                        model_kwargs={'device': 'cpu'}
                    )
                    self.embedding_provider = "huggingface"
                    print("Using HuggingFace embeddings as fallback")
                except Exception as e:
                    return {"success": False, "error": f"Failed to initialize HuggingFace embeddings: {e}"}
            
            return {"success": True, "message": f"Embeddings initialized with {self.embedding_provider}"}
            
        except Exception as e:
            return {"success": False, "error": str(e), "message": f"Failed to initialize embeddings with {provider}"}
    
    def create_readme_embedding(self, readme_content: str) -> Optional[List[float]]:
        """Create embedding for README content."""
        if not self.embedding_model or not readme_content:
            return None
        
        try:
            # Clean and truncate content for embedding
            cleaned_content = self.clean_text_for_embedding(readme_content)
            if not cleaned_content:
                return None
            
            # Create embedding
            embedding = self.embedding_model.embed_query(cleaned_content)
            return embedding
            
        except Exception as e:
            print(f"Error creating embedding: {e}")
            return None
    
    def clean_text_for_embedding(self, text: str) -> str:
        """Clean text for embedding generation."""
        if not text or not isinstance(text, str):
            return ""
        
        # Remove markdown formatting
        text = re.sub(r'#+\s*', '', text)  # Remove headers
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)  # Remove bold
        text = re.sub(r'\*(.*?)\*', r'\1', text)  # Remove italic
        text = re.sub(r'`(.*?)`', r'\1', text)  # Remove code blocks
        text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)  # Remove code blocks
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # Remove links, keep text
        
        # Remove extra whitespace and newlines
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        # Truncate if too long (most embedding models have limits)
        if len(text) > 8000:  # Conservative limit
            text = text[:8000] + "..."
        
        return text
    
    def get_cached_repos_batch(self, repo_list):
        """Get list of repositories that already have cached READMEs."""
        if not os.path.exists(self.readme_cache_db_path):
            return set()
        
        try:
            import duckdb
            conn = duckdb.connect(str(self.readme_cache_db_path), read_only=True)
            
            # Create a list of (owner, repo) tuples for the query
            repo_tuples = [(owner, repo) for _, owner, repo in repo_list]
            
            if not repo_tuples:
                return set()
            
            # Use parameterized query to check multiple repos at once
            placeholders = ','.join(['(?, ?)' for _ in repo_tuples])
            query = f"""
            SELECT owner, repo
            FROM repository_cache
            WHERE (owner, repo) IN (VALUES {placeholders})
            AND readme_content IS NOT NULL
            """
            
            # Flatten the tuples for the query parameters
            params = [item for tuple_pair in repo_tuples for item in tuple_pair]
            
            result = conn.execute(query, params).fetchall()
            
            # Return set of cached (owner, repo) tuples
            cached_repos = {(row[0], row[1]) for row in result}
            print(f"📋 Found {len(cached_repos)} cached READMEs out of {len(repo_list)} repositories")
            return cached_repos
            
        except Exception as e:
            print(f"Error checking cached repositories: {e}")
            return set()
    
    def _get_batch_cached_content(self, repo_list):
        """Get cached README content for a batch of repositories."""
        if not os.path.exists(self.readme_cache_db_path):
            return {}
        
        try:
            import duckdb
            conn = duckdb.connect(str(self.readme_cache_db_path), read_only=True)
            
            # Create a list of (owner, repo) tuples for the query
            repo_tuples = [(owner, repo) for _, owner, repo in repo_list]
            
            if not repo_tuples:
                return {}
            
            # Use parameterized query to get content for multiple repos at once
            placeholders = ','.join(['(?, ?)' for _ in repo_tuples])
            query = f"""
            SELECT owner, repo, readme_content, readme_length
            FROM repository_cache
            WHERE (owner, repo) IN (VALUES {placeholders})
            """
            
            # Flatten the tuples for the query parameters
            params = [item for tuple_pair in repo_tuples for item in tuple_pair]
            
            result = conn.execute(query, params).fetchall()
            
            # Return dict mapping (owner, repo) to (content, length)
            cached_content = {}
            for row in result:
                owner, repo, content, length = row
                cached_content[(owner, repo)] = (content, length)
            
            return cached_content
            
        except Exception as e:
            print(f"Error getting batch cached content: {e}")
            return {}
    
    def get_cached_readme(self, owner, repo):
        """Get README content from cache database if available."""
        if not os.path.exists(self.readme_cache_db_path):
            self._cache_stats["misses"] += 1
            return None
        
        try:
            import duckdb
            conn = duckdb.connect(str(self.readme_cache_db_path), read_only=True)
            
            # Query for README content using owner/repo
            query = """
            SELECT readme_content, readme_length
            FROM repository_cache
            WHERE owner = ? AND repo = ?
            LIMIT 1
            """
            
            result = conn.execute(query, [owner, repo]).fetchone()
            
            if result and result[0] is not None:  # Check if readme_content exists (including empty string)
                self._cache_stats["hits"] += 1
                content = result[0]  # Get readme_content
                # Ensure we return a string, not float
                if isinstance(content, str):
                    return content  # Return empty string for "no README" cases
                elif content is not None:
                    return str(content)
                else:
                    return ""
            
            self._cache_stats["misses"] += 1
            return None  # Return None only if not cached at all
            
        except Exception as e:
            print(f"Error querying README from cache database: {e}")
            self._cache_stats["misses"] += 1
            return None
    
    def cache_readme(self, owner, repo, content):
        """Store README content and embedding in cache database, including 'no README' cases."""
        try:
            # Initialize cache database if it doesn't exist
            self._initialize_cache_database()
            
            import duckdb
            conn = duckdb.connect(str(self.readme_cache_db_path))
            
            if content:
                # Clean the content for database storage
                cleaned_content = self.clean_text_for_csv(content)
                content_length = len(content)
                
                # Create embedding if embedding model is available
                embedding = None
                embedding_provider = None
                if self.embedding_model:
                    embedding = self.create_readme_embedding(content)
                    embedding_provider = self.embedding_provider
            else:
                # Cache "no README" case to avoid repeated GitHub API calls
                cleaned_content = ""  # Empty string indicates no README found
                content_length = 0
                embedding = None
                embedding_provider = None
            
            # Insert or update README content and embedding in cache database
            query = """
            INSERT OR REPLACE INTO repository_cache 
            (owner, repo, readme_content, readme_length, readme_embedding, embedding_provider, cached_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """
            
            conn.execute(query, [
                owner, 
                repo, 
                cleaned_content, 
                content_length,
                embedding,
                embedding_provider,
                int(time.time())
            ])
            
        except Exception as e:
            print(f"Failed to cache README for {owner}/{repo}: {e}")
    
    def _initialize_cache_database(self):
        """Initialize the cache database if it doesn't exist."""
        if os.path.exists(self.readme_cache_db_path):
            return  # Database already exists
        
        try:
            print("Creating README cache database...")
            import duckdb
            conn = duckdb.connect(str(self.readme_cache_db_path))
            
            # Create Repository table for cache
            cache_schema = """
            CREATE TABLE IF NOT EXISTS repository_cache (
                owner VARCHAR,
                repo VARCHAR,
                readme_content TEXT,
                readme_length BIGINT,
                readme_embedding DOUBLE[],
                embedding_provider VARCHAR,
                cached_at BIGINT,
                PRIMARY KEY (owner, repo)
            )
            """
            conn.execute(cache_schema)
            print("✅ README cache database created successfully")
            
        except Exception as e:
            print(f"Failed to create cache database: {e}")
            raise
    
    def fix_database_schema(self, db_path):
        """Fix database schema by adding missing README properties."""
        if kuzu is None:
            raise ImportError("kuzu is not available")
        
        print("Checking and fixing database schema...")
        db = kuzu.Database(db_path)
        conn = kuzu.Connection(db)
        
        # Check if README properties exist
        try:
            conn.execute("MATCH (r:Repository) RETURN r.readme_content LIMIT 1")
            print("✅ README properties already exist")
            return True
        except Exception as e:
            print(f"⚠️  README properties missing: {e}")
            print("Adding README properties to Repository table...")
            
            # Try to add properties using ALTER TABLE
            try:
                # Add readme_content property
                conn.execute("ALTER TABLE Repository ADD COLUMN readme_content STRING")
                print("✅ Added readme_content property")
            except Exception as add_e:
                print(f"⚠️  ALTER TABLE failed: {add_e}")
                print("Kuzu may not support ALTER TABLE ADD COLUMN")
                print("Properties will be added during data insertion")
                # Don't return False here - continue with the process
                # The properties will be added when we insert data
            
            try:
                # Add readme_length property
                conn.execute("ALTER TABLE Repository ADD COLUMN readme_length INT64")
                print("✅ Added readme_length property")
            except Exception as add_e:
                print(f"⚠️  ALTER TABLE failed: {add_e}")
                print("Properties will be added during data insertion")
            
            # Verify the properties were added
            try:
                conn.execute("MATCH (r:Repository) RETURN r.readme_content LIMIT 1")
                print("✅ README properties verified successfully")
                return True
            except Exception as verify_e:
                print(f"❌ README properties verification failed: {verify_e}")
                return False
    
    def preload_cache(self):
        """Check cache database for existing README content."""
        if not os.path.exists(self.readme_cache_db_path):
            print("No cache database available for README preloading")
            return 0
        
        try:
            import duckdb
            conn = duckdb.connect(str(self.readme_cache_db_path), read_only=True)
            
            # Count repositories with README content in cache
            result = conn.execute("""
                SELECT COUNT(*) 
                FROM repository_cache 
                WHERE readme_content IS NOT NULL AND readme_content <> ''
            """).fetchone()
            
            readme_count = result[0] if result else 0
            print(f"Found {readme_count} cached READMEs in cache database")
            return readme_count
            
        except Exception as e:
            print(f"Error checking README content in cache database: {e}")
            return 0
    
    def get_cache_stats(self):
        """Get cache statistics."""
        total_hits = self._cache_stats["hits"]
        total_misses = self._cache_stats["misses"]
        hit_rate = total_hits / (total_hits + total_misses) * 100 if (total_hits + total_misses) > 0 else 0
        
        # Get cache database README count
        cache_readme_count = 0
        if os.path.exists(self.readme_cache_db_path):
            try:
                import duckdb
                conn = duckdb.connect(str(self.readme_cache_db_path), read_only=True)
                result = conn.execute("""
                    SELECT COUNT(*) 
                    FROM repository_cache 
                    WHERE readme_content IS NOT NULL AND readme_content <> ''
                """).fetchone()
                cache_readme_count = result[0] if result else 0
            except:
                pass
        
        return {
            "cache_readme_count": cache_readme_count,
            "total_hits": total_hits,
            "total_misses": total_misses,
            "hit_rate": f"{hit_rate:.1f}%"
        }
    
    def cleanup_old_cache(self, max_age_hours=24):
        """Database-based system doesn't need file cleanup."""
        print("Using database-based README storage - no file cleanup needed")
        return
    
    def create_kuzu_database(self, gexf_file, db_path):
        """Create a Kuzu database from GEXF file data."""
        if kuzu is None:
            raise ImportError("kuzu is not available")
            
        # Parse the XML file
        tree = ET.parse(gexf_file)
        root = tree.getroot()
        
        # Define the GEXF namespace
        namespace = {'gexf': 'http://www.gexf.net/1.2draft'}
        
        # Find the graph element
        graph = root.find('.//gexf:graph', namespace)
        if graph is None:
            raise ValueError("Could not find graph element")
        
        # Find nodes and edges sections
        nodes_elem = graph.find('.//gexf:nodes', namespace)
        edges_elem = graph.find('.//gexf:edges', namespace)
        
        if nodes_elem is None or edges_elem is None:
            raise ValueError("Could not find nodes or edges section")
        
        # Create or connect to Kuzu database
        if os.path.exists(db_path):
            print(f"Connecting to existing Kuzu database at: {db_path}")
            db = kuzu.Database(db_path)
            conn = kuzu.Connection(db)
            
            # Check if tables already exist
            try:
                conn.execute("MATCH (r:Repository) RETURN COUNT(r) LIMIT 1")
                print("Database already contains Repository table, skipping creation")
                return
            except:
                print("Repository table not found, will create it")
        else:
            print(f"Creating new Kuzu database at: {db_path}")
            db = kuzu.Database(db_path)
            conn = kuzu.Connection(db)
        
        # Create node table schema (only if it doesn't exist)
        try:
            node_schema = """
            CREATE NODE TABLE Repository (
                id STRING,
                label STRING,
                github_url STRING,
                stars INT64,
                forks INT64,
                watchers INT64,
                isArchived BOOLEAN,
                languageCount INT64,
                pullRequests INT64,
                issues INT64,
                primaryLanguage STRING,
                createdAt_year INT64,
                license STRING,
                topics STRING,
                contributors STRING,
                stargazers STRING,
                readme_content STRING,
                readme_length INT64,
                readme_embedding DOUBLE[],
                embedding_provider STRING,
                PRIMARY KEY (id)
            )
            """
            conn.execute(node_schema)
            print("Created Repository node table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Repository node table already exists, skipping creation")
                # Check if README properties exist, if not add them
                try:
                    conn.execute("MATCH (r:Repository) RETURN r.readme_content LIMIT 1")
                    print("README properties already exist")
                except:
                    print("Adding README properties to existing Repository table...")
                    try:
                        # Add readme_content property
                        conn.execute("ALTER TABLE Repository ADD COLUMN readme_content STRING")
                        print("Added readme_content property")
                    except Exception as add_e:
                        if "already exists" in str(add_e).lower():
                            print("readme_content property already exists")
                        else:
                            print(f"Warning: Could not add readme_content property: {add_e}")
                    
                    try:
                        # Add readme_length property
                        conn.execute("ALTER TABLE Repository ADD COLUMN readme_length INT64")
                        print("Added readme_length property")
                    except Exception as add_e:
                        if "already exists" in str(add_e).lower():
                            print("readme_length property already exists")
                        else:
                            print(f"Warning: Could not add readme_length property: {add_e}")
            else:
                raise e
        
        # Create edge table schema (only if it doesn't exist)
        try:
            edge_schema = """
            CREATE REL TABLE StargazerOverlap (
                FROM Repository TO Repository,
                weight DOUBLE,
                edge_type STRING,
                shared_stargazers STRING
            )
            """
            conn.execute(edge_schema)
            print("Created StargazerOverlap edge table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("StargazerOverlap edge table already exists, skipping creation")
            else:
                raise e
        
        # Parse nodes and create CSV file
        print("Parsing nodes...")
        nodes = nodes_elem.findall('.//gexf:node', namespace)
        print(f"Found {len(nodes)} nodes")
        
        # Create temporary CSV file for nodes
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as node_csv:
            node_writer = csv.writer(node_csv)
            
            for node in nodes:
                node_id = node.get('id')
                label = node.get('label')
                
                # Extract node attribute values
                node_attvalues = {}
                for attvalue in node.findall('.//gexf:attvalue', namespace):
                    att_id = attvalue.get('for')
                    value = attvalue.get('value')
                    node_attvalues[att_id] = value
                
                # Map attributes to columns with proper type conversion
                github_url = str(node_attvalues.get('0', ''))
                stars = int(float(node_attvalues.get('1', 0)))
                forks = int(float(node_attvalues.get('2', 0)))
                watchers = int(float(node_attvalues.get('3', 0)))
                is_archived = str(node_attvalues.get('4', 'false')).lower() == 'true'
                language_count = int(float(node_attvalues.get('5', 0)))
                pull_requests = int(float(node_attvalues.get('6', 0)))
                issues = int(float(node_attvalues.get('7', 0)))
                primary_language = str(node_attvalues.get('8', ''))
                created_at_year = int(float(node_attvalues.get('9', 0)))
                license_info = str(node_attvalues.get('10', ''))
                topics = str(node_attvalues.get('11', ''))
                contributors = str(node_attvalues.get('12', ''))
                stargazers = str(node_attvalues.get('13', ''))
                
                # Write to CSV
                node_writer.writerow([
                    node_id, label, github_url, stars, forks, watchers,
                    is_archived, language_count, pull_requests, issues,
                    primary_language, created_at_year, license_info, topics,
                    contributors, stargazers, '', 0, None, None  # readme_content, readme_length, readme_embedding, embedding_provider
                ])
            
            node_csv_path = node_csv.name
        
        # Parse edges and create CSV file
        print("Parsing edges...")
        edges = edges_elem.findall('.//gexf:edge', namespace)
        print(f"Found {len(edges)} edges")
        
        # Create temporary CSV file for edges
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as edge_csv:
            edge_writer = csv.writer(edge_csv)
            
            for edge in edges:
                source = edge.get('source')
                target = edge.get('target')
                edge_id = edge.get('id')
                weight = float(edge.get('weight', 0))
                
                # Extract edge attribute values
                edge_attvalues = {}
                for attvalue in edge.findall('.//gexf:attvalue', namespace):
                    att_id = attvalue.get('for')
                    value = attvalue.get('value')
                    edge_attvalues[att_id] = value
                
                edge_type = str(edge_attvalues.get('14', ''))
                shared_stargazers = str(edge_attvalues.get('15', ''))
                
                # Write to CSV
                edge_writer.writerow([source, target, weight, edge_type, shared_stargazers])
            
            edge_csv_path = edge_csv.name
        
        # Import data using COPY FROM (only if tables are empty)
        try:
            # Check if Repository table has data
            result = conn.execute("MATCH (r:Repository) RETURN COUNT(r)").get_as_df()
            if result.iloc[0, 0] == 0:
                print("Importing nodes...")
                conn.execute(f"COPY Repository FROM '{node_csv_path}' (HEADER=false)")
            else:
                print("Repository table already has data, skipping import")
        except Exception as e:
            print(f"Error checking/importing nodes: {e}")
        
        try:
            # Check if StargazerOverlap table has data
            result = conn.execute("MATCH ()-[r:StargazerOverlap]->() RETURN COUNT(r)").get_as_df()
            if result.iloc[0, 0] == 0:
                print("Importing edges...")
                conn.execute(f"COPY StargazerOverlap FROM '{edge_csv_path}' (HEADER=false)")
            else:
                print("StargazerOverlap table already has data, skipping import")
        except Exception as e:
            print(f"Error checking/importing edges: {e}")
        
        # Clean up temporary files
        os.unlink(node_csv_path)
        os.unlink(edge_csv_path)
        
        print("Database creation completed!")
        
        # Print some statistics
        print("\nDatabase Statistics:")
        node_count = conn.execute("MATCH (r:Repository) RETURN COUNT(r)").get_as_df()
        edge_count = conn.execute("MATCH ()-[s:StargazerOverlap]->() RETURN COUNT(s)").get_as_df()
        
        print(f"Nodes: {node_count.iloc[0, 0]}")
        print(f"Edges: {edge_count.iloc[0, 0]}")
    
    def make_database_readonly(self, db_path: str):
        """Make the database read-only by testing read-only access."""
        try:
            # Test read-only access
            read_only_db = kuzu.Database(db_path, read_only=True)
            read_only_conn = kuzu.Connection(read_only_db)
            
            # Test a simple query to ensure read-only mode works
            read_only_conn.execute("MATCH (r:Repository) RETURN COUNT(r) LIMIT 1").get_as_df()
            
            # Close the test connection
            read_only_conn.close()
            read_only_db.close()
            
            print("🔒 Database is now in read-only mode")
            return True
            
        except Exception as e:
            print(f"⚠️  Failed to switch database to read-only mode: {e}")
            return False
    
    def get_github_readme(self, owner, repo, token=None):
        """Fetch README file from GitHub repository."""
        # Try different README file names
        readme_files = ['README.md', 'README.rst', 'README.txt', 'README']
        
        headers = {}
        if token:
            headers['Authorization'] = f'token {token}'
        
        for readme_file in readme_files:
            try:
                url = f"https://api.github.com/repos/{owner}/{repo}/contents/{readme_file}"
                response = requests.get(url, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'content' in data:
                        # Decode base64 content
                        content = base64.b64decode(data['content']).decode('utf-8')
                        return content
                
                # Rate limiting
                if response.status_code == 403:
                    print(f"Rate limited for {owner}/{repo}, waiting...")
                    time.sleep(60)  # Wait 1 minute
                    continue
                    
            except Exception as e:
                print(f"Error fetching README for {owner}/{repo}: {e}")
                continue
        
        return ""

    def get_github_readme_optimized(self, owner, repo, token=None):
        """Fetch README file from GitHub repository with better error handling and caching."""
        # Check cache first
        cached_content = self.get_cached_readme(owner, repo)
        if cached_content:
            print(f"  📋 Using cached README for {owner}/{repo}")
            return cached_content
        
        # Try different README file names
        readme_files = ['README.md', 'README.rst', 'README.txt', 'README']
        
        headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'DeepGit-DeepGitAI/1.0'
        }
        if token:
            headers['Authorization'] = f'token {token}'
        
        for readme_file in readme_files:
            try:
                url = f"https://api.github.com/repos/{owner}/{repo}/contents/{readme_file}"
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'content' in data:
                        # Decode base64 content
                        content = base64.b64decode(data['content']).decode('utf-8')
                        # Cache the content
                        self.cache_readme(owner, repo, content)
                        return content
                
                # Handle rate limiting with exponential backoff
                elif response.status_code == 403:
                    reset_time = response.headers.get('X-RateLimit-Reset')
                    if reset_time:
                        wait_time = int(reset_time) - int(time.time()) + 10
                        if wait_time > 0:
                            print(f"Rate limited for {owner}/{repo}, waiting {wait_time}s...")
                            time.sleep(wait_time)
                            continue
                    else:
                        print(f"Rate limited for {owner}/{repo}, waiting 60s...")
                        time.sleep(60)
                        continue
                        
                elif response.status_code == 404:
                    # README not found, try next file
                    continue
                    
            except requests.exceptions.Timeout:
                print(f"Timeout fetching README for {owner}/{repo}, retrying with longer timeout...")
                try:
                    # Retry with longer timeout
                    response = requests.get(url, headers=headers, timeout=30)
                    if response.status_code == 200:
                        data = response.json()
                        if 'content' in data:
                            content = base64.b64decode(data['content']).decode('utf-8')
                            self.cache_readme(owner, repo, content)
                            return content
                except Exception as retry_e:
                    print(f"Retry failed for {owner}/{repo}: {retry_e}")
                continue
            except requests.exceptions.ConnectionError:
                print(f"Connection error fetching README for {owner}/{repo}, will retry later")
                continue
            except Exception as e:
                print(f"Error fetching README for {owner}/{repo}: {e}")
                continue
        
        # Cache "no README" result to avoid repeated GitHub API calls
        self.cache_readme(owner, repo, "")
        return ""
    
    def clean_text_for_csv(self, text):
        """Clean text to be safe for CSV storage."""
        # Handle non-string inputs
        if text is None:
            return ""
        if not isinstance(text, str):
            text = str(text)
        
        # Replace newlines with spaces
        text = text.replace('\n', ' ').replace('\r', ' ')
        # Replace multiple spaces with single space
        text = re.sub(r'\s+', ' ', text)
        # Truncate if too long (Kuzu has limits)
        if len(text) > 10000:
            text = text[:10000] + "... [truncated]"
        return text.strip()
    
    def add_readme_to_database(self, db_path, token=None):
        """Add README content to existing Kuzu database."""
        if kuzu is None:
            raise ImportError("kuzu is not available")
            
        # Connect to database
        db = kuzu.Database(db_path)
        conn = kuzu.Connection(db)
        
        # Get all repositories
        print("Fetching repository list from database...")
        repos = conn.execute("MATCH (r:Repository) RETURN r.id, r.github_url").get_as_df()
        
        print(f"Found {len(repos)} repositories")
        
        # Create a new node table for README data
        print("Creating README node table...")
        
        # Check if RepositoryReadme table already exists
        try:
            conn.execute("DROP NODE TABLE IF EXISTS RepositoryReadme")
        except:
            pass
        
        readme_schema = """
        CREATE NODE TABLE RepositoryReadme (
            repo_id STRING,
            readme_content STRING,
            readme_length INT64,
            PRIMARY KEY (repo_id)
        )
        """
        conn.execute(readme_schema)
        
        # Extract README content for each repository
        print("Extracting README content...")
        readme_data = []
        
        for _, row in repos.iterrows():
            repo_id = row['r.id']
            github_url = row['r.github_url']
            
            if not github_url or github_url == '':
                continue
            
            # Extract owner/repo from GitHub URL
            match = re.search(r'github\.com/([^/]+)/([^/]+)', github_url)
            if not match:
                continue
            
            owner, repo = match.groups()
            print(f"Processing {owner}/{repo}...")
            
            readme_content = self.get_github_readme(owner, repo, token)
            
            if readme_content:
                # Clean the content for CSV storage
                cleaned_content = self.clean_text_for_csv(readme_content)
                original_length = len(readme_content)
                
                # Create embedding if embedding model is available
                embedding = None
                embedding_provider = None
                if self.embedding_model:
                    embedding = self.create_readme_embedding(readme_content)
                    embedding_provider = self.embedding_provider
                
                readme_data.append((repo_id, cleaned_content, original_length, embedding, embedding_provider))
                print(f"  ✓ Found README ({original_length} characters, stored: {len(cleaned_content)} characters)")
            else:
                print(f"  ✗ No README found")
            
            # Rate limiting - be respectful to GitHub API
            time.sleep(1)
        
        # Insert README data into database
        print(f"\nInserting {len(readme_data)} README files into database...")
        
        # Create temporary CSV file for README data
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as readme_csv:
            readme_writer = csv.writer(readme_csv, quoting=csv.QUOTE_ALL)
            for repo_id, content, length, embedding, embedding_provider in readme_data:
                readme_writer.writerow([repo_id, content, length, embedding, embedding_provider])
            readme_csv_path = readme_csv.name
        
        # Import README data with parallel disabled
        conn.execute(f"COPY RepositoryReadme FROM '{readme_csv_path}' (HEADER=false, PARALLEL=false)")
        
        # Clean up temporary file
        os.unlink(readme_csv_path)
        
        print("README extraction completed!")
        
        # Print statistics
        readme_count = conn.execute("MATCH (r:RepositoryReadme) RETURN COUNT(r)").get_as_df()
        print(f"Total README files stored: {readme_count.iloc[0, 0]}")
    
    def add_readme_to_database_optimized(self, db_path, token=None):
        """Add README content to existing Kuzu database with optimizations."""
        if kuzu is None:
            raise ImportError("kuzu is not available")
            
        # Connect to database
        db = kuzu.Database(db_path)
        conn = kuzu.Connection(db)
        
        # Get all repositories
        print("Fetching repository list from database...")
        repos = conn.execute("MATCH (r:Repository) RETURN r.id, r.github_url").get_as_df()
        
        print(f"Found {len(repos)} repositories")
        
        # Create a new node table for README data
        print("Creating README node table...")
        
        # Check if RepositoryReadme table already exists
        try:
            conn.execute("DROP NODE TABLE IF EXISTS RepositoryReadme")
        except:
            pass
        
        readme_schema = """
        CREATE NODE TABLE RepositoryReadme (
            repo_id STRING,
            readme_content STRING,
            readme_length INT64,
            PRIMARY KEY (repo_id)
        )
        """
        conn.execute(readme_schema)
        
        # Extract README content for each repository with optimizations
        print("Extracting README content...")
        readme_data = []
        
        # Process repositories in batches for better progress tracking
        batch_size = 10
        total_repos = len(repos)
        processed = 0
        successful = 0
        cached = 0
        failed = 0
        
        for i in range(0, total_repos, batch_size):
            batch = repos.iloc[i:i+batch_size]
            print(f"\nProcessing batch {i//batch_size + 1}/{(total_repos + batch_size - 1)//batch_size}")
            
            for _, row in batch.iterrows():
                repo_id = row['r.id']
                github_url = row['r.github_url']
                processed += 1
                
                if not github_url or github_url == '':
                    continue
                
                # Extract owner/repo from GitHub URL
                match = re.search(r'github\.com/([^/]+)/([^/]+)', github_url)
                if not match:
                    continue
                
                owner, repo = match.groups()
                print(f"  [{processed}/{total_repos}] Processing {owner}/{repo}...")
                
                # Check if we have cached content
                cached_content = self.get_cached_readme(owner, repo)
                if cached_content:
                    cached += 1
                    print(f"    📋 Using cached README for {owner}/{repo}")
                    cleaned_content = self.clean_text_for_csv(cached_content)
                    # Handle non-string cached content
                    if isinstance(cached_content, str):
                        original_length = len(cached_content)
                    else:
                        original_length = len(str(cached_content))
                    # Create embedding if embedding model is available
                    embedding = None
                    embedding_provider = None
                    if self.embedding_model:
                        embedding = self.create_readme_embedding(cached_content)
                        embedding_provider = self.embedding_provider
                    
                    readme_data.append((repo_id, cleaned_content, original_length, embedding, embedding_provider))
                    successful += 1
                    continue
                
                readme_content = self.get_github_readme_optimized(owner, repo, token)
                
                if readme_content:
                    # Clean the content for CSV storage
                    cleaned_content = self.clean_text_for_csv(readme_content)
                    original_length = len(readme_content)
                    
                    # Create embedding if embedding model is available
                    embedding = None
                    embedding_provider = None
                    if self.embedding_model:
                        embedding = self.create_readme_embedding(readme_content)
                        embedding_provider = self.embedding_provider
                    
                    readme_data.append((repo_id, cleaned_content, original_length, embedding, embedding_provider))
                    successful += 1
                    print(f"    ✓ Found README ({original_length} characters, stored: {len(cleaned_content)} characters)")
                else:
                    failed += 1
                    print(f"    ✗ No README found")
                
                # Adaptive rate limiting based on GitHub's headers
                if token:
                    # With token: 5000 requests per hour = ~1 request per 0.72 seconds
                    time.sleep(0.5)  # Reduced from 0.8 to 0.5 seconds
                else:
                    # Without token: 60 requests per hour = ~1 request per 60 seconds
                    time.sleep(60)
            
            # Progress update after each batch
            print(f"  Batch complete. Progress: {processed}/{total_repos} repos processed")
            print(f"  Statistics: {successful} successful, {cached} cached, {failed} failed")
        
        # Insert README data into database
        print(f"\nInserting {len(readme_data)} README files into database...")
        
        # Create temporary CSV file for README data
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as readme_csv:
            readme_writer = csv.writer(readme_csv, quoting=csv.QUOTE_ALL)
            for repo_id, content, length, embedding, embedding_provider in readme_data:
                readme_writer.writerow([repo_id, content, length, embedding, embedding_provider])
            readme_csv_path = readme_csv.name
        
        # Import README data with parallel disabled
        conn.execute(f"COPY RepositoryReadme FROM '{readme_csv_path}' (HEADER=false, PARALLEL=false)")
        
        # Clean up temporary file
        os.unlink(readme_csv_path)
        
        print("README extraction completed!")
        
        # Print detailed statistics
        readme_count = conn.execute("MATCH (r:RepositoryReadme) RETURN COUNT(r)").get_as_df()
        total_stored = readme_count.iloc[0, 0]
        
        print(f"\n📊 README Extraction Summary:")
        print(f"  Total repositories processed: {processed}")
        print(f"  Successful extractions: {successful}")
        print(f"  Cached READMEs used: {cached}")
        print(f"  Failed extractions: {failed}")
        print(f"  Total READMEs stored: {total_stored}")
        print(f"  Success rate: {successful/processed*100:.1f}%" if processed > 0 else "  Success rate: N/A")
        print(f"  Cache hit rate: {cached/(successful+cached)*100:.1f}%" if (successful+cached) > 0 else "  Cache hit rate: 0%")

    def extract_readmes_from_repos(self, db_path, token=None):
        """Extract README files from repositories in the database."""
        self.add_readme_to_database(db_path, token)
    
    def extract_readmes_from_repos_optimized(self, db_path, token=None):
        """Extract README files from repositories in the database with optimizations."""
        self.add_readme_to_database_optimized(db_path, token)
    
    def extract_readmes_from_repos_with_progress(self, db_path, token=None, progress_dict=None):
        """Extract README files from repositories in the database with progress updates."""
        self.add_readme_to_database_with_progress(db_path, token, progress_dict)
    
    def add_readme_to_database_with_progress(self, db_path, token=None, progress_dict=None):
        """Add README content to existing Kuzu database with progress tracking."""
        if kuzu is None:
            raise ImportError("kuzu is not available")
            
        # Connect to database
        db = kuzu.Database(db_path)
        conn = kuzu.Connection(db)
        
        # Fix database schema if needed
        self.fix_database_schema(db_path)
        
        # Get all repositories (we'll check for existing README content later)
        print("Fetching repository list from database...")
        repos = conn.execute("MATCH (r:Repository) RETURN r.id, r.github_url").get_as_df()
        
        print(f"Found {len(repos)} repositories")
        
        # Estimate time for README extraction
        estimated_time_per_repo = 2.0  # seconds (conservative estimate)
        estimated_total_time = len(repos) * estimated_time_per_repo
        estimated_minutes = int(estimated_total_time // 60)
        estimated_seconds = int(estimated_total_time % 60)
        
        print(f"⏱️  Estimated README extraction time: {estimated_minutes}m{estimated_seconds}s")
        print(f"   (This may vary based on GitHub API rate limits and network conditions)")
        
        # Import time for progress tracking
        import time
        start_time = time.time()
        
        # Update progress with total count
        if progress_dict:
            progress_dict["total"] = len(repos)
            progress_dict["current"] = 0
            progress_dict["message"] = f"Found {len(repos)} repositories to process"
        
        # Add README properties to existing Repository table
        print("Preparing README properties for Repository table...")
        
        # Check if README properties already exist, if not add them
        try:
            conn.execute("MATCH (r:Repository) RETURN r.readme_content LIMIT 1")
            print("README properties already exist in Repository table")
        except:
            print("Adding README properties to Repository table...")
            try:
                # Add readme_content property
                conn.execute("ALTER TABLE Repository ADD COLUMN readme_content STRING")
                print("Added readme_content property")
            except Exception as add_e:
                if "already exists" in str(add_e).lower():
                    print("readme_content property already exists")
                else:
                    print(f"Warning: Could not add readme_content property: {add_e}")
            
            try:
                # Add readme_length property
                conn.execute("ALTER TABLE Repository ADD COLUMN readme_length INT64")
                print("Added readme_length property")
            except Exception as add_e:
                if "already exists" in str(add_e).lower():
                    print("readme_length property already exists")
                else:
                    print(f"Warning: Could not add readme_length property: {add_e}")
        
        # Extract README content for each repository with optimizations
        print("Extracting README content...")
        readme_data = []
        
        # Pre-filter repositories to avoid processing empty URLs
        valid_repos = []
        for _, row in repos.iterrows():
            github_url = row['r.github_url']
            if github_url and github_url.strip():
                match = re.search(r'github\.com/([^/]+)/([^/]+)', github_url)
                if match:
                    valid_repos.append((row['r.id'], match.groups()[0], match.groups()[1]))
        
        print(f"Found {len(valid_repos)} valid repositories to process")
        
        # Check existing README content in cache database
        existing_readmes = self.preload_cache()
        if existing_readmes > 0:
            print(f"🚀 Found {existing_readmes} existing READMEs in cache database")
        
        # Batch check which repositories already have cached READMEs
        cached_repos = self.get_cached_repos_batch(valid_repos)
        
        # Process ALL repositories (both cached and non-cached) to ensure READMEs get into Kuzu database
        repos_to_process = valid_repos  # Process all valid repositories
        
        print(f"📊 Processing {len(repos_to_process)} repositories ({len(cached_repos)} cached)")
        
        # Process repositories in batches for better progress tracking
        batch_size = 50  # Increased batch size for better performance
        total_repos = len(repos_to_process)
        processed = 0
        successful = 0
        cached = len(cached_repos)  # Count cached repos as successful
        failed = 0
        
        for i in range(0, total_repos, batch_size):
            batch = repos_to_process[i:i+batch_size]
            print(f"\nProcessing batch {i//batch_size + 1}/{(total_repos + batch_size - 1)//batch_size}")
            
            # Get cached content for the entire batch at once
            batch_cached_content = self._get_batch_cached_content(batch)
            
            # Separate cached and uncached repositories
            cached_repos_in_batch = []
            uncached_repos_in_batch = []
            
            for repo_id, owner, repo in batch:
                if (owner, repo) in batch_cached_content:
                    cached_content, cached_length = batch_cached_content[(owner, repo)]
                    cached_repos_in_batch.append((repo_id, owner, repo, cached_content, cached_length))
                else:
                    uncached_repos_in_batch.append((repo_id, owner, repo))
            
            print(f"  📊 Batch {i//batch_size + 1}: {len(cached_repos_in_batch)} cached, {len(uncached_repos_in_batch)} API calls")
            
            # Process cached repositories (no API calls needed)
            for repo_id, owner, repo, cached_content, cached_length in cached_repos_in_batch:
                processed += 1
                
                if cached_content:
                    # Clean the content for CSV storage
                    cleaned_content = self.clean_text_for_csv(cached_content)
                    
                    # Create embedding if embedding model is available
                    embedding = None
                    embedding_provider = None
                    if self.embedding_model:
                        embedding = self.create_readme_embedding(cached_content)
                        embedding_provider = self.embedding_provider
                    
                    readme_data.append((repo_id, cleaned_content, cached_length, embedding, embedding_provider))
                    successful += 1
                else:
                    failed += 1
            
            # Process uncached repositories (GitHub API calls)
            for repo_id, owner, repo in uncached_repos_in_batch:
                processed += 1
                
                # Fetch from GitHub
                readme_content = self.get_github_readme_optimized(owner, repo, token)
                
                if readme_content:
                    # Clean the content for CSV storage
                    cleaned_content = self.clean_text_for_csv(readme_content)
                    original_length = len(readme_content)
                    
                    # Create embedding if embedding model is available
                    embedding = None
                    embedding_provider = None
                    if self.embedding_model:
                        embedding = self.create_readme_embedding(readme_content)
                        embedding_provider = self.embedding_provider
                    
                    readme_data.append((repo_id, cleaned_content, original_length, embedding, embedding_provider))
                    successful += 1
                else:
                    failed += 1
                
                # Adaptive rate limiting based on GitHub's headers
                if token:
                    # With token: 5000 requests per hour = ~1 request per 0.72 seconds
                    time.sleep(0.5)  # Reduced from 0.8 to 0.5 seconds
                else:
                    # Without token: 60 requests per hour = ~1 request per 60 seconds
                    time.sleep(60)
            
            # Update progress with time estimation
            if progress_dict:
                current_time = time.time()
                elapsed_time = current_time - start_time
                
                if processed > 0:
                    # Calculate estimated time remaining
                    avg_time_per_repo = elapsed_time / processed
                    remaining_repos = total_repos - processed
                    estimated_remaining_time = avg_time_per_repo * remaining_repos
                    
                    # Format time estimates
                    elapsed_minutes = int(elapsed_time // 60)
                    elapsed_seconds = int(elapsed_time % 60)
                    remaining_minutes = int(estimated_remaining_time // 60)
                    remaining_seconds = int(estimated_remaining_time % 60)
                    
                    progress_dict["current"] = processed
                    progress_dict["message"] = f"Extracting READMEs ({processed}/{total_repos}) - Elapsed: {elapsed_minutes}m{elapsed_seconds}s, ETA: {remaining_minutes}m{remaining_seconds}s (Cached: {cached})"
                else:
                    progress_dict["current"] = processed
                    progress_dict["message"] = f"Extracting README content from repositories ({processed}/{total_repos}) (Cached: {cached})"
                
                # Reduced delay for faster processing
                time.sleep(0.01)
            
            # Add checkpoint every 100 repositories to prevent data loss (reduced frequency for better performance)
            if processed % 100 == 0 and readme_data:
                try:
                    # Insert current batch to database
                    for repo_id, content, length, embedding, embedding_provider in readme_data:
                        try:
                            conn.execute("""
                                MERGE (r:Repository {id: $repo_id})
                                SET r.readme_content = $content, r.readme_length = $length, r.readme_embedding = $embedding, r.embedding_provider = $embedding_provider
                            """, parameters={"repo_id": repo_id, "content": content, "length": length, "embedding": embedding, "embedding_provider": embedding_provider})
                        except Exception as e:
                            if "Cannot find property" in str(e):
                                # Try to add the properties first
                                conn.execute("ALTER TABLE Repository ADD COLUMN readme_content STRING")
                                conn.execute("ALTER TABLE Repository ADD COLUMN readme_length INT64")
                                conn.execute("ALTER TABLE Repository ADD COLUMN readme_embedding DOUBLE[]")
                                conn.execute("ALTER TABLE Repository ADD COLUMN embedding_provider STRING")
                                # Retry the insertion
                                conn.execute("""
                                    MERGE (r:Repository {id: $repo_id})
                                    SET r.readme_content = $content, r.readme_length = $length, r.readme_embedding = $embedding, r.embedding_provider = $embedding_provider
                                """, parameters={"repo_id": repo_id, "content": content, "length": length, "embedding": embedding, "embedding_provider": embedding_provider})
                            else:
                                print(f"  ⚠️  Checkpoint insertion failed for {repo_id}: {e}")
                    
                    print(f"  💾 Checkpoint saved: {len(readme_data)} READMEs processed")
                    readme_data = []  # Clear the batch
                except Exception as e:
                    print(f"  ⚠️  Checkpoint failed: {e}")
                    # Continue processing even if checkpoint fails
            
            # Progress update after each batch
            print(f"  ✅ Batch complete: {processed}/{total_repos} processed ({successful} successful, {failed} failed)")
            
            # Update progress after each batch
            if progress_dict:
                progress_dict["current"] = processed
                progress_dict["message"] = f"Processed batch {i//batch_size + 1}/{(total_repos + batch_size - 1)//batch_size} - {processed}/{total_repos} repositories (Cached: {cached})"
                time.sleep(0.01)  # Reduced delay for faster processing
        
        # Update progress for final step
        if progress_dict:
            progress_dict["current_step"] = "Saving to database..."
            progress_dict["message"] = f"Saving {len(readme_data)} README files to database"
        
        # Insert remaining README data directly into Repository table
        if readme_data:
            print(f"\nInserting final batch of {len(readme_data)} README files into database...")
            for repo_id, content, length, embedding, embedding_provider in readme_data:
                try:
                    # Try to insert README data with error handling for missing properties
                    conn.execute("""
                        MERGE (r:Repository {id: $repo_id})
                        SET r.readme_content = $content, r.readme_length = $length
                    """, parameters={"repo_id": repo_id, "content": content, "length": length})
                except Exception as e:
                    if "Cannot find property" in str(e):
                        print(f"  ⚠️  Property missing, attempting to add properties first...")
                        try:
                            # Try to add the properties first
                            conn.execute("ALTER TABLE Repository ADD COLUMN readme_content STRING")
                            conn.execute("ALTER TABLE Repository ADD COLUMN readme_length INT64")
                            print(f"  ✅ Properties added, retrying insertion...")
                            # Retry the insertion
                            conn.execute("""
                                MERGE (r:Repository {id: $repo_id})
                                SET r.readme_content = $content, r.readme_length = $length, r.readme_embedding = $embedding, r.embedding_provider = $embedding_provider
                            """, parameters={"repo_id": repo_id, "content": content, "length": length, "embedding": embedding, "embedding_provider": embedding_provider})
                        except Exception as retry_e:
                            print(f"  ❌ Failed to add properties or retry insertion: {retry_e}")
                    else:
                        print(f"  ⚠️  Failed to insert README for repo {repo_id}: {e}")
        
        print("README extraction completed!")
        
        # Print detailed statistics
        try:
            readme_count = conn.execute("""
                MATCH (r:Repository) 
                WHERE r.readme_content IS NOT NULL AND r.readme_content <> ''
                RETURN COUNT(r)
            """).get_as_df()
            total_stored = readme_count.iloc[0, 0]
        except Exception as e:
            print(f"  ⚠️  Could not count stored READMEs: {e}")
            # Try alternative approach - count all repositories
            try:
                total_repos = conn.execute("MATCH (r:Repository) RETURN COUNT(r)").get_as_df()
                total_stored = total_repos.iloc[0, 0] if len(total_repos) > 0 else 0
                print(f"  📊 Total repositories in database: {total_stored}")
            except Exception as alt_e:
                print(f"  ⚠️  Could not count repositories either: {alt_e}")
                total_stored = len(readme_data)  # Use processed count as fallback
        
        print(f"\n✅ README extraction completed: {successful} successful, {failed} failed, {cached} cached")
        
        # Calculate and display total time taken
        total_time = time.time() - start_time
        total_minutes = int(total_time // 60)
        total_seconds = int(total_time % 60)
        print(f"⏱️  Time taken: {total_minutes}m{total_seconds}s")
        
        # Make database read-only after README extraction is complete
        self.make_database_readonly(db_path)
    
    def setup_database_from_gexf(self, gexf_content: str, github_token: str, session_id: str = None) -> Dict[str, Any]:
        """Set up the Kuzu database from GEXF content and extract README data."""
        try:
            # Check if required modules are available
            if kuzu is None:
                return {
                    "success": False,
                    "error": "kuzu module not available",
                    "message": "Please install kuzu: pip install kuzu"
                }
            
            # Create kuzu directory if it doesn't exist
            kuzu_dir = Path(__file__).parent.parent / "kuzu"
            kuzu_dir.mkdir(exist_ok=True)
            
            # Calculate hash of the GEXF content to check if we can reuse existing database
            import hashlib
            gexf_hash = hashlib.md5(gexf_content.encode()).hexdigest()
            
            # Look for existing database with the same hash
            existing_db_path = kuzu_dir / f"deepgit_ai_db_{gexf_hash}"
            
            if existing_db_path.exists():
                # Database already exists for this graph, reuse it
                print(f"🔄 Reusing existing database: {existing_db_path}")
                self.db_path = existing_db_path
                
                # Check if README data exists
                try:
                    db = kuzu.Database(str(self.db_path))
                    conn = kuzu.Connection(db)
                    readme_count = conn.execute("""
                        MATCH (r:Repository) 
                        WHERE r.readme_content IS NOT NULL AND r.readme_content <> ''
                        RETURN COUNT(r)
                    """).get_as_df()
                    has_readmes = readme_count.iloc[0, 0] > 0
                    
                    if has_readmes:
                        print("✅ Database and README data already available, skipping setup")
                        # Make database read-only since it's complete
                        self.make_database_readonly(str(self.db_path))
                        return {
                            "success": True,
                            "db_path": str(self.db_path),
                            "message": "Database reused successfully (no changes needed)"
                        }
                    else:
                        print("📝 Database exists but missing README data, extracting READMEs...")
                        # Extract README data
                        self.extract_readmes_from_repos_optimized(str(self.db_path), github_token)
                        # Make database read-only after README extraction
                        self.make_database_readonly(str(self.db_path))
                        
                        return {
                            "success": True,
                            "db_path": str(self.db_path),
                            "message": "Database reused, README data extracted"
                        }
                        
                except Exception as e:
                    print(f"⚠️ Error checking existing database: {e}, creating new one")
                    # Fall through to create new database
            
            # Create a new database with hash-based naming
            self.db_path = existing_db_path  # Use hash-based name for consistency
            self.session_id = session_id  # Track session ownership
            
            # Create temporary GEXF file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.gexf', delete=False) as temp_gexf:
                temp_gexf.write(gexf_content)
                temp_gexf_path = temp_gexf.name
            
            try:
                # Create Kuzu database from GEXF
                print("Creating Kuzu database from GEXF...")
                self.create_kuzu_database(temp_gexf_path, str(self.db_path))
                
                # Database-based system doesn't need file cleanup
                print("Using database-based README storage...")
                
                # Extract README data
                print("Extracting README data...")
                self.extract_readmes_from_repos_optimized(str(self.db_path), github_token)
                
                # Make database read-only after setup is complete
                self.make_database_readonly(str(self.db_path))
                
                return {
                    "success": True,
                    "db_path": str(self.db_path),
                    "message": "Database setup completed successfully"
                }
                
            finally:
                # Clean up temporary GEXF file
                os.unlink(temp_gexf_path)
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to setup database"
            }
    
    def setup_database_from_gexf_with_progress(self, gexf_content: str, github_token: str, progress_dict: dict = None, session_id: str = None) -> Dict[str, Any]:
        """Set up the Kuzu database from GEXF content and extract README data with progress updates."""
        try:
            # Check if required modules are available
            if kuzu is None:
                return {
                    "success": False,
                    "error": "kuzu module not available",
                    "message": "Please install kuzu: pip install kuzu"
                }
            
            # Create kuzu directory if it doesn't exist
            kuzu_dir = Path(__file__).parent.parent / "kuzu"
            kuzu_dir.mkdir(exist_ok=True)
            
            # Calculate hash of the GEXF content to check if we can reuse existing database
            import hashlib
            gexf_hash = hashlib.md5(gexf_content.encode()).hexdigest()
            
            # Look for existing database with the same hash
            existing_db_path = kuzu_dir / f"deepgit_ai_db_{gexf_hash}"
            
            if existing_db_path.exists():
                # Database already exists for this graph, reuse it
                if progress_dict:
                    progress_dict["current_step"] = "Reusing existing database..."
                    progress_dict["current"] = 50
                    progress_dict["message"] = "Found existing database for this graph, reusing it"
                
                print(f"🔄 Reusing existing database: {existing_db_path}")
                self.db_path = existing_db_path
                
                # Check if README data exists
                try:
                    db = kuzu.Database(str(self.db_path))
                    conn = kuzu.Connection(db)
                    readme_count = conn.execute("""
                        MATCH (r:Repository) 
                        WHERE r.readme_content IS NOT NULL AND r.readme_content <> ''
                        RETURN COUNT(r)
                    """).get_as_df()
                    has_readmes = readme_count.iloc[0, 0] > 0
                    
                    if has_readmes:
                        if progress_dict:
                            progress_dict["current_step"] = "Database ready..."
                            progress_dict["current"] = 100
                            progress_dict["message"] = "Database and README data already available"
                        
                        print("✅ Database and README data already available, skipping setup")
                        
                        # Make database read-only since it's complete
                        self.make_database_readonly(str(self.db_path))
                        
                        # Add a small delay to ensure progress messages are sent
                        if progress_dict:
                            import time
                            time.sleep(1)  # Give time for progress messages to be sent
                        
                        return {
                            "success": True,
                            "db_path": str(self.db_path),
                            "message": "Database reused successfully (no changes needed)"
                        }
                    else:
                        print("📝 Database exists but missing README data, extracting READMEs...")
                        if progress_dict:
                            progress_dict["current_step"] = "Extracting READMEs..."
                            progress_dict["current"] = 60
                            progress_dict["message"] = "Database exists, extracting README content"
                        
                        # Extract README data with progress updates
                        self.extract_readmes_from_repos_with_progress(str(self.db_path), github_token, progress_dict)
                        
                        # Make database read-only after README extraction
                        self.make_database_readonly(str(self.db_path))
                        
                        # Add a small delay to ensure progress messages are sent
                        if progress_dict:
                            import time
                            time.sleep(1)  # Give time for progress messages to be sent
                        
                        return {
                            "success": True,
                            "db_path": str(self.db_path),
                            "message": "Database reused, README data extracted"
                        }
                        
                except Exception as e:
                    print(f"⚠️ Error checking existing database: {e}, creating new one")
                    # Fall through to create new database
            
            # Create a new database with hash-based naming
            if progress_dict:
                progress_dict["current_step"] = "Creating database..."
                progress_dict["current"] = 10
                progress_dict["message"] = "Creating new Kuzu database from GEXF file"
            
            self.db_path = existing_db_path  # Use hash-based name for consistency
            self.session_id = session_id  # Track session ownership
            
            # Create temporary GEXF file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.gexf', delete=False) as temp_gexf:
                temp_gexf.write(gexf_content)
                temp_gexf_path = temp_gexf.name
            
            try:
                # Create Kuzu database from GEXF
                print("Creating Kuzu database from GEXF...")
                self.create_kuzu_database(temp_gexf_path, str(self.db_path))
                
                # Update progress
                if progress_dict:
                    progress_dict["current_step"] = "Database ready..."
                    progress_dict["current"] = 20
                    progress_dict["message"] = "Database created, using database-based README storage"
                
                # Database-based system doesn't need file cleanup
                print("Using database-based README storage...")
                
                # Update progress
                if progress_dict:
                    progress_dict["current_step"] = "Extracting READMEs..."
                    progress_dict["current"] = 30
                    progress_dict["message"] = "Starting README extraction from GitHub repositories"
                
                # Extract README data with progress updates
                print("Extracting README data...")
                try:
                    # Use threading-based timeout for better cross-platform compatibility
                    import threading
                    import time
                    
                    # Create a thread for README extraction
                    extraction_thread = threading.Thread(target=self.extract_readmes_from_repos_with_progress, args=(str(self.db_path), github_token, progress_dict))
                    extraction_thread.daemon = True
                    extraction_thread.start()
                    
                    # Wait for completion with timeout (50 minutes to stay well under gunicorn timeout)
                    extraction_thread.join(timeout=3000)
                    
                    if extraction_thread.is_alive():
                        print("⏰ README extraction timed out after 50 minutes, continuing with setup...")
                        if progress_dict:
                            progress_dict["current_step"] = "README extraction timed out, continuing..."
                            progress_dict["message"] = "README extraction timed out, but database setup will continue"
                    else:
                        print("✅ README extraction completed successfully")
                        
                except Exception as readme_error:
                    print(f"⚠️ README extraction failed: {readme_error}")
                    # Continue with setup even if README extraction fails
                    if progress_dict:
                        progress_dict["current_step"] = "README extraction failed, continuing..."
                        progress_dict["message"] = f"README extraction failed: {str(readme_error)[:100]}..."
                
                # Make database read-only after setup is complete
                self.make_database_readonly(str(self.db_path))
                
                return {
                    "success": True,
                    "db_path": str(self.db_path),
                    "message": "Database setup completed successfully"
                }
                
            finally:
                # Clean up temporary GEXF file
                os.unlink(temp_gexf_path)
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to setup database"
            }
    
    def check_database_exists(self, gexf_content: str) -> Dict[str, Any]:
        """Check if a valid database exists for the given GEXF content."""
        try:
            # Calculate hash of the GEXF content
            import hashlib
            gexf_hash = hashlib.md5(gexf_content.encode()).hexdigest()
            
            # Look for existing database with the same hash
            kuzu_dir = Path(__file__).parent.parent / "kuzu"
            existing_db_path = kuzu_dir / f"deepgit_ai_db_{gexf_hash}"
            
            if not existing_db_path.exists():
                return {
                    "exists": False,
                    "db_path": None,
                    "message": "No existing database found for this graph"
                }
            
            # Check if database is valid
            try:
                db = kuzu.Database(str(existing_db_path))
                conn = kuzu.Connection(db)
                
                # Check if Repository table exists and has data
                result = conn.execute("MATCH (r:Repository) RETURN COUNT(r)").get_as_df()
                repo_count = result.iloc[0, 0]
                
                if repo_count > 0:
                    return {
                        "exists": True,
                        "db_path": str(existing_db_path),
                        "repo_count": repo_count,
                        "message": f"Valid database found with {repo_count} repositories"
                    }
                else:
                    return {
                        "exists": False,
                        "db_path": str(existing_db_path),
                        "message": "Database exists but is empty"
                    }
                    
            except Exception as e:
                return {
                    "exists": False,
                    "db_path": str(existing_db_path),
                    "message": f"Database exists but is corrupted: {str(e)}"
                }
                
        except Exception as e:
            return {
                "exists": False,
                "db_path": None,
                "message": f"Error checking database: {str(e)}"
            }
    
    def update_readme_data(self, github_token: str, progress_dict: dict = None) -> Dict[str, Any]:
        """Update README data with a new GitHub token without recreating the database."""
        try:
            if not self.db_path or not os.path.exists(self.db_path):
                return {
                    "success": False,
                    "error": "Database not set up. Please setup database first.",
                    "message": "Database not found"
                }
            
            if progress_dict:
                progress_dict["current_step"] = "Updating README data..."
                progress_dict["current"] = 0
                progress_dict["message"] = "Updating README content with new GitHub token"
            
            # Extract README data with progress updates
            print("Updating README data with new GitHub token...")
            self.extract_readmes_from_repos_with_progress(str(self.db_path), github_token, progress_dict)
            
            return {
                "success": True,
                "message": "README data updated successfully"
            }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to update README data"
            }
    
    def change_provider(self, provider: str, api_keys: Dict[str, str]) -> Dict[str, Any]:
        """Change the DeepGitAI provider without recreating the database."""
        try:
            if not self.db_path or not os.path.exists(self.db_path):
                return {
                    "success": False,
                    "error": "Database not set up. Please setup database first.",
                    "message": "Database not found"
                }
            
            # Initialize DeepGitAI with new provider
            result = self.initialize_deepgit_ai(provider, api_keys)
            
            if result["success"]:
                return {
                    "success": True,
                    "message": f"Successfully changed provider to {provider}",
                    "provider": provider
                }
            else:
                return result
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to change provider"
            }
    
    def initialize_deepgit_ai(self, provider: str, api_keys: Dict[str, str]) -> Dict[str, Any]:
        """Initialize the DeepGitAI system with the specified provider."""
        try:
            # Check if required modules are available
            if StateGraph is None or END is None:
                return {
                    "success": False,
                    "error": "LangGraph modules not available",
                    "message": "Please install langgraph: pip install langgraph"
                }
            
            if not self.db_path or not os.path.exists(self.db_path):
                return {
                    "success": False,
                    "error": "Database not set up. Please setup database first.",
                    "message": "Database not found"
                }
            
            # Initialize embeddings first
            embedding_result = self.initialize_embeddings(provider, api_keys)
            if not embedding_result["success"]:
                print(f"⚠️ Embedding initialization failed: {embedding_result.get('error', 'Unknown error')}")
                # Continue without embeddings - not critical for basic functionality
            
            # Set environment variables for API keys
            if provider == "openai":
                os.environ["OPENAI_API_KEY"] = api_keys.get("openaiKey", "")
            elif provider == "azure_openai":
                os.environ["AZURE_OPENAI_API_KEY"] = api_keys.get("azureOpenAIKey", "")
                os.environ["AZURE_OPENAI_ENDPOINT"] = api_keys.get("azureOpenAIEndpoint", "")
                os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"] = api_keys.get("azureOpenAIDeployment", "")
            elif provider == "gemini":
                os.environ["GEMINI_API_KEY"] = api_keys.get("geminiKey", "")
            
            # Initialize DeepGitAI
            self.deepgit_ai_instance = MultiLLMDeepGitAI(str(self.db_path), provider)
            
            return {
                "success": True,
                "message": f"DeepGitAI initialized with {provider}",
                "embeddings_initialized": embedding_result["success"]
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to initialize DeepGitAI with {provider}"
            }
    
    def semantic_search_readmes(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Perform semantic search on README content using embeddings."""
        if not self.embedding_model or not self.db_path:
            return []
        
        try:
            # Create embedding for the query
            query_embedding = self.create_readme_embedding(query)
            if not query_embedding:
                return []
            
            # Connect to database
            db = kuzu.Database(str(self.db_path), read_only=True)
            conn = kuzu.Connection(db)
            
            # Get all repositories with embeddings
            repos_query = """
            MATCH (r:Repository)
            WHERE r.readme_embedding IS NOT NULL AND r.readme_content IS NOT NULL AND r.readme_content <> ''
            RETURN r.id, r.readme_content, r.readme_embedding, r.stars, r.primaryLanguage, r.topics
            """
            
            result = conn.execute(repos_query).get_as_df()
            
            if result.empty:
                return []
            
            # Calculate cosine similarity for each repository
            similarities = []
            for _, row in result.iterrows():
                repo_id = row['r.id']
                readme_content = row['r.readme_content']
                embedding = row['r.readme_embedding']
                stars = row['r.stars']
                language = row['r.primaryLanguage']
                topics = row['r.topics']
                
                if embedding and len(embedding) > 0:
                    # Calculate cosine similarity
                    similarity = self._cosine_similarity(query_embedding, embedding)
                    similarities.append({
                        'repo_id': repo_id,
                        'readme_content': readme_content,
                        'similarity': similarity,
                        'stars': stars,
                        'language': language,
                        'topics': topics
                    })
            
            # Sort by similarity and return top results
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            return similarities[:limit]
            
        except Exception as e:
            print(f"Error in semantic search: {e}")
            return []
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        try:
            import numpy as np
            
            # Convert to numpy arrays
            a = np.array(vec1)
            b = np.array(vec2)
            
            # Calculate cosine similarity
            dot_product = np.dot(a, b)
            norm_a = np.linalg.norm(a)
            norm_b = np.linalg.norm(b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            return dot_product / (norm_a * norm_b)
            
        except Exception as e:
            print(f"Error calculating cosine similarity: {e}")
            return 0.0
    
    def validate_query_scope(self, query: str) -> Dict[str, Any]:
        """Validate that the query is within the scope of the database."""
        try:
            # Connect to database to check available data
            db = kuzu.Database(str(self.db_path), read_only=True)
            conn = kuzu.Connection(db)
            
            # Get database statistics
            repo_count = conn.execute("MATCH (r:Repository) RETURN COUNT(r)").get_as_df().iloc[0, 0]
            readme_count = conn.execute("""
                MATCH (r:Repository) 
                WHERE r.readme_content IS NOT NULL AND r.readme_content <> ''
                RETURN COUNT(r)
            """).get_as_df().iloc[0, 0]
            
            # Get available languages
            languages = conn.execute("""
                MATCH (r:Repository) 
                WHERE r.primaryLanguage IS NOT NULL AND r.primaryLanguage <> ''
                RETURN DISTINCT r.primaryLanguage
                ORDER BY r.primaryLanguage
            """).get_as_df()
            
            # Get available topics
            topics = conn.execute("""
                MATCH (r:Repository) 
                WHERE r.topics IS NOT NULL AND r.topics <> ''
                RETURN DISTINCT r.topics
                ORDER BY r.topics
            """).get_as_df()
            
            available_languages = languages['r.primaryLanguage'].tolist() if not languages.empty else []
            available_topics = topics['r.topics'].tolist() if not topics.empty else []
            
            return {
                "success": True,
                "database_stats": {
                    "total_repositories": repo_count,
                    "repositories_with_readmes": readme_count,
                    "available_languages": available_languages[:20],  # Limit to first 20
                    "available_topics": available_topics[:20],  # Limit to first 20
                    "database_path": str(self.db_path)
                },
                "query_scope": "limited_to_database",
                "message": f"Query will be limited to {repo_count} repositories in the database"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to validate query scope"
            }
    
    def add_database_context_to_query(self, query: str) -> str:
        """Add database context information to the query to limit LLM responses."""
        try:
            # Get database statistics
            scope_info = self.validate_query_scope(query)
            
            if not scope_info["success"]:
                return query
            
            db_stats = scope_info["database_stats"]
            
            # Create context prefix
            context_prefix = f"""
DATABASE CONTEXT:
- This query is limited to {db_stats['total_repositories']} repositories in the Kuzu database
- {db_stats['repositories_with_readmes']} repositories have README content available
- Available programming languages: {', '.join(db_stats['available_languages'][:10])}
- Available topics: {', '.join(db_stats['available_topics'][:10])}

IMPORTANT: Only provide information about repositories, languages, and topics that exist in this specific database. Do not use external knowledge.

USER QUERY: {query}
"""
            
            return context_prefix
            
        except Exception as e:
            print(f"Error adding database context: {e}")
            return query
    
    def query_deepgit_ai(self, query: str) -> Dict[str, Any]:
        """Execute a query using the DeepGitAI system."""
        try:
            if not self.deepgit_ai_instance:
                return {
                    "success": False,
                    "error": "DeepGitAI not initialized",
                    "message": "Please initialize DeepGitAI first"
                }
            
            # Execute the query with database context if enabled
            config_manager = ConfigManager()
            include_context = config_manager.get("deepgit_ai.include_database_context", True)
            
            if include_context:
                contextualized_query = self.add_database_context_to_query(query)
                result = self.deepgit_ai_instance.query(contextualized_query)
            else:
                result = self.deepgit_ai_instance.query(query)
            
            return {
                "success": True,
                "result": result,
                "message": "Query executed successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to execute query"
            }
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        try:
            if not self.deepgit_ai_instance:
                return {
                    "success": False,
                    "error": "DeepGitAI not initialized",
                    "message": "Please initialize DeepGitAI first"
                }
            
            stats = self.deepgit_ai_instance.get_database_stats()
            
            return {
                "success": True,
                "stats": stats,
                "message": "Statistics retrieved successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to get database statistics"
            }
    
    def cleanup(self, session_id: str = None):
        """Clean up temporary files and database."""
        cleanup_details = {
            "database_deleted": False,
            "cache_cleared": False,
            "session_id": session_id,
            "errors": []
        }
        
        try:
            # Only cleanup if session_id matches or if no session_id is provided (legacy cleanup)
            if session_id and self.session_id and session_id != self.session_id:
                print(f"Skipping cleanup - session mismatch: {session_id} != {self.session_id}")
                cleanup_details["errors"].append("Session ID mismatch - skipping cleanup")
                return cleanup_details
            
            # Clean up Kuzu database
            if self.db_path and os.path.exists(self.db_path):
                try:
                    # Close any active connections first
                    if self.deepgit_ai_instance:
                        # Close database connections
                        if hasattr(self.deepgit_ai_instance, 'conn'):
                            self.deepgit_ai_instance.conn.close()
                        if hasattr(self.deepgit_ai_instance, 'db'):
                            self.deepgit_ai_instance.db.close()
                        self.deepgit_ai_instance = None
                    
                    # Delete the database file (Kuzu databases are files, not directories)
                    os.remove(self.db_path)
                    print(f"🗑️  Deleted Kuzu database: {self.db_path}")
                    cleanup_details["database_deleted"] = True
                    
                except Exception as db_error:
                    error_msg = f"Failed to delete database {self.db_path}: {db_error}"
                    print(f"⚠️  {error_msg}")
                    cleanup_details["errors"].append(error_msg)
                
                # Reset instance variables
                self.db_path = None
                self.session_id = None
            
            # Clean up README cache database (optional - you might want to keep this)
            # Uncomment the following lines if you want to clear the cache on cleanup
            # if os.path.exists(self.readme_cache_db_path):
            #     try:
            #         os.remove(self.readme_cache_db_path)
            #         print(f"🗑️  Deleted README cache database: {self.readme_cache_db_path}")
            #         cleanup_details["cache_cleared"] = True
            #     except Exception as cache_error:
            #         error_msg = f"Failed to delete cache database {self.readme_cache_db_path}: {cache_error}"
            #         print(f"⚠️  {error_msg}")
            #         cleanup_details["errors"].append(error_msg)
            
            print("✅ DeepGitAI cleanup completed")
            
        except Exception as e:
            error_msg = f"Unexpected error during cleanup: {e}"
            print(f"❌ {error_msg}")
            cleanup_details["errors"].append(error_msg)
        
        return cleanup_details
    
    def detect_graph_changes(self, current_gexf_content: str) -> Dict[str, Any]:
        """Detect if the current graph has changed compared to the DeepGitAI database."""
        try:
            if not self.db_path or not os.path.exists(self.db_path):
                return {
                    "has_changes": False,
                    "message": "No DeepGitAI database exists to compare against"
                }
            
            # Calculate hash of current GEXF content
            import hashlib
            current_hash = hashlib.md5(current_gexf_content.encode()).hexdigest()
            
            # Extract hash from database path (format: deepgit_ai_db_{hash})
            db_name = os.path.basename(self.db_path)
            if db_name.startswith("deepgit_ai_db_"):
                stored_hash = db_name[14:]  # Remove "deepgit_ai_db_" prefix
                
                if current_hash != stored_hash:
                    return {
                        "has_changes": True,
                        "current_hash": current_hash,
                        "stored_hash": stored_hash,
                        "message": "Graph structure has changed. DeepGitAI database may be outdated."
                    }
                else:
                    return {
                        "has_changes": False,
                        "message": "Graph structure matches current DeepGitAI database"
                    }
            else:
                return {
                    "has_changes": True,
                    "message": "Cannot determine graph hash from database path"
                }
                
        except Exception as e:
            return {
                "has_changes": True,
                "error": str(e),
                "message": "Error detecting graph changes"
            }
    
    def should_rebuild_database(self, current_gexf_content: str) -> Dict[str, Any]:
        """Check if DeepGitAI database should be rebuilt based on graph changes."""
        change_detection = self.detect_graph_changes(current_gexf_content)
        
        if change_detection.get("has_changes", False):
            return {
                "should_rebuild": True,
                "reason": "Graph structure has changed",
                "details": change_detection,
                "message": "The graph structure has changed since the DeepGitAI database was created. Would you like to rebuild the database to include the latest changes?"
            }
        else:
            return {
                "should_rebuild": False,
                "message": "DeepGitAI database is up to date"
            }

class MultiLLMDeepGitAI:
    """Enhanced DeepGitAI system with support for multiple LLM providers."""
    
    def __init__(self, db_path: str, llm_provider: str = "openai"):
        """Initialize the DeepGitAI system."""
        self.db_path = db_path
        self.db = kuzu.Database(db_path, read_only=True)  # Use read-only mode for DeepGitAI
        self.conn = kuzu.Connection(self.db)
        self.llm_provider = llm_provider
        
        # Get reference to the service instance for semantic search
        self.service = deepgit_ai_service
        
        # Initialize LLM based on provider
        self.llm = self._initialize_llm()
        
        # Initialize the workflow
        self.workflow = self._create_workflow()
        
        print(f"Multi-LLM DeepGitAI system initialized with database: {db_path}")
        print(f"LLM Provider: {llm_provider}")
        if llm_provider == "azure_openai":
            deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "unknown")
            print(f"Azure OpenAI Deployment: {deployment_name}")
        print(f"Total repositories: {self._get_repo_count()}")
        print(f"Total README files: {self._get_readme_count()}")
    
    def _initialize_llm(self):
        """Initialize the LLM based on the selected provider."""
        
        if self.llm_provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key or api_key == "your_openai_api_key_here":
                raise ValueError("OpenAI API key not found. Please set OPENAI_API_KEY")
            
            return ChatOpenAI(
                model=os.getenv("DEFAULT_MODEL", "gpt-4o-mini"),
                temperature=float(os.getenv("TEMPERATURE", "0.1")),
                api_key=api_key
            )
        
        elif self.llm_provider == "azure_openai":
            api_key = os.getenv("AZURE_OPENAI_API_KEY")
            endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
            deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
            
            if not api_key or api_key == "your_azure_openai_api_key_here":
                raise ValueError("Azure OpenAI API key not found. Please set AZURE_OPENAI_API_KEY")
            if not endpoint or endpoint == "https://your-resource-name.openai.azure.com/":
                raise ValueError("Azure OpenAI endpoint not found. Please set AZURE_OPENAI_ENDPOINT")
            if not deployment_name or deployment_name == "your-deployment-name":
                raise ValueError("Azure OpenAI deployment name not found. Please set AZURE_OPENAI_DEPLOYMENT_NAME")
            
            # Use Azure OpenAI specific client
            try:
                from langchain_openai import AzureChatOpenAI
                return AzureChatOpenAI(
                    model=deployment_name,
                    temperature=float(os.getenv("TEMPERATURE", "0.1")),
                    api_key=api_key,
                    azure_endpoint=endpoint.rstrip('/'),
                    api_version="2024-02-15-preview"
                )
            except ImportError:
                # Fallback to regular ChatOpenAI
                return ChatOpenAI(
                    model=deployment_name,
                    temperature=float(os.getenv("TEMPERATURE", "0.1")),
                    api_key=api_key,
                    base_url=endpoint.rstrip('/')
                )
        
        elif self.llm_provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key or api_key == "your_gemini_api_key_here":
                raise ValueError("Gemini API key not found. Please set GEMINI_API_KEY")
            
            return ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                temperature=float(os.getenv("TEMPERATURE", "0.1")),
                google_api_key=api_key
            )
        
        else:
            raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")
    
    def _get_repo_count(self) -> int:
        """Get total number of repositories."""
        result = self.conn.execute("MATCH (r:Repository) RETURN COUNT(r)").get_as_df()
        return result.iloc[0, 0]
    
    def _get_readme_count(self) -> int:
        """Get total number of README files."""
        try:
            result = self.conn.execute("""
                MATCH (r:Repository) 
                WHERE r.readme_content IS NOT NULL AND r.readme_content <> ''
                RETURN COUNT(r)
            """).get_as_df()
            return result.iloc[0, 0]
        except:
            return 0
    
    def _create_workflow(self) -> StateGraph:
        """Create the LangGraph workflow."""
        
        # Define the workflow
        workflow = StateGraph(DeepGitAIState)
        
        # Add nodes
        workflow.add_node("analyze_query", self._analyze_query_node)
        workflow.add_node("query_graph", self._query_graph_node)
        workflow.add_node("retrieve_readmes", self._retrieve_readmes_node)
        workflow.add_node("generate_answer", self._generate_answer_node)
        
        # Define the flow
        workflow.set_entry_point("analyze_query")
        workflow.add_edge("analyze_query", "query_graph")
        workflow.add_edge("query_graph", "retrieve_readmes")
        workflow.add_edge("retrieve_readmes", "generate_answer")
        workflow.add_edge("generate_answer", END)
        
        return workflow.compile()
    
    def _analyze_query_node(self, state: DeepGitAIState) -> DeepGitAIState:
        """Analyze the user query to determine what graph queries to run."""
        
        system_prompt = """You are a query analyzer for a DeepGitAI system. Your job is to analyze user queries and determine what graph queries should be executed to find relevant information.

Available graph queries:
1. find_similar_repos - Find repositories similar to a given one
2. find_by_language - Find repositories by programming language
3. find_by_topics - Find repositories by topics/keywords
4. find_connected_repos - Find repositories connected through stargazer overlap
5. find_popular_repos - Find most popular repositories
6. find_recent_repos - Find recently created repositories
7. find_by_activity - Find repositories by activity level (issues/PRs)
8. semantic_search - Find repositories using semantic search on README content

Analyze the query and return a JSON with:
- query_type: The type of graph query to run
- parameters: Any parameters needed for the query
- reasoning: Why this query type was chosen

Example queries:
- "Find repositories similar to scryer-prolog" -> find_similar_repos
- "Show me Rust projects" -> find_by_language
- "Find logic programming repositories" -> find_by_topics
- "What are the most popular repositories?" -> find_popular_repos
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Analyze this query: {state.query}")
        ]
        
        response = self.llm.invoke(messages)
        
        try:
            # Parse the response to extract query type and parameters
            content = response.content
            if "find_similar_repos" in content.lower():
                state.graph_results["query_type"] = "find_similar_repos"
                # Extract repository name
                match = re.search(r'(?:similar to|like)\s+([a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+)', state.query, re.IGNORECASE)
                if match:
                    state.graph_results["repo_name"] = match.group(1)
                else:
                    state.graph_results["repo_name"] = "mthom/scryer-prolog"  # default
            elif "rust" in state.query.lower():
                state.graph_results["query_type"] = "find_by_language"
                state.graph_results["language"] = "Rust"
            elif "logic" in state.query.lower():
                state.graph_results["query_type"] = "find_by_topics"
                state.graph_results["topic"] = "logic-programming"
            elif "popular" in state.query.lower():
                state.graph_results["query_type"] = "find_popular_repos"
            else:
                # Default to semantic search for general queries
                state.graph_results["query_type"] = "semantic_search"
                
        except Exception as e:
            state.error = f"Error analyzing query: {e}"
            state.graph_results["query_type"] = "find_popular_repos"
        
        return state
    
    def _query_graph_node(self, state: DeepGitAIState) -> DeepGitAIState:
        """Execute graph queries based on the analysis."""
        
        query_type = state.graph_results.get("query_type", "find_popular_repos")
        
        try:
            if query_type == "find_similar_repos":
                repo_name = state.graph_results.get("repo_name", "mthom/scryer-prolog")
                results = self._find_similar_repositories(repo_name)
            elif query_type == "find_by_language":
                language = state.graph_results.get("language", "Rust")
                results = self._find_by_language(language)
            elif query_type == "find_by_topics":
                topic = state.graph_results.get("topic", "logic-programming")
                results = self._find_by_topics(topic)
            elif query_type == "find_popular_repos":
                results = self._find_popular_repositories()
            elif query_type == "semantic_search":
                results = self._find_by_semantic_search(state.query)
            else:
                results = self._find_popular_repositories()
            
            state.graph_results["results"] = results
            
        except Exception as e:
            state.error = f"Error querying graph: {e}"
            state.graph_results["results"] = []
        
        return state
    
    def _retrieve_readmes_node(self, state: DeepGitAIState) -> DeepGitAIState:
        """Retrieve README content for the found repositories."""
        
        repos = state.graph_results.get("results", [])
        readme_data = []
        
        for repo in repos[:10]:  # Limit to top 10
            repo_id = repo.get("id", repo.get("repo_id"))
            if repo_id:
                readme_content = self._get_readme_content(repo_id)
                if readme_content:
                    readme_data.append({
                        "repo_id": repo_id,
                        "content": readme_content,
                        "stars": repo.get("stars", 0),
                        "language": repo.get("primaryLanguage", ""),
                        "topics": repo.get("topics", "")
                    })
        
        state.readme_content = readme_data
        return state
    
    def _generate_answer_node(self, state: DeepGitAIState) -> DeepGitAIState:
        """Generate the final answer using the graph results and README content."""
        
        system_prompt = """You are a helpful assistant that provides information about GitHub repositories based ONLY on the data provided in the context below.

CRITICAL CONSTRAINTS:
- You MUST ONLY use information from the provided context
- You MUST NOT use any external knowledge or general information
- You MUST NOT make assumptions about repositories not in the context
- You MUST NOT provide information about technologies, languages, or concepts not mentioned in the context
- If information is not available in the context, you MUST say "This information is not available in the current dataset"

You have access to:
1. Graph analysis results showing repository relationships and metadata from the Kuzu database
2. README content from the repositories stored in the database

Provide a comprehensive answer that:
- Explains the repositories found using ONLY the provided data
- Highlights key features from READMEs in the context
- Mentions relationships between repositories from the graph data
- Suggests which repositories might be most relevant based on the data

IMPORTANT: When mentioning repositories, use the format [repository_name](repo_id) to make them clickable. For example:
- "The [SWI-Prolog/swipl-devel](SWI-Prolog/swipl-devel) repository..."
- "Check out [souffle-lang/souffle](souffle-lang/souffle) for..."

Be informative but concise. If you cannot answer based on the provided context, explicitly state that the information is not available in the current dataset."""

        # Prepare context
        graph_results = state.graph_results.get("results", [])
        readme_content = state.readme_content
        
        context = f"""
Graph Analysis Results:
{json.dumps(graph_results[:5], indent=2)}

README Content Summary:
"""
        
        for readme in readme_content[:3]:  # Top 3 READMEs
            content_preview = readme["content"][:500] + "..." if len(readme["content"]) > 500 else readme["content"]
            context += f"""
Repository: {readme['repo_id']} (ID: {readme['repo_id']})
Stars: {readme['stars']}
Language: {readme['language']}
Topics: {readme['topics']}
README Preview: {content_preview}
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"User Query: {state.query}\n\nContext:\n{context}")
        ]
        
        response = self.llm.invoke(messages)
        state.final_answer = response.content
        
        return state
    
    def _find_similar_repositories(self, repo_name: str, limit: int = 10) -> list:
        """Find repositories similar to a given one based on stargazer overlap."""
        
        query = """
        MATCH (r1:Repository)-[s:StargazerOverlap]->(r2:Repository)
        WHERE r1.id = $repo_name
        RETURN r2.id, r2.stars, r2.primaryLanguage, r2.topics, s.weight as overlap
        ORDER BY s.weight DESC
        LIMIT $limit
        """
        
        result = self.conn.execute(query, {"repo_name": repo_name, "limit": limit}).get_as_df()
        
        return result.to_dict('records')
    
    def _find_by_language(self, language: str, limit: int = 10) -> list:
        """Find repositories by programming language."""
        
        query = """
        MATCH (r:Repository)
        WHERE r.primaryLanguage = $language
        RETURN r.id, r.stars, r.primaryLanguage, r.topics, r.forks
        ORDER BY r.stars DESC
        LIMIT $limit
        """
        
        result = self.conn.execute(query, {"language": language, "limit": limit}).get_as_df()
        
        return result.to_dict('records')
    
    def _find_by_topics(self, topic: str, limit: int = 10) -> list:
        """Find repositories by topics."""
        
        query = """
        MATCH (r:Repository)
        WHERE r.topics CONTAINS $topic
        RETURN r.id, r.stars, r.primaryLanguage, r.topics, r.forks
        ORDER BY r.stars DESC
        LIMIT $limit
        """
        
        result = self.conn.execute(query, {"topic": topic, "limit": limit}).get_as_df()
        
        return result.to_dict('records')
    
    def _find_by_semantic_search(self, query: str, limit: int = 10) -> list:
        """Find repositories using semantic search on README content."""
        try:
            # Use the service's semantic search method
            semantic_results = self.service.semantic_search_readmes(query, limit)
            
            # Convert to the expected format
            results = []
            for result in semantic_results:
                results.append({
                    "id": result["repo_id"],
                    "stars": result["stars"],
                    "primaryLanguage": result["language"],
                    "topics": result["topics"],
                    "similarity": result["similarity"],
                    "readme_content": result["readme_content"]
                })
            
            return results
            
        except Exception as e:
            print(f"Error in semantic search: {e}")
            return []
    
    def _find_popular_repositories(self, limit: int = 10) -> list:
        
        query = """
        MATCH (r:Repository)
        RETURN r.id, r.stars, r.primaryLanguage, r.topics, r.forks, r.issues, r.pullRequests
        ORDER BY r.stars DESC
        LIMIT $limit
        """
        
        result = self.conn.execute(query, {"limit": limit}).get_as_df()
        
        return result.to_dict('records')
    
    def _get_readme_content(self, repo_id: str) -> Optional[str]:
        """Get README content for a repository from the database."""
        
        try:
            query = """
            MATCH (r:Repository)
            WHERE r.id = $repo_id
            AND r.readme_content IS NOT NULL AND r.readme_content <> ''
            RETURN r.readme_content
            """
            
            result = self.conn.execute(query, {"repo_id": repo_id}).get_as_df()
            
            if not result.empty:
                return result.iloc[0, 0]
        except Exception as e:
            print(f"Error retrieving README for {repo_id}: {e}")
        
        return None
    
    def query(self, user_query: str) -> str:
        """Main query interface for the DeepGitAI system."""
        
        # Initialize state
        state = DeepGitAIState(
            query=user_query,
            messages=[HumanMessage(content=user_query)]
        )
        
        # Run the workflow
        try:
            final_state = self.workflow.invoke(state)
            # LangGraph returns a dict, extract the final answer
            if isinstance(final_state, dict) and 'final_answer' in final_state:
                return final_state['final_answer']
            elif hasattr(final_state, 'final_answer'):
                return final_state.final_answer
            else:
                return "Error: Could not extract final answer from workflow"
        except Exception as e:
            return f"Error processing query: {e}"
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        
        stats = {}
        
        # Repository count
        repo_count = self.conn.execute("MATCH (r:Repository) RETURN COUNT(r)").get_as_df()
        stats["total_repositories"] = repo_count.iloc[0, 0]
        
        # README count
        try:
            readme_count = self.conn.execute("""
                MATCH (r:Repository) 
                WHERE r.readme_content IS NOT NULL AND r.readme_content <> ''
                RETURN COUNT(r)
            """).get_as_df()
            stats["total_readmes"] = readme_count.iloc[0, 0]
        except:
            stats["total_readmes"] = 0
        
        # Connection count
        edge_count = self.conn.execute("MATCH ()-[s:StargazerOverlap]->() RETURN COUNT(s)").get_as_df()
        stats["total_connections"] = edge_count.iloc[0, 0]
        
        # Top languages
        languages = self.conn.execute("""
            MATCH (r:Repository) 
            WHERE r.primaryLanguage <> ''
            RETURN r.primaryLanguage, COUNT(*) as count
            ORDER BY count DESC
            LIMIT 5
        """).get_as_df()
        stats["top_languages"] = languages.to_dict('records')
        
        return stats

# Global instance
deepgit_ai_service = DeepGitAIService()
