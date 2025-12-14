
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn, CharacterVisualState, EnvironmentState, VisualMemory, VisualTurnSnapshot } from '../types';
import { VISUAL_PROFILES } from '../constants';
import { VISUAL_MANDATE, LIGHTING_PRESETS } from '../config/visualMandate';
import { FORGE_MOTIFS, ARCHETYPE_VISUAL_MAP } from '../data/motifs';

/**
 * COHERENCE ENGINE V2.7 (Psych-Somatic & Relational Mapping)
 * Ensures visual continuity and maps internal psychological conflict to external visual tells.
 */
class VisualCoherenceEngine {
  private memory: VisualMemory;
  
  constructor() {
    this.memory = {
      lastCharacterAppearances: new Map(),
      environmentState: {
        location: 'The Arrival Dock',
        lightingScheme: 'stormy natural light, deep shadows',
        atmosphericEffects: ['volcanic ash', 'sea spray', 'heavy humidity'],
        dominantColors: ['#050505', '#881337', '#facc15', '#1c1917']
      },
      timeOfDay: 'evening',
      weatherCondition: 'stormy',
      turnHistory: []
    };
  }

  public buildCoherentPrompt(
    target: PrefectDNA | CharacterId | string,
    sceneContext: string,
    ledger: YandereLedger,
    narrativeText: string,
    previousTurn?: MultimodalTurn,
    directorVisualInstruction?: string
  ): string {
    this.updateCharacterStates(target, ledger, narrativeText);
    this.inferEnvironmentFromContext(sceneContext, ledger); 
    
    // Calculate dynamics
    const cameraDynamics = this.calculateCameraDynamics(target, ledger, narrativeText);
    const subjectDesc = this.constructSubjectDescription(target, narrativeText, ledger);
    
    // Construct strict JSON Prompt for Gemini 2.5 Flash-Image
    const promptJson = {
      task: "generate_image",
      style: "photorealistic cinematic dark academia horror, soft digital oil painting with precise anatomical detail",
      camera: cameraDynamics.description,
      lighting: "extreme chiaroscuro, single crimson rim light from above, deep crushed blacks, volumetric dust god rays",
      subject: directorVisualInstruction || subjectDesc,
      environment: `${this.memory.environmentState.location}, ${this.memory.environmentState.atmosphericEffects.join(', ')}, dominant colors #050505 #881337 #facc15`,
      mood: "bored clinical inevitability | ontological exposure | somatic collapse under cold gaze",
      technical: "high resolution, sharp focus on eyes and skin texture, subtle film grain, 16:9 wide cinematic aspect ratio, no text overlays"
    };

    // SOTA Wrapper: Force model to use structured keys as anchors
    return `Generate image strictly adhering to this JSON structure: ${JSON.stringify(promptJson)}`;
  }

  /**
   * Calculates the camera angle based on the "Dominance Hierarchy"
   */
  private calculateCameraDynamics(
    target: PrefectDNA | CharacterId | string,
    ledger: YandereLedger,
    text: string
  ): any {
    const complianceFactor = ledger.complianceScore / 100;
    const traumaFactor = ledger.traumaLevel / 100;
    const playerDominance = Math.max(0, 1.0 - (complianceFactor * 0.6 + traumaFactor * 0.4));

    let agentDominance = 1.0; 
    let agentAmbition = 0.5;

    if (typeof target !== 'string') {
        const dna = target as PrefectDNA;
        const favorFactor = dna.favorScore / 100;
        agentAmbition = dna.traitVector.ambition;
        agentDominance = (favorFactor * 0.5) + (agentAmbition * 0.5);
    }

    // Narrative Overrides
    const lowerText = text.toLowerCase();
    if (lowerText.includes("kneel") || lowerText.includes("floor") || lowerText.includes("crawling") || lowerText.includes("bow")) agentDominance += 0.4;
    if (lowerText.includes("looking down") || lowerText.includes("towering") || lowerText.includes("looms")) agentDominance += 0.3;
    
    const dominanceDelta = agentDominance - playerDominance;

    let angle = "eye_level_confrontational";
    if (dominanceDelta > 0.6) angle = "extreme_low_angle_worm_eye_view"; 
    else if (dominanceDelta > 0.3) angle = "low_angle_heroic_power"; 
    else if (dominanceDelta < -0.2) angle = "high_angle_looking_down"; 

    return {
        description: `Camera ${angle.replace(/_/g, " ")}, focus on face and eyes, shallow depth of field.`
    };
  }

  private constructSubjectDescription(
    target: PrefectDNA | CharacterId | string,
    narrativeText: string,
    ledger: YandereLedger
  ): string {
    const characterId = typeof target === 'string' ? target : target.id;
    const visualState = this.memory.lastCharacterAppearances.get(characterId);
    
    let desc = "";
    
    if (typeof target === 'string') {
        desc = VISUAL_PROFILES[target as CharacterId] || target;
    } else {
        const dna = target as PrefectDNA;
        desc = `${dna.displayName} (${dna.archetype}), ${dna.traitVector.cruelty > 0.7 ? 'predatory expression' : 'calm expression'}`;
    }

    if (visualState?.clothingState) desc += `, clothing ${visualState.clothingState}`;
    if (ledger.arousalLevel > 60) desc += ", flushed skin, dilated pupils from somatic distress";
    if (ledger.traumaLevel > 70) desc += ", trembling hands, pale complexion";
    
    return desc;
  }

  private updateCharacterStates(
    target: PrefectDNA | CharacterId | string,
    ledger: YandereLedger,
    text: string
  ): void {
    const characterId = typeof target === 'string' ? target : target.id;
    const currentState: CharacterVisualState = {
      characterId,
      lastSeenTurn: this.memory.turnHistory.length,
      clothingState: this.inferClothingState(ledger, text),
      emotionalState: this.inferEmotionalState(ledger, text),
      injuries: [],
      dominancePosture: 0.5
    };
    this.memory.lastCharacterAppearances.set(characterId, currentState);
  }

  private inferClothingState(ledger: YandereLedger, text: string): CharacterVisualState['clothingState'] {
    const lower = text.toLowerCase();
    if (lower.match(/tear|rip|shred|cut/)) return 'torn';
    if (lower.match(/mess|dishevel|wild|loose/)) return 'disheveled';
    if (lower.match(/blood|bleed|stain|red/)) return 'bloodstained';
    return 'pristine';
  }

  private inferEmotionalState(ledger: YandereLedger, text: string): CharacterVisualState['emotionalState'] {
    const lower = text.toLowerCase();
    if (lower.match(/cry|weep|sob/)) return 'broken';
    if (lower.match(/laugh|grin|smile/)) return 'ecstatic';
    if (lower.match(/shiver|tremble|shake/)) return 'terrified';
    return 'composed';
  }

  private inferEnvironmentFromContext(context: string, ledger: YandereLedger): void {
    const lower = context.toLowerCase();
    let { location, lightingScheme, atmosphericEffects, dominantColors } = this.memory.environmentState;
    
    if (lower.includes("calibration") || lower.includes("slab")) {
        location = "The Calibration Chamber, black basalt";
        lightingScheme = LIGHTING_PRESETS.Harsh;
    } else if (lower.includes("office") || lower.includes("selene")) {
        location = "Provost's study, velvet curtains";
        lightingScheme = LIGHTING_PRESETS.Intimate;
    }

    if (ledger.traumaLevel > 80) atmosphericEffects = ["suffocating humidity", "red-tinted vision"];
    
    this.memory.environmentState = { location, lightingScheme, atmosphericEffects, dominantColors };
  }

  private generateContinuityDirectives(previousTurn?: MultimodalTurn): any {
    return { rule: "Maintain character consistency." };
  }

  private getStyleConsistencyLock(): any {
    return {
      medium: "hyper-detailed 8K ink wash illustration",
      artist_reference: "Milo Manara, Frank Miller, Artgerm",
      technique: "clean contour lines, flat cel-shading, heavy negative space",
      lighting: "Neo-Noir Chiaroscuro (high contrast, single light source)",
      texture: "wet surfaces, rain-slicked marble, cold glass",
      prohibited: "3d render, oil painting, cross-hatching, blurry, fuzzy"
    };
  }

  public recordTurn(turn: MultimodalTurn): void {}
  public reset(): void {
    this.memory.lastCharacterAppearances.clear();
  }
}

export const visualCoherenceEngine = new VisualCoherenceEngine();
