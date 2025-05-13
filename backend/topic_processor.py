from flask import Flask, jsonify, request
from flask_cors import CORS
import psutil
import socket
import signal
import sys
import time

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

        # Updated topic data to match frontend mock data
        all_topics = [
            {"name": "visual-programming", "count": 342},
            {"name": "graph-theory", "count": 289},
            {"name": "network-analysis", "count": 256},
            {"name": "scientific-computing", "count": 198},
            {"name": "python", "count": 187},
            {"name": "javascript", "count": 165},
            {"name": "d3", "count": 142},
            {"name": "typescript", "count": 128},
            {"name": "react", "count": 112},
            {"name": "machine-learning", "count": 98},
            {"name": "data-science", "count": 87},
            {"name": "visualization", "count": 76},
            {"name": "neo4j", "count": 65},
            {"name": "graphql", "count": 54},
            {"name": "sigma-js", "count": 43},
        ]
        
        filtered_topics = [
            topic for topic in all_topics 
            if search_term in topic["name"].lower()
        ]
        
        return jsonify({
            "success": True,
            "data": filtered_topics,
            "total": len(filtered_topics)
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

def signal_handler(sig, frame):
    print('\nShutting down the server...')
    sys.exit(0)

if __name__ == '__main__':
    signal.signal(signal.SIGINT, signal_handler)
    print("Starting Flask server...")
    port = 5002
    
    print(f"Server running on: http://127.0.0.1:{port}/process-topics")
    app.run(host='127.0.0.1', port=port, debug=True)