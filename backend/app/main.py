from flask import Flask, jsonify, request, send_file, url_for
from flask_cors import CORS
from services.topic_service import TopicService
from services.ai_service import AITopicProcessor
from services.gexf_node_service import GexfNodeGenerator
from services.edge_generation_service import EdgeGenerationService
import os
import asyncio
import re
import json

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
gexf_node_service = GexfNodeGenerator()
edge_generation_service = EdgeGenerationService()


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
            WITH split_topics AS (
                SELECT 
                    unnest(string_split(topics, '|')) as topic
                FROM repo_topics
            ),
            ranked_topics AS (
                SELECT 
                    topic,
                    COUNT(*) as count,
                    CASE 
                        WHEN LOWER(topic) = ? THEN 3  -- Exact match gets highest priority
                        WHEN LOWER(topic) LIKE ? THEN 2  -- Starts with query gets second priority
                        ELSE 1  -- Contains query gets lowest priority
                    END as match_priority
                FROM split_topics
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
    gexf_path = gexf_node_service.generate_gexf_nodes_for_topics(topics)
    # print(topics)
    
    if gexf_path is None:
        return jsonify({
            "success": False,
            "error": "No repositories found for the given topics"
        }), 404
    
    # Read the GEXF file content
    with open(gexf_path, "r", encoding="utf-8") as f:
        gexf_content = f.read()
    
    return jsonify({
        "success": True,
        "gexfContent": gexf_content
    })


@app.route("/api/generate-graph-with-edges", methods=["POST"])
def generate_graph_with_edges():
    """
    Generate a graph with edges based on multiple criteria working in combination.
    
    Expected request body:
    {
        "topics": ["topic1", "topic2"],
        "criteria_config": {
            "topic_based_linking": true,
            "contributor_overlap_enabled": true,
            "contributor_overlap_threshold": 2,
            "shared_organization_enabled": false,
            "common_stargazers_enabled": true,
            "stargazer_overlap_threshold": 3,
            "strict_and_logic": true
        }
    }
    """
    try:
        data = request.get_json()
        topics = data.get("topics", [])
        criteria_config = data.get("criteria_config", {})
        
        if not topics:
            return jsonify({
                "success": False,
                "error": "No topics provided"
            }), 400
        
        # Generate graph with edges based on criteria
        G, edge_stats = edge_generation_service.generate_edges_with_criteria(topics, criteria_config)
        
        if not G.nodes():
            return jsonify({
                "success": False,
                "error": "No repositories found for the given topics"
            }), 404
        
        # Generate unique filename for this graph
        import hashlib
        from datetime import datetime
        
        # Create hash from topics and criteria
        criteria_str = json.dumps(criteria_config, sort_keys=True)
        topics_str = "|".join(sorted(topics))
        combined_str = f"{topics_str}_{criteria_str}"
        hash_object = hashlib.md5(combined_str.encode())
        hash_hex = hash_object.hexdigest()[:12]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"graph_with_edges_{hash_hex}_{timestamp}.gexf"
        
        # Save to gexf directory
        gexf_dir = os.path.join(os.path.dirname(__file__), "gexf")
        os.makedirs(gexf_dir, exist_ok=True)
        gexf_path = os.path.join(gexf_dir, filename)
        
        # Save graph with edges
        edge_generation_service.save_graph_with_edges(G, gexf_path)
        
        # Read the GEXF file content
        with open(gexf_path, "r", encoding="utf-8") as f:
            gexf_content = f.read()
        
        # Get comprehensive statistics
        graph_stats = edge_generation_service.get_detailed_edge_statistics(G)
        
        return jsonify({
            "success": True,
            "gexfContent": gexf_content,
            "filename": filename,
            "edge_statistics": edge_stats,
            "graph_statistics": graph_stats
        })
        
    except Exception as e:
        print(f"Error generating graph with edges: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "An error occurred while generating the graph with edges"
        }), 500


@app.route("/api/edge-generation-criteria", methods=["GET"])
def get_edge_generation_criteria():
    """
    Get information about available edge generation criteria and their descriptions.
    """
    criteria_info = {
        "topic_based_linking": {
            "description": "Create edges between repositories that share common topics",
            "type": "boolean",
            "default": True,
            "category": "Content-based"
        },
        "contributor_overlap_enabled": {
            "description": "Create edges between repositories that have overlapping contributors",
            "type": "boolean",
            "default": False,
            "category": "Collaboration-based"
        },
        "contributor_overlap_threshold": {
            "description": "Minimum number of shared contributors required to create an edge",
            "type": "integer",
            "default": 2,
            "min": 1,
            "max": 100,
            "category": "Collaboration-based"
        },
        "shared_organization_enabled": {
            "description": "Create edges between repositories owned by the same organization",
            "type": "boolean",
            "default": False,
            "category": "Organizational"
        },
        "common_stargazers_enabled": {
            "description": "Create edges between repositories that have overlapping stargazers",
            "type": "boolean",
            "default": False,
            "category": "Interest-based"
        },
        "stargazer_overlap_threshold": {
            "description": "Minimum number of shared stargazers required to create an edge",
            "type": "integer",
            "default": 2,
            "min": 1,
            "max": 1000,
            "category": "Interest-based"
        },
        "use_and_logic": {
            "description": "Use AND logic to require multiple criteria to be satisfied for an edge",
            "type": "boolean",
            "default": False,
            "category": "Logic Control"
        },
        "strict_and_logic": {
            "description": "Use strict AND logic to require ALL enabled criteria to be satisfied simultaneously",
            "type": "boolean",
            "default": False,
            "category": "Logic Control"
        }
    }
    
    return jsonify({
        "success": True,
        "criteria": criteria_info,
        "usage_examples": [
            {
                "name": "Topic + Contributor Overlap",
                "description": "Connect repositories by both shared topics and contributor overlap",
                "config": {
                    "topic_based_linking": True,
                    "contributor_overlap_enabled": True,
                    "contributor_overlap_threshold": 2,
                    "shared_organization_enabled": False,
                    "common_stargazers_enabled": False
                }
            },
            {
                "name": "Organization + Stargazer Overlap",
                "description": "Connect repositories by organization ownership and stargazer overlap",
                "config": {
                    "topic_based_linking": False,
                    "contributor_overlap_enabled": False,
                    "shared_organization_enabled": True,
                    "common_stargazers_enabled": True,
                    "stargazer_overlap_threshold": 3
                }
            },
            {
                "name": "All Criteria Combined",
                "description": "Use all available criteria to create comprehensive connections",
                "config": {
                    "topic_based_linking": True,
                    "contributor_overlap_enabled": True,
                    "contributor_overlap_threshold": 2,
                    "shared_organization_enabled": True,
                    "common_stargazers_enabled": True,
                    "stargazer_overlap_threshold": 2
                }
            },
            {
                "name": "Contributor + Organization (AND Logic)",
                "description": "Only create edges when BOTH contributor overlap AND shared organization criteria are satisfied",
                "config": {
                    "topic_based_linking": False,
                    "contributor_overlap_enabled": True,
                    "contributor_overlap_threshold": 2,
                    "shared_organization_enabled": True,
                    "common_stargazers_enabled": False,
                    "use_and_logic": True
                }
            }
        ]
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

        # Query to get unique repositories that have ANY of the given topics using exact matching
        conditions = []
        for topic in topics_lower:
            conditions.append(f"LOWER(t.topics) LIKE '%|{topic}|%' OR LOWER(t.topics) LIKE '{topic}|%' OR LOWER(t.topics) LIKE '%|{topic}' OR LOWER(t.topics) = '{topic}'")
        
        query = f"""
            SELECT COUNT(DISTINCT r.nameWithOwner) as count
            FROM repos r
            JOIN repo_topics t ON r.nameWithOwner = t.repo
            WHERE ({" OR ".join(conditions)})
        """
        
        result = topic_service.con.execute(query).fetchone()
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


@app.route("/api/create-edges-on-graph", methods=["POST"])
def create_edges_on_graph():
    """
    Create edges on an existing graph based on specified criteria.
    
    Expected request body:
    {
        "gexfContent": "existing GEXF content",
        "criteria_config": {
            "topic_based_linking": true,
            "topic_threshold": 2,
            "contributor_overlap_enabled": true,
            "contributor_threshold": 1,
            "shared_organization_enabled": false,
            "common_stargazers_enabled": true,
            "stargazer_threshold": 5,
            "use_and_logic": false,
            "strict_and_logic": true
        }
    }
    """
    try:
        data = request.get_json()
        gexf_content = data.get("gexfContent", "")
        criteria_config = data.get("criteria_config", {})
        
        if not gexf_content:
            return jsonify({
                "success": False,
                "error": "No GEXF content provided"
            }), 400
        
        # Parse the existing GEXF content
        import tempfile
        import networkx as nx
        
        # Create a temporary file to parse the GEXF
        with tempfile.NamedTemporaryFile(mode='w', suffix='.gexf', delete=False) as temp_file:
            temp_file.write(gexf_content)
            temp_file_path = temp_file.name
        
        try:
            # Read the existing graph
            G = nx.read_gexf(temp_file_path)
        finally:
            # Clean up temporary file
            import os
            os.unlink(temp_file_path)
        
        if not G.nodes():
            return jsonify({
                "success": False,
                "error": "No nodes found in the provided GEXF content"
            }), 404
        
        # Validate that at least one criterion is enabled
        enabled_criteria = [
            criteria_config.get('topic_based_linking', False),
            criteria_config.get('contributor_overlap_enabled', False),
            criteria_config.get('shared_organization_enabled', False),
            criteria_config.get('common_stargazers_enabled', False)
        ]
        
        if not any(enabled_criteria):
            return jsonify({
                "success": False,
                "error": "At least one edge creation criterion must be enabled"
            }), 400
        
        # Create a new service instance for edge creation on existing graphs
        from services.edge_generation_service import EdgeGenerationService
        edge_service = EdgeGenerationService()
        
        # Create edges based on the criteria
        edges_created = edge_service.create_edges_on_existing_graph(G, criteria_config)
        
        # Save the updated graph
        import hashlib
        from datetime import datetime
        
        # Create hash from criteria
        criteria_str = json.dumps(criteria_config, sort_keys=True)
        hash_object = hashlib.md5(criteria_str.encode())
        hash_hex = hash_object.hexdigest()[:12]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"updated_graph_{hash_hex}_{timestamp}.gexf"
        
        # Save to gexf directory
        gexf_dir = os.path.join(os.path.dirname(__file__), "gexf")
        os.makedirs(gexf_dir, exist_ok=True)
        gexf_path = os.path.join(gexf_dir, filename)
        
        # Save updated graph
        edge_service.save_graph_with_edges(G, gexf_path)
        
        # Read the updated GEXF file content
        with open(gexf_path, "r", encoding="utf-8") as f:
            updated_gexf_content = f.read()
        
        # Get statistics
        graph_stats = edge_service.get_detailed_edge_statistics(G)
        
        return jsonify({
            "success": True,
            "gexfContent": updated_gexf_content,
            "filename": filename,
            "edgesCreated": edges_created,
            "graph_statistics": graph_stats
        })
        
    except Exception as e:
        print(f"Error creating edges on graph: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "An error occurred while creating edges on the graph"
        }), 500


@app.route("/")
def home():
    return "Hello World!"


if __name__ == "__main__":
    # print("Starting Flask server...")
    port = 5002
    # print(f"Server running on: http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=True)
