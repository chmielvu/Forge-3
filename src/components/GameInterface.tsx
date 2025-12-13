
'use client';

import React, { useState, useTransition } from 'react';
import { submitTurn } from '@/app/actions';
import NarrativeLog from './NarrativeLog';
import NetworkGraph from './NetworkGraph';
import { Activity, Terminal } from 'lucide-react';
import { KnowledgeGraph } from '@/lib/types/kgot';

// Initial Empty Graph
const INITIAL_GRAPH: KnowledgeGraph = {
  nodes: {},
  edges: [],
  global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' }
};

export default function GameInterface() {
  const [logs, setLogs] = useState<any[]>([]); // Using simple log structure
  const [graph, setGraph] = useState<KnowledgeGraph>(INITIAL_GRAPH);
  const [choices, setChoices] = useState<string[]>(["Begin Simulation"]);
  const [isPending, startTransition] = useTransition();

  const handleAction = (input: string) => {
    // Optimistic UI
    setLogs(prev => [...prev, { id: Date.now().toString(), type: 'system', content: `> ${input}` }]);
    setChoices([]);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("input", input);
      formData.append("history", JSON.stringify(logs.filter(l => l.type === 'narrative').map(l => l.content)));
      formData.append("currentGraph", JSON.stringify(graph));

      const result = await submitTurn(null, formData);

      if (result.error) {
        setLogs(prev => [...prev, { id: Date.now().toString(), type: 'system', content: `ERROR: ${result.error}` }]);
        return;
      }

      // Update State from Server Result
      setGraph(result.updatedGraph);
      setChoices(result.choices);
      setLogs(prev => [
        ...prev,
        { id: `thought-${Date.now()}`, type: 'thought', content: result.thoughtProcess },
        { id: `narrative-${Date.now()}`, type: 'narrative', content: result.narrative, visualContext: result.visualPrompt }
      ]);
    });
  };

  return (
    <div className="relative w-full h-screen flex flex-col bg-[#050505] text-[#f5f5f4]">
      {/* Visual Layer (Placeholder for Nano Banana) */}
      <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      {/* Header */}
      <div className="relative z-10 p-6 flex justify-between items-center border-b border-[#1c1917] bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-2 text-[#ca8a04]">
          <Terminal size={18} />
          <span className="font-display font-bold tracking-widest">THE FORGE</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#78716c]">
          <Activity size={14} className={isPending ? "animate-pulse text-[#facc15]" : ""} />
          <span>{isPending ? "DIRECTOR_COMPUTING" : "IDLE"}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Left: Narrative */}
        <div className="flex-1 p-8 max-w-4xl mx-auto flex flex-col justify-end">
           <div className="h-[60vh]">
             <NarrativeLog 
               logs={logs} 
               thinking={isPending} 
               choices={choices} 
               onChoice={handleAction} 
               ledger={{}} // Ledger prop kept for compatibility, pass empty or meaningful
             />
           </div>
        </div>

        {/* Right: Graph Visualization (Hidden on mobile) */}
        <div className="hidden lg:block w-1/3 border-l border-[#1c1917] bg-black/80 p-4">
           <h3 className="font-mono text-xs text-[#ca8a04] mb-4 uppercase tracking-widest">KGoT Memory Structure</h3>
           <div className="h-full w-full">
             {/* Pass graph prop to NetworkGraph */}
             <NetworkGraph graphData={graph} />
           </div>
        </div>
      </div>
    </div>
  );
}
