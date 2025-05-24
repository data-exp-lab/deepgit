from flask import Flask, jsonify, request
from flask_cors import CORS
from services.topic_service import TopicService
from services.ai_service import AITopicProcessor
import os
import asyncio

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
        print(ai_result)
        return jsonify({"success": True, "result": ai_result})

    except Exception as e:
        # print(f"Error occurred: {str(e)}")  # Debug log
        return jsonify(["error1", "error2", "error3"]), 500


@app.route("/api/explain-topic", methods=["POST"])
def explain_topic():
    try:
        data = request.get_json()
        
        topic = data.get("topic", "")
        search_term = data.get("searchTerm", "")
        original_topic = data.get("originalTopic", "")
        api_key = data.get("apiKey", "")

        if not topic or not search_term or not original_topic:
            return jsonify(
                {
                    "success": False,
                    "message": "Missing required parameters: topic, searchTerm, or originalTopic",
                }
            ), 400

        if not api_key:
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

        try:
            # Create an event loop and run the async function
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            # Use Gemini for explanations
            explanation = loop.run_until_complete(
                ai_processor.process_topics(
                    model="gemini-1.5-flash",
                    api_key=api_key,  # Use the API key from the request
                    prompt=prompt,
                    topics=[topic],
                )
            )
            loop.close()

            if explanation and len(explanation) > 0:
                return jsonify({"success": True, "explanation": explanation[0]})
            else:
                return jsonify(
                    {"success": False, "message": "Failed to generate explanation"}
                ), 500

        except Exception as ai_error:
            raise ai_error

    except Exception as e:
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
    print("Starting Flask server...")
    port = 5002
    print(f"Server running on: http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=True)
