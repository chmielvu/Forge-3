import * as React from 'react';
import { Play, Pause, FastForward, Rewind, Volume2, VolumeX, Loader2, RefreshCw, Speaker, ImageOff, MicOff, Terminal, Activity, Zap } from 'lucide-react';
import { regenerateMediaForTurn } from '../state/mediaController';
import { MediaStatus } from '../types';
import { audioService } from '../services/AudioService';
import { useGameStore } from '../state/gameStore';
import { DEFAULT_MEDIA_BACKGROUND_URL, THEME } from '../theme'; 

// Placeholder for formatTime
const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface MediaPanelProps {
  variant?: 'full' | 'background';
  className?: string;
  backgroundImageUrl?: string;
}

const MediaPanel: React.FC<MediaPanelProps> = ({ variant = 'full', className = '', backgroundImageUrl }) => {
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
  } = useGameStore();

  const currentTurn = currentTurnId ? getTurnById(currentTurnId) : undefined;

  const [localVolume, setLocalVolume] = React.useState(audioPlayback.volume);
  const [isMuted, setIsMuted] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const rafRef = React.useRef<number>(0);

  React.useEffect(() => {
    setLocalVolume(audioPlayback.volume);
  }, [audioPlayback.volume]);

  React.useEffect(() => {
    const loop = () => {
      if (audioPlayback.isPlaying && currentTurn?.audioDuration) {
        const time = audioService.getCurrentTime();
        const percent = Math.min(100, (time / currentTurn.audioDuration) * 100);
        setProgress(percent);
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    if (audioPlayback.isPlaying) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioPlayback.isPlaying, currentTurn?.audioDuration, currentTurn?.id]);

  React.useEffect(() => {
    setProgress(0);
  }, [currentTurnId]);


  const handleVolumeChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setLocalVolume(vol);
    setVolume(vol);
    if (vol > 0 && isMuted) setIsMuted(false);
  }, [setVolume, isMuted]);

  const toggleMute = React.useCallback(() => {
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

  const handlePlayPause = React.useCallback(() => {
    setHasUserInteraction();
    if (!currentTurnId) return;
    if (audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurnId) {
      pauseAudio();
    } else if (currentTurn?.audioStatus === MediaStatus.ready) {
      playTurn(currentTurnId);
    }
  }, [audioPlayback.isPlaying, audioPlayback.currentPlayingTurnId, currentTurnId, currentTurn, playTurn, pauseAudio, setHasUserInteraction]);

  const handleRegenerateMedia = React.useCallback(async (type?: 'image' | 'audio' | 'video') => {
    if (currentTurn?.id) {
        await regenerateMediaForTurn(currentTurn.id, type);
    }
  }, [currentTurn]);

  // Initial State: Waiting for Narrative
  if (!currentTurn) {
    const effectiveBackgroundImage = backgroundImageUrl || DEFAULT_MEDIA_BACKGROUND_URL;
      
    return (
      <div 
        className={`relative w-full h-full bg-[#0c0a09] overflow-hidden ${className}`} 
        style={{ backgroundImage: `url(${effectiveBackgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-black/20 z-10" aria-hidden="true" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(12,10,9,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(12,10,9,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-10 z-0" aria-hidden="true"></div>
        
        {variant === 'full' && (
          <div className="absolute inset-0 flex flex-col gap-4 items-center justify-center text-[#a8a29e] font-mono text-xs uppercase p-8 text-center" role="status" aria-live="polite">
            <span className="animate-pulse tracking-widest">AWAITING_NARRATIVE_FEED</span>
          </div>
        )}
      </div>
    );
  }

  const { imageData, imageStatus, audioDuration, audioStatus, videoUrl, videoStatus } = currentTurn;
  const isGenerating = (videoStatus === MediaStatus.pending || imageStatus === MediaStatus.pending || imageStatus === MediaStatus.inProgress);

  return (
    <div className={`relative flex flex-col items-center justify-center bg-black font-serif overflow-hidden ${className}`}>
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-[#0c0a09]">
        
        {/* Diegetic Loading Overlay */}
        {isGenerating && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 text-[#e7e5e4] backdrop-blur-[2px] overflow-hidden" role="status" aria-live="polite">
            
            {/* Background animated grid/scanline effect for loading */}
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(0deg,transparent_24%,rgba(6,95,70,0.5)_25%,rgba(6,95,70,0.5)_26%,transparent_27%,transparent_74%,rgba(6,95,70,0.5)_75%,rgba(6,95,70,0.5)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(6,95,70,0.5)_25%,rgba(6,95,70,0.5)_26%,transparent_27%,transparent_74%,rgba(6,95,70,0.5)_75%,rgba(6,95,70,0.5)_76%,transparent_77%,transparent)] bg-[size:50px_50px] animate-pulse-slow"></div>
            
            {variant === 'full' && (
              <div className="flex flex-col items-center gap-6 relative z-10">
                <div className={`relative p-6 border-2 border-[#065f46]/30 rounded-full animate-pulse shadow-[0_0_30px_rgba(6,95,70,0.2)]`}>
                    <Activity size={32} className={`text-[#065f46] animate-bounce`} aria-hidden="true" />
                    <div className="absolute inset-0 border border-[#065f46]/10 rounded-full animate-ping" />
                </div>
                <div className="flex flex-col items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#065f46]">
                    <span className="flex items-center gap-2 animate-glitch-text"><Terminal size={14} /> CONSTRUCTING VISUALS...</span>
                    <span className="text-[10px] opacity-60 typing-effect">Resolving Latent Space Geometry</span>
                    <div className="w-32 h-1 bg-[#064e3b]/30 mt-2 rounded-full overflow-hidden">
                        <div className="h-full bg-[#065f46] animate-[shimmer_2s_infinite]"></div>
                    </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Render Logic */}
        {imageStatus === MediaStatus.error ? (
           <div className="w-full h-full bg-[#1c1917] flex flex-col items-center justify-center gap-4 relative overflow-hidden" role="alert">
              <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" aria-hidden="true"></div>
              {variant === 'full' && (
                <>
                  <ImageOff size={48} className="text-[#7f1d1d]/50 mb-2" aria-hidden="true" /> {/* Burgundy */}
                  <span className="font-mono text-xs text-[#991b1b] tracking-widest uppercase">Visual Feed Interrupted</span> {/* Burgundy */}
                  <button 
                    onClick={() => handleRegenerateMedia('image')}
                    className="flex items-center gap-2 px-4 py-2 mt-4 bg-[#7f1d1d]/50 border border-[#7f1d1d]/50 text-[#fca5a5] hover:bg-[#7f1d1d] hover:text-white transition-all rounded-sm text-xs font-mono uppercase tracking-wide z-10"
                    aria-label="Re-establish visual link"
                  >
                    <RefreshCw size={12} aria-hidden="true" /> Re-establish Link
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
            aria-label={`Video scene for Turn ${currentTurn.turnIndex}`}
          />
        ) : imageData && imageStatus === MediaStatus.ready ? (
          <img
            src={imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`}
            alt={`Scene for Turn ${currentTurn.turnIndex}`}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            aria-live="polite"
          />
        ) : (
          !isGenerating && <div className="w-full h-full bg-[#1c1917]" aria-hidden="true" /> 
        )}

        {/* Audio Error Overlay */}
        {audioStatus === MediaStatus.error && variant === 'full' && (
            <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 items-end pointer-events-auto" role="alert">
                <div className="flex items-center gap-2 bg-[#1e1b2d]/90 border border-[#7f1d1d] p-2 rounded-sm shadow-xl"> 
                     <MicOff size={14} className="text-[#fca5a5]" aria-hidden="true" /> 
                     <button onClick={() => handleRegenerateMedia('audio')} className="text-[#fca5a5] hover:text-white" title="Retry Audio" aria-label="Retry audio generation">
                        <RefreshCw size={12} aria-hidden="true" />
                     </button>
                </div>
            </div>
        )}
      </div>

      {variant === 'full' && (
        <div className="w-full bg-[#1c1917] p-4 border-t border-[#292524] flex flex-col gap-3 z-30" role="group" aria-label="Audio controls"> 
          <div className="flex items-center justify-between">
            <button onClick={goToPreviousTurn} className="p-2 text-[#a8a29e] hover:text-[#991b1b] transition-colors" aria-label="Go to previous narrative turn"> 
              <Rewind size={20} />
            </button>
            <button
              onClick={handlePlayPause}
              className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all duration-300
                  ${audioStatus === MediaStatus.ready 
                      ? 'bg-[#991b1b] text-white hover:bg-[#7f1d1d] hover:scale-105'  
                      : 'bg-[#44403c] text-[#a8a29e] cursor-not-allowed'} 
              `}
              disabled={audioStatus !== MediaStatus.ready && !audioPlayback.isPlaying}
              aria-label={audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurn.id ? "Pause audio" : "Play audio"}
            >
              {audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurn.id ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={goToNextTurn} className="p-2 text-[#a8a29e] hover:text-[#991b1b] transition-colors" aria-label="Go to next narrative turn"> 
              <FastForward size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3" aria-label="Audio playback progress">
            <span className="font-mono text-[10px] text-[#a8a29e] w-8 text-right" aria-label="Current time">{formatTime((audioService.getCurrentTime() / (audioDuration || 1)) * (audioDuration || 0))}</span> 
            <div className="flex-1 h-1 bg-[#44403c] rounded-full relative overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}> 
              <div className="absolute inset-y-0 left-0 bg-[#991b1b] rounded-full transition-all duration-75 ease-linear" style={{ width: `${progress}%` }} aria-hidden="true"></div> 
            </div>
            <span className="font-mono text-[10px] text-[#a8a29e] w-8" aria-label="Total duration">{formatTime(audioDuration || 0)}</span> 
          </div>

          <div className="flex items-center gap-4 text-[#a8a29e]"> 
            <button onClick={toggleMute} className="hover:text-[#991b1b] transition-colors" aria-label={isMuted || localVolume === 0 ? "Unmute audio" : "Mute audio"}> 
              {isMuted || localVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={localVolume} onChange={handleVolumeChange}
              className="w-24 h-1 bg-[#44403c] rounded-lg appearance-none cursor-pointer accent-[#991b1b]" 
              aria-label="Audio volume slider"
              aria-valuenow={localVolume}
              aria-valuemin={0}
              aria-valuemax={1}
            />
            <span className="ml-auto font-mono text-[10px] uppercase flex items-center gap-1" aria-label="Playback rate"><Speaker size={14} aria-hidden="true" /> RATE: {audioPlayback.playbackRate.toFixed(1)}x</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaPanel;