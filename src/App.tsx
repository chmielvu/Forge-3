import * as React from 'react';
import {
  Loader2
} from 'lucide-react';

import { useGameStore } from './state/gameStore';
import { BEHAVIOR_CONFIG } from './config/behaviorTuning'; 
import { THEME } from './theme'; 

// New UI Components
import StartScreen from './components/StartScreen'; 
import GameLayout from './components/GameLayout'; 
import DevOverlay from './components/DevOverlay';

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
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
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
      background: radial-gradient(circle at center, transparent 10%, rgba(127, 29, 29, 0.2) 60%, rgba(127, 29, 29, 0.4) 100%); 
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

// New Cinematic Boot Loader
const BootLoader = () => {
  const [lines, setLines] = React.useState<string[]>([]);
  const bootSequence = [
    "> INITIALIZING CORE KERNEL...",
    "> MOUNTING KNOWLEDGE GRAPH EXTENSIONS...",
    "> SYNCHRONIZING PSYCHOMETRIC LEDGER...",
    "> CONNECTING TO NEURO-SYMBOLIC ENGINE...",
    "> VERIFYING INTEGRITY..."
  ];

  React.useEffect(() => {
    let delay = 0;
    bootSequence.forEach((line, index) => {
      setTimeout(() => {
        setLines(prev => [...prev, line]);
      }, delay);
      delay += 400 + Math.random() * 400; // Random jitter
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0c0a09] text-[#065f46] font-mono z-50 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[size:100%_4px] opacity-20"></div>
      
      <div className="flex flex-col gap-6 items-center max-w-md w-full px-8">
        <div className="relative">
           <Loader2 size={48} className="animate-spin text-[#065f46]" />
           <div className="absolute inset-0 blur-md bg-[#065f46] opacity-20 animate-pulse"></div>
        </div>
        
        <div className="w-full bg-[#0c0a09] border border-[#065f46]/30 p-4 rounded-sm min-h-[150px] shadow-[0_0_20px_rgba(6,95,70,0.1)]">
          {lines.map((line, i) => (
            <div key={i} className="text-xs tracking-wider opacity-80 animate-fade-in mb-1">
              {line}
            </div>
          ))}
          <div className="text-xs animate-pulse mt-2">_</div>
        </div>
        
        <span className="text-[10px] text-[#065f46]/50 tracking-[0.5em] uppercase">System Restoration In Progress</span>
      </div>
    </div>
  );
};


// --- APP ENTRY POINT ---

export default function App() {
  const { sessionActive, startSession, resetGame, hasHydrated, gameState } = useGameStore();

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

  // Ensure hydration check triggers
  React.useEffect(() => {
     useGameStore.persist.rehydrate();
  }, []);

  // FIX: Robust hydration gate check for essential data.
  // Do not show ANY UI until the store has rehydrated from IndexedDB
  // AND the gameState.ledger.subjectId is present (indicating meaningful data).
  if (!hasHydrated || !gameState?.ledger?.subjectId) {
    return (
      <div className={`relative w-full h-screen flex flex-col ${THEME.colors.bg} ${THEME.colors.textMain} overflow-hidden font-serif`}>
        <GlobalStyles />
        <div className="scanline" />
        <GrainOverlay />
        <BootLoader />
      </div>
    );
  }

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