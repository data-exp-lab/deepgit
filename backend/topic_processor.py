from flask import Flask, jsonify, request
from flask_cors import CORS
import duckdb
import json
from collections import Counter

app = Flask(__name__)
# Configure CORS to allow all origins and methods
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

@app.route('/process-topics', methods=['GET', 'POST'])
def process_topics():
    try:
        if request.method == 'POST':
            data = request.get_json()
            search_term = data.get('searchTerm', '').lower()
        else:  # GET request
            search_term = request.args.get('searchTerm', '').lower()

        # Step 1: Load JSON into a DuckDB temp table
        con = duckdb.connect(database=':memory:')
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
        
        # Optional: Remove the searched topic itself
        topic_counts.pop(search_term, None)
        
        # Step 6: Convert to list of dicts and sort
        topics = [{"name": name, "count": count} for name, count in topic_counts.items()]
        topics = sorted(topics, key=lambda x: x["count"], reverse=True)
        
        return jsonify({
            "success": True,
            "data": topics,
            "total": len(topics)
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