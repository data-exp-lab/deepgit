// Backend API configuration
export const API_BASE_URL = 'http://127.0.0.1:5002';

// API endpoints
export const API_ENDPOINTS = {
    PROCESS_TOPICS: `${API_BASE_URL}/api/process-topics`,
    AI_PROCESS: `${API_BASE_URL}/api/ai-process`,
} as const; 