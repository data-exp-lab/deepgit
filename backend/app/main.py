from flask import Flask, jsonify, request
from flask_cors import CORS
from app.services.topic_service import TopicService
from app.services.ai_service import AITopicProcessor

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

topic_service = TopicService()
ai_processor = AITopicProcessor()

@app.route('/process-topics', methods=['GET', 'POST'])
def process_topics():
    try:
        if request.method == 'POST':
            data = request.get_json()
            search_term = data.get('searchTerm', '')
        else:
            search_term = request.args.get('searchTerm', '')
        result = topic_service.process_topics(search_term)
        return jsonify(result)
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "An error occurred while processing the request"
        }), 500

@app.route('/ai-process', methods=['GET', 'POST'])
def ai_process():
    try:
        if request.method == 'POST':
            data = request.get_json()
            print(data)
        
        # Extract parameters using frontend names
        model = data.get('selectedModel', 'gpt-3.5-turbo')
        api_token = data.get('apiKey', '')
        prompt = data.get('customPrompt', '')
        selected_topics = data.get('selectedTopics', [])

        print(f"Selected topics: {selected_topics}")
        print(f"Using model: {model}")  # Debug log
        print(f"Prompt length: {len(prompt)}")  # Debug log
        
        # Use the AI processor to analyze the topics
        print("About to call AI processor...")  # Debug log
        ai_result = ai_processor.process_topics(
            model=model,
            api_token=api_token,
            prompt=prompt,
            selected_topics=selected_topics
        )
        print(f"AI processing complete. Result length: {len(str(ai_result))}")  # Debug log
        
        return jsonify({
            "success": True,
            "result": ai_result
        })
    
    except Exception as e:
        print(f"Error occurred: {str(e)}")  # Debug log
        return jsonify(["error1","error2","error3"]), 500

@app.route('/')
def home():
    return "Hello World!"

if __name__ == '__main__':
    print("Starting Flask server...")
    port = 5002
    print(f"Server running on: http://127.0.0.1:{port}")
    app.run(host='127.0.0.1', port=port, debug=True) 