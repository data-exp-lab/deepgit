import React, { FC, useContext, useState, useRef, useEffect, useMemo } from "react";
import { AiOutlineRobot, AiOutlineSend, AiOutlineQuestionCircle, AiOutlineInfoCircle } from "react-icons/ai";
import { BsGithub } from "react-icons/bs";
import { FaMicrosoft } from "react-icons/fa6";
import { SiGoogle } from "react-icons/si";
import { VscSettings } from "react-icons/vsc";
import { Tooltip } from 'bootstrap';

import { GraphContext } from "../lib/context";
import { useNotifications } from "../lib/notifications";
import { API_ENDPOINTS } from "../lib/config";
import { ANIMATION_DURATION } from "../lib/consts";
import { Coordinates } from "sigma/types";

interface APIKeys {
    githubToken: string;
    openaiKey: string;
    azureOpenAIKey: string;
    azureOpenAIEndpoint: string;
    azureOpenAIDeployment: string;
    geminiKey: string;
}

interface Message {
    id: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    actions?: Array<{
        label: string;
        action: string;
        data?: any;
    }>;
}

interface DeepGitAIState {
    graphHash: string;
    isReady: boolean;
    messages: Message[];
    selectedProvider: string;
    lastSetupTime?: Date;
}

// Separate interface for session-only API keys
interface SessionAPIKeys {
    githubToken: string;
    openaiKey: string;
    azureOpenAIKey: string;
    azureOpenAIEndpoint: string;
    azureOpenAIDeployment: string;
    geminiKey: string;
}

const DeepGitAIPanel: FC = () => {
    const { notify } = useNotifications();
    const { graphFile, data, setNavState, navState, sigma, computedData } = useContext(GraphContext);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const tooltipRefs = useRef<{ [key: string]: Tooltip }>({});

    // Generate unique message IDs
    const generateMessageId = () => {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Session-only API keys (not persisted to disk)
    const getSessionAPIKeys = (): SessionAPIKeys => {
        try {
            const saved = sessionStorage.getItem('deepgit-ai_session_keys');
            return saved ? JSON.parse(saved) : {
                githubToken: "",
                openaiKey: "",
                azureOpenAIKey: "",
                azureOpenAIEndpoint: "",
                azureOpenAIDeployment: "",
                geminiKey: "",
            };
        } catch {
            return {
                githubToken: "",
                openaiKey: "",
                azureOpenAIKey: "",
                azureOpenAIEndpoint: "",
                azureOpenAIDeployment: "",
                geminiKey: "",
            };
        }
    };

    const setSessionAPIKeys = (keys: Partial<SessionAPIKeys>) => {
        try {
            const current = getSessionAPIKeys();
            const updated = { ...current, ...keys };
            sessionStorage.setItem('deepgit-ai_session_keys', JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to save session API keys:', error);
        }
    };

    const clearSessionAPIKeys = () => {
        try {
            sessionStorage.removeItem('deepgit-ai_session_keys');
        } catch (error) {
            console.error('Failed to clear session API keys:', error);
        }
    };

    // Clean up DeepGitAI database on server
    const cleanupDeepGitAIDatabase = async () => {
        try {
            const sessionId = sessionStorage.getItem('deepgit-ai_session_id') || '';
            if (sessionId) {
                const response = await fetch(API_ENDPOINTS.DEEPGIT_AI_CLEANUP, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sessionId }),
                });

                if (response.ok) {
                    console.log('DeepGitAI database cleanup completed');
                } else {
                    console.warn('DeepGitAI database cleanup failed:', response.statusText);
                }
            }
        } catch (error) {
            console.error('Failed to cleanup DeepGitAI database:', error);
        }
    };

    // Clear all DeepGitAI data (API keys and state)
    const clearAllDeepGitAIData = () => {
        try {
            // Clear session storage (API keys)
            sessionStorage.removeItem('deepgit-ai_session_keys');
            // Clear localStorage (DeepGitAI state)
            localStorage.removeItem('deepgit-ai_state');
        } catch (error) {
            console.error('Failed to clear DeepGitAI data:', error);
        }
    };

    // Clear sensitive data when component unmounts or page unloads
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Only clear when the entire browser tab is being closed
            clearAllDeepGitAIData();
            // Clean up database on server (synchronous for beforeunload)
            cleanupDeepGitAIDatabase();
        };

        const handlePageHide = () => {
            // Clear everything when page is hidden (browser tab closed)
            clearAllDeepGitAIData();
            // Clean up database on server (asynchronous for pagehide)
            cleanupDeepGitAIDatabase();
        };

        // Don't clear on visibility change (switching between tabs in same page)
        // const handleVisibilityChange = () => {
        //     if (document.visibilityState === 'hidden') {
        //         clearAllDeepGitAIData();
        //     }
        // };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);
        // document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);
            // document.removeEventListener('visibilitychange', handleVisibilityChange);
            // Don't clear on component unmount (just switching tabs)
            // clearAllDeepGitAIData();
        };
    }, []);



    // Load persisted state from localStorage
    const loadPersistedState = (): DeepGitAIState | null => {
        try {
            const saved = localStorage.getItem('deepgit-ai_state');
            if (!saved) return null;

            const parsed = JSON.parse(saved);

            // Convert string timestamps back to Date objects
            if (parsed.messages && Array.isArray(parsed.messages)) {
                parsed.messages = parsed.messages.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
            }

            // Convert lastSetupTime if it exists
            if (parsed.lastSetupTime) {
                parsed.lastSetupTime = new Date(parsed.lastSetupTime);
            }

            return parsed;
        } catch {
            return null;
        }
    };

    // Save state to localStorage (excluding sensitive data)
    const saveState = (state: Partial<DeepGitAIState>) => {
        try {
            const current = loadPersistedState() || {
                graphHash: '',
                isReady: false,
                messages: [{
                    id: generateMessageId(),
                    type: 'assistant',
                    content: 'Hello! I\'m your DeepGitAI assistant. I can help you analyze your GitHub repository graph with AI-powered insights. Let\'s get started by setting up the system.',
                    timestamp: new Date()
                }],
                selectedProvider: "openai"
            };

            const updated = { ...current, ...state };
            localStorage.setItem('deepgit-ai_state', JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to save DeepGitAI state:', error);
        }
    };

    // Initialize state from localStorage or defaults
    const [deepgitAiState, setDeepgitAiState] = useState<DeepGitAIState>(() => {
        const saved = loadPersistedState();
        if (saved && saved.graphHash === '') {
            return saved;
        }
        return {
            graphHash: '',
            isReady: false,
            messages: [{
                id: generateMessageId(),
                type: 'assistant',
                content: 'Hello! I\'m your DeepGitAI assistant. I can help you analyze your GitHub repository graph with AI-powered insights. Let\'s get started by setting up the system.',
                timestamp: new Date()
            }],
            selectedProvider: "openai"
        };
    });

    // State for graph change confirmation
    const [showGraphChangeDialog, setShowGraphChangeDialog] = useState(false);
    const [pendingGraphHash, setPendingGraphHash] = useState('');
    const [showRebuildPrompt, setShowRebuildPrompt] = useState(false);
    const hasShownRebuildPrompt = useRef(false);

    // Detect graph changes
    useEffect(() => {
        if ('' && '' !== deepgitAiState.graphHash) {
            setPendingGraphHash('');
            setShowGraphChangeDialog(true);
        }
    }, [deepgitAiState.graphHash]);

    // Check backend health and reset state if needed
    useEffect(() => {
        const checkBackendHealth = async () => {
            if (deepgitAiState.isReady) {
                try {
                    const response = await fetch(API_ENDPOINTS.DEEPGIT_AI_HEALTH, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });

                    if (!response.ok) {
                        // Backend is not ready, reset the state but preserve existing messages
                        updateState(prevState => ({
                            isReady: false,
                            messages: [...prevState.messages, {
                                id: generateMessageId(),
                                type: 'system' as const,
                                content: '⚠️ DeepGitAI backend was restarted. Please set up the system again.',
                                timestamp: new Date()
                            }]
                        }));
                        notify({
                            type: "warning",
                            message: "DeepGitAI backend was restarted. Please set up the system again.",
                        });
                    }
                } catch (error) {
                    // Backend is not reachable, reset the state but preserve existing messages
                    updateState(prevState => ({
                        isReady: false,
                        messages: [...prevState.messages, {
                            id: generateMessageId(),
                            type: 'system' as const,
                            content: '❌ Cannot connect to DeepGitAI backend. Please ensure the server is running.',
                            timestamp: new Date()
                        }]
                    }));
                    notify({
                        type: "error",
                        message: "Cannot connect to DeepGitAI backend. Please ensure the server is running.",
                    });
                }
            }
        };

        checkBackendHealth();
    }, [deepgitAiState.isReady]);

    // Handle graph change confirmation
    const handleGraphChangeConfirm = (useNewGraph: boolean) => {
        if (useNewGraph) {
            // Reset state for new graph
            const newState: DeepGitAIState = {
                graphHash: '',
                isReady: false,
                messages: [{
                    id: generateMessageId(),
                    type: 'assistant',
                    content: 'Hello! I\'m your DeepGitAI assistant. I can help you analyze your GitHub repository graph with AI-powered insights. Let\'s get started by setting up the system.',
                    timestamp: new Date()
                }],
                selectedProvider: deepgitAiState.selectedProvider
            };
            setDeepgitAiState(newState);
            saveState(newState);
        }
        setShowGraphChangeDialog(false);
        setPendingGraphHash('');
    };

    // Update state and persist changes
    const updateState = (updates: Partial<DeepGitAIState> | ((prevState: DeepGitAIState) => Partial<DeepGitAIState>)) => {
        const newState = typeof updates === 'function'
            ? { ...deepgitAiState, ...updates(deepgitAiState) }
            : { ...deepgitAiState, ...updates };
        setDeepgitAiState(newState);
        saveState(newState);
    };

    // Local state variables
    const [query, setQuery] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSetupLoading, setIsSetupLoading] = useState<boolean>(false);
    const [showSetup, setShowSetup] = useState<boolean>(true);
    const [setupProgress, setSetupProgress] = useState<string>("");
    const [progressData, setProgressData] = useState<{
        current_step: string;
        current: number;
        total: number;
        message: string;
        status: string;
    } | null>(null);

    // Session API keys state for UI
    const [sessionAPIKeys, setSessionAPIKeysState] = useState<SessionAPIKeys>(getSessionAPIKeys());

    // Update session API keys when they change
    const updateSessionAPIKeys = (keys: Partial<SessionAPIKeys>) => {
        setSessionAPIKeys(keys);
        setSessionAPIKeysState(getSessionAPIKeys());
    };

    // Load configuration from backend on component mount
    useEffect(() => {
        const loadConfiguration = async () => {
            try {
                const response = await fetch('/api/config/keys');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.keys) {
                        const keys = data.keys;

                        // Load API keys from config if not already set in session
                        const currentKeys = getSessionAPIKeys();
                        const newKeys: Partial<SessionAPIKeys> = {};

                        // GitHub token
                        if (!currentKeys.githubToken && keys.github?.token) {
                            newKeys.githubToken = keys.github.token;
                        }

                        // OpenAI API key
                        if (!currentKeys.openaiKey && keys.ai_providers?.openai?.api_key) {
                            newKeys.openaiKey = keys.ai_providers.openai.api_key;
                        }

                        // Azure OpenAI
                        if (!currentKeys.azureOpenAIKey && keys.ai_providers?.azure_openai?.api_key) {
                            newKeys.azureOpenAIKey = keys.ai_providers.azure_openai.api_key;
                        }
                        if (!currentKeys.azureOpenAIEndpoint && keys.ai_providers?.azure_openai?.endpoint) {
                            newKeys.azureOpenAIEndpoint = keys.ai_providers.azure_openai.endpoint;
                        }
                        if (!currentKeys.azureOpenAIDeployment && keys.ai_providers?.azure_openai?.deployment_name) {
                            newKeys.azureOpenAIDeployment = keys.ai_providers.azure_openai.deployment_name;
                        }

                        // Google GenAI
                        if (!currentKeys.geminiKey && keys.ai_providers?.google_genai?.api_key) {
                            newKeys.geminiKey = keys.ai_providers.google_genai.api_key;
                        }

                        // Update session keys if any were loaded from config
                        if (Object.keys(newKeys).length > 0) {
                            updateSessionAPIKeys(newKeys);
                        }
                    }
                }
            } catch (error) {
                console.log('Could not load configuration:', error);
                // This is not an error - config loading is optional
            }
        };

        loadConfiguration();
    }, []);

    // Calculate graph statistics using the same logic as download control
    const graphStats = useMemo(() => {
        if (!data || !data.graph) {
            return {
                nodes: 0,
                edges: 0,
                hasData: false
            };
        }

        const graph = data.graph;

        // Use the same logic as download control to determine visible nodes
        const visibleNodes = new Set<string>();

        if (computedData.filteredNodes) {
            // Use filtered nodes as the base - these are the active/visible nodes
            computedData.filteredNodes.forEach(node => {
                if (graph.hasNode(node)) {
                    visibleNodes.add(node);
                }
            });
        } else {
            // If no filters are applied, include all nodes
            graph.forEachNode((node) => {
                visibleNodes.add(node);
            });
        }

        // Count edges where BOTH source AND target nodes are visible (same as download control)
        let visibleEdges = 0;
        graph.forEachEdge((edge, attributes, source, target) => {
            if (visibleNodes.has(source) && visibleNodes.has(target)) {
                visibleEdges++;
            }
        });

        return {
            nodes: visibleNodes.size,
            edges: visibleEdges,
            hasData: true
        };
    }, [data, computedData.filteredNodes]);

    // Debug: Log graph statistics changes
    useEffect(() => {
        console.log('Graph statistics updated:', graphStats);
    }, [graphStats]);

    // Update showSetup based on isReady state
    useEffect(() => {
        setShowSetup(!deepgitAiState.isReady);
    }, [deepgitAiState.isReady]);

    // Auto-scroll to bottom when new messages are added
    useEffect(() => {
        // Only auto-scroll if we're near the bottom
        if (messagesEndRef.current) {
            const container = messagesEndRef.current.parentElement;
            if (container) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
                if (isNearBottom) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
    }, [deepgitAiState.messages]);

    // Debug: Log messages when they change
    useEffect(() => {
        // console.log('Messages updated:', deepgitAiState.messages.length, deepgitAiState.messages);
        // console.log('Message types:', deepgitAiState.messages.map(m => ({ id: m.id, type: m.type, content: m.content.substring(0, 50) + '...' })));
    }, [deepgitAiState.messages]);

    // Initialize tooltips
    useEffect(() => {
        // Cleanup existing tooltips
        Object.values(tooltipRefs.current).forEach(tooltip => {
            tooltip.dispose();
        });
        tooltipRefs.current = {};

        // Initialize new tooltips
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltipTriggerList.forEach(tooltipTriggerEl => {
            const id = tooltipTriggerEl.id;
            if (id) {
                try {
                    const tooltip = new Tooltip(tooltipTriggerEl, {
                        trigger: 'hover',
                        html: true
                    });
                    tooltipRefs.current[id] = tooltip;
                } catch (error) {
                    console.error('Error initializing tooltip:', error);
                }
            }
        });

        // Cleanup tooltips when component unmounts
        return () => {
            Object.values(tooltipRefs.current).forEach(tooltip => {
                tooltip.dispose();
            });
            tooltipRefs.current = {};
        };
    }, []);

    const handleAPIKeyChange = (key: keyof SessionAPIKeys, value: string) => {
        updateSessionAPIKeys({ [key]: value });
    };

    const validateAPIKeys = (): boolean => {
        const apiKeys = getSessionAPIKeys();
        if (deepgitAiState.selectedProvider === "openai" && !apiKeys.openaiKey) {
            notify({
                type: "error",
                message: "Please enter your OpenAI API key",
            });
            return false;
        }
        if (deepgitAiState.selectedProvider === "azure_openai" && (!apiKeys.azureOpenAIKey || !apiKeys.azureOpenAIEndpoint || !apiKeys.azureOpenAIDeployment)) {
            notify({
                type: "error",
                message: "Please enter all Azure OpenAI credentials",
            });
            return false;
        }
        if (deepgitAiState.selectedProvider === "gemini" && !apiKeys.geminiKey) {
            notify({
                type: "error",
                message: "Please enter your Gemini API key",
            });
            return false;
        }
        return true;
    };

    const handleSetup = async () => {
        if (!validateAPIKeys()) {
            return;
        }

        if (!graphFile?.textContent) {
            notify({
                type: "error",
                message: "No graph data available. Please load a graph first.",
            });
            return;
        }

        setIsSetupLoading(true);
        setProgressData(null);

        // Add user message showing they clicked setup
        const newMessages = [...deepgitAiState.messages, {
            id: generateMessageId(),
            type: 'user' as const,
            content: 'Please set up the DeepGitAI system for me.',
            timestamp: new Date()
        }];
        updateState({ messages: newMessages });

        const setupMessages = [...newMessages, {
            id: generateMessageId(),
            type: 'system' as const,
            content: `🔄 Starting DeepGitAI setup for ${graphStats.nodes.toLocaleString()} repositories...`,
            timestamp: new Date()
        }];
        updateState({ messages: setupMessages });

        // console.log('About to create EventSource...');

        // Reset progress status before creating EventSource
        // try {
        //     await fetch('http://localhost:5002/api/deepgit-ai-reset-progress', {
        //         method: 'POST',
        //         headers: { 'Content-Type': 'application/json' }
        //     });
        //     console.log('Progress status reset');
        // } catch (error) {
        //     console.log('Could not reset progress status:', error);
        // }

        // Start listening for progress updates
        // console.log('Creating EventSource connection to:', 'http://localhost:5002/api/deepgit-ai-progress');
        // const eventSource = new EventSource('http://localhost:5002/api/deepgit-ai-progress');
        // console.log('EventSource created, readyState:', eventSource.readyState);


        try {
            // Generate session ID for this DeepGitAI session
            const sessionId = `deepgit-ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('deepgit-ai_session_id', sessionId);

            const response = await fetch(API_ENDPOINTS.DEEPGIT_AI_SETUP, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: deepgitAiState.selectedProvider,
                    apiKeys: getSessionAPIKeys(),
                    graphFile: graphFile.textContent,
                    sessionId: sessionId
                })
            });

            const result = await response.json();

            if (result.success) {
                const finalMessages = [...deepgitAiState.messages, {
                    id: generateMessageId(),
                    type: 'assistant' as const,
                    content: '🎉 DeepGitAI setup completed successfully! You can now ask questions about your repository graph.',
                    timestamp: new Date()
                }];
                updateState({
                    isReady: true,
                    messages: finalMessages,
                    lastSetupTime: new Date()
                });

                // Update the stored graph hash after successful setup
                sessionStorage.setItem('deepgit-ai_last_graph_hash', '');

                // Also update simple statistics
                sessionStorage.setItem('deepgit-ai_last_stats', JSON.stringify({
                    nodes: data?.graph.nodes().length || 0,
                    edges: data?.graph.edges().length || 0
                }));
            } else {
                notify({
                    type: "error",
                    message: result.error || "Setup failed",
                });
                const errorMessages = [...deepgitAiState.messages, {
                    id: generateMessageId(),
                    type: 'system' as const,
                    content: `❌ Setup failed: ${result.error || 'Unknown error'}`,
                    timestamp: new Date()
                }];
                updateState({ messages: errorMessages });
            }
        } catch (error) {
            console.error('Setup error:', error);
            notify({
                type: "error",
                message: "Failed to setup DeepGitAI system",
            });
            const errorMessages = [...deepgitAiState.messages, {
                id: generateMessageId(),
                type: 'system' as const,
                content: `❌ Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: new Date()
            }];
            updateState({ messages: errorMessages });
        } finally {
            setIsSetupLoading(false);
        }
    };

    const handleQuery = async () => {
        if (!query.trim()) {
            return;
        }

        if (!deepgitAiState.isReady) {
            notify({
                type: "error",
                message: "Please complete setup first",
            });
            return;
        }

        const userMessage = query.trim();
        setQuery("");
        setIsLoading(true);

        // Add user message
        const newMessages = [...deepgitAiState.messages, {
            id: generateMessageId(),
            type: 'user' as const,
            content: userMessage,
            timestamp: new Date()
        }];
        updateState({ messages: newMessages });

        try {
            const response = await fetch(API_ENDPOINTS.DEEPGIT_AI_QUERY, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: userMessage,
                    provider: deepgitAiState.selectedProvider,
                    apiKeys: getSessionAPIKeys(),
                }),
            });

            const data = await response.json();

            if (data.success) {
                const updatedMessages = [...newMessages, {
                    id: generateMessageId(),
                    type: 'assistant' as const,
                    content: data.result,
                    timestamp: new Date()
                }];
                updateState({ messages: updatedMessages });
            } else {
                const errorMessages = [...newMessages, {
                    id: generateMessageId(),
                    type: 'assistant' as const,
                    content: `❌ Error: ${data.error || data.message}`,
                    timestamp: new Date()
                }];
                updateState({ messages: errorMessages });
                notify({
                    type: "error",
                    message: data.error || data.message,
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            const errorMessages = [...newMessages, {
                id: generateMessageId(),
                type: 'assistant' as const,
                content: `❌ Error: ${errorMessage}`,
                timestamp: new Date()
            }];
            updateState({ messages: errorMessages });
            notify({
                type: "error",
                message: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };


    // Check for graph changes only when user navigates to DeepGitAI tab
    useEffect(() => {
        if (!data || !graphFile?.textContent) return;

        // Use graphStats which accounts for filtered nodes
        const currentNodeCount = graphStats.nodes;
        const currentEdgeCount = graphStats.edges;

        // Get stored statistics
        const storedStats = sessionStorage.getItem('deepgit-ai_last_stats');

        // Only check for changes if we have previous stats (not first visit)
        if (storedStats) {
            try {
                const { nodes: lastNodeCount, edges: lastEdgeCount } = JSON.parse(storedStats);

                // Check if statistics have changed
                if (lastNodeCount !== currentNodeCount || lastEdgeCount !== currentEdgeCount) {
                    console.log('Graph statistics changed! User navigated to DeepGitAI tab.', {
                        previous: { nodes: lastNodeCount, edges: lastEdgeCount },
                        current: { nodes: currentNodeCount, edges: currentEdgeCount }
                    });

                    // Only show the prompt if we haven't already shown it for this session
                    if (!hasShownRebuildPrompt.current) {
                        // Add a system message to the chat asking if user wants to rebuild
                        const changeMessage = {
                            id: generateMessageId(),
                            type: 'system' as const,
                            content: `📊 **Graph Structure Changed**\n\nI noticed the graph structure has changed since you last used DeepGitAI:\n\n**Previous:** ${lastNodeCount} nodes, ${lastEdgeCount} edges\n**Current:** ${currentNodeCount} nodes, ${currentEdgeCount} edges\n\nWould you like me to rebuild the DeepGitAI database to include the latest changes?`,
                            timestamp: new Date(),
                            actions: [
                                {
                                    label: "Rebuild DeepGitAI",
                                    action: "rebuild",
                                    data: { previous: { nodes: lastNodeCount, edges: lastEdgeCount }, current: { nodes: currentNodeCount, edges: currentEdgeCount } }
                                },
                                {
                                    label: "Keep Existing",
                                    action: "keep",
                                    data: { previous: { nodes: lastNodeCount, edges: lastEdgeCount }, current: { nodes: currentNodeCount, edges: currentEdgeCount } }
                                }
                            ]
                        };

                        updateState({
                            messages: [...deepgitAiState.messages, changeMessage]
                        });

                        setShowRebuildPrompt(true);
                        hasShownRebuildPrompt.current = true;
                    }
                } else {
                    // No changes detected, just update stored statistics
                    sessionStorage.setItem('deepgit-ai_last_stats', JSON.stringify({
                        nodes: currentNodeCount,
                        edges: currentEdgeCount
                    }));
                }
            } catch (error) {
                console.error('Error parsing stored stats:', error);
                // Update stored statistics on error
                sessionStorage.setItem('deepgit-ai_last_stats', JSON.stringify({
                    nodes: currentNodeCount,
                    edges: currentEdgeCount
                }));
            }
        } else {
            // First visit - just store initial statistics without alerting
            sessionStorage.setItem('deepgit-ai_last_stats', JSON.stringify({
                nodes: currentNodeCount,
                edges: currentEdgeCount
            }));
        }
    }, [graphFile?.textContent]); // Only trigger when component mounts (user switches to tab)

    // Handle action button clicks in messages
    const handleMessageAction = (action: string, data: any) => {
        if (action === 'rebuild') {
            // Trigger DeepGitAI rebuild
            handleSetup().then(() => {
                // Update stored statistics after successful setup
                sessionStorage.setItem('deepgit-ai_last_stats', JSON.stringify({
                    nodes: data.current.nodes,
                    edges: data.current.edges
                }));

                // Add confirmation message
                const confirmMessage = {
                    id: generateMessageId(),
                    type: 'assistant' as const,
                    content: '✅ DeepGitAI database has been rebuilt with the latest graph structure. You can now ask questions about your updated graph!',
                    timestamp: new Date()
                };

                updateState({
                    messages: [...deepgitAiState.messages, confirmMessage]
                });
            });
        } else if (action === 'keep') {
            // User chose to keep existing database
            sessionStorage.setItem('deepgit-ai_last_stats', JSON.stringify({
                nodes: data.current.nodes,
                edges: data.current.edges
            }));

            // Add confirmation message
            const confirmMessage = {
                id: generateMessageId(),
                type: 'assistant' as const,
                content: '👍 Got it! I\'ll keep using the existing DeepGitAI database. You can continue asking questions about your graph.',
                timestamp: new Date()
            };

            updateState({
                messages: [...deepgitAiState.messages, confirmMessage]
            });
        }

        setShowRebuildPrompt(false);
        hasShownRebuildPrompt.current = false; // Reset so they can see the prompt again if they make more changes
    };

    const getProviderIcon = (provider: string) => {
        switch (provider) {
            case "openai":
                return <AiOutlineRobot className="me-2" />;
            case "azure_openai":
                return <FaMicrosoft className="me-2" />;
            case "gemini":
                return <SiGoogle className="me-2" />;
            default:
                return <AiOutlineRobot className="me-2" />;
        }
    };

    const formatTime = (date: Date | string) => {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessageContent = (content: string) => {
        // Parse repository links in format [repository_name](repo_id)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
            // Add text before the link
            if (match.index > lastIndex) {
                parts.push(content.slice(lastIndex, match.index));
            }

            // Add the clickable link
            const repoName = match[1];
            const repoId = match[2];
            parts.push(
                <button
                    key={`link-${match.index}`}
                    className="btn btn-link p-0 text-decoration-none"
                    style={{ color: '#007bff', fontWeight: 'bold' }}
                    onClick={() => handleRepoClick(repoId)}
                    title={`Click to focus on ${repoName} in the graph`}
                >
                    {repoName}
                </button>
            );

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < content.length) {
            parts.push(content.slice(lastIndex));
        }

        // If no markdown links were found, try to detect owner/repo patterns
        if (parts.length === 1 && typeof parts[0] === 'string') {
            return detectAndLinkRepositories(parts[0]);
        }

        return parts.length > 0 ? parts : content;
    };

    const detectAndLinkRepositories = (text: string) => {
        // Pattern to match owner/repo format (e.g., "cozodb/cozo", "vmware/differential-datalog")
        const repoPattern = /\b([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*)\/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*)\b/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = repoPattern.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            // Check if this repository exists in the graph
            const repoName = match[0]; // e.g., "cozodb/cozo"
            const nodeId = findNodeByRepoName(repoName);

            if (nodeId) {
                // Add the clickable link
                parts.push(
                    <button
                        key={`repo-link-${match.index}`}
                        className="btn btn-link p-0 text-decoration-none"
                        style={{ color: '#007bff', fontWeight: 'bold' }}
                        onClick={() => handleRepoClick(nodeId)}
                        title={`Click to focus on ${repoName} in the graph`}
                    >
                        {repoName}
                    </button>
                );
            } else {
                // Repository not found in graph, just add as text
                parts.push(repoName);
            }

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts.length > 0 ? parts : text;
    };

    const findNodeByRepoName = (repoName: string): string | null => {
        if (!data?.graph) return null;

        // Search through all nodes to find one with matching label
        const nodes = data.graph.nodes();
        for (let i = 0; i < nodes.length; i++) {
            const nodeId = nodes[i];
            const nodeAttributes = data.graph.getNodeAttributes(nodeId);
            if (nodeAttributes.label === repoName) {
                return nodeId;
            }
        }

        return null;
    };

    const handleRepoClick = (repoId: string) => {
        // Check if the node exists in the graph
        if (!data?.graph.hasNode(repoId)) {
            notify({
                type: "error",
                message: `Repository ${repoId} not found in the current graph`,
            });
            return;
        }

        // Check if sigma is available
        if (!sigma) {
            notify({
                type: "error",
                message: "Graph not ready. Please wait for the graph to load.",
            });
            return;
        }

        try {
            // Update navigation state to select the node
            setNavState({ ...navState, selectedNode: repoId });

            // Get node position and animate camera to focus on it
            const nodePosition = sigma.getNodeDisplayData(repoId) as Coordinates;
            if (nodePosition) {
                sigma.getCamera().animate(
                    { ...nodePosition, ratio: 0.5 },
                    {
                        duration: ANIMATION_DURATION,
                    },
                );
            } else {
                notify({
                    type: "warning",
                    message: `Node ${repoId} position not available`,
                });
            }
        } catch (error) {
            console.error('Error focusing on node:', error);
            notify({
                type: "error",
                message: `Failed to focus on ${repoId}`,
            });
        }
    };

    return (
        <div className="d-flex flex-column h-100 deepgit-ai-chat" style={{ minHeight: 0 }}>
            {/* Graph Change Confirmation Dialog */}
            {showGraphChangeDialog && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Graph Changed</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => handleGraphChangeConfirm(false)}
                                />
                            </div>
                            <div className="modal-body">
                                <p>The graph has been updated (filtering, edges, etc.).</p>
                                <p>Would you like to:</p>
                                <ul>
                                    <li><strong>Use the new graph:</strong> Reset DeepGitAI setup and start fresh</li>
                                    <li><strong>Keep using the old graph:</strong> Continue with current setup</li>
                                </ul>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => handleGraphChangeConfirm(false)}
                                >
                                    Keep Current Setup
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleGraphChangeConfirm(true)}
                                >
                                    Use New Graph
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="p-3 deepgit-ai-header" style={{ position: 'sticky', top: 0, zIndex: 1000, background: 'white' }}>
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                        <AiOutlineRobot className="me-2" />
                        <h5 className="mb-0">DeepGitAI Assistant</h5>
                    </div>
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setShowSetup(!showSetup)}
                        title="Toggle setup panel"
                    >
                        <VscSettings />
                    </button>
                </div>
            </div>

            {/* Setup Panel */}
            {showSetup && (
                <div className="p-3 border-bottom setup-panel">
                    {!graphFile?.textContent && (
                        <div className="alert alert-warning mb-3">
                            <strong>No Graph Loaded:</strong> Please load a graph first to use DeepGitAI.
                        </div>
                    )}

                    {graphStats.hasData && (
                        <div className="card mb-3">
                            <div className="card-header">
                                <h6 className="mb-0">📈 Graph Statistics</h6>
                            </div>
                            <div className="card-body">
                                <div className="row">
                                    <div className="col-6">
                                        <div className="text-center">
                                            <div className="h4 text-primary mb-1">{graphStats.nodes.toLocaleString()}</div>
                                            <small className="text-muted">Repositories</small>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="text-center">
                                            <div className="h4 text-success mb-1">{graphStats.edges.toLocaleString()}</div>
                                            <small className="text-muted">Connections</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Info Notice */}
                    <div className="alert alert-warning mb-3">
                        <div className="d-flex align-items-center">
                            <AiOutlineInfoCircle className="me-2" />
                            <div>
                                <strong>Note:</strong> DeepGitAI resets when you update the graph. Everything is cleared when you close the browser tab.
                            </div>
                        </div>
                    </div>

                    {/* GitHub Token */}
                    <div className="mb-3">
                        <label className="form-label">
                            <BsGithub className="me-2" />
                            GitHub Personal Access Token
                            <AiOutlineQuestionCircle
                                id="github-token-tooltip"
                                className="ms-2"
                                style={{ color: '#6c757d', cursor: 'help' }}
                                data-bs-toggle="tooltip"
                                data-bs-placement="top"
                                data-bs-html="true"
                                title="Required for accessing GitHub repository data. Stored only in browser memory and cleared when tab closes. Never sent to servers or stored permanently."
                            />
                        </label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="ghp_..."
                            value={sessionAPIKeys.githubToken}
                            onChange={(e) => handleAPIKeyChange("githubToken", e.target.value)}
                        />
                        <small className="form-text text-muted">
                            Required for accessing GitHub repository data
                        </small>
                    </div>

                    {/* LLM Provider Selection */}
                    <div className="mb-3">
                        <label className="form-label">LLM Provider</label>
                        <select
                            className="form-select"
                            value={deepgitAiState.selectedProvider}
                            onChange={(e) => updateState({ selectedProvider: e.target.value })}
                        >
                            <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
                            <option value="azure_openai">Azure OpenAI</option>
                            <option value="gemini">Google Gemini</option>
                        </select>
                    </div>

                    {/* Provider-specific configuration */}
                    {deepgitAiState.selectedProvider === "openai" && (
                        <div className="mb-3">
                            <label className="form-label">
                                <AiOutlineRobot className="me-2" />
                                OpenAI API Key
                                <AiOutlineQuestionCircle
                                    id="openai-key-tooltip"
                                    className="ms-2"
                                    style={{ color: '#6c757d', cursor: 'help' }}
                                    data-bs-toggle="tooltip"
                                    data-bs-placement="top"
                                    data-bs-html="true"
                                    title="Your OpenAI API key for GPT models. Stored only in browser memory and cleared when tab closes. Never sent to servers or stored permanently."
                                />
                            </label>
                            <input
                                type="password"
                                className="form-control"
                                placeholder="sk-..."
                                value={sessionAPIKeys.openaiKey}
                                onChange={(e) => handleAPIKeyChange("openaiKey", e.target.value)}
                            />
                        </div>
                    )}

                    {deepgitAiState.selectedProvider === "azure_openai" && (
                        <>
                            <div className="mb-3">
                                <label className="form-label">
                                    <FaMicrosoft className="me-2" />
                                    Azure OpenAI API Key
                                    <AiOutlineQuestionCircle
                                        id="azure-key-tooltip"
                                        className="ms-2"
                                        style={{ color: '#6c757d', cursor: 'help' }}
                                        data-bs-toggle="tooltip"
                                        data-bs-placement="top"
                                        data-bs-html="true"
                                        title="Your Azure OpenAI API key. Stored only in browser memory and cleared when tab closes. Never sent to servers or stored permanently."
                                    />
                                </label>
                                <input
                                    type="password"
                                    className="form-control"
                                    placeholder="Azure API Key"
                                    value={sessionAPIKeys.azureOpenAIKey}
                                    onChange={(e) => handleAPIKeyChange("azureOpenAIKey", e.target.value)}
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Azure OpenAI Endpoint
                                    <AiOutlineQuestionCircle
                                        id="azure-endpoint-tooltip"
                                        className="ms-2"
                                        style={{ color: '#6c757d', cursor: 'help' }}
                                        data-bs-toggle="tooltip"
                                        data-bs-placement="top"
                                        data-bs-html="true"
                                        title="Your Azure OpenAI endpoint URL. Stored only in browser memory and cleared when tab closes. Never sent to servers or stored permanently."
                                    />
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="https://your-resource.openai.azure.com/"
                                    value={sessionAPIKeys.azureOpenAIEndpoint}
                                    onChange={(e) => handleAPIKeyChange("azureOpenAIEndpoint", e.target.value)}
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Azure OpenAI Deployment Name
                                    <AiOutlineQuestionCircle
                                        id="azure-deployment-tooltip"
                                        className="ms-2"
                                        style={{ color: '#6c757d', cursor: 'help' }}
                                        data-bs-toggle="tooltip"
                                        data-bs-placement="top"
                                        data-bs-html="true"
                                        title="Your Azure OpenAI deployment name (e.g., gpt-4). Stored only in browser memory and cleared when tab closes. Never sent to servers or stored permanently."
                                    />
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="gpt-4"
                                    value={sessionAPIKeys.azureOpenAIDeployment}
                                    onChange={(e) => handleAPIKeyChange("azureOpenAIDeployment", e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {deepgitAiState.selectedProvider === "gemini" && (
                        <div className="mb-3">
                            <label className="form-label">
                                <SiGoogle className="me-2" />
                                Google Gemini API Key
                                <AiOutlineQuestionCircle
                                    id="gemini-key-tooltip"
                                    className="ms-2"
                                    style={{ color: '#6c757d', cursor: 'help' }}
                                    data-bs-toggle="tooltip"
                                    data-bs-placement="top"
                                    data-bs-html="true"
                                    title="Your Google Gemini API key. Stored only in browser memory and cleared when tab closes. Never sent to servers or stored permanently."
                                />
                            </label>
                            <input
                                type="password"
                                className="form-control"
                                placeholder="AIza..."
                                value={sessionAPIKeys.geminiKey}
                                onChange={(e) => handleAPIKeyChange("geminiKey", e.target.value)}
                            />
                        </div>
                    )}

                    <button
                        className="btn btn-primary w-100"
                        onClick={handleSetup}
                        disabled={isSetupLoading || !graphFile?.textContent}
                    >
                        {isSetupLoading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" />
                                Setting up DeepGitAI...
                            </>
                        ) : (
                            <>
                                {getProviderIcon(deepgitAiState.selectedProvider)}
                                Setup DeepGitAI System
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Chat Messages */}
            <div className="flex-grow-1 p-3 chat-messages" style={{ minHeight: 0 }}>
                {deepgitAiState.messages.map((message, index) => {
                    // console.log(`Rendering message ${index}:`, message.type, message.content.substring(0, 50) + '...');
                    return (
                        <div
                            key={message.id}
                            className={`mb-3 ${message.type === 'user' ? 'text-end' : 'text-start'
                                }`}
                        >
                            <div
                                className={`d-inline-block p-3 rounded message-bubble ${message.type === 'user'
                                    ? 'user-message'
                                    : message.type === 'system'
                                        ? 'system-message'
                                        : 'assistant-message'
                                    }`}
                                style={{ maxWidth: '80%' }}
                            >
                                <div className="mb-1">
                                    <small className="text-muted">
                                        {message.type === 'user' ? 'You' : 'DeepGitAI'} • {formatTime(message.timestamp)}
                                    </small>
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>
                                    {renderMessageContent(message.content)}

                                    {/* Action buttons for system messages */}
                                    {message.type === 'system' && message.actions && (
                                        <div className="mt-3">
                                            {message.actions.map((action, actionIndex) => (
                                                <button
                                                    key={actionIndex}
                                                    className={`btn btn-sm me-2 ${action.action === 'rebuild'
                                                        ? 'btn-primary'
                                                        : 'btn-outline-secondary'
                                                        }`}
                                                    onClick={() => handleMessageAction(action.action, action.data)}
                                                >
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            {deepgitAiState.isReady && (
                <div className="p-3 chat-input" style={{ position: 'sticky', bottom: 0, zIndex: 999, background: 'white' }}>
                    <div className="input-group">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Ask about your graph..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
                            disabled={isLoading}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleQuery}
                            disabled={isLoading || !query.trim()}
                        >
                            {isLoading ? (
                                <span className="spinner-border spinner-border-sm" />
                            ) : (
                                <AiOutlineSend />
                            )}
                        </button>
                    </div>
                    <small className="text-muted">
                        Examples: "Find similar repositories", "Show me Rust projects", "What are the most popular repos?"
                    </small>
                </div>
            )}
        </div>
    );
};

export default DeepGitAIPanel;
