
import { YandereLedger } from '../types';
import { KnowledgeGraph, KGotNode, KGotEdge } from '@/lib/types/kgot';

/**
 * Safely updates the ledger with clamping logic for 0-100 ranges
 */
export const updateLedgerHelper = (current: YandereLedger, updates: Partial<YandereLedger>): YandereLedger => {
  const next = { ...current, ...updates };
  
  // Deep merge traumaBonds
  if (updates.traumaBonds) {
    next.traumaBonds = {
      ...current.traumaBonds,
      ...updates.traumaBonds
    };
  }

  // Clamp vital stats 0-100
  next.physicalIntegrity = Math.max(0, Math.min(100, next.physicalIntegrity || 100));
  next.traumaLevel = Math.max(0, Math.min(100, next.traumaLevel || 0));
  next.shamePainAbyssLevel = Math.max(0, Math.min(100, next.shamePainAbyssLevel || 0));
  next.hopeLevel = Math.max(0, Math.min(100, next.hopeLevel || 0));
  next.complianceScore = Math.max(0, Math.min(100, next.complianceScore || 0));
  
  return next;
};

/**
 * Reconciles graph updates (add/remove nodes and edges) without duplicates.
 * Adapted for KGotNode and KGotEdge.
 */
export const reconcileGraphHelper = (
  currentNodes: Record<string, KGotNode>, 
  currentEdges: KGotEdge[], 
  updates?: any // Using any to bridge legacy DirectorOutput type
): { nodes: Record<string, KGotNode>, edges: KGotEdge[] } => {
  
  if (!updates) return { nodes: currentNodes, edges: currentEdges };

  const nextNodes = { ...currentNodes };
  let nextEdges = [...currentEdges];

  // 1. Node Additions/Updates
  if (updates.nodes_added) {
    updates.nodes_added.forEach((newNode: any) => {
        // Map legacy GraphNode to KGotNode structure if needed
        const kgotNode: KGotNode = {
            id: newNode.id,
            type: newNode.group === 'faculty' ? 'ENTITY' : 'LOCATION', // Simple inference
            label: newNode.label,
            attributes: { ...newNode }
        };
        nextNodes[newNode.id] = kgotNode;
    });
  }

  // 2. Node Removals
  if (updates.nodes_removed) {
    updates.nodes_removed.forEach((id: string) => {
        delete nextNodes[id];
    });
    // Remove connected edges
    nextEdges = nextEdges.filter(e => nextNodes[e.source] && nextNodes[e.target]);
  }

  // 3. Edge Additions/Updates
  if (updates.edges_added) {
    updates.edges_added.forEach((newEdge: any) => {
      const index = nextEdges.findIndex(e => e.source === newEdge.source && e.target === newEdge.target);
      const kgotEdge: KGotEdge = {
          source: newEdge.source,
          target: newEdge.target,
          type: 'RELATIONSHIP',
          label: newEdge.relation,
          weight: newEdge.weight
      };

      if (index > -1) {
        nextEdges[index] = kgotEdge;
      } else {
        nextEdges.push(kgotEdge);
      }
    });
  }

  return { nodes: nextNodes, edges: nextEdges };
};