
import * as React from 'react';
import { PrefectDNA } from '../types';
import { Trophy, Skull, Crown, Activity } from 'lucide-react';
import { THEME } from '../theme';

interface Props {
  prefects: PrefectDNA[];
}

export default function PrefectLeaderboard({ prefects }: Props) {
  // Sort by favor score descending
  const sorted = [...prefects].sort((a, b) => b.favorScore - a.favorScore);

  if (prefects.length === 0) {
    return (
      <div className="bg-black/60 border border-[#292524] rounded-sm overflow-hidden flex flex-col h-full items-center justify-center text-[#a8a29e] text-[10px] font-mono uppercase tracking-widest" role="status" aria-live="polite"> {/* Charcoal border, muted gold/gray text */}
        NO PREFECT DATA
      </div>
    );
  }

  return (
    <div className="bg-black/60 border border-[#292524] rounded-sm overflow-hidden flex flex-col h-full" role="table" aria-label="TA Competition Rankings"> {/* Charcoal border */}
      <div className="p-3 border-b border-[#292524] flex justify-between items-center bg-black/80"> {/* Charcoal border */}
        <h3 className="font-mono text-[10px] text-[#a8a29e] uppercase tracking-widest flex items-center gap-2"> {/* Muted gold/gray text */}
          <Trophy size={12} className={THEME.colors.accentGold} aria-hidden="true" /> {/* Muted gold trophy */}
          TA Competition Rankings
        </h3>
        <span className="text-[9px] text-[#a8a29e]/70">LIVE FEED</span> {/* Muted gold/gray */}
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2" role="rowgroup">
        {sorted.map((prefect, idx) => {
            const isTop = idx === 0;
            const isDanger = prefect.favorScore < 30;
            
            return (
                <div key={prefect.id} className={`
                    relative p-2 rounded-sm border transition-all duration-300
                    ${isTop ? 'bg-[#991b1b]/10 border-[#991b1b]/30' : 'bg-[#1c1917]/40 border-[#292524]'} /* Burgundy for top, charcoal for others */
                    ${isDanger ? 'border-[#7f1d1d]/30' : ''} /* Burgundy for danger */
                `} role="row">
                    <div className="flex justify-between items-center mb-1" role="gridcell">
                        <div className="flex items-center gap-2">
                            {isTop && <Crown size={10} className={THEME.colors.accentGold} aria-label="Top Prefect" />} {/* Muted gold crown */}
                            <span className={`font-display tracking-wide text-sm ${isTop ? THEME.colors.accentGold : THEME.colors.textMain}`}> {/* Muted gold for top, muted white for others */}
                                {prefect.displayName}
                            </span>
                        </div>
                        <span className="font-mono text-xs text-[#a8a29e]" aria-label={`Favor score: ${prefect.favorScore} percent`}>{prefect.favorScore}%</span> {/* Muted gold/gray */}
                    </div>
                    
                    <div className="flex justify-between items-end" role="gridcell">
                        <span className="text-[10px] text-[#a8a29e]/80 italic truncate max-w-[120px]"> {/* Muted gold/gray */}
                            {prefect.archetype}
                        </span>
                        
                        {/* Status Indicators based on traits */}
                        <div className="flex gap-1" aria-label="Prefect traits">
                            {prefect.traitVector.cruelty > 0.7 && (
                                <div title="High Cruelty" aria-label="High Cruelty">
                                    <Skull size={10} className="text-[#7f1d1d]" aria-hidden="true" /> {/* Burgundy skull */}
                                </div>
                            )}
                            {prefect.traitVector.cunning > 0.7 && (
                                <div title="High Cunning" aria-label="High Cunning">
                                    <Activity size={10} className="text-[#064e3b]" aria-hidden="true" /> {/* Deep emerald */}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1c1917]" role="progressbar" aria-valuenow={prefect.favorScore} aria-valuemin={0} aria-valuemax={100} aria-label={`Favor score progress for ${prefect.displayName}`}> {/* Dark charcoal background */}
                        <div 
                            className={`h-full ${isTop ? THEME.colors.accentGold : THEME.colors.accentBurgundy} transition-all duration-1000`} /* Muted gold for top, burgundy for others */
                            style={{ width: `${prefect.favorScore}%` }}
                            aria-hidden="true"
                        />
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}