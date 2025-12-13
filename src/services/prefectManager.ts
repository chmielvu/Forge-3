
import { PrefectAgent } from '../lib/agents/PrefectAgent';
import { initializePrefects } from '../lib/agents/PrefectGenerator';
import { PrefectDNA, PrefectThought, FilteredSceneContext, GameState, YandereLedger } from '../types';

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

        // 1. Archetype Attraction Logic
        switch (p.archetype) {
            case 'The Yandere':
                // Kaelen is always watching, but more intense if player is "impure" (low compliance)
                score += 0.5; 
                if (ledger.complianceScore < 30) score += 0.3;
                break;
            case 'The Zealot':
                // Elara appears when rules are broken (low compliance)
                if (ledger.complianceScore < 40) score += 0.4;
                if (ledger.fearOfAuthority < 30) score += 0.3;
                break;
            case 'The Nurse':
                // Anya appears when trauma/pain is high
                if (ledger.traumaLevel > 60 || ledger.physicalIntegrity < 60) score += 0.6;
                break;
            case 'The Sadist':
                // Drawn to high physical integrity (fresh meat) or defiance
                if (ledger.physicalIntegrity > 80) score += 0.3;
                if (ledger.complianceScore < 20) score += 0.4;
                break;
            case 'The Dissident':
                // Rhea appears in "cracks" - mid-range chaos
                if (ledger.hopeLevel > 40 && ledger.complianceScore > 40) score += 0.4;
                break;
            case 'The Voyeur':
                // Always moderate chance
                score += 0.2;
                break;
            default:
                score += 0.1;
        }

        // 2. Persistence (Keep them active if they have high favor/momentum)
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
    playerInput: string
  ): Promise<{ thoughts: PrefectThought[], updatedDNA: PrefectDNA[] }> {
    
    // 1. Select Agents
    const activeAgents = this.selectActivePrefects(gameState.ledger, 3);
    
    // 2. Build Base Context
    const sceneContextBase = this.buildSceneContext(gameState, narrativeHistory, playerInput);
    
    const thoughts: PrefectThought[] = [];

    // 3. Run Agents (Parallel Execution)
    await Promise.all(activeAgents.map(async (agent) => {
        // Construct 'Other Prefects' context for this agent
        // This enables rivalry/alliance logic
        const othersInScene = activeAgents
            .filter(a => a.dna.id !== agent.dna.id)
            .map(a => ({
                name: a.dna.displayName,
                recentActions: a.dna.lastPublicAction || "Entering the scene",
                favorScore: a.dna.favorScore,
                perceivedThreat: this.calculateThreat(agent.dna, a.dna)
            }));

        const context: FilteredSceneContext = {
            ...sceneContextBase,
            yourFavorScore: agent.dna.favorScore,
            otherPrefects: othersInScene
        };

        const thought = await agent.think(context);
        thoughts.push(thought);

        // --- PERSISTENCE LOGIC ---
        
        // 4. Update DNA State
        agent.dna.currentEmotionalState = thought.emotionalState;
        agent.dna.lastPublicAction = thought.publicAction;

        // Apply Favor Delta
        if (thought.favorScoreDelta) {
            agent.dna.favorScore = Math.max(0, Math.min(100, agent.dna.favorScore + thought.favorScoreDelta));
        }

        // Apply Relationship Shifts (if alliance signal)
        if (thought.allianceSignal) {
             const targetName = thought.allianceSignal.target.toLowerCase();
             const targetAgent = this.prefectsDNA.find(p => p.displayName.toLowerCase() === targetName);
             if (targetAgent) {
                 // Improve relationship
                 const currentRel = agent.dna.relationships[targetAgent.id] || 0;
                 agent.dna.relationships[targetAgent.id] = Math.min(1.0, currentRel + 0.1);
             }
        }
    }));

    return { thoughts, updatedDNA: this.prefectsDNA };
  }

  private calculateThreat(me: PrefectDNA, them: PrefectDNA): number {
    let threat = 0.3;
    // Higher favor = higher threat
    if (them.favorScore > me.favorScore) threat += 0.3;
    // Specific rivalries
    if (me.relationships[them.id] && me.relationships[them.id] < -0.3) threat += 0.4;
    return Math.min(1.0, threat);
  }

  private buildSceneContext(
    gameState: GameState, 
    history: string[], 
    input: string
  ): Omit<FilteredSceneContext, 'yourFavorScore' | 'otherPrefects'> {
    return {
        description: history.slice(-1)[0] || "The session begins.",
        location: gameState.location,
        timeOfDay: "Evening",
        yourRecentActions: [input],
        facultyPresent: ["Provost Selene", "Inquisitor Petra"], // Could be dynamic based on KGoT
        facultyMood: gameState.ledger.complianceScore < 30 ? "Hostile" : "Watchful",
        playerTrauma: gameState.ledger.traumaLevel / 100,
        recentRituals: [],
        sceneFlags: gameState.ledger.traumaLevel > 80 ? ["CRITICAL_TRAUMA"] : []
    };
  }
}

export const prefectManager = new PrefectManager();
