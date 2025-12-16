
import React from 'react';
import { useGameStore } from '../state/gameStore';
import { NarratorMode, LogEntry } from '../types';
import { narrativeQualityEngine, AestheteCritique, NarrativeIssue } from '../services/narrativeQualityEngine';

export default function DevOverlay() {
  const { isDevOverlayOpen, setDevOverlayOpen, gameState, narratorOverride, setNarratorOverride, logs, updateLog } = useGameStore();
  const [criticMode, setCriticMode] = React.useState(false);
  const [critique, setCritique] = React.useState<AestheteCritique | null>(null);
  const [issues, setIssues] = React.useState<NarrativeIssue[]>([]);
  const [analyzing, setAnalyzing] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`') {
        setDevOverlayOpen(!isDevOverlayOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevOverlayOpen, setDevOverlayOpen]);

  const runCritique = React.useCallback(async () => {
      // Get the last narrative log
      const lastNarrative = [...logs].reverse().find(l => l.type === 'narrative');
      if (!lastNarrative) {
          setCritique(null);
          setIssues([]);
          return;
      }

      setAnalyzing(true);
      
      // Run Parallel Analysis
      const [aestheteResult, heuristicResult] = await Promise.all([
          narrativeQualityEngine.critiqueWithAesthete(lastNarrative.content, gameState.location),
          Promise.resolve(narrativeQualityEngine.analyzeNarrative(lastNarrative.content, gameState.ledger))
      ]);

      setCritique(aestheteResult);
      setIssues(heuristicResult.issues);
      setAnalyzing(false);
  }, [logs, gameState.location, gameState.ledger]);

  React.useEffect(() => {
      if (criticMode && isDevOverlayOpen) {
          runCritique();
      }
  }, [criticMode, isDevOverlayOpen, logs.length]); // Re-run when logs change or mode toggled

  const applyFix = (fixedContent: string) => {
      const lastNarrative = [...logs].reverse().find(l => l.type === 'narrative');
      if (lastNarrative) {
          updateLog(lastNarrative.id, { content: fixedContent });
          // Re-run critique after fix
          setTimeout(runCritique, 500); 
      }
  };

  const handleAutoFix = () => {
      const lastNarrative = [...logs].reverse().find(l => l.type === 'narrative');
      if (lastNarrative) {
          const fixed = narrativeQualityEngine.autoFixNarrative(lastNarrative.content, issues, gameState);
          applyFix(fixed);
      }
  };

  const handleRewrite = () => {
      if (critique?.rewrite_suggestion) {
          applyFix(critique.rewrite_suggestion);
      }
  };

  if (!isDevOverlayOpen) return null;

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-black/95 border-l border-[#292524] p-6 z-50 overflow-auto font-mono text-xs text-[#a8a29e] shadow-2xl">
      <div className="flex justify-between items-center mb-6 border-b border-[#7f1d1d] pb-2">
        <h2 className="text-[#e7e5e4] font-bold tracking-widest text-sm">SYSTEM OVERRIDE</h2>
        <button onClick={() => setDevOverlayOpen(false)} className="text-[#7f1d1d] hover:text-red-500">[CLOSE]</button>
      </div>

      <div className="space-y-8">
        {/* NARRATOR CONTROL */}
        <div>
            <h3 className="text-[#065f46] font-bold mb-3 uppercase tracking-wider">NARRATIVE PROTOCOL</h3>
            <div className="grid grid-cols-1 gap-2">
                <button 
                    onClick={() => setNarratorOverride('AUTO')}
                    className={`px-3 py-2 text-left border transition-all ${narratorOverride === 'AUTO' ? 'border-[#065f46] text-[#065f46] bg-[#065f46]/10' : 'border-[#292524] hover:border-[#44403c]'}`}
                >
                    [AUTO_ADAPTIVE]
                </button>
                {(['MOCKING_JESTER', 'SEDUCTIVE_DOMINATRIX', 'CLINICAL_ANALYST', 'SYMPATHETIC_CONFIDANTE'] as NarratorMode[]).map(mode => (
                    <button 
                        key={mode}
                        onClick={() => setNarratorOverride(mode)}
                        className={`px-3 py-2 text-left border transition-all text-[10px] ${narratorOverride === mode ? 'border-[#a8a29e] text-[#e7e5e4] bg-[#292524]' : 'border-[#292524] text-[#57534e] hover:border-[#44403c] hover:text-[#a8a29e]'}`}
                    >
                        {mode}
                    </button>
                ))}
            </div>
        </div>

        {/* CRITIC MODE */}
        <div>
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-[#065f46] font-bold uppercase tracking-wider">AESTHETE CRITIC</h3>
                <button 
                    onClick={() => setCriticMode(!criticMode)}
                    className={`w-8 h-4 rounded-full transition-colors ${criticMode ? 'bg-[#065f46]' : 'bg-[#292524]'}`}
                >
                    <div className={`w-4 h-4 bg-[#e7e5e4] rounded-full shadow-md transform transition-transform ${criticMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </button>
            </div>
            
            {criticMode && (
                <div className="bg-[#1c1917] border border-[#292524] p-4 rounded space-y-4">
                    {analyzing ? (
                        <div className="text-[#57534e] animate-pulse">Analyzing Narrative Vectors...</div>
                    ) : critique ? (
                        <>
                            <div className="flex justify-between items-baseline border-b border-[#292524] pb-2">
                                <span className="text-[#a8a29e]">Aesthetic Score</span>
                                <span className={`text-xl font-bold ${critique.score >= 85 ? 'text-[#065f46]' : critique.score >= 60 ? 'text-yellow-600' : 'text-[#7f1d1d]'}`}>
                                    {critique.score}/100
                                </span>
                            </div>
                            
                            {critique.violations.length > 0 && (
                                <div>
                                    <span className="text-[#7f1d1d] font-bold block mb-1">VIOLATIONS:</span>
                                    <ul className="list-disc pl-4 space-y-1 text-[#fca5a5]">
                                        {critique.violations.map((v, i) => <li key={i}>{v}</li>)}
                                    </ul>
                                </div>
                            )}

                            {issues.length > 0 && (
                                <div>
                                    <span className="text-yellow-600 font-bold block mb-1">HEURISTICS:</span>
                                    <ul className="list-disc pl-4 space-y-1 text-yellow-700/80">
                                        {issues.map((issue, i) => (
                                            <li key={i}>
                                                [{issue.category.toUpperCase()}] {issue.message} 
                                                {issue.autoFixable && <span className="text-[#065f46] ml-2 text-[9px]">[AUTO-FIXABLE]</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex flex-col gap-2 mt-2">
                                {critique.rewrite_suggestion && (
                                    <button 
                                        onClick={handleRewrite}
                                        className="w-full py-2 bg-[#7f1d1d]/20 border border-[#7f1d1d] text-[#fca5a5] hover:bg-[#7f1d1d] hover:text-white transition-colors uppercase tracking-wider text-[10px]"
                                    >
                                        Apply Aesthete Rewrite
                                    </button>
                                )}
                                {issues.some(i => i.autoFixable) && (
                                    <button 
                                        onClick={handleAutoFix}
                                        className="w-full py-2 bg-[#065f46]/20 border border-[#065f46] text-[#86efac] hover:bg-[#065f46] hover:text-white transition-colors uppercase tracking-wider text-[10px]"
                                    >
                                        Auto-Fix Issues
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-[#57534e]">No narrative data found.</div>
                    )}
                </div>
            )}
        </div>

        {/* LEDGER STATE */}
        <div>
          <h3 className="text-[#065f46] font-bold mb-3 uppercase tracking-wider">PSYCHE LEDGER</h3>
          <div className="space-y-1 p-3 bg-[#1c1917] rounded border border-[#292524]">
             <div>TRAUMA: <span className="text-[#e7e5e4]">{gameState.ledger.traumaLevel}</span></div>
             <div>SHAME: <span className="text-[#e7e5e4]">{gameState.ledger.shamePainAbyssLevel}</span></div>
             <div>COMPLIANCE: <span className="text-[#e7e5e4]">{gameState.ledger.complianceScore}</span></div>
             <div>HOPE: <span className="text-[#e7e5e4]">{gameState.ledger.hopeLevel}</span></div>
          </div>
        </div>

        {/* RAW STATE DUMP */}
        <div>
          <h3 className="text-[#065f46] font-bold mb-3 uppercase tracking-wider">STATE DUMP</h3>
          <details>
              <summary className="cursor-pointer text-[#57534e] hover:text-[#a8a29e]">View JSON</summary>
              <pre className="mt-2 p-2 bg-[#0c0a09] overflow-auto max-h-60 text-[10px] text-[#57534e]">{JSON.stringify(gameState, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
