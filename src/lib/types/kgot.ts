// Knowledge Graph of Thoughts (KGoT) Schema
// Version: SOTA 3.4

export type NodeType = 'ENTITY' | 'LOCATION' | 'EVENT' | 'CONCEPT';

export interface KGotNode {
  id: string;
  type: NodeType;
  label: string;
  attributes: Record<string, any>;
  provenance?: {
    creator_agent_id: string;
    turn_created: number;
  };
}

export type EdgeType = 'RELATIONSHIP' | 'SPATIAL' | 'TEMPORAL' | 'KNOWLEDGE';

export interface KGotEdge {
  source: string;
  target: string;
  type: EdgeType;
  label: string;
  weight: number; // 0.0 to 1.0
  meta?: {
    tension?: number;
    trope?: string;
    is_secret?: boolean;
  };
}

export interface KnowledgeGraph {
  nodes: Record<string, KGotNode>;
  edges: KGotEdge[];
  global_state: {
    turn_count: number;
    tension_level: number;
    narrative_phase: 'ACT_1' | 'ACT_2' | 'ACT_3';
  };
}