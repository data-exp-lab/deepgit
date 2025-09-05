// Backend API configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;


// API endpoints
export const API_ENDPOINTS = {
    PROCESS_TOPICS: `${API_BASE_URL}/api/process-topics`,
    AI_PROCESS: `${API_BASE_URL}/api/ai-process`,
    EXPLAIN_TOPIC: `${API_BASE_URL}/api/explain-topic`,
    SUGGEST_TOPICS: `${API_BASE_URL}/api/suggest-topics`,
    GENERATED_NODES: `${API_BASE_URL}/api/generated-node-gexf`,
    GENERATE_GRAPH_WITH_EDGES: `${API_BASE_URL}/api/generate-graph-with-edges`,
    GET_UNIQUE_REPOS: `${API_BASE_URL}/api/get-unique-repos`,
    CREATE_EDGES_ON_GRAPH: `${API_BASE_URL}/api/create-edges-on-graph`,
} as const; 