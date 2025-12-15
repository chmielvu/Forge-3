import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Skull, 
  Feather, 
  Maximize2, 
  Minimize2, 
  Terminal, 
  Loader2, 
  Send, 
  Database, 
  Scroll, 
  Brain,
  Clock,
  MapPin
} from 'lucide-react';

import NetworkGraph from './components/NetworkGraph';
import NarrativeLog from './components/NarrativeLog';
import MediaPanel from './components/MediaPanel';
import { useGameStore } from './state/gameStore';
import DevOverlay from './components/DevOverlay';
import DistortionLayer from './components/DistortionLayer';
import LedgerDisplay from './components/LedgerDisplay';
import PrefectLeaderboard from './components/PrefectLeaderboard';
import SubjectPanel from './components/SubjectPanel';
import { audioService } from './services/AudioService';


// --- GLOBAL STYLES & FONTS ---
const GlobalStyles = () => (
  <style>{`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fade-in {
      animation: fadeIn 1.5s ease-out forwards;
    }
    .scanline {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(to bottom, transparent 50%, rgba(30, 25, 20, 0.05) 51%);
      background-size: 100% 4px;
      pointer-events: none;
      z-index: 10;
    }
    .texture-paper {
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
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
      background: #78350f;
    }
    .corner-accent {
        position: absolute;
        width: 1rem;
        height: 1rem;
        border-color: #44403c;
        opacity: 0.5;
        pointer-events: none;
    }
    .text-shadow-glow {
      text-shadow: 0 0 20px rgba(255,255,255,0.1), 0 0 10px rgba(255,255,255,0.05);
    }
  `}</style>
);

// --- THEME CONFIG ---
const THEME = {
  colors: {
    bg: "bg-[#050505]",
    panel: "bg-[#0c0a09]/95",
    border: "border-[#292524]",
    accent: "text-[#991b1b]",
    textMain: "text-[#e7e5e4]",
    textMuted: "text-[#a8a29e]"
  },
  classes: {
    glass: "backdrop-blur-xl border shadow-[0_8px_32px_-4px_rgba(0,0,0,0.8)]",
    iconBtn: "p-2 rounded-sm hover:bg-[#292524] transition-all duration-300 text-[#78716c] hover:text-[#d6d3d1] border border-transparent hover:border-[#57534e]",
  }
};

const START_SCREEN_BACKGROUND_URL = ""; 

// --- ATMOSPHERIC COMPONENTS ---

const GrainOverlay = () => (
  <div className="absolute inset-0 pointer-events-none z-[5] opacity-[0.06] mix-blend-overlay texture-paper"></div>
);

const Vignette = () => (
  <div className="absolute inset-0 pointer-events-none z-[6] bg-[radial-gradient(circle_at_center,transparent_20%,rgba(5,5,5,0.6)_80%,#050505_100%)]" />
);

const CinematicBars = ({ active }: { active: boolean }) => (
  <>
    <div className={`absolute top-0 left-0 right-0 bg-black z-[50] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${active ? 'h-[12vh] border-b border-[#292524]' : 'h-0 border-0'}`} />
    <div className={`absolute bottom-0 left-0 right-0 bg-black z-[50] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${active ? 'h-[12vh] border-t border-[#292524]' : 'h-0 border-0'}`} />
  </>
);

const AnalyticalPanel = ({ title, children, side }: { title: string, children?: React.ReactNode, side: 'left' | 'right' }) => (
  <div className={`
    flex-1 h-full ${THEME.colors.panel} ${THEME.classes.glass} ${THEME.colors.border} 
    flex flex-col relative overflow-hidden transition-all duration-700 shadow-2xl
    ${side === 'left' ? 'border-r border-r-[#78350f]/20 rounded-r-md' : 'border-l border-l-[#78350f]/20 rounded-l-md'}
  `}>
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#78350f]/30 to-transparent opacity-50" />
    
    <div className="px-4 py-3 border-b border-[#292524] bg-black/40 flex justify-between items-center backdrop-blur-sm">
      <span className="font-display text-[10px] tracking-[0.2em] uppercase text-[#78716c] flex items-center gap-2 group">
        {side === 'left' ? <Brain size={12} className="text-[#b45309] group-hover:animate-pulse" /> : <Scroll size={12} className="text-[#b45309] group-hover:animate-pulse" />}
        {title}
      </span>
      <div className="flex gap-1 opacity-40">
        <div className="w-1 h-1 bg-[#78350f] rounded-full" />
        <div className="w-1 h-1 bg-[#57534e] rounded-full" />
        <div className="w-1 h-1 bg-[#292524] rounded-full" />
      </div>
    </div>
    <div className="p-4 flex-1 overflow-auto custom-scrollbar relative bg-[#0c0a09]/50">
      {children}
    </div>
  </div>
);

// --- START SCREEN ---

const StartScreen = ({ onStart }: { onStart: (liteMode: boolean) => void }) => {
    const handleStart = (lite: boolean) => {
        // Safe check for audio service if not initialized
        if(audioService?.playSfx) audioService.playSfx('boot');
        onStart(lite);
    };

    return (
    <div className={`relative w-full min-h-screen flex flex-col items-center justify-center ${THEME.colors.bg} ${THEME.colors.textMain} animate-fade-in font-serif overflow-hidden`}>
      
      {/* Background Layers */}
      <div className="absolute inset-0 z-0"> 
         <img 
           src={START_SCREEN_BACKGROUND_URL}
           className="w-full h-full object-cover grayscale contrast-125 sepia-[0.3] opacity-60 transition-opacity duration-1000 scale-105 animate-[pulse-slow_10s_infinite]"
           alt="The Forge Library"
         />
         <div className="absolute inset-0 bg-black/20" /> 
      </div>
      
      {/* Atmosphere Stack */}
      <div className="scanline z-[1] opacity-20" />
      <GrainOverlay />
      <Vignette />
      
      {/* Content Container - Removed box, focused on centering */}
      <div className={`relative z-20 text-center w-full max-w-3xl mx-auto px-4 flex flex-col items-center justify-center gap-8`}>
        
        {/* Header Icon */}
        <div className="opacity-90 relative z-30 animate-fade-in">
             <div className="flex items-center justify-center gap-4 text-[#78716c] mb-6">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#78716c]" />
                <BookOpen size={18} />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#78716c]" />
             </div>
             <Skull size={72} className="mx-auto text-[#e7e5e4] drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" strokeWidth={0.8} />
        </div>
        
        <div className="flex flex-col items-center gap-2">
            <h1 className="relative z-30 font-display text-6xl md:text-8xl tracking-[0.15em] uppercase text-[#e7e5e4] drop-shadow-2xl text-shadow-glow">
            The Forge
            </h1>
            
            <div className="relative z-30 flex items-center justify-center gap-3 opacity-90">
                <div className="h-px w-8 bg-[#78716c]/50" />
                <span className="font-mono text-[10px] tracking-[0.5em] uppercase text-[#d6d3d1] bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-[#44403c]/50">Department of Correction</span>
                <div className="h-px w-8 bg-[#78716c]/50" />
            </div>
        </div>
        
        <p className="relative z-30 font-serif text-2xl md:text-3xl text-[#d6d3d1] italic leading-relaxed max-w-lg mx-auto drop-shadow-lg text-shadow-glow">
          "Chaos must be refined."
          <span className="text-[#a8a29e] text-sm not-italic mt-4 block font-mono tracking-widest uppercase opacity-80">Welcome to the calibration.</span>
        </p>
  
        <div className="relative z-30 flex flex-col gap-4 justify-center items-center w-full max-w-xs mt-4">
          <button 
            onClick={() => handleStart(false)}
            onMouseEnter={() => audioService?.playSfx && audioService.playSfx('hover')}
            className="group relative w-full py-4 bg-black/60 backdrop-blur-sm border border-[#44403c] hover:border-[#b45309] hover:bg-[#1c1917]/80 transition-all duration-500 ease-out cursor-pointer overflow-hidden shadow-2xl rounded-sm"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#b45309]/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="flex items-center justify-center gap-3 relative z-10">
              <Feather size={16} className="text-[#a8a29e] group-hover:text-[#b45309] transition-colors" />
              <span className="font-display text-sm tracking-[0.3em] uppercase text-[#e7e5e4] group-hover:text-white transition-colors">
                Begin Session
              </span>
            </div>
          </button>

          <button 
            onClick={() => handleStart(true)}
            onMouseEnter={() => audioService?.playSfx && audioService.playSfx('hover')}
            className="group w-full py-3 bg-transparent hover:bg-black/20 border-b border-transparent hover:border-[#57534e] transition-all duration-500 ease-out cursor-pointer opacity-70 hover:opacity-100 rounded-sm"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#78716c] group-hover:text-[#d6d3d1] transition-colors">
                Access Local Protocol (Lite)
              </span>
            </div>
          </button>
        </div>

        <div className="absolute bottom-8 z-30 text-[9px] font-mono text-[#78716c] uppercase tracking-[0.3em] opacity-60">
            Vol. III • MMXXIV
        </div>
      </div>
    </div>
    );
};

// --- MAIN APPLICATION COMPONENT ---

export default function App() {
  const { 
    logs = [], 
    kgot = {}, 
    gameState = { location: 'Unknown', turn: 0, ledger: {} as any }, // Explicitly cast ledger for safety
    isThinking = false, 
    processPlayerTurn = () => {},
    choices = [],
    prefects = [],
    startSession = () => {},
    sessionActive = false,
    isLiteMode = false,
    isDevOverlayOpen = false,
    setDevOverlayOpen = () => {},
    multimodalTimeline = [], // Added multimodalTimeline from store
    getTurnById = () => undefined, // Added getTurnById from store
  } = useGameStore();

  const [viewMode, setViewMode] = useState<'CINEMATIC' | 'ANALYTICAL'>('CINEMATIC');
  const [lastLogText, setLastLogText] = useState<string>("The system waits.");
  const [visualPromptForCinematic, setVisualPromptForCinematic] = useState<string | undefined>(undefined); // NEW: State for visual prompt
  const [customInput, setCustomInput] = useState('');
  const [mounted, setMounted] = useState(false); // NEW: State for hydration fix

  // NEW: Effect to set mounted state on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    audioService?.playSfx && audioService.playSfx('click');
    processPlayerTurn(customInput);
    setCustomInput('');
  };

  useEffect(() => {
      // Find the last substantial narrative log to display in Cinematic Mode
      if (logs && logs.length > 0) {
          // Look backwards for the last narrative or psychosis log
          for (let i = logs.length - 1; i >= 0; i--) {
              const log = logs[i];
              if ((log.type === 'narrative' || log.type === 'psychosis') && log.content.length > 20) {
                  setLastLogText(log.content.replace(/<[^>]*>?/gm, '')); // Strip HTML tags for the overlay text
                  
                  // NEW: Extract visual prompt from multimodal timeline
                  const correspondingTurn = multimodalTimeline.find(turn => turn.id === log.id);
                  if (correspondingTurn?.visualPrompt) {
                      setVisualPromptForCinematic(correspondingTurn.visualPrompt);
                  } else {
                      setVisualPromptForCinematic(undefined);
                  }
                  break;
              }
          }
      }
  }, [logs, multimodalTimeline]); // Added multimodalTimeline to dependencies

  // NEW: Render null until component is mounted to prevent hydration errors
  if (!mounted) {
    return null;
  }

  if (!sessionActive) {
    return (
        <>
            <GlobalStyles />
            <StartScreen onStart={(lite) => startSession(lite)} />
        </>
    );
  }

  return (
    <div className={`relative w-full h-screen ${THEME.colors.bg} ${THEME.colors.textMain} overflow-hidden selection:bg-[#78350f] selection:text-white font-serif animate-fade-in`}>
      <GlobalStyles />
      
      {/* 1. ATMOSPHERE LAYER */}
      <div className="scanline" />
      <GrainOverlay />
      <Vignette />
      <CinematicBars active={viewMode === 'CINEMATIC'} />

      {/* 2. WORLD RENDER LAYER (MediaPanel as Background) */}
      <div className={`absolute inset-0 z-0 flex items-center justify-center transition-all duration-1000 ${viewMode === 'ANALYTICAL' ? 'opacity-20 scale-[0.98] blur-sm grayscale' : 'opacity-100'}`}>
        <MediaPanel variant="background" className="w-full h-full object-cover" backgroundImageUrl={START_SCREEN_BACKGROUND_URL} />
      </div>

      {/* 3. ATMOSPHERIC DISTORTION (Glitch/Pulse effects based on trauma) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <DistortionLayer ledger={gameState.ledger}>
           {/* Passed children are just layout placeholders if needed, DistortionLayer handles the effects wrapper */}
           <div className="w-full h-full" /> 
        </DistortionLayer>
      </div>

      {/* 4. UI LAYER */}
      <div className="relative z-30 w-full h-full flex flex-col justify-between p-6 md:p-10 pointer-events-none">
        
        {/* HEADER */}
        <header className="flex justify-between items-start pointer-events-auto transition-transform duration-700 ease-out transform translate-y-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4 bg-black/60 backdrop-blur-md px-4 py-2 border border-[#292524] rounded-sm">
                <div className="p-1.5 border border-[#78350f]/40 rounded-sm bg-[#0c0a09]">
                   <Skull size={16} className="text-[#a8a29e]" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-sm md:text-base font-display tracking-[0.3em] text-[#e7e5e4] leading-none drop-shadow-md uppercase">
                    The Institute
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <MapPin size={8} className="text-[#78716c]" />
                        <span className="text-[9px] font-mono text-[#78716c] tracking-[0.2em] uppercase opacity-90">
                            {gameState.location}
                        </span>
                    </div>
                </div>
            </div>
          </div>

          <div className="flex gap-4 items-center bg-black/60 backdrop-blur-md px-3 py-2 border border-[#292524] rounded-sm">
             {/* Status Indicators */}
             <div className={`hidden md:flex items-center gap-4 transition-opacity duration-500 ${viewMode === 'CINEMATIC' ? 'opacity-0' : 'opacity-100'}`}>
                <div className="flex flex-col items-end border-r border-[#292524] pr-4">
                    <span className="font-mono text-[9px] text-[#57534e] uppercase tracking-wider flex items-center gap-1">
                        <Brain size={8} /> Cognitive Load
                    </span>
                    <span className={`font-mono text-[10px] ${isThinking ? 'text-[#b45309] animate-pulse' : 'text-[#78716c]'}`}>
                        {isThinking ? 'SYNTHESIZING...' : 'STABLE'}
                    </span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="font-mono text-[9px] text-[#57534e] uppercase tracking-wider flex items-center gap-1">
                        <Clock size={8} /> Cycle
                    </span>
                    <span className="font-mono text-[10px] text-[#78716c]">
                        TURN {gameState.turn.toString().padStart(3, '0')}
                    </span>
                </div>
             </div>

             <div className="h-6 w-px bg-[#44403c]/30 mx-2 hidden md:block" />

             {/* Window Controls */}
             <div className="flex gap-2">
                 <button 
                    onClick={() => { audioService?.playSfx && audioService.playSfx('hover'); setViewMode(viewMode === 'CINEMATIC' ? 'ANALYTICAL' : 'CINEMATIC'); }}
                    className={THEME.classes.iconBtn}
                    title={viewMode === 'CINEMATIC' ? "Open Analytical Interface" : "Enter Cinematic Mode"}
                 >
                   {viewMode === 'CINEMATIC' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                 </button>
                 <button 
                    className={`${THEME.classes.iconBtn} ${isDevOverlayOpen ? 'text-[#991b1b] border-[#991b1b]/30' : ''}`}
                    onClick={() => { audioService?.playSfx && audioService.playSfx('hover'); setDevOverlayOpen(!isDevOverlayOpen); }}
                    title="Toggle Developer Overlay"
                 >
                   <Terminal size={16} />
                 </button>
             </div>
          </div>
        </header>

        {/* CENTER CONTENT */}
        <main className="flex-1 flex items-center justify-center relative w-full pointer-events-none my-4">
           
           {/* CINEMATIC VIEW: Central Narrative Focus */}
           <div className={`absolute w-full transition-all duration-1000 transform ${viewMode === 'CINEMATIC' ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
             <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in pointer-events-auto cursor-default">
                
                {/* Text Container with dynamic sizing */}
                <div className="relative p-10 md:p-16">
                     <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0c0a09]/80 to-transparent pointer-events-none blur-3xl"></div>
                     
                     <div className="relative z-10 flex items-center justify-center gap-4 opacity-40 mb-8">
                        <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#78350f] to-transparent" />
                        <div className="w-1.5 h-1.5 rotate-45 border border-[#78350f]" />
                        <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#78350f] to-transparent" />
                    </div>

                    <p className="text-xl md:text-3xl leading-relaxed text-[#e7e5e4] font-serif drop-shadow-2xl line-clamp-[10] text-shadow-lg tracking-wide">
                        "{lastLogText}"
                    </p>
                    
                    {/* NEW: Visual Prompt Overlay */}
                    {visualPromptForCinematic && (
                        <div className="mt-8 relative z-10 max-w-lg mx-auto bg-black/30 backdrop-blur-sm px-4 py-2 rounded-sm border border-[#44403c]/40 animate-fade-in">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-[#78716c] block mb-1">Visual Protocol</span>
                            <p className="text-[10px] font-mono text-[#a8a29e] leading-tight italic opacity-80">
                                {visualPromptForCinematic.substring(0, 120)}...
                            </p>
                        </div>
                    )}

                    <div className="relative z-10 flex items-center justify-center gap-4 opacity-40 mt-8">
                        <Feather size={14} className="text-[#78350f]" />
                    </div>
                </div>

             </div>
           </div>

           {/* ANALYTICAL VIEW: Dashboard Overlay */}
           <div className={`absolute inset-0 py-2 flex gap-6 transition-all duration-1000 ease-in-out ${viewMode === 'ANALYTICAL' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
               
               {/* Left Panel: Psychometrics */}
               <AnalyticalPanel title="PSYCHOMETRIC_TOPOLOGY" side="left">
                    <div className="h-full flex flex-col gap-4">
                        <div className="flex-1 border border-[#44403c]/40 rounded-sm bg-black/20 p-1 relative overflow-hidden group hover:border-[#78350f]/30 transition-colors">
                             {/* Network Graph Container */}
                             <div className="absolute inset-0 opacity-80 hover:opacity-100 transition-opacity">
                                <NetworkGraph graphData={kgot} />
                             </div>
                        </div>
                        <div className="shrink-0">
                             <LedgerDisplay ledger={gameState.ledger} />
                        </div>
                    </div>
               </AnalyticalPanel>

               {/* Right Panel: Narrative & Agents */}
               <AnalyticalPanel title="NARRATIVE_LOGIC_GATE" side="right">
                    <div className="h-full flex flex-col gap-4">
                        <div className="flex-1 border border-[#44403c]/40 rounded-sm bg-black/20 overflow-hidden relative flex flex-col hover:border-[#78350f]/30 transition-colors">
                             <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-3">
                                <NarrativeLog 
                                    logs={logs} 
                                    thinking={false} 
                                    choices={[]} 
                                    onChoice={() => {}} 
                                    ledger={gameState.ledger} 
                                />
                             </div>
                        </div>
                        <div className="h-[25%] shrink-0 overflow-hidden flex gap-2">
                             <div className="flex-1 overflow-hidden">
                                <PrefectLeaderboard prefects={prefects} />
                             </div>
                             <div className="flex-1 overflow-hidden">
                                <SubjectPanel />
                             </div>
                        </div>
                    </div>
               </AnalyticalPanel>

           </div>

        </main>

        {/* FOOTER CONTROL DECK */}
        <footer className={`pointer-events-auto w-full transition-all duration-700 ease-out transform ${viewMode === 'CINEMATIC' ? 'translate-y-0 pb-8' : 'translate-y-0 pb-2'} relative z-40`}>
          <div className="max-w-3xl mx-auto">
              
              {/* CHOICE ENGINE CONTAINER */}
              <div className={`${THEME.colors.panel} ${THEME.classes.glass} border border-[#44403c]/50 p-4 md:p-5 rounded-md shadow-2xl relative transition-all duration-300 space-y-4`}>
                
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#78350f] opacity-50" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#78350f] opacity-50" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#78350f] opacity-50" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#78350f] opacity-50" />

                {/* Decorative brackets */}
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-12 w-1 border-l border-y border-[#44403c] rounded-l-sm opacity-60" />
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-12 w-1 border-r border-y border-[#44403c] rounded-r-sm opacity-60" />

                {isThinking ? (
                    <div className="h-32 flex flex-col items-center justify-center gap-3 text-[#a8a29e]">
                        <Loader2 className="animate-spin text-[#78350f]" size={24} />
                        <span className="font-mono text-[10px] tracking-[0.3em] uppercase animate-pulse">Synthesizing Narrative...</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {choices.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {choices.map((choice, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => { audioService?.playSfx && audioService.playSfx('click'); processPlayerTurn(choice); }}
                                        onMouseEnter={() => audioService?.playSfx && audioService.playSfx('hover')}
                                        className="group relative text-left px-5 py-4 bg-[#292524]/20 hover:bg-[#451a03]/30 border border-transparent hover:border-[#78350f]/60 rounded-sm transition-all duration-300 w-full h-full overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#78350f]/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
                                        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#78350f] opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="font-serif text-base md:text-lg text-[#d6d3d1] group-hover:text-white italic tracking-wide relative z-10">"{choice}"</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {/* Custom Action Input */}
                        <div className="relative group">
                            <input
                                type="text"
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                                placeholder="Assert your will..."
                                className="w-full bg-[#0a0a0a] border border-[#44403c]/40 rounded-sm py-3 pl-5 pr-12 text-[#e7e5e4] font-serif placeholder:text-[#57534e] placeholder:italic focus:outline-none focus:border-[#78350f]/60 focus:bg-[#1c1917] transition-all shadow-inner"
                            />
                            <button
                                onClick={handleCustomSubmit}
                                disabled={!customInput.trim()}
                                onMouseEnter={() => audioService?.playSfx && audioService.playSfx('hover')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#78716c] hover:text-[#e7e5e4] disabled:opacity-30 transition-colors hover:bg-[#292524] rounded-sm"
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                )}
             </div>

             {/* Footer Metadata */}
             <div className="flex justify-between items-center mt-6 px-4 opacity-50">
                <div className="flex gap-6">
                     <button className="hover:text-[#e7e5e4] transition-colors flex items-center gap-2" title="Archives" onMouseEnter={() => audioService?.playSfx && audioService.playSfx('hover')}>
                        <Database size={12} /> <span className="text-[9px] font-mono uppercase tracking-widest hidden md:inline">Archives</span>
                     </button>
                     <button className="hover:text-[#e7e5e4] transition-colors flex items-center gap-2" title="Codex" onMouseEnter={() => audioService?.playSfx && audioService.playSfx('hover')}>
                        <BookOpen size={12} /> <span className="text-[9px] font-mono uppercase tracking-widest hidden md:inline">Codex</span>
                     </button>
                </div>
                <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-[#57534e]">
                    Forge OS v.3.8 <span className="mx-2 text-[#78350f]">::</span> {isLiteMode ? 'LOCAL' : 'CLOUD'}
                </span>
             </div>
          </div>
        </footer>

      </div>

      {/* Dev Tools Overlay */}
      <DevOverlay /> 
    </div>
  );
}