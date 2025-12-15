
import type { KGotCore } from './core';

// Strict Entity Map for O(1) Resolution - Centralized here
export const ENTITY_MAP: Record<string, string> = {
    "selene": "FACULTY_SELENE",
    "provost": "FACULTY_SELENE",
    "magistra": "FACULTY_SELENE",
    "petra": "FACULTY_PETRA",
    "inquisitor": "FACULTY_PETRA",
    "lysandra": "FACULTY_LOGICIAN",
    "logician": "FACULTY_LOGICIAN",
    "calista": "FACULTY_CONFESSOR",
    "confessor": "FACULTY_CONFESSOR",
    "astra": "FACULTY_ASTRA",
    "elara": "PREFECT_LOYALIST",
    "kaelen": "PREFECT_OBSESSIVE",
    "rhea": "PREFECT_DISSIDENT",
    "anya": "PREFECT_NURSE",
    "nico": "Subject_Nico",
    "darius": "Subject_Darius",
    "silas": "Subject_Silas",
    "theo": "Subject_Theo",
    "subject": "Subject_84",
    "player": "Subject_84",
    "me": "Subject_84",
    "infirmary": "loc_infirmary",
    "clinic": "loc_infirmary",
    "dock": "The Arrival Dock"
};

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function calculateScore(query: string, text: string): number {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    
    if (t === q) return 1.0;
    if (t.includes(q)) return 0.8;
    
    // Token overlap
    const qTokens = q.split(/\s+/);
    const tTokens = t.split(/\s+/);
    let matchCount = 0;
    
    for (const qt of qTokens) {
        if (tTokens.some(tt => tt.includes(qt) || levenshtein(qt, tt) <= 2)) {
            matchCount++;
        }
    }
    
    if (matchCount > 0) {
        return 0.5 + (matchCount / qTokens.length) * 0.4;
    }

    return 0;
}

export function fuzzyResolve(core: KGotCore, nameOrId: string): string | null {
  if (!nameOrId) return null;
  const graph = core.internalGraph;
  
  // 1. Exact ID Match
  if (graph.hasNode(nameOrId)) return nameOrId;

  const lower = nameOrId.toLowerCase().trim();

  // 2. Direct Map Lookup
  if (ENTITY_MAP[lower]) return ENTITY_MAP[lower];

  // 3. Graph Scanning (Labels & Attributes)
  let bestMatchId: string | null = null;
  let maxScore = 0;
  const THRESHOLD = 0.6;

  graph.forEachNode((id, attrs) => {
      let currentMax = 0;

      // Check ID
      currentMax = Math.max(currentMax, calculateScore(lower, id));
      
      // Check Label
      if (attrs.label && typeof attrs.label === 'string') {
          currentMax = Math.max(currentMax, calculateScore(lower, attrs.label));
      }

      // Check Specific Attributes (Archetype, Type)
      if (attrs.type && typeof attrs.type === 'string') {
           if (lower.includes(attrs.type.toLowerCase())) currentMax = Math.max(currentMax, 0.7);
      }
      
      const agentState = attrs.attributes?.agent_state;
      if (agentState?.archetype) {
          currentMax = Math.max(currentMax, calculateScore(lower, agentState.archetype));
      }

      if (currentMax > maxScore) {
          maxScore = currentMax;
          bestMatchId = id;
      }
  });

  if (maxScore > THRESHOLD) {
      return bestMatchId;
  }

  return null;
}
