"use client"

import React, { FC, useState, useEffect } from "react";
import {
    Sparkles,
    Plus,
    Edit,
    ThumbsUp,
    Settings,
    Minus,
    Check
} from "lucide-react";
import { API_ENDPOINTS } from '../lib/config';
import { FaArrowLeft } from "react-icons/fa";

interface AIModel {
    id: string;
    name: string;
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
    newTopic: string;
    setNewTopic: (topic: string) => void;
    addNewTopic: () => void;
    prevStep: () => void;
    handleSubmit: () => void;
    searchTerm: string;
}

export const TopicRefiner: FC<Omit<TopicRefinerProps, 'isLlmProcessing'>> = ({
    llmSuggestions = [],
    setLlmSuggestions,
    selectedTopics = [],
    newTopic = "",
    setNewTopic,
    addNewTopic,
    prevStep,
    handleSubmit,
    searchTerm
}) => {
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [showWelcomeModal, setShowWelcomeModal] = useState(true);
    const [customPrompt, setCustomPrompt] = useState(
        "Select the top K most relevant topics from the list of {Current topics} based on their relevance to the {Search Term}."
    );
    const [selectedModel, setSelectedModel] = useState('gpt-4');
    const [apiKey, setApiKey] = useState('');
    const [finalizedTopics, setFinalizedTopics] = useState<string[]>([]);

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
            const response = await fetch(API_ENDPOINTS.AI_PROCESS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedModel,
                    customPrompt,
                    apiKey,
                    searchTerm,
                    selectedTopics
                })
            });
            const data = await response.json();
            if (data.success && data.result) {
                setLlmSuggestions(data.result);
            } else {
                alert('Failed to get AI suggestions.');
            }
            setShowPromptModal(false);
        } catch {
            alert('Failed to get AI suggestions. Please try again.');
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
                            <div className="card h-100" style={{ minHeight: 420 }}>
                                <div className="card-body" style={{ minHeight: 420, maxHeight: 420 }}>
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
                                        <div className="list-group w-100 mb-0" style={{ flex: 1, overflowY: 'auto', maxHeight: 300, marginBottom: 0, paddingBottom: 0 }}>
                                            {selectedTopics.map((topic) => {
                                                const isAI = llmSuggestions.includes(topic);
                                                const isAdded = finalizedTopics.includes(topic);
                                                return (
                                                    <div key={topic} className="list-group-item d-flex justify-content-between align-items-center">
                                                        <span>
                                                            {topic}
                                                            {isAI && <span className="badge bg-info ms-2">AI</span>}
                                                        </span>
                                                        {isAdded ? (
                                                            <button
                                                                className="btn btn-sm btn-success"
                                                                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                                                onClick={() => moveToLeftColumn(topic)}
                                                                title="Remove from finalized topics"
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
                            <div className="card h-100" style={{ minHeight: 420 }}>
                                <div className="card-body" style={{ minHeight: 420, maxHeight: 420 }}>
                                    <h3 className="h5 mb-4 d-flex align-items-center">
                                        <Edit size={20} className="text-primary me-2" />
                                        Finalized Topics
                                        <span className="badge bg-secondary ms-2" style={{ fontSize: '0.9rem' }}>
                                            {finalizedTopics.length} topics
                                        </span>
                                    </h3>
                                    <div className="mb-4">
                                        <div className="input-group">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Add a custom topic"
                                                value={newTopic}
                                                onChange={(e) => setNewTopic(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && addNewTopic()}
                                            />
                                            <button
                                                className="btn btn-primary"
                                                onClick={addNewTopic}
                                                disabled={!newTopic}
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="list-group" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                        {finalizedTopics.map((topic) => (
                                            <div key={topic} className="list-group-item d-flex justify-content-between align-items-center">
                                                <span className="d-flex align-items-center">
                                                    {topic}
                                                    {llmSuggestions.includes(topic) && <span className="badge bg-info ms-2">AI</span>}
                                                </span>
                                                <button
                                                    className="btn btn-sm btn-outline-danger ms-2"
                                                    style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                                    onClick={() => moveToLeftColumn(topic)}
                                                    title="Remove from finalized topics"
                                                >
                                                    <Minus size={16} />
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
                            className="btn btn-success d-flex align-items-center"
                            onClick={() => {
                                // Pass finalized topics to parent component
                                handleSubmit();
                            }}
                            disabled={finalizedTopics.length === 0}
                        >
                            <ThumbsUp size={16} className="me-2" />
                            Submit Topics
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
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleGetSuggestions}
                                    disabled={!apiKey}
                                >
                                    Save Changes & Get Suggestions
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}; 
