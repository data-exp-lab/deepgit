import cx from "classnames";
import React, { FC, useContext, useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import Slider from "rc-slider";

import { GraphContext } from "../lib/context";
import { useNotifications } from "../lib/notifications";

const EdgePanel: FC<{ isExpanded: boolean }> = ({ isExpanded }) => {
    const { navState, setNavState, setShowEdgePanel, data, graphFile, computedData, setData } = useContext(GraphContext);
    const { notify } = useNotifications();

    // State for edge creation criteria - use navState values if available, otherwise defaults
    const [topicThreshold, setTopicThreshold] = useState(navState.edgeCreationTopicThreshold || 2);
    const [contributorThreshold, setContributorThreshold] = useState(navState.edgeCreationContributorThreshold || 1);
    const [stargazerThreshold, setStargazerThreshold] = useState(navState.edgeCreationStargazerThreshold || 5);
    const [enableTopicLinking, setEnableTopicLinking] = useState(navState.edgeCreationEnableTopicLinking || false);
    const [enableContributorOverlap, setEnableContributorOverlap] = useState(navState.edgeCreationEnableContributorOverlap || false);
    const [enableSharedOrganization, setEnableSharedOrganization] = useState(navState.edgeCreationEnableSharedOrganization || false);
    const [enableCommonStargazers, setEnableCommonStargazers] = useState(navState.edgeCreationEnableCommonStargazers || false);
    const [enableDependencies, setEnableDependencies] = useState(navState.edgeCreationEnableDependencies || false);
    const [isLoading, setIsLoading] = useState(false);

    // Sync local state with navState when navState changes
    useEffect(() => {
        if (navState.edgeCreationTopicThreshold !== undefined) {
            setTopicThreshold(navState.edgeCreationTopicThreshold);
        }
        if (navState.edgeCreationContributorThreshold !== undefined) {
            setContributorThreshold(navState.edgeCreationContributorThreshold);
        }
        if (navState.edgeCreationStargazerThreshold !== undefined) {
            setStargazerThreshold(navState.edgeCreationStargazerThreshold);
        }
        if (navState.edgeCreationEnableTopicLinking !== undefined) {
            setEnableTopicLinking(navState.edgeCreationEnableTopicLinking);
        }
        if (navState.edgeCreationEnableContributorOverlap !== undefined) {
            setEnableContributorOverlap(navState.edgeCreationEnableContributorOverlap);
        }
        if (navState.edgeCreationEnableSharedOrganization !== undefined) {
            setEnableSharedOrganization(navState.edgeCreationEnableSharedOrganization);
        }
        if (navState.edgeCreationEnableCommonStargazers !== undefined) {
            setEnableCommonStargazers(navState.edgeCreationEnableCommonStargazers);
        }
        if (navState.edgeCreationEnableDependencies !== undefined) {
            setEnableDependencies(navState.edgeCreationEnableDependencies);
        }
    }, [navState]);

    // Wrapper functions to update both local state and navState
    const updateTopicThreshold = (value: number) => {
        setTopicThreshold(value);
        const newNavState = {
            ...navState,
            edgeCreationTopicThreshold: value,
        };
        setNavState(newNavState);
    };

    const updateContributorThreshold = (value: number) => {
        setContributorThreshold(value);
        setNavState({
            ...navState,
            edgeCreationContributorThreshold: value,
        });
    };

    const updateStargazerThreshold = (value: number) => {
        setStargazerThreshold(value);
        setNavState({
            ...navState,
            edgeCreationStargazerThreshold: value,
        });
    };

    const updateEnableTopicLinking = (checked: boolean) => {
        setEnableTopicLinking(checked);
        setNavState({
            ...navState,
            edgeCreationEnableTopicLinking: checked,
        });
    };

    const updateEnableContributorOverlap = (checked: boolean) => {
        setEnableContributorOverlap(checked);
        setNavState({
            ...navState,
            edgeCreationEnableContributorOverlap: checked,
        });
    };

    const updateEnableSharedOrganization = (checked: boolean) => {
        setEnableSharedOrganization(checked);
        setNavState({
            ...navState,
            edgeCreationEnableSharedOrganization: checked,
        });
    };

    const updateEnableCommonStargazers = (checked: boolean) => {
        setEnableCommonStargazers(checked);
        setNavState({
            ...navState,
            edgeCreationEnableCommonStargazers: checked,
        });
    };

    const updateEnableDependencies = (checked: boolean) => {
        setEnableDependencies(checked);
        setNavState({
            ...navState,
            edgeCreationEnableDependencies: checked,
        });
    }

    // Function to restore original graph without edges - OPTIMIZED
    const restoreOriginalGraph = async (): Promise<void> => {
        try {
            // Quick toggle: just remove all edges from current graph
            if (data && data.graph) {
                const currentGraph = data.graph;

                // Remove all edges
                const edges = currentGraph.edges();
                for (let i = 0; i < edges.length; i++) {
                    currentGraph.dropEdge(edges[i]);
                }

                // Update the graph context to reflect no edges
                const newNavState = {
                    ...navState,
                    role: navState.role,
                    nodeSizeField: undefined, // Reset to default sizing
                    // Save current edge creation conditions
                    edgeCreationTopicThreshold: topicThreshold,
                    edgeCreationContributorThreshold: contributorThreshold,
                    edgeCreationStargazerThreshold: stargazerThreshold,
                    edgeCreationEnableTopicLinking: enableTopicLinking,
                    edgeCreationEnableContributorOverlap: enableContributorOverlap,
                    edgeCreationEnableSharedOrganization: enableSharedOrganization,
                    edgeCreationEnableCommonStargazers: enableCommonStargazers,
                    edgeCreationEnableDependencies: enableDependencies,
                };
                setNavState(newNavState);

                // Notify user of success
                notify({
                    message: "All edges removed from graph",
                    type: "success"
                });

                // Notify user that node sizing has been reset
                if (navState.nodeSizeField === "pagerank") {
                    notify({
                        message: "Node sizing has been reset to default since edges were removed.",
                        type: "info"
                    });
                }
            } else {
                throw new Error("No graph data available");
            }

        } catch (error) {
            console.error('Error removing edges:', error);
            notify({
                message: "Failed to remove edges. Please refresh the page.",
                type: "error"
            });
        }
    };

    // Function to call backend API for edge creation
    const createEdgesViaBackend = async (): Promise<void> => {
        if (!data || !data.graph || !graphFile) {
            notify({
                message: "No graph data available",
                type: "error"
            });
            return;
        }

        setIsLoading(true);

        try {
            // Count how many criteria are enabled
            const enabledCriteria = [
                enableTopicLinking,
                enableSharedOrganization,
                enableContributorOverlap,
                enableCommonStargazers
            ].filter(Boolean).length;

            if (enabledCriteria === 0) {
                // Restore original graph without edges
                await restoreOriginalGraph();
                return;
            }

            // Always start from the original graph file (without edges)
            const originalGexfContent = graphFile.textContent;

            // Prepare criteria configuration
            const criteriaConfig = {
                topic_based_linking: enableTopicLinking,
                topic_threshold: topicThreshold,
                contributor_overlap_enabled: enableContributorOverlap,
                contributor_threshold: contributorThreshold,
                shared_organization_enabled: enableSharedOrganization,
                common_stargazers_enabled: enableCommonStargazers,
                stargazer_threshold: stargazerThreshold,
                use_and_logic: enabledCriteria > 1 // Use AND logic if multiple criteria enabled
            };

            // Call backend API with original graph
            const response = await fetch('http://127.0.0.1:5002/api/create-edges-on-graph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gexfContent: originalGexfContent,
                    criteria_config: criteriaConfig
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
                throw new Error(errorMessage);
            }

            const result = await response.json();

            if (result.success) {
                // Update the graph with new GEXF content
                if (result.gexfContent && graphFile) {
                    // Import the necessary functions to reload the graph
                    const { readGraph, prepareGraph, enrichData } = await import('../lib/data');

                    try {
                        // Reload the graph with the new content
                        const rawGraph = await readGraph({
                            name: graphFile.name,
                            extension: graphFile.extension,
                            textContent: result.gexfContent
                        });

                        if (!rawGraph) {
                            throw new Error("Parsed graph is empty or invalid");
                        }

                        // Process the graph and create new data
                        const { graph, hasEdges } = prepareGraph(rawGraph);

                        // Preserve existing node positions from current graph
                        if (data && data.graph) {
                            const currentGraph = data.graph;
                            const preservedPositions: Record<string, { x: number; y: number; size: number; color: string; label: string }> = {};

                            // First, collect all current positions (optimized)
                            const currentNodes = currentGraph.nodes();
                            for (let i = 0; i < currentNodes.length; i++) {
                                const nodeId = currentNodes[i];
                                const currentNodeData = currentGraph.getNodeAttributes(nodeId);
                                preservedPositions[nodeId] = {
                                    x: currentNodeData.x || 0,
                                    y: currentNodeData.y || 0,
                                    size: currentNodeData.size || 5,
                                    color: currentNodeData.color || "#aaa",
                                    label: currentNodeData.label || nodeId
                                };
                            }

                            // Then apply preserved positions to new graph (optimized)
                            const newNodes = graph.nodes();
                            for (let i = 0; i < newNodes.length; i++) {
                                const nodeId = newNodes[i];
                                if (preservedPositions[nodeId]) {
                                    const preserved = preservedPositions[nodeId];

                                    // Preserve position and visual attributes
                                    graph.setNodeAttribute(nodeId, "x", preserved.x);
                                    graph.setNodeAttribute(nodeId, "y", preserved.y);
                                    graph.setNodeAttribute(nodeId, "size", preserved.size);
                                    graph.setNodeAttribute(nodeId, "color", preserved.color);
                                    graph.setNodeAttribute(nodeId, "label", preserved.label);
                                }
                            }
                        }

                        // Create rich data with minimal processing
                        const richData = enrichData(graph, hasEdges);

                        // Update the graph data directly
                        setData(richData);

                        // Update the graph context
                        const newNavState = {
                            ...navState,
                            role: navState.role,
                            nodeSizeField: undefined, // Reset to default sizing
                            // Save current edge creation conditions
                            edgeCreationTopicThreshold: topicThreshold,
                            edgeCreationContributorThreshold: contributorThreshold,
                            edgeCreationStargazerThreshold: stargazerThreshold,
                            edgeCreationEnableTopicLinking: enableTopicLinking,
                            edgeCreationEnableContributorOverlap: enableContributorOverlap,
                            edgeCreationEnableSharedOrganization: enableSharedOrganization,
                            edgeCreationEnableCommonStargazers: enableCommonStargazers,
                            edgeCreationEnableDependencies: enableDependencies,
                        };
                        setNavState(newNavState);

                        // Notify user of success
                        const edgesCreated = result.edgesCreated?.total_edges || 0;
                        notify({
                            message: `Successfully created ${edgesCreated} edges from original graph`,
                            type: "success"
                        });

                        // Notify user that node sizing has been reset
                        if (navState.nodeSizeField === "pagerank") {
                            notify({
                                message: "Node sizing has been reset to default since new edges were created. PageRank values are no longer valid for the updated graph structure.",
                                type: "info"
                            });
                        }

                    } catch (error) {
                        console.error('Error updating graph:', error);
                        notify({
                            message: "Edge creation successful but failed to update the graph display. Please refresh the page.",
                            type: "warning"
                        });
                    }
                } else {
                    notify({
                        message: "Edge creation completed but no updated graph content received",
                        type: "warning"
                    });
                }
            } else {
                throw new Error(result.error || 'Unknown error occurred');
            }

        } catch (error) {
            console.error('Error creating edges:', error);
            notify({
                message: `Error creating edges: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Handle apply button click with debounce
    const handleApplyEdgeCreation = () => {
        // Prevent rapid clicking
        if (isLoading) return;

        // Add a small delay to prevent UI lag
        setTimeout(() => {
            createEdgesViaBackend();
        }, 100);
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
                                    onChange={(e) => updateEnableTopicLinking(e.target.checked)}
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
                                        min={2}
                                        max={10}
                                        step={1}
                                        marks={{
                                            2: "2",
                                            5: "5",
                                            10: "10"
                                        }}
                                        onChange={(value) => setTopicThreshold(value as number)}
                                        onChangeComplete={(value) => updateTopicThreshold(value as number)}
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
                                    onChange={(e) => updateEnableContributorOverlap(e.target.checked)}
                                />
                                <label className="form-check-label mb-0">Contributor Overlap</label>
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
                                        max={10}
                                        step={1}
                                        marks={{
                                            1: "1",
                                            3: "3",
                                            5: "5",
                                            10: "10"
                                        }}
                                        onChange={(value) => setContributorThreshold(value as number)}
                                        onChangeComplete={(value) => updateContributorThreshold(value as number)}
                                        className="mt-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Shared Organization/Creator */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableSharedOrganization}
                                    onChange={(e) => updateEnableSharedOrganization(e.target.checked)}
                                />
                                <label className="form-check-label mb-0">Shared Organization/Creator</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                Repositories maintained by the same GitHub organization or individual creator will be linked. This helps identify repositories that are part of the same project ecosystem, company, or maintained by the same person.
                            </p>
                        </div>

                        {/* Common Stargazers */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableCommonStargazers}
                                    onChange={(e) => updateEnableCommonStargazers(e.target.checked)}
                                />
                                <label className="form-check-label mb-0">Common Stargazers</label>
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
                                        max={50}
                                        step={1}
                                        marks={{
                                            1: "1",
                                            10: "10",
                                            25: "25",
                                            50: "50"
                                        }}
                                        onChange={(value) => setStargazerThreshold(value as number)}
                                        onChangeComplete={(value) => updateStargazerThreshold(value as number)}
                                        className="mt-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dependencies */}
                        <div className="mb-4 opacity-50">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableDependencies}
                                    onChange={(e) => updateEnableDependencies(e.target.checked)}
                                />
                                <label className="form-check-label mb-0">Dependencies</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                If a repository depends on another, it will be linked (this creates direct edges). This shows the actual dependency relationships between projects, such as when one project imports or uses another.
                            </p>
                        </div>

                        {/* Apply Button */}
                        <div className="mb-3">
                            {computedData?.filteredNodes && (
                                <div className="alert alert-info small mb-3">
                                    <strong>Note:</strong> Edge creation will only consider currently visible nodes ({computedData.filteredNodes.size} of {data?.graph?.order || 0} total).
                                    Hidden/filtered nodes will not participate in edge creation.
                                </div>
                            )}

                            {/* Warning when no criteria are selected */}
                            {!enableTopicLinking && !enableSharedOrganization && !enableContributorOverlap && !enableCommonStargazers && (
                                <div className="alert alert-info small mb-3">
                                    <strong>Info:</strong> No edge creation criteria are currently selected. Click the button below to remove all edges and restore the original graph.
                                </div>
                            )}

                            <button
                                className={`btn w-100 text-center ${(!enableTopicLinking && !enableSharedOrganization && !enableContributorOverlap && !enableCommonStargazers) ? 'btn-danger' : 'btn-light'}`}
                                onClick={handleApplyEdgeCreation}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Creating Edges...
                                    </>
                                ) : (!enableTopicLinking && !enableSharedOrganization && !enableContributorOverlap && !enableCommonStargazers) ? (
                                    "Remove All Edges"
                                ) : (
                                    "Apply Edge Creation Rules"
                                )}
                            </button>
                            <p className="text-white-50 small text-center mt-2">
                                Have other relationship ideas? Create a discussion topic at
                                {' '}
                                <a
                                    href="https://github.com/data-exp-lab/deepgit/discussions"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link-light"
                                >
                                    github.com/data-exp-lab/deepgit/discussions
                                </a>
                                .
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default EdgePanel;
