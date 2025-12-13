
import { YandereLedger } from '../../types';

// Knowledge Graph of Thoughts (KGoT) Schema
// Version: SOTA 3.5

export type NodeType = 'ENTITY' | 'LOCATION' | 'EVENT' | 'CONCEPT' | 'FACULTY' | 'PREFECT' | 'SUBJECT';

export interface Memory {
  id: string;
  description: string;
  timestamp: number; // Turn number
  emotional_imprint: string; // e.g., "Humiliation", "Triumph"
  involved_entities: string[];
}

export interface KGotNode {
  id: string;
  type: NodeType | string; // String allow for 'faculty', 'prefect' etc from python script
  label: string;
  attributes: {
    ledger?: YandereLedger; // Embedded state for subjects
    archetype?: string;
    dominance?: number;
    manara_gaze?: string;
    voice_id?: string;
    ocean?: { O: number; C: number; E: number; A: number; N: number };
    current_mood?: string;
    kinetic_state?: string;
    manipulation_mode?: string;
    loyalty_score?: number;
    doubt_level?: number;
    obsession_target?: string | null;
    dere_yan_state?: 'dere' | 'yan';
    noir_lighting_state?: string;
    surface_reflectivity?: number;
    architectural_oppression?: number;
    description_abyss?: string;
    
    // Narrative Persistence
    memories?: Memory[];
    grudges?: Record<string, number>; // targetId -> intensity (0-100)
    secrets?: string[];
    
    [key: string]: any;
  };
  provenance?: {
    creator_agent_id: string;
    turn_created: number;
  };
}

export type EdgeType = 'RELATIONSHIP' | 'SPATIAL' | 'TEMPORAL' | 'KNOWLEDGE' | 'TRAUMA_BOND' | 'SECRET_ALLIANCE' | 'GRUDGE';

export interface KGotEdge {
  source: string;
  target: string;
  type: EdgeType | string;
  label: string;
  weight: number; // 0.0 to 1.0
  meta?: {
    tension?: number;
    trope?: string;
    is_secret?: boolean;
    bond_type?: string;
    intensity?: number;
    timestamp?: string;
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
