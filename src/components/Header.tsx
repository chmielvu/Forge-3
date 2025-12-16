
'use client';

import * as React from 'react';
import { Brain, Clock, MapPin, Skull, Terminal } from 'lucide-react';
import { useGameStore } from '../state/gameStore';
import { audioService } from '../services/AudioService';
import { THEME } from '../theme';

const Header: React.FC = () => {
  const { gameState, isThinking, isDevOverlayOpen, setDevOverlayOpen } = useGameStore();

  return (
    <header className="flex justify-between items-start pointer-events-auto bg-black/60 backdrop-blur-md px-4 py-3 border border-[#292524] rounded-sm mb-6 shadow-xl">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="p-1.5 border border-[#7f1d1d]/40 rounded-sm bg-[#0c0a09]"> {/* Burgundy border */}
            <Skull size={16} className={THEME.colors.accentGold} aria-hidden="true" /> {/* Muted gold skull */}
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm md:text-base font-display tracking-[0.3em] text-[#e7e5e4] leading-none drop-shadow-md uppercase">
              The Institute
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <MapPin size={8} className={THEME.colors.textMuted} aria-hidden="true" />
              <span className="text-[9px] font-mono text-[#a8a29e] tracking-[0.2em] uppercase opacity-90"> {/* Muted gold/gray */}
                {gameState.location}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {/* Status Indicators */}
        <div className="flex flex-col items-end border-r border-[#292524] pr-4">
          <span className="font-mono text-[9px] text-[#a8a29e] uppercase tracking-wider flex items-center gap-1">
            <Brain size={8} aria-hidden="true" /> Cognitive Load
          </span>
          <span className="font-mono text-[10px] text-[#a8a29e]">
            {isThinking ? 'SYNTHESIZING...' : 'STABLE'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-[9px] text-[#a8a29e] uppercase tracking-wider flex items-center gap-1">
            <Clock size={8} aria-hidden="true" /> Cycle
          </span>
          <span className="font-mono text-[10px] text-[#a8a29e]">
            TURN {gameState.turn.toString().padStart(3, '0')}
          </span>
        </div>

        <div className="h-6 w-px bg-[#44403c]/30 mx-2 hidden md:block" aria-hidden="true" />

        {/* Window Controls - Only Dev Overlay now */}
        <div className="flex gap-2">
          <button
            className={`${THEME.classes.iconBtn} ${isDevOverlayOpen ? 'text-[#991b1b] border-[#991b1b]/30' : ''}`} {/* Burgundy accent */}
            onClick={() => { audioService.playSfx('hover'); setDevOverlayOpen(!isDevOverlayOpen); }} // Direct call
            title="Toggle Developer Overlay"
            aria-label="Toggle Developer Overlay"
          >
            <Terminal size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;