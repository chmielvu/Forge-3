
import React, { useEffect, useState } from 'react';
import NetworkGraph from './components/NetworkGraph';
import NarrativeLog from './components/NarrativeLog';
import MediaPanel from './components/MediaPanel';
import { useGameStore } from './state/gameStore';
import DevOverlay from './components/DevOverlay';
import DistortionLayer from './components/DistortionLayer';
import LedgerDisplay from './components/LedgerDisplay';
import ActionWheel from './components/ActionWheel';
import PrefectLeaderboard from './components/PrefectLeaderboard';
import { Loader2, Monitor, Eye, Brain, LayoutTemplate, Film, Activity } from 'lucide-react';

type ViewMode = 'CINEMATIC' | 'ANALYTICAL';

export default function App() {
  const { 
    logs, 
    kgot, 
    gameState, 
    isThinking, 
    processPlayerTurn,
    choices,
    prefects,
    startSession
  } = useGameStore();

  const [viewMode, setViewMode] = useState<ViewMode>('CINEMATIC');
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
    // Direct initialization
    startSession();
  }, [startSession]);

  return (
    <div className="relative w-screen h-screen bg-[#050505] text-[#f5f5f4] overflow-hidden font-serif selection:bg-red-900 selection:text-white">
      
      {/* LAYER 0: Background Media (The World) */}
      <div className={`absolute inset-0 z-0 transition-all duration-700 ${viewMode === 'ANALYTICAL' ? 'opacity-30 blur-sm scale-[1.02]' : 'opacity-60 scale-100'}`}>
         <MediaPanel variant="background" className="w-full h-full" />
      </div>

      {/* LAYER 1: Atmosphere & Distortion */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <DistortionLayer ledger={gameState.ledger}>
           {/* Scanline Texture */}
           <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
           {/* Vignette */}
           <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] ${viewMode === 'ANALYTICAL' ? 'opacity-90' : 'opacity-60'} transition-opacity duration-700`}></div>
        </DistortionLayer>
      </div>

      {/* LAYER 2: Main Interface */}
      <div className="absolute inset-0 z-20 flex flex-col p-4 md:p-8 pointer-events-none">
         
         {/* Top Bar */}
         <div className="flex justify-between items-start mb-6 pointer-events-auto">
            <div>
                <h1 className="font-display text-white/60 tracking-[0.3em] text-sm uppercase">The Forge's Loom</h1>
                <div className="text-[10px] font-mono text-white/40 mt-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    TURN: {gameState.turn} // {gameState.location.toUpperCase()}
                </div>
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={() => setViewMode(viewMode === 'CINEMATIC' ? 'ANALYTICAL' : 'CINEMATIC')} 
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-sm border transition-all duration-300 backdrop-blur-md font-mono text-xs tracking-widest uppercase
                        ${viewMode === 'ANALYTICAL'
                            ? 'bg-amber-900/30 border-amber-500/50 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                            : 'bg-black/40 border-white/10 text-white/60 hover:text-white hover:border-white/30'}
                    `}
                >
                   {viewMode === 'CINEMATIC' ? <LayoutTemplate size={14} /> : <Film size={14} />}
                   <span>{viewMode === 'CINEMATIC' ? 'ANALYTICAL_VIEW' : 'CINEMATIC_VIEW'}</span>
                </button>

                <button 
                    onClick={() => setShowDevTools(!showDevTools)}
                    className="p-2 rounded-sm border border-white/10 bg-black/40 text-white/40 hover:text-white hover:border-white/30 transition-all"
                    title="Toggle Developer Matrix"
                >
                    <Monitor size={14} />
                </button>
            </div>
         </div>

         {/* Content Area */}
         <div className="flex-1 w-full relative">
             {viewMode === 'CINEMATIC' ? (
                 // --- CINEMATIC MODE ---
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl flex flex-col gap-6 animate-fade-in pointer-events-auto pb-8">
                     {/* Narrative Log (Glassmorphism) */}
                     <div className="relative bg-black/70 backdrop-blur-xl border border-white/10 rounded-sm shadow-2xl overflow-hidden group transition-all hover:bg-black/80">
                         <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-900/50 to-transparent opacity-50"></div>
                         <div className="h-[40vh] md:h-[350px] overflow-y-auto custom-scrollbar p-6 md:p-8 mask-image-gradient-top">
                           <NarrativeLog 
                             logs={logs}
                             thinking={isThinking}
                             choices={[]} 
                             onChoice={() => {}}
                             ledger={gameState.ledger}
                           />
                         </div>
                     </div>

                     {/* Action Area */}
                     <div className="min-h-[120px] relative">
                        {isThinking ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-amber-500/50 animate-pulse">
                              <Loader2 className="w-8 h-8 animate-spin" />
                              <span className="font-mono text-xs tracking-[0.4em] uppercase">Simulating Neural Pathways...</span>
                            </div>
                        ) : (
                            choices.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {choices.map((choice, idx) => (
                                  <button 
                                    key={idx}
                                    onClick={() => processPlayerTurn(choice)}
                                    className="group relative p-5 text-left bg-black/60 hover:bg-red-950/40 border border-white/10 hover:border-red-500/50 transition-all duration-300 rounded-sm overflow-hidden"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-900/0 to-red-900/0 group-hover:from-red-900/10 group-hover:to-transparent transition-all duration-500"></div>
                                    <span className="relative font-serif italic text-lg text-stone-300 group-hover:text-white transition-colors">"{choice}"</span>
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
             ) : (
                 // --- ANALYTICAL MODE ---
                 <div className="absolute inset-0 flex gap-6 animate-fade-in pointer-events-auto">
                     
                     {/* Left Column: Data Systems */}
                     <div className="w-1/3 flex flex-col gap-4 h-full">
                        {/* KGoT Graph */}
                        <div className="flex-1 bg-black/80 backdrop-blur-xl border border-blue-900/20 rounded-sm overflow-hidden flex flex-col shadow-2xl relative group">
                           <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
                             <Brain size={12} className="text-blue-500" />
                             <h2 className="text-[10px] font-bold tracking-[0.2em] text-blue-200/60 uppercase">Knowledge Graph</h2>
                           </div>
                           <div className="flex-grow relative">
                             <NetworkGraph graphData={kgot} />
                           </div>
                        </div>
                        
                        {/* Ledger */}
                        <div className="h-auto shadow-2xl">
                          <LedgerDisplay ledger={gameState.ledger} />
                        </div>
                     </div>

                     {/* Middle Column: Narrative (Condensed) */}
                     <div className="w-1/3 flex flex-col gap-4 h-full">
                        <div className="flex-1 bg-black/80 backdrop-blur-xl border border-white/10 rounded-sm shadow-2xl overflow-hidden flex flex-col">
                             <div className="p-3 border-b border-white/5 bg-black/50">
                                <h2 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Narrative Log</h2>
                             </div>
                             <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                               <NarrativeLog 
                                 logs={logs}
                                 thinking={isThinking}
                                 choices={[]} 
                                 onChoice={() => {}}
                                 ledger={gameState.ledger}
                               />
                             </div>
                        </div>
                        {/* Action Area (Analytical) */}
                        <div className="min-h-[100px]">
                            {isThinking ? (
                                <div className="h-full flex items-center justify-center border border-dashed border-white/20 rounded-sm">
                                    <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {choices.map((choice, idx) => (
                                      <button 
                                        key={idx}
                                        onClick={() => processPlayerTurn(choice)}
                                        className="p-3 text-left bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300 transition-all rounded-sm truncate"
                                      >
                                        &gt; {choice}
                                      </button>
                                    ))}
                                    {choices.length === 0 && !isThinking && (
                                        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-sm text-center text-xs text-zinc-500">
                                            Awaiting Input System...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                     </div>

                     {/* Right Column: Prefects & Stats */}
                     <div className="w-1/3 flex flex-col gap-4 h-full">
                        <div className="flex-1 bg-black/80 backdrop-blur-xl border border-amber-900/20 rounded-sm overflow-hidden flex flex-col shadow-2xl">
                           <PrefectLeaderboard prefects={prefects} />
                        </div>
                        <div className="h-1/3 bg-black/80 backdrop-blur-xl border border-red-900/20 rounded-sm p-4">
                            <h3 className="font-mono text-[10px] text-red-500/60 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Activity size={12} /> Threat Assessment
                            </h3>
                            <div className="text-xs text-zinc-400 font-serif leading-relaxed">
                                {gameState.ledger.traumaLevel > 70 
                                    ? "CRITICAL: Subject psyche fragmenting. Compliance enforcement mandatory."
                                    : "STATUS: Subject resistant but stable. Continued calibration required."}
                            </div>
                        </div>
                     </div>
                 </div>
             )}
         </div>
      </div>

      {/* Dev Tools Overlay (Toggleable) */}
      <DevOverlay /> 
    </div>
  );
}
