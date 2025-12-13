
'use client';

import { useActionState, useEffect } from 'react';
import { submitTurn } from './actions';
import { useGameStore } from '@/state/gameStore';
import NarrativeLog from '@/components/NarrativeLog';
import NetworkGraph from '@/components/NetworkGraph';

const INITIAL_STATE = { narrative: "The Iron Sandbox Initialized.", updatedGraph: null, choices: [], thoughtProcess: "" };

export default function Page() {
  const [state, formAction, isPending] = useActionState(submitTurn, INITIAL_STATE);
  const { applyServerState, setThinking, kgot, logs } = useGameStore();

  useEffect(() => {
    if (state.updatedGraph) {
      applyServerState(state);
    }
  }, [state, applyServerState]);

  useEffect(() => {
    setThinking(isPending);
  }, [isPending, setThinking]);

  const handleChoice = (choice: string) => {
    // Hidden form submission for choices
    const formData = new FormData();
    formData.append("input", choice);
    formData.append("history", JSON.stringify(logs.filter(l => l.type === 'narrative').map(l => l.content)));
    formData.append("currentGraph", JSON.stringify(kgot));
    // We cannot call formAction directly here as it expects the payload from the form event usually, 
    // but in Next.js useActionState, we can call it with FormData.
    // However, it's bound to the form. 
    // To trigger it programmatically:
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    const inputField = document.querySelector('input[name="input"]') as HTMLInputElement;
    if (inputField && submitBtn) {
        inputField.value = choice;
        submitBtn.click();
    }
  };

  return (
    <main className="grid grid-cols-1 md:grid-cols-12 h-screen bg-[#050505] text-[#f5f5f4] font-serif overflow-hidden">
      {/* Visual Layer */}
      <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none"></div>

      {/* Left Panel: Neuro-Symbolic State */}
      <section className="hidden md:block col-span-4 border-r border-[#1c1917] p-4 relative bg-black/80">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#881337] to-transparent opacity-50"></div>
        <h3 className="font-mono text-xs text-[#ca8a04] mb-4 uppercase tracking-widest">KGoT Memory Structure</h3>
        <NetworkGraph graphData={kgot} />
      </section>

      {/* Right Panel: The Abyss */}
      <section className="col-span-1 md:col-span-8 flex flex-col relative bg-stone-950/50 z-10">
        <div className="flex-1 overflow-hidden p-4 md:p-8">
          <NarrativeLog 
            logs={logs} 
            thinking={isPending} 
            choices={useGameStore.getState().choices} 
            onChoice={handleChoice} 
            ledger={{}} 
          />
        </div>
        
        {/* Input Terminal */}
        <div className="p-6 border-t border-[#1c1917] bg-black/90 backdrop-blur-md">
          <form action={formAction} className="flex gap-4">
            {/* Hidden state inputs for the server action */}
            <input type="hidden" name="history" value={JSON.stringify(logs.filter(l => l.type === 'narrative').map(l => l.content))} />
            <input type="hidden" name="currentGraph" value={JSON.stringify(kgot)} />
            
            <input 
              name="input"
              className="flex-1 bg-[#1c1917]/30 border border-[#1c1917] p-3 rounded text-[#facc15] font-mono focus:outline-none focus:border-[#881337] transition-colors placeholder:text-stone-700"
              placeholder="State your intent..."
              autoComplete="off"
            />
            <button 
              id="submit-btn"
              type="submit" 
              disabled={isPending}
              className="bg-[#881337]/20 border border-[#881337]/50 text-[#881337] hover:bg-[#881337] hover:text-white px-8 py-2 rounded font-display tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "COMPUTING..." : "COMMIT"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
