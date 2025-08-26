import { describe, it, expect } from 'vitest';
import { calculatePageRank } from './graphAlgorithms';

// Mock graph object for testing
const createMockGraph = () => {
  const nodes = ['A', 'B', 'C', 'D'];
  const edges = [
    { source: 'A', target: 'B' },
    { source: 'A', target: 'C' },
    { source: 'B', target: 'C' },
    { source: 'C', target: 'D' },
    { source: 'D', target: 'A' },
  ];
  
  return {
    nodes: () => nodes,
    outNeighbors: (node: string) => {
      return edges
        .filter(edge => edge.source === node)
        .map(edge => edge.target);
    }
  };
};

describe('calculatePageRank', () => {
  it('should calculate PageRank scores for a simple graph', () => {
    const graph = createMockGraph();
    const scores = calculatePageRank(graph);
    
    expect(scores).toBeDefined();
    expect(Object.keys(scores)).toHaveLength(4);
    expect(scores['A']).toBeGreaterThan(0);
    expect(scores['B']).toBeGreaterThan(0);
    expect(scores['C']).toBeGreaterThan(0);
    expect(scores['D']).toBeGreaterThan(0);
    
    // All scores should sum to approximately 1
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    expect(totalScore).toBeCloseTo(1, 2);
  });
  
  it('should handle empty graph', () => {
    const emptyGraph = {
      nodes: () => [],
      outNeighbors: () => []
    };
    
    const scores = calculatePageRank(emptyGraph);
    expect(scores).toEqual({});
  });
  
  it('should handle single node graph', () => {
    const singleNodeGraph = {
      nodes: () => ['A'],
      outNeighbors: () => []
    };
    
    const scores = calculatePageRank(singleNodeGraph);
    expect(scores).toEqual({ 'A': 1 });
  });
  
  it('should converge within reasonable iterations', () => {
    const graph = createMockGraph();
    const scores = calculatePageRank(graph, 0.85, 50, 1e-6);
    
    // Should converge and produce valid scores
    expect(Object.values(scores).every(score => score > 0 && score < 1)).toBe(true);
  });
});
