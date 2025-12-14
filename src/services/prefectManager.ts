
import { PrefectAgent } from '../lib/agents/PrefectAgent';
import { initializePrefects } from '../lib/agents/PrefectGenerator';
import { PrefectDNA, PrefectThought, FilteredSceneContext, GameState, YandereLedger, CharacterId, LogEntry } from '../types';
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
        if (ledger.traumaLevel > 60) {
            if (p.archetype === 'The Nurse') score += 0.6;
            if (p.archetype === 'The Voyeur') score += 0.3;
        }

        if (ledger.complianceScore < 40) {
             if (p.archetype === 'The Zealot') score += 0.5;
             if (p.archetype === 'The Sadist') score += 0.4;
        }

        // --- ARCHETYPE SPECIFIC LOGIC ---
        switch (p.archetype) {
            case 'The Yandere':
                score += 0.4; 
                if (ledger.complianceScore < 30) score += 0.2;
                if (ledger.traumaLevel > 50) score += 0.2;
                break;
            case 'The Zealot':
                if (ledger.fearOfAuthority < 30) score += 0.3;
                break;
            case 'The Nurse':
                if (ledger.physicalIntegrity < 60) score += 0.4;
                break;
            case 'The Sadist':
                if (ledger.physicalIntegrity > 80) score += 0.3;
                break;
            case 'The Dissident':
                if (ledger.hopeLevel > 40 && ledger.complianceScore > 40) score += 0.4;
                break;
            case 'The Voyeur':
                score += 0.2;
                break;
            case 'The Parasite':
                if (ledger.complianceScore > 70) score += 0.3;
                break;
            default:
                score += 0.1;
        }

        if (p.favorScore > 70) score += 0.2;
        if (p.currentEmotionalState && p.currentEmotionalState.paranoia > 0.7) score += 0.2;

        scores.set(p.id, score);
    });

    return scores;
  }

  /**
   * Selects a subset of prefects to act in the current scene.
   */
  private selectActivePrefects(ledger: YandereLedger, count: number = 2): PrefectAgent[] {
    const scores = this.calculateAttentionScores(ledger);
    const pool = Array.from(this.agents.values());
    
    const sortedPool = pool.sort((a, b) => {
        const scoreA = scores.get(a.dna.id) || 0;
        const scoreB = scores.get(b.dna.id) || 0;
        return (scoreB + Math.random() * 0.3) - (scoreA + Math.random() * 0.3);
    });

    return sortedPool.slice(0, count);
  }

  /**
   * PARALLEL simulation with retry logic
   */
  public async simulateTurn(
    gameState: GameState,
    narrativeHistory: string[],
    playerInput: string,
    kgot: KnowledgeGraph,
    logCallback?: (log: LogEntry) => void
  ): Promise<{ thoughts: PrefectThought[], updatedDNA: PrefectDNA[] }> {
    
    // 1. Select top 3 agents by attention scores
    const activeAgents = this.selectActivePrefects(gameState.ledger, 3);
    
    // 2. Build base context
    const sceneContextBase = this.buildSceneContext(gameState, narrativeHistory, playerInput, kgot);
    
    // 3. PARALLEL EXECUTION with retry wrapper
    const thoughtPromises = activeAgents.map(async (agent) => {
      const othersInScene = activeAgents
        .filter(a => a.dna.id !== agent.dna.id)
        .map(a => ({
          id: a.dna.id,
          name: a.dna.displayName,
          // Note: In parallel execution, we use the *previous* turn's last action for immediate context,
          // or a generic "Entering" string if it's the first turn.
          // This trades perfect sequential causality for performance.
          recentActions: a.dna.lastPublicAction || "Entering the scene",
          favorScore: a.dna.favorScore,
          perceivedThreat: this.calculateThreat(agent.dna, a.dna)
        }));
      
      const subjectRelationships = kgot.edges
            .filter(e => 
                (e.source === agent.dna.id && e.target === CharacterId.PLAYER) || 
                (e.target === agent.dna.id && e.source === CharacterId.PLAYER)
            )
            .map(e => {
                const type = e.type === 'RELATIONSHIP' ? e.label : e.type;
                const direction = e.source === agent.dna.id ? "OUTGOING" : "INCOMING";
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
      
      // Retry wrapper for 429 errors
      return this.callWithRetry(() => agent.think(context), 3);
    });
    
    // 4. Wait for all agents (parallel execution)
    const thoughts = await Promise.all(thoughtPromises);
    
    // 5. Update DNA state immediately
    thoughts.forEach((thought, idx) => {
      const agent = activeAgents[idx];

      // Failure Detection & Logging
      if (thought.agentId === 'FALLBACK') {
          const warningMsg = `⚠️ AGENT FAILURE: ${agent.dna.displayName} (${agent.dna.archetype}) connection unstable. Reverting to fallback protocols.`;
          console.warn(warningMsg);
          if (logCallback) {
              logCallback({
                  id: `prefect-fail-${Date.now()}-${idx}`,
                  type: 'system',
                  content: warningMsg
              });
          }
      }

      agent.dna.currentEmotionalState = thought.emotionalState;
      agent.dna.lastPublicAction = thought.publicAction;
      
      if (thought.favorScoreDelta) {
        agent.dna.favorScore = Math.max(0, Math.min(100, agent.dna.favorScore + thought.favorScoreDelta));
      }
      
      if (thought.secretsUncovered?.length) {
        agent.dna.knowledge = [
          ...(agent.dna.knowledge || []),
          ...thought.secretsUncovered
        ];
        agent.dna.knowledge = [...new Set(agent.dna.knowledge)].slice(-10);
      }
      
      // Handle sabotage/alliance
      if (thought.sabotageAttempt) {
        const targetId = this.findAgentIdByName(thought.sabotageAttempt.target);
        if (targetId) {
          this.updateRelationship(agent.dna.id, targetId, -0.3);
          this.updateRelationship(targetId, agent.dna.id, -0.4);
        }
      }
      
      if (thought.allianceSignal) {
        const targetId = this.findAgentIdByName(thought.allianceSignal.target);
        if (targetId) {
          this.updateRelationship(agent.dna.id, targetId, 0.2);
          this.updateRelationship(targetId, agent.dna.id, 0.1);
        }
      }
    });
    
    return { thoughts, updatedDNA: this.prefectsDNA };
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async callWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    baseDelay: number = 2000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && retries > 0) {
        const delay = baseDelay * (4 - retries);
        console.warn(`[PrefectManager] Rate limited, retrying in ${delay}ms... (${retries} attempts left)`);
        await new Promise(r => setTimeout(r, delay));
        return this.callWithRetry(fn, retries - 1, baseDelay);
      }
      
      // If all retries exhausted or different error, return fallback
      console.error(`[PrefectManager] Agent failed after retries:`, error);
      return this.generateFallbackThought() as unknown as T;
    }
  }

  private generateFallbackThought(): PrefectThought {
    return {
      agentId: 'FALLBACK',
      publicAction: "Watches silently, calculating next move.",
      hiddenMotivation: "System failure - maintaining low profile.",
      internalMonologue: "Error in cognitive processing. Awaiting recovery.",
      sabotageAttempt: null,
      allianceSignal: null,
      emotionalState: { paranoia: 0.5, desperation: 0.3, confidence: 0.4 },
      secretsUncovered: [],
      favorScoreDelta: -1
    };
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
    
    const facultyNodes = Object.values(kgot.nodes).filter(n => n.type === 'FACULTY');
    const facultyPresent = facultyNodes.length > 0 
        ? facultyNodes.map(n => n.label) 
        : ["Provost Selene", "Inquisitor Petra"];

    const facultyMoods = facultyNodes
        .map(n => n.attributes.agent_state?.current_mood)
        .filter(m => m !== undefined) as string[];
    const facultyMood = facultyMoods.length > 0 
        ? facultyMoods.join(", ") 
        : (gameState.ledger.complianceScore < 30 ? "Hostile" : "Watchful");

    const currentTurn = kgot.global_state.turn_count;
    const recentMemories = Object.values(kgot.nodes)
        .flatMap(n => n.attributes.memories || [])
        .filter(m => m.timestamp >= currentTurn - 5) 
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(m => `[EVENT]: ${m.description} (${m.emotional_imprint})`);

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
        recentRituals: [...recentMemories, ...relationshipEvents].slice(0, 8), 
        sceneFlags: gameState.ledger.traumaLevel > 80 ? ["CRITICAL_TRAUMA"] : []
    };
  }
}

export const prefectManager = new PrefectManager();
