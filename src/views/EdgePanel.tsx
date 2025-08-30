import cx from "classnames";
import React, { FC, useContext, useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import Slider from "rc-slider";

import { GraphContext } from "../lib/context";
import { EdgeData } from "../lib/data";
import { DEFAULT_EDGE_COLOR } from "../lib/consts";
import { useNotifications } from "../lib/notifications";

const EdgePanel: FC<{ isExpanded: boolean }> = ({ isExpanded }) => {
    const { navState, setNavState, setShowEdgePanel, data, graphFile, computedData } = useContext(GraphContext);
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
    }

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
        // Use filtered nodes if available, otherwise use all nodes
        const nodes = computedData?.filteredNodes ?
            Array.from(computedData.filteredNodes) :
            graph.nodes();
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
        });

        return edgesCreated;
    };

    // Function to create shared organization edges
    const createSharedOrganizationEdges = () => {
        if (!data || !data.graph) return;

        const { graph } = data;
        // Use filtered nodes if available, otherwise use all nodes
        const nodes = computedData?.filteredNodes ?
            Array.from(computedData.filteredNodes) :
            graph.nodes();
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
        });

        return edgesCreated;
    };

    // Function to create contributor overlap edges
    const createContributorOverlapEdges = () => {
        if (!data || !data.graph) return [];

        const { graph } = data;
        // Use filtered nodes if available, otherwise use all nodes
        const nodes = computedData?.filteredNodes ?
            Array.from(computedData.filteredNodes) :
            graph.nodes();

        // Debug: Log overall data structure
        console.log('Graph data structure:', data);
        console.log('Total nodes in graph:', nodes.length);

        // Check if contributor/stargazer data exists in the overall data
        console.log('Available data keys:', Object.keys(data));
        if (data.graph) {
            console.log('Graph structure:', data.graph);
        }

        if (nodes.length > 0) {
            const firstNode = nodes[0];
            const firstNodeData = graph.getNodeAttributes(firstNode);
            console.log('First node data structure:', firstNodeData);
            console.log('First node attributes:', firstNodeData.attributes);
        }

        const edgesCreated: Array<{ source: string; target: string; sharedContributors: string[] }> = [];

        // Get all nodes with their contributors and filter out nodes without contributors
        const nodeContributors: Record<string, string[]> = {};
        const nodesWithContributors: string[] = [];

        nodes.forEach(nodeId => {
            const nodeData = graph.getNodeAttributes(nodeId);
            // Check both possible field names for contributors
            const contributors = nodeData.attributes?.bigquery_contributors || nodeData.attributes?.contributors;
            if (contributors) {
                let contributorArray: string[] = [];

                if (Array.isArray(contributors)) {
                    // If it's already an array, use it directly
                    contributorArray = contributors;
                } else if (typeof contributors === 'string') {
                    // If it's a string, split by comma
                    contributorArray = contributors.split(',').map(c => c.trim()).filter(Boolean);
                }

                if (contributorArray.length > 0) {
                    nodeContributors[nodeId] = contributorArray;
                    nodesWithContributors.push(nodeId);
                }
            }
        });

        // Debug: Log what we found
        console.log(`Found ${nodesWithContributors.length} nodes with contributors`);
        if (nodesWithContributors.length > 0) {
            console.log('Sample contributor data:', nodeContributors[nodesWithContributors[0]]);
        }

        // Early exit if not enough nodes with contributors
        if (nodesWithContributors.length < 2) {
            console.log('Not enough nodes with contributors to create edges');
            return edgesCreated;
        }

        // Find nodes that share contributors
        const processedPairs = new Set<string>();

        for (let i = 0; i < nodesWithContributors.length; i++) {
            for (let j = i + 1; j < nodesWithContributors.length; j++) {
                const node1 = nodesWithContributors[i];
                const node2 = nodesWithContributors[j];

                // Create a unique key for this pair to avoid duplicates
                const pairKey = node1 < node2 ? `${node1}-${node2}` : `${node2}-${node1}`;

                if (processedPairs.has(pairKey)) continue;
                processedPairs.add(pairKey);

                // Find common contributors between these two nodes
                const contributors1 = nodeContributors[node1];
                const contributors2 = nodeContributors[node2];
                const commonContributors = contributors1.filter(c => contributors2.includes(c));

                // Only create edge if we meet the threshold
                if (commonContributors.length >= contributorThreshold) {
                    // Create edge attributes
                    const edgeAttributes: EdgeData = {
                        size: 2,
                        rawSize: 2,
                        color: DEFAULT_EDGE_COLOR,
                        rawColor: DEFAULT_EDGE_COLOR,
                        label: `Shared contributors: ${commonContributors.join(', ')}`,
                        directed: false,
                        hidden: false,
                        type: undefined,
                        attributes: {
                            sharedContributors: commonContributors.join('|'),
                            edgeType: 'contributor-based',
                            contributorCount: commonContributors.length
                        }
                    };

                    // Add undirected edge
                    const edgeKey = `contributor_edge_${node1}_${node2}`;
                    graph.addUndirectedEdgeWithKey(edgeKey, node1, node2, edgeAttributes);

                    edgesCreated.push({
                        source: node1,
                        target: node2,
                        sharedContributors: commonContributors
                    });
                }
            }
        }

        return edgesCreated;
    };

    // Function to create common stargazer edges
    const createCommonStargazerEdges = () => {
        if (!data || !data.graph) return [];

        const { graph } = data;
        // Use filtered nodes if available, otherwise use all nodes
        const nodes = computedData?.filteredNodes ?
            Array.from(computedData.filteredNodes) :
            graph.nodes();

        // Debug: Log overall data structure
        console.log('Stargazer - Graph data structure:', data);
        console.log('Stargazer - Total nodes in graph:', nodes.length);

        // Check if contributor/stargazer data exists in the overall data
        console.log('Stargazer - Available data keys:', Object.keys(data));
        if (data.graph) {
            console.log('Stargazer - Graph structure:', data.graph);
        }

        if (nodes.length > 0) {
            const firstNode = nodes[0];
            const firstNodeData = graph.getNodeAttributes(firstNode);
            console.log('Stargazer - First node data structure:', firstNodeData);
            console.log('Stargazer - First node attributes:', firstNodeData.attributes);
        }

        const edgesCreated: Array<{ source: string; target: string; sharedStargazers: string[] }> = [];

        // Get all nodes with their stargazers and filter out nodes without stargazers
        const nodeStargazers: Record<string, string[]> = {};
        const nodesWithStargazers: string[] = [];

        nodes.forEach(nodeId => {
            const nodeData = graph.getNodeAttributes(nodeId);
            // Check both possible field names for stargazers
            const stargazers = nodeData.attributes?.bigquery_stargazers || nodeData.attributes?.stargazers;
            if (stargazers) {
                let stargazerArray: string[] = [];

                if (Array.isArray(stargazers)) {
                    // If it's already an array, use it directly
                    stargazerArray = stargazers;
                } else if (typeof stargazers === 'string') {
                    // If it's a string, split by comma
                    stargazerArray = stargazers.split(',').map(s => s.trim()).filter(Boolean);
                }

                if (stargazerArray.length > 0) {
                    nodeStargazers[nodeId] = stargazerArray;
                    nodesWithStargazers.push(nodeId);
                }
            }
        });

        // Debug: Log what we found
        console.log(`Found ${nodesWithStargazers.length} nodes with stargazers`);
        if (nodesWithStargazers.length > 0) {
            console.log('Sample stargazer data:', nodeStargazers[nodesWithStargazers[0]]);
        }

        // Early exit if not enough nodes with stargazers
        if (nodesWithStargazers.length < 2) {
            console.log('Not enough nodes with stargazers to create edges');
            return edgesCreated;
        }

        // Find nodes that share stargazers
        const processedPairs = new Set<string>();

        for (let i = 0; i < nodesWithStargazers.length; i++) {
            for (let j = i + 1; j < nodesWithStargazers.length; j++) {
                const node1 = nodesWithStargazers[i];
                const node2 = nodesWithStargazers[j];

                // Create a unique key for this pair to avoid duplicates
                const pairKey = node1 < node2 ? `${node1}-${node2}` : `${node2}-${node1}`;

                if (processedPairs.has(pairKey)) continue;
                processedPairs.add(pairKey);

                // Find common stargazers between these two nodes
                const stargazers1 = nodeStargazers[node1];
                const stargazers2 = nodeStargazers[node2];
                const commonStargazers = stargazers1.filter(s => stargazers2.includes(s));

                // Only create edge if we meet the threshold
                if (commonStargazers.length >= stargazerThreshold) {
                    // Create edge attributes
                    const edgeAttributes: EdgeData = {
                        size: 2,
                        rawSize: 2,
                        color: DEFAULT_EDGE_COLOR,
                        rawColor: DEFAULT_EDGE_COLOR,
                        label: `Shared stargazers: ${commonStargazers.length}`,
                        directed: false,
                        hidden: false,
                        type: undefined,
                        attributes: {
                            sharedStargazers: commonStargazers.join('|'),
                            edgeType: 'stargazer-based',
                            stargazerCount: commonStargazers.length
                        }
                    };

                    // Add undirected edge
                    const edgeKey = `stargazer_edge_${node1}_${node2}`;
                    graph.addUndirectedEdgeWithKey(edgeKey, node1, node2, edgeAttributes);

                    edgesCreated.push({
                        source: node1,
                        target: node2,
                        sharedStargazers: commonStargazers
                    });
                }
            }
        }

        return edgesCreated;
    };

    // Function to create edges that satisfy ALL enabled criteria simultaneously
    const createCombinedCriteriaEdges = () => {
        if (!data || !data.graph) return [];

        const { graph } = data;
        const edges: Array<{
            source: string;
            target: string;
            sharedTopics?: string[];
            organization?: string;
            sharedContributors?: string[];
            sharedStargazers?: string[];
            edgeType: string;
        }> = [];

        // Use filtered nodes if available, otherwise use all nodes
        const nodes = computedData?.filteredNodes ?
            Array.from(computedData.filteredNodes) :
            graph.nodes();
        const processedPairs = new Set<string>();

        // Process all pairs of nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const node1 = nodes[i];
                const node2 = nodes[j];

                // Create a unique key for this pair to avoid duplicates
                const pairKey = node1 < node2 ? `${node1}-${node2}` : `${node2}-${node1}`;
                if (processedPairs.has(pairKey)) continue;
                processedPairs.add(pairKey);

                const node1Data = graph.getNodeAttributes(node1);
                const node2Data = graph.getNodeAttributes(node2);

                let meetsAllCriteria = true;
                const edgeData: any = {
                    source: node1,
                    target: node2,
                    edgeType: 'combined'
                };

                // Check topic-based criterion
                if (enableTopicLinking) {
                    const topics1 = node1Data.attributes?.topics;
                    const topics2 = node2Data.attributes?.topics;

                    if (topics1 && topics2) {
                        const topics1Array = typeof topics1 === 'string' ? topics1.split('|').map((t: string) => t.trim()).filter(Boolean) : topics1;
                        const topics2Array = typeof topics2 === 'string' ? topics2.split('|').map((t: string) => t.trim()).filter(Boolean) : topics2;
                        const commonTopics = topics1Array.filter((t: string) => topics2Array.includes(t));

                        if (commonTopics.length >= topicThreshold) {
                            edgeData.sharedTopics = commonTopics;
                        } else {
                            meetsAllCriteria = false;
                        }
                    } else {
                        meetsAllCriteria = false;
                    }
                }

                // Check shared organization criterion
                if (enableSharedOrganization && meetsAllCriteria) {
                    const nameWithOwner1 = node1Data.attributes?.nameWithOwner || node1Data.attributes?.name || node1Data.attributes?.label;
                    const nameWithOwner2 = node2Data.attributes?.nameWithOwner || node2Data.attributes?.name || node2Data.attributes?.label;

                    if (nameWithOwner1 && nameWithOwner2) {
                        const owner1 = nameWithOwner1.includes('/') ? nameWithOwner1.split('/')[0] : nameWithOwner1;
                        const owner2 = nameWithOwner2.includes('/') ? nameWithOwner2.split('/')[0] : nameWithOwner2;

                        if (owner1 === owner2) {
                            edgeData.organization = owner1;
                        } else {
                            meetsAllCriteria = false;
                        }
                    } else {
                        meetsAllCriteria = false;
                    }
                }

                // Check contributor overlap criterion
                if (enableContributorOverlap && meetsAllCriteria) {
                    const contributors1 = node1Data.attributes?.bigquery_contributors || node1Data.attributes?.contributors;
                    const contributors2 = node2Data.attributes?.bigquery_stargazers || node2Data.attributes?.contributors;

                    if (contributors1 && contributors2) {
                        const contrib1Array = Array.isArray(contributors1) ? contributors1 : contributors1.split(',').map((c: string) => c.trim()).filter(Boolean);
                        const contrib2Array = Array.isArray(contributors2) ? contributors2 : contributors2.split(',').map((c: string) => c.trim()).filter(Boolean);
                        const commonContributors = contrib1Array.filter((c: string) => contrib2Array.includes(c));

                        if (commonContributors.length >= contributorThreshold) {
                            edgeData.sharedContributors = commonContributors;
                        } else {
                            meetsAllCriteria = false;
                        }
                    } else {
                        meetsAllCriteria = false;
                    }
                }

                // Check common stargazers criterion
                if (enableCommonStargazers && meetsAllCriteria) {
                    const stargazers1 = node1Data.attributes?.bigquery_stargazers || node1Data.attributes?.stargazers;
                    const stargazers2 = node2Data.attributes?.bigquery_stargazers || node2Data.attributes?.stargazers;

                    if (stargazers1 && stargazers2) {
                        const stargazers1Array = Array.isArray(stargazers1) ? stargazers1 : stargazers1.split(',').map((s: string) => s.trim()).filter(Boolean);
                        const stargazers2Array = Array.isArray(stargazers2) ? stargazers2 : stargazers2.split(',').map((s: string) => s.trim()).filter(Boolean);
                        const commonStargazers = stargazers1Array.filter((s: string) => stargazers2Array.includes(s));

                        if (commonStargazers.length >= stargazerThreshold) {
                            edgeData.sharedStargazers = commonStargazers;
                        } else {
                            meetsAllCriteria = false;
                        }
                    } else {
                        meetsAllCriteria = false;
                    }
                }

                // If all criteria are met, create the edge
                if (meetsAllCriteria) {
                    // Create edge attributes
                    const edgeAttributes: EdgeData = {
                        size: 2,
                        rawSize: 2,
                        color: DEFAULT_EDGE_COLOR,
                        rawColor: DEFAULT_EDGE_COLOR,
                        label: `Combined criteria`,
                        directed: false,
                        hidden: false,
                        type: undefined,
                        attributes: {
                            edgeType: 'combined',
                            ...edgeData
                        }
                    };

                    // Remove source and target from attributes
                    delete edgeAttributes.attributes.source;
                    delete edgeAttributes.attributes.target;

                    // Add undirected edge
                    const edgeKey = `combined_edge_${node1}_${node2}`;
                    graph.addUndirectedEdgeWithKey(edgeKey, node1, node2, edgeAttributes);

                    edges.push(edgeData);
                }
            }
        }

        return edges;
    };

    // Function to update GEXF content with new edges
    const updateGexfContent = (edgesCreated: Array<{
        source: string;
        target: string;
        sharedTopics?: string[];
        organization?: string;
        sharedContributors?: string[];
        sharedStargazers?: string[];
    }>, edgeType: string) => {
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
            } else if (edgeType === 'contributor-based') {
                edgeId = `contributor_edge_${edge.source}_${edge.target}`;
            } else if (edgeType === 'stargazer-based') {
                edgeId = `stargazer_edge_${edge.source}_${edge.target}`;
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
            } else if (edgeType === 'contributor-based' && edge.sharedContributors) {
                // Shared contributors attribute
                const contributorAttr = xmlDoc.createElement('attvalue');
                contributorAttr.setAttribute('for', 'sharedContributors');
                contributorAttr.setAttribute('value', edge.sharedContributors.join('|'));
                attrsElement.appendChild(contributorAttr);
            } else if (edgeType === 'stargazer-based' && edge.sharedStargazers) {
                // Shared stargazers attribute
                const stargazerAttr = xmlDoc.createElement('attvalue');
                stargazerAttr.setAttribute('for', 'sharedStargazers');
                stargazerAttr.setAttribute('value', edge.sharedStargazers.join('|'));
                attrsElement.appendChild(stargazerAttr);
            } else if (edgeType === 'combined') {
                // Combined edge attributes - add all available attributes
                if (edge.sharedTopics) {
                    const topicAttr = xmlDoc.createElement('attvalue');
                    topicAttr.setAttribute('for', 'sharedTopics');
                    topicAttr.setAttribute('value', edge.sharedTopics.join('|'));
                    attrsElement.appendChild(topicAttr);
                }
                if (edge.organization) {
                    const orgAttr = xmlDoc.createElement('attvalue');
                    orgAttr.setAttribute('for', 'sharedOrganization');
                    orgAttr.setAttribute('value', edge.organization);
                    attrsElement.appendChild(orgAttr);
                }
                if (edge.sharedContributors) {
                    const contributorAttr = xmlDoc.createElement('attvalue');
                    contributorAttr.setAttribute('for', 'sharedContributors');
                    contributorAttr.setAttribute('value', edge.sharedContributors.join('|'));
                    attrsElement.appendChild(contributorAttr);
                }
                if (edge.sharedStargazers) {
                    const stargazerAttr = xmlDoc.createElement('attvalue');
                    stargazerAttr.setAttribute('for', 'sharedStargazers');
                    stargazerAttr.setAttribute('value', edge.sharedStargazers.join('|'));
                    attrsElement.appendChild(stargazerAttr);
                }
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

        // Count how many criteria are enabled
        const enabledCriteria = [
            enableTopicLinking,
            enableSharedOrganization,
            enableContributorOverlap,
            enableCommonStargazers
        ].filter(Boolean).length;

        if (enabledCriteria === 0) {
            return; // No criteria enabled
        }

        if (enabledCriteria === 1) {
            // Single criterion - use individual functions
            if (enableTopicLinking) {
                const edgesCreated = createTopicBasedEdges();
                if (edgesCreated && edgesCreated.length > 0) {
                    updateGexfContent(edgesCreated, 'topic-based');
                    totalEdgesCreated += edgesCreated.length;
                }
            } else if (enableSharedOrganization) {
                const edgesCreated = createSharedOrganizationEdges();
                if (edgesCreated && edgesCreated.length > 0) {
                    updateGexfContent(edgesCreated, 'organization-based');
                    totalEdgesCreated += edgesCreated.length;
                }
            } else if (enableContributorOverlap) {
                const edgesCreated = createContributorOverlapEdges();
                if (edgesCreated && edgesCreated.length > 0) {
                    updateGexfContent(edgesCreated, 'contributor-based');
                    totalEdgesCreated += edgesCreated.length;
                }
            } else if (enableCommonStargazers) {
                const edgesCreated = createCommonStargazerEdges();
                if (edgesCreated && edgesCreated.length > 0) {
                    updateGexfContent(edgesCreated, 'stargazer-based');
                    totalEdgesCreated += edgesCreated.length;
                }
            }
        } else {
            // Multiple criteria - create edges that satisfy ALL enabled criteria
            const edgesCreated = createCombinedCriteriaEdges();
            if (edgesCreated && edgesCreated.length > 0) {
                updateGexfContent(edgesCreated, 'combined');
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
                                        onChange={(value) => setTopicThreshold(value as number)}
                                        onAfterChange={(value) => updateTopicThreshold(value as number)}
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
                                        max={20}
                                        step={1}
                                        marks={{
                                            1: "1",
                                            5: "5",
                                            10: "10",
                                            20: "20"
                                        }}
                                        onChange={(value) => setContributorThreshold(value as number)}
                                        onAfterChange={(value) => updateContributorThreshold(value as number)}
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
                                        max={100}
                                        step={5}
                                        marks={{
                                            1: "1",
                                            25: "25",
                                            50: "50",
                                            100: "100"
                                        }}
                                        onChange={(value) => setStargazerThreshold(value as number)}
                                        onAfterChange={(value) => updateStargazerThreshold(value as number)}
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
                            <button
                                className="btn btn-light w-100 text-center"
                                onClick={handleApplyEdgeCreation}
                            >
                                Apply Edge Creation Rules
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
