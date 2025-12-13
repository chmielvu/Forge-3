
'use server';

import { z } from "zod";
import { executeDirectorTurn } from "@/lib/director";
import { KnowledgeGraph } from "@/lib/types/kgot";

// Validation Schema
const TurnSchema = z.object({
  input: z.string().min(1).max(500),
  history: z.array(z.string()),
  currentGraph: z.any() // KGoT Schema
});

export async function submitTurn(prevState: any, formData: FormData) {
  const input = formData.get("input") as string;
  const history = JSON.parse(formData.get("history") as string || "[]");
  const currentGraph = JSON.parse(formData.get("currentGraph") as string || "{}");

  const validated = TurnSchema.safeParse({ input, history, currentGraph });

  if (!validated.success) {
    return { error: "Invalid Input" };
  }

  try {
    // Invoke the Director (Server-Side Logic)
    const result = await executeDirectorTurn(validated.data.input, validated.data.history, validated.data.currentGraph);
    
    return {
      narrative: result.narrative,
      visualPrompt: result.visualPrompt,
      updatedGraph: result.updatedGraph,
      choices: result.choices,
      thoughtProcess: result.thoughtProcess
    };
  } catch (e) {
    console.error(e);
    return { error: "The Director rejected your reality." };
  }
}
