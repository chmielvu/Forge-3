
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn, CharacterVisualState, EnvironmentState, VisualMemory } from '../types';
import { VISUAL_PROFILES } from '../constants';
import { LIGHTING_PRESETS } from '../config/visualMandate';
import { CHARACTER_VOICE_MAP } from '../config/voices';
import { FORGE_MOTIFS, ARCHETYPE_VISUAL_MAP } from '../data/motifs'; // NEW: Import ARCHETYPE_VISUAL_MAP

/**
 * AudioCoherenceEngine v2
 * Leverages Gemini 2.5 TTS multi-speaker + style control
 */
class AudioCoherenceEngine {
  private baseStyle = "deep measured clinical tone with bored inevitability, slow deliberate pacing";

  public buildTTSPrompt(narrativeText: string, ledger: YandereLedger): string {
    const styleAdditions: string[] = [this.baseStyle];

    if (ledger.traumaLevel > 80 || ledger.shamePainAbyssLevel > 70) {
      styleAdditions.push("subtle voice cracks on intense words, breath catches during somatic peaks");
    }
    if (ledger.phase === 'gamma') {
      styleAdditions.push("distant echoing quality with layered whispers beneath primary voice");
    }

    // Detect dialogue for multi-speaker
    const hasDialogue = [...narrativeText.matchAll(/“[^”]+”/g)].length > 1;

    if (hasDialogue) {
      // Format as multi-speaker (Gemini accepts Speaker tags or simple lines)
      let multiSpeakerText = "";
      let lastSpeaker = "Narrator";

      // Split by newlines to process paragraphs
      narrativeText.split('\n').forEach(line => {
        // Match standard dialogue format: “Quote” — Speaker
        // Or variations like: Speaker: “Quote”
        const standardMatch = line.match(/“([^”]+)”\s*[—–-]\s*([A-Za-z\s]+)/);
        const colonMatch = line.match(/^([A-Za-z]+):\s*“([^”]+)”/);
        
        if (standardMatch) {
          const quote = standardMatch[1];
          const speakerName = standardMatch[2].trim();
          const voiceId = this.resolveVoice(speakerName);
          multiSpeakerText += `${speakerName} (${voiceId} voice): ${quote}\n`;
          lastSpeaker = speakerName;
        } else if (colonMatch) {
          const speakerName = colonMatch[1].trim();
          const quote = colonMatch[2];
          const voiceId = this.resolveVoice(speakerName);
          multiSpeakerText += `${speakerName} (${voiceId} voice): ${quote}\n`;
          lastSpeaker = speakerName;
        } else if (line.trim()) {
          // Narration
          if (!line.startsWith('“')) {
             multiSpeakerText += `Narrator (Charon voice): ${line.trim()}\n`;
          } else {
             // Unattributed dialogue, assume last speaker or Narrator
             multiSpeakerText += `${lastSpeaker} continues: ${line.trim()}\n`;
          }
        }
      });

      return `Generate multi-speaker audio with character voice consistency. Style: ${styleAdditions.join("; ")}. Text:\n${multiSpeakerText}`;
    }

    // Single-speaker fallback
    return `Speak as primary narrator (Zephyr voice) with style: ${styleAdditions.join("; ")}. Text: ${narrativeText}`;
  }

  private resolveVoice(name: string): string {
      const upper = name.toUpperCase();
      for (const [key, val] of Object.entries(CHARACTER_VOICE_MAP)) {
          if (key.includes(upper) || upper.includes(key.toUpperCase())) return val;
      }
      if (upper.includes("SELENE")) return 'Zephyr';
      return 'Puck';
  }
}

export const audioCoherenceEngine = new AudioCoherenceEngine();

/**
 * VisualCoherenceEngine v3.1 – Narrative Lighting + Multi-Speaker TTS
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

  private calculateCameraDynamics(ledger: YandereLedger, narrativeText: string): string {
    const dirs: string[] = [];
    const lowerText = narrativeText.toLowerCase();

    if (ledger.phase === 'gamma') {
      dirs.push("anamorphic lens flares with horizontal streaks, crushed blacks, pulsating breathing vignette, heavy film grain, 35mm anamorphic look");
    }

    if (ledger.shamePainAbyssLevel > 80 || ledger.traumaLevel > 90) {
      dirs.push("violent handheld camera shake, extreme macro 100mm lens intruding into personal space, shallow depth f/1.2, aggressive 30° Dutch tilt, erratic breathing focus pulls");
    } else if (ledger.shamePainAbyssLevel > 70 || ledger.traumaLevel > 80) {
      dirs.push("unstable handheld macro 100mm lens, shallow depth f/1.4, 25° Dutch tilt, subtle but persistent camera shake and breathing focus oscillation");
    } else if (ledger.shamePainAbyssLevel > 50 || ledger.traumaLevel > 60) {
      dirs.push("Dutch angle 18–22°, slight handheld tremor, low-angle worm's eye view emphasizing towering authority figures");
    }

    if ((ledger.arousalLevel || 0) + (ledger.prostateSensitivity || 0) > 140) {
      dirs.push("slow predatory macro push-in on throat, collarbone, and flushed skin details, lingering clinical gaze, extreme shallow depth isolating somatic response");
    } else if ((ledger.arousalLevel || 0) + (ledger.prostateSensitivity || 0) > 100) {
      dirs.push("gradual creeping push-in on trembling throat and flushed skin, macro lens revealing unwilling physiological betrayal");
    }

    if ((ledger.complianceScore || 0) < 30) {
      dirs.push("chaotic fractured framing, rapid whip pans and focus whips between subject and multiple prefects, visual disruption mirroring resistance");
    } else if ((ledger.complianceScore || 0) > 80) {
      dirs.push("perfectly locked-off symmetrical composition, static clinical framing, absolute order restored");
    }

    if ((ledger.hopeLevel || 0) < 20) {
      dirs.push("pronounced fish-eye barrel distortion at frame edges, warped reality, claustrophobic perspective");
    }

    if (lowerText.includes("close-up") || lowerText.includes("face") || lowerText.includes("eyes")) {
      dirs.unshift("extreme close-up on eyes and mouth, shallow depth isolating facial micro-expressions");
    }
    if (lowerText.includes("wide") || lowerText.includes("room") || lowerText.includes("chamber")) {
      dirs.unshift("wide establishing shot 24mm lens, subject dwarfed by oppressive architecture");
    }

    return dirs.length ? dirs.join("; ") : "medium close-up 50mm lens, static clinical framing, high contrast chiaroscuro";
  }

  private calculateLightingDynamics(ledger: YandereLedger): string {
    if (ledger.phase === 'gamma') {
      return "conflicting practical sources: flickering overhead fluorescents mixed with pulsing crimson emergency strips, anamorphic flares, crushed blacks with blooming highlights";
    }
    if (ledger.shamePainAbyssLevel > 70 || ledger.traumaLevel > 80) {
      return "dual conflicting sources: harsh cold overhead clinical light vs warm crimson rim from side, creating visual fracture and internal conflict, deep shadows with nervous edge highlights";
    }
    if (ledger.traumaLevel > 50) {
      return "single dramatic crimson rim light from above, extreme chiaroscuro, deep crushed blacks, subtle volumetric dust rays cutting through haze";
    }
    return "cold clinical overhead fluorescent, flat even illumination with minimal shadows, sterile observation";
  }

  private inferSomaticDetails(ledger: YandereLedger, narrativeText: string): string[] {
    const details: string[] = [];
    const lower = narrativeText.toLowerCase();

    if (ledger.traumaLevel > 40) details.push("sweat-beaded forehead, pale complexion");
    if (ledger.shamePainAbyssLevel > 60) details.push("tear tracks, averted gaze");
    if ((ledger.arousalLevel || 0) > 60) details.push("flushed skin and dilated pupils from unwilling somatic distress");
    if (ledger.prostateSensitivity > 40) details.push("rigid posture from cremasteric tension");

    if (lower.match(/pain|hurt|ache|throb|burn/)) details.push("visible wince, clenched jaw");
    if (lower.match(/trembl|shiver|shak|quiver/)) details.push("uncontrollable fine trembling");
    if (lower.match(/sweat|perspir|bead/)) details.push("glistening sweat on exposed skin");
    if (lower.match(/flush|red|blush|hot/)) details.push("deep flush spreading across chest and neck");
    if (lower.match(/tear|cry|sob|weep/)) details.push("fresh tear trails, red-rimmed eyes");

    return details;
  }

  // NEW: Method to dynamically select motifs based on ledger and narrative
  private _selectMotifs(ledger: YandereLedger, narrativeText: string): string[] {
    const motifs: string[] = [];
    const lowerNarrative = narrativeText.toLowerCase();

    // Ledger-based motif triggers
    if (ledger.traumaLevel > 70) {
        motifs.push(FORGE_MOTIFS.TearTracks);
        motifs.push(FORGE_MOTIFS.AvertedGaze);
        if (ledger.traumaLevel > 85) {
            motifs.push(FORGE_MOTIFS.EgoShatter);
        }
    }
    if (ledger.shamePainAbyssLevel > 60) {
        motifs.push(FORGE_MOTIFS.ClenchedJaw);
        motifs.push(FORGE_MOTIFS.BodilyBetrayal);
    }
    if ((ledger.arousalLevel || 0) > 60) {
        motifs.push(FORGE_MOTIFS.FlushedSkin);
        motifs.push(FORGE_MOTIFS.DilatedPupils);
    }
    if ((ledger.prostateSensitivity || 0) > 40) {
        motifs.push(FORGE_MOTIFS.RigidPosture);
    }

    // Keyword-based motif triggers
    if (lowerNarrative.includes("bound") || lowerNarrative.includes("restrained")) {
        motifs.push(FORGE_MOTIFS.BoundWrists);
    }
    if (lowerNarrative.includes("groin") || lowerNarrative.includes("testi")) {
        motifs.push(FORGE_MOTIFS.SeatOfEgo);
        motifs.push(FORGE_MOTIFS.CovenantRestraint);
    }
    if (lowerNarrative.includes("chest") || lowerNarrative.includes("cleavage")) {
        motifs.push(FORGE_MOTIFS.RimLitCleavage);
        motifs.push(FORGE_MOTIFS.VelvetShadowPool);
    }
    if (lowerNarrative.includes("kneel") || lowerNarrative.includes("bow")) {
        motifs.push(FORGE_MOTIFS.RigidPosture);
    }
    if (lowerNarrative.includes("sweat")) {
        motifs.push(FORGE_MOTIFS.GlisteningSweat);
    }
    if (lowerNarrative.includes("smile") && lowerNarrative.includes("cruel")) {
        motifs.push(FORGE_MOTIFS.CruelHalfSmile);
    }
    if (lowerNarrative.includes("eyes") && lowerNarrative.includes("feline")) {
        motifs.push(FORGE_MOTIFS.FelineEyes);
    }

    // Deduplicate and return
    return Array.from(new Set(motifs));
  }

  private buildSubjectDescription(target: PrefectDNA | CharacterId | string, ledger: YandereLedger, narrativeText: string): string {
    let base = "";
    
    // Attempt to resolve base description from Archetype Map or Visual Profiles
    if (typeof target === 'object' && 'archetype' in target) {
        // It's a PrefectDNA
        const archData = ARCHETYPE_VISUAL_MAP[target.archetype];
        if (archData) {
            base = `${target.displayName} (${target.archetype}): ${archData.physique}, ${archData.face}, wearing ${archData.attire}. Mood: ${archData.mood}`;
        } else {
            // Fallback
             base = `${target.displayName} (${target.archetype}): detailed prefect figure`;
        }
    } else if (typeof target === 'string') {
        // Check if it's a CharacterId
        if (VISUAL_PROFILES[target as CharacterId]) {
            base = VISUAL_PROFILES[target as CharacterId];
        } 
        // Check if it's an archetype key
        else if (ARCHETYPE_VISUAL_MAP[target]) {
             const archData = ARCHETYPE_VISUAL_MAP[target];
             base = `${target}: ${archData.physique}, ${archData.face}, wearing ${archData.attire}`;
        } else {
            base = `${target}: vulnerable figure in tattered academy uniform`;
        }
    }

    const somatic = this.inferSomaticDetails(ledger, narrativeText);
    const dynamicMotifs = this._selectMotifs(ledger, narrativeText); 

    const combinedDetails = Array.from(new Set([...somatic, ...dynamicMotifs]));

    return `${base}${combinedDetails.length ? '. Visible details: ' + combinedDetails.join(', ') : ''}, under cold clinical gaze`;
  }

  public buildCoherentPrompt(
    target: PrefectDNA | CharacterId | string,
    sceneContext: string,
    ledger: YandereLedger,
    narrativeText: string,
    previousTurn?: MultimodalTurn,
    directorVisualInstruction?: string
  ): { imagePrompt: string; ttsPrompt: string } {
    const camera = this.calculateCameraDynamics(ledger, narrativeText);
    const lighting = this.calculateLightingDynamics(ledger);
    const subject = directorVisualInstruction || this.buildSubjectDescription(target, ledger, narrativeText);

    const env = this.memory.environmentState;

    const imageJson = {
      task: "generate_image",
      style: "photorealistic cinematic dark academia psychological horror, soft digital oil painting with precise anatomical detail",
      camera,
      lighting,
      subject,
      environment: `${env.location}, sweating ancient stone, ${env.atmosphericEffects.join(', ')}, dominant colors #050505 #881337 #facc15`,
      mood: "bored clinical inevitability | ontological exposure under scrutinizing gaze | somatic vulnerability",
      technical: "high resolution, sharp focus on eyes and skin texture, subtle film grain, 16:9 wide cinematic aspect ratio, no text or overlays"
    };

    const ttsPrompt = audioCoherenceEngine.buildTTSPrompt(narrativeText, ledger);

    return {
      imagePrompt: `Generate image strictly adhering to this JSON structure: ${JSON.stringify(imageJson)}`,
      ttsPrompt
    };
  }
}

export const visualCoherenceEngine = new VisualCoherenceEngine();
