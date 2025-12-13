
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, Square, Brain, MessageCircle, Zap } from 'lucide-react';
import { LogEntry, YandereLedger } from '../types';
import { 
  selectNarratorMode, 
  detectCodeSwitchMode,
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

const Typewriter: React.FC<{ text: string; onTyping: () => void; isTrauma: boolean }> = ({ text, onTyping, isTrauma }) => {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      setDisplayed(text.substring(0, idx + 1));
      onTyping();
      idx++;
      if (idx > text.length) clearInterval(interval);
    }, isTrauma ? 15 : 5); // Trauma text types slower, more painfully
    return () => clearInterval(interval);
  }, [text, onTyping, isTrauma]);
  
  const safeHTML = displayed
    .replace(/\*(.*?)\*/g, '<em class="text-amber-400 not-italic font-semibold text-shadow-sm">$1</em>')
    // Narrator Injection Syntax: [[COLOR|TEXT]]
    .replace(/\[\[(.*?)\|(.*?)\]\]/g, '<span style="color: $1; font-family: monospace; font-size: 0.85em; display: block; margin-top: 0.75rem; opacity: 0.9; letter-spacing: 0.05em; border-left: 2px solid $1; padding-left: 0.5rem;">$2</span>')
    .replace(/\n/g, '<br/>');
  
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

  // Code-Switching Logic
  useEffect(() => {
    const latestLog = logs[logs.length - 1];
    
    // 1. Start with the baseline mode derived from the ledger
    let nextMode = selectNarratorMode(ledger);

    // 2. Check for contextual code-switching triggers in the latest narrative
    if (latestLog?.type === 'narrative') {
       const detectedMode = detectCodeSwitchMode(latestLog.content);
       if (detectedMode) {
         nextMode = detectedMode;
       }
    }

    // 3. Update state if changed
    if (nextMode !== narratorMode) {
      setNarratorMode(nextMode);
      setShowNarratorIndicator(true);
      const timer = setTimeout(() => setShowNarratorIndicator(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [logs, ledger.traumaLevel, ledger.complianceScore, ledger.hopeLevel, ledger.arousalLevel, narratorMode]);

  const narratorVoice = NARRATOR_VOICES[narratorMode];

  return (
    <div className="flex h-full w-full gap-4 md:gap-8 font-serif relative">
      {/* Narrator Indicator */}
      {showNarratorIndicator && (
        <div 
          className="absolute top-0 right-0 z-50 px-3 py-2 rounded-sm border animate-fade-in shadow-2xl backdrop-blur-md transition-all duration-500"
          style={{
            backgroundColor: 'rgba(5, 5, 5, 0.95)',
            borderColor: narratorVoice.borderColor,
            color: narratorVoice.textColor,
            borderLeftWidth: '3px'
          }}
        >
          <div className="flex items-center gap-2 font-mono text-[9px] mb-1 uppercase tracking-widest">
            <MessageCircle size={10} />
            <span>Voice: {narratorMode.replace(/_/g, ' ')}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative scroll-smooth">
        <div className="space-y-6 pb-2 min-h-full flex flex-col justify-end">
          {logs.map((log) => {
            // Apply commentary only if it's a narrative log
            const enhancedContent = log.type === 'narrative' 
              ? injectNarratorCommentary(log.content, narratorMode, { traumaLevel: ledger.traumaLevel })
              : log.content;

            const isPsychosis = log.type === 'psychosis' || (log.type === 'narrative' && ledger.traumaLevel > 80);

            return (
              <div key={log.id} className={`prose prose-invert max-w-none animate-fade-in ${isPsychosis ? 'relative' : ''}`}>
                
                {/* Somatic Cascade Visual Distortion */}
                {isPsychosis && log.type === 'narrative' && (
                    <div className="absolute -inset-1 opacity-20 bg-red-900/10 blur-sm pointer-events-none animate-pulse"></div>
                )}

                {log.type === 'system' && (
                  <div className="font-mono text-[9px] text-stone-500 uppercase border-l border-stone-800 pl-3 py-1 tracking-wider opacity-70">
                    {log.content}
                  </div>
                )}
                
                {log.type === 'thought' && (
                  <div className="flex gap-2 items-center text-[10px] font-mono text-cyan-800/80 pl-1">
                    <Brain size={10} />
                    <span>{log.content}</span>
                  </div>
                )}

                {log.type === 'psychosis' && (
                  <div className="relative overflow-hidden py-3 px-4 border-l-2 border-red-900 bg-red-950/20 my-2 shadow-[0_0_10px_rgba(220,38,38,0.1)]">
                    <div className="flex items-center gap-2 text-red-400 font-mono text-[9px] tracking-widest mb-1 opacity-80">
                        <Zap size={10} className="animate-pulse" />
                        <span>ABYSS_NARRATOR::INTERVENTION</span>
                    </div>
                    <p className="text-sm text-red-200/90 italic font-serif leading-relaxed animate-glitch-text" style={{ fontFamily: 'Cinzel, serif' }}>
                        "{log.content}"
                    </p>
                  </div>
                )}
                
                {log.type === 'narrative' && (
                  <p 
                    className={`text-lg md:text-xl leading-relaxed drop-shadow-md ${isPsychosis ? 'text-stone-300' : 'text-stone-200'}`} 
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                  >
                    <Typewriter text={enhancedContent} onTyping={scrollToBottom} isTrauma={ledger.traumaLevel > 90} />
                  </p>
                )}
              </div>
            );
          })}

          {thinking && (
            <div className="flex items-center gap-3 text-[#facc15] animate-pulse py-2 pl-2">
              <Activity size={14} className="animate-spin" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-80">The Director is Weaving...</span>
            </div>
          )}
          
          <div ref={bottomRef} className="h-2" />
        </div>
      </div>
    </div>
  );
};

export default NarrativeLog;
