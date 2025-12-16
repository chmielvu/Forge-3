
import * as React from 'react';
import { Heart, Skull, Target, Brain, Activity } from 'lucide-react';
import { YandereLedger } from '../types';
import { THEME } from '../theme';

export default function LedgerDisplay({ ledger }: { ledger: YandereLedger }) {
  const metrics = [
    { 
      label: 'Physical', 
      value: ledger.physicalIntegrity, 
      icon: Heart,
      color: 'text-[#ef4444]', // Red-400 (retained for severity, but from new palette)
      barColor: 'from-[#b91c1c] to-[#dc2626]' // Deeper red gradient
    },
    { 
      label: 'Trauma', 
      value: ledger.traumaLevel, 
      icon: Skull,
      color: 'text-[#a78bfa]', // Purple-400
      barColor: 'from-[#7c3aed] to-[#8b5cf6]' // Deeper purple gradient
    },
    { 
      label: 'Hope', 
      value: ledger.hopeLevel, 
      icon: Target,
      color: 'text-[#fbbf24]', // Amber-400
      barColor: 'from-[#d97706] to-[#fbbf24]' // Deeper amber gradient
    },
    { 
      label: 'Compliance', 
      value: ledger.complianceScore, 
      icon: Brain,
      color: 'text-[#22d3ee]', // Cyan-400
      barColor: 'from-[#0891b2] to-[#06b6d4]' // Deeper cyan gradient
    }
  ];
  
  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-black/40 backdrop-blur-sm border border-[#292524] rounded-sm" role="group" aria-label="Psychometric State Matrix"> {/* Charcoal border */}
      <h3 className="col-span-2 text-[10px] font-mono font-semibold text-[#a8a29e] uppercase tracking-widest mb-1 border-b border-[#44403c] pb-2"> {/* Muted gold/gray text, charcoal border */}
        Psychometric State Matrix
      </h3>
      
      {metrics.map(({ label, value, icon: Icon, color, barColor }) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-center gap-2 text-[#e7e5e4]"> {/* Muted white text */}
            <Icon className={`w-3 h-3 ${color}`} aria-hidden="true" />
            <span className="text-xs font-serif tracking-wide">{label}</span>
          </div>
          
          <div className="relative h-1.5 bg-[#1c1917] rounded-full overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} level`}> {/* Dark charcoal background */}
            <div 
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out`}
              style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
              aria-hidden="true"
            />
          </div>
          
          <div className="text-right text-[10px] font-mono text-[#a8a29e]/70" aria-label={`${label} value`}> {/* Muted gold/gray with opacity */}
            {Math.round(value)}<span className="text-[#a8a29e]/50">/100</span> {/* Muted gold/gray with more opacity */}
          </div>
        </div>
      ))}
      
      {/* Dynamic Warning based on state */}
      {ledger.traumaLevel > 80 && (
        <div className="col-span-2 mt-2 flex items-center gap-2 text-[10px] text-[#fca5a5] bg-[#7f1d1d]/20 p-2 rounded border border-[#991b1b]/30 animate-pulse" role="alert" aria-live="assertive"> {/* Light red text, burgundy background/border */}
          <Activity size={12} aria-hidden="true" />
          <span>CRITICAL PSYCHE INSTABILITY DETECTED</span>
        </div>
      )}
    </div>
  );
}