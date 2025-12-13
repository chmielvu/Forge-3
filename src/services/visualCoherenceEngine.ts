import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn, CharacterVisualState, EnvironmentState, VisualMemory, VisualTurnSnapshot } from '../types';
import { VISUAL_PROFILES } from '../constants';
import { VISUAL_MANDATE, LIGHTING_PRESETS } from '../config/visualMandate';
import { FORGE_MOTIFS, ARCHETYPE_VISUAL_MAP } from '../data/motifs';

/**
 * COHERENCE ENGINE V2.1 (Text-Aware)
 * Ensures visual continuity across turns by tracking:
 * - Character appearance consistency (clothing, injuries) inferred from Ledger AND Narrative
 * - Environmental continuity extracted from Scene Context
 * - Lighting/time consistency
 * - Emotional state visualization via Sentiment Heuristics
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

  /**
   * Builds a prompt with full temporal and visual continuity.
   * This is the main entry point called by MediaService/MediaController.
   */
  public buildCoherentPrompt(
    target: PrefectDNA | CharacterId | string,
    sceneContext: string,
    ledger: YandereLedger,
    narrativeText: string,
    previousTurn?: MultimodalTurn
  ): string {
    // 1. Update character state based on ledger AND text
    this.updateCharacterStates(target, ledger, narrativeText);
    
    // 2. Determine environmental continuity from text AND ledger
    this.inferEnvironmentFromContext(sceneContext, ledger); 
    
    // 3. Build base prompt with strict continuity directives
    const basePromptParts = this.constructBasePrompt(target, sceneContext, ledger, narrativeText);
    
    // 4. Inject continuity constraints from history
    const continuityDirectives = this.generateContinuityDirectives(previousTurn);
    
    // 5. Add style consistency locks
    const styleConsistencyLock = this.getStyleConsistencyLock();

    // The final prompt object structure for the Gemini Model
    const finalPromptObject = {
      header: VISUAL_MANDATE.ZERO_DRIFT_HEADER,
      style: VISUAL_MANDATE.STYLE,
      ...VISUAL_MANDATE.TECHNICAL,
      
      // Dynamic Scene Components
      subject: basePromptParts.subject,
      environment: basePromptParts.environment,
      psychometrics: basePromptParts.psychometricVisualization, // Mapping ledger to visuals
      
      // Logic & Continuity
      sceneContext: sceneContext.substring(0, 300),
      narrativeTone: this.inferEmotionalState(ledger, narrativeText),
      continuity: continuityDirectives,
      styleConsistency: styleConsistencyLock,
      
      // Strict Negatives
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
    
    // Textual overrides
    if (lower.match(/tear|rip|shred|cut/)) return 'torn';
    if (lower.match(/mess|dishevel|wild|loose/)) return 'disheveled';
    if (lower.match(/blood|bleed|stain|red/)) return 'bloodstained';
    
    // Ledger Fallbacks
    if (ledger.physicalIntegrity < 50) return 'torn';
    if (ledger.traumaLevel > 70) return 'disheveled';
    if (ledger.shamePainAbyssLevel > 80) return 'bloodstained';
    return 'pristine';
  }

  private inferEmotionalState(ledger: YandereLedger, text: string): CharacterVisualState['emotionalState'] {
    const lower = text.toLowerCase();

    // Textual overrides (Priority)
    if (lower.match(/cry|weep|sob|tear|break/)) return 'broken';
    if (lower.match(/laugh|grin|smile|manic/)) return 'ecstatic';
    if (lower.match(/glare|frown|fury|rage/)) return 'agitated';
    if (lower.match(/shiver|tremble|shake|terror/)) return 'terrified';
    if (lower.match(/moan|gasp|want|need|heat/)) return 'desirous';
    if (lower.match(/shame|blush|avert/)) return 'humiliated';
    if (lower.match(/hopeless|void|nothing|empty/)) return 'despairing';
    
    // Ledger Fallbacks
    if (ledger.hopeLevel < 20) return 'despairing';
    if (ledger.traumaLevel > 80) return 'terrified';
    if (ledger.shamePainAbyssLevel > 80) return 'humiliated';
    if (ledger.arousalLevel > 70) return 'desirous';
    if (ledger.complianceScore > 80) return 'composed';
    if (ledger.traumaLevel > 50 || ledger.shamePainAbyssLevel > 50) return 'agitated';
    return 'composed';
  }

  private inferInjuries(ledger: YandereLedger, text: string): string[] {
    const injuries: string[] = [];
    const lower = text.toLowerCase();

    // Textual inference
    if (lower.includes('bruise') || lower.includes('blow')) injuries.push('fresh bruising');
    if (lower.includes('cut') || lower.includes('slice') || lower.includes('bleed')) injuries.push('bleeding laceration');
    if (lower.includes('choke') || lower.includes('throat')) injuries.push('bruised neck');
    if (lower.includes('slap') || lower.includes('cheek')) injuries.push('red handprint on cheek');

    // Ledger inference
    if (ledger.physicalIntegrity < 80 && !injuries.some(i => i.includes('bruis'))) injuries.push('visible bruising on wrists and neck');
    if (ledger.traumaLevel > 60) injuries.push('trembling hands, stress-induced muscle tension');
    if (ledger.shamePainAbyssLevel > 70) injuries.push('tear-stained cheeks, bloodshot eyes');
    
    return [...new Set(injuries)]; // Dedupe
  }

  private inferDominancePosture(characterId: string, ledger: YandereLedger, text: string): number {
    const lower = text.toLowerCase();
    
    if (characterId === CharacterId.PLAYER) {
      if (lower.match(/kneel|bow|beg|crawl/)) return 0.1;
      if (lower.match(/stand|glare|spit|resist/)) return 0.6;
      return Math.max(0, Math.min(1, (100 - ledger.complianceScore + ledger.hopeLevel) / 200));
    }
    
    // Agents
    if (lower.match(/loom|tower|step on|down at/)) return 1.0;
    if (lower.match(/lean|sit|lounge/)) return 0.8;
    
    return 0.9; // Faculty/Prefects default to high dominance
  }

  private inferEnvironmentFromContext(context: string, ledger: YandereLedger): void {
    const lower = context.toLowerCase();
    
    let location = this.memory.environmentState.location;
    let lightingScheme = this.memory.environmentState.lightingScheme;
    let atmosphericEffects = [...this.memory.environmentState.atmosphericEffects];
    let dominantColors = [...this.memory.environmentState.dominantColors];
    
    // Location Detection
    if (lower.includes("dock") || lower.includes("arrival")) {
        location = "volcanic rock dock, stormy sky, weeping stone, ocean spray, iron gates";
        lightingScheme = LIGHTING_PRESETS.Moody;
        dominantColors = ['#050505', '#1c1917', '#78716c', '#000000'];
    } else if (lower.includes("office") || lower.includes("study") || lower.includes("selene")) {
        location = "provost's mahogany desk, glowing fireplace, velvet curtains, oppressive luxury";
        lightingScheme = LIGHTING_PRESETS.Intimate;
        dominantColors = ['#450a0a', '#881337', '#7f1d1d', '#050505', '#ca8a04'];
    } else if (lower.includes("infirmary") || lower.includes("clinic") || lower.includes("lab")) {
        location = "medical wing, tiled walls, surgical tools, sterile light";
        lightingScheme = LIGHTING_PRESETS.Clinical;
        dominantColors = ['#e7e5e4', '#78716c', '#1c1917', '#050505'];
    } else if (lower.includes("cell") || lower.includes("cage") || lower.includes("dungeon")) {
        location = "isolation cell, rusted iron bars, damp straw, stone walls";
        lightingScheme = LIGHTING_PRESETS.Harsh;
        dominantColors = ['#050505', '#1c1917', '#44403c', '#be123c'];
    }

    // Dynamic Text-Based Atmospheric Tweaks
    if (lower.includes("rain") || lower.includes("storm")) atmosphericEffects.push("heavy rain", "wet surfaces");
    if (lower.includes("smoke") || lower.includes("cigarette")) atmosphericEffects.push("swirling smoke");
    if (lower.includes("mist") || lower.includes("steam")) atmosphericEffects.push("volumetric fog");
    if (lower.includes("blood")) atmosphericEffects.push("metallic scent visual", "blood slick");

    // Dynamic Lighting Tweaks
    if (lower.includes("dark") || lower.includes("shadow")) lightingScheme = "Heavy Chiaroscuro, minimal light, deep black shadows";
    if (lower.includes("flicker") || lower.includes("candle")) lightingScheme = LIGHTING_PRESETS.WarmCandle;
    if (ledger.traumaLevel > 80) lightingScheme = "Oppressive, suffocating darkness with single harsh spotlight (Trauma Filter)";

    this.memory.environmentState = {
      location,
      lightingScheme,
      atmosphericEffects: [...new Set(atmosphericEffects)].slice(-5), // Keep unique, max 5
      dominantColors
    };
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
    const moodModifiers: string[] = ["clinical-chiaroscuro"];
    const aestheticInjects: string[] = [];

    // --- Subject Resolution ---
    let subjectDescription: any = {};
    if (typeof target === 'string') {
      const profile = VISUAL_PROFILES[target as CharacterId] || "Figure in shadow";
      subjectDescription = {
        name: target.replace(/_/g, " "),
        role: target.includes('Subject') ? "Subject" : "Faculty",
        description: profile,
        attire: profile.includes("velvet") ? "crimson velvet robes" : "dark academic formal",
      };
      
      if (target === CharacterId.PLAYER) {
        moodModifiers.push("vulnerable", "exposed", "submissive");
        aestheticInjects.push(FORGE_MOTIFS.BoundWrists, FORGE_MOTIFS.FlushedSkin);
      } else {
        moodModifiers.push("dominant", "predatory", "elegant");
        aestheticInjects.push(FORGE_MOTIFS.FelineEyes, FORGE_MOTIFS.ImpossibleElegance);
      }
    } else { 
      // Prefect Logic (Procedural)
      const map = ARCHETYPE_VISUAL_MAP[target.archetype] || {};
      
      subjectDescription = {
        name: target.displayName,
        role: "Prefect",
        archetype: target.archetype,
        physique: map.physique || "lean",
        face: map.face || "distinct features",
        attire: map.attire || "dark academic uniform"
      };
      moodModifiers.push(map.mood || "febrile");
      aestheticInjects.push(FORGE_MOTIFS.CruelHalfSmile);
      
      // Trait injection
      if (target.traitVector.charisma > 0.8) aestheticInjects.push(FORGE_MOTIFS.LiquidStrands);
      if (target.traitVector.cruelty > 0.7) aestheticInjects.push(FORGE_MOTIFS.TeasingCruelty);
    }

    // --- Dynamic Ledger Injections ---
    if (ledger.arousalLevel > 60) aestheticInjects.push(FORGE_MOTIFS.RimLitCleavage, FORGE_MOTIFS.WetSilkEffect);
    if (ledger.traumaLevel > 70) aestheticInjects.push(FORGE_MOTIFS.TremblingHands);

    // --- Text Injections ---
    const lowerText = narrativeText.toLowerCase();
    if (lowerText.includes("smile")) aestheticInjects.push("subtle predatory smile");
    if (lowerText.includes("glare")) aestheticInjects.push("cold furious stare");
    if (lowerText.includes("touch") || lowerText.includes("caress")) aestheticInjects.push(FORGE_MOTIFS.LethalCaress);

    return {
      subject: {
        characterId,
        appearance: this.getCharacterAppearance(characterId, visualState, subjectDescription, ledger),
        posture: this.getPostureDescription(visualState, subjectDescription, ledger),
        clothing: visualState?.clothingState || subjectDescription.attire || 'pristine dark academic uniform',
        injuries: visualState?.injuries || [],
        specificMood: moodModifiers.join(", "),
        aestheticInjects: aestheticInjects.join(" | ") 
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
    let base = desc.description || "Figure";
    if (state?.clothingState === 'disheveled') base += ", disheveled uniform, hair escaping";
    if (state?.clothingState === 'torn') base += ", torn clothing, exposed skin";
    if (state?.clothingState === 'bloodstained') base += ", bloodstains on fabric";
    if (ledger.arousalLevel > 60) base += ", flushed skin, sweat-glistened";
    if (ledger.shamePainAbyssLevel > 70) base += ", tear-stained cheeks";
    
    // Inject emotional state into appearance description
    if (state?.emotionalState) {
        base += `, EXPRESSION: ${state.emotionalState.toUpperCase()}`;
    }
    
    return base;
  }

  private getPostureDescription(state: any, desc: any, ledger: any) {
    if (state?.dominancePosture > 0.7) return "dominant, looming, chin raised";
    if (state?.dominancePosture < 0.3) return "kneeling, submissive, head bowed, shoulders hunched";
    return desc.posture || "neutral stance";
  }

  private getTraumaVisualization(ledger: any): string[] {
    const cues = [];
    if (ledger.traumaLevel > 40) cues.push('sweat on forehead');
    if (ledger.traumaLevel > 70) cues.push('dilated pupils');
    if (ledger.shamePainAbyssLevel > 60) cues.push('tear tracks');
    return cues;
  }

  private generateContinuityDirectives(previousTurn?: MultimodalTurn): any {
    if (!previousTurn) return { rule: "Establish baseline style." };
    return {
      rule: "Maintain character consistency with previous turn.",
      reference_context: `Previous scene: ${previousTurn.text.substring(0, 100)}...`
    };
  }

  private getStyleConsistencyLock(): any {
    return {
      technicalLock: {
        brushStrokes: 'soft digital with visible texture',
        colorGrading: 'desaturated with selective crimson/gold accents',
      }
    };
  }

  // Public API
  public recordTurn(turn: MultimodalTurn): void {
    if (!turn.metadata?.ledgerSnapshot) return;
    this.memory.turnHistory.push({
      turnId: turn.id,
      turnIndex: turn.turnIndex,
      dominantCharacterId: turn.metadata?.activeCharacters[0] || CharacterId.PLAYER,
      location: turn.metadata?.location || 'Unknown',
      emotionalTone: this.inferEmotionalState(turn.metadata.ledgerSnapshot, turn.text)
    });
  }

  public reset(): void {
    this.memory.lastCharacterAppearances.clear();
    this.memory.environmentState = {
        location: 'The Arrival Dock',
        lightingScheme: LIGHTING_PRESETS.Moody,
        atmosphericEffects: ['volcanic ash', 'sea spray'],
        dominantColors: ['#050505', '#881337']
    };
    this.memory.turnHistory = [];
  }
}

export const visualCoherenceEngine = new VisualCoherenceEngine();