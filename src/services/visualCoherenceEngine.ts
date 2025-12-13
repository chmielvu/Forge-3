
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn, CharacterVisualState, EnvironmentState, VisualMemory, VisualTurnSnapshot } from '../types';
import { VISUAL_PROFILES } from '../constants';
import { VISUAL_MANDATE, LIGHTING_PRESETS } from '../config/visualMandate';
import { FORGE_MOTIFS, ARCHETYPE_VISUAL_MAP } from '../data/motifs';

/**
 * COHERENCE ENGINE V2.6 (Psych-Somatic Mapping)
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
    previousTurn?: MultimodalTurn
  ): string {
    this.updateCharacterStates(target, ledger, narrativeText);
    this.inferEnvironmentFromContext(sceneContext, ledger); 
    
    const basePromptParts = this.constructBasePrompt(target, sceneContext, ledger, narrativeText);
    const continuityDirectives = this.generateContinuityDirectives(previousTurn);
    const styleConsistencyLock = this.getStyleConsistencyLock();

    const finalPromptObject = {
      header: VISUAL_MANDATE.ZERO_DRIFT_HEADER,
      style: VISUAL_MANDATE.STYLE,
      ...VISUAL_MANDATE.TECHNICAL,
      
      subject: basePromptParts.subject,
      environment: basePromptParts.environment,
      psychometrics: basePromptParts.psychometricVisualization,
      
      sceneContext: sceneContext.substring(0, 300),
      narrativeTone: this.inferEmotionalState(ledger, narrativeText),
      continuity: continuityDirectives,
      styleConsistency: styleConsistencyLock,
      
      negative_prompt: VISUAL_MANDATE.NEGATIVE_PROMPT
    };
    
    return JSON.stringify(finalPromptObject, null, 2);
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
      injuries: this.inferInjuries(ledger, text),
      dominancePosture: this.inferDominancePosture(characterId, ledger, text)
    };
    
    this.memory.lastCharacterAppearances.set(characterId, currentState);
  }

  private inferClothingState(ledger: YandereLedger, text: string): CharacterVisualState['clothingState'] {
    const lower = text.toLowerCase();
    if (lower.match(/tear|rip|shred|cut/)) return 'torn';
    if (lower.match(/mess|dishevel|wild|loose/)) return 'disheveled';
    if (lower.match(/blood|bleed|stain|red/)) return 'bloodstained';
    
    if (ledger.physicalIntegrity < 50) return 'torn';
    if (ledger.traumaLevel > 70) return 'disheveled';
    if (ledger.shamePainAbyssLevel > 80) return 'bloodstained';
    return 'pristine';
  }

  private inferEmotionalState(ledger: YandereLedger, text: string): CharacterVisualState['emotionalState'] {
    const lower = text.toLowerCase();
    if (lower.match(/cry|weep|sob|tear|break/)) return 'broken';
    if (lower.match(/laugh|grin|smile|manic/)) return 'ecstatic';
    if (lower.match(/glare|frown|fury|rage/)) return 'agitated';
    if (lower.match(/shiver|tremble|shake|terror/)) return 'terrified';
    if (lower.match(/moan|gasp|want|need|heat/)) return 'desirous';
    if (lower.match(/shame|blush|avert/)) return 'humiliated';
    if (lower.match(/hopeless|void|nothing|empty/)) return 'despairing';
    
    if (ledger.hopeLevel < 20) return 'despairing';
    if (ledger.traumaLevel > 80) return 'terrified';
    if (ledger.shamePainAbyssLevel > 80) return 'humiliated';
    if (ledger.arousalLevel > 70) return 'desirous';
    if (ledger.complianceScore > 80) return 'composed';
    if (ledger.traumaLevel > 50) return 'agitated';
    return 'composed';
  }

  private inferInjuries(ledger: YandereLedger, text: string): string[] {
    const injuries: string[] = [];
    const lower = text.toLowerCase();
    if (lower.includes('bruise') || lower.includes('blow')) injuries.push('fresh bruising');
    if (lower.includes('cut') || lower.includes('slice') || lower.includes('bleed')) injuries.push('bleeding laceration');
    if (lower.includes('choke') || lower.includes('throat')) injuries.push('bruised neck');
    if (lower.includes('slap') || lower.includes('cheek')) injuries.push('red handprint on cheek');
    if (ledger.physicalIntegrity < 80 && !injuries.some(i => i.includes('bruis'))) injuries.push('visible bruising on wrists and neck');
    if (ledger.traumaLevel > 60) injuries.push('trembling hands');
    return [...new Set(injuries)];
  }

  private inferDominancePosture(characterId: string, ledger: YandereLedger, text: string): number {
    const lower = text.toLowerCase();
    if (characterId === CharacterId.PLAYER) {
      if (lower.match(/kneel|bow|beg|crawl/)) return 0.1;
      if (lower.match(/stand|glare|spit|resist/)) return 0.6;
      return Math.max(0, Math.min(1, (100 - ledger.complianceScore + ledger.hopeLevel) / 200));
    }
    if (lower.match(/loom|tower|step on|down at/)) return 1.0;
    if (lower.match(/lean|sit|lounge/)) return 0.8;
    return 0.9;
  }

  private inferEnvironmentFromContext(context: string, ledger: YandereLedger): void {
    const lower = context.toLowerCase();
    let { location, lightingScheme, atmosphericEffects, dominantColors } = this.memory.environmentState;
    
    // Location Logic
    if (lower.includes("dock") || lower.includes("arrival")) {
        location = "volcanic rock dock, iron gates, storm clouds";
        lightingScheme = LIGHTING_PRESETS.Moody;
    } else if (lower.includes("office") || lower.includes("selene")) {
        location = "provost's mahogany study, velvet curtains";
        lightingScheme = LIGHTING_PRESETS.Intimate;
    } else if (lower.includes("infirmary") || lower.includes("clinic")) {
        location = "medical wing, sterile tiles, stainless steel";
        lightingScheme = LIGHTING_PRESETS.Clinical;
    } else if (lower.includes("cell") || lower.includes("cage")) {
        location = "isolation cell, rusted iron, damp stone";
        lightingScheme = LIGHTING_PRESETS.Harsh;
    } else if (lower.includes("calibration") || lower.includes("slab")) {
        location = "The Calibration Chamber, black basalt, surgical spotlight";
        lightingScheme = LIGHTING_PRESETS.Harsh;
    }

    // Atmosphere Logic based on Ledger
    if (ledger.traumaLevel > 70) atmosphericEffects = ["suffocating humidity", "red-tinted shadows", "vignette darkness"];
    else if (ledger.complianceScore > 70) atmosphericEffects = ["ordered stillness", "cold clarity", "symmetrical shadows"];
    else if (lower.includes("rain")) atmosphericEffects = ["heavy rain", "slick surfaces"];

    this.memory.environmentState = { location, lightingScheme, atmosphericEffects, dominantColors };
  }

  private constructBasePrompt(
    target: PrefectDNA | CharacterId | string,
    sceneContext: string,
    ledger: YandereLedger,
    narrativeText: string
  ): any {
    const characterId = typeof target === 'string' ? target : target.id;
    const visualState = this.memory.lastCharacterAppearances.get(characterId);
    const env = this.memory.environmentState;
    const moodModifiers: string[] = ["psychological-horror"];
    const aestheticInjects: string[] = [];

    let subjectDescription: any = {};

    if (typeof target === 'string') {
      // Legacy Character Logic
      const profile = VISUAL_PROFILES[target as CharacterId] || "Figure in shadow";
      subjectDescription = {
        name: target.replace(/_/g, " "),
        role: "Main Character",
        description: profile,
      };
      if (target === CharacterId.PLAYER) {
        moodModifiers.push("vulnerable", "exposed");
        aestheticInjects.push(FORGE_MOTIFS.BoundWrists, FORGE_MOTIFS.FlushedSkin);
      }
    } else { 
      // --- PREFECT PSYCHOLOGICAL PROFILING ---
      const dna = target as PrefectDNA;
      const map = ARCHETYPE_VISUAL_MAP[dna.archetype] || {};
      
      subjectDescription = {
        name: dna.displayName,
        role: "Prefect",
        archetype: dna.archetype,
        attire: map.attire || "uniform"
      };

      // Trait -> Visual Mapping (PDF Alignment)
      if (dna.traitVector.cruelty > 0.7) {
        moodModifiers.push("predatory", "sharp-angled");
        aestheticInjects.push(FORGE_MOTIFS.TeasingCruelty);
      }
      
      // Elara-specific: Internal Conflict (Flinching Zealot)
      if (dna.id.includes('LOYALIST') || dna.traitVector.submission_to_authority > 0.8) {
        moodModifiers.push("rigid", "anxious-perfection");
        aestheticInjects.push("hands clasped tight until knuckles white", "posture too stiff", "eyes wide with suppressed panic");
        if (narrativeText.includes("strike") || narrativeText.includes("punish")) {
            aestheticInjects.push("subtle flinch", "micro-expression of horror");
        }
      }
      
      // Kaelen-specific: The Obsessive (Yandere/Dere Switch)
      if (dna.id.includes('OBSESSIVE') || dna.archetype === 'The Yandere') {
         if (narrativeText.includes("blood") || narrativeText.includes("knife") || narrativeText.includes("dead")) {
             moodModifiers.push("dead-eyed", "hollow", "yan-mode");
             aestheticInjects.push("flat affect", "dilated pupils", "empty smile");
         } else {
             moodModifiers.push("adoring", "dere-mode");
             aestheticInjects.push("flushed cheeks", "wide innocent eyes");
         }
      }

      // Ambition -> Dominance
      if (dna.traitVector.ambition > 0.8) {
        moodModifiers.push("looming", "commanding");
        aestheticInjects.push("chin raised", "center frame composition", "looking down at viewer");
      }
      
      // Cunning -> Shadows
      if (dna.traitVector.cunning > 0.7) {
        moodModifiers.push("observant", "calculating");
        aestheticInjects.push("eyes in shadow", "half-smile", "reflecting light in glasses/eyes");
      }

      // Favor Score -> Lighting/Atmosphere Mapping
      if (dna.favorScore > 70) {
        aestheticInjects.push("halo rim-lighting", "immaculate uniform", "visual dominance");
        moodModifiers.push("favored", "radiant");
      } else if (dna.favorScore < 30) {
        aestheticInjects.push("swallowed by shadows", "sweat on brow", "desperate eyes");
        moodModifiers.push("condemned", "fearful");
      }
    }

    return {
      subject: {
        characterId,
        description: subjectDescription,
        appearance: this.getCharacterAppearance(characterId, visualState, subjectDescription, ledger),
        posture: this.getPostureDescription(visualState, subjectDescription, ledger),
        clothing: visualState?.clothingState || "uniform",
        injuries: visualState?.injuries || [],
        mood: moodModifiers.join(", "),
        aestheticDetails: aestheticInjects.join(" | ") 
      },
      environment: {
        location: env.location,
        lighting: env.lightingScheme,
        atmosphere: env.atmosphericEffects.join(", ")
      },
      psychometricVisualization: {
        trauma: ledger.traumaLevel,
        shame: ledger.shamePainAbyssLevel,
        visualCues: this.getTraumaVisualization(ledger).join(", ")
      }
    };
  }

  private getCharacterAppearance(characterId: string, state: any, desc: any, ledger: any) {
    let base = desc.description || `${desc.name} (${desc.role})`;
    if (state?.clothingState === 'disheveled') base += ", disheveled";
    if (state?.clothingState === 'bloodstained') base += ", bloodstained";
    if (ledger.arousalLevel > 60) base += ", flushed skin";
    if (state?.emotionalState) base += `, EXPRESSION: ${state.emotionalState.toUpperCase()}`;
    return base;
  }

  private getPostureDescription(state: any, desc: any, ledger: any) {
    if (state?.dominancePosture > 0.7) return "looming, dominant";
    if (state?.dominancePosture < 0.3) return "kneeling, submissive";
    return "neutral";
  }

  private getTraumaVisualization(ledger: any): string[] {
    const cues = [];
    if (ledger.traumaLevel > 40) cues.push('sweat on forehead');
    if (ledger.shamePainAbyssLevel > 60) cues.push('tear tracks');
    return cues;
  }

  private generateContinuityDirectives(previousTurn?: MultimodalTurn): any {
    if (!previousTurn) return { rule: "Establish baseline." };
    return {
      rule: "Maintain character consistency.",
      reference: `Previous: ${previousTurn.text.substring(0, 50)}...`
    };
  }

  private getStyleConsistencyLock(): any {
    return {
      brushStrokes: 'soft digital oil',
      colorGrading: 'desaturated crimson/gold/black',
    };
  }

  public recordTurn(turn: MultimodalTurn): void {}
  public reset(): void {
    this.memory.lastCharacterAppearances.clear();
  }
}

export const visualCoherenceEngine = new VisualCoherenceEngine();
