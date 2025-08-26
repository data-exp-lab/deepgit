import cx from "classnames";
import React, { FC, useContext, useState } from "react";
import { FaTimes } from "react-icons/fa";
import Slider from "rc-slider";

import { GraphContext } from "../lib/context";
import { EdgeData } from "../lib/data";
import { DEFAULT_EDGE_COLOR } from "../lib/consts";

const EdgePanel: FC<{ isExpanded: boolean }> = ({ isExpanded }) => {
    const { navState, setNavState, setShowEdgePanel, data, graphFile } = useContext(GraphContext);

    // State for edge creation criteria
    const [topicThreshold, setTopicThreshold] = useState(1); // Start with 1 shared topic as default
    const [contributorThreshold, setContributorThreshold] = useState(1);
    const [stargazerThreshold, setStargazerThreshold] = useState(5);
    const [enableTopicLinking, setEnableTopicLinking] = useState(false);
    const [enableContributorOverlap, setEnableContributorOverlap] = useState(false);
    const [enableSharedOrganization, setEnableSharedOrganization] = useState(false);
    const [enableCommonStargazers, setEnableCommonStargazers] = useState(false);
    const [enableDependencies, setEnableDependencies] = useState(false);

    // Function to remove existing topic-based edges
    const removeExistingTopicEdges = () => {
        if (!data || !data.graph) return 0;

        const { graph } = data;
        const edgesToRemove: string[] = [];

        graph.forEachEdge((edge, attributes) => {
            if (attributes.attributes?.edgeType === 'topic-based') {
                edgesToRemove.push(edge);
            }
        });

        edgesToRemove.forEach(edge => {
            graph.dropEdge(edge);
        });

        console.log(`Removed ${edgesToRemove.length} existing topic-based edges`);
        return edgesToRemove.length;
    };

    // Function to create topic-based edges
    const createTopicBasedEdges = () => {
        if (!data || !data.graph) return;

        const { graph } = data;
        const nodes = graph.nodes();
        const edgesCreated: Array<{ source: string; target: string; sharedTopics: string[] }> = [];

        console.log(`Checking ${nodes.length} nodes for topic-based edges with threshold: ${topicThreshold}`);

        // Get all nodes with their topics and filter out nodes without topics
        const nodeTopics: Record<string, string[]> = {};
        const nodesWithTopics: string[] = [];

        nodes.forEach(nodeId => {
            const nodeData = graph.getNodeAttributes(nodeId);
            const topics = nodeData.attributes?.topics;
            if (topics && typeof topics === 'string') {
                const topicArray = topics.split('|').map(t => t.trim()).filter(Boolean);
                if (topicArray.length > 0) {
                    nodeTopics[nodeId] = topicArray;
                    nodesWithTopics.push(nodeId);
                }
            }
        });

        console.log(`Found ${nodesWithTopics.length} nodes with topics out of ${nodes.length} total nodes`);

        // Early exit if not enough nodes with topics
        if (nodesWithTopics.length < 2) {
            console.log('Not enough nodes with topics to create edges');
            return edgesCreated;
        }

        // Create a reverse index: topic -> list of nodes that have this topic
        const topicToNodes: Record<string, string[]> = {};
        nodesWithTopics.forEach(nodeId => {
            const topics = nodeTopics[nodeId];
            topics.forEach(topic => {
                if (!topicToNodes[topic]) {
                    topicToNodes[topic] = [];
                }
                topicToNodes[topic].push(nodeId);
            });
        });

        // Find nodes that share topics
        const processedPairs = new Set<string>();

        Object.entries(topicToNodes).forEach(([, nodeList]) => {
            // Only process topics that have enough nodes to potentially meet the threshold
            if (nodeList.length >= 2) {
                // Check all pairs of nodes that share this topic
                for (let i = 0; i < nodeList.length; i++) {
                    for (let j = i + 1; j < nodeList.length; j++) {
                        const node1 = nodeList[i];
                        const node2 = nodeList[j];

                        // Create a unique key for this pair to avoid duplicates
                        const pairKey = node1 < node2 ? `${node1}-${node2}` : `${node2}-${node1}`;

                        if (processedPairs.has(pairKey)) continue;
                        processedPairs.add(pairKey);

                        // Find all common topics between these two nodes
                        const topics1 = nodeTopics[node1];
                        const topics2 = nodeTopics[node2];
                        const commonTopics = topics1.filter(t => topics2.includes(t));

                        // Only create edge if we meet the threshold
                        if (commonTopics.length >= topicThreshold) {
                            // Check if edge already exists
                            if (!graph.hasEdge(node1, node2)) {
                                // Create edge attributes
                                const edgeAttributes: EdgeData = {
                                    size: 2,
                                    rawSize: 2,
                                    color: DEFAULT_EDGE_COLOR,
                                    rawColor: DEFAULT_EDGE_COLOR,
                                    label: `Shared topics: ${commonTopics.join(', ')}`,
                                    directed: false,
                                    hidden: false,
                                    type: undefined,
                                    attributes: {
                                        sharedTopics: commonTopics.join('|'),
                                        edgeType: 'topic-based',
                                        topicCount: commonTopics.length
                                    }
                                };

                                // Add undirected edge
                                const edgeKey = `topic_edge_${node1}_${node2}`;
                                graph.addUndirectedEdgeWithKey(edgeKey, node1, node2, edgeAttributes);

                                edgesCreated.push({
                                    source: node1,
                                    target: node2,
                                    sharedTopics: commonTopics
                                });
                            }
                        }
                    }
                }
            }
        });

        console.log(`=== Topic-based edge creation summary ===`);
        console.log(`Threshold: ${topicThreshold} shared topics`);
        console.log(`Nodes with topics: ${nodesWithTopics.length}`);
        console.log(`Edges created: ${edgesCreated.length}`);
        console.log(`========================================`);

        return edgesCreated;
    };

    // Function to update GEXF content with new edges
    const updateGexfContent = (edgesCreated: Array<{ source: string; target: string; sharedTopics: string[] }>) => {
        if (!graphFile || !edgesCreated.length) return;

        // Parse the existing GEXF content
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(graphFile.textContent, "text/xml");

        // Find the graph element
        const graphElement = xmlDoc.querySelector('graph');
        if (!graphElement) return;

        // Add edges to the GEXF
        edgesCreated.forEach((edge) => {
            const edgeElement = xmlDoc.createElement('edge');
            edgeElement.setAttribute('id', `topic_edge_${edge.source}_${edge.target}`);
            edgeElement.setAttribute('source', edge.source);
            edgeElement.setAttribute('target', edge.target);
            edgeElement.setAttribute('weight', '1');

            // Add edge attributes
            const attrsElement = xmlDoc.createElement('attvalues');

            // Shared topics attribute
            const topicAttr = xmlDoc.createElement('attvalue');
            topicAttr.setAttribute('for', 'sharedTopics');
            topicAttr.setAttribute('value', edge.sharedTopics.join('|'));
            attrsElement.appendChild(topicAttr);

            // Shared topics attribute
            const typeAttr = xmlDoc.createElement('attvalue');
            typeAttr.setAttribute('for', 'edgeType');
            typeAttr.setAttribute('value', 'topic-based');
            attrsElement.appendChild(typeAttr);

            edgeElement.appendChild(attrsElement);
            graphElement.appendChild(edgeElement);
        });

        // Convert back to string
        const serializer = new XMLSerializer();
        serializer.serializeToString(xmlDoc);

        // Update the graphFile context by triggering a navState change
        // This will force the graph to refresh
        setNavState({ ...navState, role: navState.role });
    };

    // Handle apply button click
    const handleApplyEdgeCreation = () => {
        if (enableTopicLinking) {
            // First remove any existing topic-based edges
            const removedCount = removeExistingTopicEdges();
            console.log(`Removed ${removedCount} existing topic-based edges`);

            // Then create new edges based on current threshold
            const edgesCreated = createTopicBasedEdges();
            if (edgesCreated && edgesCreated.length > 0) {
                console.log(`Created ${edgesCreated.length} topic-based edges:`, edgesCreated);
                updateGexfContent(edgesCreated);

                // Force graph refresh by updating navState
                setNavState({ ...navState, role: navState.role });
            } else {
                console.log("No new topic-based edges were created");
            }
        }

        // Log all criteria for debugging
        console.log("Creating edges with criteria:", {
            topicThreshold,
            contributorThreshold,
            stargazerThreshold,
            enableTopicLinking,
            enableContributorOverlap,
            enableSharedOrganization,
            enableCommonStargazers,
            enableDependencies
        });
    };



    return (
        <section
            className={cx(
                "side-panel edge-panel d-flex flex-column bg-dark text-white",
                isExpanded ? "expanded" : "collapsed",
            )}
        >
            <div className="panel-content scrollbar-left position-relative">
                <div className="flex-grow-1 p-0 m-0">
                    <div className="editor-block block">
                        <button
                            className="btn btn-outline-light position-absolute"
                            style={{ top: 15, right: 15 }}
                            onClick={() => {
                                setNavState({ ...navState, role: "x" });
                                setShowEdgePanel(false);
                            }}
                        >
                            <FaTimes />
                        </button>

                        <h1 className="fs-4 mt-4 mb-4">
                            <img
                                src={import.meta.env.BASE_URL + "deepgit_logo.png"}
                                alt="DeepGit logo"
                                style={{ height: "1em", filter: "invert(1)" }}
                                className="me-1 mb-1"
                            />
                            Edge Creation
                        </h1>

                        <div className="mb-3">
                            <h3 className="form-label fs-6 mb-3">Configure how edges are automatically created between repositories based on various criteria</h3>
                        </div>

                        {/* Topic Based Linking */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableTopicLinking}
                                    onChange={(e) => setEnableTopicLinking(e.target.checked)}
                                />
                                <label className="form-label mb-0">Topic Based Linking</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                Repositories sharing a number of common topics will be linked
                            </p>
                            {enableTopicLinking && (
                                <div className="ms-4">
                                    <label className="form-label small text-white">
                                        Minimum shared topics: <strong>{topicThreshold}</strong>
                                    </label>
                                    <Slider
                                        value={topicThreshold}
                                        min={1}
                                        max={10}
                                        step={1}
                                        marks={{
                                            1: "1",
                                            5: "5",
                                            10: "10"
                                        }}
                                        onChange={(value) => setTopicThreshold(value as number)}
                                        className="mt-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Contributor Overlap */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableContributorOverlap}
                                    onChange={(e) => setEnableContributorOverlap(e.target.checked)}
                                />
                                <label className="form-label mb-0">Contributor Overlap</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                Repositories will be linked if they share a sufficient number of contributors
                            </p>
                            {enableContributorOverlap && (
                                <div className="ms-4">
                                    <label className="form-label small text-white">
                                        Minimum shared contributors: <strong>{contributorThreshold}</strong>
                                    </label>
                                    <Slider
                                        value={contributorThreshold}
                                        min={1}
                                        max={20}
                                        step={1}
                                        marks={{
                                            1: "1",
                                            5: "5",
                                            10: "10",
                                            20: "20"
                                        }}
                                        onChange={(value) => setContributorThreshold(value as number)}
                                        className="mt-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Shared Organization */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableSharedOrganization}
                                    onChange={(e) => setEnableSharedOrganization(e.target.checked)}
                                />
                                <label className="form-label mb-0">Shared Organization</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                Repositories maintained within the same GitHub organization will be linked. This helps identify repositories that are part of the same project ecosystem or company.
                            </p>
                        </div>

                        {/* Common Stargazers */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableCommonStargazers}
                                    onChange={(e) => setEnableCommonStargazers(e.target.checked)}
                                />
                                <label className="form-label mb-0">Common Stargazers</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                Repositories are linked if they share a sufficient number of stargazers
                            </p>
                            {enableCommonStargazers && (
                                <div className="ms-4">
                                    <label className="form-label small text-white">
                                        Minimum shared stargazers: <strong>{stargazerThreshold}</strong>
                                    </label>
                                    <Slider
                                        value={stargazerThreshold}
                                        min={1}
                                        max={100}
                                        step={5}
                                        marks={{
                                            1: "1",
                                            25: "25",
                                            50: "50",
                                            100: "100"
                                        }}
                                        onChange={(value) => setStargazerThreshold(value as number)}
                                        className="mt-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dependencies */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableDependencies}
                                    onChange={(e) => setEnableDependencies(e.target.checked)}
                                />
                                <label className="form-label mb-0">Dependencies</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                If a repository depends on another, it will be linked (this creates direct edges). This shows the actual dependency relationships between projects, such as when one project imports or uses another.
                            </p>
                        </div>

                        {/* Apply Button */}
                        <div className="mb-3">
                            <button
                                className="btn btn-light w-100 text-center"
                                onClick={handleApplyEdgeCreation}
                            >
                                Apply Edge Creation Rules
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default EdgePanel;
