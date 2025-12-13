
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../state/gameStore';
import { Play, Pause, FastForward, Rewind, Volume2, VolumeX, Loader2, RefreshCw, Speaker, Power } from 'lucide-react';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { regenerateMediaForTurn } from '../state/mediaController';
import { MediaStatus } from '../types';
import { audioService } from '../services/AudioService';

// Placeholder for formatTime
const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface MediaPanelProps {}

const MediaPanel: React.FC<MediaPanelProps> = () => {
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
    startSession // Destructured here
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

  // Updated fallback UI with Manual Init Button
  if (!currentTurn) {
    return (
      <div className="w-full h-full flex flex-col gap-4 items-center justify-center bg-forge-black text-forge-subtle font-mono text-xs uppercase p-8 text-center">
        <span className="text-zinc-500">NO_NARRATIVE_TIMELINE_ACTIVE</span>
        <p className="text-[10px] text-zinc-700 max-w-[200px]">
            The multimodal engine is waiting for the first narrative turn.
        </p>
        <button 
            onClick={() => startSession()}
            className="flex items-center gap-2 px-6 py-3 bg-red-900/30 border border-red-900/50 text-red-400 hover:bg-red-900/50 hover:text-red-200 transition-all rounded-sm tracking-widest"
        >
            <Power size={14} /> INITIALIZE SYSTEM
        </button>
      </div>
    );
  }

  const { imageData, imageStatus, audioDuration, audioStatus, videoUrl, videoStatus } = currentTurn;

  return (
    <div className="relative w-full h-full bg-black flex flex-col items-center justify-center text-forge-text font-serif">
      <div className="relative flex-1 w-full flex items-center justify-center bg-stone-950 overflow-hidden">
        {(videoStatus === MediaStatus.pending || imageStatus === MediaStatus.pending || audioStatus === MediaStatus.pending) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 text-forge-gold animate-pulse">
            <Loader2 size={32} className="animate-spin mb-4" />
            <span className="font-mono text-xs uppercase tracking-widest">GENERATING_MEDIA...</span>
            <span className="font-mono text-[10px] text-stone-500 mt-2">({imageStatus} | {audioStatus} | {videoStatus})</span>
          </div>
        )}

        {videoUrl && videoStatus === MediaStatus.ready ? (
          <video
            src={videoUrl}
            autoPlay loop muted playsInline
            className="w-full h-full object-contain"
            onLoadedData={() => setImageLoaded(true)}
          />
        ) : imageData && imageStatus === MediaStatus.ready ? (
          <img
            src={imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`}
            alt={`Scene for Turn ${currentTurn.turnIndex}`}
            className={`w-full h-full object-contain transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full bg-stone-900 flex items-center justify-center">
            <span className="font-display text-4xl text-forge-subtle opacity-30">NO_VISUAL_FEED</span>
          </div>
        )}

        {(imageStatus === MediaStatus.error || audioStatus === MediaStatus.error || videoStatus === MediaStatus.error) && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-950/80 text-white font-mono text-xs uppercase p-4">
                <span className="text-red-400 mb-2">MEDIA_GENERATION_FAILED</span>
                <button 
                    onClick={() => handleRegenerateMedia()}
                    className="mt-4 px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-sm text-xs flex items-center gap-2"
                >
                    <RefreshCw size={12} /> RETRY
                </button>
            </div>
        )}
      </div>

      <div className="w-full bg-forge-black p-4 border-t border-stone-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button onClick={goToPreviousTurn} className="p-2 text-stone-500 hover:text-forge-gold transition-colors"><Rewind size={20} /></button>
          <button
            onClick={handlePlayPause}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-forge-gold text-black shadow-lg hover:bg-yellow-400 transition-colors"
            disabled={audioStatus !== MediaStatus.ready && !audioPlayback.isPlaying}
          >
            {audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurn.id ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button onClick={goToNextTurn} className="p-2 text-stone-500 hover:text-forge-gold transition-colors"><FastForward size={20} /></button>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-stone-500">{formatTime((progress / 100) * (audioDuration || 0))}</span>
          <div className="flex-1 h-1 bg-stone-800 rounded-full relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-forge-gold rounded-full transition-all duration-75 ease-linear" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="font-mono text-[10px] text-stone-500">{formatTime(audioDuration || 0)}</span>
        </div>

        <div className="flex items-center gap-4 text-stone-500">
          <button onClick={toggleMute} className="hover:text-forge-gold transition-colors">
            {isMuted || localVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range" min="0" max="1" step="0.05"
            value={localVolume} onChange={handleVolumeChange}
            className="w-24 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-forge-gold"
          />
          <span className="ml-auto font-mono text-[10px] uppercase flex items-center gap-1"><Speaker size={14} /> RATE: {audioPlayback.playbackRate.toFixed(1)}x</span>
        </div>
      </div>
    </div>
  );
};

export default MediaPanel;
