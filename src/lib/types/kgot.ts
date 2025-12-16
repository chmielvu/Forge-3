

import { YandereLedger, PrefectPsychometrics } from '../../types';

// Knowledge Graph of Thoughts (KGoT) Schema
// Version: SOTA 3.8 - Graphology Integration with Manara-Noir

export type NodeType = 'ENTITY' | 'LOCATION' | 'EVENT' | 'CONCEPT' | 'FACULTY' | 'PREFECT' | 'SUBJECT' | 'INJURY' | 'SECRET';

export interface Memory {
  id: string;
  description: string;
  timestamp: number; // Turn number
  emotional_imprint: string; // e.g., "Humiliation", "Triumph"
  involved_entities: string[];
}

export interface AgentState {
  // Generic
  archetype: string;
  current_mood: string;
  dominance_level: number; // 0.0 - 1.0
  voice_id: string;
  
  // Faculty Specific
  boredom_level?: number; // Selene/Petra
  kinetic_arousal?: number; // Petra
  scientific_curiosity?: number; // Lysandra
  maternal_facade_strength?: number; // Calista
  guilt_level?: number; // Astra
  
  // Prefect Specific
  loyalty_score?: number; // Elara
  anxiety_level?: number; // Elara/Rhea
  obsession_level?: number; // Kaelen
  jealousy_meter?: number; // Kaelen
  dere_yan_state?: 'dere' | 'yan'; // Kaelen
  cover_integrity?: number; // Rhea
  revolutionary_fervor?: number; // Rhea
  ambition_score?: number; // Anya
  
  // Tracking
  target_of_interest?: string | null;
  active_schemes?: string[];
  
  // New Emotional States
  arousal?: number;
  dominance?: number;

  // Simulation Data
  emotional_vector?: {
      paranoia: number;
      desperation: number;
      confidence: number;
      arousal?: number;
      dominance?: number;
  };
  last_action?: string;
}

export interface KGotNode {
  id: string;
  type: NodeType | string;
  label: string;
  attributes: {
    // Subject State
    ledger?: YandereLedger; 
    
    // Agent State (Flattened for easier graph queries, or structured)
    agent_state?: AgentState;

    // Visuals
    manara_gaze?: string;
    noir_lighting_state?: string;
    surface_reflectivity?: number;
    architectural_oppression?: number;
    description_abyss?: string;
    
    // Narrative Persistence
    memories?: Memory[];
    grudges?: Record<string, number>; // targetId -> intensity (0-100)
    secrets?: Array<{ name: string; description: string; discoveredBy?: string; turn?: number }>; 
    
    // Character-Specific Richness (From PrefectDNA)
    psychometrics?: PrefectPsychometrics; 
    appearanceDescription?: string; 
    narrativeFunctionDescription?: string;
    promptKeywords?: string[]; 
    visualDNA?: string; 
    somaticSignature?: string; 

    // Legacy/Flexibility
    [key: string]: any;
  };
  provenance?: {
    creator_agent_id: string;
    turn_created: number;
  };
}

export type EdgeType = 'RELATIONSHIP' | 'SPATIAL' | 'TEMPORAL' | 'KNOWLEDGE' | 'TRAUMA_BOND' | 'SECRET_ALLIANCE' | 'GRUDGE' | 'OBSESSION' | 'AFFLICTS' | 'CAUSED_BY' | 'DISCOVERED';

export interface KGotEdge {
  key?: string; // Support for MultiGraph keys
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
    narrative_summary?: string; // New: Long-term narrative memory vector
  };
}