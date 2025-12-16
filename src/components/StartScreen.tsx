import React from 'react';
import { THEME } from '../theme';

interface StartScreenProps {
  onStart: (isLite: boolean) => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className={`flex flex-col items-center justify-center h-full z-10 ${THEME.colors.textMain}`}>
      <h1 className="text-6xl font-serif mb-8 tracking-widest text-shadow-glow">THE FORGE</h1>
      <div className="flex gap-4">
        <button 
          onClick={() => onStart(false)}
          className="px-8 py-3 border border-[#7f1d1d] hover:bg-[#7f1d1d] transition-all duration-500 uppercase tracking-widest text-sm"
        >
          Enter Simulation (Full)
        </button>
        <button 
          onClick={() => onStart(true)}
          className="px-8 py-3 border border-[#44403c] hover:bg-[#44403c] transition-all duration-500 uppercase tracking-widest text-sm text-[#a8a29e]"
        >
          Lite Mode
        </button>
      </div>
    </div>
  );
}