"use client"

import React, { FC } from 'react'

interface KeywordFrequency {
    keyword: string
    frequency: number
}

interface TopicHistogramProps {
    keywords: KeywordFrequency[]
    threshold: number
}

export function TopicHistogram({ keywords, threshold }: TopicHistogramProps) {
    // Find the maximum count for scaling
    const maxCount = Math.max(...keywords.map((item) => item.frequency), 1)

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 flex items-end">
                {keywords.map((item, index) => {
                    const height = `${(item.frequency / maxCount) * 100}%`
                    const isSelected = item.frequency >= threshold

                    return (
                        <div key={index} className="flex flex-col items-center flex-1" style={{ minWidth: "40px" }}>
                            <div
                                className={`w-8 ${isSelected ? "bg-blue-500" : "bg-gray-300"} rounded-t transition-all duration-300`}
                                style={{ height }}
                            ></div>
                            <div className="w-full text-center mt-2">
                                <div className="text-xs text-gray-600 font-medium">{item.frequency}</div>
                                <div
                                    className="text-xs truncate max-w-full px-1"
                                    style={{ transform: "rotate(-45deg)", transformOrigin: "left top", whiteSpace: "nowrap" }}
                                >
                                    {item.keyword}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Threshold line */}
            <div className="relative h-0">
                <div
                    className="absolute w-full border-t-2 border-red-500 border-dashed flex items-center justify-end"
                    style={{
                        bottom: `${(threshold / maxCount) * 100}%`,
                        transform: "translateY(-100%)",
                    }}
                >
                    <span className="bg-white text-red-500 text-xs px-1 -mt-3 mr-2 rounded">Threshold: {threshold}</span>
                </div>
            </div>
        </div>
    )
}

const FrequencyView: FC = () => {
    // Example data - replace with your actual data source
    const sampleData: KeywordFrequency[] = [
        { keyword: "react", frequency: 100 },
        { keyword: "typescript", frequency: 80 },
        { keyword: "javascript", frequency: 60 },
        { keyword: "node", frequency: 40 },
    ];

    return (
        <div className="container mx-auto p-4" style={{ height: "600px" }}>
            <h1 className="text-2xl mb-4">Keyword Frequency Analysis</h1>
            <TopicHistogram keywords={sampleData} threshold={50} />
        </div>
    );
};

export default FrequencyView;
