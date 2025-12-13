import React from 'react';

interface Props {
  onAction: (input: string) => void;
  disabled: boolean;
}

export default function ActionWheel({ onAction, disabled }: Props) {
  const actions = [
    { 
      label: 'COMPLY', 
      desc: 'Submit. Endure.',
      intent: 'I submit to the order. I do exactly as told.',
      style: 'border-cyan-900/50 hover:bg-cyan-950/30 hover:border-cyan-500/50 text-cyan-500'
    },
    { 
      label: 'DEFY', 
      desc: 'Resist. Reject.',
      intent: 'I refuse. I resist violently or verbally.',
      style: 'border-red-900/50 hover:bg-red-950/30 hover:border-red-500/50 text-red-500'
    },
    { 
      label: 'OBSERVE', 
      desc: 'Watch. Analyze.',
      intent: 'I remain silent and observe the details of the room and the people.',
      style: 'border-zinc-800 hover:bg-zinc-900 hover:border-zinc-500 text-zinc-400'
    },
    { 
      label: 'SPEAK', 
      desc: 'Engage. Risk.',
      intent: 'I speak carefully, trying to gain information or manipulate.',
      style: 'border-purple-900/50 hover:bg-purple-950/30 hover:border-purple-500/50 text-purple-500'
    }
  ];
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((act) => (
        <button
          key={act.label}
          onClick={() => onAction(act.intent)}
          disabled={disabled}
          className={`
            group relative p-4 rounded-sm border transition-all duration-300 text-left
            disabled:opacity-30 disabled:cursor-not-allowed
            ${act.style}
          `}
        >
          <div className="font-display text-lg tracking-widest mb-1">{act.label}</div>
          <div className="font-serif text-xs opacity-60 italic group-hover:opacity-100 transition-opacity">
            "{act.desc}"
          </div>
        </button>
      ))}
    </div>
  );
}