
import React from 'react';
import { useGameStore } from '../state/gameStore';
import { Users, Shield, Zap, Brain, HeartCrack } from 'lucide-react';
import { CharacterId, SubjectStatus } from '../types';

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
    <div className="bg-black/60 border border-zinc-800 rounded-sm overflow-hidden flex flex-col h-full shadow-2xl">
      <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-black/80">
        <h3 className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <Users size={12} className="text-zinc-400" />
          Remedial Class
        </h3>
        <span className="text-[9px] text-zinc-600">STATUS MONITOR</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {subjectList.map((sub) => (
          <div key={sub.id} className="relative p-3 bg-zinc-900/40 border border-zinc-800 rounded-sm hover:bg-zinc-900/60 transition-colors">
            
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm text-stone-200 tracking-wide">{sub.name}</span>
                  <span className={`font-mono text-[9px] uppercase border border-zinc-800 px-1 rounded ${STATUS_COLORS[sub.status]}`}>
                    {sub.status}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 italic mt-0.5">{sub.archetype}</div>
              </div>
              
              {/* Special Icon based on archetype */}
              {sub.id === CharacterId.NICO && <Zap size={12} className="text-amber-600" />}
              {sub.id === CharacterId.DARIUS && <Shield size={12} className="text-blue-600" />}
              {sub.id === CharacterId.SILAS && <Brain size={12} className="text-emerald-600" />}
              {sub.id === CharacterId.THEO && <HeartCrack size={12} className="text-red-600" />}
            </div>

            {/* Metrics */}
            <div className="space-y-1.5 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-zinc-600 w-12">WILL</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full">
                  <div className="h-full bg-stone-500 rounded-full" style={{ width: `${sub.willpower}%` }}></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-zinc-600 w-12">TRUST</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${sub.trust}%` }}></div>
                </div>
              </div>
            </div>

            {/* Visual Condition */}
            <div className="text-[10px] text-zinc-400 font-serif border-t border-zinc-800 pt-2 leading-tight">
              "{sub.visualCondition}"
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};

export default SubjectPanel;
