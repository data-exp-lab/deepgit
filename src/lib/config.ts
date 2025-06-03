// Backend API configuration
export const API_BASE_URL = 'http://localhost:5002';

// API endpoints
export const API_ENDPOINTS = {
    PROCESS_TOPICS: `${API_BASE_URL}/api/process-topics`,
    AI_PROCESS: `${API_BASE_URL}/api/ai-process`,
    EXPLAIN_TOPIC: `${API_BASE_URL}/api/explain-topic`,
    SUGGEST_TOPICS: `${API_BASE_URL}/api/suggest-topics`,
    GENERATED_NODES: `${API_BASE_URL}/api/generated-node-gexf`,
    GET_UNIQUE_REPOS: `${API_BASE_URL}/api/get-unique-repos`,
} as const; 