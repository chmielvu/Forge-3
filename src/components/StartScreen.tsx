import React from 'react';
import { THEME } from '../theme';

interface StartScreenProps {
  onStart: (isLite: boolean) => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 ${THEME.colors.textMain} p-4`}>
      {/* Main Container Card */}
      <div className="relative flex flex-col items-center w-full max-w-lg p-12 border border-[#292524] bg-black/40 backdrop-blur-md shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
        
        {/* Title Section */}
        <div className="mb-12 text-center">
            <h1 className="text-5xl md:text-6xl font-serif tracking-[0.15em] text-shadow-glow text-[#e7e5e4] mb-2">
            THE FORGE
            </h1>
            <div className="h-px w-24 bg-[#7f1d1d] mx-auto opacity-50 shadow-[0_0_10px_#7f1d1d]"></div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-5 w-full max-w-xs">
            <button 
            onClick={() => onStart(false)}
            className="group relative px-8 py-4 border border-[#7f1d1d]/50 hover:border-[#7f1d1d] bg-[#0c0a09] transition-all duration-500 overflow-hidden"
            >
                <div className="absolute inset-0 bg-[#7f1d1d] opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>
                <span className="relative z-10 flex flex-col items-center">
                    <span className="uppercase tracking-[0.2em] text-sm font-semibold text-[#e7e5e4] group-hover:text-white transition-colors">Enter Simulation</span>
                    <span className="text-[10px] text-[#a8a29e] mt-1 font-mono tracking-wider opacity-60 group-hover:opacity-100">Full Experience</span>
                </span>
            </button>

            <button 
            onClick={() => onStart(true)}
            className="group relative px-8 py-3 border border-[#292524] hover:border-[#a8a29e]/50 hover:bg-[#292524]/30 transition-all duration-500"
            >
                <span className="flex flex-col items-center">
                    <span className="uppercase tracking-[0.15em] text-xs text-[#a8a29e] group-hover:text-[#e7e5e4] transition-colors">Lite Mode</span>
                </span>
            </button>
        </div>

        {/* Ornamental Corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-[#7f1d1d]/60"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[#7f1d1d]/60"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-[#7f1d1d]/60"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-[#7f1d1d]/60"></div>
      </div>
    </div>
  );
}