
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, Square, Brain } from 'lucide-react';
import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
  thinking: boolean;
  choices: string[];
  onChoice: (c: string) => void;
  ledger: any; // Kept for compatibility
}

const Typewriter: React.FC<{ text: string; onTyping: () => void }> = ({ text, onTyping }) => {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      setDisplayed(text.substring(0, idx + 1));
      onTyping();
      idx++;
      if (idx > text.length) clearInterval(interval);
    }, 10); // Fast typing
    return () => clearInterval(interval);
  }, [text]);
  return <span>{displayed}</span>;
};

const NarrativeLog: React.FC<Props> = ({ logs, thinking, choices, onChoice }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs, thinking]);

  return (
    <div className="flex h-full w-full gap-4 md:gap-8 font-serif">
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative scroll-smooth mask-image-gradient">
        <div className="space-y-6 pb-2 min-h-full flex flex-col justify-end">
          {logs.map((log) => (
            <div key={log.id} className={`prose prose-invert max-w-none animate-fade-in`}>
              {log.type === 'system' && (
                <div className="font-mono text-xs text-stone-500 uppercase border-l border-stone-800 pl-2">
                  {log.content}
                </div>
              )}
              {log.type === 'thought' && (
                <div className="flex gap-2 items-center text-[10px] font-mono text-stone-600 pl-1">
                  <Brain size={10} />
                  <span>{log.content}</span>
                </div>
              )}
              {log.type === 'narrative' && (
                <p className="text-xl md:text-2xl leading-relaxed text-[#f5f5f4]">
                  <Typewriter text={log.content} onTyping={scrollToBottom} />
                </p>
              )}
            </div>
          ))}

          {thinking && (
            <div className="flex items-center gap-3 text-[#facc15] animate-pulse py-2 mt-4 border-l-2 border-[#facc15] pl-4">
              <Activity size={14} className="animate-spin" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase">Weaving Fate...</span>
            </div>
          )}

          {!thinking && choices.length > 0 && (
            <div className="grid grid-cols-1 gap-3 mt-6 pt-6 border-t border-[#1c1917] animate-fade-in">
              {choices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => onChoice(choice)}
                  className="group relative text-left py-4 px-6 bg-black/40 hover:bg-[#facc15]/10 border border-[#1c1917] hover:border-[#facc15]/50 transition-all duration-300 flex items-center gap-4"
                >
                  <Square size={6} className="text-[#78716c] group-hover:text-[#facc15] rotate-45 transition-colors" fill="currentColor" />
                  <span className="font-serif text-lg text-stone-300 group-hover:text-[#facc15] italic transition-colors">
                    "{choice}"
                  </span>
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} className="h-1" />
        </div>
      </div>
    </div>
  );
};

export default NarrativeLog;
