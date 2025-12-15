
'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Activity, Brain, Zap, Image as ImageIcon, MessageCircle, Terminal } from 'lucide-react';
import { LogEntry, YandereLedger, MediaStatus, MultimodalTurn, ScriptItem } from '../types';
import { useGameStore } from '../state/gameStore';
import { 
  selectNarratorMode, 
  detectCodeSwitchMode,
  injectNarratorCommentary,
  NARRATOR_VOICES,
  NarratorMode 
} from '../services/narratorEngine';
import { audioService } from '../services/AudioService';

// --- STYLING MAP ---
const SPEAKER_STYLES: Record<string, string> = {
    'Narrator': 'text-stone-300 font-serif leading-relaxed',
    'System': 'text-stone-500 font-mono text-xs uppercase tracking-widest border-l border-stone-700 pl-2',
    'Selene': 'text-red-900 font-display text-lg tracking-wide border-l-2 border-red-900 pl-4 bg-red-950/10 py-2 italic',
    'Petra': 'text-amber-600 font-sans font-bold tracking-tighter uppercase animate-pulse-slow border-l-2 border-amber-700 pl-4 py-1',
    'Lysandra': 'text-cyan-800 font-mono text-sm leading-tight pl-4 border-l-2 border-cyan-900 py-1 bg-cyan-950/10',
    'Calista': 'text-rose-400 font-serif italic text-lg leading-relaxed drop-shadow-sm pl-4 border-l-2 border-rose-900 py-1',
    'Astra': 'text-stone-400 font-serif text-sm italic pl-4 opacity-80 border-l-2 border-stone-600',
    'Physicus': 'text-emerald-800 font-mono text-xs pl-4 border-l-2 border-emerald-900',
    'Elara': 'text-emerald-700 font-sans text-sm tracking-tight border-l border-emerald-900 pl-2 bg-emerald-950/5',
    'Kaelen': 'text-pink-500 font-serif text-sm tracking-widest pl-2 border-l border-pink-900 bg-pink-950/5',
    'Anya': 'text-teal-600 font-serif text-base italic pl-2 border-l border-teal-900 bg-teal-950/5',
    'Rhea': 'text-orange-800 font-mono text-xs uppercase tracking-widest pl-2 border-l border-orange-900 bg-orange-950/5',
    'Subject_84': 'text-blue-300/80 font-serif italic pl-4 border-l border-blue-900/30 py-1',
    'Nico': 'text-amber-500 font-sans font-bold tracking-wide border-l-2 border-amber-500/50 pl-2',
    'Darius': 'text-blue-800 font-serif text-lg tracking-wide opacity-90 pl-2',
    'Silas': 'text-stone-400 font-mono text-xs tracking-tight pl-2',
    'Theo': 'text-red-200/60 font-serif italic text-sm pl-2'
};

const getStyleForSpeaker = (speaker: string) => {
    const upper = speaker.toUpperCase();
    if (upper.includes("SELENE") || upper.includes("PROVOST")) return SPEAKER_STYLES['Selene'];
    if (upper.includes("PETRA") || upper.includes("INQUISITOR")) return SPEAKER_STYLES['Petra'];
    if (upper.includes("LYSANDRA") || upper.includes("LOGICIAN")) return SPEAKER_STYLES['Lysandra'];
    if (upper.includes("CALISTA") || upper.includes("CONFESSOR")) return SPEAKER_STYLES['Calista'];
    if (upper.includes("ASTRA")) return SPEAKER_STYLES['Astra'];
    if (upper.includes("ELARA") || upper.includes("ZEALOT")) return SPEAKER_STYLES['Elara'];
    if (upper.includes("KAELEN") || upper.includes("YANDERE")) return SPEAKER_STYLES['Kaelen'];
    if (upper.includes("ANYA") || upper.includes("NURSE")) return SPEAKER_STYLES['Anya'];
    if (upper.includes("RHEA") || upper.includes("DISSIDENT")) return SPEAKER_STYLES['Rhea'];
    if (upper.includes("PLAYER") || upper.includes("SUBJECT_84")) return SPEAKER_STYLES['Subject_84'];
    if (upper.includes("SYSTEM")) return SPEAKER_STYLES['System'];
    return SPEAKER_STYLES['Narrator'];
};

// --- TYPEWRITER COMPONENT ---
const TypewriterText: React.FC<{ content: string; onComplete?: () => void; speed?: number }> = ({ content, onComplete, speed = 20 }) => {
    const [displayed, setDisplayed] = useState('');
    const indexRef = useRef(0);
    const timeoutRef = useRef<number | null>(null);

    // Pre-parse the content to handle custom tags [[COLOR|TEXT]]
    // We will render chunks. If it's a tag, we render it fully instantly (or type it if ambitious, but instant is safer for styles)
    // For simplicity in this version: We strip tags for typing logic or handle them as atomic blocks.
    // Simpler approach: Regular typing, but use a parser for final display.
    
    useEffect(() => {
        setDisplayed('');
        indexRef.current = 0;
        
        const typeChar = () => {
            if (indexRef.current < content.length) {
                const nextChar = content.charAt(indexRef.current);
                setDisplayed(prev => prev + nextChar);
                indexRef.current++;
                
                // Speed variation for realism
                let nextDelay = speed;
                if (nextChar === '.' || nextChar === '?' || nextChar === '!') nextDelay = speed * 15;
                else if (nextChar === ',') nextDelay = speed * 8;
                else if (Math.random() > 0.9) nextDelay = speed * 3; // Slight hesitation

                timeoutRef.current = window.setTimeout(typeChar, nextDelay);
            } else {
                if (onComplete) onComplete();
            }
        };

        timeoutRef.current = window.setTimeout(typeChar, speed);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [content, speed]);

    // Custom Parser for [[COLOR|TEXT]] tags
    const renderParsed = (text: string) => {
        const parts = text.split(/(\[\[#[0-9a-fA-F]{6}\|.*?\]\])/g);
        return parts.map((part, idx) => {
            const match = part.match(/^\[\[(#[0-9a-fA-F]{6})\|(.*?)\]\]$/);
            if (match) {
                const [_, color, innerText] = match;
                return <span key={idx} style={{ color }} className="font-italic tracking-wide">{innerText}</span>;
            }
            return <span key={idx} dangerouslySetInnerHTML={{ __html: part.replace(/\n/g, '<br/>') }} />;
        });
    };

    return <span>{renderParsed(displayed)}<span className="animate-pulse inline-block w-2 h-4 bg-stone-500/50 align-middle ml-1" /></span>;
};

// --- SCRIPT RENDERER ---
const ScriptRenderer: React.FC<{ 
    script: ScriptItem[], 
    audioAlignment?: Array<{ index: number, start: number, end: number }> 
}> = ({ script, audioAlignment }) => {
    const [currentTime, setCurrentTime] = useState(0);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        const updateTime = () => {
            setCurrentTime(audioService.getCurrentTime());
            rafRef.current = requestAnimationFrame(updateTime);
        };
        rafRef.current = requestAnimationFrame(updateTime);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    return (
        <div className="space-y-4 my-4">
            {script.map((item, idx) => {
                const isActive = audioAlignment?.some(
                    a => a.index === idx && currentTime >= a.start && currentTime <= a.end
                );
                const style = getStyleForSpeaker(item.speaker);
                
                return (
                    <div 
                        key={idx} 
                        className={`transition-all duration-300 ${isActive ? 'opacity-100 scale-[1.01]' : 'opacity-80'}`}
                    >
                        {item.speaker !== 'Narrator' && (
                            <span className="text-[10px] uppercase font-mono tracking-widest opacity-50 block mb-1">
                                {item.speaker}
                            </span>
                        )}
                        <p className={`${style} ${isActive ? 'text-shadow-glow' : ''}`}>
                            {item.text}
                        </p>
                    </div>
                );
            })}
        </div>
    );
};

// --- INLINE PREVIEW ---
const InlineMediaPreview: React.FC<{ turn?: MultimodalTurn }> = ({ turn }) => {
  if (!turn) return null;
  const isImageReady = turn.imageStatus === MediaStatus.ready && turn.imageData;
  
  if (!isImageReady) return null;

  return (
    <div className="mt-4 mb-2 animate-fade-in group relative overflow-hidden rounded-sm border border-stone-800 bg-stone-950/50 max-w-sm">
      <div className="relative aspect-video">
        <img 
          src={turn.imageData?.startsWith('data:') ? turn.imageData : `data:image/jpeg;base64,${turn.imageData}`} 
          alt="Narrative Visualization" 
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500 hover:scale-105 transform duration-700 ease-in-out"
        />
        <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 flex items-center gap-1 rounded-sm border border-white/10 backdrop-blur-sm">
          <ImageIcon size={10} className="text-stone-300" />
          <span className="text-[9px] font-mono text-stone-300 uppercase tracking-wider">Visual Record</span>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
interface Props {
  logs: LogEntry[];
  thinking: boolean;
  choices: string[];
  onChoice: (c: string) => void;
  ledger: YandereLedger;
}

const NarrativeLog: React.FC<Props> = ({ logs, thinking, choices, onChoice, ledger }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [narratorMode, setNarratorMode] = useState<NarratorMode>('MOCKING_JESTER');
  const [showNarratorIndicator, setShowNarratorIndicator] = useState(false);
  
  const multimodalTimeline = useGameStore(s => s.multimodalTimeline);
  
  // Ambient Sound Trigger based on Ledger
  useEffect(() => {
      if (ledger.traumaLevel > 0) {
          audioService.startDrone();
          audioService.updateDrone(ledger.traumaLevel);
      }
  }, [ledger.traumaLevel]);

  // Robust scrolling logic
  const scrollToBottom = () => {
    if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
        if (isNearBottom || thinking) {
             bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs.length, thinking]);

  useEffect(() => {
    const latestLog = logs[logs.length - 1];
    let nextMode = selectNarratorMode(ledger);
    if (latestLog?.type === 'narrative') {
       const detectedMode = detectCodeSwitchMode(latestLog.content);
       if (detectedMode) nextMode = detectedMode;
    }
    setNarratorMode(prevMode => {
        if (prevMode !== nextMode) {
            setShowNarratorIndicator(true);
            return nextMode;
        }
        return prevMode;
    });
  }, [logs, ledger]);

  useEffect(() => {
    if (showNarratorIndicator) {
        const timer = setTimeout(() => setShowNarratorIndicator(false), 4000);
        return () => clearTimeout(timer);
    }
  }, [showNarratorIndicator]);

  const narratorVoice = NARRATOR_VOICES[narratorMode];

  return (
    <div className="flex h-full w-full gap-4 md:gap-8 font-serif relative">
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

      <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative scroll-smooth">
        <div className="space-y-6 pb-2 min-h-full flex flex-col justify-end">
          {logs.map((log, idx) => {
            const turn = multimodalTimeline.find(t => t.id === log.id);
            const isLatest = idx === logs.length - 1;
            
            // Prefer script rendering if available
            if (log.type === 'narrative' && turn?.script && turn.script.length > 0) {
                return (
                    <div key={log.id} className="animate-fade-in">
                        <ScriptRenderer script={turn.script} audioAlignment={turn.audioAlignment} />
                        <InlineMediaPreview turn={turn} />
                    </div>
                );
            }

            // Fallback / Legacy Rendering
            const enhancedContent = log.type === 'narrative' 
              ? injectNarratorCommentary(log.content, narratorMode, ledger)
              : log.content;

            const isPsychosis = log.type === 'psychosis' || (log.type === 'narrative' && ledger.traumaLevel > 80);

            return (
              <div key={log.id} className={`prose prose-invert max-w-none animate-fade-in ${isPsychosis ? 'relative' : ''}`}>
                {isPsychosis && log.type === 'narrative' && (
                    <div className="absolute -inset-1 opacity-20 bg-red-900/10 blur-sm pointer-events-none animate-pulse"></div>
                )}

                {log.type === 'system' && (
                  <div className="font-mono text-[9px] text-stone-500 uppercase border-l border-stone-800 pl-3 py-1 tracking-wider opacity-70">
                    <Terminal size={10} className="inline mr-2" />
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
                    <p className="text-sm text-red-200/90 italic font-serif leading-relaxed animate-glitch-text">
                        "{log.content}"
                    </p>
                  </div>
                )}
                
                {log.type === 'narrative' && (
                  <div className="space-y-4">
                    <div 
                      className={`text-lg md:text-xl leading-relaxed drop-shadow-md ${isPsychosis ? 'text-stone-300' : 'text-stone-200'}`} 
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                    >
                        {isLatest && !turn?.script ? (
                            <TypewriterText content={enhancedContent} onComplete={scrollToBottom} />
                        ) : (
                            // Render previously fully typed logs normally (with formatting parsing)
                            <span dangerouslySetInnerHTML={{ __html: enhancedContent.replace(/\n/g, '<br/>').replace(/\[\[(#[0-9a-fA-F]{6})\|(.*?)\]\]/g, '<span style="color:$1" class="font-italic tracking-wide">$2</span>') }} />
                        )}
                    </div>
                    <InlineMediaPreview turn={turn} />
                  </div>
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
