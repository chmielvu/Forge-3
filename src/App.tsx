
import React from 'react';
import NetworkGraph from './components/NetworkGraph';
import NarrativeLog from './components/NarrativeLog';
import MediaPanel from './components/MediaPanel';
import { useGameStore } from './state/gameStore';
import DevOverlay from './components/DevOverlay';
import DistortionLayer from './components/DistortionLayer';
import LedgerDisplay from './components/LedgerDisplay';
import ActionWheel from './components/ActionWheel';
import PrefectLeaderboard from './components/PrefectLeaderboard';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { 
    logs, 
    kgot, 
    gameState, 
    isThinking, 
    processPlayerTurn,
    choices,
    prefects
  } = useGameStore();

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-slate-200 overflow-hidden font-sans selection:bg-red-900 selection:text-white">
      {/* Cinematic & Dev Layers */}
      <DistortionLayer ledger={gameState.ledger}>
        <div className="absolute inset-0 pointer-events-none z-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </DistortionLayer>
      <DevOverlay />

      {/* Main Grid Layout */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 h-screen max-h-screen">
        
        {/* LEFT: The Knowledge Graph (Memory) & Ledger & Leaderboard */}
        <div className="hidden lg:flex lg:col-span-3 flex-col gap-4 h-full">
           <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-sm overflow-hidden flex flex-col shadow-2xl h-1/3">
              <div className="p-3 border-b border-white/10 bg-black/60">
                <h2 className="text-xs font-bold tracking-[0.2em] text-white/40 uppercase">KGoT_Visualizer // v3.6</h2>
              </div>
              <div className="flex-grow relative">
                <NetworkGraph graphData={kgot} />
              </div>
           </div>
           
           <div className="h-1/3">
             <PrefectLeaderboard prefects={prefects} />
           </div>

           <div className="h-auto">
             <LedgerDisplay ledger={gameState.ledger} />
           </div>
        </div>

        {/* CENTER: The Narrative Log (Dialogue) & Input */}
        <div className="col-span-1 lg:col-span-6 flex flex-col gap-4 h-full relative">
          <header className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black to-transparent pointer-events-none">
             <h1 className="font-display text-xl text-zinc-300 tracking-widest text-center">THE FORGE'S LOOM</h1>
             <div className="text-center font-mono text-[10px] text-zinc-600">TURN: {gameState.turn} // {gameState.location}</div>
          </header>

          <div className="flex-1 overflow-hidden relative border border-white/5 bg-black/20 rounded-sm">
             <div className="absolute inset-0 p-6 pt-16 overflow-y-auto custom-scrollbar">
               <NarrativeLog 
                 logs={logs}
                 thinking={isThinking}
                 choices={[]} // ActionWheel handles this
                 onChoice={() => {}}
                 ledger={gameState.ledger}
               />
             </div>
          </div>

          <div className="h-auto min-h-[140px] p-6 border-t border-white/10 bg-black/80 backdrop-blur-xl rounded-sm">
            {isThinking ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500 animate-pulse">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                  <span className="font-mono text-xs tracking-[0.2em]">DIRECTOR IS WEAVING...</span>
                </div>
            ) : (
                choices.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {choices.map((choice, idx) => (
                      <button 
                        key={idx}
                        onClick={() => processPlayerTurn(choice)}
                        className="p-4 text-left border border-zinc-800 hover:border-amber-500/50 hover:bg-amber-900/10 transition-all rounded-sm"
                      >
                        <span className="font-serif italic text-zinc-300">"{choice}"</span>
                      </button>
                    ))}
                 </div>
                ) : (
                    <ActionWheel 
                        onAction={processPlayerTurn} 
                        disabled={isThinking} 
                    />
                )
            )}
          </div>
        </div>

        {/* RIGHT: Visuals & State (The Eye) */}
        <div className="hidden lg:flex lg:col-span-3 flex-col gap-4 h-full">
          <div className="h-full border border-white/10 rounded-sm overflow-hidden bg-black relative">
            <MediaPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
