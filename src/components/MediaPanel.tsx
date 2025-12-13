
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../state/gameStore';
import { Play, Pause, FastForward, Rewind, Volume2, VolumeX, Loader2, RefreshCw, Speaker, Power, ImageOff, MicOff } from 'lucide-react';
import { regenerateMediaForTurn } from '../state/mediaController';
import { MediaStatus } from '../types';
import { audioService } from '../services/AudioService';

// Placeholder for formatTime
const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface MediaPanelProps {
  variant?: 'full' | 'background';
  className?: string;
}

const MediaPanel: React.FC<MediaPanelProps> = ({ variant = 'full', className = '' }) => {
  const {
    multimodalTimeline,
    currentTurnId,
    audioPlayback,
    getTurnById,
    goToNextTurn,
    goToPreviousTurn,
    playTurn,
    pauseAudio,
    setVolume,
    setHasUserInteraction,
    startSession 
  } = useGameStore();

  const currentTurn = currentTurnId ? getTurnById(currentTurnId) : undefined;

  const [localVolume, setLocalVolume] = useState(audioPlayback.volume);
  const [isMuted, setIsMuted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setLocalVolume(audioPlayback.volume);
  }, [audioPlayback.volume]);

  useEffect(() => {
    const loop = () => {
      if (audioPlayback.isPlaying && currentTurn?.audioDuration) {
        const time = audioService.getCurrentTime();
        const percent = Math.min(100, (time / currentTurn.audioDuration) * 100);
        setProgress(percent);
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    if (audioPlayback.isPlaying) loop();
    else cancelAnimationFrame(rafRef.current);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioPlayback.isPlaying, currentTurn?.audioDuration, currentTurn?.id]);

  useEffect(() => {
    setProgress(0);
  }, [currentTurnId]);

  useEffect(() => {
    if (currentTurn && currentTurn.audioStatus === MediaStatus.ready && audioPlayback.autoAdvance && audioPlayback.hasUserInteraction) {
      if (audioPlayback.currentPlayingTurnId !== currentTurn.id) {
        playTurn(currentTurn.id);
      }
    }
  }, [currentTurn, audioPlayback.autoAdvance, audioPlayback.hasUserInteraction, audioPlayback.currentPlayingTurnId, playTurn]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setLocalVolume(vol);
    setVolume(vol);
    if (vol > 0 && isMuted) setIsMuted(false);
  }, [setVolume, isMuted]);

  const toggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (newMutedState) {
      setLocalVolume(0);
      setVolume(0);
    } else {
      const restoreVol = audioPlayback.volume > 0 ? audioPlayback.volume : 0.7;
      setLocalVolume(restoreVol);
      setVolume(restoreVol);
    }
  }, [isMuted, audioPlayback.volume, setVolume]);

  const handlePlayPause = useCallback(() => {
    setHasUserInteraction();
    if (!currentTurnId) return;
    if (audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurnId) {
      pauseAudio();
    } else if (currentTurn?.audioStatus === MediaStatus.ready) {
      playTurn(currentTurnId);
    }
  }, [audioPlayback.isPlaying, audioPlayback.currentPlayingTurnId, currentTurnId, currentTurn, playTurn, pauseAudio, setHasUserInteraction]);

  const handleRegenerateMedia = useCallback(async (type?: 'image' | 'audio' | 'video') => {
    if (currentTurn?.id) {
        await regenerateMediaForTurn(currentTurn.id, type);
    }
  }, [currentTurn]);

  // Initial State: Waiting for Narrative
  if (!currentTurn) {
    if (variant === 'background') return <div className={`bg-stone-950 ${className}`} />; // Silent background
    
    return (
      <div className="w-full h-full flex flex-col gap-4 items-center justify-center bg-stone-950 text-stone-500 font-mono text-xs uppercase p-8 text-center border-b border-stone-800">
        <span className="animate-pulse tracking-widest">AWAITING_INPUT_SIGNAL</span>
        <button 
            onClick={() => startSession()}
            className="flex items-center gap-2 px-6 py-3 bg-red-900/30 border border-red-900/50 text-red-400 hover:bg-red-900/50 hover:text-red-200 transition-all rounded-sm tracking-widest"
        >
            <Power size={14} /> INITIALIZE SYSTEM
        </button>
      </div>
    );
  }

  const { imageData, imageStatus, imageError, audioDuration, audioStatus, audioError, videoUrl, videoStatus } = currentTurn;

  return (
    <div className={`relative flex flex-col items-center justify-center bg-black font-serif overflow-hidden ${className}`}>
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        
        {/* Loading Overlay */}
        {(videoStatus === MediaStatus.pending || imageStatus === MediaStatus.pending) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 text-stone-300 animate-pulse backdrop-blur-[1px]">
            {variant === 'full' && (
              <>
                <Loader2 size={32} className="animate-spin mb-4 opacity-80" />
                <span className="font-mono text-xs uppercase tracking-widest opacity-80">GENERATING_VISUALS...</span>
              </>
            )}
          </div>
        )}

        {/* Content Render Logic */}
        {imageStatus === MediaStatus.error ? (
           <div className="w-full h-full bg-stone-950 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
              {variant === 'full' && (
                <>
                  <ImageOff size={48} className="text-red-900/50 mb-2" />
                  <span className="font-mono text-xs text-red-500 tracking-widest uppercase">Visual Feed Interrupted</span>
                  <button 
                    onClick={() => handleRegenerateMedia('image')}
                    className="flex items-center gap-2 px-4 py-2 mt-4 bg-red-950/50 border border-red-900/50 text-red-400 hover:bg-red-900 hover:text-white transition-all rounded-sm text-xs font-mono uppercase tracking-wide z-10"
                  >
                    <RefreshCw size={12} /> Re-establish Link
                  </button>
                </>
              )}
           </div>
        ) : videoUrl && videoStatus === MediaStatus.ready ? (
          <video
            src={videoUrl}
            autoPlay loop muted playsInline
            className="w-full h-full object-cover"
            onLoadedData={() => setImageLoaded(true)}
          />
        ) : imageData && imageStatus === MediaStatus.ready ? (
          <img
            src={imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`}
            alt={`Scene for Turn ${currentTurn.turnIndex}`}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full bg-stone-900" />
        )}

        {/* Audio Error Overlay */}
        {audioStatus === MediaStatus.error && variant === 'full' && (
            <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 items-end pointer-events-auto">
                <div className="flex items-center gap-2 bg-red-950/90 border border-red-800 p-2 rounded-sm shadow-xl">
                     <MicOff size={14} className="text-red-400" />
                     <button onClick={() => handleRegenerateMedia('audio')} className="text-red-400 hover:text-white" title="Retry Audio">
                        <RefreshCw size={12}/>
                     </button>
                </div>
            </div>
        )}
      </div>

      {variant === 'full' && (
        <div className="w-full bg-stone-950 p-4 border-t border-stone-800 flex flex-col gap-3 z-30">
          <div className="flex items-center justify-between">
            <button onClick={goToPreviousTurn} className="p-2 text-stone-500 hover:text-amber-500 transition-colors"><Rewind size={20} /></button>
            <button
              onClick={handlePlayPause}
              className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all duration-300
                  ${audioStatus === MediaStatus.ready 
                      ? 'bg-amber-600 text-black hover:bg-amber-500 hover:scale-105' 
                      : 'bg-stone-800 text-stone-600 cursor-not-allowed'}
              `}
              disabled={audioStatus !== MediaStatus.ready && !audioPlayback.isPlaying}
            >
              {audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurn.id ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={goToNextTurn} className="p-2 text-stone-500 hover:text-amber-500 transition-colors"><FastForward size={20} /></button>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-stone-500 w-8 text-right">{formatTime((progress / 100) * (audioDuration || 0))}</span>
            <div className="flex-1 h-1 bg-stone-800 rounded-full relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-amber-600 rounded-full transition-all duration-75 ease-linear" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="font-mono text-[10px] text-stone-500 w-8">{formatTime(audioDuration || 0)}</span>
          </div>

          <div className="flex items-center gap-4 text-stone-500">
            <button onClick={toggleMute} className="hover:text-amber-500 transition-colors">
              {isMuted || localVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={localVolume} onChange={handleVolumeChange}
              className="w-24 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
            <span className="ml-auto font-mono text-[10px] uppercase flex items-center gap-1"><Speaker size={14} /> RATE: {audioPlayback.playbackRate.toFixed(1)}x</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaPanel;
