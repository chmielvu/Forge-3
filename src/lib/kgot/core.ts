import Graph from 'graphology';
import { z } from 'zod';
import { KnowledgeGraph, KGotNode, KGotEdge } from '../types/kgot';
import { INITIAL_NODES, INITIAL_LINKS, INITIAL_LEDGER } from '../../constants';

export class KGotCore {
  private graph: Graph;

  constructor(initial?: KnowledgeGraph) {
    this.graph = new Graph({ multi: true, type: 'directed' });
    if (initial) this.importGraph(initial);

    // Auto-bootstrap if graph is empty after initial import
    if (this.graph.order === 0) {
      this.initializeCanonicalNodes();
    }
  }

  getGraph(): KnowledgeGraph {
    const nodes: Record<string, KGotNode> = {};
    // FIX: Explicitly cast `attrs` to `any` to resolve 'unknown' type errors.
    this.graph.forEachNode((id, attrs: any) => {
      nodes[id] = {
        id,
        type: attrs.type || 'ENTITY',
        label: attrs.label || id,
        attributes: attrs.attributes || {}
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
      Object.values(kg.nodes).forEach((node: KGotNode) => { // FIX: Cast node to KGotNode
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

  // --- NEW: Canonical Node Initialization ---
  private initializeCanonicalNodes(): void {
    const muts: any[] = [];

    // 1. Add Nodes from Constants
    INITIAL_NODES.forEach(node => {
        muts.push({
            operation: 'add_node',
            node: {
                id: node.id,
                type: node.group.toUpperCase(), // Map 'faculty' -> 'FACULTY'
                label: node.label,
                attributes: {
                    ...node,
                    // Ensure Ledger is attached to Subject
                    ledger: node.id === 'Subject_84' ? INITIAL_LEDGER : undefined
                }
            }
        });
    });

    // 2. Add Links from Constants
    INITIAL_LINKS.forEach(link => {
        muts.push({
            operation: 'add_edge',
            edge: {
                source: link.source,
                target: link.target,
                type: link.relation.toUpperCase(), // Map 'trauma_bonds' -> 'TRAUMA_BONDS'
                label: link.relation,
                weight: (link.weight || 5) / 10, // Normalize 0-10 to 0.0-1.0
                meta: {
                    tension: link.weight
                }
            }
        });
    });
    
    // Apply initial mutations to THIS graph instance
    // Note: This is a simplified direct application, as applyMutations normally uses a KGotController
    // For bootstrapping, direct graphology methods are acceptable if mutations are simple adds.
    muts.forEach(mut => {
      switch (mut.operation) {
        case 'add_node':
          // FIX: Add checks for mut.node existence
          if (mut.node && mut.node.id && !this.graph.hasNode(mut.node.id)) {
            this.graph.addNode(mut.node.id, mut.node.attributes);
          }
          break;
        case 'add_edge':
          // FIX: Add checks for mut.edge existence
          if (mut.edge && this.graph.hasNode(mut.edge.source) && this.graph.hasNode(mut.edge.target)) {
            const key = mut.edge?.key || `${mut.edge.source}_${mut.edge.target}_${mut.edge.type}`;
            if (!this.graph.hasEdge(key)) {
              this.graph.addEdgeWithKey(key, mut.edge.source, mut.edge.target, mut.edge);
            }
          }
          break;
      }
    });

    // Initial global state (if not already set)
    if (!this.graph.getAttribute('global_state')) {
      this.graph.setAttribute('global_state', { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' });
    }
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