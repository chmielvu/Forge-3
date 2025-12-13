
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { X, Activity, Terminal, Database, FileText, Layout, Clock, Play, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { CoherenceReport, MediaStatus } from '../types';
import { regenerateMediaForTurn } from '../state/mediaController';
import { turnService } from '../state/turnService'; // For restartGame

interface MediaStatusIndicatorProps {
  status: MediaStatus;
  type: string;
}

const MediaStatusIndicator: React.FC<MediaStatusIndicatorProps> = ({ status, type }) => {
  let colorClass = '';
  let icon = null;

  switch (status) {
    case MediaStatus.idle: 
      colorClass = 'text-stone-500';
      icon = <Clock size={10} />;
      break;
    case MediaStatus.pending: 
      colorClass = 'text-blue-400 animate-pulse';
      icon = <Loader2 size={10} className="animate-spin" />;
      break;
    case MediaStatus.inProgress: 
      colorClass = 'text-yellow-400 animate-spin';
      icon = <Loader2 size={10} className="animate-spin" />;
      break;
    case MediaStatus.ready: 
      colorClass = 'text-green-400';
      icon = <Play size={10} />;
      break;
    case MediaStatus.error: 
      colorClass = 'text-red-500';
      icon = <X size={10} />;
      break;
    default:
      colorClass = 'text-gray-500';
  }

  return (
    <span className={`flex items-center gap-1 ${colorClass}`}>
      {icon} {type}: {status}
    </span>
  );
};

const DevOverlay: React.FC = () => {
  const isOpen = useGameStore(s => s.isDevOverlayOpen);
  const setOpen = useGameStore(s => s.setDevOverlayOpen);
  const gameState = useGameStore(s => s.gameState);
  const executedCode = useGameStore(s => s.executedCode);
  const simulationLog = useGameStore(s => s.lastSimulationLog);
  const debugTrace = useGameStore(s => s.lastDirectorDebug);

  // Multimodal state
  const {
    multimodalTimeline,
    currentTurnId,
    mediaQueue,
    audioPlayback,
    getTurnById,
    setCurrentTurn,
    playTurn,
    getCoherenceReport,
    getTimelineStats,
    saveSnapshot,
    loadSnapshot,
    resetGame,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'state' | 'sim' | 'logs' | 'multimodal'>('state');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save snapshot: Ctrl+S
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveSnapshot();
      }
      // Load snapshot: Ctrl+L
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        loadSnapshot();
      }
      // Reset game: Ctrl+R
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (confirm("Are you sure you want to reset the game?")) {
          resetGame();
          turnService.initGame(); // Reinitialize after reset
        }
      }
      // Quick choices: 1-9
      if (e.key >= '1' && e.key <= '9') {
        const choiceIndex = parseInt(e.key) - 1;
        const choices = useGameStore.getState().choices;
        if (choiceIndex < choices.length) {
          turnService.handleAction(choices[choiceIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveSnapshot, loadSnapshot, resetGame]);

  if (!isOpen) return null;

  const currentTurn = currentTurnId ? getTurnById(currentTurnId) : undefined;
  const timelineStats = getTimelineStats();


  const renderCoherence = (report: CoherenceReport) => (
    <div className="flex items-center gap-2">
      <span className={`${report.isFullyLoaded ? 'text-green-500' : report.hasErrors ? 'text-red-500' : 'text-yellow-500'}`}>
        {report.completionPercentage.toFixed(0)}% Coherent
      </span>
      {report.hasErrors && <X size={10} className="text-red-500" />}
      {!report.isFullyLoaded && !report.hasErrors && <Activity size={10} className="text-yellow-500 animate-spin" />}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md p-4 md:p-8 overflow-hidden font-mono text-xs text-green-500 animate-fade-in">
      <div className="w-full h-full border border-green-900 bg-black flex flex-col shadow-2xl rounded-sm">
        
        {/* Header */}
        <div className="h-10 border-b border-green-900 bg-green-900/10 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Terminal size={14} />
            <span className="font-bold tracking-widest">FORGE_OS::KERNEL_DEBUG</span>
          </div>
          <button onClick={() => setOpen(false)} className="hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-green-900">
          <button 
            onClick={() => setActiveTab('state')}
            className={`px-4 py-2 border-r border-green-900 hover:bg-green-900/20 flex gap-2 transition-colors ${activeTab === 'state' ? 'bg-green-900/30 text-white' : ''}`}
          >
            <Database size={12} /> STATE MATRIX
          </button>
          <button 
            onClick={() => setActiveTab('sim')}
            className={`px-4 py-2 border-r border-green-900 hover:bg-green-900/20 flex gap-2 transition-colors ${activeTab === 'sim' ? 'bg-green-900/30 text-white' : ''}`}
          >
            <Activity size={12} /> SIMULATION LOG
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 border-r border-green-900 hover:bg-green-900/20 flex gap-2 transition-colors ${activeTab === 'logs' ? 'bg-green-900/30 text-white' : ''}`}
          >
            <FileText size={12} /> DIRECTOR TRACE
          </button>
          <button 
            onClick={() => setActiveTab('multimodal')}
            className={`px-4 py-2 border-r border-green-900 hover:bg-green-900/20 flex gap-2 transition-colors ${activeTab === 'multimodal' ? 'bg-green-900/30 text-white' : ''}`}
          >
            <Layout size={12} /> MULTIMODAL TIMELINE
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-black/50">
          
          {activeTab === 'state' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">LEDGER_DATA</h3>
                <pre className="text-[10px] leading-tight opacity-80 whitespace-pre-wrap">
                  {JSON.stringify(gameState.ledger, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">GRAPH_NODES ({gameState.nodes.length})</h3>
                <pre className="text-[10px] leading-tight opacity-80 whitespace-pre-wrap">
                  {gameState.nodes.map(n => `[${n.group.toUpperCase()}] ${n.label} (ID: ${n.id})`).join('\n')}
                </pre>
              </div>
              {executedCode && (
                <div>
                   <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">LAST_EXECUTED_CODE</h3>
                   <pre className="text-[10px] text-yellow-500 whitespace-pre-wrap">{executedCode}</pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sim' && (
            <div className="h-full">
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-emerald-400">
                {simulationLog || "NO SIMULATION DATA AVAILABLE. \nRun a turn to generate agent simulation logs."}
              </pre>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="h-full">
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-blue-400">
                {debugTrace || "NO DIRECTOR TRACE AVAILABLE. \nRun a turn to see Gemini 3 Pro thought process."}
              </pre>
            </div>
          )}

          {activeTab === 'multimodal' && (
            <div className="space-y-4">
              {/* Multimodal Timeline Stats */}
              <div>
                <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">TIMELINE_STATS</h3>
                <div className="grid grid-cols-2 gap-2 text-[10px] opacity-80">
                  <span>Total Turns: {timelineStats.totalTurns}</span>
                  <span>Loaded Media Turns: {timelineStats.loadedTurns}</span>
                  <span>Pending Media: {mediaQueue.pending.length}</span>
                  <span>In Progress Media: {mediaQueue.inProgress.length}</span>
                  <span>Failed Media: {mediaQueue.failed.length}</span>
                  <span>Completion Rate: {timelineStats.completionRate.toFixed(1)}%</span>
                </div>
              </div>

              {/* Audio Playback State */}
              <div>
                <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">AUDIO_PLAYBACK_STATE</h3>
                <pre className="text-[10px] leading-tight opacity-80 whitespace-pre-wrap">
                  {JSON.stringify(audioPlayback, null, 2)}
                </pre>
              </div>

              {/* Media Queue */}
              <div>
                <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">MEDIA_QUEUE</h3>
                <div className="space-y-2">
                  {mediaQueue.pending.map((item, idx) => (
                    <div key={`pending-${idx}`} className="flex items-center gap-2 text-[10px] text-blue-400">
                      <Clock size={10} /> PENDING: {item.type} for turn {item.turnId} (Retries: {item.retries})
                    </div>
                  ))}
                  {mediaQueue.inProgress.map((item, idx) => (
                    <div key={`inProgress-${idx}`} className="flex items-center gap-2 text-[10px] text-yellow-400 animate-pulse">
                      <Activity size={10} /> IN_PROGRESS: {item.type} for turn {item.turnId}
                    </div>
                  ))}
                  {mediaQueue.failed.map((item, idx) => (
                    <div key={`failed-${idx}`} className="flex items-center gap-2 text-[10px] text-red-500">
                      <X size={10} /> FAILED: {item.type} for turn {item.turnId} (Error: {item.errorMessage || 'Unknown'})
                      <button 
                        onClick={() => regenerateMediaForTurn(item.turnId, item.type)}
                        className="ml-2 p-1 bg-red-800 hover:bg-red-700 rounded-sm flex items-center gap-1"
                      >
                        <RefreshCw size={8} /> Retry
                      </button>
                    </div>
                  ))}
                  {mediaQueue.pending.length + mediaQueue.inProgress.length + mediaQueue.failed.length === 0 && (
                    <span className="text-[10px] text-stone-500">Queue Empty.</span>
                  )}
                </div>
              </div>

              {/* Multimodal Timeline Table */}
              <div>
                <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">FULL_TIMELINE ({multimodalTimeline.length})</h3>
                <div className="border border-green-900 rounded-sm overflow-auto max-h-[400px]">
                  <table className="w-full text-[9px] text-left">
                    <thead className="sticky top-0 bg-green-900/20 text-white uppercase tracking-wider">
                      <tr>
                        <th className="p-2 border-r border-green-800">#</th>
                        <th className="p-2 border-r border-green-800">ID</th>
                        <th className="p-2 border-r border-green-800">Text Snippet</th>
                        <th className="p-2 border-r border-green-800">Image</th>
                        <th className="p-2 border-r border-green-800">Audio</th>
                        <th className="p-2 border-r border-green-800">Video</th>
                        <th className="p-2 border-r border-green-800">Coherence</th>
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {multimodalTimeline.map((turn) => {
                        const coherenceReport = getCoherenceReport(turn.id);
                        const isCurrent = turn.id === currentTurnId;
                        return (
                          <tr key={turn.id} className={`border-b border-green-900 ${isCurrent ? 'bg-green-900/40 text-white' : 'hover:bg-green-900/10'}`}>
                            <td className="p-2 border-r border-green-900">{turn.turnIndex}</td>
                            <td className="p-2 border-r border-green-900">{turn.id.substring(8, 15)}...</td>
                            <td className="p-2 border-r border-green-900 max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">{turn.text.substring(0, 50)}...</td>
                            <td className="p-2 border-r border-green-900"><MediaStatusIndicator status={turn.imageStatus} type="Img" /></td>
                            <td className="p-2 border-r border-green-900"><MediaStatusIndicator status={turn.audioStatus} type="Aud" /></td>
                            <td className="p-2 border-r border-green-900"><MediaStatusIndicator status={turn.videoStatus} type="Vid" /></td>
                            <td className="p-2 border-r border-green-900">{renderCoherence(coherenceReport)}</td>
                            <td className="p-2 flex gap-1">
                              <button 
                                onClick={() => setCurrentTurn(turn.id)} 
                                className="px-2 py-1 bg-green-700/30 hover:bg-green-700/50 rounded-sm"
                                title="Set as Current Turn"
                              >
                                <ChevronRight size={10} />
                              </button>
                              <button 
                                onClick={() => playTurn(turn.id)} 
                                disabled={turn.audioStatus !== MediaStatus.ready} 
                                className="px-2 py-1 bg-blue-700/30 hover:bg-blue-700/50 rounded-sm disabled:opacity-50"
                                title="Play Audio"
                              >
                                <Play size={10} />
                              </button>
                              <button 
                                onClick={() => regenerateMediaForTurn(turn.id)}
                                className="px-2 py-1 bg-red-700/30 hover:bg-red-700/50 rounded-sm"
                                title="Regenerate All Media"
                              >
                                <RefreshCw size={10} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="h-8 border-t border-green-900 bg-green-900/10 flex items-center px-4 text-[10px] gap-4 opacity-70">
          <span>Turn: {gameState.turn}</span>
          <span>Loc: {gameState.location}</span>
          <span className="ml-auto">
            <span className="text-stone-500">Keyboard Shortcuts: </span>
            <code className="bg-green-900/40 px-1 rounded text-white">`</code> Toggle Dev Overlay | 
            <code className="bg-green-900/40 px-1 rounded text-white">Ctrl+S</code> Save | 
            <code className="bg-green-900/40 px-1 rounded text-white">Ctrl+L</code> Load | 
            <code className="bg-green-900/40 px-1 rounded text-white">Ctrl+R</code> Reset | 
            <code className="bg-green-900/40 px-1 rounded text-white">1-9</code> Choices
          </span>
        </div>

      </div>
    </div>
  );
};

export default DevOverlay;