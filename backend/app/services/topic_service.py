from collections import Counter
import duckdb
from utils.cache import get_cached_topics, save_cached_topics
import os
import psutil

class TopicService:
    # Define the allowed terms for caching
    CACHEABLE_TERMS = {
        "visual-programming",
        "machine-learning",
        "logic-programming",
        "large-language-models"
    }

    def __init__(self):
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'public', 'data', 'github_meta.duckdb')
        
        # Check if database exists
        if os.path.exists(db_path):
            # Connect in read-only mode to avoid locking issues
            self.con = duckdb.connect(database=db_path, read_only=True)
            
            # Set conservative memory limits based on available system memory
            available_memory = psutil.virtual_memory().available
            memory_limit = min(available_memory * 0.3, 0.5 * 1024 * 1024 * 1024)  # Use 30% of available memory, max 0.5GB
            self.con.execute(f"SET memory_limit TO '{int(memory_limit)}B'")
            
            # Set conservative thread count
            cpu_count = psutil.cpu_count(logical=False) or 1
            thread_count = max(1, min(cpu_count, 2))  # Use at most 2 threads
            self.con.execute(f"SET threads TO {thread_count}")
            
            # Enable streaming for large queries
            # self.con.execute("SET enable_streaming TO true")
        else:
            raise FileNotFoundError(
                f"Database not found at {db_path}. Please ensure the database file exists before running the application."
            )

    def process_topics(self, search_term: str):
        try:
            search_term = search_term.lower()
            
            # Only check cache for allowed terms
            if search_term in self.CACHEABLE_TERMS:
                cached_result = get_cached_topics(search_term)
                if cached_result:
                    return {
                        "success": True,
                        "data": cached_result,
                        "total": len(cached_result),
                        "cached": True
                    }

            # Use a more efficient query that filters early
            query = """
                WITH filtered_repos AS (
                    SELECT DISTINCT r.nameWithOwner
                    FROM repos r
                    JOIN repo_topics t ON r.nameWithOwner = t.repo
                    WHERE LOWER(t.topics) LIKE '%' || ? || '%'
                ),
                split_topics AS (
                    SELECT 
                        fr.nameWithOwner,
                        unnest(string_split(t.topics, '|')) as topic
                    FROM filtered_repos fr
                    JOIN repo_topics t ON fr.nameWithOwner = t.repo
                )
                SELECT 
                    topic,
                    COUNT(*) as count
                FROM split_topics
                WHERE LOWER(topic) != ?
                GROUP BY topic
                HAVING COUNT(*) > 2
                ORDER BY count DESC
            """
            
            # Execute query with streaming
            result = self.con.execute(query, [search_term, search_term]).fetchall()
            
            # Convert results to the expected format
            topics = [{"name": name.lower(), "count": count} for name, count in result]

            # Only cache results for allowed terms
            if search_term in self.CACHEABLE_TERMS:
                save_cached_topics(search_term, topics)

            return {
                "success": True,
                "data": topics,
                "total": len(topics),
                "cached": False
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "An error occurred while processing the request"
            }
        finally:
            # Force garbage collection after each request
            import gc
            gc.collect() 
