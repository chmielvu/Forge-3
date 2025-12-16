import React from 'react';
import { useGameStore } from '../state/gameStore';
import { THEME } from '../theme';

export default function GameLayout() {
  const { gameState, processPlayerTurn, isThinking, logs } = useGameStore();
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    processPlayerTurn(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full p-8 max-w-4xl mx-auto w-full z-10">
      <div className="flex-1 overflow-auto custom-scrollbar mb-4 space-y-6 p-4 bg-black/40 border border-[#292524]" ref={scrollRef}>
        {logs.map((log) => (
          <div key={log.id} className={`p-4 border-l-2 ${log.type === 'system' ? 'border-[#a8a29e] text-[#a8a29e] font-mono text-xs' : 'border-[#7f1d1d] text-[#e7e5e4] font-serif'}`}>
            <div className="whitespace-pre-wrap">{log.content}</div>
          </div>
        ))}
        {isThinking && <div className="text-[#7f1d1d] animate-pulse">The Loom is weaving...</div>}
      </div>
      
      <form onSubmit={handleSubmit} className="w-full">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Respond..."
          className="w-full bg-[#0c0a09] border border-[#44403c] p-4 text-[#e7e5e4] focus:outline-none focus:border-[#7f1d1d] transition-colors font-serif"
          disabled={isThinking}
          autoFocus
        />
      </form>
    </div>
  );
}