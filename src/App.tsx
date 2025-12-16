

import * as React from 'react';
import {
  BookOpen,
  Skull,
  Feather,
  Terminal,
  Loader2,
  Send,
  Database,
  Brain,
  Clock,
  MapPin,
  Scroll,
  Activity
} from 'lucide-react';

import { useGameStore } from './state/gameStore';
import { audioService } from './services/AudioService';
import { BEHAVIOR_CONFIG } from './config/behaviorTuning'; 
import { THEME, DEFAULT_MEDIA_BACKGROUND_URL, DARK_ACADEMIA_GRID_TEXTURE_URL } from '@/theme'; // Updated to use alias

// New UI Components
import StartScreen from './components/StartScreen'; // Corrected import
import GameLayout from './components/GameLayout'; 
import DevOverlay from './components/DevOverlay';

// Re-export constants for backward compatibility if any legacy imports exist, 
// though direct imports from 'theme' are preferred.
export { THEME, DEFAULT_MEDIA_BACKGROUND_URL, DARK_ACADEMIA_GRID_TEXTURE_URL };

// --- GLOBAL STYLES & FONTS ---
const GlobalStyles = () => (
  <style>{`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes pulseSlow {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.7; }
    }
    @keyframes glitch-text {
      0% { text-shadow: 2px 0 0 #7f1d1d, -2px 0 0 #1e1b2d; transform: translateX(0); }
      20% { text-shadow: -2px 0 0 #7f1d1d, 2px 0 0 #1e1b2d; transform: translateX(2px); }
      40% { text-shadow: 1px 0 0 #7f1d1d, -1px 0 0 #1e1b2d; transform: translateX(-1px); }
      60% { text-shadow: -1px 0 0 #7f1d1d, 1px 0 0 #1e1b2d; transform: translateX(1px); }
      80% { text-shadow: 3px 0 0 #7f1d1d, -3px 0 0 #1e1b2d; transform: translateX(-3px); }
      100% { text-shadow: 0 0 0 #7f1d1d, 0 0 0 #1e1b2d; transform: translateX(0); }
    }
    .animate-fade-in {
      animation: fadeIn 1.5s ease-out forwards;
    }
    .animate-pulse-slow {
      animation: pulseSlow 4s infinite ease-in-out;
    }
    .animate-glitch-text {
        animation: glitch-text 0.5s infinite alternate;
    }
    .scanline {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(to bottom, transparent 50%, rgba(28, 25, 23, 0.05) 51%); /* Darker scanline */
      background-size: 100% 4px;
      pointer-events: none;
      z-index: 10;
    }
    .texture-paper {
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
    }
    .bg-radial-gradient-crimson {
      background: radial-gradient(circle at center, transparent 10%, rgba(127, 29, 29, 0.2) 60%, rgba(127, 29, 29, 0.4) 100%); /* Adjusted to burgundy */
    }
    /* Custom Scrollbar for "Dark Academia" feel */
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #0c0a09; 
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #44403c; 
      border-radius: 2px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #a8a29e;
    }
    .text-shadow-glow {
      text-shadow: 0 0 20px rgba(231,229,228,0.1), 0 0 10px rgba(231,229,228,0.05);
    }
    .mask-linear-fade {
      mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
      -webkit-mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
    }
  `}</style>
);

// Atmospheric Overlays
const GrainOverlay = () => (
  <div className="absolute inset-0 pointer-events-none z-[5] opacity-[0.06] mix-blend-overlay texture-paper"></div>
);

const Vignette = () => (
  <div className="absolute inset-0 pointer-events-none z-[6] bg-[radial-gradient(circle_at_center,transparent_8%,rgba(12,10,9,0.85)_80%,#0c0a09_100%)]" />
);


// --- APP ENTRY POINT ---

export default function App() {
  const { sessionActive, startSession, gameState, resetGame } = useGameStore();

  const handleStartSession = React.useCallback((isLite: boolean) => {
    // Crucial: Update BEHAVIOR_CONFIG.TEST_MODE before `startSession` might trigger worker-dependent logic
    BEHAVIOR_CONFIG.TEST_MODE = isLite; 
    console.log(`[App] TEST_MODE set to: ${BEHAVIOR_CONFIG.TEST_MODE}.`);
    
    // Reset the game to re-initialize the store with the correct TEST_MODE setting
    // This ensures workers are correctly enabled/disabled from the start.
    resetGame(); 
    
    // Now start the session which will use the updated TEST_MODE
    startSession(isLite);
  }, [startSession, resetGame]);

  return (
    <div className={`relative w-full h-screen flex flex-col ${THEME.colors.bg} ${THEME.colors.textMain} overflow-hidden selection:bg-[#7f1d1d]/50 selection:text-white font-serif animate-fade-in`}>
      <GlobalStyles />
      <div className="scanline" />
      <GrainOverlay />
      <Vignette />

      {sessionActive ? (
        <GameLayout />
      ) : (
        <StartScreen onStart={handleStartSession} />
      )}
      <DevOverlay />
    </div>
  );
}