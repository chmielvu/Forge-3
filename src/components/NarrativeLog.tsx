
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, Brain, Zap, Image as ImageIcon, MessageCircle, Terminal, Mic } from 'lucide-react';
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

// --- DIEGETIC LOADER ---
const LOADING_MESSAGES = [
    "CALIBRATING NEURAL PATHWAYS...",
    "ACCESSING ARCHIVE [REDACTED]...",
    "SYNCHRONIZING PAIN RECEPTORS...",
    "COMPILING SOMATIC DATA...",
    "OBSERVING SUBJECT RESPONSE...",
    "THE LOOM IS WEAVING..."
];

const DiegeticLoader = () => {
    const [msgIndex, setMsgIndex] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-3 text-[#facc15] animate-pulse py-2 pl-2">
            <Activity size={14} className="animate-spin" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-80">
                {LOADING_MESSAGES[msgIndex]}
            </span>
        </div>
    );
};

// --- TYPEWRITER COMPONENT ---
const TypewriterText: React.FC<{ content: string; onComplete?: () => void; speed?: number }> = ({ content, onComplete, speed = 20 }) => {
    const [displayed, setDisplayed] = useState('');
    const indexRef = useRef(0);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        setDisplayed('');
        indexRef.current = 0;
        
        const typeChar = () => {
            if (indexRef.current < content.length) {
                const nextChar = content.charAt(indexRef.current);
                setDisplayed(prev => prev + nextChar);
                indexRef.current++;
                
                // Play subtle typewriter sound every few chars
                if (indexRef.current % 3 === 0) {
                    audioService.playSfx('type');
                }
                
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
        <div className="space-y-6 my-4 pl-2">
            {script.map((item, idx) => {
                const isActive = audioAlignment?.some(
                    a => a.index === idx && currentTime >= a.start && currentTime <= a.end
                );
                const style = getStyleForSpeaker(item.speaker);
                
                return (
                    <div 
                        key={idx} 
                        className={`transition-all duration-300 ease-out transform ${isActive ? 'opacity-100 scale-[1.02] translate-x-1' : 'opacity-70 scale-100'}`}
                    >
                        {item.speaker !== 'Narrator' && (
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] uppercase font-mono tracking-widest text-stone-500">
                                    {item.speaker}
                                </span>
                                {isActive && <Mic size={8} className="text-red-500 animate-pulse" />}
                            </div>
                        )}
                        <p className={`${style} ${isActive ? 'brightness-125 drop-shadow-md' : ''}`}>
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
    <div className="mt-6 mb-4 animate-fade-in group relative overflow-hidden rounded-sm border border-stone-800 bg-stone-950/50 max-w-md mx-auto shadow-2xl">
      <div className="relative aspect-video">
        <img 
          src={turn.imageData?.startsWith('data:') ? turn.imageData : `data:image/jpeg;base64,${turn.imageData}`} 
          alt="Narrative Visualization" 
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-700 hover:scale-105 transform ease-in-out"
        />
        
        {/* Overlay Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />

        <div className="absolute bottom-3 right-3 bg-black/70 px-3 py-1.5 flex items-center gap-2 rounded-sm border border-white/10 backdrop-blur-md">
          <ImageIcon size={12} className="text-stone-300" />
          <span className="text-[10px] font-mono text-stone-300 uppercase tracking-widest">Visual Log</span>
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
  
  // Robust scrolling logic
  const scrollToBottom = () => {
    if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        // If user is near bottom or it's a new message, scroll
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;
        if (isNearBottom || thinking) {
             setTimeout(() => {
                 bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
             }, 100);
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
          className="absolute top-4 right-4 z-50 px-4 py-2 rounded-sm border animate-fade-in shadow-2xl backdrop-blur-md transition-all duration-500"
          style={{
            backgroundColor: 'rgba(5, 5, 5, 0.95)',
            borderColor: narratorVoice.borderColor,
            color: narratorVoice.textColor,
            borderLeftWidth: '3px'
          }}
        >
          <div className="flex items-center gap-2 font-mono text-[9px] mb-1 uppercase tracking-widest opacity-80">
            <MessageCircle size={10} />
            <span>Voice Shift Detected</span>
          </div>
          <span className="font-display text-xs tracking-wide uppercase font-bold">{narratorMode.replace(/_/g, ' ')}</span>
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative scroll-smooth mask-linear-fade">
        <div className="space-y-8 pb-4 min-h-full flex flex-col justify-end">
          {logs.map((log, idx) => {
            const turn = multimodalTimeline.find(t => t.id === log.id);
            const isLatest = idx === logs.length - 1;
            
            const isPsychosis = log.type === 'psychosis' || (log.type === 'narrative' && ledger.traumaLevel > 80);
            
            // PRIORITY CHECK: Script property existence
            const hasScript = log.type === 'narrative' && turn?.script && turn.script.length > 0;

            // Fallback content prep if no script
            const enhancedContent = !hasScript && log.type === 'narrative' 
              ? injectNarratorCommentary(log.content, narratorMode, ledger)
              : log.content;

            return (
              <div key={log.id} className={`prose prose-invert max-w-none animate-fade-in ${isPsychosis ? 'relative' : ''}`}>
                {isPsychosis && log.type === 'narrative' && (
                    <div className="absolute -inset-4 opacity-10 bg-red-900/20 blur-xl pointer-events-none animate-pulse"></div>
                )}

                {log.type === 'system' && (
                  <div className="font-mono text-[9px] text-stone-500 uppercase border-l border-stone-800 pl-3 py-1 tracking-wider opacity-60 hover:opacity-100 transition-opacity">
                    <Terminal size={10} className="inline mr-2 text-stone-600" />
                    {log.content}
                  </div>
                )}
                
                {log.type === 'thought' && (
                  <div className="flex gap-2 items-start text-[10px] font-mono text-cyan-800/80 pl-2 border-l border-cyan-900/20 py-1">
                    <Brain size={12} className="mt-0.5 shrink-0" />
                    <span className="leading-tight">{log.content}</span>
                  </div>
                )}

                {log.type === 'psychosis' && (
                  <div className="relative overflow-hidden py-4 px-6 border-l-2 border-red-900 bg-red-950/10 my-4 shadow-[0_0_15px_rgba(220,38,38,0.05)]">
                    <div className="flex items-center gap-2 text-red-500 font-mono text-[9px] tracking-[0.2em] mb-2 opacity-80">
                        <Zap size={10} className="animate-pulse" />
                        <span>NEURAL_INTERRUPTION</span>
                    </div>
                    <p className="text-base text-red-200/90 italic font-serif leading-relaxed animate-glitch-text drop-shadow-sm">
                        "{log.content}"
                    </p>
                  </div>
                )}
                
                {log.type === 'narrative' && (
                  <div className="space-y-6">
                    {hasScript ? (
                        // 1. Script Rendering (Prioritized)
                        <ScriptRenderer script={turn!.script!} audioAlignment={turn?.audioAlignment} />
                    ) : (
                        // 2. Standard Text Rendering (Fallback)
                        <div 
                          className={`text-lg md:text-xl leading-relaxed drop-shadow-md ${isPsychosis ? 'text-stone-300 font-bold' : 'text-stone-200'}`} 
                          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                        >
                            {isLatest ? (
                                <TypewriterText content={enhancedContent} onComplete={scrollToBottom} />
                            ) : (
                                <span dangerouslySetInnerHTML={{ __html: enhancedContent.replace(/\n/g, '<br/>').replace(/\[\[(#[0-9a-fA-F]{6})\|(.*?)\]\]/g, '<span style="color:$1" class="font-italic tracking-wide text-shadow-glow">$2</span>') }} />
                            )}
                        </div>
                    )}
                    {/* Media Preview always rendered after text/script */}
                    <InlineMediaPreview turn={turn} />
                  </div>
                )}
              </div>
            );
          })}

          {thinking && <DiegeticLoader />}
          
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
    </div>
  );
};

export default NarrativeLog;