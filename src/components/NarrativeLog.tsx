
'use client';

import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { LogEntry } from '../types';
import { useGameStore } from '../state/gameStore';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion.ts';
import { cn } from "@/lib/utils";
import { THEME } from "@/theme";

// Updated speaker styles to match the new dark academia palette
const speakerStyles: Record<string, string> = {
  Selene: 'bg-[#7f1d1d]/20 text-[#fecaca] border-[#991b1b]/50', // Burgundy
  Petra: 'bg-[#991b1b]/20 text-[#fca5a5] border-[#dc2626]/40', // Burgundy
  Lysandra: 'bg-[#064e3b]/20 text-[#86efac] border-[#065f46]/50', // Emerald Green
  default: 'bg-[#1c1917]/50 text-[#e7e5e4] border-[#44403c]/50' // Charcoal Gray
};

export default function NarrativeLog() {
  const { logs, isThinking } = useGameStore();
  const viewportRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    // Only scroll if the latest log is new, or if thinking has just started/stopped
    if (viewportRef.current) {
        viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [logs.length, isThinking]); // Dependency on logs.length for new entries

  // Render the full log content, as the TypewriterText and ScriptRenderer logic were internal
  const renderLogContent = (log: LogEntry) => {
    const isPsychosis = log.type === 'psychosis' || (log.type === 'narrative' && useGameStore.getState().gameState.ledger.traumaLevel > 80);
    const logId = log.id; // Access log ID for multimodal timeline check
    const multimodalTurn = useGameStore.getState().multimodalTimeline.find(t => t.id === logId);
    const hasScript = log.type === 'narrative' && multimodalTurn?.script && multimodalTurn.script.length > 0;

    // Use raw content, as Typewriter and other formatting logic are now external to this component
    // If you wish to re-enable Typewriter, you'd need to re-integrate its component
    const contentToRender = log.content;

    if (hasScript && multimodalTurn?.script) {
        // Render script items directly, applying speaker styles
        return (
            <div className="space-y-6 my-4 pl-2" aria-live="polite">
                {multimodalTurn.script.map((item, idx) => {
                    const style = speakerStyles[item.speaker] || speakerStyles.default; // Fallback to default speaker style
                    // Apply bolding and other styling based on desired dark academia feel
                    return (
                        <p key={idx} className={`text-lg leading-relaxed ${style} ${item.speaker === 'Narrator' ? 'italic' : 'font-semibold'}`}>
                            {item.speaker}: {item.text}
                        </p>
                    );
                })}
            </div>
        );
    }

    // Default narrative/psychosis text rendering
    return (
        <p className={`text-xl leading-relaxed max-w-4xl font-light italic ${isPsychosis ? THEME.colors.textError : THEME.colors.textMain}`}>
            {contentToRender}
        </p>
    );
  };


  return (
    <ScrollArea className="h-full" viewportRef={viewportRef}>
      <div className="p-10 space-y-20 text-[#e7e5e4]/90">
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={prefersReduced ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: prefersReduced ? 0 : 0.5 }}
              className="space-y-8"
            >
              {/* Conditional rendering for speaker badge, now with correct type guards */}
              {(log.type === 'narrative' || log.type === 'psychosis') && log.speaker && (
                <Badge variant="outline" className={cn("border text-sm", speakerStyles[log.speaker] || speakerStyles.default)}>
                  {log.speaker}
                </Badge>
              )}
              
              {renderLogContent(log)}

              {log.type === 'psychosis' && (
                <div className={cn(
                  "p-8 bg-[#1e1b2d]/40 border border-[#44403c]/50 rounded-2xl text-[#fca5a5] italic text-xl",
                  !prefersReduced && "animate-pulse"
                )}>
                  {log.content}
                </div>
              )}

              <Separator className="bg-[#292524]/30" />
            </motion.div>
          ))}
        </AnimatePresence>

        {isThinking && (
          <div className="flex items-center gap-5 text-[#065f46] py-12"> {/* Emerald green for thinking */}
            <Loader2 className={cn("animate-spin", prefersReduced && "hidden")} size={32} />
            <span className="font-mono text-lg uppercase tracking-widest">Synthesizing narrative...</span>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}