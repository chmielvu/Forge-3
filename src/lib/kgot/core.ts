
import Graph from 'graphology';
import { z } from 'zod';
import { KnowledgeGraph, KGotNode, KGotEdge } from '../types/kgot';

export class KGotCore {
  private graph: Graph;

  constructor(initial?: KnowledgeGraph) {
    this.graph = new Graph({ multi: true, type: 'directed' });
    if (initial) this.importGraph(initial);
  }

  getGraph(): KnowledgeGraph {
    const nodes: Record<string, KGotNode> = {};
    this.graph.forEachNode((id, attrs) => {
      nodes[id] = {
        id,
        type: (attrs.type as any) || 'ENTITY',
        label: (attrs.label as string) || id,
        attributes: (attrs.attributes as any) || {}
      };
    });

    const edges: KGotEdge[] = this.graph.mapEdges((edge, attrs, source, target) => ({
      source,
      target,
      type: (attrs.type as string) || 'RELATIONSHIP',
      label: (attrs.label as string) || 'related_to',
      weight: (attrs.weight as number) ?? 0.5,
      meta: attrs.meta
    }));

    return {
      nodes,
      edges,
      global_state: this.graph.getAttribute('global_state') as any ?? { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' },
    };
  }

  importGraph(kg: KnowledgeGraph) {
    // Clear existing to avoid duplicates on full reload
    this.graph.clear();
    
    if (kg.nodes) {
      Object.values(kg.nodes).forEach((node) => {
        if (!this.graph.hasNode(node.id)) {
          this.graph.addNode(node.id, {
            type: node.type,
            label: node.label,
            attributes: node.attributes
          });
        }
      });
    }

    if (kg.edges) {
      kg.edges.forEach((edge) => {
        const key = edge.key || `${edge.source}_${edge.target}_${edge.type}`;
        // Ensure nodes exist before adding edge
        if (this.graph.hasNode(edge.source) && this.graph.hasNode(edge.target)) {
            if (!this.graph.hasEdge(key)) {
                this.graph.addEdgeWithKey(key, edge.source, edge.target, {
                    type: edge.type,
                    label: edge.label,
                    weight: edge.weight,
                    meta: edge.meta
                });
            }
        }
      });
    }

    this.graph.setAttribute('global_state', kg.global_state);
  }

  // Snapshot for undo/debug
  snapshot(): KnowledgeGraph {
    return this.getGraph();
  }

  restore(snapshot: KnowledgeGraph) {
    this.graph.clear();
    this.importGraph(snapshot);
  }

  get internalGraph() { return this.graph; } // expose only to trusted modules

  // --- Embeddings Support for GraphRAG ---
  public getNode2VecEmbeddings(dim: number = 16): Record<string, number[]> {
      const nodes = this.graph.nodes();
      const vectors: Record<string, number[]> = {};
      // Simple random projection stub for now - replace with actual Node2Vec if needed later
      // This is sufficient for basic semantic distance in GraphRAG prototype
      nodes.forEach(n => {
          vectors[n] = Array(dim).fill(0).map(() => Math.random());
      });
      return vectors;
  }
}
