
import pagerank from 'graphology-metrics/centrality/pagerank';
import betweenness from 'graphology-metrics/centrality/betweenness';
import louvain from 'graphology-communities-louvain';
import { dijkstra } from 'graphology-shortest-path';
import type { KGotCore } from './core';

export function updateCentrality(core: KGotCore) {
  const graph = core.internalGraph;
  if (graph.order === 0) return;

  try {
    const pr = pagerank(graph);
    Object.entries(pr).forEach(([node, score]) => {
      graph.mergeNodeAttributes(node, { pagerank: score });
    });

    // Betweenness can be expensive, skip for large graphs in real-time
    if (graph.order < 500) {
        const bc = betweenness(graph);
        Object.entries(bc).forEach(([node, score]) => {
            graph.mergeNodeAttributes(node, { betweenness: score });
        });
    }
  } catch (e) {
    console.warn("Metric update failed:", e);
  }
}

export function detectCommunities(core: KGotCore): Record<string, number> {
  const graph = core.internalGraph;
  if (graph.order === 0) return {};
  
  const communities: Record<string, number> = {};
  try {
      louvain.assign(graph); // Assigns 'community' attribute directly
      graph.forEachNode((node, attrs) => {
          communities[node] = attrs.community as number;
      });
  } catch (e) {
      console.warn("Community detection failed:", e);
  }
  return communities;
}

export function calculateDominancePath(core: KGotCore, source: string, target: string): string[] | null {
    const graph = core.internalGraph;
    if (!graph.hasNode(source) || !graph.hasNode(target)) return null;
    try {
        const path = dijkstra.bidirectional(graph, source, target, (edge, attr) => {
             return 1.0 - (attr.weight || 0.5); // Invert weight for "resistance" path
        });
        return path || null;
    } catch (e) {
        return null;
    }
}

export function pruneGraph(core: KGotCore, weightThreshold: number = 0.1) {
    const graph = core.internalGraph;
    if (graph.order === 0) return;

    let scores: Record<string, number> = {};
    try {
        scores = pagerank(graph);
    } catch (e) {}

    const edgesToRemove: string[] = [];
    
    graph.forEachEdge((edge, attrs, source, target) => {
        const w = (attrs.weight as number) || 0;
        // Protect edges connected to high centrality nodes
        const importance = (scores[source] || 0) + (scores[target] || 0);
        const effectiveThreshold = weightThreshold * (1.0 - Math.min(importance * 5, 0.8));
        
        if (w < effectiveThreshold) {
            edgesToRemove.push(edge);
        }
    });

    edgesToRemove.forEach(e => graph.dropEdge(e));
}
