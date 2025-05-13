import React, { FC, useEffect, useRef } from "react";
import * as d3 from "d3";

interface HistogramBarsProps {
    data: Array<{ name: string; count: number }>;
    range: { min: number; max: number };
    highlightedTopic?: string;
}

export const HistogramBars: FC<HistogramBarsProps> = ({ data, range, highlightedTopic }) => {
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