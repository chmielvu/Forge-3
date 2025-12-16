'use client';

import * as React from 'react';
import { useGameStore } from '../state/gameStore';
import { X, Activity, Terminal, Database, FileText, Layout, Clock, Play, RefreshCw, ChevronRight, Loader2, Network, Brain } from 'lucide-react';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { CoherenceReport, MediaStatus } from '../types';
import { regenerateMediaForTurn } from '../state/mediaController';
import { KGotController } from '../controllers/KGotController';
import LedgerDisplay from './LedgerDisplay'; 
import PrefectLeaderboard from './PrefectLeaderboard'; 
import SubjectPanel from './SubjectPanel'; 
import { THEME } from '../theme';
import { audioService } from '../services/AudioService';

interface MediaStatusIndicatorProps {
  status: MediaStatus;
  type: string;
}

const MediaStatusIndicator: React.FC<MediaStatusIndicatorProps> = ({ status, type }) => {
  let colorClass = '';
  let icon = null;

  switch (status) {
    case MediaStatus.idle: 
      colorClass = 'text-[#a8a29e]'; // Muted gold/gray
      icon = <Clock size={10} />;
      break;
    case MediaStatus.pending: 
      colorClass = `${THEME.colors.accent} animate-pulse`; // Emerald green
      icon = <Loader2 size={10} className="animate-spin" />;
      break;
    case MediaStatus.inProgress: 
      colorClass = 'text-[#fbbf24] animate-spin'; // Amber-400
      icon = <Loader2 size={10} className="animate-spin" />;
      break;
    case MediaStatus.ready: 
      colorClass = 'text-[#86efac]'; // Light green
      icon = <Play size={10} />;
      break;
    case MediaStatus.error: 
      colorClass = `${THEME.colors.accentBurgundy}`; // Burgundy
      icon = <X size={10} />;
      break;
    default:
      colorClass = 'text-gray-500';
  }

  return (
    <span className={`flex items-center gap-1 ${colorClass}`} role="status">
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
  const kgot = useGameStore(s => s.kgot);
  const prefects = useGameStore(s => s.prefects);
  const subjects = useGameStore(s => s.subjects); 

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
    processPlayerTurn 
  } = useGameStore();

  const [activeTab, setActiveTab] = React.useState<'state' | 'sim' | 'logs' | 'multimodal' | 'rag' | 'agents'>('state');
  const [ragQuery, setRagQuery] = React.useState('');
  const [ragResult, setRagResult] = React.useState<string>('');

  const runRagQuery = async () => {
      if (!ragQuery) return;
      setRagResult("Querying GraphRAG Index...");
      try {
          const controller = new KGotController(kgot);
          const result = await controller.getRAGAugmentedPrompt(ragQuery);
          setRagResult(result);
      } catch (e) {
          setRagResult(`Error: ${(e as Error).message}`);
      }
  };

  React.useEffect(() => {
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
        }
      }
      // Quick choices: 1-9
      if (e.key >= '1' && e.key <= '9') {
        const choiceIndex = parseInt(e.key) - 1;
        const choices = useGameStore.getState().choices;
        if (choiceIndex < choices.length) {
          const selectedChoice = choices[choiceIndex];
          if (typeof selectedChoice === 'string') { // Explicitly check type
            processPlayerTurn(selectedChoice);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveSnapshot, loadSnapshot, resetGame, processPlayerTurn]);

  if (!isOpen) return null;

  const currentTurnData = currentTurnId ? getTurnById(currentTurnId) : undefined;
  const timelineStats = getTimelineStats();


  const renderCoherence = (report: CoherenceReport) => (
    <div className="flex items-center gap-2" aria-label={`Coherence: ${report.completionPercentage.toFixed(0)}%`}>
      <span className={`${report.isFullyLoaded ? 'text-[#86efac]' : report.hasErrors ? THEME.colors.accentBurgundy : THEME.colors.accent}`}> {/* Light green, burgundy, emerald */}
        {report.completionPercentage.toFixed(0)}% Coherent
      </span>
      {report.hasErrors && <X size={10} className={THEME.colors.accentBurgundy} aria-hidden="true" />}
      {!report.isFullyLoaded && !report.hasErrors && <Activity size={10} className={`${THEME.colors.accent} animate-spin`} aria-hidden="true" />}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md p-4 md:p-8 overflow-hidden font-mono text-xs text-[#065f46] animate-fade-in" role="dialog" aria-label="Developer Overlay"> {/* Emerald green text */}
      <div className="w-full h-full border border-[#064e3b] bg-[#0c0a09] flex flex-col shadow-2xl rounded-sm"> {/* Deep emerald border, deepest black background */}
        
        {/* Header */}
        <div className="h-10 border-b border-[#064e3b] bg-[#064e3b]/10 flex items-center justify-between px-4"> {/* Deep emerald border/bg */}
          <div className="flex items-center gap-2">
            <Terminal size={14} aria-hidden="true" />
            <span className="font-bold tracking-widest">FORGE_OS::KERNEL_DEBUG</span>
          </div>
          <button onClick={() => setOpen(false)} className="hover:text-white transition-colors" aria-label="Close Developer Overlay"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#064e3b]" role="tablist"> {/* Deep emerald border */}
          <button 
            role="tab"
            aria-selected={activeTab === 'state'}
            onClick={() => setActiveTab('state')}
            className={`px-4 py-2 border-r border-[#064e3b] hover:bg-[#064e3b]/20 flex gap-2 transition-colors ${activeTab === 'state' ? 'bg-[#064e3b]/30 text-white' : ''}`}
          >
            <Database size={12} aria-hidden="true" /> STATE
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'sim'}
            onClick={() => setActiveTab('sim')}
            className={`px-4 py-2 border-r border-[#064e3b] hover:bg-[#064e3b]/20 flex gap-2 transition-colors ${activeTab === 'sim' ? 'bg-[#064e3b]/30 text-white' : ''}`}
          >
            <Activity size={12} aria-hidden="true" /> SIM
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'logs'}
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 border-r border-[#064e3b] hover:bg-[#064e3b]/20 flex gap-2 transition-colors ${activeTab === 'logs' ? 'bg-[#064e3b]/30 text-white' : ''}`}
          >
            <FileText size={12} aria-hidden="true" /> TRACE
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'multimodal'}
            onClick={() => setActiveTab('multimodal')}
            className={`px-4 py-2 border-r border-[#064e3b] hover:bg-[#064e3b]/20 flex gap-2 transition-colors ${activeTab === 'multimodal' ? 'bg-[#064e3b]/30 text-white' : ''}`}
          >
            <Layout size={12} aria-hidden="true" /> TIMELINE
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'rag'}
            onClick={() => setActiveTab('rag')}
            className={`px-4 py-2 border-r border-[#064e3b] hover:bg-[#064e3b]/20 flex gap-2 transition-colors ${activeTab === 'rag' ? 'bg-[#064e3b]/30 text-white' : ''}`}
          >
            <Network size={12} aria-hidden="true" /> GRAPHRAG
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'agents'}
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-2 border-r border-[#064e3b] hover:bg-[#064e3b]/20 flex gap-2 transition-colors ${activeTab === 'agents' ? 'bg-[#064e3b]/30 text-white' : ''}`}
          >
            <Brain size={12} aria-hidden="true" /> AGENTS
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[#0c0a09]/50" role="tabpanel"> {/* Deepest black with transparency */}
          
          {activeTab === 'state' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-white mb-2 border-b border-[#064e3b] pb-1 font-bold">LEDGER_DATA</h3>
                <pre className="text-[10px] leading-tight opacity-80 whitespace-pre-wrap text-[#86efac]"> {/* Light green */}
                  {JSON.stringify(gameState.ledger, null, 2)}
                </pre>
                <div className="mt-4">
                  <LedgerDisplay ledger={gameState.ledger} />
                </div>
              </div>
              <div>
                <h3 className="text-white mb-2 border-b border-[#064e3b] pb-1 font-bold">GRAPH_NODES ({kgot.nodes ? Object.keys(kgot.nodes).length : 0})</h3>
                <pre className="text-[10px] leading-tight opacity-80 whitespace-pre-wrap text-[#86efac]">
                  {JSON.stringify(kgot.nodes, null, 2)}
                </pre>
              </div>
              {executedCode && (
                <div>
                   <h3 className="text-white mb-2 border-b border-[#064e3b] pb-1 font-bold">LAST_EXECUTED_CODE</h3>
                   <pre className="text-[10px] text-[#fbbf24] whitespace-pre-wrap">{executedCode}</pre> {/* Amber */}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sim' && (
            <div className="h-full">
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-[#065f46]"> {/* Emerald green */}
                {simulationLog || "NO SIMULATION DATA AVAILABLE. \nRun a turn to generate agent simulation logs."}
              </pre>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="h-full">
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-[#3b82f6]"> {/* Blue */}
                {debugTrace || "NO DIRECTOR TRACE AVAILABLE. \nRun a turn to see Gemini 3 Pro thought process."}
              </pre>
            </div>
          )}

          {activeTab === 'multimodal' && (
            <div className="space-y-4">
              {/* Multimodal Timeline Stats */}
              <div>
                <h3 className="text-white mb-2 border-b border-[#064e3b] pb-1 font-bold">TIMELINE_STATS</h3>
                <div className="grid grid-cols-2 gap-2 text-[10px] opacity-80">
                  <span>Total Turns: {timelineStats.totalTurns}</span>
                  <span>Loaded Media Turns: {timelineStats.loadedTurns}</span>
                  <span>Pending Media: {mediaQueue.pending.length}</span>
                  <span>In Progress Media: {mediaQueue.inProgress.length}</span>
                  <span>Failed Media: {mediaQueue.failed.length}</span>
                  <span>Completion Rate: {timelineStats.completionRate.toFixed(1)}%</span>
                </div>
              </div>

              {/* Media Queue */}
              <div>
                <h3 className="text-white mb-2 border-b border-[#064e3b] pb-1 font-bold">MEDIA_QUEUE</h3>
                <div className="space-y-2">
                  {mediaQueue.pending.map((item, idx) => (
                    <div key={`pending-${idx}`} className={`flex items-center gap-2 text-[10px] ${THEME.colors.accent}`}> {/* Emerald green */}
                      <Clock size={10} aria-hidden="true" /> PENDING: {item.type} for turn {item.turnId} (Retries: {item.retries})
                    </div>
                  ))}
                  {mediaQueue.inProgress.map((item, idx) => (
                    <div key={`inProgress-${idx}`} className={`flex items-center gap-2 text-[10px] text-[#fbbf24] animate-pulse`}> {/* Amber */}
                      <Activity size={10} className="animate-spin" aria-hidden="true" /> IN_PROGRESS: {item.type} for turn {item.turnId}
                    </div>
                  ))}
                  {mediaQueue.failed.map((item, idx) => (
                    <div key={`failed-${idx}`} className={`flex items-center gap-2 text-[10px] ${THEME.colors.accentBurgundy}`}> {/* Burgundy */}
                      <X size={10} aria-hidden="true" /> FAILED: {item.type} for turn {item.turnId} (Error: {item.errorMessage || 'Unknown'})
                      <button 
                        onClick={() => regenerateMediaForTurn(item.turnId, item.type)}
                        className="ml-2 p-1 bg-[#7f1d1d]/50 hover:bg-[#7f1d1d]/70 rounded-sm flex items-center gap-1"
                        aria-label={`Retry ${item.type} for turn ${item.turnId}`}
                      >
                        <RefreshCw size={8} aria-hidden="true" /> Retry
                      </button>
                    </div>
                  ))}
                  {mediaQueue.pending.length + mediaQueue.inProgress.length + mediaQueue.failed.length === 0 && (
                    <span className="text-[10px] text-[#a8a29e]">Queue Empty.</span> {/* Muted gold/gray */}
                  )}
                </div>
              </div>

              {/* Multimodal Timeline Table */}
              <div>
                <h3 className="text-white mb-2 border-b border-[#064e3b] pb-1 font-bold">FULL_TIMELINE ({multimodalTimeline.length})</h3>
                <div className="border border-[#064e3b] rounded-sm overflow-auto max-h-[400px]"> {/* Deep emerald border */}
                  <table className="w-full text-[9px] text-left" role="grid">
                    <thead className="sticky top-0 bg-[#064e3b]/20 text-white uppercase tracking-wider"> {/* Deep emerald background */}
                      <tr>
                        <th className="p-2 border-r border-[#064e3b]" scope="col">#</th>
                        <th className="p-2 border-r border-[#064e3b]" scope="col">ID</th>
                        <th className="p-2 border-r border-[#064e3b]" scope="col">Text Snippet</th>
                        <th className="p-2 border-r border-[#064e3b]" scope="col">Image</th>
                        <th className="p-2 border-r border-[#064e3b]" scope="col">Audio</th>
                        <th className="p-2 border-r border-[#064e3b]" scope="col">Coherence</th>
                        <th className="p-2" scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {multimodalTimeline.map((turn) => {
                        const coherenceReport = getCoherenceReport(turn.id);
                        const isCurrent = turn.id === currentTurnId;
                        return (
                          <tr key={turn.id} className={`border-b border-[#064e3b] ${isCurrent ? 'bg-[#064e3b]/40 text-white' : 'hover:bg-[#064e3b]/10'}`} aria-rowindex={turn.turnIndex + 1}> {/* Deep emerald border/bg */}
                            <td className="p-2 border-r border-[#064e3b]" role="gridcell">{turn.turnIndex}</td>
                            <td className="p-2 border-r border-[#064e3b]" role="gridcell">{turn.id.substring(8, 15)}...</td>
                            <td className="p-2 border-r border-[#064e3b] max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap" role="gridcell">{turn.text.substring(0, 50)}...</td>
                            <td className="p-2 border-r border-[#064e3b]" role="gridcell"><MediaStatusIndicator status={turn.imageStatus} type="Img" /></td>
                            <td className="p-2 border-r border-[#064e3b]" role="gridcell"><MediaStatusIndicator status={turn.audioStatus} type="Aud" /></td>
                            <td className="p-2 border-r border-[#064e3b]" role="gridcell">{renderCoherence(coherenceReport)}</td>
                            <td className="p-2 flex gap-1" role="gridcell">
                              <button 
                                onClick={() => setCurrentTurn(turn.id)} 
                                className="px-2 py-1 bg-[#064e3b]/30 hover:bg-[#064e3b]/50 rounded-sm"
                                title="Set as Current Turn"
                                aria-label={`Set turn ${turn.turnIndex} as current`}
                              >
                                <ChevronRight size={10} />
                              </button>
                              <button 
                                onClick={() => playTurn(turn.id)} 
                                disabled={turn.audioStatus !== MediaStatus.ready} 
                                className="px-2 py-1 bg-[#3b82f6]/30 hover:bg-[#3b82f6]/50 rounded-sm disabled:opacity-50"
                                title="Play Audio"
                                aria-label={`Play audio for turn ${turn.turnIndex}`}
                              >
                                <Play size={10} />
                              </button>
                              <button 
                                onClick={() => regenerateMediaForTurn(turn.id)}
                                className="px-2 py-1 bg-[#7f1d1d]/30 hover:bg-[#7f1d1d]/50 rounded-sm"
                                title="Regenerate All Media"
                                aria-label={`Regenerate all media for turn ${turn.turnIndex}`}
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

          {activeTab === 'rag' && (
              <div className="space-y-4">
                  <div>
                      <h3 className="text-white mb-2 border-b border-[#064e3b] pb-1 font-bold">SEMANTIC_RETRIEVAL_TEST</h3>
                      <div className="flex gap-2">
                          <label htmlFor="rag-query-input" className="sr-only">RAG query</label>
                          <input 
                            id="rag-query-input"
                            type="text" 
                            className="flex-1 bg-[#0c0a09] border border-[#064e3b] p-2 text-[#86efac] focus:outline-none focus:border-[#065f46]"
                            placeholder="Enter query (e.g. 'history of Subject 84')" 
                            value={ragQuery}
                            onChange={e => setRagQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && runRagQuery()}
                            aria-label="Enter RAG query"
                          />
                          <button onClick={runRagQuery} className="px-4 py-2 bg-[#064e3b]/30 border border-[#064e3b] hover:bg-[#064e3b]/50" aria-label="Run RAG query"> {/* Deep emerald button */}
                              QUERY
                          </button>
                      </div>
                  </div>
                  <div className="h-[300px] border border-[#064e3b] bg-black/30 p-2 overflow-auto"> {/* Deep emerald border */}
                      <pre className="text-[10px] whitespace-pre-wrap text-[#86efac]" aria-live="polite">{ragResult}</pre> {/* Light green */}
                  </div>
              </div>
          )}

          {activeTab === 'agents' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-white mb-2 border-b border-[#064e3b] pb-1 font-bold">PREFECTS</h3>
                <PrefectLeaderboard prefects={prefects} />
              </div>
              <div>
                <h3 className="text-white mb-2 border-b border-[#064e3b] pb-1 font-bold">SUBJECTS</h3>
                <SubjectPanel />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="h-8 border-t border-[#064e3b] bg-[#064e3b]/10 flex items-center px-4 text-[10px] gap-4 opacity-70"> {/* Deep emerald border/bg */}
          <span>Turn: {gameState.turn}</span>
          <span>Loc: {gameState.location}</span>
          <span className="ml-auto">
            <span className="text-[#a8a29e]">Keyboard Shortcuts: </span> {/* Muted gold/gray */}
            <code className="bg-[#064e3b]/40 px-1 rounded text-white">`</code> Toggle Dev Overlay | 
            <code className="bg-[#064e3b]/40 px-1 rounded text-white">Ctrl+S</code> Save | 
            <code className="bg-[#064e3b]/40 px-1 rounded text-white">Ctrl+L</code> Load | 
            <code className="bg-[#064e3b]/40 px-1 rounded text-white">Ctrl+R</code> Reset | 
            <code className="bg-[#064e3b]/40 px-1 rounded text-white">1-9</code> Choices
          </span>
        </div>

      </div>
    </div>
  );
};

export default DevOverlay;