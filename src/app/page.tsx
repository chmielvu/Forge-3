'use client';

import React, { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import NarrativeLog from '../components/NarrativeLog';
import NetworkGraph from '../components/NetworkGraph';
import MediaPanel from '../components/MediaPanel';
import LedgerDisplay from '../components/LedgerDisplay';
import ActionWheel from '../components/ActionWheel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

function GameInterface() {
  const { 
    logs, 
    kgot, 
    gameState, 
    isThinking, 
    processPlayerTurn,
    choices 
  } = useGameStore();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <main className="grid grid-cols-1 lg:grid-cols-12 h-screen bg-[#050505] text-[#f5f5f4] font-serif overflow-hidden">
      {/* BACKGROUND NOISE & GRADIENT */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      <div className="absolute inset-0 pointer-events-none z-0 bg-gradient-to-br from-black via-zinc-950 to-red-950/20"></div>

      {/* LEFT COLUMN: VISUALS & STATE (4 Cols) */}
      <section className="hidden lg:flex col-span-4 flex-col border-r border-[#1c1917] bg-black/80 z-10 relative">
        {/* TOP: MEDIA PANEL (Image/Video) */}
        <div className="h-1/3 border-b border-[#1c1917] relative">
           <MediaPanel />
        </div>

        {/* MIDDLE: KGOT GRAPH */}
        <div className="flex-1 border-b border-[#1c1917] relative p-4">
          <div className="absolute top-2 left-4 z-10">
            <h3 className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Neuro-Symbolic Memory</h3>
          </div>
          <NetworkGraph graphData={kgot} />
        </div>

        {/* BOTTOM: LEDGER (STATS) */}
        <div className="h-auto p-4 bg-zinc-950/50">
          <LedgerDisplay ledger={gameState.ledger} />
        </div>
      </section>

      {/* RIGHT COLUMN: NARRATIVE & INPUT (8 Cols) */}
      <section className="col-span-1 lg:col-span-8 flex flex-col relative z-10 h-full">
        
        {/* HEADER */}
        <header className="h-14 border-b border-[#1c1917] flex items-center justify-between px-8 bg-black/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-xl text-zinc-300 tracking-widest">THE FORGE'S LOOM</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-900/20 text-red-500 border border-red-900/50">
              LIVE SESSION
            </span>
          </div>
          <div className="font-mono text-[10px] text-zinc-600">
            LOC: {gameState.location} // TURN: {gameState.turn}
          </div>
        </header>

        {/* NARRATIVE SCROLL AREA */}
        <div className="flex-1 overflow-hidden relative bg-gradient-to-b from-black/0 to-black/20">
          <div className="absolute inset-0 p-8 overflow-y-auto custom-scrollbar">
            <NarrativeLog 
              logs={logs} 
              thinking={isThinking} 
              choices={[]} // We use ActionWheel instead of inline choices
              onChoice={() => {}} 
              ledger={gameState.ledger} 
            />
          </div>
        </div>

        {/* INPUT AREA */}
        <div className="p-6 border-t border-[#1c1917] bg-black/90 backdrop-blur-xl">
          {isThinking ? (
            <div className="h-[140px] flex flex-col items-center justify-center gap-3 text-zinc-500 animate-pulse">
              <Loader2 className="w-6 h-6 animate-spin text-red-500" />
              <span className="font-mono text-xs tracking-[0.2em]">THE DIRECTOR IS WEAVING...</span>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {/* Optional: Show specific choices if the Director provided them, otherwise generic wheel */}
              {choices.length > 0 ? (
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
                  onAction={(input) => processPlayerTurn(input)} 
                  disabled={isThinking} 
                />
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <ErrorBoundary>
      <GameInterface />
    </ErrorBoundary>
  );
}