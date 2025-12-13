
'use server';

/**
 * The Forge's Loom: Nano Banana Visual Generation Service
 * Implements Manara-Noir aesthetic with strict JSON-wrapped prompts
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ==================== SCHEMAS ====================

const ManaraNoirStyleLockSchema = z.object({
  base: z.literal("hyper-detailed 8K ink wash, expressive contour lines, Milo Manara sensual elegance, dramatic Neo-Noir Chiaroscuro lighting"),
  modifications: z.array(z.string()).optional()
});

const VisualPromptSchema = z.object({
  scene_id: z.string(),
  style_lock: ManaraNoirStyleLockSchema,
  composition: z.object({
    camera_angle: z.enum([
      "low_angle_power",
      "high_angle_vulnerable", 
      "gods_eye",
      "intimate_close"
    ]),
    negative_space: z.string()
  }),
  lighting: z.object({
    style: z.enum([
      "chiaroscuro_extreme",
      "gaslamp_flicker",
      "clinical_cold",
      "venetian_blind_amber"
    ]),
    contrast: z.literal("High")
  }),
  characters: z.array(z.object({
    id: z.string(),
    pose: z.string(),
    expression: z.string(),
    costume_id: z.string(),
    consistency_token: z.string()
  })),
  environment: z.object({
    location_id: z.string(),
    architecture_state: z.string(),
    surface_reflectivity: z.number().min(0).max(1)
  })
});

// ==================== CHARACTER DNA DATABASE ====================

const CHARACTER_DNA = {
  "FACULTY_PROVOST": {
    consistency_token: "selene_token_x99",
    base_prompt: "statuesque woman late 40s, regal aristocratic beauty, sharp cheekbones, cold steel-gray eyes, raven-black hair in severe braids, wiry disciplined physique",
    costume_variants: {
      "crimson_velvet_robes_v1": "floor-length crimson velvet academic robes, plunging neckline, heavy fabric trailing like royal train",
      "emerald_formal": "emerald green velvet gown, militaristic tailoring, severe high collar"
    },
    manara_features: "heavy-lidded eyes, high forehead, full lips, Bored God Complex expression, detached sultry boredom"
  },
  "FACULTY_LOGICIAN": {
    consistency_token: "lysandra_token_x12",
    base_prompt: "woman early 30s, soft features, intelligent warm-green eyes DECEPTIVE, light freckles, dark wavy chestnut hair in messy scholarly bun",
    costume_variants: {
      "dark_academia_v1": "high-waisted woolen trousers, cream button-down blouse, wide leather belt, rolled sleeves, glasses reflecting light",
      "private_study": "loose antique yellow chemise, soft shoulders exposed, intimate candlelit"
    },
    manara_features: "kind approachable face HIDING cold analytical mind, disarming softness, non-threatening scholar physique"
  },
  "FACULTY_INQUISITOR": {
    consistency_token: "petra_token_x45",
    base_prompt: "woman late 20s, athletic lean wiry build, stark white hair in practical braids, sharp green eyes, predatory confident smirk, light freckles, scarred midriff visible",
    costume_variants: {
      "kinetic_uniform": "black sleeveless turtleneck, dark tactical trousers, thick leather belt, heavy boots, cigarette",
      "post_session": "deep crimson blouse voluminous sleeves, relaxed dominance, flushed satisfaction"
    },
    manara_features: "sharp jaw, high cheekbones, predatory grin showing teeth, explosive athletic grace"
  },
  "FACULTY_CONFESSOR": {
    consistency_token: "calista_token_x88",
    base_prompt: "woman early 30s, voluptuous hourglass soft curves, sultry dark almond eyes, full lips Mona Lisa half-smile, long voluminous dark brown wavy hair",
    costume_variants: {
      "victorian_severe": "high-collared Victorian dark dress, intricate ruffles, Dark Academia intellectual authority",
      "sensual_confessional": "off-shoulder white blouse revealing neck curve, leather corset, layered necklaces bohemian"
    },
    manara_features: "unsettlingly perfect beauty, heavy-lidded predatory analytical eyes, languid sensual softness TRAP"
  }
};

// ==================== GENERATION SERVICE ====================

export async function generateSceneVisual(
  promptData: z.infer<typeof VisualPromptSchema>
): Promise<{
  success: boolean;
  image_url?: string;
  error?: string;
}> {
  try {
    // 1. Validate Input
    const validated = VisualPromptSchema.parse(promptData);
    
    // 2. Construct Master Prompt (JSON-Wrapped)
    const masterPrompt = buildMasterPrompt(validated);
    
    // 3. Generate via Nano Banana (gemini-2.5-flash-image)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{
        role: "user",
        parts: [{
          text: masterPrompt
        }]
      }]
    });
    
    // 4. Extract image data
    let base64Image: string | undefined;
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                base64Image = part.inlineData.data;
                break;
            }
        }
    }
    
    if (!base64Image) {
        throw new Error("No image data returned from model.");
    }
    
    return {
      success: true,
      image_url: `data:image/png;base64,${base64Image}`
    };
    
  } catch (error) {
    console.error('Visual Generation Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ==================== PROMPT CONSTRUCTION ====================

function buildMasterPrompt(data: z.infer<typeof VisualPromptSchema>): string {
  const characterDescriptions = data.characters.map(char => {
    const dna = CHARACTER_DNA[char.id as keyof typeof CHARACTER_DNA];
    
    if (!dna) {
      throw new Error(`Unknown character: ${char.id}`);
    }
    
    const costume = dna.costume_variants[
      char.costume_id as keyof typeof dna.costume_variants
    ];
    
    return `
CHARACTER: ${char.id}
Base: ${dna.base_prompt}
Manara Features: ${dna.manara_features}
Costume: ${costume}
Pose: ${char.pose}
Expression: ${char.expression}
Consistency Token: ${dna.consistency_token}
    `.trim();
  }).join('\n\n');
  
  const environmentDescription = buildEnvironmentDescription(
    data.environment.location_id,
    data.environment.surface_reflectivity
  );
  
  // Construct the JSON-wrapped prompt
  return `
Generate a scene illustration following this EXACT specification:

STYLE LOCK (MANDATORY):
${data.style_lock.base}
${data.style_lock.modifications?.join(', ') || ''}

COMPOSITION:
- Camera Angle: ${data.composition.camera_angle}
- Negative Space Usage: ${data.composition.negative_space}

LIGHTING:
- Type: ${data.lighting.style}
- Contrast: ${data.lighting.contrast}

CHARACTERS:
${characterDescriptions}

ENVIRONMENT:
${environmentDescription}

TECHNICAL REQUIREMENTS:
- Aspect Ratio: 16:9
- Quality: Masterpiece, 8K, sharp focus, professional illustration
- Ink Technique: Flat shading, cel-shading, monochromatic wash
- NO gradients, use pools of ink for shadows

NEGATIVE PROMPT (AVOID):
- Anime style
- 3D render
- Photo-realistic skin texture
- Heavy cross-hatching
- Pixel-dense textures
- Bright cheerful colors

OUTPUT:
Single cohesive scene illustration in Milo Manara + Neo-Noir style.
  `.trim();
}

function buildEnvironmentDescription(
  locationId: string,
  reflectivity: number
): string {
  const locations: Record<string, string> = {
    "loc_calibration": `
Perfect cylinder chamber, smooth black polished concrete walls fading to infinite darkness above.
Central rectangular obsidian monolith (the slab), perfectly reflective.
Single circular surgical spotlight descending from void, harsh white cone.
Everything outside light cone is deep impenetrable ink shadow.
Surface reflectivity: ${reflectivity} (${reflectivity > 0.7 ? 'wet specular highlights on black surfaces' : 'matte darkness'})
    `.trim(),
    
    "loc_confessional": `
Intimate claustrophobic room, aged mahogany furniture, dark velvet upholstery, thick Turkish rugs.
Art Nouveau curved organic shapes.
Venetian blind lighting - amber light through slats casting horizontal shadow bars (the cage).
High small window, internal lighting dominant.
Warm sepia and rose gold accents. False sanctuary aesthetic.
Surface reflectivity: ${reflectivity}
    `.trim(),
    
    "loc_infirmary": `
Endless rows of glass cabinets with identical bottles, perspective receding to impossible vanishing point.
Diffused shadowless white clinical light creating flattening effect.
Hundreds of glass reflection surfaces creating disorienting composition.
Sterile uncanny valley perfection. Too clean, too perfect.
Surface reflectivity: ${reflectivity} (${reflectivity > 0.5 ? 'multiple reflections in glass' : 'soft diffusion'})
    `.trim()
  };
  
  return locations[locationId] || "Abstract monumental space, decaying concrete, weeping walls";
}

// ==================== CONSISTENCY TRACKING ====================

export async function generateCharacterReference(
  characterId: string,
  variant: string = "neutral"
): Promise<string> {
  const dna = CHARACTER_DNA[characterId as keyof typeof CHARACTER_DNA];
  
  if (!dna) {
    throw new Error(`Unknown character: ${characterId}`);
  }
  
  // Generate a standalone reference image for consistency
  const referencePrompt = `
REFERENCE SHEET: ${characterId}

STYLE: Milo Manara character design, clean ink linework, minimal shading

CHARACTER SPECIFICATION:
${dna.base_prompt}

MANARA FEATURES:
${dna.manara_features}

COSTUME: ${Object.values(dna.costume_variants)[0]}

CONSISTENCY TOKEN: ${dna.consistency_token}

VIEWS: Front view, 3/4 view, profile
Expression: ${variant}

TECHNICAL:
- White background
- Clean line art
- Reference sheet layout
- Multiple angles for consistency
  `.trim();
  
  return referencePrompt;
}

// ==================== BATCH GENERATION ====================

export async function generateNarrativeSequence(
  sceneIds: string[],
  stateSnapshot: any
): Promise<Array<{
  scene_id: string;
  image_url: string;
}>> {
  const results = [];
  
  for (const sceneId of sceneIds) {
    // Construct prompt data from state
    const promptData = constructPromptFromState(sceneId, stateSnapshot);
    
    const result = await generateSceneVisual(promptData);
    
    if (result.success && result.image_url) {
      results.push({
        scene_id: sceneId,
        image_url: result.image_url
      });
    }
  }
  
  return results;
}

function constructPromptFromState(sceneId: string, state: any): any {
  // Extract relevant data from KGoT + Ledger to build prompt
  // This is where the "Director" logic translates state to visuals
  
  return {
    scene_id: sceneId,
    style_lock: {
      base: "hyper-detailed 8K ink wash, expressive contour lines, Milo Manara sensual elegance, dramatic Neo-Noir Chiaroscuro lighting"
    },
    composition: {
      camera_angle: "high_angle_vulnerable",
      negative_space: "vast void above subject to emphasize insignificance"
    },
    lighting: {
      style: "chiaroscuro_extreme",
      contrast: "High"
    },
    characters: [
      {
        id: "FACULTY_INQUISITOR",
        pose: "dominant_stance_overlooking",
        expression: "predatory_grin",
        costume_id: "kinetic_uniform",
        consistency_token: "petra_token_x45"
      }
    ],
    environment: {
      location_id: "loc_calibration",
      architecture_state: "oppressive",
      surface_reflectivity: 0.9
    }
  };
}
