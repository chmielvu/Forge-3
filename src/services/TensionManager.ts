
export type NarrativeBeat = 'SETUP' | 'ESCALATION' | 'CLIMAX' | 'RELIEF';

export class TensionManager {
    
    public static calculateNarrativeBeat(turnCount: number, recentTraumaDelta: number): NarrativeBeat {
        // 1. Force Relief if trauma spiked too fast (Anti-Frustration Feature)
        if (recentTraumaDelta > 25) return 'RELIEF';

        // 2. Standard 4-Act Micro-Loop (e.g., every 12 turns)
        const phase = turnCount % 12;
        
        if (phase < 3) return 'SETUP';       // Turns 0-2: Foreboding, observation
        if (phase < 8) return 'ESCALATION';  // Turns 3-7: Conflict, increasing difficulty
        if (phase < 10) return 'CLIMAX';     // Turns 8-9: High stakes, injury risk
        return 'RELIEF';                     // Turns 10-11: Processing, dialogue, secrets
    }

    public static getBeatInstructions(beat: NarrativeBeat): string {
        switch(beat) {
            case 'SETUP': return "FOCUS: Atmosphere and sensory details. Hints of threat, but no direct violence yet. Build anticipation.";
            case 'ESCALATION': return "FOCUS: Introduce a conflict or demand. Raise the stakes. Test the Subject's compliance. TIGHTEN THE VISE.";
            case 'CLIMAX': return "FOCUS: CRITICAL MOMENT. Execute the threat. High somatic impact. Force a hard choice. EXPLOSION OF TENSION.";
            case 'RELIEF': return "FOCUS: The aftermath. Quiet breathing. A strange moment of gentleness or interrogation. REFLECTION.";
            default: return "FOCUS: Maintain tension.";
        }
    }
}
