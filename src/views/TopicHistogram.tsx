import React, { FC, useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { FaArrowLeft, FaCog } from "react-icons/fa";
import { MultiRangeSlider } from "../components/MultiRangeSlider";
import * as d3 from "d3";  // Make sure to install @types/d3 and d3

// import { getErrorMessage } from "../lib/errors";
import { useNotifications } from "../lib/notifications";
import { TopicRefiner } from "../components/TopicRefiner";
import { API_ENDPOINTS } from '../lib/config';

// Topic Histogram Component
interface TopicHistogramProps {
    data: Array<{ name: string; count: number }>;
    range: { min: number; max: number };
}

// Rename to HistogramBars to avoid conflict
const HistogramBars: FC<TopicHistogramProps & { highlightedTopic?: string }> = ({ data, range, highlightedTopic }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.length) return;

        // Filter data to only include topics within the range (plus a small buffer)
        const buffer = Math.max(5, Math.floor((range.max - range.min) * 0.1)); // 10% buffer or at least 5
        const filteredData = data.filter(d =>
            d.count >= Math.max(0, range.min - buffer) &&
            d.count <= range.max + buffer
        ).sort((a, b) => a.count - b.count);

        // Clear previous content
        d3.select(svgRef.current).selectAll("*").remove();

        // Set dimensions with more bottom margin for labels
        const margin = { top: 15, right: 20, bottom: 80, left: 40 };
        const width = svgRef.current.clientWidth - margin.left - margin.right;
        const height = 250 - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(svgRef.current)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Create scales using filtered data
        const x = d3.scaleBand()
            .range([0, width])
            .padding(0.1)
            .domain(filteredData.map(d => d.name));

        const y = d3.scaleLinear()
            .range([height, 0])
            .domain([0, d3.max(filteredData, d => d.count) || 0]);

        // Add background highlight for selected range
        const minX = x(filteredData.find(d => d.count >= range.min)?.name || "") || 0;
        const maxX = x(filteredData.findLast(d => d.count <= range.max)?.name || "") || 0;
        svg.append("rect")
            .attr("x", minX)
            .attr("width", maxX - minX + x.bandwidth())
            .attr("y", 0)
            .attr("height", height)
            .attr("fill", "#e9ecef")
            .attr("opacity", 0.3);

        // Create and add bars using filtered data
        svg.selectAll(".bar")
            .data(filteredData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.name) || 0)
            .attr("width", x.bandwidth())
            .attr("y", d => y(d.count))
            .attr("height", d => height - y(d.count))
            .attr("fill", d => {
                if (highlightedTopic === d.name) return '#ffc107'; // Highlight color
                return (d.count >= range.min && d.count <= range.max) ? '#0d6efd' : '#adb5bd';
            })
            .attr("opacity", d => highlightedTopic && highlightedTopic !== d.name ? 0.5 : 1)
            .on("mouseover", (event, d) => {
                // Show tooltip
                const tooltip = svg.append("g")
                    .attr("class", "tooltip")
                    .attr("transform", `translate(${x(d.name) || 0},${y(d.count) - 20})`);

                tooltip.append("text")
                    .attr("x", x.bandwidth() / 2)
                    .attr("y", 0)
                    .attr("text-anchor", "middle")
                    .style("font-size", "12px")
                    .text(`${d.name}: ${d.count}`);
            })
            .on("mouseout", () => {
                // Remove tooltip
                svg.selectAll(".tooltip").remove();
            });

        // Add count labels on top of bars
        svg.selectAll(".count-label")
            .data(filteredData)
            .enter()
            .append("text")
            .attr("class", "count-label")
            .attr("x", d => (x(d.name) || 0) + x.bandwidth() / 2)
            .attr("y", d => y(d.count) - 5)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("fill", "#6c757d")
            .text(d => d.count);

        // Add y-axis
        svg.append("g")
            .call(d3.axisLeft(y).ticks(5));

        // Add x-axis with rotated labels
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "end")
            .style("font-size", "14px")
            .style("font-weight", "500")
            .attr("dx", "-1em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)")
            .style("display", (d, i) => {
                // If we have 30 or more items, only show every nth label
                if (filteredData.length >= 30) {
                    const n = Math.ceil(filteredData.length / 30); // Calculate how many items to skip
                    return i % n === 0 ? "block" : "none";
                }
                return "block";
            });

        // Add range indicator text below the histogram
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom + 80)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .style("fill", "#6c757d")
            .text(`Showing topics with frequency ${range.min} - ${range.max} (plus buffer)`);

    }, [data, range, highlightedTopic]);

    return (
        <div style={{ width: '100%', height: '400px', padding: '0' }}>
            <svg ref={svgRef} style={{ width: '100%', height: '100%' }}></svg>
        </div>
    );
};

const TopicHistogram: FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { notify } = useNotifications();

    // Get both search term and user topic from location state
    const searchTerm = (location.state as { searchTerm?: string } | undefined)?.searchTerm || "";
    const userTopic = (location.state as { userTopic?: string } | undefined)?.userTopic || "";

    // Add state for storing the user topic
    const [originalTopic, setOriginalTopic] = useState(userTopic);

    // State for the current step in the wizard
    const [currentStep, setCurrentStep] = useState(1);

    // State for extracted topics and their frequencies
    const [extractedTopics, setExtractedTopics] = useState<Array<{ name: string; count: number }>>([]);

    // State for selected topics
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

    // State for frequency range
    const [frequencyRange, setFrequencyRange] = useState({ min: 0, max: 1 });
    const [hasAdjustedRange, setHasAdjustedRange] = useState(false);
    const maxCount = Math.max(...extractedTopics.map(item => item.count || 0), 1);

    // Update frequency range when maxCount changes, but only if it hasn't been adjusted yet
    useEffect(() => {
        if (!hasAdjustedRange) {
            setFrequencyRange({ min: 0, max: 1 });  // Keep it at 0-1 until user adjusts
        }
    }, [maxCount, hasAdjustedRange]);

    // State for final topics
    const [finalTopics, setFinalTopics] = useState<string[]>([]);
    const [newTopic, setNewTopic] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [highlightedTopic, setHighlightedTopic] = useState<string | undefined>();
    const [selectedTopicForExplanation, setSelectedTopicForExplanation] = useState<string | null>(null);
    const [topicExplanation, setTopicExplanation] = useState<string>("");
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

    // State for API key
    const [apiKey, setApiKey] = useState<string>('');

    // Add API key input modal - initialize to false instead of !apiKey
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);

    // Add state for AI suggestions
    const [llmSuggestionsState, setLlmSuggestionsState] = useState<string[]>([]);
    const [isLlmProcessing, setIsLlmProcessing] = useState(false);

    // Function to handle topic click
    const handleTopicClick = (topic: string) => {
        console.log('Topic clicked:', topic);
        console.log('Current API key:', apiKey ? 'Present' : 'Missing');

        if (!apiKey) {
            console.log('No API key, showing modal');
            // Show API key modal if no key is set
            setShowApiKeyModal(true);
            return;
        }

        console.log('Starting explanation fetch for topic:', topic);
        // Show explanation modal immediately with loading state
        setSelectedTopicForExplanation(topic);
        setTopicExplanation("");  // Clear previous explanation
        setIsLoadingExplanation(true);  // Set loading state
        // Then fetch the explanation
        fetchTopicExplanation(topic);
    };

    // Function to save API key and fetch explanation if a topic was clicked
    const saveApiKey = (key: string) => {
        setApiKey(key);
        setShowApiKeyModal(false);

        // If there was a topic waiting for explanation, fetch it now
        if (selectedTopicForExplanation) {
            fetchTopicExplanation(selectedTopicForExplanation);
        }
    };

    // Effect to check if search term and topic are provided
    useEffect(() => {
        if (!searchTerm || !userTopic) {
            notify({
                message: "No search term provided. Please enter a topic to search.",
                type: "warning"
            });
            navigate('/');
        } else {
            setOriginalTopic(userTopic);
        }
    }, [searchTerm, userTopic, navigate, notify]);

    // Effect to handle topic extraction when search term changes
    useEffect(() => {
        // Add a check for extractedTopics length to prevent refetching
        if (!userTopic || extractedTopics.length > 0) return;

        setIsLoading(true);

        fetch(API_ENDPOINTS.PROCESS_TOPICS, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                topic: userTopic,
                searchTerm: searchTerm
            })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success && data.data.length === 0) {
                    notify({
                        message: "No topics found for this search. Try a different topic.",
                        type: "warning"
                    });
                }
                setExtractedTopics(data.data || []);
            })
            .catch(error => {
                console.error('Fetch error:', error);
                notify({
                    message: "Failed to fetch topics. Please try again.",
                    type: "error"
                });
                setExtractedTopics([]);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [userTopic]);

    // Effect to update selected topics based on frequency range
    useEffect(() => {
        if (extractedTopics.length > 0) {
            setSelectedTopics(
                extractedTopics
                    .filter(topic => topic.count >= frequencyRange.min && topic.count <= frequencyRange.max)
                    .map(topic => topic.name)
            );
        }
    }, [frequencyRange, extractedTopics]);

    // Function to handle form submission for the final step
    const handleSubmit = () => {
        navigate('/graph', { state: { topics: finalTopics } });
    };

    // Function to move to the next step
    const nextStep = () => {
        if (currentStep === 1) {
            setFinalTopics(selectedTopics);
        }
        setCurrentStep(prev => Math.min(prev + 1, 2));
        // Scroll to the main content/card after step change
        setTimeout(() => {
            const main = document.querySelector('main');
            if (main) main.scrollIntoView({ behavior: 'smooth' });
        }, 0);
    };

    // Function to move to the previous step
    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    // Function to go back to home
    const goBackToHome = () => {
        window.location.href = '/';  // Direct browser navigation
        // Alternative: window.location.replace('/');
    };

    // Function to fetch topic explanation
    const fetchTopicExplanation = async (topic: string) => {
        console.log('Fetching explanation for topic:', topic);
        if (!apiKey) {
            console.log('No API key in fetchTopicExplanation');
            notify({
                message: "Please set your Google API key first",
                type: "warning"
            });
            setSelectedTopicForExplanation(null);  // Close modal if no API key
            return;
        }

        try {
            console.log('Making API request to:', API_ENDPOINTS.EXPLAIN_TOPIC);
            const response = await fetch(API_ENDPOINTS.EXPLAIN_TOPIC, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    topic: topic,
                    searchTerm: searchTerm,
                    originalTopic: originalTopic,
                    apiKey: apiKey
                })
            });

            console.log('Response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Response data:', data);
            if (data.success) {
                setTopicExplanation(data.explanation);
            } else {
                throw new Error(data.message || 'Failed to get explanation');
            }
        } catch (error) {
            console.error('Error fetching explanation:', error);
            notify({
                message: "Failed to get topic explanation. Please try again.",
                type: "error"
            });
            setTopicExplanation("Sorry, I couldn't generate an explanation for this topic at the moment.");
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    // Function to close the explanation modal
    const closeExplanationModal = () => {
        setSelectedTopicForExplanation(null);
        setTopicExplanation("");
    };

    // Function to handle AI suggestions request
    const handleRequestSuggestions = async (model: string, prompt: string, apiKey: string, topics: string[]) => {
        setIsLlmProcessing(true);
        try {
            console.log('Requesting AI suggestions with:', { model, prompt, apiKey, topics });
            const response = await fetch(API_ENDPOINTS.AI_PROCESS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    selectedModel: model,
                    customPrompt: prompt,
                    apiKey: apiKey,
                    selectedTopics: topics,
                    searchTerm: searchTerm
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received AI suggestions:', data);

            if (data.success && Array.isArray(data.result)) {
                setLlmSuggestionsState(data.result);
            } else {
                throw new Error('Invalid response format from AI service');
            }
        } catch (error) {
            console.error('Error getting AI suggestions:', error);
            notify({
                message: "Failed to get AI suggestions. Please try again.",
                type: "error"
            });
            setLlmSuggestionsState([]);
        } finally {
            setIsLlmProcessing(false);
        }
    };

    return (
        <main className="container-fluid py-4" style={{ height: '100vh', overflowY: 'auto' }}>
            {/* API Key Modal */}
            {showApiKeyModal && (
                <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Google Gemini API Key Required</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => {
                                        setShowApiKeyModal(false);
                                        setSelectedTopicForExplanation(null);
                                    }}
                                    aria-label="Close"
                                />
                            </div>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <label htmlFor="apiKey" className="form-label">Google Gemini API Key</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        id="apiKey"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter your Google Gemini API key"
                                    />
                                    <div className="form-text">
                                        Your Google Gemini API key is required to get topic explanations. It is stored locally in your browser and is never shared with our servers.
                                        <br />
                                        <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer">
                                            Get your API key from Google AI Studio
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setShowApiKeyModal(false);
                                        setSelectedTopicForExplanation(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => saveApiKey(apiKey)}
                                    disabled={!apiKey}
                                >
                                    Save & Continue
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header container to match card width */}
            {currentStep === 1 && (
                <div className="mx-auto" style={{ maxWidth: '90%' }}>
                    <div className="d-flex align-items-center justify-content-between mb-4">
                        {/* Left side with back button and titles */}
                        <div className="d-flex align-items-center">
                            <button
                                className="btn btn-outline-secondary me-3"
                                onClick={goBackToHome}
                                style={{ borderRadius: "50%", width: "40px", height: "40px", padding: "0" }}
                            >
                                <FaArrowLeft className="m-auto" />
                            </button>
                            <div>
                                <h1 className="mb-0">Topic-Centric Filtering</h1>
                                {currentStep === 1 && (
                                    <h2 className="h5 text-muted mb-0 mt-1">Select Topics by Frequency</h2>
                                )}
                                {currentStep === 2 && (
                                    <h2 className="h5 text-muted mb-0 mt-1">Refine Your Topics</h2>
                                )}
                            </div>
                        </div>

                        {/* Right side with step indicator */}
                        <div className="d-flex align-items-center gap-4">
                            {/* Step numbers with connecting line */}
                            <div className="d-flex align-items-center gap-2 position-relative">
                                <div
                                    className={`rounded-circle d-flex align-items-center justify-content-center text-dark ${currentStep >= 1 ? "bg-primary text-white" : "bg-secondary-subtle"}`}
                                    style={{ width: "32px", height: "32px", zIndex: 1 }}
                                >
                                    1
                                </div>
                                {/* Connecting line */}
                                <div
                                    style={{
                                        width: "40px",
                                        height: "2px",
                                        backgroundColor: currentStep >= 2 ? "#0d6efd" : "#adb5bd",
                                        transition: "background-color 0.3s ease"
                                    }}
                                />
                                <div
                                    className={`rounded-circle d-flex align-items-center justify-content-center text-dark ${currentStep >= 2 ? "bg-primary text-white" : "bg-secondary-subtle"}`}
                                    style={{ width: "32px", height: "32px", zIndex: 1 }}
                                >
                                    2
                                </div>
                            </div>

                            {/* Step counter */}
                            <div className="text-muted">
                                Step {currentStep} of 2
                            </div>

                            <button
                                className="btn btn-outline-secondary"
                                onClick={() => setShowApiKeyModal(true)}
                                style={{
                                    borderRadius: "50%",
                                    width: "40px",
                                    height: "40px",
                                    padding: "0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                                title={apiKey ? 'Change Gemini API Key' : 'Set Gemini API Key'}
                            >
                                <FaCog className="m-auto" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step labels */}
            {/* <div className="d-flex gap-4 mb-4">
                <span className={currentStep === 1 ? "text-primary" : "text-muted"}>
                    Select by Frequency
                </span>
                <span className={currentStep === 2 ? "text-primary" : "text-muted"}>
                    Refine Topics
                </span>
            </div> */}

            {/* Step 1: Topic Frequency Selection */}
            {currentStep === 1 && (
                <div className="card shadow-sm mx-auto" style={{ minHeight: 'auto', display: 'flex', flexDirection: 'column', maxWidth: '90%' }}>
                    <div className="card-body d-flex flex-column">
                        <p className="text-muted mb-4">
                            Adjust the frequency range to select topics related to{" "}
                            <span className="badge bg-primary" style={{ fontSize: '1rem' }}>
                                {originalTopic}
                            </span>
                            &nbsp;Topics with higher frequency are more common in related repositories.
                        </p>

                        {isLoading ? (
                            <div className="d-flex justify-content-center align-items-center" style={{ height: "300px" }}>
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-grow-1">
                                <div className="mb-4">
                                    <label className="form-label">Frequency Range</label>
                                    <div style={{ width: '80%' }}>
                                        <MultiRangeSlider
                                            min={0}
                                            max={maxCount}
                                            onChange={({ min, max }) => {
                                                setFrequencyRange({ min, max });
                                                setHasAdjustedRange(true);
                                            }}
                                            value={frequencyRange}
                                        />
                                    </div>
                                </div>

                                {hasAdjustedRange && (
                                    <div>
                                        <HistogramBars
                                            data={extractedTopics}
                                            range={frequencyRange}
                                            highlightedTopic={highlightedTopic}
                                        />
                                    </div>
                                )}

                                {!hasAdjustedRange && (
                                    <div className="text-center text-muted" style={{ height: "350px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <p>Adjust the frequency range slider above to view the topic distribution</p>
                                    </div>
                                )}

                                <div style={{ marginTop: '-10px' }}>
                                    <h3 className="h5 mb-2">Selected Topics ({selectedTopics.length})</h3>
                                    <div
                                        className="d-flex flex-wrap gap-2"
                                        style={{
                                            maxHeight: '150px',
                                            overflowY: 'auto',
                                            padding: '8px',
                                            border: '1px solid #dee2e6',
                                            borderRadius: '8px'
                                        }}
                                    >
                                        {selectedTopics.map(topic => (
                                            <span
                                                key={topic}
                                                className="badge rounded-pill py-2 px-3"
                                                style={{
                                                    fontSize: '1rem',
                                                    backgroundColor: highlightedTopic === topic ? '#ffc107' : '#198754',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={() => setHighlightedTopic(topic)}
                                                onMouseLeave={() => setHighlightedTopic(undefined)}
                                                onClick={() => handleTopicClick(topic)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        handleTopicClick(topic);
                                                    }
                                                }}
                                            >
                                                {topic}
                                            </span>
                                        ))}
                                        {selectedTopics.length === 0 && (
                                            <p className="text-muted fst-italic">
                                                No topics selected. Adjust the frequency range to select topics.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Topic Explanation Modal */}
                                {selectedTopicForExplanation && (
                                    <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                                        <div className="modal-dialog modal-dialog-centered">
                                            <div className="modal-content">
                                                <div className="modal-header">
                                                    <h5 className="modal-title">
                                                        Topic Explanation: {selectedTopicForExplanation}
                                                    </h5>
                                                    <button
                                                        type="button"
                                                        className="btn-close"
                                                        onClick={closeExplanationModal}
                                                        aria-label="Close"
                                                    />
                                                </div>
                                                <div className="modal-body">
                                                    {isLoadingExplanation ? (
                                                        <div className="d-flex justify-content-center align-items-center py-4">
                                                            <div className="spinner-border text-primary" role="status">
                                                                <span className="visually-hidden">Loading explanation...</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-3">
                                                            <p className="mb-0">{topicExplanation}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="modal-footer">
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={closeExplanationModal}
                                                    >
                                                        Close
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="d-flex justify-content-between mt-auto pt-4">
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

            {/* Step 2: Topic Refinement */}
            {currentStep === 2 && (
                <TopicRefiner
                    llmSuggestions={llmSuggestionsState}
                    setLlmSuggestions={setLlmSuggestionsState}
                    onRequestSuggestions={handleRequestSuggestions}
                    selectedTopics={selectedTopics}
                    setSelectedTopics={setSelectedTopics}
                    newTopic=""
                    setNewTopic={() => { }}
                    prevStep={prevStep}
                    handleSubmit={handleSubmit}
                    searchTerm={searchTerm}
                />
            )}
            {/* {console.log(onRequestSuggestions)} */}
        </main>
    );
};

export default TopicHistogram;
