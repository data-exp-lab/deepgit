"use client"

import React, { FC, useState } from "react";
import {
    Sparkles,
    Check,
    Plus,
    AlertCircle,
    Edit,
    X,
    ThumbsUp,
    Settings
} from "lucide-react";

interface AIModel {
    id: string;
    name: string;
}

const AI_MODELS: AIModel[] = [
    {
        id: 'gpt-4',
        name: 'OpenAI GPT-4'
    },
    {
        id: 'gpt-3.5-turbo',
        name: 'OpenAI GPT-3.5'
    },
    {
        id: 'gemini-pro',
        name: 'Google Gemini Pro'
    },
    {
        id: 'gemini-ultra',
        name: 'Google Gemini Ultra'
    }
];

interface TopicRefinerProps {
    isLlmProcessing: boolean;
    llmSuggestions: string[];
    setLlmSuggestions: (suggestions: string[]) => void;
    onRequestSuggestions: (model: string, prompt: string, apiKey: string, topics: string[]) => Promise<void>;
    selectedTopics: string[];
    selectLlmSuggestion: (suggestion: string) => void;
    newTopic: string;
    setNewTopic: (topic: string) => void;
    addNewTopic: () => void;
    removeTopic: (topic: string) => void;
    prevStep: () => void;
    handleSubmit: () => void;
}

export const TopicRefiner: FC<TopicRefinerProps> = ({
    isLlmProcessing,
    llmSuggestions = [],
    setLlmSuggestions,
    onRequestSuggestions,
    selectedTopics = [],
    selectLlmSuggestion,
    newTopic = "",
    setNewTopic,
    addNewTopic,
    removeTopic,
    prevStep,
    handleSubmit
}) => {
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [customPrompt, setCustomPrompt] = useState(
        "Please analyze these topics and suggest related or more specific topics that might be relevant."
    );
    const [selectedModel, setSelectedModel] = useState('gpt-4');
    const [apiKey, setApiKey] = useState('');

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
            const response = await fetch('/api/ai-process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: customPrompt,
                    topics: selectedTopics
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.suggestions) {
                setLlmSuggestions(data.suggestions);
            }

            if (showPromptModal) {
                setShowPromptModal(false);
            }
        } catch (error) {
            console.error('Error getting suggestions:', error);
            alert("Failed to get AI suggestions. Please try again.");
        }
    };

    return (
        <>
            <div className="card shadow-sm">
                <div className="card-body">
                    {/* <h2 className="card-title mb-3">Refine Your Topics</h2> */}
                    <p className="text-muted mb-4">Use AI suggestions to refine your topics or manually add/remove topics.</p>

                    <div className="row g-4">
                        {/* LLM Suggestions */}
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center mb-4">
                                        <h3 className="h5 mb-0 d-flex align-items-center">
                                            <Sparkles className="text-warning me-2" size={20} />
                                            AI Suggestions
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

                                    {llmSuggestions.length > 0 ? (
                                        <div className="list-group" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                            {llmSuggestions.map((suggestion) => (
                                                <div key={suggestion} className="list-group-item d-flex justify-content-between align-items-center">
                                                    <span>{suggestion}</span>
                                                    <button
                                                        className={`btn btn-sm ${selectedTopics.includes(suggestion) ? 'btn-success' : 'btn-outline-primary'}`}
                                                        onClick={() => selectLlmSuggestion(suggestion)}
                                                        disabled={selectedTopics.includes(suggestion)}
                                                    >
                                                        {selectedTopics.includes(suggestion) ? (
                                                            <Check size={16} />
                                                        ) : (
                                                            <Plus size={16} />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted py-5">
                                            {isLlmProcessing ? (
                                                <p className="text-primary">Analyzing topics...</p>
                                            ) : (
                                                <>
                                                    <AlertCircle size={32} className="mb-3" />
                                                    <p>Configure AI settings to receive suggestions</p>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Manual Topic Management */}
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-body">
                                    <h3 className="h5 mb-4 d-flex align-items-center">
                                        <Edit size={20} className="text-primary me-2" />
                                        Customize Topics
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

                                    <div>
                                        <h4 className="h6 mb-3">Selected Topics ({selectedTopics.length})</h4>
                                        <div className="list-group" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                            {selectedTopics.length > 0 ? (
                                                selectedTopics.map((topic) => (
                                                    <div key={topic} className="list-group-item d-flex justify-content-between align-items-center">
                                                        <span>{topic}</span>
                                                        <button
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => removeTopic(topic)}
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-muted text-center py-4 fst-italic">
                                                    No topics selected yet.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="d-flex justify-content-between mt-4">
                        <button className="btn btn-outline-secondary" onClick={prevStep}>
                            Back
                        </button>
                        <button
                            className="btn btn-success d-flex align-items-center"
                            onClick={handleSubmit}
                            disabled={selectedTopics.length === 0}
                        >
                            <ThumbsUp size={16} className="me-2" />
                            Submit Topics
                        </button>
                    </div>
                </div>
            </div>

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
                                        you're looking for.
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
        </>
    );
}; 
