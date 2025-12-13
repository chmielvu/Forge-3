
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
   * Selects a subset of prefects to act in the current scene to avoid token overload.
   * Prioritizes Canon prefects or those with high favor/grudges.
   */
  private selectActivePrefects(count: number = 2): PrefectAgent[] {
    // Always include Kaelen or Elara if possible for drama
    const pool = Array.from(this.agents.values());
    // Simple shuffle for now, could be improved with weightings
    return pool.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  public async simulateTurn(
    gameState: GameState,
    narrativeHistory: string[],
    playerInput: string
  ): Promise<{ thoughts: PrefectThought[], updatedDNA: PrefectDNA[] }> {
    
    const activeAgents = this.selectActivePrefects(3);
    const sceneContextBase = this.buildSceneContext(gameState, narrativeHistory, playerInput);
    
    const thoughts: PrefectThought[] = [];

    // Run agents in parallel
    await Promise.all(activeAgents.map(async (agent) => {
        // Customize context for this specific agent (relative favor scores)
        const context = {
            ...sceneContextBase,
            yourFavorScore: agent.dna.favorScore,
            otherPrefects: this.prefectsDNA
                .filter(p => p.id !== agent.dna.id)
                .map(p => ({
                    name: p.displayName,
                    recentActions: "Observed", // Placeholder - would track real history
                    favorScore: p.favorScore,
                    perceivedThreat: p.favorScore > agent.dna.favorScore ? 0.8 : 0.3
                }))
        };

        const thought = await agent.think(context);
        thoughts.push(thought);

        // Apply immediate favor updates based on self-assessment (Director will validate later)
        if (thought.favorScoreDelta) {
            agent.dna.favorScore = Math.max(0, Math.min(100, agent.dna.favorScore + thought.favorScoreDelta));
        }
    }));

    return { thoughts, updatedDNA: this.prefectsDNA };
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
        facultyPresent: ["Provost Selene", "Inquisitor Petra"], // Simplified
        facultyMood: gameState.ledger.complianceScore < 30 ? "Hostile" : "Watchful",
        playerTrauma: gameState.ledger.traumaLevel / 100,
        recentRituals: [],
        sceneFlags: []
    };
  }
}

export const prefectManager = new PrefectManager();
