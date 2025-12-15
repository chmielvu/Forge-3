
export const THEMATIC_ENGINES = {
  PROTOCOL: {
    id: "MOD_09_RITUAL_SAFETY",
    label: "The Protocol of Suffering",
    goal: "Frame violence as a bureaucratic and scientific necessity.",
    tone: "Clinical, Polite, Detached. 'Service Sadism'.",
    hooks: "The Vital Check, The Antiseptic Chill, The Consent Trap.",
    vocabulary: [
      "calibration", "baseline", "inefficiency", "procedure", "compliance", "somatic", "rupture",
      "systemic shock", "visceral nausea", "whiteout", "vasocongestion", "mechanism", 
      "neural pathways", "threshold", "data point", "hypothesis", "apparatus", "bio-computational",
      "autonomic collapse", "psychic aftershock", "soft tissue", "ligament", "the fragility"
    ],
    archetype_focus: "The Logician (Doctor Lysandra)"
  },
  MASQUERADE: {
    id: "MOD_12_FALSE_LEVITY",
    label: "The Masquerade of Fun",
    goal: "Inflict cognitive dissonance. Abuse framed as 'therapy', 'fixing', or a 'game'.",
    tone: "Mocking, Playful, Gaslighting. 'Toxic Caregiver'.",
    hooks: "The Composure Meter, The False Sanctuary, The Medical Pretext.",
    vocabulary: [
      "malchik", "drama queen", "game", "prize", "toy", "gentle", "shh", "unravel",
      "therapy", "fixing", "cleansing", "repair", "purification", "salve", "trust", 
      "lesson", "protection", "shrimp", "worm", "twig", "soft-boiled eggs", 
      "vienna sausage", "stress ball", "pin cushion", "grape", "fragility", "the grapes",
      "yaytsa"
    ],
    archetype_focus: "The Siren (Prefect Petra/Calista/Anya)"
  },
  SPECTACLE: {
    id: "MOD_11_COMPETITIVE_CRUELTY",
    label: "The Prefect's Wager",
    goal: "Dehumanization via public performance. Pain as currency and civic duty.",
    tone: "Competitive, Performative, Humiliating. 'The Arena'.",
    hooks: "The Double Jeopardy, The Bored Audience, The Social Panopticon.",
    vocabulary: [
      "wager", "score", "performance", "witness", "foul", "penalty", "display",
      "panopticon", "civic duty", "restorative justice", "exhibit", "demonstration", 
      "bystander", "mandate", "amphitheater", "public access", "ticket", "the exhibit"
    ],
    archetype_focus: "The Inquisitor (Rival Prefects)"
  }
};

export const BLUEPRINT_VARIANTS = {
  VARIANT_1: {
    id: "ISOMETRIC_ISLAND_HIERARCHY",
    visual_style: "Isometric cutaway. Academic sterility meets dungeon grit.",
    axes: {
      x: "Narrative Function (Chaos/Prank -> Order/Experiment)",
      y: "Intensity of Trauma (Physical/Comedic -> Psychological/Existential)"
    }
  }
};

export const MOTIF_LIBRARY = {
  // --- PROTOCOL (Order/Science) ---
  MEASURED_STRIKE: {
    name: "The Measured Strike",
    quote: "Angle, force, timing—calculated to test limits, not break them.",
    visual: "Slow-motion impact focus. Dust motes dancing in cold clinical light. No anger, just physics. A gloved hand adjusting the angle of a rod.",
    engine_link: "PROTOCOL"
  },
  SYMBOLIC_CASTRATION: {
    name: "The Freudian Threat",
    quote: "The source of your arrogance is now the source of your ruin.",
    visual: "Low angle. A metal chastity device or heavy boot hovering over the groin. The Subject's perspective looking up at an imposing, indifferent silhouette.",
    engine_link: "PROTOCOL"
  },
  DATA_POINT: {
    name: "The Data Point",
    quote: "Your pain is just a coordinate on my graph.",
    visual: "Extreme close-up of a pen scratching paper, juxtaposed with a blurred figure writhing in the background. Clinical detachment.",
    engine_link: "PROTOCOL"
  },

  // --- SPECTACLE (Chaos/Performance) ---
  CHAOTIC_LASH: {
    name: "The Chaotic Lash",
    quote: "Petra’s got no math—just rage.",
    visual: "Jagged motion blur. Flying sweat droplets. A manic grin visible through the exertion. High contrast, gritty noir texture.",
    engine_link: "SPECTACLE"
  },
  AUDIENCE_REACTION: {
    name: "The Matriarchal Mirror",
    quote: "They don't hate you. They just find your suffering... educational.",
    visual: "A background of faceless, laughing students in Dark Academia uniforms. Foreground focus on the Subject's averted, shamed eyes.",
    engine_link: "SPECTACLE"
  },
  THE_EXHIBIT: {
    name: "The Living Exhibit",
    quote: "Look at him. A specimen of failure.",
    visual: "High-angle 'God's Eye' view. The Subject isolated in a pool of harsh light, surrounded by darkness and watching silhouettes. Baroque Brutalism architecture.",
    engine_link: "SPECTACLE"
  },

  // --- MASQUERADE (Intimacy/Gaslighting) ---
  HEALERS_BIND: {
    name: "Intimacy Through Suffering",
    quote: "I'm the only one who can make it stop.",
    visual: "Soft, manicured hands applying a stinging salve to a bruise. The juxtaposition of care and recent violence. Warm candlelight battling cold shadows.",
    engine_link: "MASQUERADE"
  },
  FALSE_SANCTUARY: {
    name: "The False Sanctuary",
    quote: "You're safe here. For now.",
    visual: "Velvet textures, warm candlelight, a cup of tea... contrasting with the glint of a hidden key or lock. Eroticized distress.",
    engine_link: "MASQUERADE"
  },
  TOXIC_LULLABY: {
    name: "The Toxic Lullaby",
    quote: "Shhh. It's only pain. It means you're alive.",
    visual: "Intimate close-up. Lips whispering into an ear. A tear track catching the light. The 'Whump' aesthetic of vulnerable comfort.",
    engine_link: "MASQUERADE"
  },
  
  // --- SOMATIC & PSYCHOLOGICAL (New Additions) ---
  SOMATIC_BETRAYAL: {
    name: "Somatic Betrayal",
    quote: "Your body knows who owns it, even if your mind resists.",
    visual: "Macro shot of flushed skin, sweat beads, and dilated pupils. Visual evidence of unwilling physiological arousal or terror.",
    engine_link: "MASQUERADE"
  },
  ONTOLOGICAL_VERTIGO: {
    name: "Ontological Vertigo",
    quote: "The floor is gone. You are falling through yourself.",
    visual: "Dutch angle, distorted perspective. The architecture of the room seems to twist. The Subject clutching the floor as if falling.",
    engine_link: "PROTOCOL"
  }
};
