import cx from "classnames";
import React, { FC, useContext, useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import Slider from "rc-slider";

import { GraphContext } from "../lib/context";
import { EdgeData } from "../lib/data";
import { DEFAULT_EDGE_COLOR } from "../lib/consts";
import { useNotifications } from "../lib/notifications";

const EdgePanel: FC<{ isExpanded: boolean }> = ({ isExpanded }) => {
    const { navState, setNavState, setShowEdgePanel, data, graphFile } = useContext(GraphContext);
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
    };



    // Function to remove all edges from the graph
    const removeAllEdges = () => {
        if (!data || !data.graph) return 0;

        const { graph } = data;
        const allEdges = graph.edges();
        const edgeCount = allEdges.length;

        allEdges.forEach(edge => {
            graph.dropEdge(edge);
        });

        return edgeCount;
    };

    // Function to create topic-based edges
    const createTopicBasedEdges = () => {
        if (!data || !data.graph) return;

        const { graph } = data;
        const nodes = graph.nodes();
        const edgesCreated: Array<{ source: string; target: string; sharedTopics: string[] }> = [];

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

        // Early exit if not enough nodes with topics
        if (nodesWithTopics.length < 2) {
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

        return edgesCreated;
    };

    // Function to create shared organization edges
    const createSharedOrganizationEdges = () => {
        if (!data || !data.graph) return;

        const { graph } = data;
        const nodes = graph.nodes();
        const edgesCreated: Array<{ source: string; target: string; organization: string }> = [];

        // Get all nodes with their organization (owner from nameWithOwner)
        const nodeOrganizations: Record<string, string> = {};
        const nodesWithOrganization: string[] = [];

        nodes.forEach(nodeId => {
            const nodeData = graph.getNodeAttributes(nodeId);

            // Try different possible field names for owner information
            const nameWithOwner = nodeData.attributes?.nameWithOwner || nodeData.attributes?.name || nodeData.attributes?.label;

            if (nameWithOwner && typeof nameWithOwner === 'string') {
                // Check if it contains a slash (owner/repo format)
                if (nameWithOwner.includes('/')) {
                    const owner = nameWithOwner.split('/')[0]; // Extract owner from "owner/repo" format
                    if (owner) {
                        nodeOrganizations[nodeId] = owner;
                        nodesWithOrganization.push(nodeId);
                    }
                } else {
                    nodeOrganizations[nodeId] = nameWithOwner;
                    nodesWithOrganization.push(nodeId);
                }
            }
        });

        // Early exit if not enough nodes with organization info
        if (nodesWithOrganization.length < 2) {
            return edgesCreated;
        }

        // Create a reverse index: organization -> list of nodes that belong to it
        const organizationToNodes: Record<string, string[]> = {};
        nodesWithOrganization.forEach(nodeId => {
            const organization = nodeOrganizations[nodeId];
            if (!organizationToNodes[organization]) {
                organizationToNodes[organization] = [];
            }
            organizationToNodes[organization].push(nodeId);
        });



        // Find nodes that share the same organization
        const processedPairs = new Set<string>();

        Object.entries(organizationToNodes).forEach(([organization, nodeList]) => {
            // Only process organizations that have multiple repositories
            if (nodeList.length >= 2) {
                // Check all pairs of nodes that belong to this organization
                for (let i = 0; i < nodeList.length; i++) {
                    for (let j = i + 1; j < nodeList.length; j++) {
                        const node1 = nodeList[i];
                        const node2 = nodeList[j];

                        // Create a unique key for this pair to avoid duplicates
                        const pairKey = node1 < node2 ? `${node1}-${node2}` : `${node2}-${node1}`;

                        if (processedPairs.has(pairKey)) continue;
                        processedPairs.add(pairKey);

                        // Check if edge already exists
                        if (!graph.hasEdge(node1, node2)) {
                            // Create edge attributes
                            const edgeAttributes: EdgeData = {
                                size: 2,
                                rawSize: 2,
                                color: DEFAULT_EDGE_COLOR,
                                rawColor: DEFAULT_EDGE_COLOR,
                                label: `Shared organization: ${organization}`,
                                directed: false,
                                hidden: false,
                                type: undefined,
                                attributes: {
                                    sharedOrganization: organization,
                                    edgeType: 'organization-based',
                                    organization: organization
                                }
                            };

                            // Add undirected edge
                            const edgeKey = `org_edge_${node1}_${node2}`;
                            graph.addUndirectedEdgeWithKey(edgeKey, node1, node2, edgeAttributes);

                            edgesCreated.push({
                                source: node1,
                                target: node2,
                                organization: organization
                            });
                        }
                    }
                }
            }
        });

        return edgesCreated;
    };

    // Function to create edges that satisfy BOTH topic-based AND shared organization criteria
    const createCombinedEdges = () => {
        if (!data || !data.graph) return [];

        const { graph } = data;
        const edges: Array<{ source: string; target: string; sharedTopics: string[]; organization: string }> = [];
        const nodeOrganizations: Record<string, string> = {};
        const nodesWithOrganization: string[] = [];

        // First pass: collect all nodes and their organizations
        graph.forEachNode((nodeId) => {
            const nodeData = graph.getNodeAttributes(nodeId);
            const nameWithOwner = nodeData.attributes?.nameWithOwner || nodeData.attributes?.name || nodeData.attributes?.label;

            if (nameWithOwner && typeof nameWithOwner === 'string') {
                if (nameWithOwner.includes('/')) {
                    const owner = nameWithOwner.split('/')[0];
                    if (owner) {
                        nodeOrganizations[nodeId] = owner;
                        nodesWithOrganization.push(nodeId);
                    }
                } else {
                    nodeOrganizations[nodeId] = nameWithOwner;
                    nodesWithOrganization.push(nodeId);
                }
            }
        });

        // Create reverse index: organization -> list of nodes
        const organizationToNodes: Record<string, string[]> = {};
        nodesWithOrganization.forEach(nodeId => {
            const organization = nodeOrganizations[nodeId];
            if (!organizationToNodes[organization]) {
                organizationToNodes[organization] = [];
            }
            organizationToNodes[organization].push(nodeId);
        });



        // Find nodes that share BOTH topics AND organization
        const processedPairs = new Set<string>();



        Object.entries(organizationToNodes).forEach(([organization, nodeList]) => {


            if (nodeList.length > 1) {
                // For each pair of nodes in the same organization
                for (let i = 0; i < nodeList.length; i++) {
                    for (let j = i + 1; j < nodeList.length; j++) {
                        const source = nodeList[i];
                        const target = nodeList[j];

                        const pairKey = `${source}-${target}`;
                        const reversePairKey = `${target}-${source}`;

                        // Skip if we've already processed this pair
                        if (processedPairs.has(pairKey) || processedPairs.has(reversePairKey)) {
                            continue;
                        }
                        processedPairs.add(pairKey);
                        processedPairs.add(reversePairKey);

                        try {
                            // Check if they share topics
                            const sourceData = graph.getNodeAttributes(source);
                            const targetData = graph.getNodeAttributes(target);

                            // Convert pipe-separated string to array if needed
                            const sourceTopicsRaw = sourceData.attributes?.topics || [];
                            const targetTopicsRaw = targetData.attributes?.topics || [];

                            // Handle both string and array formats
                            const sourceTopics = Array.isArray(sourceTopicsRaw)
                                ? sourceTopicsRaw
                                : (typeof sourceTopicsRaw === 'string' ? sourceTopicsRaw.split('|') : []);
                            const targetTopics = Array.isArray(targetTopicsRaw)
                                ? targetTopicsRaw
                                : (typeof targetTopicsRaw === 'string' ? targetTopicsRaw.split('|') : []);

                            // Find common topics
                            const commonTopics = sourceTopics.filter((topic: string) =>
                                targetTopics.includes(topic)
                            );

                            // Only create edge if BOTH conditions are met:
                            // 1. They share the same organization
                            // 2. They share at least the minimum number of topics
                            if (commonTopics.length >= topicThreshold && commonTopics.length > 0) {
                                // Add the edge to the graph
                                const edgeAttributes = {
                                    size: 2,
                                    rawSize: 2,
                                    color: DEFAULT_EDGE_COLOR,
                                    rawColor: DEFAULT_EDGE_COLOR,
                                    label: `Combined: ${organization} + ${commonTopics.length} topics`,
                                    directed: false,
                                    hidden: false,
                                    type: undefined,
                                    attributes: {
                                        edgeType: 'combined',
                                        sharedTopics: commonTopics.join('|'),
                                        organization: organization,
                                        topicCount: commonTopics.length
                                    }
                                };

                                // Add undirected edge to the graph
                                const edgeKey = `combined_edge_${source}_${target}`;
                                graph.addUndirectedEdgeWithKey(edgeKey, source, target, edgeAttributes);

                                // Also store the edge data for GEXF update
                                edges.push({
                                    source,
                                    target,
                                    sharedTopics: commonTopics,
                                    organization: organization
                                });
                            }
                        } catch (error) {
                            console.error(`Error processing pair ${source} ↔ ${target}:`, error);
                        }
                    }
                }
            }
        });

        // Add edges to the graph
        if (edges.length > 0) {
            edges.forEach((edge) => {
                // Check if edge already exists
                if (!graph.hasEdge(edge.source, edge.target)) {
                    // Add edge to the graph
                    graph.addEdge(edge.source, edge.target, {
                        size: 2,
                        rawSize: 2,
                        color: DEFAULT_EDGE_COLOR,
                        rawColor: DEFAULT_EDGE_COLOR,
                        label: `Combined: ${edge.organization} + ${edge.sharedTopics.length} topics`,
                        directed: false,
                        hidden: false,
                        type: undefined,
                        attributes: {
                            sharedTopics: edge.sharedTopics,
                            organization: edge.organization,
                            edgeType: 'combined'
                        }
                    });
                }
            });
        }

        return edges;
    };

    // Function to update GEXF content with new edges
    const updateGexfContent = (edgesCreated: Array<{ source: string; target: string; sharedTopics?: string[]; organization?: string }>, edgeType: string) => {
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
            let edgeId: string;

            // Generate appropriate edge ID based on type
            if (edgeType === 'topic-based') {
                edgeId = `topic_edge_${edge.source}_${edge.target}`;
            } else if (edgeType === 'organization-based') {
                edgeId = `org_edge_${edge.source}_${edge.target}`;
            } else if (edgeType === 'combined') {
                edgeId = `combined_edge_${edge.source}_${edge.target}`;
            } else {
                edgeId = `edge_${edge.source}_${edge.target}`;
            }

            edgeElement.setAttribute('id', edgeId);
            edgeElement.setAttribute('source', edge.source);
            edgeElement.setAttribute('target', edge.target);
            edgeElement.setAttribute('weight', '1');

            // Add edge attributes
            const attrsElement = xmlDoc.createElement('attvalues');

            if (edgeType === 'topic-based' && edge.sharedTopics) {
                // Shared topics attribute
                const topicAttr = xmlDoc.createElement('attvalue');
                topicAttr.setAttribute('for', 'sharedTopics');
                topicAttr.setAttribute('value', edge.sharedTopics.join('|'));
                attrsElement.appendChild(topicAttr);
            } else if (edgeType === 'organization-based' && edge.organization) {
                // Shared organization attribute
                const orgAttr = xmlDoc.createElement('attvalue');
                orgAttr.setAttribute('for', 'sharedOrganization');
                orgAttr.setAttribute('value', edge.organization);
                attrsElement.appendChild(orgAttr);
            } else if (edgeType === 'combined' && edge.sharedTopics && edge.organization) {
                // Combined edge attributes - both topics and organization
                const topicAttr = xmlDoc.createElement('attvalue');
                topicAttr.setAttribute('for', 'sharedTopics');
                topicAttr.setAttribute('value', edge.sharedTopics.join('|'));
                attrsElement.appendChild(topicAttr);

                const orgAttr = xmlDoc.createElement('attvalue');
                orgAttr.setAttribute('for', 'sharedOrganization');
                orgAttr.setAttribute('value', edge.organization);
                attrsElement.appendChild(orgAttr);
            }

            // Edge type attribute
            const typeAttr = xmlDoc.createElement('attvalue');
            typeAttr.setAttribute('for', 'edgeType');
            typeAttr.setAttribute('value', edgeType);
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
        let totalEdgesCreated = 0;

        // Always start by removing ALL existing edges from the graph
        removeAllEdges();



        // Create edges based on combined criteria
        if (enableTopicLinking && enableSharedOrganization) {
            // Create edges that satisfy BOTH conditions (AND logic)
            const edgesCreated = createCombinedEdges();

            if (edgesCreated && edgesCreated.length > 0) {
                updateGexfContent(edgesCreated, 'combined');
                totalEdgesCreated += edgesCreated.length;
            }
        } else if (enableTopicLinking) {
            // Create new edges based on current threshold
            const edgesCreated = createTopicBasedEdges();
            if (edgesCreated && edgesCreated.length > 0) {
                updateGexfContent(edgesCreated, 'topic-based');
                totalEdgesCreated += edgesCreated.length;
            }
        } else if (enableSharedOrganization) {
            // Create new edges based on shared organizations
            const edgesCreated = createSharedOrganizationEdges();
            if (edgesCreated && edgesCreated.length > 0) {
                updateGexfContent(edgesCreated, 'organization-based');
                totalEdgesCreated += edgesCreated.length;
            }
        }

        // Force graph refresh if any edges were created
        if (totalEdgesCreated > 0) {
            // Reset nodeSizeField to default when edges are created since PageRank values become invalid
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

            // Notify user that node sizing has been reset
            if (navState.nodeSizeField === "pagerank") {
                notify({
                    message: "Node sizing has been reset to default since new edges were created. PageRank values are no longer valid for the updated graph structure.",
                    type: "info"
                });
            }
        }


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
                                        onChange={(value) => updateTopicThreshold(value as number)}
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
                                        onChange={(value) => updateContributorThreshold(value as number)}
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
                                    onChange={(e) => updateEnableSharedOrganization(e.target.checked)}
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
                                    onChange={(e) => updateEnableCommonStargazers(e.target.checked)}
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
                                        onChange={(value) => updateStargazerThreshold(value as number)}
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
                                    onChange={(e) => updateEnableDependencies(e.target.checked)}
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
