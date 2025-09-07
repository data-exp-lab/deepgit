import os
import tempfile
import json
import sys
import xml.etree.ElementTree as ET
import requests
import base64
import time
import re
import csv
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass
from collections import defaultdict

# Import required libraries
try:
    import kuzu
    print("✅ kuzu imported successfully")
except ImportError as e:
    print(f"❌ Failed to import kuzu: {e}")
    kuzu = None

try:
    import pandas as pd
    print("✅ pandas imported successfully")
except ImportError as e:
    print(f"❌ Failed to import pandas: {e}")
    pd = None

try:
    import networkx as nx
    print("✅ networkx imported successfully")
except ImportError as e:
    print(f"❌ Failed to import networkx: {e}")
    nx = None

# LangGraph imports
try:
    from langgraph.graph import StateGraph, END
    from langgraph.prebuilt import ToolNode
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_openai import ChatOpenAI
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.tools import tool
    from langchain_core.output_parsers import JsonOutputParser
    from pydantic import BaseModel, Field
    print("✅ LangGraph modules imported successfully")
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
    tool = None
    JsonOutputParser = None
    BaseModel = None
    Field = None

@dataclass
class GraphRAGState:
    """State for the GraphRAG workflow."""
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

class GraphRAGService:
    """Service for handling GraphRAG operations."""
    
    def __init__(self):
        self.db_path = None
        self.graphrag_instance = None
        self.cache_dir = Path(__file__).parent.parent / "cache"
        self.cache_dir.mkdir(exist_ok=True)
        
        # In-memory cache for faster access
        self._memory_cache = {}
        self._cache_stats = {"hits": 0, "misses": 0}
    
    def get_cache_key(self, owner, repo):
        """Generate a cache key for a repository."""
        return hashlib.md5(f"{owner}/{repo}".encode()).hexdigest()
    
    def get_cached_readme(self, owner, repo):
        """Get README content from cache if available."""
        cache_key = self.get_cache_key(owner, repo)
        
        # Check in-memory cache first (fastest)
        if cache_key in self._memory_cache:
            self._cache_stats["hits"] += 1
            return self._memory_cache[cache_key]
        
        # Check file cache
        cache_file = self.cache_dir / f"{cache_key}.txt"
        if cache_file.exists():
            # Check if cache is less than 24 hours old
            if time.time() - cache_file.stat().st_mtime < 86400:  # 24 hours
                try:
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Store in memory cache for faster future access
                        self._memory_cache[cache_key] = content
                        self._cache_stats["hits"] += 1
                        return content
                except:
                    pass
        
        self._cache_stats["misses"] += 1
        return None
    
    def cache_readme(self, owner, repo, content):
        """Cache README content."""
        if not content:
            return
            
        cache_key = self.get_cache_key(owner, repo)
        
        # Store in memory cache first (fastest)
        self._memory_cache[cache_key] = content
        
        # Also store in file cache for persistence
        cache_file = self.cache_dir / f"{cache_key}.txt"
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                f.write(content)
        except Exception as e:
            print(f"Failed to cache README for {owner}/{repo}: {e}")
    
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
        """Preload all cached READMEs into memory for faster access."""
        print("Preloading README cache into memory...")
        cache_files = list(self.cache_dir.glob("*.txt"))
        loaded_count = 0
        
        for cache_file in cache_files:
            try:
                # Extract owner/repo from filename (hash)
                cache_key = cache_file.stem
                
                # Check if cache is less than 24 hours old
                if time.time() - cache_file.stat().st_mtime < 86400:  # 24 hours
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                        self._memory_cache[cache_key] = content
                        loaded_count += 1
            except Exception as e:
                print(f"Failed to load cache file {cache_file}: {e}")
        
        print(f"Preloaded {loaded_count} READMEs into memory cache")
        return loaded_count
    
    def get_cache_stats(self):
        """Get cache statistics."""
        total_hits = self._cache_stats["hits"]
        total_misses = self._cache_stats["misses"]
        hit_rate = total_hits / (total_hits + total_misses) * 100 if (total_hits + total_misses) > 0 else 0
        
        return {
            "memory_cache_size": len(self._memory_cache),
            "total_hits": total_hits,
            "total_misses": total_misses,
            "hit_rate": f"{hit_rate:.1f}%"
        }
    
    def cleanup_old_cache(self, max_age_hours=24):
        """Clean up cache files older than specified hours."""
        try:
            current_time = time.time()
            max_age_seconds = max_age_hours * 3600
            
            for cache_file in self.cache_dir.glob("*.txt"):
                if current_time - cache_file.stat().st_mtime > max_age_seconds:
                    cache_file.unlink()
                    print(f"Cleaned up old cache file: {cache_file.name}")
        except Exception as e:
            print(f"Error cleaning up cache: {e}")
    
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
                    contributors, stargazers, '', 0  # readme_content, readme_length
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
            'User-Agent': 'DeepGit-GraphRAG/1.0'
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
        
        return ""
    
    def clean_text_for_csv(self, text):
        """Clean text to be safe for CSV storage."""
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
                readme_data.append((repo_id, cleaned_content, original_length))
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
            for repo_id, content, length in readme_data:
                readme_writer.writerow([repo_id, content, length])
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
                    original_length = len(cached_content)
                    readme_data.append((repo_id, cleaned_content, original_length))
                    successful += 1
                    continue
                
                readme_content = self.get_github_readme_optimized(owner, repo, token)
                
                if readme_content:
                    # Clean the content for CSV storage
                    cleaned_content = self.clean_text_for_csv(readme_content)
                    original_length = len(readme_content)
                    readme_data.append((repo_id, cleaned_content, original_length))
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
            for repo_id, content, length in readme_data:
                readme_writer.writerow([repo_id, content, length])
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
        
        # Preload cache for faster access
        preloaded_count = self.preload_cache()
        if preloaded_count > 0:
            print(f"🚀 Cache preloaded: {preloaded_count} READMEs ready for instant access")
        
        # Process repositories in batches for better progress tracking
        batch_size = 50  # Increased batch size for better performance
        total_repos = len(valid_repos)
        processed = 0
        successful = 0
        cached = 0
        failed = 0
        
        for i in range(0, total_repos, batch_size):
            batch = valid_repos[i:i+batch_size]
            print(f"\nProcessing batch {i//batch_size + 1}/{(total_repos + batch_size - 1)//batch_size}")
            
            for repo_id, owner, repo in batch:
                processed += 1
                
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
                        progress_dict["message"] = f"Extracting READMEs ({processed}/{total_repos}) - Elapsed: {elapsed_minutes}m{elapsed_seconds}s, ETA: {remaining_minutes}m{remaining_seconds}s"
                    else:
                        progress_dict["current"] = processed
                        progress_dict["message"] = f"Extracting README content from repositories ({processed}/{total_repos})"
                    
                    # Reduced delay for faster processing
                    time.sleep(0.01)
                
                # Add checkpoint every 100 repositories to prevent data loss (reduced frequency for better performance)
                if processed % 100 == 0 and readme_data:
                    try:
                        # Insert current batch to database
                        for repo_id, content, length in readme_data:
                            try:
                                conn.execute("""
                                    MERGE (r:Repository {id: $repo_id})
                                    SET r.readme_content = $content, r.readme_length = $length
                                """, parameters={"repo_id": repo_id, "content": content, "length": length})
                            except Exception as e:
                                if "Cannot find property" in str(e):
                                    # Try to add the properties first
                                    conn.execute("ALTER TABLE Repository ADD COLUMN readme_content STRING")
                                    conn.execute("ALTER TABLE Repository ADD COLUMN readme_length INT64")
                                    # Retry the insertion
                                    conn.execute("""
                                        MERGE (r:Repository {id: $repo_id})
                                        SET r.readme_content = $content, r.readme_length = $length
                                    """, parameters={"repo_id": repo_id, "content": content, "length": length})
                                else:
                                    print(f"  ⚠️  Checkpoint insertion failed for {repo_id}: {e}")
                        
                        print(f"  💾 Checkpoint saved: {len(readme_data)} READMEs processed")
                        readme_data = []  # Clear the batch
                    except Exception as e:
                        print(f"  ⚠️  Checkpoint failed: {e}")
                        # Continue processing even if checkpoint fails
                
                print(f"  [{processed}/{total_repos}] Processing {owner}/{repo}...")
                
                # Check if we have cached content
                cached_content = self.get_cached_readme(owner, repo)
                if cached_content:
                    cached += 1
                    print(f"    📋 Using cached README for {owner}/{repo}")
                    cleaned_content = self.clean_text_for_csv(cached_content)
                    original_length = len(cached_content)
                    readme_data.append((repo_id, cleaned_content, original_length))
                    successful += 1
                    continue
                
                readme_content = self.get_github_readme_optimized(owner, repo, token)
                
                if readme_content:
                    # Clean the content for CSV storage
                    cleaned_content = self.clean_text_for_csv(readme_content)
                    original_length = len(readme_content)
                    readme_data.append((repo_id, cleaned_content, original_length))
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
            
            # Update progress after each batch
            if progress_dict:
                progress_dict["current"] = processed
                progress_dict["message"] = f"Processed batch {i//batch_size + 1}/{(total_repos + batch_size - 1)//batch_size} - {processed}/{total_repos} repositories"
                time.sleep(0.01)  # Reduced delay for faster processing
        
        # Update progress for final step
        if progress_dict:
            progress_dict["current_step"] = "Saving to database..."
            progress_dict["message"] = f"Saving {len(readme_data)} README files to database"
        
        # Insert remaining README data directly into Repository table
        if readme_data:
            print(f"\nInserting final batch of {len(readme_data)} README files into database...")
            for repo_id, content, length in readme_data:
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
                                SET r.readme_content = $content, r.readme_length = $length
                            """, parameters={"repo_id": repo_id, "content": content, "length": length})
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
        
        print(f"\n📊 README Extraction Summary:")
        print(f"  Total repositories processed: {processed}")
        print(f"  Successful extractions: {successful}")
        print(f"  Cached READMEs used: {cached}")
        print(f"  Failed extractions: {failed}")
        print(f"  Total READMEs stored: {total_stored}")
        print(f"  Success rate: {successful/processed*100:.1f}%" if processed > 0 else "  Success rate: N/A")
        print(f"  Cache hit rate: {cached/(successful+cached)*100:.1f}%" if (successful+cached) > 0 else "  Cache hit rate: 0%")
        
        # Calculate and display total time taken
        total_time = time.time() - start_time
        total_minutes = int(total_time // 60)
        total_seconds = int(total_time % 60)
        print(f"  Total time taken: {total_minutes}m{total_seconds}s")
        print(f"  Average time per repository: {total_time/processed:.2f}s" if processed > 0 else "  Average time per repository: N/A")
        
        # Display cache statistics
        cache_stats = self.get_cache_stats()
        print(f"  Memory cache size: {cache_stats['memory_cache_size']} READMEs")
        print(f"  Cache performance: {cache_stats['hit_rate']} hit rate ({cache_stats['total_hits']} hits, {cache_stats['total_misses']} misses)")
    
    def setup_database_from_gexf(self, gexf_content: str, github_token: str) -> Dict[str, Any]:
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
            existing_db_path = kuzu_dir / f"graphrag_db_{gexf_hash}"
            
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
                        return {
                            "success": True,
                            "db_path": str(self.db_path),
                            "message": "Database reused successfully (no changes needed)"
                        }
                    else:
                        print("📝 Database exists but missing README data, extracting READMEs...")
                        # Extract README data
                        self.extract_readmes_from_repos_optimized(str(self.db_path), github_token)
                        
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
            
            # Create temporary GEXF file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.gexf', delete=False) as temp_gexf:
                temp_gexf.write(gexf_content)
                temp_gexf_path = temp_gexf.name
            
            try:
                # Create Kuzu database from GEXF
                print("Creating Kuzu database from GEXF...")
                self.create_kuzu_database(temp_gexf_path, str(self.db_path))
                
                # Clean up old cache files
                print("Cleaning up old cache files...")
                self.cleanup_old_cache()
                
                # Extract README data
                print("Extracting README data...")
                self.extract_readmes_from_repos_optimized(str(self.db_path), github_token)
                
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
    
    def setup_database_from_gexf_with_progress(self, gexf_content: str, github_token: str, progress_dict: dict = None) -> Dict[str, Any]:
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
            existing_db_path = kuzu_dir / f"graphrag_db_{gexf_hash}"
            
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
                    progress_dict["current_step"] = "Cleaning cache..."
                    progress_dict["current"] = 20
                    progress_dict["message"] = "Cleaning up old cache files"
                
                # Clean up old cache files
                print("Cleaning up old cache files...")
                self.cleanup_old_cache()
                
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
                    
                    def extract_with_timeout():
                        self.extract_readmes_from_repos_with_progress(str(self.db_path), github_token, progress_dict)
                    
                    # Create a thread for README extraction
                    extraction_thread = threading.Thread(target=extract_with_timeout)
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
            existing_db_path = kuzu_dir / f"graphrag_db_{gexf_hash}"
            
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
        """Change the GraphRAG provider without recreating the database."""
        try:
            if not self.db_path or not os.path.exists(self.db_path):
                return {
                    "success": False,
                    "error": "Database not set up. Please setup database first.",
                    "message": "Database not found"
                }
            
            # Initialize GraphRAG with new provider
            result = self.initialize_graphrag(provider, api_keys)
            
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
    
    def initialize_graphrag(self, provider: str, api_keys: Dict[str, str]) -> Dict[str, Any]:
        """Initialize the GraphRAG system with the specified provider."""
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
            
            # Set environment variables for API keys
            if provider == "openai":
                os.environ["OPENAI_API_KEY"] = api_keys.get("openaiKey", "")
            elif provider == "azure_openai":
                os.environ["AZURE_OPENAI_API_KEY"] = api_keys.get("azureOpenAIKey", "")
                os.environ["AZURE_OPENAI_ENDPOINT"] = api_keys.get("azureOpenAIEndpoint", "")
                os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"] = api_keys.get("azureOpenAIDeployment", "")
            elif provider == "gemini":
                os.environ["GEMINI_API_KEY"] = api_keys.get("geminiKey", "")
            
            # Initialize GraphRAG
            self.graphrag_instance = MultiLLMGraphRAG(str(self.db_path), provider)
            
            return {
                "success": True,
                "message": f"GraphRAG initialized with {provider}"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to initialize GraphRAG with {provider}"
            }
    
    def query_graphrag(self, query: str) -> Dict[str, Any]:
        """Execute a query using the GraphRAG system."""
        try:
            if not self.graphrag_instance:
                return {
                    "success": False,
                    "error": "GraphRAG not initialized",
                    "message": "Please initialize GraphRAG first"
                }
            
            # Execute the query
            result = self.graphrag_instance.query(query)
            
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
            if not self.graphrag_instance:
                return {
                    "success": False,
                    "error": "GraphRAG not initialized",
                    "message": "Please initialize GraphRAG first"
                }
            
            stats = self.graphrag_instance.get_database_stats()
            
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
    
    def cleanup(self):
        """Clean up temporary files and database."""
        try:
            if self.db_path and os.path.exists(self.db_path):
                # For now, just set the path to None without deleting
                # The database will persist in the kuzu folder for reuse
                print(f"Database kept at: {self.db_path}")
                self.db_path = None
                self.graphrag_instance = None
        except Exception as e:
            print(f"Warning: Failed to cleanup GraphRAG resources: {e}")

class MultiLLMGraphRAG:
    """Enhanced GraphRAG system with support for multiple LLM providers."""
    
    def __init__(self, db_path: str, llm_provider: str = "openai"):
        """Initialize the GraphRAG system."""
        self.db_path = db_path
        self.db = kuzu.Database(db_path)
        self.conn = kuzu.Connection(self.db)
        self.llm_provider = llm_provider
        
        # Initialize LLM based on provider
        self.llm = self._initialize_llm()
        
        # Initialize the workflow
        self.workflow = self._create_workflow()
        
        print(f"Multi-LLM GraphRAG system initialized with database: {db_path}")
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
        workflow = StateGraph(GraphRAGState)
        
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
    
    def _analyze_query_node(self, state: GraphRAGState) -> GraphRAGState:
        """Analyze the user query to determine what graph queries to run."""
        
        system_prompt = """You are a query analyzer for a GraphRAG system. Your job is to analyze user queries and determine what graph queries should be executed to find relevant information.

Available graph queries:
1. find_similar_repos - Find repositories similar to a given one
2. find_by_language - Find repositories by programming language
3. find_by_topics - Find repositories by topics/keywords
4. find_connected_repos - Find repositories connected through stargazer overlap
5. find_popular_repos - Find most popular repositories
6. find_recent_repos - Find recently created repositories
7. find_by_activity - Find repositories by activity level (issues/PRs)

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
                state.graph_results["query_type"] = "find_popular_repos"  # default
                
        except Exception as e:
            state.error = f"Error analyzing query: {e}"
            state.graph_results["query_type"] = "find_popular_repos"
        
        return state
    
    def _query_graph_node(self, state: GraphRAGState) -> GraphRAGState:
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
            else:
                results = self._find_popular_repositories()
            
            state.graph_results["results"] = results
            
        except Exception as e:
            state.error = f"Error querying graph: {e}"
            state.graph_results["results"] = []
        
        return state
    
    def _retrieve_readmes_node(self, state: GraphRAGState) -> GraphRAGState:
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
    
    def _generate_answer_node(self, state: GraphRAGState) -> GraphRAGState:
        """Generate the final answer using the graph results and README content."""
        
        system_prompt = """You are a helpful assistant that provides information about GitHub repositories based on graph analysis and README content.

You have access to:
1. Graph analysis results showing repository relationships and metadata
2. README content from the repositories

Provide a comprehensive answer that:
- Explains the repositories found
- Highlights key features from READMEs
- Mentions relationships between repositories
- Suggests which repositories might be most relevant

IMPORTANT: When mentioning repositories, use the format [repository_name](repo_id) to make them clickable. For example:
- "The [SWI-Prolog/swipl-devel](SWI-Prolog/swipl-devel) repository..."
- "Check out [souffle-lang/souffle](souffle-lang/souffle) for..."

Be informative but concise."""

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
    
    def _find_popular_repositories(self, limit: int = 10) -> list:
        """Find most popular repositories."""
        
        query = """
        MATCH (r:Repository)
        RETURN r.id, r.stars, r.primaryLanguage, r.topics, r.forks, r.issues, r.pullRequests
        ORDER BY r.stars DESC
        LIMIT $limit
        """
        
        result = self.conn.execute(query, {"limit": limit}).get_as_df()
        
        return result.to_dict('records')
    
    def _get_readme_content(self, repo_id: str) -> Optional[str]:
        """Get README content for a repository."""
        
        try:
            query = """
            MATCH (r:Repository)
            WHERE r.readme_content IS NOT NULL AND r.readme_content <> ''
            WHERE r.repo_id = $repo_id
            RETURN r.readme_content
            """
            
            result = self.conn.execute(query, {"repo_id": repo_id}).get_as_df()
            
            if not result.empty:
                return result.iloc[0, 0]
        except:
            pass
        
        return None
    
    def query(self, user_query: str) -> str:
        """Main query interface for the GraphRAG system."""
        
        # Initialize state
        state = GraphRAGState(
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
graphrag_service = GraphRAGService()
