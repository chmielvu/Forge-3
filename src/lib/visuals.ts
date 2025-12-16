import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { VISUAL_MANDATE } from "../config/visualMandate";

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
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.API_KEY) return import.meta.env.API_KEY;
  } catch (e) {}
  return '';
};

const getAI = () => new GoogleGenAI({ apiKey: getApiKey() });

// --- NANO BANANA ACP SCHEMA (STRICT) ---
const NanoBananaACPSchema = z.object({
  scene_id: z.string(),
  style_lock: z.object({
    base: z.literal(VISUAL_MANDATE.ZERO_DRIFT_HEADER),
    modifications: z.array(z.string()).optional()
  }),
  composition: z.object({
    camera_angle: z.enum(["low_angle_power", "high_angle_vulnerable", "gods_eye", "intimate_close"]),
    negative_space: z.string()
  }),
  lighting: z.object({
    style: z.enum(["chiaroscuro_extreme", "gaslamp_flicker", "clinical_cold", "venetian_blind_amber"]),
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

export async function generateSceneVisual(promptJSON: string): Promise<{ success: boolean; image_url?: string; error?: string; }> {
  const apiKey = getApiKey();
  if (!apiKey) return { success: false, error: "API key is missing" };

  try {
    // 1. Validate the Director's JSON against the ACP Schema
    let parsedPrompt;
    try {
        parsedPrompt = JSON.parse(promptJSON);
    } catch (e) {
        parsedPrompt = {
            scene_id: "fallback",
            style_lock: { base: VISUAL_MANDATE.ZERO_DRIFT_HEADER },
            composition: { camera_angle: "intimate_close", negative_space: "high" },
            lighting: { style: "chiaroscuro_extreme", contrast: "High" },
            characters: [],
            environment: { location_id: "unknown", architecture_state: "decaying", surface_reflectivity: 0.5 }
        };
    }

    // 2. Generate Image
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `GENERATE IMAGE STRICTLY ADHERING TO THIS JSON STRUCTURE: ${JSON.stringify(parsedPrompt)}` }] }
    });
    
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
        return { success: true, image_url: imagePart.inlineData.data };
    }
    
    return { success: false, error: "No image generated" };
    
  } catch (error: any) {
    console.error('Visual Generation Error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}