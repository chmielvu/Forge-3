
import { PrefectAgent } from '../lib/agents/PrefectAgent';
import { initializePrefects } from '../lib/agents/PrefectGenerator';
import { PrefectDNA, PrefectThought, FilteredSceneContext, GameState, YandereLedger, CharacterId } from '../types';
import { KnowledgeGraph } from '../lib/types/kgot';

export class PrefectManager {
  private agents: Map<string, PrefectAgent> = new Map();
  private prefectsDNA: PrefectDNA[] = [];

  constructor() {
    // Lazy init via initialize()
  }

  public initialize(seed: number) {
    this.prefectsDNA = initializePrefects(seed);
    this.prefectsDNA.forEach(dna => {
      this.agents.set(dna.id, new PrefectAgent(dna));
    });
    console.log(`[PrefectManager] Initialized ${this.agents.size} prefects with seed ${seed}`);
  }

  public loadState(prefects: PrefectDNA[]) {
    this.prefectsDNA = prefects;
    this.agents.clear();
    this.prefectsDNA.forEach(dna => {
      this.agents.set(dna.id, new PrefectAgent(dna));
    });
    console.log(`[PrefectManager] Loaded state for ${this.agents.size} prefects`);
  }

  public getPrefects(): PrefectDNA[] {
    return this.prefectsDNA;
  }

  /**
   * Calculates attention scores to determine which prefects are active.
   * Based on ledger state, previous interactions, and archetype drives.
   */
  private calculateAttentionScores(ledger: YandereLedger): Map<string, number> {
    const scores = new Map<string, number>();

    this.prefectsDNA.forEach(p => {
        let score = 0.1; // Base existence score

        // --- DYNAMIC LEDGER REACTIVITY ---
        
        // 1. High Trauma -> Attracts 'The Nurse' (Anya) and 'The Voyeur'
        // Simulates attraction to vulnerability (Calista/Anya dynamic)
        if (ledger.traumaLevel > 60) {
            if (p.archetype === 'The Nurse') score += 0.6; // High priority: Wants to "heal" (interrogate)
            if (p.archetype === 'The Voyeur') score += 0.3; // Drawn to the spectacle of suffering
        }

        // 2. Low Compliance -> Attracts 'The Zealot' (Elara) and 'The Sadist'
        // Simulates attraction to defiance (Petra/Elara dynamic)
        if (ledger.complianceScore < 40) {
             if (p.archetype === 'The Zealot') score += 0.5; // Must enforce order
             if (p.archetype === 'The Sadist') score += 0.4; // Wants to punish
        }

        // --- ARCHETYPE SPECIFIC LOGIC ---
        switch (p.archetype) {
            case 'The Yandere':
                // Kaelen is always watching, but more intense if player is "impure" (low compliance) or hurt (high trauma)
                score += 0.4; 
                if (ledger.complianceScore < 30) score += 0.2;
                if (ledger.traumaLevel > 50) score += 0.2; // Wants to "protect"
                break;
                
            case 'The Zealot':
                // Elara appears when rules are broken (low compliance)
                if (ledger.fearOfAuthority < 30) score += 0.3;
                break;
                
            case 'The Nurse':
                // Anya appears when trauma/pain is high
                if (ledger.physicalIntegrity < 60) score += 0.4;
                break;
                
            case 'The Sadist':
                // Drawn to high physical integrity (fresh meat) 
                if (ledger.physicalIntegrity > 80) score += 0.3;
                break;
                
            case 'The Dissident':
                // Rhea appears in "cracks" - mid-range chaos
                if (ledger.hopeLevel > 40 && ledger.complianceScore > 40) score += 0.4;
                break;
                
            case 'The Voyeur':
                // Always moderate chance
                score += 0.2;
                break;
                
            case 'The Parasite':
                // Drawn to high favor scores (success)
                if (ledger.complianceScore > 70) score += 0.3;
                break;
                
            default:
                score += 0.1;
        }

        // 3. Persistence (Keep them active if they have high favor/momentum)
        if (p.favorScore > 70) score += 0.2; // Faculty favorites get screen time
        if (p.currentEmotionalState && p.currentEmotionalState.paranoia > 0.7) score += 0.2; // Paranoid agents act out

        scores.set(p.id, score);
    });

    return scores;
  }

  /**
   * Selects a subset of prefects to act in the current scene.
   * Uses weighted random selection based on Attention Scores.
   */
  private selectActivePrefects(ledger: YandereLedger, count: number = 2): PrefectAgent[] {
    const scores = this.calculateAttentionScores(ledger);
    const pool = Array.from(this.agents.values());
    
    // Weighted sort
    const sortedPool = pool.sort((a, b) => {
        const scoreA = scores.get(a.dna.id) || 0;
        const scoreB = scores.get(b.dna.id) || 0;
        // Add randomness to prevent stagnation
        return (scoreB + Math.random() * 0.3) - (scoreA + Math.random() * 0.3);
    });

    return sortedPool.slice(0, count);
  }

  public async simulateTurn(
    gameState: GameState,
    narrativeHistory: string[],
    playerInput: string,
    kgot: KnowledgeGraph
  ): Promise<{ thoughts: PrefectThought[], updatedDNA: PrefectDNA[] }> {
    
    // 1. Select Agents
    const activeAgents = this.selectActivePrefects(gameState.ledger, 3);
    
    // SORT by Initiative (Ambition)
    // High ambition/dominant agents act first, forcing reactive agents to adapt or sabotage.
    activeAgents.sort((a, b) => b.dna.traitVector.ambition - a.dna.traitVector.ambition);
    
    // 2. Build Base Context
    const sceneContextBase = this.buildSceneContext(gameState, narrativeHistory, playerInput, kgot);
    
    const thoughts: PrefectThought[] = [];

    // 3. Run Agents (Sequential Execution for Reactivity)
    // We iterate sequentially so that later agents can see the PLANNED actions of earlier agents.
    for (const agent of activeAgents) {
        
        // Construct 'Other Prefects' context
        const othersInScene = activeAgents
            .filter(a => a.dna.id !== agent.dna.id)
            .map(a => {
                const threat = this.calculateThreat(agent.dna, a.dna);
                return {
                    id: a.dna.id,
                    name: a.dna.displayName,
                    // CRITICAL: We use 'lastPublicAction' which is updated immediately in this loop.
                    // This allows Agent B to see what Agent A *just decided to do* in this turn.
                    recentActions: a.dna.lastPublicAction || "Entering the scene",
                    favorScore: a.dna.favorScore,
                    perceivedThreat: threat
                };
            });

        // NEW: Calculate specific KGoT relationships to player (Subject 84)
        const subjectRelationships = kgot.edges
            .filter(e => 
                (e.source === agent.dna.id && e.target === CharacterId.PLAYER) || 
                (e.target === agent.dna.id && e.source === CharacterId.PLAYER)
            )
            .map(e => {
                const type = e.type === 'RELATIONSHIP' ? e.label : e.type;
                const direction = e.source === agent.dna.id ? "OUTGOING" : "INCOMING";
                // If it has a specific trope or meta description, use it
                const detail = e.meta?.trope || e.meta?.bond_type || e.label || "";
                const intensity = e.weight !== undefined ? `(Intensity: ${(e.weight * 100).toFixed(0)}%)` : "";
                return `[${type}] ${detail} ${intensity} (${direction})`;
            });

        const context: FilteredSceneContext = {
            ...sceneContextBase,
            yourFavorScore: agent.dna.favorScore,
            otherPrefects: othersInScene,
            subjectRelationships
        };

        const thought = await agent.think(context);
        thoughts.push(thought);

        // --- UPDATE STATE IMMEDIATELY ---
        // This ensures the next agent in the loop sees this agent's new action.
        agent.dna.currentEmotionalState = thought.emotionalState;
        agent.dna.lastPublicAction = thought.publicAction;

        // Apply Favor Delta
        if (thought.favorScoreDelta) {
            agent.dna.favorScore = Math.max(0, Math.min(100, agent.dna.favorScore + thought.favorScoreDelta));
        }
        
        // NEW: Update Knowledge (Internal Memory)
        if (thought.secretsUncovered && thought.secretsUncovered.length > 0) {
            agent.dna.knowledge = [
                ...(agent.dna.knowledge || []), 
                ...thought.secretsUncovered
            ];
            // Dedupe and Limit
            agent.dna.knowledge = [...new Set(agent.dna.knowledge)].slice(-10);
        }

        // --- RELATIONSHIP DYNAMICS (Sabotage/Alliance) ---
        
        // Handle Sabotage
        if (thought.sabotageAttempt) {
            const targetId = this.findAgentIdByName(thought.sabotageAttempt.target);
            if (targetId) {
                // Actor acts against Target: Relationship degrades
                this.updateRelationship(agent.dna.id, targetId, -0.3);
                // Target hates Actor for it (Mutual animosity)
                this.updateRelationship(targetId, agent.dna.id, -0.4);
                
                // Append cue to public action for subsequent agents and Director
                agent.dna.lastPublicAction += ` [SABOTAGING: ${thought.sabotageAttempt.target}]`;
                
                // Slight favor penalty for low deniability sabotage?
                if (thought.sabotageAttempt.deniability < 0.5) {
                    agent.dna.favorScore = Math.max(0, agent.dna.favorScore - 2); 
                }
            }
        }

        // Handle Alliance
        if (thought.allianceSignal) {
             const targetId = this.findAgentIdByName(thought.allianceSignal.target);
             if (targetId) {
                 // Actor signals Target: Relationship improves
                 this.updateRelationship(agent.dna.id, targetId, 0.2);
                 // Target potentially reciprocates (smaller amount until they act)
                 this.updateRelationship(targetId, agent.dna.id, 0.1);
                 
                 agent.dna.lastPublicAction += ` [SIGNALING: ${thought.allianceSignal.target}]`;
             }
        }
    }

    return { thoughts, updatedDNA: this.prefectsDNA };
  }

  /**
   * Calculates threat level (0.0 - 1.0) based on Favor differential, Rivalry status, and Traits.
   */
  private calculateThreat(me: PrefectDNA, them: PrefectDNA): number {
    let threat = 0.0;
    
    // 1. Favor Score Differential (The Zero-Sum Game)
    const favorDiff = them.favorScore - me.favorScore;
    if (favorDiff > 15) threat += 0.4; // They are significantly ahead
    else if (favorDiff > 0) threat += 0.2;
    
    // 2. Relationship Status
    const relationship = me.relationships[them.id] || 0;
    if (relationship < -0.5) threat += 0.3; // Bitter enemy
    else if (relationship < -0.1) threat += 0.1; // Rival
    else if (relationship > 0.5) threat -= 0.2; // Trusted ally (reduces threat)

    // 3. Trait-Based Threat (Ambition/Cunning agents are dangerous)
    if (them.traitVector.ambition > 0.8) threat += 0.1;
    if (them.traitVector.cunning > 0.8) threat += 0.1;
    if (them.archetype === 'The Parasite') threat += 0.2; // Parasites are threats to everyone

    return Math.min(1.0, Math.max(0, threat));
  }

  private findAgentIdByName(name: string): string | undefined {
      const n = name.toLowerCase();
      const agent = this.prefectsDNA.find(p => p.displayName.toLowerCase().includes(n));
      return agent?.id;
  }

  private updateRelationship(sourceId: string, targetId: string, delta: number) {
      const agent = this.prefectsDNA.find(p => p.id === sourceId);
      if (agent) {
          const current = agent.relationships[targetId] || 0;
          agent.relationships[targetId] = Math.max(-1.0, Math.min(1.0, current + delta));
      }
  }

  private buildSceneContext(
    gameState: GameState, 
    history: string[], 
    input: string,
    kgot: KnowledgeGraph
  ): Omit<FilteredSceneContext, 'yourFavorScore' | 'otherPrefects' | 'subjectRelationships'> {
    
    // 1. Extract Faculty Presence & Mood from KGoT
    const facultyNodes = Object.values(kgot.nodes).filter(n => n.type === 'FACULTY');
    const facultyPresent = facultyNodes.length > 0 
        ? facultyNodes.map(n => n.label) 
        : ["Provost Selene", "Inquisitor Petra"];

    // Aggregate mood from faculty agent states
    const facultyMoods = facultyNodes
        .map(n => n.attributes.agent_state?.current_mood)
        .filter(m => m !== undefined) as string[];
    const facultyMood = facultyMoods.length > 0 
        ? facultyMoods.join(", ") 
        : (gameState.ledger.complianceScore < 30 ? "Hostile" : "Watchful");

    // 2. Extract Recent Memories (Narrative Events)
    const currentTurn = kgot.global_state.turn_count;
    const recentMemories = Object.values(kgot.nodes)
        .flatMap(n => n.attributes.memories || [])
        // Get memories from the last 5 turns
        .filter(m => m.timestamp >= currentTurn - 5) 
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(m => `[EVENT]: ${m.description} (${m.emotional_imprint})`);

    // 3. Extract High-Tension Relationships (Grudges/Alliances) from Graph Edges
    const relationshipEvents = kgot.edges
        .filter(e => (e.type === 'GRUDGE' || e.type === 'SECRET_ALLIANCE') && e.weight > 0.5)
        .map(e => {
             const source = kgot.nodes[e.source]?.label || e.source;
             const target = kgot.nodes[e.target]?.label || e.target;
             return `[RELATIONSHIP]: ${source} has ${e.type} with ${target} (Intensity: ${(e.weight * 100).toFixed(0)}%)`;
        });

    return {
        description: history.slice(-1)[0] || "The session begins.",
        location: gameState.location,
        timeOfDay: "Evening",
        yourRecentActions: [input],
        facultyPresent,
        facultyMood,
        playerTrauma: gameState.ledger.traumaLevel / 100,
        // Inject rich dynamic context
        recentRituals: [...recentMemories, ...relationshipEvents].slice(0, 8), 
        sceneFlags: gameState.ledger.traumaLevel > 80 ? ["CRITICAL_TRAUMA"] : []
    };
  }
}

export const prefectManager = new PrefectManager();
