"use client"

import React, { FC, useState, useEffect, useCallback, useRef } from "react";
import {
    Sparkles,
    Plus,
    Edit,
    ThumbsUp,
    Settings,
    Minus,
    Check,
    Search,
    Loader2
} from "lucide-react";
import { FaArrowLeft } from "react-icons/fa";
import { API_ENDPOINTS } from "../lib/config";
import debounce from 'lodash/debounce';
import { Tooltip } from 'bootstrap';
import { useNavigate } from 'react-router-dom';

interface AIModel {
    id: string;
    name: string;
}

interface TopicSuggestion {
    name: string;
    count: number;
}

interface AISuggestion {
    topic: string;
    explanation: string;
}

const AI_MODELS: AIModel[] = [
    {
        id: 'gpt-3.5-turbo',
        name: 'OpenAI GPT-3.5 Turbo'
    },
    {
        id: 'gemini-2.0-flash',
        name: 'Google Gemini 2.0 Flash'
    }
];

interface TopicRefinerProps {
    llmSuggestions: string[];
    setLlmSuggestions: (suggestions: string[]) => void;
    selectedTopics: string[];
    setSelectedTopics: (topics: string[]) => void;
    newTopic: string;
    setNewTopic: (topic: string) => void;
    prevStep: () => void;
    handleSubmit: () => void;
    searchTerm: string;
    onRequestSuggestions: (model: string, prompt: string, apiKey: string, topics: string[]) => Promise<void>;
}

// Track which model suggested each topic
type ModelType = 'openai' | 'gemini';
interface TopicWithModel {
    topic: string;
    model: ModelType;
    explanation: string;
}

export const TopicRefiner: FC<Omit<TopicRefinerProps, 'isLlmProcessing'>> = ({
    llmSuggestions = [],
    setLlmSuggestions,
    selectedTopics = [],
    setSelectedTopics,
    prevStep,
    searchTerm,
    onRequestSuggestions
}) => {
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [showWelcomeModal, setShowWelcomeModal] = useState(true);
    const [customPrompt, setCustomPrompt] = useState(
        "Select the top K most relevant topics from the list of {Current topics} based on their relevance to the {Search Term}."
    );
    const [selectedModel, setSelectedModel] = useState('gpt-4');
    const [apiKey, setApiKey] = useState('');
    const [finalizedTopics, setFinalizedTopics] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [canAddTopic, setCanAddTopic] = useState(false);
    const [suggestionsByModel, setSuggestionsByModel] = useState<TopicWithModel[]>([]);
    const tooltipRefs = useRef<{ [key: string]: Tooltip }>({});
    const [isGettingSuggestions, setIsGettingSuggestions] = useState(false);
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const moveToRightColumn = (topic: string) => {
        setFinalizedTopics(prev => [...prev, topic]);
    };

    const moveToLeftColumn = (topic: string) => {
        setFinalizedTopics(prev => prev.filter(t => t !== topic));
    };

    useEffect(() => {
        // Disable scroll on mount
        document.body.style.overflow = "hidden";
        // Clear AI suggestions when component mounts
        setLlmSuggestions([]);
        return () => {
            // Restore scroll on unmount
            document.body.style.overflow = "";
        };
    }, []); // Empty dependency array means this runs once on mount

    // Add effect to handle llmSuggestions updates
    useEffect(() => {
        if (llmSuggestions && llmSuggestions.length > 0 && isGettingSuggestions) {
            console.log('Effect detected new suggestions:', llmSuggestions);
            const currentModel: ModelType = selectedModel === 'gpt-3.5-turbo' ? 'openai' : 'gemini';

            // Process the suggestions
            const newSuggestions: TopicWithModel[] = llmSuggestions.map(suggestion => {
                if (typeof suggestion === 'string') {
                    return {
                        topic: suggestion,
                        model: currentModel,
                        explanation: `Suggested as relevant to ${searchTerm}`
                    };
                } else {
                    const aiSuggestion = suggestion as AISuggestion;
                    return {
                        topic: aiSuggestion.topic,
                        model: currentModel,
                        explanation: aiSuggestion.explanation || `Suggested as relevant to ${searchTerm}`
                    };
                }
            });

            // Update suggestions, keeping existing ones from the other model
            setSuggestionsByModel(prev => {
                const otherModelSuggestions = prev.filter(s => s.model !== currentModel);
                const updatedSuggestions = [...otherModelSuggestions, ...newSuggestions];
                console.log('Updated suggestions in effect:', updatedSuggestions);
                return updatedSuggestions;
            });

            // Close modal after successful update
            setShowPromptModal(false);
            setIsGettingSuggestions(false);
        }
    }, [llmSuggestions, selectedModel, searchTerm, isGettingSuggestions]);

    const handleGetSuggestions = async () => {
        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }
        if (selectedTopics.length === 0) {
            alert('Please select at least one topic before requesting suggestions');
            return;
        }

        try {
            setIsGettingSuggestions(true);  // Start loading
            const currentModel: ModelType = selectedModel === 'gpt-3.5-turbo' ? 'openai' : 'gemini';

            // Clear previous suggestions for this model
            setSuggestionsByModel(prev => prev.filter(s => s.model !== currentModel));

            // Get suggestions from the API
            await onRequestSuggestions(selectedModel, customPrompt, apiKey, selectedTopics);

            // Wait for suggestions to be processed by the effect
            let attempts = 0;
            const maxAttempts = 50;
            const checkInterval = 100;

            while (attempts < maxAttempts && isGettingSuggestions) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                attempts++;
                console.log(`Waiting for suggestions to be processed... attempt ${attempts}/${maxAttempts}`);
            }

            if (isGettingSuggestions) {
                // If we're still getting suggestions after timeout, something went wrong
                console.warn('Timeout waiting for suggestions to be processed');
                throw new Error('Timeout waiting for suggestions to be processed');
            }
        } catch (error) {
            console.error('Error getting suggestions:', error);
            alert('Failed to get AI suggestions. Please try again.');
            setIsGettingSuggestions(false);
        }
    };

    const handleAddNewTopic = () => {
        if (!inputValue.trim() || !canAddTopic) return;  // Don't add if empty or not a valid topic

        const trimmedValue = inputValue.trim();
        // Add to selected topics if not already present
        if (!selectedTopics.includes(trimmedValue)) {
            setSelectedTopics([...selectedTopics, trimmedValue]);
        }

        // Add to finalized topics if not already present
        if (!finalizedTopics.includes(trimmedValue)) {
            setFinalizedTopics([...finalizedTopics, trimmedValue]);
        }

        // Clear the input
        setInputValue("");
        setCanAddTopic(false);
    };

    // Update canAddTopic when input or suggestions change
    useEffect(() => {
        const trimmedInput = inputValue.trim().toLowerCase();
        const isValidTopic = suggestions.some(suggestion =>
            suggestion.name.toLowerCase() === trimmedInput
        );
        setCanAddTopic(isValidTopic);
    }, [inputValue, suggestions]);

    // Debounced function to fetch suggestions
    const fetchSuggestions = useCallback(
        debounce(async (query: string) => {
            if (!query.trim()) {
                setSuggestions([]);
                return;
            }

            setIsLoadingSuggestions(true);
            try {
                const response = await fetch(`${API_ENDPOINTS.SUGGEST_TOPICS}?query=${encodeURIComponent(query)}`);
                const data = await response.json();
                if (data.success) {
                    setSuggestions(data.suggestions);
                } else {
                    throw new Error(data.message || 'Failed to get suggestions');
                }
            } catch (error) {
                console.error('Error fetching suggestions:', error);
                setSuggestions([]);
            } finally {
                setIsLoadingSuggestions(false);
            }
        }, 300),
        []
    );

    // Update suggestions when inputValue changes
    useEffect(() => {
        fetchSuggestions(inputValue);
    }, [inputValue, fetchSuggestions]);

    const handleSuggestionClick = (suggestion: TopicSuggestion) => {
        setInputValue(suggestion.name);
        setCanAddTopic(true);
        setShowSuggestions(false);
        // Remove auto-adding to finalized and selected topics
        // if (!finalizedTopics.includes(suggestion.name)) {
        //     setFinalizedTopics([...finalizedTopics, suggestion.name]);
        // }
        // if (!selectedTopics.includes(suggestion.name)) {
        //     setSelectedTopics([...selectedTopics, suggestion.name]);
        // }
    };

    // Helper function to render model badges with tooltips
    const renderModelBadges = (topic: string, isFinalized: boolean = false) => {
        const normalizedTopic = topic.toLowerCase().trim();
        const topicSuggestions = suggestionsByModel.filter(
            s => s.topic.toLowerCase().trim() === normalizedTopic
        );
        console.log(`Rendering badges for ${topic}:`, topicSuggestions);
        return topicSuggestions.map(suggestion => {
            const tooltipId = `${suggestion.topic}-${suggestion.model}`;
            return (
                <span
                    key={tooltipId}
                    id={tooltipId}
                    className={`badge ms-1`}
                    style={{
                        fontSize: '0.75rem',
                        cursor: isFinalized ? 'default' : 'help',
                        backgroundColor: suggestion.model === 'openai' ? '#10A37F' : '#4285F4',
                        color: 'white'
                    }}
                    {...(!isFinalized && {
                        'data-bs-toggle': 'tooltip',
                        'data-bs-placement': 'top',
                        'title': suggestion.explanation
                    })}
                >
                    {suggestion.model === 'openai' ? 'OpenAI' : 'Gemini'}
                </span>
            );
        });
    };

    // Initialize tooltips when component mounts or suggestions change
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
    }, [suggestionsByModel]);

    // Add effect to initialize state when component mounts
    useEffect(() => {
        // Only clear our internal state
        setSuggestionsByModel([]);
        // Don't clear parent state
        // setLlmSuggestions([]);
    }, []);

    const handleSubmitFinalizedTopics = async () => {
        try {
            setIsSubmitting(true);  // Start loading state
            const response = await fetch(`${API_ENDPOINTS.GENERATED_NODES}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ topics: finalizedTopics }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate GEXF file');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error('Failed to generate GEXF file');
            }

            const file = new File([data.gexfContent], "generated_nodes.gexf", { type: "application/xml" });
            navigate('/graph?l=1', { state: { file } });
        } catch (error) {
            console.error('Error submitting finalized topics:', error);
            alert('Failed to generate graph. Please try again.');
            setIsSubmitting(false);  // Reset loading state on error
        }
    };

    return (
        <main className="container-fluid py-4" style={{ height: '100vh', overflowY: 'auto' }}>
            {/* Navigation/Header Row */}
            <div className="mx-auto" style={{ maxWidth: '90%' }}>
                <div className="d-flex align-items-center justify-content-between mb-4">
                    {/* Left side with back button and titles */}
                    <div className="d-flex align-items-center">
                        <button
                            className="btn btn-outline-secondary me-3"
                            style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0 }}
                            onClick={() => {
                                if (showWelcomeModal) {
                                    setShowWelcomeModal(false);
                                } else {
                                    prevStep();
                                }
                            }}
                        >
                            <FaArrowLeft />
                        </button>
                        <div>
                            <h1 className="mb-0">Topic-Centric Filtering</h1>
                            <h2 className="h5 text-muted mb-0 mt-1">Refine Your Topics</h2>
                        </div>
                    </div>
                    {/* Right side with step indicator */}
                    <div className="d-flex align-items-center gap-4">
                        <div className="d-flex align-items-center gap-2 position-relative">
                            <div
                                className={"rounded-circle d-flex align-items-center justify-content-center text-dark bg-primary text-white"}
                                style={{ width: "32px", height: "32px", zIndex: 1 }}
                            >
                                1
                            </div>
                            <div
                                style={{
                                    width: "40px",
                                    height: "2px",
                                    backgroundColor: "#0d6efd",
                                    transition: "background-color 0.3s ease"
                                }}
                            />
                            <div
                                className={"rounded-circle d-flex align-items-center justify-content-center text-dark bg-primary text-white"}
                                style={{ width: "32px", height: "32px", zIndex: 1 }}
                            >
                                2
                            </div>
                        </div>
                        <div className="text-muted">
                            Step 2 of 2
                        </div>
                    </div>
                </div>
            </div>
            <div className="card shadow-sm mx-auto" style={{ maxWidth: '90%' }}>
                <div className="card-body">
                    <p className="text-muted mb-4">Use AI suggestions to refine your topics or manually add/remove topics.</p>

                    <div className="row g-4">
                        {/* Left column - Available Topics */}
                        <div className="col-md-6">
                            <div className="card h-100" style={{ minHeight: 600 }}>
                                <div className="card-body" style={{ minHeight: 600, maxHeight: 600 }}>
                                    <div className="d-flex justify-content-between align-items-center mb-4">
                                        <h3 className="h5 mb-0 d-flex align-items-center">
                                            <Sparkles className="text-warning me-2" size={20} />
                                            Available Topics
                                            <span className="badge bg-secondary ms-2" style={{ fontSize: '0.9rem' }}>
                                                {selectedTopics.length} topics
                                            </span>
                                        </h3>
                                        <div className="d-flex gap-2">
                                            <button
                                                className="btn btn-outline-secondary"
                                                onClick={() => setShowPromptModal(true)}
                                                title="AI Settings"
                                            >
                                                <Settings size={16} className="me-2" />
                                                AI Setup & Run
                                            </button>
                                        </div>
                                    </div>
                                    <div className="d-flex flex-column h-100" style={{ minHeight: 250, justifyContent: 'flex-start' }}>
                                        <div className="list-group w-100 mb-0" style={{ flex: 1, overflowY: 'auto', maxHeight: 480, marginBottom: 0, paddingBottom: 0 }}>
                                            {selectedTopics.map((topic) => {
                                                const isAdded = finalizedTopics.includes(topic);
                                                return (
                                                    <div key={topic} className="list-group-item d-flex justify-content-between align-items-center">
                                                        <span>
                                                            {topic}
                                                            {renderModelBadges(topic, false)}
                                                        </span>
                                                        {isAdded ? (
                                                            <button
                                                                className="btn btn-sm btn-success"
                                                                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                                                disabled
                                                                title="Topic added"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="btn btn-sm btn-outline-primary"
                                                                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                                                onClick={() => moveToRightColumn(topic)}
                                                                title="Add to finalized topics"
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right column - Finalized Topics */}
                        <div className="col-md-6">
                            <div className="card h-100" style={{ minHeight: 600 }}>
                                <div className="card-body" style={{ minHeight: 600, maxHeight: 600 }}>
                                    <h3 className="h5 mb-4 d-flex align-items-center">
                                        <Edit size={20} className="text-primary me-2" />
                                        Finalized Topics
                                        <span className="badge bg-secondary ms-2" style={{ fontSize: '0.9rem' }}>
                                            {finalizedTopics.length} topics
                                        </span>
                                    </h3>
                                    <p className="text-muted mb-3" style={{ fontSize: '0.85rem' }}>
                                        Search and add topics based on your expertise, only existing GitHub topics are allowed.
                                    </p>
                                    <div className="mb-4 position-relative">
                                        <div className="input-group">
                                            <span className="input-group-text border-end-0 bg-transparent">
                                                <Search size={16} className="text-muted" />
                                            </span>
                                            <input
                                                type="text"
                                                className={`form-control border-start-0 ${!canAddTopic && inputValue.trim() ? 'is-invalid' : ''}`}
                                                placeholder="Add a custom topic"
                                                value={inputValue}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/\s+/g, '-');
                                                    setInputValue(value);
                                                    setShowSuggestions(true);
                                                }}
                                                onFocus={() => setShowSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && inputValue.trim() && canAddTopic) {
                                                        e.preventDefault();
                                                        handleAddNewTopic();
                                                    }
                                                }}
                                            />
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleAddNewTopic}
                                                disabled={!inputValue.trim() || !canAddTopic}
                                                title={!canAddTopic && inputValue.trim() ? "Topic must be selected from suggestions" : "Add topic"}
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        {!canAddTopic && inputValue.trim() && (
                                            <div className="invalid-feedback d-block mt-1">
                                                Please select a topic from the suggestions list
                                            </div>
                                        )}

                                        {/* Suggestions dropdown */}
                                        {showSuggestions && (inputValue.trim() || isLoadingSuggestions) && (
                                            <div
                                                className="position-absolute bg-white rounded-3 shadow-lg w-100"
                                                style={{
                                                    top: "calc(100% + 4px)",
                                                    left: 0,
                                                    zIndex: 1000,
                                                    maxHeight: "200px",
                                                    overflowY: "auto",
                                                    border: "1px solid rgba(0,0,0,0.08)",
                                                    backdropFilter: "blur(8px)",
                                                    backgroundColor: "rgba(255, 255, 255, 0.98)",
                                                }}
                                            >
                                                {isLoadingSuggestions ? (
                                                    <div className="p-3 text-center">
                                                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                                                            <span className="visually-hidden">Loading...</span>
                                                        </div>
                                                        <span className="text-muted">Finding relevant topics...</span>
                                                    </div>
                                                ) : suggestions.length > 0 ? (
                                                    <div className="list-group list-group-flush">
                                                        {suggestions.map((suggestion, index) => (
                                                            <button
                                                                key={suggestion.name}
                                                                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2 px-3"
                                                                onClick={() => handleSuggestionClick(suggestion)}
                                                                style={{
                                                                    border: "none",
                                                                    cursor: "pointer",
                                                                    transition: "all 0.2s ease",
                                                                    backgroundColor: "transparent",
                                                                    borderBottom: index !== suggestions.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.backgroundColor = "rgba(13, 110, 253, 0.05)";
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.backgroundColor = "transparent";
                                                                }}
                                                            >
                                                                <div className="d-flex align-items-center">
                                                                    <span className="me-2" style={{ fontSize: "0.95rem" }}>{suggestion.name}</span>
                                                                    {index === 0 && suggestion.name.toLowerCase() === inputValue.toLowerCase() && (
                                                                        <span className="badge bg-success rounded-pill" style={{ fontSize: "0.7rem" }}>
                                                                            Selected
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <span
                                                                        className="badge rounded-pill px-2 py-1"
                                                                        style={{
                                                                            backgroundColor: "rgba(108, 117, 125, 0.1)",
                                                                            color: "#495057",
                                                                            fontSize: "0.85rem",
                                                                            fontWeight: "500"
                                                                        }}
                                                                    >
                                                                        {suggestion.count.toLocaleString()} repos
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-3 text-center">
                                                        <div className="text-muted mb-1">
                                                            <i className="fas fa-search me-2"></i>
                                                            No matching topics found
                                                        </div>
                                                        <small className="text-muted">Please select from existing topics</small>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="list-group" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        {finalizedTopics.map((topic) => (
                                            <div key={topic} className="list-group-item py-2 px-3 d-flex justify-content-between align-items-center">
                                                <span className="d-flex align-items-center" style={{ fontSize: '0.9rem' }}>
                                                    {topic}
                                                    {renderModelBadges(topic, true)}
                                                </span>
                                                <button
                                                    className="btn btn-sm btn-outline-danger ms-2"
                                                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                                    onClick={() => moveToLeftColumn(topic)}
                                                    title="Remove from finalized topics"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="d-flex justify-content-end mt-4">
                        <button
                            className="btn d-flex align-items-center"
                            onClick={handleSubmitFinalizedTopics}
                            disabled={finalizedTopics.length === 0 || isSubmitting}
                            style={{
                                color: 'white',
                                backgroundColor: '#198754',  // Bootstrap's success color
                                borderColor: '#198754',
                                opacity: finalizedTopics.length === 0 || isSubmitting ? 0.65 : 1
                            }}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={16} className="me-2 animate-spin" />
                                    Generating Graph...
                                </>
                            ) : (
                                <>
                                    <ThumbsUp size={16} className="me-2" />
                                    Submit Topics
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Welcome Modal */}
            {showWelcomeModal && (
                <div className="modal show d-block" tabIndex={-1} role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title d-flex align-items-center">
                                    <Sparkles className="text-warning me-2" size={20} />
                                    Welcome to Topic Refinement
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowWelcomeModal(false)}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="alert alert-info mb-0">
                                    <p className="mb-0">
                                        Your selected topics have been loaded. Please use AI to further refine them with your search term: <span className="badge bg-primary" style={{ fontSize: '1rem' }}>{searchTerm}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="modal-footer">
                                {/* <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setShowWelcomeModal(false);
                                        setShowPromptModal(true);
                                    }}
                                >
                                    Configure AI Settings
                                </button> */}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompt Customization Modal */}
            {showPromptModal && (
                <div className="modal show d-block" tabIndex={-1} role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">AI Settings</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowPromptModal(false)}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body">
                                {/* Model Selection */}
                                <div className="mb-4">
                                    <label className="form-label fw-bold">Select AI Model</label>
                                    <div className="row g-3">
                                        {AI_MODELS.map((model) => (
                                            <div className="col-md-6" key={model.id}>
                                                <div
                                                    className={`card h-100 cursor-pointer ${selectedModel === model.id ? 'border-primary' : ''
                                                        }`}
                                                    onClick={() => setSelectedModel(model.id)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="card-body py-2">
                                                        <div className="form-check">
                                                            <input
                                                                type="radio"
                                                                className="form-check-input"
                                                                name="aiModel"
                                                                checked={selectedModel === model.id}
                                                                onChange={() => setSelectedModel(model.id)}
                                                            />
                                                            <label className="form-check-label">
                                                                {model.name}
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* API Key Input */}
                                <div className="mb-4">
                                    <label htmlFor="apiKey" className="form-label fw-bold">API Key</label>
                                    <div className="input-group">
                                        <input
                                            type="password"
                                            id="apiKey"
                                            className="form-control"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Enter your API key"
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={() => {
                                                const input = document.getElementById('apiKey') as HTMLInputElement
                                                input.type = input.type === 'password' ? 'text' : 'password'
                                            }}
                                        >
                                            Show/Hide
                                        </button>
                                    </div>
                                    <small className="text-muted">
                                        Your API key will be used only for this session and won't be stored.
                                    </small>
                                </div>

                                {/* Custom Prompt */}
                                <div className="mb-4">
                                    <label htmlFor="customPrompt" className="form-label fw-bold">
                                        Custom Prompt
                                    </label>
                                    <textarea
                                        id="customPrompt"
                                        className="form-control"
                                        rows={4}
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="Enter your custom prompt for the AI..."
                                    />
                                    <small className="text-muted">
                                        Customize how the AI should analyze and suggest topics. Be specific about what kind of suggestions
                                        you're looking for and you should include search term and current topics in the prompt.
                                    </small>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowPromptModal(false)}
                                    disabled={isGettingSuggestions}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary d-flex align-items-center gap-2"
                                    onClick={handleGetSuggestions}
                                    disabled={!apiKey || isGettingSuggestions}
                                >
                                    {isGettingSuggestions ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Getting Suggestions...
                                        </>
                                    ) : (
                                        'Save Changes & Get Suggestions'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}; 
