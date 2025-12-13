
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { LogEntry, YandereLedger } from '../types';
import { Brain, Volume2, Activity, Square, Play, Pause } from 'lucide-react';

interface Props {
  logs: LogEntry[];
  thinking: boolean;
  choices: string[];
  onChoice: (c: string) => void;
  ledger: YandereLedger;
}

// --- Sub-components ---

const Typewriter: React.FC<{ text: string; onTyping: () => void; onComplete?: () => void }> = ({ text, onTyping, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const index = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    index.current = 0;
    setDisplayedText('');
    
    const type = () => {
      if (index.current < text.length) {
        setDisplayedText(prev => prev + text.charAt(index.current));
        index.current++;
        onTyping(); // Trigger scroll in parent
        // Variable typing speed for natural feel
        const speed = Math.random() * 10 + 5; 
        setTimeout(() => {
          frameRef.current = requestAnimationFrame(type);
        }, speed);
      } else {
        onComplete?.();
      }
    };

    frameRef.current = requestAnimationFrame(type);

    return () => cancelAnimationFrame(frameRef.current);
  }, [text]);

  return (
    <span>
      {displayedText}
      {index.current < text.length && (
        <span className="inline-block w-2 h-5 bg-forge-gold ml-1 align-middle animate-pulse shadow-[0_0_8px_#facc15]" />
      )}
    </span>
  );
};

const AudioVisualizer: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  if (!isPlaying) return <Volume2 size={16} className="text-stone-500" />;

  return (
    <div className="flex items-end gap-[2px] h-4 mx-2">
      {[...Array(5)].map((_, i) => (
        <div 
          key={i} 
          className="w-1 bg-forge-gold animate-pulse" 
          style={{ 
            height: `${Math.random() * 100}%`,
            animationDuration: `${0.2 + Math.random() * 0.3}s` 
          }} 
        />
      ))}
    </div>
  );
};

const AudioPlayer: React.FC<{ audioData: string }> = ({ audioData }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const binaryString = atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      setIsPlaying(true);
      source.onended = () => setIsPlaying(false);

    } catch (e) {
      console.error("Audio playback failed", e);
      setIsPlaying(false);
    }
  };

  return (
    <button 
      onClick={playAudio}
      disabled={isPlaying}
      className={`inline-flex items-center justify-center ml-2 p-1 rounded-sm transition-all border border-transparent ${isPlaying ? 'border-forge-gold/30 bg-forge-gold/10' : 'hover:border-stone-700 hover:bg-stone-800'}`}
      title="Replay Voice"
    >
      <AudioVisualizer isPlaying={isPlaying} />
    </button>
  );
};

const getCharacterDetails = (text: string) => {
  const lower = text.toLowerCase();
  
  // SELENE: Dominant, Crimson/Gold, Regal
  if (lower.includes('selene') || lower.includes('provost')) {
    return { 
      name: 'Provost Selene', 
      initials: 'PS', 
      color: 'text-forge-crimson',
      border: 'border-forge-crimson',
      bg: 'bg-rose-950/40',
      shadow: 'shadow-rose-900/50'
    };
  }
  
  // PETRA: Kinetic, Orange/Red, volatile
  if (lower.includes('petra') || lower.includes('inquisitor')) {
    return { 
      name: 'Inquisitor Petra', 
      initials: 'IP', 
      color: 'text-orange-600',
      border: 'border-orange-800',
      bg: 'bg-orange-950/40',
      shadow: 'shadow-orange-900/50'
    };
  }

  // LYSANDRA: Clinical, Emerald/Teal, cold
  if (lower.includes('lysandra') || lower.includes('logician')) {
    return { 
      name: 'Dr. Lysandra', 
      initials: 'DL', 
      color: 'text-emerald-500',
      border: 'border-emerald-800',
      bg: 'bg-emerald-950/40',
      shadow: 'shadow-emerald-900/50'
    };
  }

  // CALISTA: Soft, Violet/Fuchsia, deceptive
  if (lower.includes('calista') || lower.includes('confessor')) {
    return { 
      name: 'Confessor Calista', 
      initials: 'CC', 
      color: 'text-fuchsia-400',
      border: 'border-fuchsia-800',
      bg: 'bg-fuchsia-950/40',
      shadow: 'shadow-fuchsia-900/50'
    };
  }

  // DEFAULT
  return { 
    name: 'The Forge', 
    initials: 'TF', 
    color: 'text-stone-400', 
    border: 'border-stone-700', 
    bg: 'bg-stone-900/40', 
    shadow: 'shadow-none'
  };
};

// --- Main Component ---

const NarrativeLog: React.FC<Props> = ({ logs, thinking, choices, onChoice, ledger }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Filter to show last few logs to keep DOM light
  const visibleLogs = useMemo(() => {
      const filtered = logs.filter(l => ['narrative', 'system', 'thought'].includes(l.type));
      return filtered.slice(-8); // Keep last 8 entries
  }, [logs.length]); // Optimized dependency

  const speaker = useMemo(() => {
    const lastNarrative = [...logs].reverse().find(l => l.type === 'narrative');
    return getCharacterDetails(lastNarrative?.content || '');
  }, [logs.length]); // Optimized dependency

  // Trauma effects
  const isHighTrauma = ledger.traumaLevel > 80;
  const isBroken = ledger.shamePainAbyssLevel > 80;

  const scrollToBottom = () => {
    if (bottomRef.current) {
       bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs.length, thinking]);

  return (
    <div className="flex h-full w-full gap-4 md:gap-8">
      
      {/* PORTRAIT - KINETIC DISPLAY */}
      <div className="hidden md:flex flex-col justify-end pb-2 animate-fade-in flex-shrink-0">
        <div className={`w-28 h-36 border-2 ${speaker.border} ${speaker.bg} backdrop-blur-md flex items-center justify-center relative overflow-hidden transition-all duration-1000 shadow-[0_0_30px_rgba(0,0,0,0.5)] ${speaker.shadow} group`}>
           {/* Initials */}
           <span className={`font-display text-5xl ${speaker.color} drop-shadow-lg z-10 transition-transform duration-500 group-hover:scale-110`}>{speaker.initials}</span>
           
           {/* Background Pulse */}
           <div className={`absolute inset-0 opacity-20 ${speaker.color} mix-blend-overlay bg-current animate-pulse-slow`}></div>
           
           {/* CRT Scanline */}
           <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent h-[15%] w-full animate-[scan_3s_linear_infinite] pointer-events-none"></div>
           
           {/* Noise Grain */}
           <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
        </div>
        
        {/* Name Plate */}
        <div className={`mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-right ${speaker.color} opacity-90 border-r-2 ${speaker.border} pr-2`}>
          {speaker.name}
        </div>
      </div>

      {/* SCROLLABLE TEXT AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative scroll-smooth mask-image-gradient">
        <div className="space-y-8 pb-2 min-h-full flex flex-col justify-end">
            
            {visibleLogs.map((log, index) => {
                const isLast = index === visibleLogs.length - 1;
                const isNarrative = log.type === 'narrative';
                const shouldAnimate = isLast && isNarrative;
                
                // Visual hierarchy
                const opacity = isLast ? 'opacity-100' : 'opacity-60 blur-[0.5px] grayscale-[0.5] hover:opacity-100 hover:blur-0 hover:grayscale-0 transition-all duration-700';

                // System Log
                if (log.type === 'system') {
                    return (
                        <div key={log.id} className={`font-mono text-[9px] md:text-[10px] text-forge-subtle tracking-widest uppercase border-l border-forge-gold/30 pl-3 py-1 ${opacity}`}>
                           <span className="text-forge-gold mr-2">>></span> {log.content}
                        </div>
                    );
                }

                // Thought Log
                if (log.type === 'thought') {
                    return (
                         <div key={log.id} className={`flex gap-2 items-center text-[9px] font-mono text-stone-600 pl-1 ${opacity}`}>
                            <Brain size={10} />
                            <span>DIRECTOR_THOUGHT_PROCESS::ENCRYPTED</span>
                         </div>
                    );
                }

                // Narrative Log
                return (
                    <div key={log.id} className={`prose prose-invert max-w-none ${opacity}`}>
                         <p className={`
                           font-serif text-xl md:text-2xl lg:text-3xl leading-relaxed text-forge-text drop-shadow-md selection:bg-forge-gold selection:text-black
                           ${isHighTrauma && isLast ? 'animate-pulse text-shadow-glitch' : ''}
                           ${isBroken && isLast ? 'blur-[0.5px]' : ''}
                         `}>
                            {shouldAnimate ? (
                                <Typewriter 
                                  text={log.content} 
                                  onTyping={scrollToBottom} 
                                />
                            ) : (
                                <span>{log.content}</span>
                            )}
                            {log.audioData && <AudioPlayer audioData={log.audioData} />}
                         </p>
                    </div>
                );
            })}

            {thinking && (
                 <div className="flex items-center gap-3 text-forge-gold animate-pulse py-2 mt-4 border-l-2 border-forge-gold pl-4">
                    <Activity size={14} className="animate-spin" />
                    <span className="font-mono text-[10px] tracking-[0.3em] uppercase">Calculating Outcome...</span>
                 </div>
            )}

            {/* CHOICES */}
            {!thinking && choices.length > 0 && (
                <div className="grid grid-cols-1 gap-3 mt-6 pt-6 border-t border-forge-gold/10 animate-fade-in">
                    {choices.map((choice, idx) => (
                        <button
                            key={idx}
                            onClick={() => onChoice(choice)}
                            className="group relative text-left py-4 px-6 bg-black/40 hover:bg-forge-gold/10 border border-stone-800 hover:border-forge-gold/50 transition-all duration-300 flex items-center gap-4 overflow-hidden shadow-lg hover:shadow-[0_0_15px_rgba(250,204,21,0.1)]"
                        >
                            <div className="absolute inset-0 bg-forge-gold/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                            <Square size={6} className="text-stone-700 group-hover:text-forge-gold rotate-45 transition-colors duration-300 flex-shrink-0" fill="currentColor" />
                            <span className="font-serif text-lg md:text-xl text-stone-300 group-hover:text-forge-gold italic transition-colors relative z-10">
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