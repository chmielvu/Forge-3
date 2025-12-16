
export const THEME = {
  colors: {
    bg: "bg-[#0c0a09]", // Deeper black
    panel: "bg-[#1c1917]/90", // Dark charcoal, slightly transparent
    border: "border-[#292524]", // Lighter charcoal border
    accent: "text-[#065f46]", // Emerald green accent
    accentGold: "text-[#a8a29e]", // Muted gold
    accentBurgundy: "text-[#991b1b]", // Burgundy accent
    textMain: "text-[#e7e5e4]", // Muted white
    textMuted: "text-[#a8a29e]", // Muted gold/gray
    textError: "text-[#fca5a5]" // Light red for errors/psychosis
  },
  classes: {
    glass: "backdrop-blur-xl border shadow-[0_8px_32px_-4px_rgba(0,0,0,0.8)]",
    iconBtn: "p-2 rounded-sm hover:bg-[#292524] transition-all duration-300 text-[#a8a29e] hover:text-[#e7e5e4] border border-transparent hover:border-[#44403c]",
  }
};

// Use local SVG data URL for default media background
export const DEFAULT_MEDIA_BACKGROUND_URL = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3Crect width='100%25' height='100%25' fill='%230c0a09'/%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3Ccircle cx='50' cy='50' r='30' fill='url(%23gradient)'/%3E%3Cdefs%3E%3CradialGradient id='gradient' cx='50%25' cy='50%25' r='50%25' fx='50%25' fy='50%25'%3E%3Cstop offset='0%25' stop-color='%23292524' stop-opacity='0.15'/%3E%3Cstop offset='100%25' stop-color='%230c0a09' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3C/svg%3E`;

export const DARK_ACADEMIA_GRID_TEXTURE_URL = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%231c1917'/%3E%3Cline x1='0' y1='0' x2='80' y2='0' stroke='%23292524' stroke-width='0.5'/%3E%3Cline x1='0' y1='80' x2='80' y2='80' stroke='%23292524' stroke-width='0.5'/%3E%3Cline x1='0' y1='0' x2='0' y2='80' stroke='%23292524' stroke-width='0.5'/%3E%3Cline x1='80' y1='0' x2='80' y2='80' stroke='%23292524' stroke-width='0.5'/%3E%3Cline x1='0' y1='40' x2='80' y2='40' stroke='%23292524' stroke-width='0.5'/%3E%3Cline x1='40' y1='0' x2='40' y2='80' stroke='%23292524' stroke-width='0.5'/%3E%3C/svg%3E`;
