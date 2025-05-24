// Backend API configuration
export const API_BASE_URL = 'http://localhost:5002';

// API endpoints
export const API_ENDPOINTS = {
    PROCESS_TOPICS: `${API_BASE_URL}/api/process-topics`,
    AI_PROCESS: `${API_BASE_URL}/api/ai-process`,
    EXPLAIN_TOPIC: `${API_BASE_URL}/api/explain-topic`,
} as const; 