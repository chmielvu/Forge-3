import React from 'react';
import { useGameStore } from '../state/gameStore';

export default function DevOverlay() {
  const { isDevOverlayOpen, setDevOverlayOpen, gameState } = useGameStore();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`') {
        setDevOverlayOpen(!isDevOverlayOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevOverlayOpen, setDevOverlayOpen]);

  if (!isDevOverlayOpen) return null;

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-black/90 border-l border-[#292524] p-4 z-50 overflow-auto font-mono text-xs text-[#a8a29e]">
      <h2 className="text-[#e7e5e4] border-b border-[#44403c] pb-2 mb-4">DEV CONSOLE</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-[#065f46]">GAME STATE</h3>
          <pre>{JSON.stringify(gameState, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}