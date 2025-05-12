import React, { FC, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { FaArrowLeft, FaPlus, FaTimes, FaFilter, FaMagic, FaEdit, FaCheck, FaExclamationCircle, FaThumbsUp } from "react-icons/fa";

// import { getErrorMessage } from "../lib/errors";
import { useNotifications } from "../lib/notifications";

// Mock data - replace with actual API calls in your implementation
const mockTopicData = [
    { name: "data-visualization", count: 342 },
    { name: "graph-theory", count: 289 },
    { name: "network-analysis", count: 256 },
    { name: "scientific-computing", count: 198 },
    { name: "python", count: 187 },
    { name: "javascript", count: 165 },
    { name: "d3", count: 142 },
    { name: "typescript", count: 128 },
    { name: "react", count: 112 },
    { name: "machine-learning", count: 98 },
    { name: "data-science", count: 87 },
    { name: "visualization", count: 76 },
    { name: "neo4j", count: 65 },
    { name: "graphql", count: 54 },
    { name: "sigma-js", count: 43 },
];

// Topic Histogram Component
interface TopicHistogramProps {
    data: Array<{ name: string; count: number }>;
    threshold: number;
}

// Rename to HistogramBars to avoid conflict
const HistogramBars: FC<TopicHistogramProps> = ({ data, threshold }) => {
    // Find the maximum count for scaling
    const maxCount = Math.max(...data.map(item => item.count), 1);

    return (
        <div className="w-100 h-100 d-flex flex-column">
            <div className="flex-grow-1 d-flex align-items-end">
                {data.map((item, index) => {
                    const height = `${(item.count / maxCount) * 100}%`;
                    const isSelected = item.count >= threshold;

                    return (
                        <div key={index} className="d-flex flex-column align-items-center flex-grow-1" style={{ minWidth: "40px" }}>
                            <div
                                className={`mx-1 rounded-top ${isSelected ? "bg-primary" : "bg-light"}`}
                                style={{ height, width: "30px", transition: "all 0.3s ease" }}
                            ></div>
                            <div className="w-100 text-center mt-2">
                                <div className="small text-muted fw-bold">{item.count}</div>
                                <div
                                    className="small text-truncate"
                                    style={{
                                        maxWidth: "100%",
                                        transform: "rotate(-45deg)",
                                        transformOrigin: "left top",
                                        whiteSpace: "nowrap",
                                        paddingLeft: "5px"
                                    }}
                                >
                                    {item.name}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Threshold line */}
            <div className="position-relative" style={{ height: 0 }}>
                <div
                    className="position-absolute w-100 border-top border-danger border-2 d-flex align-items-center justify-content-end"
                    style={{
                        bottom: `${(threshold / maxCount) * 100}%`,
                        transform: "translateY(-100%)",
                        borderStyle: "dashed"
                    }}
                >
                    <span className="bg-white text-danger small px-1 rounded" style={{ marginTop: "-12px", marginRight: "10px" }}>
                        Threshold: {threshold}
                    </span>
                </div>
            </div>
        </div>
    );
};

const TopicHistogram: FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { notify } = useNotifications();

    // Get the search term from location state
    const searchTerm = (location.state as { searchTerm?: string } | undefined)?.searchTerm || "";

    // State for the current step in the wizard
    const [currentStep, setCurrentStep] = useState(1);

    // State for extracted topics and their frequencies
    const [extractedTopics, setExtractedTopics] = useState<Array<{ name: string; count: number }>>([]);

    // State for selected topics
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

    // State for frequency threshold
    const [frequencyThreshold, setFrequencyThreshold] = useState(50);

    // State for LLM suggestions
    const [llmSuggestions, setLlmSuggestions] = useState<string[]>([]);

    // State for final topics
    const [finalTopics, setFinalTopics] = useState<string[]>([]);

    // State for new topic being added
    const [newTopic, setNewTopic] = useState("");

    // State for loading indicators
    const [isLoading, setIsLoading] = useState(false);

    // State for LLM processing
    const [isLlmProcessing, setIsLlmProcessing] = useState(false);

    // Effect to check if search term is provided
    useEffect(() => {
        if (!searchTerm) {
            notify({
                message: "No search term provided. Please enter a topic to search.",
                type: "warning"
            });
            navigate('/');
        }
    }, [searchTerm, navigate, notify]);

    // Effect to simulate topic extraction when search term changes
    useEffect(() => {
        if (searchTerm) {
            setIsLoading(true);
            // Simulate API call to extract topics
            setTimeout(() => {
                setExtractedTopics(mockTopicData);
                setIsLoading(false);
            }, 1000);
        }
    }, [searchTerm]);

    // Effect to update selected topics based on frequency threshold
    useEffect(() => {
        if (extractedTopics.length > 0) {
            setSelectedTopics(
                extractedTopics
                    .filter(topic => topic.count >= frequencyThreshold)
                    .map(topic => topic.name)
            );
        }
    }, [frequencyThreshold, extractedTopics]);

    // Function to handle LLM processing
    const handleLlmProcess = () => {
        setIsLlmProcessing(true);
        // Simulate LLM processing
        setTimeout(() => {
            // This would be replaced with actual LLM API call
            const suggestedTopics = selectedTopics.filter((_, i) => i % 2 === 0);
            suggestedTopics.push("knowledge-graphs", "graph-databases");
            setLlmSuggestions(suggestedTopics);
            setIsLlmProcessing(false);
        }, 1500);
    };

    // Function to handle topic selection toggle
    const toggleTopic = (topic: string) => {
        if (selectedTopics.includes(topic)) {
            setSelectedTopics(selectedTopics.filter(t => t !== topic));
        } else {
            setSelectedTopics([...selectedTopics, topic]);
        }
    };

    // Function to handle LLM suggestion selection
    const selectLlmSuggestion = (suggestion: string) => {
        if (!finalTopics.includes(suggestion)) {
            setFinalTopics([...finalTopics, suggestion]);
        }
    };

    // Function to add a new topic
    const addNewTopic = () => {
        if (newTopic && !finalTopics.includes(newTopic)) {
            setFinalTopics([...finalTopics, newTopic]);
            setNewTopic("");
        }
    };

    // Function to remove a topic
    const removeTopic = (topic: string) => {
        setFinalTopics(finalTopics.filter(t => t !== topic));
    };

    // Function to handle form submission for the final step
    const handleSubmit = () => {
        console.log("Final topics submitted:", finalTopics);
        // Navigate to graph view with the selected topics
        navigate('/graph', { state: { topics: finalTopics } });
    };

    // Function to move to the next step
    const nextStep = () => {
        if (currentStep === 1) {
            // When moving from step 1 to 2, initialize final topics with selected topics
            setFinalTopics(selectedTopics);
        }

        setCurrentStep(prev => Math.min(prev + 1, 2));
    };

    // Function to move to the previous step
    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    // Function to go back to home
    const goBackToHome = () => {
        navigate('/');
    };

    return (
        <main className="container py-4">
            {/* Header with back button */}
            <div className="d-flex align-items-center mb-4">
                <button
                    className="btn btn-outline-secondary me-3"
                    onClick={goBackToHome}
                    style={{ borderRadius: "50%", width: "40px", height: "40px", padding: "0" }}
                >
                    <FaArrowLeft className="m-auto" />
                </button>
                <h1 className="mb-0">Topic Selection</h1>
            </div>

            {/* Progress indicator */}
            <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                        <div className={`rounded-circle d-flex align-items-center justify-content-center ${currentStep >= 1 ? "bg-primary text-white" : "bg-light"
                            }`} style={{ width: "40px", height: "40px" }}>
                            1
                        </div>
                        <div className={`mx-2 ${currentStep > 1 ? "bg-primary" : "bg-light"}`} style={{ height: "2px", width: "50px" }}></div>
                        <div className={`rounded-circle d-flex align-items-center justify-content-center ${currentStep >= 2 ? "bg-primary text-white" : "bg-light"
                            }`} style={{ width: "40px", height: "40px" }}>
                            2
                        </div>
                    </div>
                    <div className="text-muted small">
                        Step {currentStep} of 2
                    </div>
                </div>
                <div className="d-flex justify-content-between mt-2 small" style={{ maxWidth: "200px" }}>
                    <div className={currentStep === 1 ? "fw-bold text-primary" : "text-muted"}>
                        Select by Frequency
                    </div>
                    <div className={currentStep === 2 ? "fw-bold text-primary" : "text-muted"}>
                        Refine Topics
                    </div>
                </div>
            </div>

            {/* Step 1: Topic Frequency Selection */}
            {currentStep === 1 && (
                <div className="card shadow-sm">
                    <div className="card-body">
                        <h2 className="card-title mb-3">Select Topics by Frequency</h2>
                        <p className="text-muted mb-4">
                            Adjust the frequency threshold to select topics related to "{searchTerm}".
                            Topics with higher frequency are more common in related repositories.
                        </p>

                        {isLoading ? (
                            <div className="d-flex justify-content-center align-items-center" style={{ height: "300px" }}>
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mb-4">
                                    <label className="form-label d-flex justify-content-between">
                                        <span>Frequency Threshold</span>
                                        <span>{frequencyThreshold}</span>
                                    </label>
                                    <input
                                        type="range"
                                        className="form-range"
                                        min="0"
                                        max={Math.max(...extractedTopics.map(t => t.count))}
                                        value={frequencyThreshold}
                                        onChange={(e) => setFrequencyThreshold(parseInt(e.target.value))}
                                    />
                                </div>

                                <div className="mb-4" style={{ height: "300px" }}>
                                    {/* Topic Histogram Component */}
                                    <HistogramBars data={extractedTopics} threshold={frequencyThreshold} />
                                </div>

                                <div className="mb-4">
                                    <h3 className="h5 mb-3">Selected Topics ({selectedTopics.length})</h3>
                                    <div className="d-flex flex-wrap gap-2">
                                        {selectedTopics.map(topic => (
                                            <span
                                                key={topic}
                                                className="badge bg-primary rounded-pill py-2 px-3"
                                            >
                                                {topic}
                                            </span>
                                        ))}
                                        {selectedTopics.length === 0 && (
                                            <p className="text-muted fst-italic">No topics selected. Lower the threshold to select topics.</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="d-flex justify-content-between">
                            <button
                                className="btn btn-outline-secondary"
                                onClick={goBackToHome}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={nextStep}
                                disabled={selectedTopics.length === 0}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Topic Refinement with LLM */}
            {currentStep === 2 && (
                <div className="card shadow-sm">
                    <div className="card-body">
                        <h2 className="card-title mb-3">Refine Your Topics</h2>
                        <p className="text-muted mb-4">
                            Use AI suggestions to refine your topics or manually add/remove topics.
                        </p>

                        <div className="row g-4 mb-4">
                            {/* LLM Suggestions */}
                            <div className="col-md-6">
                                <div className="border rounded p-3 h-100">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h3 className="h5 mb-0 d-flex align-items-center">
                                            <FaMagic className="text-warning me-2" />
                                            AI Suggestions
                                        </h3>
                                        <button
                                            className={`btn btn-sm ${isLlmProcessing ? "btn-light disabled" : "btn-outline-primary"}`}
                                            onClick={handleLlmProcess}
                                            disabled={isLlmProcessing}
                                        >
                                            {isLlmProcessing ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    <FaFilter className="me-1" /> Get Suggestions
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {llmSuggestions.length > 0 ? (
                                        <div className="list-group" style={{ maxHeight: "250px", overflowY: "auto" }}>
                                            {llmSuggestions.map(suggestion => (
                                                <div
                                                    key={suggestion}
                                                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                                >
                                                    <span>{suggestion}</span>
                                                    <button
                                                        className="btn btn-sm text-success"
                                                        onClick={() => selectLlmSuggestion(suggestion)}
                                                        disabled={finalTopics.includes(suggestion)}
                                                    >
                                                        {finalTopics.includes(suggestion) ? (
                                                            <FaCheck />
                                                        ) : (
                                                            <FaPlus />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="d-flex flex-column align-items-center justify-content-center text-muted" style={{ height: "200px" }}>
                                            {isLlmProcessing ? (
                                                <p>Analyzing topics...</p>
                                            ) : (
                                                <>
                                                    <FaExclamationCircle className="mb-2" style={{ fontSize: "1.5rem" }} />
                                                    <p>Click "Get Suggestions" to receive AI recommendations</p>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Manual Topic Management */}
                            <div className="col-md-6">
                                <div className="border rounded p-3 h-100">
                                    <h3 className="h5 mb-3 d-flex align-items-center">
                                        <FaEdit className="text-primary me-2" />
                                        Customize Topics
                                    </h3>

                                    <div className="mb-3">
                                        <div className="input-group">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Add a custom topic"
                                                value={newTopic}
                                                onChange={(e) => setNewTopic(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && addNewTopic()}
                                            />
                                            <button
                                                className="btn btn-primary"
                                                onClick={addNewTopic}
                                                disabled={!newTopic}
                                            >
                                                <FaPlus />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                                        <h4 className="h6 mb-2">Final Topics ({finalTopics.length})</h4>
                                        {finalTopics.length > 0 ? (
                                            <div className="list-group">
                                                {finalTopics.map(topic => (
                                                    <div
                                                        key={topic}
                                                        className="list-group-item d-flex justify-content-between align-items-center"
                                                    >
                                                        <span>{topic}</span>
                                                        <button
                                                            className="btn btn-sm text-danger"
                                                            onClick={() => removeTopic(topic)}
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-muted fst-italic">No topics selected yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="d-flex justify-content-between">
                            <button
                                className="btn btn-outline-secondary"
                                onClick={prevStep}
                            >
                                Back
                            </button>
                            <button
                                className={`btn ${finalTopics.length > 0 ? "btn-success" : "btn-light disabled"}`}
                                onClick={handleSubmit}
                                disabled={finalTopics.length === 0}
                            >
                                <FaThumbsUp className="me-1" /> Submit Topics
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default TopicHistogram;