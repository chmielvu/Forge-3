import { KnowledgeGraph } from "./types/kgot";

/**
 * @class MagellanController
 * @description The "Novelty Injection" Engine.
 * Monitors narrative entropy and forces orthogonal plot shifts when stagnation is detected.
 */
export class MagellanController {
  private historyWindow: string[] = [];
  private readonly MAX_HISTORY = 5;
  private readonly ENTROPY_THRESHOLD = 0.4; // Low score = high repetition

  constructor(history: string[]) {
    this.historyWindow = history.slice(-this.MAX_HISTORY);
  }

  /**
   * Calculates Narrative Entropy based on keyword diversity.
   * Low entropy means the story is looping (e.g., "Hit him again").
   */
  public calculateEntropy(): number {
    if (this.historyWindow.length < 2) return 1.0;
    
    const tokenSet = new Set<string>();
    let totalTokens = 0;

    this.historyWindow.forEach(entry => {
        const tokens = entry.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        tokens.forEach(t => tokenSet.add(t));
        totalTokens += tokens.length;
    });

    if (totalTokens === 0) return 0;
    return tokenSet.size / totalTokens;
  }

  /**
   * Generates a "Novelty Injection" prompt if entropy is low.
   * This forces the Director to introduce a "Black Envelope" event or a subplot shift.
   */
  public getInjectionDirective(graph: KnowledgeGraph): string | null {
    const entropy = this.calculateEntropy();
    console.log(`[Magellan] Current Narrative Entropy: ${entropy.toFixed(2)}`);

    if (entropy < this.ENTROPY_THRESHOLD) {
      // 1. Check for under-utilized agents
      const underUtilizedAgent = Object.values(graph.nodes)
        .find(n => n.type === 'PREFECT' && (!n.attributes.last_active_turn || (graph.global_state.turn_count - n.attributes.last_active_turn > 3)));

      const agentName = underUtilizedAgent?.label || "The Dissident";

      // 2. Select an Orthogonal Strategy
      const strategies = [
        `TRIGGER EVENT: 'The Black Envelope'. ${agentName} interrupts with a secret message.`,
        `TRIGGER EVENT: 'The Civil War'. Two Prefects clash, ignoring the subject.`,
        `TRIGGER EVENT: 'The Inspection'. Dr. Lysandra demands an immediate medical audit.`,
        `TRIGGER EVENT: 'The Error'. A security failure occurs (lights flicker, gate opens).`
      ];

      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      
      return `
      *** MAGELLAN INTERVENTION ACTIVATED ***
      NARRATIVE STAGNATION DETECTED.
      DIRECTIVE: You must abandon the current immediate action loop.
      EXECUTE: ${strategy}
      `;
    }

    return null;
  }
}