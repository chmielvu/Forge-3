import * as React from 'react';
import { Loader2 } from 'lucide-react';
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
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeIn 1s ease-out forwards; }
    
    .scanline {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.1) 51%);
      background-size: 100% 4px; pointer-events: none; z-index: 5;
    }
    .texture-paper {
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
    }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #0c0a09; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #292524; border-radius: 0; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #7f1d1d; }
    
    .text-shadow-glow { text-shadow: 0 0 20px rgba(231,229,228,0.15); }
  `}</style>
);

const GrainOverlay = () => (
  <div className="absolute inset-0 pointer-events-none z-[4] opacity-[0.07] mix-blend-overlay texture-paper"></div>
);

const Vignette = () => (
  <div className="absolute inset-0 pointer-events-none z-[6] bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.8)_90%,#000000_100%)]" />
);

// --- MAIN APP ---
export default function App() {
  const { sessionActive, startSession, resetGame, hasHydrated, gameState } = useGameStore();

  const handleStartSession = React.useCallback((isLite: boolean) => {
    BEHAVIOR_CONFIG.TEST_MODE = isLite; 
    console.log(`[App] TEST_MODE set to: ${BEHAVIOR_CONFIG.TEST_MODE}.`);
    resetGame(); 
    startSession(isLite);
  }, [startSession, resetGame]);

  React.useEffect(() => { useGameStore.persist.rehydrate(); }, []);

  // Hydration Gate
  if (!hasHydrated || !gameState?.ledger?.subjectId) {
    return (
      <div className="grid place-items-center h-screen w-full bg-[#0c0a09] text-[#e7e5e4]">
        <GlobalStyles />
        <Loader2 className="animate-spin text-[#7f1d1d]" size={32} />
      </div>
    );
  }

  return (
    <div className={`relative grid place-items-center min-h-screen w-full bg-[#0c0a09] text-[#e7e5e4] overflow-hidden font-serif`}>
      <GlobalStyles />
      
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
         <div className="absolute inset-0 bg-[#0c0a09]"></div>
         <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1c1917] via-[#0c0a09] to-black"></div>
      </div>

      {/* Atmospheric Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 w-full h-full">
        <div className="scanline" />
        <GrainOverlay />
        <Vignette />
      </div>

      {/* Content Layer */}
      <div className="relative z-20 w-full h-full flex items-center justify-center">
        {sessionActive ? (
          <GameLayout />
        ) : (
          <StartScreen onStart={handleStartSession} />
        )}
      </div>

      <DevOverlay />
    </div>
  );
}