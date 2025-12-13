
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from './state/gameStore';
import { turnService } from './state/turnService'; // Keep for init
import { BEHAVIOR_CONFIG } from './config/behaviorTuning';
import NarrativeLog from './components/NarrativeLog';
import Grimoire from './components/Grimoire';
import StatusLedger from './components/StatusLedger';
import NetworkGraph from './components/NetworkGraph';
import ReactiveCanvas from './components/ReactiveCanvas';
import DistortionLayer from './components/DistortionLayer';
import DevOverlay from './components/DevOverlay';
import MediaPanel from './components/MediaPanel';
import { Menu, Terminal, Activity, Zap, X } from 'lucide-react';

const App: React.FC = () => {
  const { 
    gameState,
    kgot,
    logs,
    choices,
    isThinking,
    isMenuOpen,
    isGrimoireOpen,
    setMenuOpen,
    setGrimoireOpen,
    setDevOverlayOpen,
    processPlayerTurn, // New action
    currentTurnId, 
    getTurnById,
  } = useGameStore();

  const { ledger } = gameState;
  const [canvasActive, setCanvasActive] = useState(true);
  const hasInitialized = useRef(false);

  const currentTurn = currentTurnId ? getTurnById(currentTurnId) : undefined;
  const latestImage = currentTurn?.imageData;
  const latestVideo = currentTurn?.videoUrl;

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    turnService.initGame(); 
  }, []);

  const handleInput = (text: string) => {
    if (text.trim() && !isThinking) {
        processPlayerTurn(text);
    }
  };

  return (
    <DistortionLayer ledger={ledger}>
      <div className="relative w-full h-screen overflow-hidden bg-forge-black text-forge-text font-sans selection:bg-forge-gold selection:text-black">
        
        {BEHAVIOR_CONFIG.DEV_MODE.ENABLED && <DevOverlay />}

        {/* BACKGROUND */}
        <div className="absolute inset-0 z-0 transition-opacity duration-1000 ease-in-out">
          {latestVideo ? (
             <video src={latestVideo} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-70" />
          ) : latestImage ? (
             <img src={latestImage.startsWith('data:') ? latestImage : `data:image/jpeg;base64,${latestImage}`} className="w-full h-full object-cover opacity-70 animate-pulse-slow" alt="Scene" />
          ) : (
             <div className="w-full h-full bg-stone-950 opacity-100 flex items-center justify-center">
                <div className="text-forge-gold font-display text-6xl opacity-20">THE FORGE</div>
             </div>
          )}
          <ReactiveCanvas ledger={ledger} isActive={canvasActive} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-black via-black/95 to-transparent"></div>
        </div>

        {/* CONTROLS */}
        <div className="absolute top-0 left-0 right-0 z-40 p-6 flex justify-between items-start">
          <div className="flex gap-4">
            <button onClick={() => setMenuOpen(true)} className="group border border-forge-gold/30 bg-black/50 p-3 rounded-sm backdrop-blur-md text-stone-400 hover:text-forge-gold">
              <Menu size={20} />
            </button>
            <button onClick={() => setCanvasActive(!canvasActive)} className={`border border-forge-gold/30 bg-black/50 p-3 rounded-sm backdrop-blur-md ${canvasActive ? 'text-forge-gold' : 'text-stone-500'}`}>
              <Zap size={20} />
            </button>
          </div>
          <div className="flex flex-col items-end gap-2">
             <button onClick={() => setGrimoireOpen(true)} className="border border-stone-800 bg-black/50 text-stone-400 hover:text-forge-gold px-4 py-2 rounded-sm backdrop-blur-md font-mono text-xs uppercase flex items-center gap-2">
                <Terminal size={14} /> Director Terminal
             </button>
             <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
                <Activity size={10} className={isThinking ? "text-forge-gold animate-pulse" : "text-stone-700"} />
                <span>{isThinking ? "WEAVING_FATE" : "AWAITING_INPUT"}</span>
             </div>
          </div>
        </div>

        {/* NARRATIVE CONSOLE */}
        <div className="absolute bottom-0 left-0 right-0 z-30 h-[30vh] md:h-[35vh] flex flex-col justify-end pb-4 md:pb-8">
          <div className="w-full h-full max-w-7xl mx-auto px-4 md:px-12 flex gap-8 items-end">
             <NarrativeLog 
               logs={logs} 
               thinking={isThinking} 
               choices={choices}
               onChoice={handleInput}
               ledger={ledger}
             />
          </div>
        </div>

        {/* MENU OVERLAY */}
        {isMenuOpen && (
          <div className="absolute inset-0 z-50 bg-black/98 backdrop-blur-xl p-8 animate-fade-in flex flex-col md:flex-row gap-12 overflow-y-auto">
            <button onClick={() => setMenuOpen(false)} className="absolute top-6 right-6 text-stone-500 hover:text-forge-gold"><X /></button>
            
            <div className="flex-1 max-w-md space-y-8 pt-10">
               <h2 className="font-display text-3xl text-forge-gold border-b border-forge-gold/30 pb-4">Subject Metrics</h2>
               <StatusLedger ledger={ledger} />
            </div>

            <div className="flex-1 max-w-2xl space-y-8 pt-10">
               <h2 className="font-display text-3xl text-forge-gold border-b border-forge-gold/30 pb-4">Knowledge Graph (KGoT)</h2>
               <div className="h-[400px] w-full">
                 <NetworkGraph graphData={kgot} />
               </div>
            </div>
            
            <div className="flex-1 max-w-xl space-y-8 pt-10">
                <h2 className="font-display text-3xl text-forge-gold border-b border-forge-gold/30 pb-4">Multimodal Timeline</h2>
                <div className="h-[400px] w-full border border-stone-800 rounded-sm overflow-hidden">
                    <MediaPanel />
                </div>
            </div>
          </div>
        )}

        <Grimoire 
          isOpen={isGrimoireOpen} 
          onClose={() => setGrimoireOpen(false)} 
          onResult={() => {}} 
          gameState={gameState}
        />

      </div>
    </DistortionLayer>
  );
};

export default App;
