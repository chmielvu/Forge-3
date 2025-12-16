import React from 'react';
import { useGameStore } from '../state/gameStore';
import { THEME } from '../theme';
import MediaPanel from './MediaPanel';

export default function GameLayout() {
  const { processPlayerTurn, isThinking, logs, choices } = useGameStore();
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isThinking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    processPlayerTurn(input);
    setInput('');
  };

  const handleChoice = (choiceText: string) => {
    if (isThinking) return;
    processPlayerTurn(choiceText);
  }

  return (
    <div className="flex flex-col lg:flex-row h-[90vh] w-full max-w-7xl mx-auto gap-6 p-4 md:p-8 z-10">
      
      {/* LEFT COLUMN: Media & Status (35% width on large screens) */}
      <div className="w-full lg:w-[35%] flex flex-col gap-4 order-1 lg:order-1 h-[300px] lg:h-full">
         <div className="flex-1 border border-[#292524] bg-black/40 shadow-2xl overflow-hidden">
            <MediaPanel />
         </div>
      </div>

      {/* RIGHT COLUMN: Narrative Log & Input (65% width) */}
      <div className="w-full lg:w-[65%] flex flex-col gap-4 order-2 lg:order-2 h-full relative">
        
        {/* Log Container */}
        <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-black/40 border border-[#292524] backdrop-blur-sm shadow-2xl relative" ref={scrollRef}>
          <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10"></div>
          
          <div className="space-y-6 pb-4">
            {logs.map((log) => (
              <div key={log.id} className={`animate-fade-in ${log.type === 'system' ? 'pl-4 border-l-2 border-[#292524] opacity-70' : ''}`}>
                
                {log.type === 'system' ? (
                    <div className="font-mono text-[10px] text-[#065f46] tracking-wider mb-1 uppercase">
                        {`>> SYSTEM // ${log.id.split('-')[0]}`}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mb-2 opacity-50">
                        <div className="h-px w-8 bg-[#7f1d1d]"></div>
                        <span className="text-[10px] font-serif uppercase tracking-widest text-[#a8a29e]">Narrative Record</span>
                    </div>
                )}

                <div className={`whitespace-pre-wrap leading-relaxed ${
                    log.type === 'system' ? 'font-mono text-xs text-[#a8a29e]' : 
                    log.type === 'thought' ? 'font-mono text-xs text-[#44403c] italic' :
                    'font-serif text-lg md:text-xl text-[#e7e5e4] text-shadow-glow'
                }`}>
                    {log.content}
                </div>
              </div>
            ))}
            
            {/* Thinking Indicator */}
            {isThinking && (
                <div className="flex items-center gap-3 p-4 bg-[#1c1917]/50 border border-[#292524] rounded-sm animate-pulse">
                    <div className="w-2 h-2 bg-[#7f1d1d] animate-bounce rounded-full"></div>
                    <div className="w-2 h-2 bg-[#7f1d1d] animate-bounce rounded-full delay-75"></div>
                    <div className="w-2 h-2 bg-[#7f1d1d] animate-bounce rounded-full delay-150"></div>
                    <span className="font-mono text-xs text-[#7f1d1d] tracking-widest uppercase ml-2">Processing Neuro-Symbolic Signal...</span>
                </div>
            )}
          </div>
        </div>
        
        {/* Choices Area */}
        {choices && choices.length > 0 && (
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 mb-1 animate-fade-in ${isThinking ? 'opacity-50 pointer-events-none' : ''}`}>
                {choices.map((choice, index) => (
                    <button
                        key={index}
                        onClick={() => handleChoice(choice)}
                        className="group relative px-4 py-3 text-left border border-[#292524] bg-[#0c0a09]/90 hover:bg-[#1c1917] hover:border-[#7f1d1d] transition-all duration-300 overflow-hidden"
                        disabled={isThinking}
                    >
                        <div className="absolute inset-0 bg-[#7f1d1d]/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
                        <span className="relative z-10 flex items-center gap-3">
                            <span className="font-mono text-[10px] text-[#7f1d1d] opacity-50 group-hover:opacity-100">0{index + 1}</span>
                            <span className="text-sm font-serif text-[#a8a29e] group-hover:text-[#e7e5e4] tracking-wide">{choice}</span>
                        </span>
                    </button>
                ))}
            </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="w-full relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#7f1d1d]/0 via-[#7f1d1d]/30 to-[#7f1d1d]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"></div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isThinking ? "Awaiting Response..." : "Choose your response..."}
            className={`relative w-full bg-[#0c0a09] border p-5 text-[#e7e5e4] placeholder-[#44403c] focus:outline-none transition-all duration-300 font-serif tracking-wide shadow-[0_0_20px_rgba(0,0,0,0.5)]
                ${isThinking 
                    ? 'border-[#292524] opacity-50 cursor-not-allowed' 
                    : 'border-[#44403c] focus:border-[#7f1d1d] focus:bg-[#1c1917]'
                }`}
            disabled={isThinking}
            autoFocus
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <span className={`font-mono text-[10px] text-[#44403c] ${isThinking ? '' : 'animate-pulse'}`}>_</span>
          </div>
        </form>
      </div>

    </div>
  );
}