from collections import Counter
import duckdb
from app.utils.cache import get_cached_topics, save_cached_topics

class TopicService:
    def __init__(self):
        self.con = duckdb.connect(database=':memory:')
        self.con.execute("SET threads TO 16;")
        self.con.execute("""
            CREATE TEMP TABLE repo AS 
            SELECT * FROM read_json_auto('../public/data/repo_metadata.json');
        """)

    def process_topics(self, search_term: str):
        try:
            search_term = search_term.lower()
            
            # Check cache
            cached_result = get_cached_topics(search_term)
            if cached_result:
                return {
                    "success": True,
                    "data": cached_result,
                    "total": len(cached_result),
                    "cached": True
                }

            # Get data from DuckDB
            query = "SELECT nameWithOwner, topics FROM repo"
            df = self.con.execute(query).fetchdf()
            
            # Process topics
            def extract_names(item_ls):
                if item_ls is not None and len(item_ls) > 0:
                    return [item["name"] for item in item_ls if "name" in item]
                return []
            
            df["topics"] = df["topics"].apply(extract_names)
            filtered_df = df[df["topics"].apply(lambda x: search_term in [t.lower() for t in x])]
            
            # Count topics
            all_topics = [topic for topics in filtered_df["topics"] for topic in topics]
            topic_counts = Counter(all_topics)
            topic_counts.pop(search_term, None)
            
            # Format results
            topics = [{"name": name, "count": count} for name, count in topic_counts.items() if count > 2]
            topics = sorted(topics, key=lambda x: x["count"], reverse=True)
            
            # Cache results
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