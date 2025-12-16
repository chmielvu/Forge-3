
'use client';

import * as React from 'react';
import { Feather, Skull, Database } from 'lucide-react';
import { audioService } from '../services/AudioService';
import { THEME, DARK_ACADEMIA_GRID_TEXTURE_URL } from '../theme';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning'; 

interface StartScreenProps {
  onStart: (liteMode: boolean) => void;
}

// FIX: Refactor to standard functional component syntax with explicit React.FC type
const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const handleStart = (lite: boolean) => {
    audioService.playSfx('boot'); // Direct call
    if (lite) {
      BEHAVIOR_CONFIG.TEST_MODE = true; // Set TEST_MODE when Lite mode is selected
      console.log("[StartScreen] TEST_MODE enabled: Web Workers disabled.");
    } else {
      BEHAVIOR_CONFIG.TEST_MODE = false; // Ensure TEST_MODE is false for full experience
    }
    onStart(lite);
  };

  return (
    <div className={`relative w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1c1917] to-[#0c0a09] ${THEME.colors.textMain} animate-fade-in font-serif overflow-hidden`}> {/* Dark charcoal gradient */}
      {/* 1. ATMOSPHERE: Warm Dark Academia Gradient with subtle texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#292524]/90 via-[#0c0a09]/90 to-black opacity-90 z-0" /> {/* Charcoal to deep black */}
      {/* NEW: Use local SVG data URL for background texture */}
      <div className={`absolute inset-0 bg-[url('${DARK_ACADEMIA_GRID_TEXTURE_URL}')] opacity-15 z-0 mix-blend-overlay`} /> 
      {/* Institutional grid pattern - updated to charcoal */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(41,37,36,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(41,37,36,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-10 z-0"></div>

      {/* Content Container - Centered Card/Plaque */}
      <div className={`relative z-20 flex flex-col items-center text-center justify-center p-20 border border-[#44403c]/70 bg-black/50 backdrop-blur-md shadow-2xl shadow-[0_0_50px_rgba(127,29,29,0.2)] max-w-2xl w-full mx-auto`}> {/* Burgundy shadow */}
        
        {/* Decorative Corners - More prominent, burgundy/emerald */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-[#991b1b]/80 opacity-60" aria-hidden="true" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#065f46]/80 opacity-60" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-[#064e3b]/80 opacity-60" aria-hidden="true" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-[#7f1d1d]/80 opacity-60" aria-hidden="true" />

        {/* Header Icon */}
        <div className="opacity-90 relative z-30 animate-fade-in mb-10 flex flex-col items-center">
             <div className="flex items-center justify-center gap-5 text-[#a8a29e] mb-8" aria-hidden="true"> {/* Muted gold/gray */}
                <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-[#991b1b]/60 to-transparent" /> {/* Burgundy */}
                <div className="h-0.5 w-12 bg-gradient-to-l from-transparent via-[#065f46]/60 to-transparent" /> {/* Emerald */}
             </div>
             <Skull size={80} className={`mx-auto ${THEME.colors.textMain} drop-shadow-[0_0_25px_rgba(231,229,228,0.15)] animate-pulse-slow`} strokeWidth={0.8} aria-hidden="true" />
        </div>
        
        <div className="flex flex-col items-center gap-5 mb-12 text-center w-full">
            <h1 className={`relative z-30 font-display text-7xl md:text-9xl tracking-[0.4em] uppercase ${THEME.colors.textMain} drop-shadow-2xl text-shadow-glow mx-auto`}>
            The Forge
            </h1>
            
            <div className="relative z-30 flex items-center justify-center gap-4 opacity-90 mt-2 mx-auto">
                <span className={`font-mono text-sm tracking-[0.6em] uppercase ${THEME.colors.textMuted}`}>Department of Correction</span>
            </div>
        </div>
        
        <p className={`relative z-30 font-serif text-2xl md:text-3xl ${THEME.colors.textMain} italic leading-relaxed max-w-lg mx-auto drop-shadow-lg text-center mb-14 opacity-80`}>
          "Chaos must be refined."
        </p>
  
        {/* Centered Action Stack */}
        <div className="relative z-30 flex flex-col gap-5 justify-center items-center w-full max-w-xs mx-auto">
          
          <button 
            onClick={() => handleStart(false)}
            onMouseEnter={() => audioService.playSfx('hover')} // Direct call
            className="group relative w-full py-5 bg-[#1c1917]/80 backdrop-blur-md border border-[#44403c] hover:border-[#991b1b] hover:bg-[#292524] transition-all duration-500 ease-out cursor-pointer overflow-hidden shadow-lg rounded-sm text-center"
            aria-label="Begin new game session"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#991b1b]/15 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" aria-hidden="true" />
            <div className="flex items-center justify-center gap-3 relative z-10 w-full">
              <Feather size={20} className={`${THEME.colors.textMuted} group-hover:${THEME.colors.accentGold} transition-colors`} aria-hidden="true" />
              <span className={`font-display text-lg tracking-[0.3em] uppercase ${THEME.colors.textMain} group-hover:text-white transition-colors`}>
                Begin Transmission
              </span>
            </div>
          </button>
          
          <button 
            onClick={() => handleStart(true)}
            onMouseEnter={() => audioService.playSfx('hover')} // Direct call
            className="group relative w-full py-4 bg-[#0a0a0a]/60 backdrop-blur-md border border-[#292524] hover:border-[#065f46] hover:bg-[#1c1917] transition-all duration-300 ease-out cursor-pointer overflow-hidden rounded-sm text-center"
            aria-label="Begin session in Lite Mode (local processing)"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#065f46]/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" aria-hidden="true" />
            <div className="flex items-center justify-center gap-2 relative z-10 w-full">
              <Database size={16} className={`${THEME.colors.textMuted} group-hover:${THEME.colors.accent} transition-colors`} aria-hidden="true" />
              <span className={`font-mono text-sm tracking-widest uppercase ${THEME.colors.textMuted} group-hover:${THEME.colors.textMain} transition-colors`}>
                Begin [LOCAL] Debug
              </span>
            </div>
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default StartScreen;