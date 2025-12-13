
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, Square, Brain, MessageCircle, Zap } from 'lucide-react';
import { LogEntry, YandereLedger } from '../types';
import { 
  selectNarratorMode, 
  generateChoiceAnnotation, 
  injectNarratorCommentary,
  NARRATOR_VOICES,
  NarratorMode 
} from '../services/narratorEngine';

interface Props {
  logs: LogEntry[];
  thinking: boolean;
  choices: string[];
  onChoice: (c: string) => void;
  ledger: YandereLedger;
}

const Typewriter: React.FC<{ text: string; onTyping: () => void }> = ({ text, onTyping }) => {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    let idx = 0;
    // Faster typing for smoother feel
    const interval = setInterval(() => {
      setDisplayed(text.substring(0, idx + 1));
      onTyping();
      idx++;
      if (idx > text.length) clearInterval(interval);
    }, 8);
    return () => clearInterval(interval);
  }, [text, onTyping]);
  
  // Render HTML to allow styling of injected narrator text (e.g. bold/italic)
  // Replacing simple markdown *italic* with em tags for flavor
  const safeHTML = displayed.replace(/\*(.*?)\*/g, '<em class="text-forge-gold not-italic">$1</em>');
  
  return <span dangerouslySetInnerHTML={{ __html: safeHTML }} />;
};

const NarrativeLog: React.FC<Props> = ({ logs, thinking, choices, onChoice, ledger }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [narratorMode, setNarratorMode] = useState<NarratorMode>('MOCKING_JESTER');
  const [showNarratorIndicator, setShowNarratorIndicator] = useState(false);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs, thinking]);

  // Update narrator mode when ledger changes
  useEffect(() => {
    const newMode = selectNarratorMode(ledger);
    if (newMode !== narratorMode) {
      setNarratorMode(newMode);
      // Briefly show indicator when mode switches
      setShowNarratorIndicator(true);
      const timer = setTimeout(() => setShowNarratorIndicator(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [ledger.phase, ledger.traumaLevel, ledger.complianceScore, narratorMode]);

  const narratorVoice = NARRATOR_VOICES[narratorMode];

  return (
    <div className="flex h-full w-full gap-4 md:gap-8 font-serif relative">
      {/* Narrator Mode Change Indicator */}
      {showNarratorIndicator && (
        <div 
          className="fixed top-24 right-8 z-50 px-4 py-3 rounded-sm border animate-fade-in shadow-2xl backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(5, 5, 5, 0.9)',
            borderColor: narratorVoice.borderColor,
            color: narratorVoice.textColor,
            borderLeftWidth: '4px'
          }}
        >
          <div className="flex items-center gap-2 font-mono text-xs mb-1 uppercase tracking-widest">
            <MessageCircle size={12} />
            <span>Narrator Protocol: {narratorMode.replace(/_/g, ' ')}</span>
          </div>
          <div className="text-[10px] opacity-80 italic max-w-[200px] leading-tight">"{narratorVoice.tone}"</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative scroll-smooth mask-image-gradient">
        <div className="space-y-8 pb-2 min-h-full flex flex-col justify-end">
          {logs.map((log) => {
            // Inject narrator commentary for narrative logs using current state context
            const enhancedContent = log.type === 'narrative' 
              ? injectNarratorCommentary(log.content, narratorMode, { traumaLevel: ledger.traumaLevel })
              : log.content;

            return (
              <div key={log.id} className="prose prose-invert max-w-none animate-fade-in">
                {log.type === 'system' && (
                  <div className="font-mono text-[10px] text-stone-500 uppercase border-l border-stone-800 pl-3 py-1">
                    {log.content}
                  </div>
                )}
                
                {log.type === 'thought' && (
                  <div className="flex gap-2 items-center text-[10px] font-mono text-stone-600 pl-1 opacity-70">
                    <Brain size={10} />
                    <span>{log.content}</span>
                  </div>
                )}

                {/* New Psychosis Log Type */}
                {log.type === 'psychosis' && (
                  <div className="relative overflow-hidden py-4 px-6 border-l-2 border-red-900 bg-red-950/10 my-2 group">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
                    <div className="flex items-center gap-3 text-red-400 font-mono text-xs tracking-widest mb-1 opacity-80">
                        <Zap size={12} className="animate-pulse" />
                        <span>INTRUSIVE_THOUGHT_PATTERN</span>
                    </div>
                    <p className="text-lg text-red-200/90 italic font-serif leading-relaxed animate-glitch-text">
                        {log.content}
                    </p>
                  </div>
                )}
                
                {log.type === 'narrative' && (
                  <p className="text-xl md:text-2xl leading-relaxed text-[#f5f5f4] selection:bg-[#881337] selection:text-white">
                    <Typewriter text={enhancedContent} onTyping={scrollToBottom} />
                  </p>
                )}
              </div>
            );
          })}

          {thinking && (
            <div className="flex items-center gap-3 text-[#facc15] animate-pulse py-2 mt-4 border-l-2 border-[#facc15] pl-4">
              <Activity size={14} className="animate-spin" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase">Weaving Fate...</span>
            </div>
          )}

          {!thinking && choices.length > 0 && (
            <div className="grid grid-cols-1 gap-3 mt-8 pt-8 border-t border-[#1c1917] animate-fade-in pb-8">
              {choices.map((choice, idx) => {
                const annotation = generateChoiceAnnotation(
                  { id: `choice-${idx}`, text: choice },
                  narratorMode,
                  ledger
                );

                return (
                  <button
                    key={idx}
                    onClick={() => onChoice(choice)}
                    className="group relative text-left py-5 px-6 bg-black/40 hover:bg-[#facc15]/5 border border-[#1c1917] hover:border-[#facc15]/30 transition-all duration-500 flex items-center gap-4 rounded-sm"
                  >
                    <Square 
                      size={6} 
                      className="text-[#78716c] group-hover:text-[#facc15] rotate-45 transition-colors duration-500 flex-shrink-0" 
                      fill="currentColor" 
                    />
                    <span className="font-serif text-lg text-stone-300 group-hover:text-[#facc15] italic transition-colors duration-300 flex-1">
                      "{choice}"
                    </span>

                    {/* Narrator annotation (hover reveal) */}
                    {annotation && (
                      <div 
                        className="absolute bottom-full left-0 w-full mb-3 px-5 py-3 rounded-sm shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none z-50 transform translate-y-2 group-hover:translate-y-0"
                        style={{
                          backgroundColor: 'rgba(10, 10, 10, 0.98)',
                          borderLeft: `3px solid ${narratorVoice.borderColor}`,
                          color: narratorVoice.textColor,
                          boxShadow: `0 0 20px -5px ${narratorVoice.borderColor}20` // Subtle colored glow
                        }}
                      >
                        <div className="text-xs font-mono italic leading-relaxed tracking-wide">
                          {annotation}
                        </div>
                        {/* Little triangle pointer */}
                        <div 
                          className="absolute bottom-0 left-6 transform translate-y-[4px] w-2 h-2 rotate-45"
                          style={{ backgroundColor: 'rgba(10, 10, 10, 0.98)' }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
    </div>
  );
};

export default NarrativeLog;
