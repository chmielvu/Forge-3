
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
    .scanline {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(to bottom, transparent 50%, rgba(30, 25, 20, 0.05) 51%);
      background-size: 100% 4px;
      pointer-events: none;
      z-index: 5;
    }

    .texture-paper {
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
    }
    
    .mask-image-gradient-top {
      mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
    }
  `}</style>
);

// --- THEME CONFIG ---
const THEME = {
  colors: {
    bg: "bg-[#0c0a09]",
    panel: "bg-[#1c1917]/90",
    border: "border-[#44403c]/40",
    accent: "text-[#991b1b]",
    textMain: "text-[#e7e5e4]",
    textMuted: "text-[#a8a29e]"
  },
  classes: {
    glass: "backdrop-blur-xl border shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5)]",
    iconBtn: "p-2 rounded-sm hover:bg-[#292524] transition-all duration-300 text-[#78716c] hover:text-[#d6d3d1] border border-transparent hover:border-[#57534e]",
  }
};

// --- CONSTANTS ---
const START_SCREEN_BACKGROUND_URL = "https://images.unsplash.com/photo-1544716278-ca5e3f4abd87?q=80&w=2938&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"; // Example Dark Academia library image

// --- ATMOSPHERIC COMPONENTS ---

const GrainOverlay = () => (
  <div className="absolute inset-0 pointer-events-none z-[2] opacity-[0.06] mix-blend-overlay texture-paper"></div>
);

const Vignette = () => (
  <div className="absolute inset-0 pointer-events-none z-[3] bg-[radial-gradient(circle_at_center,transparent_0%,rgba(12,10,9,0.5)_60%,#0c0a09_100%)]" />
);

const CinematicBars = ({ active }: { active: boolean }) => (
  <>
    <div className={`absolute top-0 left-0 right-0 bg-[#0c0a09] z-[20] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${active ? 'h-[10vh] border-b border-[#292524]' : 'h-0 border-0'}`} />
    <div className={`absolute bottom-0 left-0 right-0 bg-[#0c0a09] z-[20] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${active ? 'h-[10vh] border-t border-[#292524]' : 'h-0 border-0'}`} />
  </>
);

const AnalyticalPanel = ({ title, children, side }: { title: string, children?: React.ReactNode, side: 'left' | 'right' }) => (
  <div className={`
    flex-1 h-full ${THEME.colors.panel} ${THEME.classes.glass} ${THEME.colors.border} 
    flex flex-col relative overflow-hidden transition-all duration-700
    ${side === 'left' ? 'border-r-2 border-r-[#78350f]/20' : 'border-l-2 border-l-[#78350f]/20'}
  `}>
    <div className={`absolute top-0 ${side === 'left' ? 'left-0 border-l-2 border-t-2' : 'right-0 border-r-2 border-t-2'} w-4 h-4 border-[#b45309]/40`} />
    <div className="px-4 py-3 border-b border-[#44403c]/30 bg-[#0c0a09]/50 flex justify-between items-center">
      <span className="font-display text-[11px] tracking-[0.2em] uppercase text-[#a8a29e] flex items-center gap-2">
        {side === 'left' ? <Brain size={12} className="text-[#b45309]" /> : <Scroll size={12} className="text-[#b45309]" />}
        {title}
      </span>
      <div className="flex gap-1 opacity-50">
        <div className="w-1 h-1 bg-[#78350f] rounded-full" />
        <div className="w-1 h-1 bg-[#78350f] rounded-full" />
      </div>
    </div>
    <div className="p-4 flex-1 overflow-auto custom-scrollbar relative">
      {children}
    </div>
  </div>
);

// --- START SCREEN ---

const StartScreen = ({ onStart }: { onStart: (liteMode: boolean) => void }) => {
    const handleStart = (lite: boolean) => {
        audioService.playSfx('boot');
        onStart(lite);
    };

    return (
    <div className={`w-screen h-screen flex flex-col items-center justify-center ${THEME.colors.bg} ${THEME.colors.textMain} animate-fade-in font-serif overflow-hidden`}>
      
      {/* Background Layers */}
      <div className="absolute inset-0 z-0 opacity-80"> {/* Changed opacity-60 to opacity-80 */}
         <MediaPanel 
           variant="background" 
           className="w-full h-full object-cover grayscale contrast-125 sepia-[0.3]" 
           backgroundImageUrl={START_SCREEN_BACKGROUND_URL}
         />
      </div>
      <div className="scanline z-[1] opacity-10" />
      <GrainOverlay />
      <Vignette />
      
      {/* Content Container - Dark Academia Aesthetic */}
      <div className={`relative z-10 text-center max-w-xl w-full mx-auto px-8 py-20 bg-[#0f0e0d] shadow-2xl border-y border-[#292524]`}> {/* Re-added mx-auto */}
        
        {/* Inner Frame */}
        <div className="absolute top-4 bottom-4 left-4 right-4 border border-[#292524] pointer-events-none opacity-50 flex flex-col justify-between items-center py-2">
             <div className="w-1 h-1 bg-[#44403c] rounded-full" />
             <div className="w-1 h-1 bg-[#44403c] rounded-full" />
        </div>

        {/* Header Icon */}
        <div className="mb-10 opacity-90 relative z-20">
             <div className="flex items-center justify-center gap-4 text-[#78716c] mb-4">
                <div className="h-px w-8 bg-[#44403c]" />
                <BookOpen size={14} />
                <div className="h-px w-8 bg-[#44403c]" />
             </div>
             <Skull size={40} className="mx-auto text-[#d6d3d1]" strokeWidth={1} />
        </div>
        
        <h1 className="relative z-20 font-display text-6xl md:text-7xl tracking-[0.15em] uppercase text-[#e7e5e4] mb-4 drop-shadow-xl">
          The Forge
        </h1>
        
        <div className="relative z-20 flex items-center justify-center gap-3 mb-10 opacity-60">
            <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-[#a8a29e]">Department of Correction</span>
        </div>
        
        <p className="relative z-20 font-serif text-xl md:text-2xl text-[#a8a29e] italic mb-14 leading-relaxed max-w-sm mx-auto">
          "Chaos must be refined.<br/><span className="text-[#78716c] text-lg">Welcome to the calibration.</span>"
        </p>
  
        <div className="relative z-20 flex flex-col gap-4 justify-center items-center">
          <button 
            onClick={() => handleStart(false)}
            onMouseEnter={() => audioService.playSfx('hover')}
            className="group w-64 py-4 bg-[#1c1917] border border-[#292524] hover:border-[#b45309]/50 hover:bg-[#292524] transition-all duration-700 ease-out"
          >
            <div className="flex items-center justify-center gap-3">
              <Feather size={14} className="text-[#78716c] group-hover:text-[#b45309] transition-colors" />
              <span className="font-display text-xs tracking-[0.25em] uppercase text-[#d6d3d1] group-hover:text-[#e7e5e4] transition-colors">
                Begin Session
              </span>
            </div>
          </button>

          <button 
            onClick={() => handleStart(true)}
            onMouseEnter={() => audioService.playSfx('hover')}
            className="group w-64 py-3 bg-transparent border-b border-[#292524] hover:border-[#57534e] transition-all duration-500 ease-out"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#57534e] group-hover:text-[#78716c] transition-colors">
                Access Local Protocol
              </span>
            </div>
          </button>
        </div>

        <div className="relative z-20 mt-16 text-[9px] font-mono text-[#292524] uppercase tracking-widest">
            Vol. III • MMXXIV
        </div>
      </div>
    </div>
    );
};

// --- MAIN APPLICATION COMPONENT ---

export default function App() {
  const { 
    logs, 
    kgot, 
    gameState, 
    isThinking, 
    processPlayerTurn,
    choices,
    prefects,
    startSession,
    sessionActive,
    isLiteMode,
    isDevOverlayOpen,
    setDevOverlayOpen
  } = useGameStore();

  const [viewMode, setViewMode] = useState<'CINEMATIC' | 'ANALYTICAL'>('CINEMATIC');
  const [lastLogText, setLastLogText] = useState<string>("The system waits.");
  const [customInput, setCustomInput] = useState('');

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    audioService.playSfx('click');
    processPlayerTurn(customInput);
    setCustomInput('');
  };

  useEffect(() => {
      // Find the last substantial narrative log to display in Cinematic Mode
      if (logs.length > 0) {
          // Look backwards for the last narrative or psychosis log
          for (let i = logs.length - 1; i >= 0; i--) {
              const log = logs[i];
              if ((log.type === 'narrative' || log.type === 'psychosis') && log.content.length > 20) {
                  setLastLogText(log.content.replace(/<[^>]*>?/gm, '')); // Strip HTML tags for the overlay text
                  break;
              }
          }
      }
  }, [logs]);

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
        <MediaPanel variant="background" className="w-full h-full object-cover" />
      </div>

      {/* 3. ATMOSPHERIC DISTORTION (Glitch/Pulse effects based on trauma) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <DistortionLayer ledger={gameState.ledger}>
           {/* Passed children are just layout placeholders if needed, DistortionLayer handles the effects wrapper */}
           <div className="w-full h-full" /> 
        </DistortionLayer>
      </div>

      {/* 4. UI LAYER */}
      <div className="relative z-30 w-full h-full flex flex-col justify-between p-4 md:p-8 pointer-events-none">
        
        {/* HEADER */}
        <header className="flex justify-between items-start pointer-events-auto mt-2 md:mt-0 transition-transform duration-700 ease-out transform translate-y-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <div className="p-1.5 border border-[#78350f]/40 rounded-sm bg-[#0c0a09]/80 backdrop-blur-md">
                   <Skull size={16} className="text-[#a8a29e]" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-lg md:text-xl font-display tracking-[0.25em] text-[#e7e5e4] leading-none drop-shadow-md">
                    THE INSTITUTE
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-amber-500 animate-pulse' : 'bg-[#991b1b]'}`}></span>
                        <span className="text-[9px] font-mono text-[#78716c] tracking-[0.2em] uppercase opacity-90">
                            {gameState.location} // Turn {gameState.turn}
                        </span>
                    </div>
                </div>
            </div>
          </div>

          <div className="flex gap-4 items-center">
             {/* Status Indicators */}
             <div className={`hidden md:flex items-center gap-4 transition-opacity duration-500 ${viewMode === 'CINEMATIC' ? 'opacity-0' : 'opacity-100'}`}>
                <div className="flex flex-col items-end">
                    <span className="font-mono text-[9px] text-[#78716c] uppercase tracking-wider">Cognitive Load</span>
                    <span className={`font-mono text-[10px] ${isThinking ? 'text-[#b45309] animate-pulse' : 'text-[#57534e]'}`}>
                        {isThinking ? 'SYNTHESIZING...' : 'STABLE'}
                    </span>
                </div>
             </div>

             <div className="h-6 w-px bg-[#44403c]/30 mx-2 hidden md:block" />

             {/* Window Controls */}
             <div className="flex gap-2">
                 <button 
                    onClick={() => { audioService.playSfx('hover'); setViewMode(viewMode === 'CINEMATIC' ? 'ANALYTICAL' : 'CINEMATIC'); }}
                    className={THEME.classes.iconBtn + " bg-[#0c0a09]/80 backdrop-blur-sm"}
                    title="Toggle View Mode"
                 >
                   {viewMode === 'CINEMATIC' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                 </button>
                 <button 
                    className={`${THEME.classes.iconBtn} bg-[#0c0a09]/80 backdrop-blur-sm ${isDevOverlayOpen ? 'text-[#991b1b] border-[#991b1b]/30' : ''}`}
                    onClick={() => { audioService.playSfx('hover'); setDevOverlayOpen(!isDevOverlayOpen); }}
                    title="Toggle Developer Overlay"
                 >
                   <Terminal size={16} />
                 </button>
             </div>
          </div>
        </header>

        {/* CENTER CONTENT */}
        <main className="flex-1 flex items-center justify-center relative w-full pointer-events-none">
           
           {/* CINEMATIC VIEW: Central Narrative Focus */}
           <div className={`absolute w-full transition-all duration-1000 transform ${viewMode === 'CINEMATIC' ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
             <div className="max-w-3xl mx-auto text-center space-y-8 animate-fade-in pointer-events-auto cursor-default">
                
                {/* Text Container with dynamic sizing */}
                <div className="relative p-8 md:p-12">
                     <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0c0a09]/60 to-transparent pointer-events-none blur-3xl"></div>
                     
                     <div className="relative z-10 flex items-center justify-center gap-4 opacity-40 mb-6">
                        <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#78350f] to-transparent" />
                        <div className="w-1.5 h-1.5 rotate-45 border border-[#78350f]" />
                        <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#78350f] to-transparent" />
                    </div>

                    <p className="text-xl md:text-2xl leading-relaxed text-[#e7e5e4] font-serif drop-shadow-2xl line-clamp-[8] text-shadow-lg">
                        "{lastLogText}"
                    </p>

                    <div className="relative z-10 flex items-center justify-center gap-4 opacity-40 mt-6">
                        <Feather size={12} className="text-[#78350f]" />
                    </div>
                </div>

             </div>
           </div>

           {/* ANALYTICAL VIEW: Dashboard Overlay */}
           <div className={`absolute inset-0 md:px-12 py-4 flex gap-6 transition-all duration-1000 ease-in-out ${viewMode === 'ANALYTICAL' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
               
               {/* Left Panel: Psychometrics */}
               <AnalyticalPanel title="PSYCHOMETRIC_TOPOLOGY" side="left">
                    <div className="h-full flex flex-col gap-4">
                        <div className="flex-1 border border-[#44403c]/40 rounded-sm bg-[#0c0a09]/40 p-1 relative overflow-hidden group">
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
                        <div className="flex-1 border border-[#44403c]/40 rounded-sm bg-[#0c0a09]/40 overflow-hidden relative flex flex-col">
                             <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2">
                                <NarrativeLog 
                                    logs={logs} 
                                    thinking={false} 
                                    choices={[]} 
                                    onChoice={() => {}} 
                                    ledger={gameState.ledger} 
                                />
                             </div>
                        </div>
                        <div className="h-[30%] shrink-0 overflow-hidden flex gap-2">
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
        <footer className={`pointer-events-auto w-full transition-all duration-700 ease-out transform ${viewMode === 'CINEMATIC' ? 'translate-y-0 pb-6' : 'translate-y-0 pb-2'} relative z-40`}>
          <div className="max-w-3xl mx-auto">
              
              {/* CHOICE ENGINE CONTAINER */}
              <div className={`${THEME.colors.panel} ${THEME.classes.glass} border border-[#44403c]/50 p-2 md:p-3 rounded-md shadow-2xl relative transition-all duration-300 space-y-3`}>
                
                {/* Decorative brackets */}
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-8 w-1 border-l border-y border-[#44403c] rounded-l-sm opacity-60" />
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-8 w-1 border-r border-y border-[#44403c] rounded-r-sm opacity-60" />

                {isThinking ? (
                    <div className="h-24 flex flex-col items-center justify-center gap-2 text-[#a8a29e]">
                        <Loader2 className="animate-spin text-[#78350f]" size={20} />
                        <span className="font-mono text-[9px] tracking-[0.3em] uppercase">Synthesizing Narrative...</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {choices.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {choices.map((choice, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => { audioService.playSfx('click'); processPlayerTurn(choice); }}
                                        onMouseEnter={() => audioService.playSfx('hover')}
                                        className="group relative text-left px-4 py-3 bg-[#292524]/40 hover:bg-[#451a03]/20 border border-transparent hover:border-[#78350f]/40 rounded-sm transition-all duration-300"
                                    >
                                        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#78350f] opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="font-serif text-sm md:text-base text-[#d6d3d1] group-hover:text-white italic">"{choice}"</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {/* Custom Action Input */}
                        <div className="relative">
                            <input
                                type="text"
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                                placeholder="Or act on your own will..."
                                className="w-full bg-[#0c0a09]/40 border border-[#44403c]/40 rounded-sm py-3 pl-4 pr-12 text-[#e7e5e4] font-serif placeholder:text-[#57534e] placeholder:italic focus:outline-none focus:border-[#78350f]/60 focus:bg-[#0c0a09]/60 transition-all shadow-inner"
                            />
                            <button
                                onClick={handleCustomSubmit}
                                disabled={!customInput.trim()}
                                onMouseEnter={() => audioService.playSfx('hover')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#78716c] hover:text-[#e7e5e4] disabled:opacity-30 transition-colors"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                )}
             </div>

             {/* Footer Metadata */}
             <div className="flex justify-between items-center mt-4 px-2 opacity-40">
                <div className="flex gap-4">
                     <button className="hover:text-[#e7e5e4] transition-colors" title="Archives" onMouseEnter={() => audioService.playSfx('hover')}><Database size={12} /></button>
                     <button className="hover:text-[#e7e5e4] transition-colors" title="Codex" onMouseEnter={() => audioService.playSfx('hover')}><BookOpen size={12} /></button>
                </div>
                <span className="font-mono text-[8px] tracking-[0.4em] uppercase text-[#57534e]">
                    Forge OS v.3.7 <span className="mx-2 text-[#78350f]">::</span> {isLiteMode ? 'LOCAL' : 'CLOUD'}
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
