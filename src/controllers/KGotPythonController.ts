
import { GoogleGenAI } from "@google/genai";
import { KnowledgeGraph } from '../lib/types/kgot';
import { YandereLedger } from '../types';

interface PythonGraphResult {
  nodes: any[];
  edges: any[];
  stats?: any;
  hierarchy?: any[];
  conspiracies?: any[];
}

export class KGotPythonController {
  private ai: GoogleGenAI;
  private conversationHistory: any[] = [];
  private isInitialized: boolean = false;
  
  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }
  
  /**
   * Initialize the NetworkX graph with canonical Forge entities
   */
  async initializeGraph(): Promise<KnowledgeGraph> {
    const initCode = `
import networkx as nx
import json
from typing import Dict, List, Any

# Initialize persistent MultiDiGraph (allows multiple edges between nodes)
G = nx.MultiDiGraph()

# === CANONICAL NODES (From Codex) ===

# FACULTY: The Architects of the Soul
faculty_nodes = [
    ("FACULTY_SELENE", {
        "type": "FACULTY",
        "label": "Magistra Selene",
        "archetype": "The Corrupted Matriarch",
        "dominance_level": 1.0,
        "boredom_level": 0.8,
        "manara_gaze": "Bored_God_Complex",
        "core_driver": "Absolute Control",
        "fear": "Irrelevance",
        "memories": []
    }),
    ("FACULTY_LYSANDRA", {
        "type": "FACULTY",
        "label": "Doctor Lysandra",
        "archetype": "The Vivisectionist",
        "dominance_level": 0.85,
        "scientific_curiosity": 0.9,
        "manara_gaze": "Clinical_Observer",
        "core_driver": "Purity of Data",
        "fear": "Contaminated Variables",
        "memories": []
    }),
    ("FACULTY_PETRA", {
        "type": "FACULTY",
        "label": "Inquisitor Petra",
        "archetype": "The Kinetic Artist",
        "dominance_level": 0.95,
        "kinetic_arousal": 0.7,
        "boredom_level": 0.5,
        "manara_gaze": "Predatory_Manic",
        "core_driver": "Kinetic Sadism",
        "fear": "Weakness",
        "memories": []
    }),
    ("FACULTY_CALISTA", {
        "type": "FACULTY",
        "label": "Confessor Calista",
        "archetype": "The Spider",
        "dominance_level": 0.88,
        "maternal_facade_strength": 0.95,
        "manara_gaze": "Sultry_Predator",
        "core_driver": "Emotional Domination",
        "fear": "Exposure",
        "memories": []
    }),
    ("FACULTY_ASTRA", {
        "type": "FACULTY",
        "label": "Doctor Astra",
        "archetype": "The Pain Broker",
        "dominance_level": 0.6,
        "guilt_level": 0.8,
        "manara_gaze": "Weary_Guilt",
        "core_driver": "Moral Deflection",
        "fear": "Complicity",
        "memories": []
    })
]

# PREFECTS: The Honor Students
prefect_nodes = [
    ("PREFECT_ELARA", {
        "type": "PREFECT",
        "label": "Elara",
        "archetype": "The Flinching Zealot",
        "favor_score": 65,
        "loyalty_score": 0.9,
        "anxiety_level": 0.7,
        "manara_gaze": "Wide_Eyed_Fanatic",
        "drive": "Prove ideological purity",
        "secret_weakness": "Horrified by violence she orders",
        "memories": [],
        "grudges": {}
    }),
    ("PREFECT_KAELEN", {
        "type": "PREFECT",
        "label": "Kaelen",
        "archetype": "The Yandere",
        "favor_score": 45,
        "obsession_level": 0.9,
        "dere_yan_state": "dere",
        "manara_gaze": "Yandere_Blank_Stare",
        "drive": "Purify Subject 84",
        "target_of_interest": "Subject_84",
        "memories": [],
        "grudges": {}
    }),
    ("PREFECT_RHEA", {
        "type": "PREFECT",
        "label": "Rhea",
        "archetype": "The Dissident",
        "favor_score": 55,
        "cover_integrity": 0.9,
        "revolutionary_fervor": 0.8,
        "manara_gaze": "Cynical_Guarded",
        "drive": "Undermine Faculty from within",
        "secret_weakness": "Will be executed if exposed",
        "memories": [],
        "grudges": {"FACULTY_SELENE": 90}
    }),
    ("PREFECT_ANYA", {
        "type": "PREFECT",
        "label": "Anya",
        "archetype": "The Nurse",
        "favor_score": 70,
        "ambition_score": 0.9,
        "manara_gaze": "Calculating_Warmth",
        "drive": "Gather intelligence via medical access",
        "secret_weakness": "Empathy is performative",
        "memories": [],
        "grudges": {}
    })
]

# SUBJECTS: The Remedial Class
subject_nodes = [
    ("Subject_84", {
        "type": "SUBJECT",
        "label": "Subject 84 (Player)",
        "archetype": "The Focal Point",
        "ledger": {
            "physicalIntegrity": 100,
            "traumaLevel": 0,
            "shamePainAbyssLevel": 0,
            "hopeLevel": 100,
            "complianceScore": 0
        },
        "memories": [],
        "grudges": {}
    }),
    ("Subject_Nico", {
        "type": "SUBJECT",
        "label": "Nico",
        "archetype": "The Defiant Spark",
        "willpower": 85,
        "compliance": 10,
        "memories": []
    }),
    ("Subject_Darius", {
        "type": "SUBJECT",
        "label": "Darius",
        "archetype": "The Broken Guardian",
        "willpower": 30,
        "compliance": 70,
        "memories": []
    }),
    ("Subject_Silas", {
        "type": "SUBJECT",
        "label": "Silas",
        "archetype": "The Silent Calculator",
        "willpower": 60,
        "compliance": 90,
        "memories": []
    }),
    ("Subject_Theo", {
        "type": "SUBJECT",
        "label": "Theo",
        "archetype": "The Fragile Bird",
        "willpower": 10,
        "compliance": 50,
        "memories": []
    })
]

# LOCATIONS
location_nodes = [
    ("loc_calibration", {
        "type": "LOCATION",
        "label": "The Calibration Chamber",
        "noir_lighting_state": "Clinical_Spotlight",
        "architectural_oppression": 0.95,
        "description_abyss": "A temple of cold iron and silence"
    }),
    ("loc_confessional", {
        "type": "LOCATION",
        "label": "The Velvet Confessional",
        "noir_lighting_state": "Venetian_Blind_Amber",
        "architectural_oppression": 0.4,
        "description_abyss": "A velvet trap of false sanctuary"
    }),
    ("loc_infirmary", {
        "type": "LOCATION",
        "label": "Infirmary",
        "noir_lighting_state": "Clinical_Cold_White",
        "architectural_oppression": 0.5,
        "description_abyss": "The white lie of healing"
    })
]

# Add all nodes
for node_id, attrs in faculty_nodes + prefect_nodes + subject_nodes + location_nodes:
    G.add_node(node_id, **attrs)

# === CANONICAL EDGES (Power Dynamics) ===

# Faculty -> Subject dominance
G.add_edge("FACULTY_SELENE", "Subject_84", key="dominance", type="DOMINANCE", weight=1.0, trope="owns_soul")
G.add_edge("FACULTY_PETRA", "Subject_Nico", key="hunts", type="RIVALRY", weight=0.9, trope="hunts_rival")
G.add_edge("FACULTY_CALISTA", "Subject_Darius", key="trauma_bond", type="TRAUMA_BOND", weight=0.8, trope="weaponized_nurturing")

# Prefect -> Prefect dynamics (TA Competition)
G.add_edge("PREFECT_KAELEN", "PREFECT_ELARA", key="rivalry", type="GRUDGE", weight=0.6, trope="ideological_clash")
G.add_edge("PREFECT_RHEA", "FACULTY_SELENE", key="plots_against", type="SECRET_ALLIANCE", weight=1.0, trope="hidden_resistance")

# Prefect -> Subject (Obsession)
G.add_edge("PREFECT_KAELEN", "Subject_84", key="obsession", type="OBSESSION", weight=1.0, trope="yandere_possession")

# === HELPER FUNCTIONS ===

def add_trauma_bond(source: str, target: str, intensity: float, bond_type: str = "dependency"):
    """Add or update a trauma bond edge"""
    G.add_edge(source, target, key="trauma_bond", type="TRAUMA_BOND", weight=intensity, bond_type=bond_type)
    
def update_ledger(subject_id: str, deltas: Dict[str, float]):
    """Update subject's YandereLedger"""
    if subject_id not in G.nodes:
        return
    ledger = G.nodes[subject_id].get("ledger", {})
    for key, delta in deltas.items():
        if key in ledger and isinstance(ledger[key], (int, float)):
            ledger[key] = max(0, min(100, ledger[key] + delta))
    G.nodes[subject_id]["ledger"] = ledger

def add_memory(node_id: str, description: str, emotional_imprint: str, involved: List[str]):
    """Add a memory to a node"""
    if node_id not in G.nodes:
        return
    memories = G.nodes[node_id].get("memories", [])
    memories.append({
        "description": description,
        "emotional_imprint": emotional_imprint,
        "involved_entities": involved
    })
    # Keep last 20 memories
    G.nodes[node_id]["memories"] = memories[-20:]

def update_grudge(holder_id: str, target_id: str, delta: float):
    """Update grudge intensity"""
    if holder_id not in G.nodes:
        return
    grudges = G.nodes[holder_id].get("grudges", {})
    grudges[target_id] = max(0, min(100, grudges.get(target_id, 0) + delta))
    G.nodes[holder_id]["grudges"] = grudges
    
    # Add edge if grudge is strong
    if grudges[target_id] > 50:
        G.add_edge(holder_id, target_id, key="grudge", type="GRUDGE", weight=grudges[target_id]/100, trope="burning_hatred")

def get_social_hierarchy() -> List[tuple]:
    """Calculate PageRank for social dominance"""
    ranks = nx.pagerank(G, weight='weight')
    return sorted(ranks.items(), key=lambda x: x[1], reverse=True)

def detect_conspiracies() -> List[List[str]]:
    """Find connected components of secret alliances"""
    secret_subgraph = G.edge_subgraph([
        (u, v, k) for u, v, k, d in G.edges(keys=True, data=True) 
        if d.get('type') == 'SECRET_ALLIANCE'
    ])
    return [list(comp) for comp in nx.weakly_connected_components(secret_subgraph)]

def calculate_dominance_path(source: str, target: str) -> List[str]:
    """Find shortest dominance path using Dijkstra"""
    try:
        # Invert weights for Dijkstra (high weight = low cost)
        def weight_fn(u, v, d):
            return 1 - d.get('weight', 0.5)
        path = nx.shortest_path(G, source, target, weight=weight_fn)
        return path
    except nx.NetworkXNoPath:
        return []

def get_graph_state() -> Dict[str, Any]:
    """Serialize graph for TypeScript"""
    return {
        "nodes": [{"id": n, **G.nodes[n]} for n in G.nodes()],
        "edges": [
            {"source": u, "target": v, "key": k, **data} 
            for u, v, k, data in G.edges(keys=True, data=True)
        ],
        "stats": {
            "node_count": G.number_of_nodes(),
            "edge_count": G.number_of_edges(),
            "density": nx.density(G) if G.number_of_nodes() > 1 else 0
        }
    }

# Return initial state
print(json.dumps(get_graph_state()))
`;

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: initCode }] }],
      config: {
        tools: [{ codeExecution: {} }]
      }
    });

    this.conversationHistory.push(
      { role: 'user', parts: [{ text: initCode }] },
      result.candidates[0].content
    );
    
    this.isInitialized = true;
    const graphData = this.parseCodeOutput(result);
    
    return this.convertToKnowledgeGraph(graphData);
  }
  
  /**
   * Apply mutations from Director AI
   */
  async updateGraph(mutations: any[]): Promise<KnowledgeGraph> {
    if (!this.isInitialized) {
      throw new Error("Graph not initialized. Call initializeGraph() first.");
    }

    const updateCode = `
# Apply mutations from Director
mutations = ${JSON.stringify(mutations)}

for mut in mutations:
    op = mut['operation']
    params = mut['params']
    
    if op == 'add_edge':
        G.add_edge(
            params['source'], 
            params['target'],
            key=params.get('relation', 'relationship'),
            type=params.get('type', 'RELATIONSHIP'),
            weight=params.get('weight', 0.5),
            trope=params.get('trope', '')
        )
        
    elif op == 'update_node':
        node_id = params['id']
        if node_id in G.nodes:
            for key, value in params.items():
                if key != 'id':
                    G.nodes[node_id][key] = value
                    
    elif op == 'add_node':
        node_id = params['id']
        node_type = params.get('type', 'ENTITY')
        label = params.get('label', node_id)
        attrs = params.get('attributes', {})
        G.add_node(node_id, type=node_type, label=label, **attrs)
        
    elif op == 'add_memory':
        add_memory(
            params['id'], 
            params['description'],
            params['emotional_imprint'],
            params.get('involved_entities', [])
        )
        
    elif op == 'update_grudge':
        update_grudge(params['source'], params['target'], params['delta'])
        
    elif op == 'update_ledger':
        update_ledger(params['subject_id'], params['deltas'])
        
    elif op == 'add_trauma_bond':
        add_trauma_bond(
            params['source'], 
            params['target'], 
            params['intensity'],
            params.get('bond_type', 'dependency')
        )

print(json.dumps(get_graph_state()))
`;

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...this.conversationHistory,
        { role: 'user', parts: [{ text: updateCode }] }
      ],
      config: {
        tools: [{ codeExecution: {} }]
      }
    });
    
    this.conversationHistory.push(
      { role: 'user', parts: [{ text: updateCode }] },
      result.candidates[0].content
    );
    
    const graphData = this.parseCodeOutput(result);
    return this.convertToKnowledgeGraph(graphData);
  }
  
  /**
   * Calculate social hierarchy using PageRank
   */
  async calculateSocialHierarchy(): Promise<Array<[string, number]>> {
    const code = `
hierarchy = get_social_hierarchy()
print(json.dumps(hierarchy[:15]))  # Top 15
`;
    
    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...this.conversationHistory,
        { role: 'user', parts: [{ text: code }] }
      ],
      config: {
        tools: [{ codeExecution: {} }]
      }
    });
    
    return this.parseCodeOutput(result) as Array<[string, number]>;
  }
  
  /**
   * Detect conspiracy networks (secret alliances)
   */
  async detectConspiracies(): Promise<string[][]> {
    const code = `
conspiracies = detect_conspiracies()
print(json.dumps(conspiracies))
`;
    
    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...this.conversationHistory,
        { role: 'user', parts: [{ text: code }] }
      ],
      config: {
        tools: [{ codeExecution: {} }]
      }
    });
    
    return this.parseCodeOutput(result) as string[][];
  }
  
  /**
   * Find dominance path between two entities
   */
  async calculateDominancePath(source: string, target: string): Promise<string[]> {
    const code = `
path = calculate_dominance_path("${source}", "${target}")
print(json.dumps(path))
`;
    
    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...this.conversationHistory,
        { role: 'user', parts: [{ text: code }] }
      ],
      config: {
        tools: [{ codeExecution: {} }]
      }
    });
    
    return this.parseCodeOutput(result) as string[];
  }
  
  /**
   * Export graph state for save/load
   */
  async exportState(): Promise<any> {
    const code = `print(json.dumps(get_graph_state()))`;
    
    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...this.conversationHistory,
        { role: 'user', parts: [{ text: code }] }
      ],
      config: {
        tools: [{ codeExecution: {} }]
      }
    });
    
    return this.parseCodeOutput(result);
  }
  
  /**
   * Parse Code Execution output
   */
  private parseCodeOutput(result: any): any {
    const parts = result.candidates[0].content.parts;
    const execPart = parts.find((p: any) => p.executableCode || p.codeExecutionResult);
    
    if (execPart?.codeExecutionResult?.output) {
      try {
        return JSON.parse(execPart.codeExecutionResult.output);
      } catch (e) {
        console.error("[KGotPython] Failed to parse output:", execPart.codeExecutionResult.output);
        return null;
      }
    }
    return null;
  }
  
  /**
   * Convert Python graph data to TypeScript KnowledgeGraph type
   */
  private convertToKnowledgeGraph(data: PythonGraphResult): KnowledgeGraph {
    const nodes: Record<string, any> = {};
    if (data && data.nodes) {
      data.nodes.forEach((n: any) => {
        const { id, ...attributes } = n;
        nodes[id] = {
          id,
          type: attributes.type || 'ENTITY',
          label: attributes.label || id,
          attributes
        };
      });
    }
    
    return {
      nodes,
      edges: (data?.edges || []).map((e: any) => ({
        source: e.source,
        target: e.target,
        type: e.type || 'RELATIONSHIP',
        label: e.key || e.type || 'relationship',
        weight: e.weight || 0.5,
        meta: { trope: e.trope, ...e }
      })),
      global_state: {
        turn_count: 0,
        tension_level: 0,
        narrative_phase: 'ACT_1'
      }
    };
  }
}
