import React from 'react';
import { Heart, Skull, Target, Brain, Activity } from 'lucide-react';
import { YandereLedger } from '../types';

export default function LedgerDisplay({ ledger }: { ledger: YandereLedger }) {
  const metrics = [
    { 
      label: 'Physical', 
      value: ledger.physicalIntegrity, 
      icon: Heart,
      color: 'text-red-400',
      barColor: 'from-red-500 to-red-600'
    },
    { 
      label: 'Trauma', 
      value: ledger.traumaLevel, 
      icon: Skull,
      color: 'text-purple-400',
      barColor: 'from-purple-500 to-purple-600'
    },
    { 
      label: 'Hope', 
      value: ledger.hopeLevel, 
      icon: Target,
      color: 'text-amber-400',
      barColor: 'from-amber-500 to-amber-600'
    },
    { 
      label: 'Compliance', 
      value: ledger.complianceScore, 
      icon: Brain,
      color: 'text-cyan-400',
      barColor: 'from-cyan-500 to-cyan-600'
    }
  ];
  
  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-black/40 backdrop-blur-sm border border-zinc-800 rounded-sm">
      <h3 className="col-span-2 text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest mb-1 border-b border-zinc-800 pb-2">
        Psychometric State Matrix
      </h3>
      
      {metrics.map(({ label, value, icon: Icon, color, barColor }) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-center gap-2 text-zinc-300">
            <Icon className={`w-3 h-3 ${color}`} />
            <span className="text-xs font-serif tracking-wide">{label}</span>
          </div>
          
          <div className="relative h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out`}
              style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
            />
          </div>
          
          <div className="text-right text-[10px] font-mono text-zinc-600">
            {Math.round(value)}<span className="text-zinc-700">/100</span>
          </div>
        </div>
      ))}
      
      {/* Dynamic Warning based on state */}
      {ledger.traumaLevel > 80 && (
        <div className="col-span-2 mt-2 flex items-center gap-2 text-[10px] text-red-400 bg-red-950/20 p-2 rounded border border-red-900/30 animate-pulse">
          <Activity size={12} />
          <span>CRITICAL PSYCHE INSTABILITY DETECTED</span>
        </div>
      )}
    </div>
  );
}