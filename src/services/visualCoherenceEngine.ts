
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn, CharacterVisualState, EnvironmentState, VisualMemory } from '../types';
import { VISUAL_PROFILES } from '../constants';
import { LIGHTING_PRESETS } from '../config/visualMandate';
import { CHARACTER_VOICE_MAP } from '../config/voices';
import { FORGE_MOTIFS, ARCHETYPE_VISUAL_MAP } from '../data/motifs'; 
import { NarrativeBeat } from '../services/TensionManager';
import { THEME } from '@/theme';

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

    const hasDialogue = [...narrativeText.matchAll(/“[^”]+”/g)].length > 1;

    if (hasDialogue) {
      let multiSpeakerText = "";
      let lastSpeaker = "Narrator";

      narrativeText.split('\n').forEach(line => {
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
          if (!line.startsWith('“')) {
             multiSpeakerText += `Narrator (Charon voice): ${line.trim()}\n`;
          } else {
             multiSpeakerText += `${lastSpeaker} continues: ${line.trim()}\n`;
          }
        }
      });

      return `Generate multi-speaker audio. Style: ${styleAdditions.join("; ")}. Text:\n${multiSpeakerText}`;
    }

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
 * VisualCoherenceEngine v3.2 – Enhanced Manara-Noir Style Lock
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
        dominantColors: [THEME.colors.bg, THEME.colors.accentBurgundy, THEME.colors.accentGold, THEME.colors.panel], // Use theme colors
        keyProps: [], 
        surfaceMaterials: [], 
        architecturalStyle: "Roman Imperial decay, Gothic Bedlam" 
      },
      timeOfDay: 'evening',
      weatherCondition: 'stormy',
      turnHistory: []
    };
  }

  private calculateCameraDynamics(ledger: YandereLedger, narrativeText: string, target?: PrefectDNA | CharacterId | string): string {
    const dirs: string[] = [];
    const lowerText = narrativeText.toLowerCase();

    let targetArchetype: string | undefined;
    if (typeof target === 'object' && 'archetype' in target) {
        targetArchetype = target.archetype;
    } else if (typeof target === 'string' && ARCHETYPE_VISUAL_MAP[target]) {
        targetArchetype = target;
    }

    // Archetype-specific camera dynamics
    if (targetArchetype) {
        const visualArchetypeData = ARCHETYPE_VISUAL_MAP[targetArchetype];
        if (visualArchetypeData?.visualDNA?.includes("feline eyes") || visualArchetypeData?.visualDNA?.includes("predatory grin")) {
            dirs.push("extreme close-up on eyes and mouth, shallow depth isolating facial micro-expressions");
        }
        if (visualArchetypeData?.visualDNA?.includes("statuesque") || visualArchetypeData?.visualDNA?.includes("imposing")) {
            dirs.push("low-angle worm's eye view emphasizing towering authority figures");
        }
    }

    // Ledger-based camera dynamics
    if (ledger.traumaLevel > 85 || ledger.shamePainAbyssLevel > 80) {
      dirs.push("violent handheld camera shake, extreme macro 100mm lens, shallow depth f/1.2, aggressive 45° Dutch tilt, blurred periphery, focus on dilated pupils");
    } else if (ledger.traumaLevel > 60 || ledger.shamePainAbyssLevel > 60) {
      dirs.push("Dutch angle 20°, subtle handheld tremor, low-angle power shot, slightly distorted perspective");
    } else if (ledger.arousalLevel > 50) {
      dirs.push("intimate close-up, shallow depth of field, focus on glistening skin and trembling lips");
    } else if (ledger.hopeLevel < 30) {
      dirs.push("high-angle shot, wide to emphasize isolation, subject small in frame");
    }

    // Phase-specific (general mood)
    if (ledger.phase === 'gamma') {
      dirs.push("anamorphic lens flares, crushed blacks, pulsating breathing vignette, heavy film grain, 35mm look");
    }

    // Narrative keyword override
    if (lowerText.includes("close-up") || lowerText.includes("face") || lowerText.includes("eyes")) {
      dirs.unshift("extreme close-up on eyes and mouth, shallow depth"); // Prioritize explicit narrative cues
    } else if (!dirs.length) { // Default if no specific triggers
      dirs.unshift("cinematic medium shot, perfect composition");
    }

    return dirs.join("; ");
  }

  private calculateLightingDynamics(ledger: YandereLedger, target?: PrefectDNA | CharacterId | string): string {
    let targetArchetype: string | undefined;
    if (typeof target === 'object' && 'archetype' in target) {
        targetArchetype = target.archetype;
    } else if (typeof target === 'string' && ARCHETYPE_VISUAL_MAP[target]) {
        targetArchetype = target;
    }

    // Archetype-specific lighting defaults
    let lightingPreset = "cold clinical overhead fluorescent, flat even illumination, sterile observation";
    if (targetArchetype) {
        switch (targetArchetype) {
            case 'The Confessor': lightingPreset = LIGHTING_PRESETS.Intimate; break;
            case 'The Sadist': lightingPreset = LIGHTING_PRESETS.Harsh; break;
            case 'The Logician': lightingPreset = LIGHTING_PRESETS.Clinical; break;
            case 'The Nurse': lightingPreset = LIGHTING_PRESETS.WarmCandle; break; 
            case 'The Provost': lightingPreset = LIGHTING_PRESETS.Moody; break;
        }
    }

    // Ledger-based lighting dynamics
    if (ledger.traumaLevel > 80) {
      // More aggressive crimson rim light, deeper shadows
      return "single dramatic crimson rim light from above, extreme chiaroscuro, deep crushed blacks, volumetric dust, almost blood-like in intensity";
    } else if (ledger.shamePainAbyssLevel > 70) {
      // Shaming spotlight, drowning in shadows
      return "harsh, isolating overhead spotlight on subject, rest of scene in impenetrable shadow, emphasizing exposure and shame";
    } else if (ledger.arousalLevel > 50) {
      // Conflicting sensual and clinical lights
      return "flickering gaslight warm tones mixed with cold, clinical observation lights, creating an atmosphere of eroticized tension and scrutiny";
    } else if (ledger.traumaLevel > 50) {
      // Existing trauma lighting
      return "single dramatic crimson rim light from above, extreme chiaroscuro, deep crushed blacks, volumetric dust";
    }
    
    // Fallback to determined archetype preset or default
    return lightingPreset;
  }

  private inferSomaticDetails(ledger: YandereLedger, narrativeText: string): string[] {
    const details: string[] = [];
    const lower = narrativeText.toLowerCase();

    if (ledger.traumaLevel > 40) details.push("sweat-beaded forehead, pale complexion");
    if (ledger.arousalLevel > 50) details.push("unwillingly flushed skin, dilated pupils");
    if (lower.match(/pain|hurt|ache|throb/)) details.push("visible wince, clenched jaw");
    if (lower.match(/trembl|shiver|shak/)) details.push("uncontrollable fine trembling");
    if (lower.match(/sweat|perspir/)) details.push("glistening sweat on exposed skin");
    if (lower.match(/flush|red|blush/)) details.push("deep flush spreading across chest");

    return details;
  }

  private _selectMotifs(ledger: YandereLedger, narrativeText: string, sceneContext: string, beat?: NarrativeBeat): string[] {
    const motifs: string[] = [];
    const lowerNarrative = narrativeText.toLowerCase();

    if (beat === 'CLIMAX') motifs.push(FORGE_MOTIFS.EgoShatter, FORGE_MOTIFS.RhythmSpike);
    if (beat === 'SETUP') motifs.push(FORGE_MOTIFS.VolcanicHaze, FORGE_MOTIFS.AnticipatoryThrum);

    // Ledger-based motif triggers
    if (ledger.traumaLevel > 70) motifs.push(FORGE_MOTIFS.TearTracks, FORGE_MOTIFS.AvertedGaze, FORGE_MOTIFS.GlisteningSweat);
    if (ledger.shamePainAbyssLevel > 60) motifs.push(FORGE_MOTIFS.AvertedGaze, FORGE_MOTIFS.TearTracks, FORGE_MOTIFS.OntologicalVertigo);
    if (ledger.arousalLevel > 50) motifs.push(FORGE_MOTIFS.FlushedSkin, FORGE_MOTIFS.DilatedPupils, FORGE_MOTIFS.SomaticBetrayal);
    if (ledger.hopeLevel < 30) motifs.push(FORGE_MOTIFS.RigidPosture, FORGE_MOTIFS.OntologicalVertigo, FORGE_MOTIFS.CrushedBlacks);

    // Keyword-based motif triggers
    if (lowerNarrative.includes("kneel")) motifs.push(FORGE_MOTIFS.RigidPosture);
    if (lowerNarrative.includes("whisper")) motifs.push(FORGE_MOTIFS.ToxicLullaby, FORGE_MOTIFS.ForeignEndearment);
    if (lowerNarrative.includes("touch")) motifs.push(FORGE_MOTIFS.HealersBind); 
    
    return Array.from(new Set(motifs));
  }

  private buildSubjectDescription(target: PrefectDNA | CharacterId | string, ledger: YandereLedger, narrativeText: string, sceneContext: string, beat?: NarrativeBeat): string {
    let base = "";
    let somaticDetails: string[] = this.inferSomaticDetails(ledger, narrativeText);
    let visualDNAKeywords: string[] = [];
    let poseAndExpression: string[] = [];

    if (typeof target === 'object' && 'archetype' in target) {
        const archData = ARCHETYPE_VISUAL_MAP[target.archetype];
        if (archData) {
            base = `${target.displayName} (${target.archetype}): ${archData.physique}, ${archData.face}, wearing ${archData.attire}. Mood: ${archData.mood}`;
            if (archData.visualDNA) visualDNAKeywords.push(archData.visualDNA);
        } else {
            base = `${target.displayName} (${target.archetype}): detailed figure`;
        }
        if (target.appearanceDescription) base += `. APPEARANCE: ${target.appearanceDescription}`;
    } else if (typeof target === 'string') {
        if (VISUAL_PROFILES[target as CharacterId]) {
            base = VISUAL_PROFILES[target as CharacterId];
        } else {
            base = `${target}: vulnerable figure in tattered uniform`;
        }
    }

    // Dynamic pose and expression based on ledger
    if (ledger.traumaLevel > 80) poseAndExpression.push("body convulsing slightly, eyes wide with terror and dissociation");
    else if (ledger.traumaLevel > 60) poseAndExpression.push("trembling posture, eyes fixed on an unseen threat");
    
    if (ledger.shamePainAbyssLevel > 70) poseAndExpression.push("head bowed in deep shame, shoulders hunched, attempting to hide");
    
    if (ledger.arousalLevel > 50) poseAndExpression.push("pose of unwilling arousal, body subtly arching, eyes half-lidded with conflict");
    
    if (ledger.hopeLevel < 30) poseAndExpression.push("defeated slump, eyes dull and vacant, resigned expression");
    else if (ledger.hopeLevel > 70) poseAndExpression.push("faint spark of defiance in eyes, tense but ready posture");

    const dynamicMotifs = this._selectMotifs(ledger, narrativeText, sceneContext, beat); 
    const combinedDetails = Array.from(new Set([...somaticDetails, ...visualDNAKeywords, ...dynamicMotifs, ...poseAndExpression]));

    return `${base}${combinedDetails.length ? '. Details: ' + combinedDetails.join(', ') : ''}`;
  }

  public buildCoherentPrompt(
    target: PrefectDNA | CharacterId | string,
    sceneContext: string,
    ledger: YandereLedger,
    narrativeText: string,
    previousTurn?: MultimodalTurn,
    directorVisualInstruction?: string,
    beat?: NarrativeBeat
  ): { imagePrompt: string; ttsPrompt: string } {
    const camera = this.calculateCameraDynamics(ledger, narrativeText, target);
    const lighting = this.calculateLightingDynamics(ledger, target);
    const subject = directorVisualInstruction || this.buildSubjectDescription(target, ledger, narrativeText, sceneContext, beat);
    const env = this.memory.environmentState;

    const imageJson = {
      task: "generate_image",
      style: "((MASTER STYLE LOCK)): Milo Manara style (clean ink lines, fluid contours, impossible elegance, feline eyes, cruel half-smile, teasing cruelty, liquid strands, languid dominance), high-contrast Neo-Noir, erotic dark academia. Clinical line, unforgiving precision, negative space isolation, wet surfaces, Art Deco geometry, smoke haze, clinical chiaroscuro.",
      camera,
      lighting,
      subject,
      environment: `${sceneContext || env.location}, sweating ancient stone, ${env.atmosphericEffects.join(', ')}`,
      mood: "bored clinical inevitability | ontological exposure | somatic vulnerability",
      technical: "high resolution, sharp focus on eyes, subtle film grain, 16:9 cinematic aspect ratio"
    };

    const ttsPrompt = audioCoherenceEngine.buildTTSPrompt(narrativeText, ledger);

    return {
      imagePrompt: `Generate image strictly adhering to this JSON structure: ${JSON.stringify(imageJson)}`,
      ttsPrompt
    };
  }
}

export const visualCoherenceEngine = new VisualCoherenceEngine();