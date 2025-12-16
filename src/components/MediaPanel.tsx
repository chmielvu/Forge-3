
import React from 'react';
import { useGameStore } from '../state/gameStore';
import { Play, Pause, RefreshCw, Loader2, ImageOff, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { DEFAULT_MEDIA_BACKGROUND_URL, THEME } from '../theme';

export default function MediaPanel() {
  const { 
    currentTurnId, 
    getTurnById, 
    audioPlayback, 
    playTurn, 
    pauseAudio, 
    regenerateMediaForTurn 
  } = useGameStore();

  const turn = currentTurnId ? getTurnById(currentTurnId) : null;
  const isPlaying = audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurnId;

  if (!turn) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0c0a09] border border-[#292524] relative overflow-hidden">
         <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
         <span className="text-[#292524] font-mono text-xs tracking-widest animate-pulse">AWAITING SIGNAL...</span>
      </div>
    );
  }

  const hasImage = turn.imageStatus === 'ready' && turn.imageData;
  const hasAudio = turn.audioStatus === 'ready' && turn.audioUrl;
  const isImageLoading = turn.imageStatus === 'pending' || turn.imageStatus === 'inProgress';
  const isImageError = turn.imageStatus === 'error';
  const isAudioError = turn.audioStatus === 'error';

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0c0a09] border border-[#292524] overflow-hidden group">
      
      {/* --- VISUAL DISPLAY --- */}
      <div className="relative flex-1 overflow-hidden bg-[#0c0a09]">
        
        {/* Background / Placeholder */}
        <div 
            className="absolute inset-0 bg-cover bg-center opacity-30 transition-opacity duration-1000"
            style={{ backgroundImage: `url(${DEFAULT_MEDIA_BACKGROUND_URL})` }}
        />

        {/* Main Image */}
        {hasImage && (
            <img 
                src={`data:image/jpeg;base64,${turn.imageData}`} 
                alt="Narrative Visualization" 
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 animate-fade-in z-10"
            />
        )}

        {/* Scanline Overlay (Always active for aesthetic) */}
        <div className="absolute inset-0 pointer-events-none z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
        <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]"></div>

        {/* Loading State */}
        {isImageLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/60 backdrop-blur-sm">
                <Loader2 className="w-8 h-8 text-[#7f1d1d] animate-spin mb-2" />
                <span className="text-[10px] font-mono text-[#7f1d1d] tracking-widest animate-pulse">RENDERING...</span>
            </div>
        )}

        {/* Error State */}
        {isImageError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 p-6 text-center">
                <ImageOff className="w-8 h-8 text-[#7f1d1d] mb-2 opacity-80" />
                <span className="text-[10px] font-mono text-[#7f1d1d] uppercase tracking-wider mb-1">SIGNAL LOST</span>
                <span className="text-[9px] font-mono text-[#a8a29e] mb-4 max-w-[200px] leading-relaxed">
                    {turn.imageError || "Visual feed interrupted."}
                </span>
                <button 
                    onClick={() => regenerateMediaForTurn(turn.id, 'image')}
                    className="flex items-center gap-2 px-3 py-1.5 border border-[#44403c] text-[10px] text-[#a8a29e] hover:bg-[#292524] hover:text-white transition-colors uppercase tracking-wide"
                >
                    <RefreshCw size={10} />
                    Retry Packet
                </button>
            </div>
        )}
      </div>

      {/* --- CONTROL STRIP --- */}
      <div className="relative z-30 h-14 bg-[#1c1917] border-t border-[#292524] flex items-center justify-between px-4">
        
        {/* Playback Controls */}
        <div className="flex items-center gap-4">
            <button 
                onClick={() => isPlaying ? pauseAudio() : playTurn(turn.id)}
                disabled={!hasAudio && !isAudioError}
                className={`flex items-center justify-center w-10 h-10 rounded-sm border transition-all duration-300
                    ${hasAudio 
                        ? 'border-[#7f1d1d] text-[#e7e5e4] hover:bg-[#7f1d1d] hover:text-white shadow-[0_0_10px_rgba(127,29,29,0.2)]' 
                        : isAudioError 
                            ? 'border-[#7f1d1d] text-[#7f1d1d] opacity-50 cursor-not-allowed'
                            : 'border-[#292524] text-[#44403c] cursor-not-allowed'
                    }
                `}
                title={isAudioError ? turn.audioError : (hasAudio ? (isPlaying ? "Pause" : "Play") : "No Audio")}
            >
                {isAudioError ? <VolumeX size={16} /> : (isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />)}
            </button>

            {/* Audio Waveform / Status Placeholder */}
            <div className="flex flex-col gap-1 min-w-[100px]">
                <span className={`text-[9px] font-mono uppercase tracking-wider ${isAudioError ? 'text-[#7f1d1d]' : 'text-[#a8a29e]'}`}>
                    {isAudioError 
                        ? "Audio Stream Failed" 
                        : (hasAudio ? (isPlaying ? "Broadcasting..." : "Audio Ready") : "No Audio")}
                </span>
                
                {isAudioError ? (
                    <div className="h-3 flex items-center text-[9px] text-[#a8a29e] opacity-50 truncate w-32">
                        {turn.audioError}
                    </div>
                ) : (
                    <div className="flex gap-0.5 h-3 items-end">
                        {[...Array(12)].map((_, i) => (
                            <div 
                                key={i} 
                                className={`w-1 bg-[#7f1d1d] transition-all duration-100 ease-in-out ${isPlaying ? 'animate-pulse' : 'opacity-30'}`}
                                style={{ height: isPlaying ? `${Math.random() * 100}%` : '20%', animationDelay: `${i * 0.05}s` }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Turn Indicator */}
        <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-[#a8a29e] tracking-widest">TURN {turn.turnIndex}</span>
            <div className="flex gap-2 mt-1">
                 <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500
                    ${turn.imageStatus === 'ready' ? 'bg-[#065f46] shadow-[0_0_5px_#065f46]' : 
                      turn.imageStatus === 'error' ? 'bg-[#7f1d1d]' : 'bg-[#292524]'}`} 
                    title={turn.imageStatus === 'error' ? `Visual Error: ${turn.imageError}` : "Visual Status"}
                 ></div>
                 <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500
                    ${turn.audioStatus === 'ready' ? 'bg-[#065f46] shadow-[0_0_5px_#065f46]' : 
                      turn.audioStatus === 'error' ? 'bg-[#7f1d1d]' : 'bg-[#292524]'}`} 
                    title={turn.audioStatus === 'error' ? `Audio Error: ${turn.audioError}` : "Audio Status"}
                 ></div>
            </div>
        </div>

      </div>
    </div>
  );
}
