/**
 * Graph algorithms utility functions
 */

/**
 * Calculates PageRank scores for nodes in a graph
 * @param graph - The graph object with nodes and edges
 * @param dampingFactor - Damping factor (usually 0.85)
 * @param maxIterations - Maximum number of iterations
 * @param tolerance - Convergence tolerance
 * @returns Object mapping node IDs to PageRank scores
 */
export function calculatePageRank(
    graph: any,
    dampingFactor: number = 0.85,
    maxIterations: number = 100,
    tolerance: number = 1e-6
): Record<string, number> {
    const nodes = graph.nodes();
    const nodeCount = nodes.length;

    if (nodeCount === 0) return {};

    // Initialize PageRank scores
    const pageRank: Record<string, number> = {};
    const newPageRank: Record<string, number> = {};

    // Initialize all nodes with equal probability
    const initialScore = 1.0 / nodeCount;
    nodes.forEach((node: string) => {
        pageRank[node] = initialScore;
        newPageRank[node] = 0;
    });

    // Build adjacency list using available graph methods
    const adjacencyList: Record<string, string[]> = {};
    nodes.forEach((node: string) => {
        adjacencyList[node] = [];
    });

    // Use forEachEdge to build the adjacency list
    graph.forEachEdge((edge: string) => {
        const source = graph.source(edge);
        const target = graph.target(edge);
        if (adjacencyList[source]) {
            adjacencyList[source].push(target);
        }
    });

    // Calculate out-degrees for each node
    const outDegrees: Record<string, number> = {};
    nodes.forEach((node: string) => {
        outDegrees[node] = adjacencyList[node].length;
    });

    // Iterative PageRank calculation
    for (let iteration = 0; iteration < maxIterations; iteration++) {
        let maxChange = 0;

        // Reset new PageRank scores
        nodes.forEach((node: string) => {
            newPageRank[node] = 0;
        });

        // Calculate new PageRank scores
        nodes.forEach((node: string) => {
            const outDegree = outDegrees[node];

            if (outDegree > 0) {
                // Distribute PageRank to neighbors
                const contribution = pageRank[node] / outDegree;
                const neighbors = adjacencyList[node];
                neighbors.forEach((neighbor: string) => {
                    newPageRank[neighbor] += contribution;
                });
            } else {
                // Dangling node - distribute evenly to all nodes
                const contribution = pageRank[node] / nodeCount;
                nodes.forEach((n: string) => {
                    newPageRank[n] += contribution;
                });
            }
        });

        // Apply damping factor and random jump
        const randomJump = (1 - dampingFactor) / nodeCount;
        nodes.forEach((node: string) => {
            newPageRank[node] = dampingFactor * newPageRank[node] + randomJump;

            // Track maximum change for convergence check
            const change = Math.abs(newPageRank[node] - pageRank[node]);
            maxChange = Math.max(maxChange, change);
        });

        // Check for convergence
        if (maxChange < tolerance) {
            break;
        }

        // Update PageRank scores for next iteration
        nodes.forEach((node: string) => {
            pageRank[node] = newPageRank[node];
        });
    }

    return pageRank;
}
