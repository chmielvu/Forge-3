import React from 'react';
import { THEME } from '../theme';

interface StartScreenProps {
  onStart: (isLite: boolean) => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className={`relative flex flex-col items-center justify-center w-full max-w-lg p-10 border border-[#292524] bg-[#0c0a09]/95 backdrop-blur-xl shadow-[0_0_100px_-30px_rgba(127,29,29,0.4)] z-30 ${THEME.colors.textMain}`}>
      
      {/* Decorative Top Border */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-[#7f1d1d] shadow-[0_0_15px_#7f1d1d]"></div>

      {/* Title Section */}
      <div className="mb-14 text-center space-y-4">
          <h2 className="text-xs uppercase tracking-[0.4em] text-[#a8a29e] opacity-60 font-mono">Simulated Reality Engine</h2>
          <h1 className="text-6xl md:text-7xl font-serif tracking-[0.1em] text-[#e7e5e4] text-shadow-glow">
            THE FORGE
          </h1>
          <div className="flex items-center justify-center gap-4 opacity-50">
             <div className="h-px w-12 bg-[#7f1d1d]"></div>
             <span className="text-[10px] uppercase tracking-widest text-[#7f1d1d]">Protocol v4.1</span>
             <div className="h-px w-12 bg-[#7f1d1d]"></div>
          </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-6 w-full max-w-xs relative z-10">
          <button 
            onClick={() => onStart(false)}
            className="group relative w-full px-8 py-5 border border-[#7f1d1d]/40 hover:border-[#7f1d1d] bg-[#1c1917]/50 hover:bg-[#292524] transition-all duration-500 overflow-hidden"
          >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#7f1d1d]/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
              <span className="relative z-10 flex flex-col items-center">
                  <span className="uppercase tracking-[0.25em] text-sm font-bold text-[#e7e5e4] group-hover:text-white transition-colors">Enter The Loom</span>
                  <span className="text-[10px] text-[#a8a29e] mt-1 font-mono tracking-wider opacity-60">Full Multimodal Experience</span>
              </span>
          </button>

          <button 
            onClick={() => onStart(true)}
            className="group relative w-full px-8 py-4 border border-[#292524] hover:border-[#a8a29e]/30 hover:bg-[#292524]/30 transition-all duration-500"
          >
              <span className="flex flex-col items-center">
                  <span className="uppercase tracking-[0.15em] text-xs text-[#a8a29e] group-hover:text-[#e7e5e4] transition-colors">Lite Mode</span>
                  <span className="text-[9px] text-[#57534e] mt-1">Text-Only Fallback</span>
              </span>
          </button>
      </div>

      {/* Warning Text */}
      <div className="mt-12 text-center max-w-xs">
        <p className="text-[10px] text-[#7f1d1d]/60 font-mono leading-relaxed">
          WARNING: This simulation contains psychological horror, themes of domination, and ontologically destabilizing content. 
          <br/>Observer discretion is mandatory.
        </p>
      </div>

      {/* Ornamental Corners */}
      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#7f1d1d]/40"></div>
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#7f1d1d]/40"></div>
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#7f1d1d]/40"></div>
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#7f1d1d]/40"></div>
    </div>
  );
}