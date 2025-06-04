from flask import Flask, jsonify, request, send_file, url_for
from flask_cors import CORS
from services.topic_service import TopicService
from services.ai_service import AITopicProcessor
from services.gexy_node_service import GexfNodeGenerator
import os
import asyncio
import re

app = Flask(__name__, static_folder='gexf', static_url_path='/gexf')
CORS(
    app,
    resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    },
)

topic_service = TopicService()
ai_processor = AITopicProcessor()
gexy_node_service = GexfNodeGenerator()


@app.route("/api/process-topics", methods=["GET", "POST"])
def process_topics():
    try:
        if request.method == "POST":
            data = request.get_json()
            search_term = data.get("searchTerm", "")
        else:
            search_term = request.args.get("searchTerm", "")
        result = topic_service.process_topics(search_term)
        return jsonify(result)

    except Exception as e:
        return jsonify(
            {
                "success": False,
                "error": str(e),
                "message": "An error occurred while processing the request",
            }
        ), 500


@app.route("/api/ai-process", methods=["GET", "POST"])
def ai_process():
    try:
        if request.method == "POST":
            data = request.get_json()
            # print("Received data from frontend:", data)  # Debug print

        # Extract parameters using frontend names
        model = data.get("selectedModel", "gpt-3.5-turbo")
        api_key = data.get("apiKey", "")
        prompt = data.get("customPrompt", "")
        selected_topics = data.get("selectedTopics", [])
        search_term = data.get("searchTerm", "")

        # Use the AI processor to analyze the topics
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        ai_result = loop.run_until_complete(
            ai_processor.process_topics(
                model=model,
                api_key=api_key,
                prompt=prompt,
                topics=selected_topics,
                search_term=search_term
            )
        )
        loop.close()

        # Return all AI suggestions, not just the intersection
        return jsonify({
            "success": True, 
            "result": ai_result  # Return all suggestions with their explanations
        })

    except Exception as e:
        return jsonify(
            {
                "success": False,
                "error": str(e),
                "message": "An error occurred while processing the request",
            }
        ), 500


@app.route("/api/explain-topic", methods=["POST"])
def explain_topic():
    try:
        data = request.get_json()
        # print("Received explain-topic request with data:", {k: v for k, v in data.items() if k != 'apiKey'})  # Log data without API key
        
        topic = data.get("topic", "")
        search_term = data.get("searchTerm", "")
        original_topic = data.get("originalTopic", "")
        api_key = data.get("apiKey", "")

        if not topic or not search_term or not original_topic:
            print("Missing required parameters:", {
                "topic": bool(topic),
                "search_term": bool(search_term),
                "original_topic": bool(original_topic)
            })
            return jsonify(
                {
                    "success": False,
                    "message": "Missing required parameters: topic, searchTerm, or originalTopic",
                }
            ), 400

        if not api_key:
            print("Missing API key")
            return jsonify(
                {
                    "success": False,
                    "message": "API key is required",
                }
            ), 400

        # Create a prompt for the AI to explain the topic
        prompt = f"""Explain '{topic}' in the context of '{search_term}'. 
                    If it's an abbreviation, what it stands for in '{search_term}'
                    Keep it concise but informative (1-2 sentences)."""
        # print("Generated prompt:", prompt)

        try:
            # Create an event loop and run the async function
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            # print("Initializing AI processor with Gemini model")
            # Use Gemini for explanations
            explanation = loop.run_until_complete(
                ai_processor.process_topics(
                    model="gemini-1.5-flash",
                    api_key=api_key,  # Use the API key from the request
                    prompt=prompt,
                    topics=[topic],
                    search_term=search_term  # Add the missing search_term parameter
                )
            )
            loop.close()

            # print("Received explanation:", explanation)
            if explanation and len(explanation) > 0:
                return jsonify({"success": True, "explanation": explanation[0]})
            else:
                print("No explanation generated")
                return jsonify(
                    {"success": False, "message": "Failed to generate explanation"}
                ), 500

        except Exception as ai_error:
            print("AI processing error:", str(ai_error))
            # Return a more detailed error response
            return jsonify({
                "success": False,
                "error": str(ai_error),
                "message": "Error during AI processing"
            }), 500

    except Exception as e:
        print("Top-level error in explain-topic:", str(e))
        return jsonify(
            {
                "success": False,
                "error": str(e),
                "message": "An error occurred while generating the explanation",
            }
        ), 500


@app.route("/api/suggest-topics", methods=["GET"])
def suggest_topics():
    try:
        query = request.args.get("query", "").lower().strip()
        if not query:
            return jsonify({
                "success": True,
                "suggestions": []
            })

        # Use a more sophisticated query that:
        # 1. Matches topics containing the search term
        # 2. Prioritizes exact matches and high-frequency topics
        # 3. Uses word boundary matching for better relevance
        sql_query = """
            WITH ranked_topics AS (
                SELECT 
                    topic,
                    COUNT(*) as count,
                    CASE 
                        WHEN LOWER(topic) = ? THEN 3  -- Exact match gets highest priority
                        WHEN LOWER(topic) LIKE ? THEN 2  -- Starts with query gets second priority
                        ELSE 1  -- Contains query gets lowest priority
                    END as match_priority
                FROM repo_topics
                WHERE LOWER(topic) LIKE ?
                GROUP BY topic
            )
            SELECT topic, count
            FROM ranked_topics
            ORDER BY match_priority DESC, count DESC
            LIMIT 10
        """
        
        # Prepare search patterns
        exact_match = query
        starts_with = f"{query}%"
        contains = f"%{query}%"
        
        # Execute query with all patterns
        result = topic_service.con.execute(sql_query, [
            exact_match,  # For exact match priority
            starts_with,  # For starts-with priority
            contains     # For contains match
        ]).fetchall()
        
        suggestions = [{"name": name.lower(), "count": count} for name, count in result]
        
        return jsonify({
            "success": True,
            "suggestions": suggestions
        })

    except Exception as e:
        print(f"Error in suggest-topics: {str(e)}")  # Add logging
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "An error occurred while getting suggestions"
        }), 500


@app.route("/api/generated-node-gexf", methods=["POST"])
def finalized_node_gexf():
    data = request.get_json()
    topics = data.get("topics", [])
    gexf_path = gexy_node_service.generate_gexf_nodes_for_topics(topics)
    # print(topics)
    # Read the GEXF file content
    with open(gexf_path, "r", encoding="utf-8") as f:
        gexf_content = f.read()
    
    return jsonify({
        "success": True,
        "gexfContent": gexf_content
    })


@app.route("/api/get-unique-repos", methods=["POST"])
def get_unique_repos():
    try:
        data = request.get_json()
        topics = data.get("topics", [])
        if not topics:
            return jsonify({
                "success": True,
                "count": 0
            })

        # Convert topics to lowercase for case-insensitive matching
        topics_lower = [t.lower() for t in topics]
        placeholders = ",".join(["?"] * len(topics_lower))

        # Query to get unique repositories that have ANY of the given topics
        query = f"""
            SELECT COUNT(DISTINCT r.nameWithOwner) as count
            FROM repos r
            JOIN repo_topics t ON r.nameWithOwner = t.repo
            WHERE LOWER(t.topic) IN ({placeholders})
        """
        
        result = topic_service.con.execute(query, topics_lower).fetchone()
        count = result[0] if result else 0

        return jsonify({
            "success": True,
            "count": count
        })
    except Exception as e:
        print(f"Error getting unique repos: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/")
def home():
    return "Hello World!"


if __name__ == "__main__":
    # print("Starting Flask server...")
    port = 5002
    # print(f"Server running on: http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=True)
