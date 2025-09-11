// Backend API configuration
// Use environment var if provided; otherwise default to same-origin
const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = (ENV_API_BASE_URL && ENV_API_BASE_URL.trim() !== "")
    ? ENV_API_BASE_URL
    : window.location.origin;


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
    // DeepGitAI endpoints
    DEEPGIT_AI_HEALTH: `${API_BASE_URL}/api/deepgit-ai-health`,
    DEEPGIT_AI_SCOPE: `${API_BASE_URL}/api/deepgit-ai-scope`,
    DEEPGIT_AI_SETUP: `${API_BASE_URL}/api/deepgit-ai-setup`,
    DEEPGIT_AI_PROGRESS: `${API_BASE_URL}/api/deepgit-ai-progress`,
    DEEPGIT_AI_RESET_PROGRESS: `${API_BASE_URL}/api/deepgit-ai-reset-progress`,
    DEEPGIT_AI_CHANGE_PROVIDER: `${API_BASE_URL}/api/deepgit-ai-change-provider`,
    DEEPGIT_AI_UPDATE_README: `${API_BASE_URL}/api/deepgit-ai-update-readme`,
    DEEPGIT_AI_FIX_SCHEMA: `${API_BASE_URL}/api/deepgit-ai-fix-schema`,
    DEEPGIT_AI_QUERY: `${API_BASE_URL}/api/deepgit-ai`,
    DEEPGIT_AI_CLEANUP: `${API_BASE_URL}/api/deepgit-ai-cleanup`,
    DEEPGIT_AI_CHECK_CHANGES: `${API_BASE_URL}/api/deepgit-ai-check-changes`,
} as const; 