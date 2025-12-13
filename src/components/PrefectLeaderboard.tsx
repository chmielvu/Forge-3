import React from 'react';
import { PrefectDNA } from '../types';
import { Trophy, Skull, Crown, Activity } from 'lucide-react';

interface Props {
  prefects: PrefectDNA[];
}

export default function PrefectLeaderboard({ prefects }: Props) {
  // Sort by favor score descending
  const sorted = [...prefects].sort((a, b) => b.favorScore - a.favorScore);

  return (
    <div className="bg-black/60 border border-zinc-800 rounded-sm overflow-hidden flex flex-col h-full">
      <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-black/80">
        <h3 className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <Trophy size={12} className="text-forge-gold" />
          TA Competition Rankings
        </h3>
        <span className="text-[9px] text-zinc-600">LIVE FEED</span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {sorted.map((prefect, idx) => {
            const isTop = idx === 0;
            const isDanger = prefect.favorScore < 30;
            
            return (
                <div key={prefect.id} className={`
                    relative p-2 rounded-sm border transition-all duration-300
                    ${isTop ? 'bg-amber-950/10 border-amber-900/30' : 'bg-zinc-900/40 border-zinc-800'}
                    ${isDanger ? 'border-red-900/30' : ''}
                `}>
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            {isTop && <Crown size={10} className="text-amber-500" />}
                            <span className={`font-display tracking-wide text-sm ${isTop ? 'text-amber-200' : 'text-zinc-300'}`}>
                                {prefect.displayName}
                            </span>
                        </div>
                        <span className="font-mono text-xs text-zinc-500">{prefect.favorScore}%</span>
                    </div>
                    
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] text-zinc-500 italic truncate max-w-[120px]">
                            {prefect.archetype}
                        </span>
                        
                        {/* Status Indicators based on traits */}
                        <div className="flex gap-1">
                            {prefect.traitVector.cruelty > 0.7 && (
                                <div title="High Cruelty">
                                    <Skull size={10} className="text-red-900" />
                                </div>
                            )}
                            {prefect.traitVector.cunning > 0.7 && (
                                <div title="High Cunning">
                                    <Activity size={10} className="text-blue-900" />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900">
                        <div 
                            className={`h-full ${isTop ? 'bg-amber-600' : 'bg-zinc-600'} transition-all duration-1000`}
                            style={{ width: `${prefect.favorScore}%` }}
                        />
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}