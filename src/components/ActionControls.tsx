
'use client';

import * as React from 'react';
import { Loader2, Send, Database, BookOpen } from 'lucide-react';
import { useGameStore } from '../state/gameStore';
import { audioService } from '../services/AudioService';
import { THEME } from '../theme';

interface ActionControlsProps {}

const ActionControls: React.FC<ActionControlsProps> = () => {
  const { isThinking, choices, processPlayerTurn, isLiteMode } = useGameStore();
  const [customInput, setCustomInput] = React.useState('');

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    audioService.playSfx('click'); // Direct call
    processPlayerTurn(customInput);
    setCustomInput('');
  };

  return (
    <footer className="pointer-events-auto w-full relative z-40 bg-black/70 backdrop-blur-md border-t border-[#292524] p-4 md:p-6 shadow-2xl">
      <div className="max-w-4xl mx-auto">
        {/* CHOICE ENGINE CONTAINER */}
        <div className={`${THEME.colors.panel} ${THEME.classes.glass} border border-[#44403c]/50 p-4 md:p-5 rounded-md shadow-2xl relative transition-all duration-300 space-y-4`}>
          {/* Corner Accents - Burgundy */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#991b1b] opacity-50" aria-hidden="true" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#991b1b] opacity-50" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#7f1d1d] opacity-50" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#7f1d1d] opacity-50" aria-hidden="true" />

          {/* Decorative brackets - Charcoal */}
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-12 w-1 border-l border-y border-[#44403c] rounded-l-sm opacity-60" aria-hidden="true" />
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-12 w-1 border-r border-y border-[#44403c] rounded-r-sm opacity-60" aria-hidden="true" />

          {isThinking ? (
            <div className="h-32 flex flex-col items-center justify-center gap-3 text-[#a8a29e]" role="status" aria-live="polite">
              <Loader2 className={`animate-spin ${THEME.colors.accent}`} size={24} /> {/* Emerald green loader */}
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase animate-pulse">Synthesizing Narrative...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {choices.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="group" aria-label="Narrative choices">
                  {choices.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => { 
                        audioService.playSfx('click'); // Direct call
                        if (typeof choice === 'string') { // Explicitly check type
                          processPlayerTurn(choice);
                        }
                      }}
                      onMouseEnter={() => audioService.playSfx('hover')} // Direct call
                      className="group relative text-left px-5 py-4 bg-[#292524]/20 hover:bg-[#451a03]/30 border border-transparent hover:border-[#7f1d1d]/60 rounded-sm transition-all duration-300 w-full h-full overflow-hidden"
                      aria-label={`Choose: ${choice}`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#7f1d1d]/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" aria-hidden="true" />
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#991b1b] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" /> {/* Burgundy highlight */}
                      <span className="font-serif text-base md:text-lg text-[#d6d3d1] group-hover:text-white italic tracking-wide relative z-10">"{choice}"</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Custom Action Input */}
              <div className="relative group">
                <label htmlFor="custom-input" className="sr-only">Assert your will</label>
                <input
                  id="custom-input"
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                  placeholder="Assert your will..."
                  className="w-full bg-[#0a0a0a] border border-[#44403c]/40 rounded-sm py-3 pl-5 pr-12 text-[#e7e5e4] font-serif placeholder:text-[#57534e] placeholder:italic focus:outline-none focus:border-[#065f46]/60 focus:bg-[#1c1917] transition-all shadow-inner" {/* Emerald focus border */}
                  aria-label="Custom action input"
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customInput.trim()}
                  onMouseEnter={() => audioService.playSfx('hover')} // Direct call
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#a8a29e] hover:text-[#e7e5e4] disabled:opacity-30 transition-colors hover:bg-[#292524] rounded-sm"
                  aria-label="Send custom action"
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
            <button className="hover:text-[#e7e5e4] transition-colors flex items-center gap-2" title="Archives" 
            onMouseEnter={() => audioService.playSfx('hover')} // Direct call
            aria-label="View archives">
              <Database size={12} aria-hidden="true" /> <span className="text-[9px] font-mono uppercase tracking-widest hidden md:inline">Archives</span>
            </button>
            <button className="hover:text-[#e7e5e4] transition-colors flex items-center gap-2" title="Codex" 
            onMouseEnter={() => audioService.playSfx('hover')} // Direct call
            aria-label="View codex">
              <BookOpen size={12} aria-hidden="true" /> <span className="text-[9px] font-mono uppercase tracking-widest hidden md:inline">Codex</span>
            </button>
          </div>
          <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-[#a8a29e]"> {/* Muted gold/gray */}
            Forge OS v.3.8 <span className="mx-2 text-[#991b1b]" aria-hidden="true">::</span> {isLiteMode ? 'LOCAL' : 'CLOUD'} {/* Burgundy separator */}
          </span>
        </div>
      </div>
    </footer>
  );
};

export default ActionControls;