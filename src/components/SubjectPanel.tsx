
import * as React from 'react';
import { useGameStore } from '../state/gameStore';
import { Users, Shield, Zap, Brain, HeartCrack } from 'lucide-react';
import { CharacterId, SubjectStatus, SubjectState } from '../types';

const STATUS_COLORS: Record<SubjectStatus, string> = {
  ACTIVE: 'text-stone-300',
  BROKEN: 'text-red-500',
  ISOLATED: 'text-purple-500',
  COMPLIANT: 'text-cyan-500',
  REBELLIOUS: 'text-amber-500'
};

const SubjectPanel: React.FC = () => {
  const subjects = useGameStore(s => s.subjects);
  const subjectList = Object.values(subjects);

  if (subjectList.length === 0) return null;

  return (
    <div className="bg-black/60 border border-zinc-800 rounded-sm overflow-hidden flex flex-col h-full shadow-2xl" role="region" aria-label="Remedial Class Subjects">
      <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-black/80">
        <h3 className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <Users size={12} className="text-zinc-400" aria-hidden="true" />
          Remedial Class
        </h3>
        <span className="text-[9px] text-zinc-600">STATUS MONITOR</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3" role="list">
        {subjectList.map((sub: SubjectState) => (
          <div key={sub.id} className="relative p-3 bg-zinc-900/40 border border-zinc-800 rounded-sm hover:bg-zinc-900/60 transition-colors" role="listitem" aria-label={`Subject ${sub.name}`}>
            
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm text-stone-200 tracking-wide">{sub.name}</span>
                  <span className={`font-mono text-[9px] uppercase border border-zinc-800 px-1 rounded ${STATUS_COLORS[sub.status]}`} aria-label={`Status: ${sub.status}`}>
                    {sub.status}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 italic mt-0.5">{sub.archetype}</div>
              </div>
              
              {/* Special Icon based on archetype */}
              {/* Wrap Lucide icons in a div to apply the 'title' prop correctly */}
              {sub.id === CharacterId.NICO && (
                <div {...{title: "Defiant Spark", "aria-label": "Defiant Spark"} as React.HTMLAttributes<HTMLDivElement>}>
                  <Zap size={12} className="text-amber-600" aria-hidden="true" />
                </div>
              )}
              {sub.id === CharacterId.DARIUS && (
                <div {...{title: "Broken Guardian", "aria-label": "Broken Guardian"} as React.HTMLAttributes<HTMLDivElement>}>
                  <Shield size={12} className="text-blue-600" aria-hidden="true" />
                </div>
              )}
              {sub.id === CharacterId.SILAS && (
                <div {...{title: "Silent Calculator", "aria-label": "Silent Calculator"} as React.HTMLAttributes<HTMLDivElement>}>
                  <Brain size={12} className="text-emerald-600" aria-hidden="true" />
                </div>
              )}
              {sub.id === CharacterId.THEO && (
                <div {...{title: "Fragile Bird", "aria-label": "Fragile Bird"} as React.HTMLAttributes<HTMLDivElement>}>
                  <HeartCrack size={12} className="text-red-600" aria-hidden="true" />
                </div>
              )}
            </div>

            {/* Metrics */}
            <div className="space-y-1.5 mb-2" role="group" aria-label="Subject metrics">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-zinc-600 w-12">WILL</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full" role="progressbar" aria-valuenow={sub.willpower} aria-valuemin={0} aria-valuemax={100} aria-label="Willpower">
                  <div className="h-full bg-stone-500 rounded-full" style={{ width: `${sub.willpower}%` }} aria-hidden="true"></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-zinc-600 w-12">TRUST</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full" role="progressbar" aria-valuenow={sub.trust} aria-valuemin={0} aria-valuemax={100} aria-label="Trust level">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${sub.trust}%` }} aria-hidden="true"></div>
                </div>
              </div>
            </div>

            {/* Visual Condition */}
            <div className="text-[10px] text-zinc-400 font-serif border-t border-zinc-800 pt-2 leading-tight">
              "{sub.visualCondition}"
            </div>

            {/* Injuries Section */}
            {sub.injuries && sub.injuries.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-800/50" aria-label="Somatic Trauma">
                    <span className="text-[9px] font-mono text-red-500/70 uppercase tracking-wider block mb-1">
                        Somatic Trauma
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {sub.injuries.map((inj, idx) => (
                            <span key={idx} className="text-[9px] px-1.5 py-px bg-red-950/30 border border-red-900/30 text-red-400 rounded-sm">
                                {inj}
                            </span>
                        ))}
                    </div>
                </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
};

export default SubjectPanel;