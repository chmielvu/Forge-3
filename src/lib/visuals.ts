/**
 * The Forge's Loom: Nano Banana Visual Generation Service
 * Implements Manara-Noir aesthetic with strict JSON-wrapped prompts
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Lazy init for Vite
const getAI = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });

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
    const prompt = JSON.stringify(validated, null, 2);
    
    const ai = getAI();
    // Implementation placeholder for strict mode
    // Using a simple model call for now to respect structure
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Generate image from this JSON spec: ${prompt}` }] }
    });
    
    return { success: true, image_url: response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data };
    
  } catch (error) {
    console.error('Visual Generation Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}