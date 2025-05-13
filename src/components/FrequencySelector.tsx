import React, { FC } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { MultiRangeSlider } from "./MultiRangeSlider";
import { HistogramBars } from "./HistogramBars";  // We'll also need to separate this

interface FrequencySelectorProps {
    isLoading: boolean;
    originalTopic: string;
    maxCount: number;
    frequencyRange: { min: number; max: number };
    setFrequencyRange: (range: { min: number; max: number }) => void;
    extractedTopics: Array<{ name: string; count: number }>;
    selectedTopics: string[];
    highlightedTopic?: string;
    setHighlightedTopic: (topic: string | undefined) => void;
    goBackToHome: () => void;
    nextStep: () => void;
}

export const FrequencySelector: FC<FrequencySelectorProps> = ({
    isLoading,
    originalTopic,
    maxCount,
    frequencyRange,
    setFrequencyRange,
    extractedTopics,
    selectedTopics,
    highlightedTopic,
    setHighlightedTopic,
    goBackToHome,
    nextStep
}) => {
    return (
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
    );
}; 