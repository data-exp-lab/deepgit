import React, { FC, useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { FaArrowLeft, FaPlus, FaTimes, FaFilter, FaMagic, FaEdit, FaCheck, FaExclamationCircle, FaThumbsUp } from "react-icons/fa";
import { MultiRangeSlider } from "../components/MultiRangeSlider";
import * as d3 from "d3";  // Make sure to install @types/d3 and d3

// import { getErrorMessage } from "../lib/errors";
import { useNotifications } from "../lib/notifications";
import { FrequencySelector } from "../components/FrequencySelector";
import { TopicRefiner } from "../components/TopicRefiner";

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
    range: { min: number; max: number };
}

// Rename to HistogramBars to avoid conflict
const HistogramBars: FC<TopicHistogramProps & { highlightedTopic?: string }> = ({ data, range, highlightedTopic }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.length) return;

        // Clear previous content
        d3.select(svgRef.current).selectAll("*").remove();

        // Set dimensions with more bottom margin for labels
        const margin = { top: 30, right: 20, bottom: 100, left: 40 };
        const width = svgRef.current.clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(svgRef.current)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Create scales
        const x = d3.scaleBand()
            .range([0, width])
            .padding(0.1)
            .domain(data.map(d => d.name));

        const y = d3.scaleLinear()
            .range([height, 0])
            .domain([0, d3.max(data, d => d.count) || 0]);

        // Create and add bars
        svg.selectAll(".bar")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.name) || 0)
            .attr("width", x.bandwidth())
            .attr("y", d => y(d.count))
            .attr("height", d => height - y(d.count))
            .attr("fill", d => {
                if (highlightedTopic === d.name) return '#ffc107'; // Highlight color
                return (d.count >= range.min && d.count <= range.max) ? '#0d6efd' : '#e9ecef';
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
            .data(data)
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
            .attr("transform", "rotate(-45)");

    }, [data, range, highlightedTopic]);

    return (
        <div style={{ width: '100%', height: '400px', padding: '10px' }}>
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
    console.log("userTopic", userTopic);

    // Add state for storing the user topic
    const [originalTopic, setOriginalTopic] = useState(userTopic);

    // State for the current step in the wizard
    const [currentStep, setCurrentStep] = useState(1);

    // State for extracted topics and their frequencies
    const [extractedTopics, setExtractedTopics] = useState<Array<{ name: string; count: number }>>([]);

    // State for selected topics
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

    // State for frequency range
    const [frequencyRange, setFrequencyRange] = useState({ min: 0, max: 100 });
    const maxCount = Math.max(...extractedTopics.map(item => item.count), 1);

    // Update frequency range when maxCount changes
    useEffect(() => {
        setFrequencyRange({ min: 0, max: maxCount });
    }, [maxCount]);

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

    // State for highlighted topic
    const [highlightedTopic, setHighlightedTopic] = useState<string | undefined>();

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
        window.location.href = '/';  // Direct browser navigation
        // Alternative: window.location.replace('/');
    };

    return (
        <main className="container py-4">
            {/* Header with back button, title, and step indicator all in one line */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                {/* Left side with back button and title */}
                <div className="d-flex align-items-center">
                    <button
                        className="btn btn-outline-secondary me-3"
                        onClick={goBackToHome}
                        style={{ borderRadius: "50%", width: "40px", height: "40px", padding: "0" }}
                    >
                        <FaArrowLeft className="m-auto" />
                    </button>
                    <h1 className="mb-0">Topic-Centric Filtering</h1>
                </div>

                {/* Right side with step indicator */}
                <div className="d-flex align-items-center gap-4">
                    {/* Step numbers */}
                    <div className="d-flex align-items-center gap-2">
                        <div className={`rounded-circle d-flex align-items-center justify-content-center ${currentStep >= 1 ? "bg-primary text-white" : "bg-light"
                            }`} style={{ width: "32px", height: "32px" }}>
                            1
                        </div>
                        <div className={`rounded-circle d-flex align-items-center justify-content-center ${currentStep >= 2 ? "bg-primary text-white" : "bg-light"
                            }`} style={{ width: "32px", height: "32px" }}>
                            2
                        </div>
                    </div>

                    {/* Step counter */}
                    <div className="text-muted">
                        Step {currentStep} of 2
                    </div>
                </div>
            </div>

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
                <div className="card shadow-sm" style={{ minHeight: '800px', display: 'flex', flexDirection: 'column' }}>
                    <div className="card-body d-flex flex-column">
                        <h2 className="card-title mb-3">Select Topics by Frequency</h2>
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
                                            onChange={({ min, max }) => setFrequencyRange({ min, max })}
                                            value={frequencyRange}
                                        />
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <HistogramBars
                                        data={extractedTopics}
                                        range={frequencyRange}
                                        highlightedTopic={highlightedTopic}
                                    />
                                </div>

                                <div>
                                    <h3 className="h5 mb-2">Selected Topics ({selectedTopics.length})</h3>
                                    <div className="d-flex flex-wrap gap-2">
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

            {/* Step 2: Topic Refinement with LLM */}
            {currentStep === 2 && (
                <TopicRefiner
                    isLlmProcessing={isLlmProcessing}
                    handleLlmProcess={handleLlmProcess}
                    llmSuggestions={llmSuggestions}
                    finalTopics={finalTopics}
                    selectLlmSuggestion={selectLlmSuggestion}
                    newTopic={newTopic}
                    setNewTopic={setNewTopic}
                    addNewTopic={addNewTopic}
                    removeTopic={removeTopic}
                    prevStep={prevStep}
                    handleSubmit={handleSubmit}
                />
            )}
        </main>
    );
};

export default TopicHistogram;