
import { 
  GameState, 
  PrefectDecision, 
  MaraThought, 
  FacultyCollectiveOutput, 
  FilteredSceneContext, 
  MaraContext,
  PrefectThought,
  OrchestratorOutput
} from '../types';
import { initializePrefects } from './PrefectGenerator';
import { PrefectAgent } from './PrefectAgent';
import { MaraAgent } from './MaraAgent';
import { FacultyCollective } from './FacultyCollective';

export class AgentOrchestrator {
  private prefects: PrefectAgent[] = [];
  private mara: MaraAgent;
  private faculty: FacultyCollective;
  private isInitialized = false;
  private facultyPrivateBundle: any = {}; // Persist Faculty Memory

  constructor() {
    this.mara = new MaraAgent();
    this.faculty = new FacultyCollective();
  }

  public initialize(seed: number = Date.now()) {
    if (this.isInitialized) return;
    
    console.log(`[ORCHESTRATOR] Initializing with seed: ${seed}`);
    const dnas = initializePrefects(seed);
    this.prefects = dnas.map(dna => new PrefectAgent(dna));
    this.isInitialized = true;
  }

  /**
   * MASTER GAME LOOP
   * 1. Determine active Prefects (Spotlight System)
   * 2. Run Prefect Agents in Parallel (Gemini 2.5 Flash)
   * 3. Run Mara Agent (Gemini 2.5 Flash)
   * 4. Run Unified Faculty Agent (Gemini 3 Pro)
   * 5. Return Aggregated Results for Director
   */
  public async generateTurn(gameState: GameState, playerAction: string): Promise<OrchestratorOutput> {
    if (!this.isInitialized) this.initialize();

    const turnSeed = Date.now();
    const sceneId = `scene-${gameState.turn}`;

    // 1. FILTER PREFECTS (Optimization)
    const activePrefects = this.selectActivePrefects(gameState);

    // 2. PARALLEL EXECUTION: PREFECTS & MARA
    const prefectPromises = activePrefects.map(agent => {
      const context: FilteredSceneContext = {
        description: `Subject 84 Action: "${playerAction}". Location: ${gameState.location}.`,
        location: gameState.location,
        timeOfDay: "Night",
        otherPrefects: this.prefects
          .filter(p => p !== agent)
          .map(p => ({
            name: p.dna.displayName,
            recentActions: "Observing", 
            favorScore: p.dna.favorScore,
            perceivedThreat: 0.5
          })),
        yourFavorScore: agent.dna.favorScore,
        yourRecentActions: [],
        facultyPresent: ["Selene", "Petra"], 
        facultyMood: "Expectant",
        playerTrauma: gameState.ledger.traumaLevel,
        recentRituals: [],
        sceneFlags: []
      };
      return agent.think(context, gameState.ledger);
    });

    const maraContext: MaraContext = {
      moralDecay: this.mara.dna.moralDecay,
      facultySuspicion: 0.2, 
      location: gameState.location,
      timeOfDay: "Night",
      description: `Subject 84 Action: "${playerAction}"`,
      facultyMood: "Expectant",
      prefects: this.prefects.map(p => ({ name: p.dna.displayName, favorScore: p.dna.favorScore })),
      playerTrauma: gameState.ledger.traumaLevel,
      recentRituals: []
    };

    const [prefectDecisions, maraThought] = await Promise.all([
      Promise.all(prefectPromises),
      this.mara.think(maraContext)
    ]);

    // Apply favorScoreDelta from Prefect decisions back to the PrefectAgent instances
    // This ensures favor scores persist and influence future turns
    prefectDecisions.forEach(decision => {
        if (decision.stateDelta?.favorScoreDelta) {
            const agent = this.prefects.find(p => p.dna.id === decision.prefectId);
            if (agent) {
                agent.updateFavorScore(decision.stateDelta.favorScoreDelta);
            }
        }
    });


    // 3. UNIFIED FACULTY DELIBERATION
    // Faculty sees what Prefects did and what Mara did publicly
    const facultyOutput = await this.faculty.deliberate(
      sceneId,
      turnSeed,
      gameState,
      prefectDecisions,
      maraThought.publicAction, 
      this.facultyPrivateBundle
    );

    // Update persistence
    if (facultyOutput.privateBundle) {
      this.facultyPrivateBundle = facultyOutput.privateBundle;
    }

    return {
      prefectDecisions,
      maraThought,
      facultyOutput,
      simulationLog: this.formatSimulationLog(prefectDecisions, maraThought, facultyOutput)
    };
  }

  private selectActivePrefects(gameState: GameState): PrefectAgent[] {
    const priorityIds = ['Kaelen', 'Elara'];
    const active = this.prefects.filter(p => priorityIds.some(id => p.dna.displayName.includes(id)));
    
    const others = this.prefects.filter(p => !active.includes(p));
    const needed = 4 - active.length;
    
    if (needed > 0) {
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      active.push(...others.slice(0, needed));
    }
    
    return active;
  }

  private formatSimulationLog(
    prefects: PrefectDecision[], 
    mara: MaraThought, 
    faculty: FacultyCollectiveOutput
  ): string {
    return `
[SIMULATION AGGREGATION]
FACULTY: ${faculty.publicNarration}
ACTIONS: ${faculty.facultyActions.map(a => `[${a.facultyId}] ${a.actionType}: ${a.actionDetail}`).join(', ')}
MARA: [Public] ${mara.publicAction} / [Hidden] ${mara.hiddenDefiance}
PREFECTS:
${prefects.map(p => `- ${p.prefectId}: ${p.actionDetail} (Hidden: ${p.hiddenProposal}) (Favor Delta: ${p.stateDelta?.favorScoreDelta || 0})`).join('\n')}
    `;
  }
}

export const orchestrator = new AgentOrchestrator();