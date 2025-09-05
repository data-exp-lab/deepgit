import React, { FC, useContext, useState, useRef, useEffect, useMemo } from "react";
import { AiOutlineRobot, AiOutlineSend, AiOutlineQuestionCircle, AiOutlineInfoCircle } from "react-icons/ai";
import { BsGithub } from "react-icons/bs";
import { FaMicrosoft } from "react-icons/fa6";
import { SiGoogle } from "react-icons/si";
import { VscSettings } from "react-icons/vsc";
import { Tooltip } from 'bootstrap';

import { GraphContext } from "../lib/context";
import { useNotifications } from "../lib/notifications";
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
}

interface GraphRAGState {
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

const GraphRAGPanel: FC = () => {
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
            const saved = sessionStorage.getItem('graphrag_session_keys');
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
            sessionStorage.setItem('graphrag_session_keys', JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to save session API keys:', error);
        }
    };

    const clearSessionAPIKeys = () => {
        try {
            sessionStorage.removeItem('graphrag_session_keys');
        } catch (error) {
            console.error('Failed to clear session API keys:', error);
        }
    };

    // Clear all GraphRAG data (API keys and state)
    const clearAllGraphRAGData = () => {
        try {
            // Clear session storage (API keys)
            sessionStorage.removeItem('graphrag_session_keys');
            // Clear localStorage (GraphRAG state)
            localStorage.removeItem('graphrag_state');
        } catch (error) {
            console.error('Failed to clear GraphRAG data:', error);
        }
    };

    // Clear sensitive data when component unmounts or page unloads
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Only clear when the entire browser tab is being closed
            clearAllGraphRAGData();
        };

        const handlePageHide = () => {
            // Clear everything when page is hidden (browser tab closed)
            clearAllGraphRAGData();
        };

        // Don't clear on visibility change (switching between tabs in same page)
        // const handleVisibilityChange = () => {
        //     if (document.visibilityState === 'hidden') {
        //         clearAllGraphRAGData();
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
            // clearAllGraphRAGData();
        };
    }, []);

    // Calculate graph hash for change detection
    const currentGraphHash = useMemo(() => {
        if (!data || !graphFile?.textContent) return '';

        // Include both file content and graph structure in hash calculation
        const graphStructure = {
            nodes: data.graph.nodes().length,
            edges: data.graph.edges().length,
            fileContent: graphFile.textContent
        };

        return btoa(JSON.stringify(graphStructure)).slice(0, 20); // Simple hash
    }, [data, graphFile?.textContent]);

    // Load persisted state from localStorage
    const loadPersistedState = (): GraphRAGState | null => {
        try {
            const saved = localStorage.getItem('graphrag_state');
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
    const saveState = (state: Partial<GraphRAGState>) => {
        try {
            const current = loadPersistedState() || {
                graphHash: '',
                isReady: false,
                messages: [{
                    id: generateMessageId(),
                    type: 'assistant',
                    content: 'Hello! I\'m your GraphRAG assistant. I can help you analyze your GitHub repository graph with AI-powered insights. Let\'s get started by setting up the system.',
                    timestamp: new Date()
                }],
                selectedProvider: "openai"
            };

            const updated = { ...current, ...state };
            localStorage.setItem('graphrag_state', JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to save GraphRAG state:', error);
        }
    };

    // Initialize state from localStorage or defaults
    const [graphragState, setGraphragState] = useState<GraphRAGState>(() => {
        const saved = loadPersistedState();
        if (saved && saved.graphHash === currentGraphHash) {
            return saved;
        }
        return {
            graphHash: currentGraphHash,
            isReady: false,
            messages: [{
                id: generateMessageId(),
                type: 'assistant',
                content: 'Hello! I\'m your GraphRAG assistant. I can help you analyze your GitHub repository graph with AI-powered insights. Let\'s get started by setting up the system.',
                timestamp: new Date()
            }],
            selectedProvider: "openai"
        };
    });

    // State for graph change confirmation
    const [showGraphChangeDialog, setShowGraphChangeDialog] = useState(false);
    const [pendingGraphHash, setPendingGraphHash] = useState('');

    // Detect graph changes
    useEffect(() => {
        if (currentGraphHash && currentGraphHash !== graphragState.graphHash) {
            setPendingGraphHash(currentGraphHash);
            setShowGraphChangeDialog(true);
        }
    }, [currentGraphHash, graphragState.graphHash]);

    // Check backend health and reset state if needed
    useEffect(() => {
        const checkBackendHealth = async () => {
            if (graphragState.isReady) {
                try {
                    const response = await fetch('http://localhost:5002/api/graphrag-health', {
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
                                content: '⚠️ GraphRAG backend was restarted. Please set up the system again.',
                                timestamp: new Date()
                            }]
                        }));
                        notify({
                            type: "warning",
                            message: "GraphRAG backend was restarted. Please set up the system again.",
                        });
                    }
                } catch (error) {
                    // Backend is not reachable, reset the state but preserve existing messages
                    updateState(prevState => ({
                        isReady: false,
                        messages: [...prevState.messages, {
                            id: generateMessageId(),
                            type: 'system' as const,
                            content: '❌ Cannot connect to GraphRAG backend. Please ensure the server is running.',
                            timestamp: new Date()
                        }]
                    }));
                    notify({
                        type: "error",
                        message: "Cannot connect to GraphRAG backend. Please ensure the server is running.",
                    });
                }
            }
        };

        checkBackendHealth();
    }, [graphragState.isReady]);

    // Handle graph change confirmation
    const handleGraphChangeConfirm = (useNewGraph: boolean) => {
        if (useNewGraph) {
            // Reset state for new graph
            const newState: GraphRAGState = {
                graphHash: currentGraphHash,
                isReady: false,
                messages: [{
                    id: generateMessageId(),
                    type: 'assistant',
                    content: 'Hello! I\'m your GraphRAG assistant. I can help you analyze your GitHub repository graph with AI-powered insights. Let\'s get started by setting up the system.',
                    timestamp: new Date()
                }],
                selectedProvider: graphragState.selectedProvider
            };
            setGraphragState(newState);
            saveState(newState);
        }
        setShowGraphChangeDialog(false);
        setPendingGraphHash('');
    };

    // Update state and persist changes
    const updateState = (updates: Partial<GraphRAGState> | ((prevState: GraphRAGState) => Partial<GraphRAGState>)) => {
        const newState = typeof updates === 'function'
            ? { ...graphragState, ...updates(graphragState) }
            : { ...graphragState, ...updates };
        setGraphragState(newState);
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
        setShowSetup(!graphragState.isReady);
    }, [graphragState.isReady]);

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
    }, [graphragState.messages]);

    // Debug: Log messages when they change
    useEffect(() => {
        // console.log('Messages updated:', graphragState.messages.length, graphragState.messages);
        // console.log('Message types:', graphragState.messages.map(m => ({ id: m.id, type: m.type, content: m.content.substring(0, 50) + '...' })));
    }, [graphragState.messages]);

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
        if (graphragState.selectedProvider === "openai" && !apiKeys.openaiKey) {
            notify({
                type: "error",
                message: "Please enter your OpenAI API key",
            });
            return false;
        }
        if (graphragState.selectedProvider === "azure_openai" && (!apiKeys.azureOpenAIKey || !apiKeys.azureOpenAIEndpoint || !apiKeys.azureOpenAIDeployment)) {
            notify({
                type: "error",
                message: "Please enter all Azure OpenAI credentials",
            });
            return false;
        }
        if (graphragState.selectedProvider === "gemini" && !apiKeys.geminiKey) {
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
        const newMessages = [...graphragState.messages, {
            id: generateMessageId(),
            type: 'user' as const,
            content: 'Please set up the GraphRAG system for me.',
            timestamp: new Date()
        }];
        updateState({ messages: newMessages });

        const setupMessages = [...newMessages, {
            id: generateMessageId(),
            type: 'system' as const,
            content: `🔄 Starting GraphRAG setup for ${graphStats.nodes.toLocaleString()} repositories...`,
            timestamp: new Date()
        }];
        updateState({ messages: setupMessages });

        // console.log('About to create EventSource...');

        // Reset progress status before creating EventSource
        // try {
        //     await fetch('http://localhost:5002/api/graphrag-reset-progress', {
        //         method: 'POST',
        //         headers: { 'Content-Type': 'application/json' }
        //     });
        //     console.log('Progress status reset');
        // } catch (error) {
        //     console.log('Could not reset progress status:', error);
        // }

        // Start listening for progress updates
        // console.log('Creating EventSource connection to:', 'http://localhost:5002/api/graphrag-progress');
        // const eventSource = new EventSource('http://localhost:5002/api/graphrag-progress');
        // console.log('EventSource created, readyState:', eventSource.readyState);


        try {
            const response = await fetch('http://localhost:5002/api/graphrag-setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: graphragState.selectedProvider,
                    apiKeys: getSessionAPIKeys(),
                    graphFile: graphFile.textContent
                })
            });

            const result = await response.json();

            if (result.success) {
                const finalMessages = [...graphragState.messages, {
                    id: generateMessageId(),
                    type: 'assistant' as const,
                    content: '🎉 GraphRAG setup completed successfully! You can now ask questions about your repository graph.',
                    timestamp: new Date()
                }];
                updateState({
                    isReady: true,
                    messages: finalMessages,
                    lastSetupTime: new Date()
                });
            } else {
                notify({
                    type: "error",
                    message: result.error || "Setup failed",
                });
                const errorMessages = [...graphragState.messages, {
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
                message: "Failed to setup GraphRAG system",
            });
            const errorMessages = [...graphragState.messages, {
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

        if (!graphragState.isReady) {
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
        const newMessages = [...graphragState.messages, {
            id: generateMessageId(),
            type: 'user' as const,
            content: userMessage,
            timestamp: new Date()
        }];
        updateState({ messages: newMessages });

        try {
            const response = await fetch("/api/graphrag", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: userMessage,
                    provider: graphragState.selectedProvider,
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
        <div className="d-flex flex-column h-100 graphrag-chat">
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
                                    <li><strong>Use the new graph:</strong> Reset GraphRAG setup and start fresh</li>
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
            <div className="p-3 border-bottom">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                        <AiOutlineRobot className="me-2" />
                        <h5 className="mb-0">GraphRAG Assistant</h5>
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
                            <strong>No Graph Loaded:</strong> Please load a graph first to use GraphRAG.
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
                                <strong>Note:</strong> GraphRAG resets when you update the graph. Everything is cleared when you close the browser tab.
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
                            value={graphragState.selectedProvider}
                            onChange={(e) => updateState({ selectedProvider: e.target.value })}
                        >
                            <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
                            <option value="azure_openai">Azure OpenAI</option>
                            <option value="gemini">Google Gemini</option>
                        </select>
                    </div>

                    {/* Provider-specific configuration */}
                    {graphragState.selectedProvider === "openai" && (
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

                    {graphragState.selectedProvider === "azure_openai" && (
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

                    {graphragState.selectedProvider === "gemini" && (
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
                                Setting up GraphRAG...
                            </>
                        ) : (
                            <>
                                {getProviderIcon(graphragState.selectedProvider)}
                                Setup GraphRAG System
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Chat Messages */}
            <div className="flex-grow-1 overflow-auto p-3 chat-messages">
                {graphragState.messages.map((message, index) => {
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
                                        {message.type === 'user' ? 'You' : 'GraphRAG'} • {formatTime(message.timestamp)}
                                    </small>
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>
                                    {renderMessageContent(message.content)}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            {graphragState.isReady && (
                <div className="p-3 border-top chat-input">
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

export default GraphRAGPanel;
