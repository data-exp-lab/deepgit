from collections import Counter
import duckdb
from app.utils.cache import get_cached_topics, save_cached_topics
import os

class TopicService:
    # Define the allowed terms for caching
    CACHEABLE_TERMS = {
        "visual-programming",
        "machine-learning",
        "logic-programming",
        "large-language-models"
    }

    def __init__(self):
        db_path = '../public/data/github_meta.duckdb'
        
        # Check if database exists
        if os.path.exists(db_path):
            # Connect in read-only mode to avoid locking issues
            self.con = duckdb.connect(database=db_path, read_only=True)
            self.con.execute("SET threads TO 8;")
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

            # Get data from normalized tables in DuckDB
            query = """
                SELECT r.nameWithOwner, t.topic
                FROM repos r
                JOIN repo_topics t ON r.nameWithOwner = t.repo
            """
            df = self.con.execute(query).fetchdf()

            # Group topics by repo into a list
            grouped = df.groupby("nameWithOwner")["topic"].apply(list).reset_index()
            grouped.columns = ["nameWithOwner", "topics"]

            # Filter repos based on search term in topics
            filtered_df = grouped[grouped["topics"].apply(lambda x: search_term in [t.lower() for t in x])]

            # Count all co-occurring topics
            all_topics = [topic for topics in filtered_df["topics"] for topic in topics]
            topic_counts = Counter([t.lower() for t in all_topics])

            # Remove the searched topic itself
            topic_counts.pop(search_term, None)

            # Format results and sort, only including topics with count > 2
            topics = [{"name": name, "count": count} for name, count in topic_counts.items() if count > 2]
            topics = sorted(topics, key=lambda x: x["count"], reverse=True)

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