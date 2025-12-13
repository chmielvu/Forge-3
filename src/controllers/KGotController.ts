import { KnowledgeGraph, KGotNode, KGotEdge, NodeType } from '../lib/types/kgot';

export class KGotController {
  private graph: KnowledgeGraph;

  constructor(initialGraph: KnowledgeGraph) {
    // Deep copy to ensure we don't mutate the previous state reference directly
    // until we are ready to return the new state.
    this.graph = JSON.parse(JSON.stringify(initialGraph));
  }

  public getGraph(): KnowledgeGraph {
    return this.graph;
  }

  public addNode(node: KGotNode): void {
    this.graph.nodes[node.id] = node;
  }

  public removeNode(nodeId: string): void {
    if (this.graph.nodes[nodeId]) {
      delete this.graph.nodes[nodeId];
      // Cleanup edges connected to this node
      this.graph.edges = this.graph.edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      );
    }
  }

  public addEdge(sourceId: string, targetId: string, relation: string, weight: number = 0.5): void {
    // Check if an edge with the same semantic meaning exists
    const existingIndex = this.graph.edges.findIndex(
      e => e.source === sourceId && e.target === targetId && e.label === relation
    );

    if (existingIndex !== -1) {
      // Update existing edge
      this.graph.edges[existingIndex].weight = weight;
    } else {
      // Add new edge
      const newEdge: KGotEdge = {
        source: sourceId,
        target: targetId,
        type: 'RELATIONSHIP', // Default type
        label: relation,
        weight,
        meta: {
          tension: 0,
          is_secret: false
        }
      };
      this.graph.edges.push(newEdge);
    }
  }

  public removeEdge(sourceId: string, targetId: string): void {
    this.graph.edges = this.graph.edges.filter(
      e => !(e.source === sourceId && e.target === targetId)
    );
  }

  /**
   * Applies a delta object (from Director AI) to the graph.
   * Handles loose typing from AI outputs and maps to strict KGoT types.
   */
  public applyDelta(delta: {
    nodes_added?: any[];
    nodes_removed?: string[];
    edges_added?: { source: string; target: string; relation: string; weight: number }[];
    edges_removed?: { source: string; target: string }[];
  }): void {
    
    // 1. Nodes Added
    if (delta.nodes_added && Array.isArray(delta.nodes_added)) {
      delta.nodes_added.forEach(n => {
        // Safe mapping for legacy or messy AI output
        const nodeType = (n.type || (n.group === 'faculty' ? 'ENTITY' : 'LOCATION')) as NodeType;
        const node: KGotNode = {
          id: n.id,
          label: n.label || n.id,
          type: nodeType,
          attributes: n.attributes || { ...n }
        };
        this.addNode(node);
      });
    }

    // 2. Nodes Removed
    if (delta.nodes_removed && Array.isArray(delta.nodes_removed)) {
      delta.nodes_removed.forEach(id => this.removeNode(id));
    }

    // 3. Edges Added
    if (delta.edges_added && Array.isArray(delta.edges_added)) {
      delta.edges_added.forEach(e => {
        if (e.source && e.target && e.relation) {
          this.addEdge(e.source, e.target, e.relation, e.weight);
        }
      });
    }

    // 4. Edges Removed
    if (delta.edges_removed && Array.isArray(delta.edges_removed)) {
      delta.edges_removed.forEach(e => {
        if (e.source && e.target) {
          this.removeEdge(e.source, e.target);
        }
      });
    }
  }
}
