
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
    directorVisualInstruction?: string // NEW: Direct override from Director
  ): string {
    this.updateCharacterStates(target, ledger, narrativeText);
    this.inferEnvironmentFromContext(sceneContext, ledger); 
    
    const basePromptParts = this.constructBasePrompt(target, sceneContext, ledger, narrativeText);
    const continuityDirectives = this.generateContinuityDirectives(previousTurn);
    const styleConsistencyLock = this.getStyleConsistencyLock();

    // Calculate Dynamic Camera Angle based on Psychological Dominance
    const cameraDirectives = this.calculateCameraDynamics(target, ledger, narrativeText);

    // If Director provided a specific visual instruction, use it as the core subject description
    // while keeping the stylistic wrappers (lighting, camera, aesthetics).
    if (directorVisualInstruction && directorVisualInstruction.length > 10) {
        basePromptParts.subject.description = {
            ...basePromptParts.subject.description,
            director_override: directorVisualInstruction
        };
    }

    const finalPromptObject = {
      header: VISUAL_MANDATE.ZERO_DRIFT_HEADER,
      style: VISUAL_MANDATE.STYLE,
      ...VISUAL_MANDATE.TECHNICAL,
      
      // Priority: Director Instruction > Heuristic Description
      scene_action: directorVisualInstruction || basePromptParts.subject.description,
      
      subject_details: basePromptParts.subject, // Details (clothing, injuries) reinforce the action
      environment: basePromptParts.environment,
      psychometrics: basePromptParts.psychometricVisualization,
      
      camera: cameraDirectives, 
      
      // Context for nuances
      narrative_tone: this.inferEmotionalState(ledger, narrativeText),
      continuity: continuityDirectives,
      styleConsistency: styleConsistencyLock,
      
      negative_prompt: VISUAL_MANDATE.NEGATIVE_PROMPT
    };
    
    return JSON.stringify(finalPromptObject, null, 2);
  }

  /**
   * Calculates the camera angle based on the "Dominance Hierarchy" (PDF 2, Sec 3.2.3)
   * High Dominance Difference -> Extreme Angles.
   */
  private calculateCameraDynamics(
    target: PrefectDNA | CharacterId | string,
    ledger: YandereLedger,
    text: string
  ): any {
    // 1. Calculate Player Dominance (Inverse of Compliance & Trauma)
    // 0.0 = Totally Broken/Compliant, 1.0 = Defiant/Strong
    const complianceFactor = ledger.complianceScore / 100;
    const traumaFactor = ledger.traumaLevel / 100;
    const playerDominance = Math.max(0, 1.0 - (complianceFactor * 0.6 + traumaFactor * 0.4));

    // 2. Calculate Target (Agent) Dominance
    let agentDominance = 1.0; // Faculty default to max
    let agentAmbition = 0.5;

    if (typeof target !== 'string') {
        const dna = target as PrefectDNA;
        // Prefect dominance relies on Favor (Status) and Ambition (Posture)
        // High favor = 1.0, Low favor = 0.2
        const favorFactor = dna.favorScore / 100;
        agentAmbition = dna.traitVector.ambition;
        
        // Base dominance mix
        agentDominance = (favorFactor * 0.5) + (agentAmbition * 0.5);
        
        // Elara (Loyalist) specific: High submission lowers her visual dominance despite status
        if (dna.archetype === 'The Zealot') {
            agentDominance -= 0.2; 
        }
        // Petra/Sadist specific: Cruelty increases visual imposingness
        if (dna.traitVector.cruelty > 0.7) {
            agentDominance += 0.2;
        }
    }

    // 3. Narrative Overrides (The Somatic Cascade)
    // The text describes the immediate physical reality, which overrides stats.
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes("kneel") || lowerText.includes("floor") || lowerText.includes("crawling") || lowerText.includes("bow")) {
        agentDominance += 0.4; // Player is physically lower
    }
    if (lowerText.includes("looking down") || lowerText.includes("towering") || lowerText.includes("looms")) {
        agentDominance += 0.3;
    }
    if (lowerText.includes("stand") || lowerText.includes("rise") || lowerText.includes("spit")) {
        agentDominance -= 0.2; // Player defiance
    }
    if (lowerText.includes("seated") || lowerText.includes("chair") || lowerText.includes("desk")) {
        // Seated faculty implies confidence/dominance without height difference
        agentDominance += 0.1; 
    }

    // 4. Calculate Delta and Map to Camera Logic
    // Positive Delta = Agent dominates Player (Low Angle / Looking Up)
    // Negative Delta = Player dominates Agent (High Angle / Looking Down)
    const dominanceDelta = agentDominance - playerDominance;

    let angle = "eye_level_confrontational";
    let framing = "medium_shot";
    let movement = "static_tension";

    // ANGLE LOGIC
    if (dominanceDelta > 0.6) {
        // Overwhelming Dominance
        angle = "extreme_low_angle_worm_eye_view"; // Viewer feels small, Agent looks like a giant
        framing = "looming_close_up";
    } else if (dominanceDelta > 0.3) {
        // Assertive Dominance
        angle = "low_angle_heroic_power"; 
        framing = "cowboy_shot"; // Knees up, powerful stance
    } else if (dominanceDelta < -0.2) {
        // Player Defiance / Agent Vulnerability
        angle = "high_angle_looking_down"; // Agent looks smaller
        framing = "medium_full_shot"; // Isolate them in space
    } else {
        // Near Equal / Tension
        // High Trauma + Equal Dominance = Disorientation
        if (ledger.traumaLevel > 70) {
            angle = "dutch_angle_tilted"; // Unsettling
        } else {
            angle = "eye_level_intimate"; // Direct confrontation
        }
    }

    // "Manara Gaze" Focus Logic (Fetishistic Detail)
    let focus = "face_and_eyes";
    if (lowerText.includes("hand") || lowerText.includes("touch") || lowerText.includes("finger")) focus = "hands_interacting_with_skin";
    if (lowerText.includes("boots") || lowerText.includes("step") || lowerText.includes("heel")) focus = "boots_and_legs_low_angle";
    if (lowerText.includes("smile") || lowerText.includes("lips") || lowerText.includes("whisper")) focus = "lips_extreme_close_up";
    if (lowerText.includes("eye") || lowerText.includes("stare") || lowerText.includes("gaze")) focus = "eyes_reflecting_fear";
    if (lowerText.includes("neck") || lowerText.includes("choke") || lowerText.includes("throat")) focus = "neck_and_hands";

    // Framing Adjustments for Intimacy
    if (ledger.arousalLevel > 60 || lowerText.includes("close") || lowerText.includes("breath")) {
        framing = "extreme_close_up_macro";
        angle = "intimate_eye_level";
    }

    return {
        angle: angle,
        framing: framing,
        focus: focus,
        movement_implication: movement,
        dominance_metric: dominanceDelta.toFixed(2),
        description: `Camera positioned ${angle.replace(/_/g, " ")} to emphasize ${dominanceDelta > 0 ? 'subject vulnerability' : 'agent vulnerability'}. Focus on ${focus.replace(/_/g, " ")}.`
    };
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
    const trauma = ledger.traumaLevel || 0;
    const arousal = ledger.arousalLevel || 0;

    // "Eroticized Distress" Logic (High Trauma + High Arousal)
    if (trauma > 60 && arousal > 50) {
        return 'desirous'; // Maps to "unwilling arousal", "flushed skin", "tear-stained"
    }

    if (lower.match(/cry|weep|sob|tear|break/)) return 'broken';
    if (lower.match(/laugh|grin|smile|manic/)) return 'ecstatic';
    if (lower.match(/glare|frown|fury|rage/)) return 'agitated';
    if (lower.match(/shiver|tremble|shake|terror/)) return 'terrified';
    if (lower.match(/moan|gasp|want|need|heat/)) return 'desirous';
    if (lower.match(/shame|blush|avert/)) return 'humiliated';
    if (lower.match(/hopeless|void|nothing|empty/)) return 'despairing';
    
    if (ledger.hopeLevel < 20) return 'despairing';
    if (trauma > 80) return 'terrified';
    if (ledger.shamePainAbyssLevel > 80) return 'humiliated';
    if (ledger.complianceScore > 80) return 'composed';
    if (trauma > 50) return 'agitated';
    return 'composed';
  }

  private inferInjuries(ledger: YandereLedger, text: string): string[] {
    const injuries: string[] = [];
    const lower = text.toLowerCase();
    
    // Somatic Cascade Specifics
    if (lower.includes('void') || lower.includes('nausea')) injuries.push('clutching stomach');
    if (lower.includes('shake') || lower.includes('tremble')) injuries.push('uncontrollable tremors');
    
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
    // Male Subjects logic
    if (characterId === CharacterId.PLAYER || characterId === CharacterId.NICO || characterId === CharacterId.DARIUS || characterId === CharacterId.SILAS || characterId === CharacterId.THEO) {
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

    // Atmosphere Logic based on Ledger (The Somatic Cascade environment reflection)
    const trauma = ledger.traumaLevel || 0;
    
    if (trauma > 80) {
        // "Systemic Shock" visualization
        atmosphericEffects = ["suffocating humidity", "red-tinted vision", "vignette darkness", "tilting horizon"];
        lightingScheme = LIGHTING_PRESETS.Harsh; // Clinical exposure
    } else if (trauma > 50) {
        atmosphericEffects = ["heavy steam", "slick condensation", "claustrophobic shadows"];
    } else if (ledger.complianceScore > 70) {
        // "Ordered" visualization for high compliance
        atmosphericEffects = ["ordered stillness", "cold clarity", "symmetrical shadows"];
        lightingScheme = LIGHTING_PRESETS.Clinical;
    } else if (lower.includes("rain")) {
        atmosphericEffects = ["heavy rain", "slick surfaces"];
    }

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

      // Player and Male Subject Specific Logic
      const isMaleSubject = 
        target === CharacterId.PLAYER || 
        target === CharacterId.NICO || 
        target === CharacterId.DARIUS || 
        target === CharacterId.SILAS || 
        target === CharacterId.THEO;

      if (isMaleSubject) {
        moodModifiers.push("vulnerable", "exposed", "eroticized-distress");
        aestheticInjects.push(FORGE_MOTIFS.BoundWrists);
        
        // Eroticized Distress logic for Player/Subjects
        if (ledger.arousalLevel > 40) {
            aestheticInjects.push(FORGE_MOTIFS.FlushedSkin, "heavy lidded eyes");
        }
        if (ledger.traumaLevel > 60) {
            aestheticInjects.push(FORGE_MOTIFS.TremblingHands, "sweat-beaded forehead");
        }

        // Specific Subject Visuals
        if (target === CharacterId.NICO) {
            moodModifiers.push("defiant", "intense");
            aestheticInjects.push("fresh bruising", "burning glare");
        } else if (target === CharacterId.DARIUS) {
            moodModifiers.push("broken-protector", "exhausted");
            aestheticInjects.push("slumped shoulders", "gentle eyes");
        } else if (target === CharacterId.THEO) {
            moodModifiers.push("fragile", "terrified");
            aestheticInjects.push("pale skin", "tear tracks", "oversized uniform");
        } else if (target === CharacterId.SILAS) {
            moodModifiers.push("blank", "robotic");
            aestheticInjects.push("unblinking stare", "perfect posture");
        }
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
    if (ledger.arousalLevel > 60) base += ", flushed skin, dilated pupils (Eroticized Distress)";
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
    if (ledger.traumaLevel > 40) cues.push('sweat on forehead', 'pale complexion');
    if (ledger.shamePainAbyssLevel > 60) cues.push('tear tracks', 'averted gaze');
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
