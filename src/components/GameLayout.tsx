
'use client';

import * as React from 'react';
import { motion } from "framer-motion";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import Header from "./Header";
import MediaPanel from "./MediaPanel";
import NarrativeLog from "./NarrativeLog";
import ActionControls from "./ActionControls";
import LedgerDisplay from "./LedgerDisplay";
import { useGameStore } from '../state/gameStore';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { THEME } from "../theme";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } }
};

const childVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

export default function GameLayout() {
  const prefersReduced = useReducedMotion();
  const { gameState } = useGameStore();

  const animated = (children: React.ReactNode) => prefersReduced ? children : (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );

  return (
    <div className="relative h-screen flex flex-col bg-[#0c0a09] overflow-hidden font-serif">
      {/* Subtle grain for parchment feel */}
      <div className="absolute inset-0 pointer-events-none opacity-5 mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg width=\"100\" height=\"100\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noise\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"4\"/%3E%3C/filter%3E%3Crect width=\"100\" height=\"100\" filter=\"url(%23noise)\" opacity=\"0.3\"/%3E%3C/svg%3E')] z-0" />

      <Header />

      {animated(
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
          <motion.div variants={childVariants} className="lg:col-span-2">
            <Card className="h-full bg-black/30 backdrop-blur-xl border border-[#292524]/40 shadow-2xl overflow-hidden rounded-3xl">
              <MediaPanel variant="full" />
            </Card>
          </motion.div>

          <div className="flex flex-col gap-8">
            <motion.div variants={childVariants} className="flex-1">
              <Card className="h-full bg-black/30 backdrop-blur-xl border border-[#292524]/40 shadow-2xl overflow-hidden rounded-3xl">
                <ScrollArea className="h-full">
                  <NarrativeLog />
                </ScrollArea>
              </Card>
            </motion.div>

            <motion.div variants={childVariants}>
              <Card className="bg-black/30 backdrop-blur-xl border border-[#292524]/40 p-6 shadow-2xl rounded-3xl">
                <LedgerDisplay ledger={gameState.ledger} />
              </Card>
            </motion.div>
          </div>
        </main>
      )}

      <motion.div variants={childVariants}>
        <ActionControls />
      </motion.div>
    </div>
  );
}