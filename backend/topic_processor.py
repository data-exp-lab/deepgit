from flask import Flask, jsonify, request
from flask_cors import CORS
import duckdb
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import os
from pathlib import Path

app = Flask(__name__)
# Configure CORS to allow all origins and methods
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Add this function to handle cache operations
def get_cached_topics(search_term):
    cache_file = Path('../public/data/cached_topics') / f"{search_term}.json"
    if cache_file.exists():
        with open(cache_file, 'r') as f:
            return json.load(f)
    return None

def save_cached_topics(search_term, topics_data):
    cache_dir = Path('../public/data/cached_topics')
    cache_dir.mkdir(exist_ok=True)
    cache_file = cache_dir / f"{search_term}.json"
    with open(cache_file, 'w') as f:
        json.dump(topics_data, f)

@app.route('/process-topics', methods=['GET', 'POST'])
def process_topics():
    try:
        if request.method == 'POST':
            data = request.get_json()
            search_term = data.get('searchTerm', '').lower()
        else:  # GET request
            search_term = request.args.get('searchTerm', '').lower()

        # Check if we have cached results
        cached_result = get_cached_topics(search_term)
        if cached_result:
            return jsonify({
                "success": True,
                "data": cached_result,
                "total": len(cached_result),
                "cached": True
            })

        # If not cached, proceed with the original processing
        # Step 1: Load JSON into a DuckDB temp table with parallel processing enabled
        con = duckdb.connect(database=':memory:')
        con.execute("SET threads TO 16;")  # Adjust number based on your CPU cores
        con.execute("""
            CREATE TEMP TABLE repo AS 
            SELECT * FROM read_json_auto('../public/data/repo_metadata.json');
        """)
        
        # Step 2: Get nameWithOwner and topics into a pandas DataFrame
        query = "SELECT nameWithOwner, topics FROM repo"
        df = con.execute(query).fetchdf()
        
        # Step 3: Normalize topics into list of names
        def extract_names(item_ls):
            if item_ls is not None and len(item_ls) > 0:
                return [item["name"] for item in item_ls if "name" in item]
            return []
        
        df["topics"] = df["topics"].apply(extract_names)
        
        # Step 4: Filter repos based on search term in topics
        filtered_df = df[df["topics"].apply(lambda x: search_term in [t.lower() for t in x])]
        
        # Step 5: Count all co-occurring topics
        all_topics = [topic for topics in filtered_df["topics"] for topic in topics]
        topic_counts = Counter(all_topics)
        
        # Remove the searched topic itself
        topic_counts.pop(search_term, None)
        
        # Step 6: Convert to list of dicts and sort, only including topics with count > 1
        topics = [{"name": name, "count": count} for name, count in topic_counts.items() if count > 2]
        topics = sorted(topics, key=lambda x: x["count"], reverse=True)
        
        # Before returning, cache the results
        save_cached_topics(search_term, topics)
        
        return jsonify({
            "success": True,
            "data": topics,
            "total": len(topics),
            "cached": False
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "An error occurred while processing the request"
        }), 500

@app.route('/')
def home():
    return "Hello World!"

if __name__ == '__main__':
    print("Starting Flask server...")
    port = 5002
    
    print(f"Server running on: http://127.0.0.1:{port}/process-topics")
    app.run(host='127.0.0.1', port=port, debug=True)