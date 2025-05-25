from flask import Flask, jsonify, request
from flask_cors import CORS
from services.topic_service import TopicService
from services.ai_service import AITopicProcessor
import os
import asyncio
import re

app = Flask(__name__)
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
        # print(f"AI processing complete. Result length: {len(str(ai_result))}")  # Debug log

        # Ensure both lists are lowercase or normalized if needed
        def extract_topic_name(s):
            # Try to extract the topic name before the first colon or dash, and strip formatting
            # Handles cases like '**visual-programming-editor:** ...' or 'visual-programming-editor: ...'
            match = re.match(r'[*]*([a-zA-Z0-9\-]+)[*]*[:：]', s.strip())
            if match:
                return match.group(1)
            # Fallback: if the string is just the topic name
            return s.strip().strip('*')

        intersection = []
        for ai_item in ai_result:
            topic_name = extract_topic_name(ai_item)
            if topic_name in selected_topics:
                intersection.append(ai_item)

        # print("Selected topics:", selected_topics)
        # print("Intersection:", intersection)
        return jsonify({"success": True, "result": intersection})

    except Exception as e:
        # print(f"Error occurred: {str(e)}")  # Debug log
        return jsonify(["error1", "error2", "error3"]), 500


@app.route("/api/explain-topic", methods=["POST"])
def explain_topic():
    try:
        data = request.get_json()
        print("Received explain-topic request with data:", {k: v for k, v in data.items() if k != 'apiKey'})  # Log data without API key
        
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


@app.route("/")
def home():
    return "Hello World!"


if __name__ == "__main__":
    # print("Starting Flask server...")
    port = 5002
    # print(f"Server running on: http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=True)
