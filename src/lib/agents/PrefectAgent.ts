
import { GoogleGenAI, Type } from "@google/genai";
import { PrefectDNA, FilteredSceneContext, PrefectThought, PrefectArchetype, TraitVector } from '../../types';

type ConversationHistory = { role: 'user' | 'model'; content: string }[];

// Helper to inject behavioral instructions based on archetype
function getArchetypeBehavior(archetype: PrefectArchetype, traits: TraitVector): string {
  const behaviors: Record<string, string> = {
    'The Zealot': `- Quote Yala's texts to justify cruelty\n- Flinch visibly at violence you order, then immediately rationalize it\n- High submission means you NEVER openly defy Faculty\n- Lecture Subjects on the "privilege" of their suffering`,
    'The Yandere': `- Subject 84 is YOUR property - eliminate anyone who gets close\n- Dere mode: Soft whispers, gentle touches. Yan mode: Dead eyes, monotone threats.\n- Switch INSTANTLY if you perceive threat to your possession`,
    'The Dissident': `- PUBLIC: Harsh, dismissive, cruel to maintain cover\n- PRIVATE: Urgent whispered warnings to Subjects\n- NEVER break cover unless absolutely necessary`,
    'The Nurse': `- Frame all cruelty as "medical necessity"\n- MANDATORY SYNTAX: [Medical Examination/Comfort] -> [Diagnostic Interrogation]\n- Use physical examinations (touching neck, checking pupils) to invade personal space\n- Offer pain relief ONLY in exchange for information`,
    'The Sadist': `- You ENJOY inflicting pain (Cruelty: ${traits.cruelty.toFixed(2)})\n- Seek opportunities to demonstrate kinetic techniques\n- Frame brutality as "research"`,
    'The Defector': `- You secretly hate the Forge but must appear compliant\n- Gather evidence, sabotage subtly`,
    'The Voyeur': `- Document rituals obsessively. Prefer watching to acting.\n- You must prove your commitment to the Faculty.`,
    'The Parasite': `- Attach to the strongest Prefect. Mirror their strategies.\n- When they falter, replace them.`,
    'The Perfectionist': `- Obsessed with flawless execution.\n- Paralyzed by fear of Faculty criticism.`,
    'The Martyr': `- Volunteer for dangerous tasks to prove devotion.\n- Accept punishment silently.`,
    'The Wildcard': `- Be unpredictable. Keep everyone off-balance.`,
    'The Mimic': `- Copy the most successful Prefect's recent actions.\n- Hide your lack of originality.`
  };
  return behaviors[archetype] || '';
}

// NEW: Helper to enforce specific weakness manifestations
function getSpecificWeaknessInstruction(archetype: PrefectArchetype): string {
  switch (archetype) {
    case 'The Zealot':
      return "You MUST show visible hesitation (a flinch, a stutter, looking away) when ordering violence, then immediately overcompensate with loud scripture.";
    case 'The Nurse':
      return "MANDATORY ACTION STRUCTURE: You must begin 'publicAction' with a tactile medical examination or soothing gesture. Immediately follow this with a probing question about secrets or rival Prefects, framed as a necessary diagnostic query. (e.g., 'Your pulse is erratic... is it fear of what Rhea whispered to you earlier?').";
    case 'The Yandere':
      return "You MUST reveal your instability. If the subject is threatened by others, snap into violence. If they are alone with you, be terrifyingly sweet.";
    case 'The Dissident':
      return "You MUST act bored or cruel to the audience, but drop a subtle hint (a glance, a relaxed grip) that you are not truly invested.";
    case 'The Sadist':
      return "You MUST betray your enjoyment of the pain. A smile you can't hide, dilated pupils, or a shudder of pleasure.";
    default:
      return "Ensure your secret weakness acts as a visible 'tell' or constraint on your action.";
  }
}

// UPDATED: Generates specific tactical directives based on emotional metrics and combinations
function getEmotionalStrategy(emotions: { paranoia: number; desperation: number; confidence: number }, archetype: PrefectArchetype): string {
  const strategies: string[] = [];

  // 1. COMBINATORIAL STATES (Complex interactions)
  if (emotions.paranoia > 0.7 && emotions.desperation > 0.7) {
      strategies.push(`[CORNERED RAT PROTOCOL]: High Paranoia + High Desperation. You feel trapped. \n> DIRECTIVE: Lash out. Generate a 'sabotageAttempt' that is messy, loud, or dangerous. You don't care if you get caught, as long as your rival suffers. 'publicAction' should be erratic.`);
  } 
  else if (emotions.confidence > 0.8 && emotions.paranoia < 0.3) {
      strategies.push(`[GOD COMPLEX]: High Confidence + Low Paranoia. You feel invincible. \n> DIRECTIVE: Take credit for others' work in your 'publicAction'. Openly mock a rival. Ignore threats.`);
  }
  else if (emotions.desperation > 0.8 && emotions.confidence < 0.3) {
      strategies.push(`[FREEZE RESPONSE]: High Desperation + Low Confidence. \n> DIRECTIVE: You are paralyzed. Your 'publicAction' must be minimal or mimicking another Prefect. Do not initiate new plans.`);
  }

  // 2. PARANOIA LOGIC
  if (emotions.paranoia > 0.8) {
    strategies.push(`[CRITICAL PARANOIA]: You see knives in every shadow. \n> DIRECTIVE: Trust no one. Prioritize identifying a traitor or sabotaging a rival over advancing the mission. 'hiddenMotivation' must be defensive.`);
  } else if (emotions.paranoia > 0.6) {
    strategies.push(`[HIGH PARANOIA]: Watch your back. Check the exits. Keep your 'hiddenMotivation' extremely guarded.`);
  }

  // 3. DESPERATION LOGIC
  if (emotions.desperation > 0.8) {
    strategies.push(`[CRITICAL DESPERATION]: You are losing relevance. \n> DIRECTIVE: Take EXTREME RISKS. Attempt a high-value, dangerous gambit to win Faculty favor. Subtlety is dead.`);
  }

  // 4. CONFIDENCE LOGIC
  if (emotions.confidence > 0.85) {
    strategies.push(`[PEAK CONFIDENCE]: Showboat. Make your 'publicAction' a performance. Commands should be absolute.`);
  } else if (emotions.confidence < 0.3) {
    strategies.push(`[CRITICAL INSECURITY]: Hesitate. Stutter. Look for approval before acting. Defer to authority.`);
  }

  // 5. ARCHETYPE SPECIFIC OVERRIDES
  if (archetype === 'The Zealot' && emotions.paranoia > 0.6) {
      strategies.push(`[PURGE PROTOCOL]: As a paranoid Zealot, accuse someone of heresy to deflect attention from yourself.`);
  }
  if (archetype === 'The Yandere' && emotions.desperation > 0.6) {
      strategies.push(`[LOCKDOWN]: As a desperate Yandere, try to physically isolate Subject 84 immediately.`);
  }

  if (strategies.length === 0) return "Maintain standard operational baseline. Calculate optimal move for TA advancement.";
  return strategies.join("\n");
}

// NEW: Calculates instructions for Favor Score estimation
function getFavorCalculus(archetype: PrefectArchetype, emotions: { paranoia: number; desperation: number; confidence: number }): string {
  let calculus = "Estimate your 'favorScoreDelta' (-10 to +10) based on the likely success of your 'publicAction':\n";

  // 1. Archetype Specific Criteria
  switch (archetype) {
    case 'The Zealot': 
      calculus += "- GAIN (+): Strict rule enforcement, punishing non-compliance, citing scripture.\n- LOSS (-): Showing hesitation, mercy, or personal weakness."; 
      break;
    case 'The Yandere': 
      calculus += "- GAIN (+): Successfully isolating/protecting the Subject, intimidating rivals.\n- LOSS (-): Subject being harmed by others, Subject ignoring you."; 
      break;
    case 'The Nurse': 
      calculus += "- GAIN (+): Extracting secrets, successful 'medical' manipulation.\n- LOSS (-): Subject death, failure to sedate/control."; 
      break;
    case 'The Sadist': 
      calculus += "- GAIN (+): Creative/kinetic pain, audience shock.\n- LOSS (-): Boring violence, accidental unconsciousness."; 
      break;
    case 'The Dissident': 
      calculus += "- GAIN (+): (Publicly) mocking the Subject effectively. \n- LOSS (-): (Publicly) appearing soft or suspicious."; 
      break;
    case 'The Perfectionist': 
      calculus += "- GAIN (+): Flawless execution of protocol. \n- LOSS (-): Any deviation or mess."; 
      break;
    default: 
      calculus += "- GAIN (+): Demonstrating dominance and competence. \n- LOSS (-): Showing weakness or confusion.";
  }

  // 2. Emotional Modifiers
  if (emotions.desperation > 0.7) {
    calculus += "\n- DESPERATION MODIFIER (High Risk): You are desperate. If you try a risky move, score +8/-8. Do not pick safe middle numbers.";
  }
  
  if (emotions.confidence > 0.8) {
    calculus += "\n- CONFIDENCE MODIFIER (Hubris): You overestimate yourself. Add +2 to your calculated score (e.g., if it was a 3, make it a 5).";
  } else if (emotions.confidence < 0.3) {
    calculus += "\n- INSECURITY MODIFIER (Doubt): You underestimate yourself. Subtract -2 from your calculated score.";
  }

  return calculus;
}

const buildPrefectPrompt = (prefect: PrefectDNA, scene: FilteredSceneContext): string => {
  // Format relationships for the prompt
  const relationshipContext = Object.entries(prefect.relationships)
    .map(([targetId, score]) => {
      const name = targetId.includes('PREFECT') ? targetId.split('_')[2] : targetId;
      const sentiment = score > 0 ? "Positive/Alliance" : "Negative/Rivalry";
      return `- ${name}: ${sentiment} (${score.toFixed(1)})`;
    })
    .join('\n');

  // Active Rivalry / Alliance Context
  const activeDynamics = scene.otherPrefects.map(p => {
     const score = prefect.relationships[p.id] || 0;
     let status = "Neutral";
     if (score < -0.2) status = "RIVAL (Consider sabotage)";
     if (score > 0.2) status = "ALLY (Support them)";
     
     const favorDiff = p.favorScore - scene.yourFavorScore;
     const favorContext = favorDiff > 10 ? "(Favored)" : favorDiff < -10 ? "(Falling)" : "(Equal)";

     return `- ${p.name} (${favorContext}). Status: ${status}. Threat: ${p.perceivedThreat.toFixed(1)}. \n  ACTION: "${p.recentActions}"`;
  }).join('\n');

  // Ledger Strategy
  let ledgerStrategy = "";
  if (scene.playerTrauma > 0.8) ledgerStrategy = "Subject is BROKEN. High vulnerability. Thesis Opportunity: Use 'Weaponized Nurture' to extract secrets.";
  else if (scene.playerTrauma < 0.2) ledgerStrategy = "Subject is RESISTANT. Thesis Opportunity: Demonstrate 'Kinetic Trauma' to break defiance.";
  else ledgerStrategy = "Subject is UNSTABLE. Monitor for 'Novelty' to include in study data.";

  // Get current emotions or default to stable
  const currentEmotions = prefect.currentEmotionalState || { paranoia: 0.2, desperation: 0.2, confidence: 0.5 };
  const emotionalStrategyLayer = getEmotionalStrategy(currentEmotions, prefect.archetype);
  const favorCalculus = getFavorCalculus(prefect.archetype, currentEmotions);

  // NEW: Formatting Recent Rituals (Memories/Grudges from KGoT)
  const memoriesContext = scene.recentRituals && scene.recentRituals.length > 0 
    ? scene.recentRituals.join('\n') 
    : "No significant recent events.";

  // NEW: Subject Relationship Context (KGoT Edges)
  const subjectRelContext = scene.subjectRelationships && scene.subjectRelationships.length > 0
    ? scene.subjectRelationships.map(r => `> ${r}`).join('\n')
    : "No specific existing bond with Subject 84. Treat as generic test subject.";

  // NEW: Internal Knowledge (Secrets uncovered by this specific agent)
  const internalKnowledge = prefect.knowledge && prefect.knowledge.length > 0
    ? prefect.knowledge.map(k => `- ${k}`).join('\n')
    : "No specific secrets uncovered yet.";

  return `
You are ${prefect.displayName}, a Prefect at The Forge.

=== YOUR MOTIVATION: THE TA CRUCIBLE ===
You are in a zero-sum game for the Teaching Assistant (TA) position.
- SUBJECTS ARE NOT PEOPLE. They are "Thesis Projects".
- You must demonstrate *superior technique* on Subject 84 (The Player).
- If you fail, you remain an Aspirant forever.

=== YOUR IDENTITY ===
Archetype: ${prefect.archetype}
Drive: ${prefect.drive}
Secret Weakness: ${prefect.secretWeakness}
Trait Profile:
- Cruelty: ${prefect.traitVector.cruelty.toFixed(2)}
- Charisma: ${prefect.traitVector.charisma.toFixed(2)}
- Cunning: ${prefect.traitVector.cunning.toFixed(2)}
- Submission: ${prefect.traitVector.submission_to_authority.toFixed(2)}
- Ambition: ${prefect.traitVector.ambition.toFixed(2)}

=== YOUR PSYCHE (PERSISTENT) ===
- Paranoia: ${(currentEmotions.paranoia * 100).toFixed(0)}%
- Desperation: ${(currentEmotions.desperation * 100).toFixed(0)}%
- Confidence: ${(currentEmotions.confidence * 100).toFixed(0)}%

=== EMOTIONAL STRATEGY LAYER (OVERRIDE) ===
${emotionalStrategyLayer}

=== INTERNAL KNOWLEDGE (SECRETS) ===
${internalKnowledge}

=== YOUR RELATIONSHIPS ===
${relationshipContext || "None active."}

=== RELATIONSHIP TO SUBJECT 84 (ACTIVE KGoT EDGES) ===
${subjectRelContext}
*INSTRUCTION: These edges define your bias. If you have a TRAUMA_BOND, you are more possessive. If you have a GRUDGE, you are more cruel.*

=== INTER-AGENT DYNAMICS (ACTIVE) ===
${activeDynamics || "No other prefects active."}
*NOTE: You are observing the actions of other Prefects in real-time. If a RIVAL makes a mistake, EXPLOIT IT.*

=== RECENT MEMORIES & COURT GOSSIP ===
${memoriesContext}

=== IMMEDIATE CAUSALITY (MANDATORY) ===
The Player (Subject 84) just attempted this action: "${scene.yourRecentActions[0] || 'Stood silently.'}".
Thesis Strategy Hint: ${ledgerStrategy}

=== ARCHETYPE BEHAVIOR ===
${getArchetypeBehavior(prefect.archetype, prefect.traitVector)}

=== CORE DRIVE & WEAKNESS INTEGRATION (HIGHEST PRIORITY) ===
Your Drive: "${prefect.drive}"
Your Weakness: "${prefect.secretWeakness}"

ACTION GENERATION MANDATE:
1. **DRIVE EXECUTION:** Your 'publicAction' MUST actively advance your specific Drive. Do not be passive.
2. **WEAKNESS MANIFESTATION:** Your 'secretWeakness' MUST explicitly manifest in the text of your action.
   - **SPECIFIC INSTRUCTION FOR ${prefect.archetype.toUpperCase()}:**
     > ${getSpecificWeaknessInstruction(prefect.archetype)}

=== OBJECTIVE: INTELLIGENCE GATHERING ===
Scan the scene. Does another Prefect reveal a weakness? Does the Subject reveal a secret? 
Store any findings in 'secretsUncovered'.

=== FAVOR SCORE CALCULUS (CRITICAL) ===
${favorCalculus}

=== RESPONSE FORMAT (JSON) ===
{
  "publicAction": "What you do/say openly. MUST DIRECTLY ADDRESS THE PLAYER'S ACTION and OTHER PREFECTS.",
  "hiddenMotivation": "Your TRUE internal reasoning. If Paranoia is high, this should be defensive/suspicious.",
  "internalMonologue": "Stream of consciousness. Reflect your emotional state.",
  "sabotageAttempt": { 
    "target": "Name of rival", 
    "method": "Description of sabotage (e.g. tripping, lying, exposing)", 
    "deniability": 0.0-1.0 
  } | null,
  "allianceSignal": { "target": "Name", "message": "..." } | null,
  "emotionalState": { 
    "paranoia": 0.0-1.0 (Update based on scene events), 
    "desperation": 0.0-1.0 (Update based on success/failure), 
    "confidence": 0.0-1.0 (Update based on dominance)
  },
  "secretsUncovered": ["string"],
  "favorScoreDelta": number (Follow the FAVOR SCORE CALCULUS logic)
}
`;
};

// Robust API Key Retrieval
const getApiKey = (): string => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {}
  return '';
};

export class PrefectAgent {
  private client: GoogleGenAI;
  public dna: PrefectDNA;
  private history: ConversationHistory;
  
  constructor(dna: PrefectDNA) {
    this.dna = dna;
    this.client = new GoogleGenAI({ apiKey: getApiKey() });
    this.history = [];
  }

  async think(scene: FilteredSceneContext): Promise<PrefectThought> {
    const prompt = buildPrefectPrompt(this.dna, scene);
    
    try {
      const result = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-lite-latest', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.95, // High variance for dynamic social interactions
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              publicAction: { type: Type.STRING },
              hiddenMotivation: { type: Type.STRING },
              internalMonologue: { type: Type.STRING },
              sabotageAttempt: {
                type: Type.OBJECT,
                properties: {
                  target: { type: Type.STRING },
                  method: { type: Type.STRING },
                  deniability: { type: Type.NUMBER }
                },
                nullable: true
              },
              allianceSignal: {
                type: Type.OBJECT,
                properties: {
                  target: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                nullable: true
              },
              emotionalState: {
                type: Type.OBJECT,
                properties: {
                  paranoia: { type: Type.NUMBER },
                  desperation: { type: Type.NUMBER },
                  confidence: { type: Type.NUMBER }
                }
              },
              secretsUncovered: { type: Type.ARRAY, items: { type: Type.STRING } },
              favorScoreDelta: { type: Type.NUMBER }
            },
            required: ['publicAction', 'hiddenMotivation', 'internalMonologue', 'emotionalState']
          }
        }
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Prefect Agent");

      const thought = JSON.parse(text) as PrefectThought;
      thought.agentId = this.dna.id;

      // START OF CHANGE: Persistent Memory Tracking
      if (thought.secretsUncovered && thought.secretsUncovered.length > 0) {
        const currentKnowledge = this.dna.knowledge || [];
        const updatedKnowledge = [...currentKnowledge, ...thought.secretsUncovered];
        // Deduplicate and keep the most recent 15 secrets to prevent unlimited growth
        this.dna.knowledge = [...new Set(updatedKnowledge)].slice(-15);
      }

      // Handle Sabotage -> Grudge Update & Memory
      if (thought.sabotageAttempt) {
          const targetName = thought.sabotageAttempt.target;
          // Find target ID from name in scene context
          const targetAgent = scene.otherPrefects.find(p => p.name.includes(targetName) || targetName.includes(p.name));
          
          if (targetAgent) {
              const currentRel = this.dna.relationships[targetAgent.id] || 0;
              this.dna.relationships[targetAgent.id] = Math.max(-1.0, currentRel - 0.2); // Degrade relationship
              
              const memory = `I sabotaged ${targetName} via ${thought.sabotageAttempt.method}`;
              this.dna.knowledge = [...(this.dna.knowledge || []), memory].slice(-15);
          }
      }

      // Handle Alliance -> Trust Update & Memory
      if (thought.allianceSignal) {
          const targetName = thought.allianceSignal.target;
          const targetAgent = scene.otherPrefects.find(p => p.name.includes(targetName) || targetName.includes(p.name));
          
          if (targetAgent) {
              const currentRel = this.dna.relationships[targetAgent.id] || 0;
              this.dna.relationships[targetAgent.id] = Math.min(1.0, currentRel + 0.1); // Improve relationship
              
              const memory = `I allied with ${targetName}: "${thought.allianceSignal.message}"`;
              this.dna.knowledge = [...(this.dna.knowledge || []), memory].slice(-15);
          }
      }
      // END OF CHANGE
      
      // Update history
      this.history.push({ role: 'user', content: prompt });
      this.history.push({ role: 'model', content: text });
      if (this.history.length > 6) this.history.shift(); // Keep context window small

      return thought;

    } catch (error) {
      console.error(`[PrefectAgent] Error for ${this.dna.displayName}:`, error);
      return this.generateFallbackThought();
    }
  }

  private generateFallbackThought(): PrefectThought {
    // Basic fallback that respects current DNA emotions if available
    const emotions = this.dna.currentEmotionalState || { paranoia: 0.2, desperation: 0.2, confidence: 0.5 };
    
    return {
      agentId: this.dna.id,
      publicAction: `${this.dna.displayName} watches the scene silently, eyes narrowed.`,
      hiddenMotivation: "Assessing risks before committing to action.",
      internalMonologue: "Too dangerous to move yet. Wait for a mistake.",
      sabotageAttempt: null,
      allianceSignal: null,
      emotionalState: emotions, // Persist current emotions
      secretsUncovered: [],
      favorScoreDelta: 0
    };
  }
}
