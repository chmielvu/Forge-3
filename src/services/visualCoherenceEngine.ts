
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn, CharacterVisualState, EnvironmentState, VisualMemory } from '../types';
import { VISUAL_PROFILES } from '../constants';
import { LIGHTING_PRESETS } from '../config/visualMandate';
import { CHARACTER_VOICE_MAP } from '../config/voices';
import { FORGE_MOTIFS, ARCHETYPE_VISUAL_MAP } from '../data/motifs'; 
import { NarrativeBeat } from '../services/TensionManager';

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
        dominantColors: ['#050505', '#881337', '#facc15', '#1c1917'],
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

    if (targetArchetype) {
        const visualArchetypeData = ARCHETYPE_VISUAL_MAP[targetArchetype];
        if (visualArchetypeData?.visualDNA?.includes("feline eyes") || visualArchetypeData?.visualDNA?.includes("predatory grin")) {
            dirs.push("extreme close-up on eyes and mouth, shallow depth isolating facial micro-expressions");
        }
        if (visualArchetypeData?.visualDNA?.includes("statuesque") || visualArchetypeData?.visualDNA?.includes("imposing")) {
            dirs.push("low-angle worm's eye view emphasizing towering authority figures");
        }
    }

    if (ledger.phase === 'gamma') {
      dirs.push("anamorphic lens flares, crushed blacks, pulsating breathing vignette, heavy film grain, 35mm look");
    }

    if (ledger.shamePainAbyssLevel > 80 || ledger.traumaLevel > 90) {
      dirs.push("violent handheld camera shake, extreme macro 100mm lens, shallow depth f/1.2, aggressive 30° Dutch tilt");
    } else if (ledger.shamePainAbyssLevel > 50 || ledger.traumaLevel > 60) {
      dirs.push("Dutch angle 20°, slight handheld tremor, low-angle power shot");
    }

    if (lowerText.includes("close-up") || lowerText.includes("face") || lowerText.includes("eyes")) {
      dirs.unshift("extreme close-up on eyes and mouth, shallow depth");
    } else {
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

    if (targetArchetype) {
        switch (targetArchetype) {
            case 'The Confessor': return LIGHTING_PRESETS.Intimate;
            case 'The Sadist': return LIGHTING_PRESETS.Harsh;
            case 'The Logician': return LIGHTING_PRESETS.Clinical;
            case 'The Nurse': return LIGHTING_PRESETS.WarmCandle; 
            case 'The Provost': return LIGHTING_PRESETS.Moody;
        }
    }

    if (ledger.traumaLevel > 50) {
      return "single dramatic crimson rim light from above, extreme chiaroscuro, deep crushed blacks, volumetric dust";
    }
    return "cold clinical overhead fluorescent, flat even illumination, sterile observation";
  }

  private inferSomaticDetails(ledger: YandereLedger, narrativeText: string): string[] {
    const details: string[] = [];
    const lower = narrativeText.toLowerCase();

    if (ledger.traumaLevel > 40) details.push("sweat-beaded forehead, pale complexion");
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

    if (ledger.traumaLevel > 70) motifs.push(FORGE_MOTIFS.TearTracks, FORGE_MOTIFS.AvertedGaze);
    if (lowerNarrative.includes("kneel")) motifs.push(FORGE_MOTIFS.RigidPosture);
    
    return Array.from(new Set(motifs));
  }

  private buildSubjectDescription(target: PrefectDNA | CharacterId | string, ledger: YandereLedger, narrativeText: string, sceneContext: string, beat?: NarrativeBeat): string {
    let base = "";
    let somaticDetails: string[] = this.inferSomaticDetails(ledger, narrativeText);
    let visualDNAKeywords: string[] = [];

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

    const dynamicMotifs = this._selectMotifs(ledger, narrativeText, sceneContext, beat); 
    const combinedDetails = Array.from(new Set([...somaticDetails, ...visualDNAKeywords, ...dynamicMotifs]));

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
      style: "((MASTER STYLE LOCK)): Milo Manara style (clean ink lines, fluid contours, impossible elegance, feline eyes, cruel half-smile), high-contrast Neo-Noir, erotic dark academia. Clinical line, unforgiving precision, negative space isolation, wet surfaces, Art Deco geometry, smoke haze, clinical chiaroscuro.",
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
