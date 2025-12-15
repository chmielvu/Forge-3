'use client';

import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import { KnowledgeGraph } from '../lib/types/kgot';

// Use React.lazy for client-side only loading of the heavy graph library
const ForceGraph2D = React.lazy(() => import('react-force-graph-2d'));

interface Props {
  graphData: KnowledgeGraph;
  onNodeClick?: (node: any) => void;
}

const NODE_COLORS = {
  SUBJECT: '#f59e0b', // Amber-500
  FACULTY: '#881337', // Rose-900
  PREFECT: '#10b981', // Emerald-500
  LOCATION: '#3b82f6', // Blue-500
  EVENT: '#eab308',   // Yellow-500
  CONCEPT: '#a855f7', // Purple-500
  ENTITY: '#ef4444',  // Red-500
};

const EDGE_COLORS: Record<string, string> = {
    'GRUDGE': '#ef4444', // Red-500
    'OBSESSION': '#a855f7', // Purple-500
    'TRAUMA_BONDS': '#db2777', // Pink-600
    'ALLIANCE': '#3b82f6', // Blue-500
    'OWNS_SOUL': '#991b1b', // Red-800
    'HUNTS_RIVAL': '#f97316', // Orange-500
    'RELATIONSHIP': '#475569' // Slate-600 (Default)
};

const NetworkGraph: React.FC<Props> = ({ graphData, onNodeClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const data = useMemo(() => {
    // Safety check for empty graph
    if (!graphData || !graphData.nodes) return { nodes: [], links: [] };

    const nodes = Object.values(graphData.nodes).map((n: any) => ({
      id: n.id,
      label: n.label,
      group: n.type,
      val: n.type === 'FACULTY' ? 30 : n.type === 'SUBJECT' ? 20 : 10,
      color: NODE_COLORS[n.type as keyof typeof NODE_COLORS] || '#78716c'
    }));

    const links = graphData.edges.map((e: any) => {
        // Fallback or explicit type color
        let color = EDGE_COLORS[e.type] || EDGE_COLORS[e.label.toUpperCase().replace(/\s/g, '_')] || '#475569';
        if (e.weight > 0.8 && color === '#475569') color = '#e2e8f0'; // High weight generic edges get brighter

        return {
            source: e.source,
            target: e.target,
            name: e.label,
            color: color,
            width: Math.max(1, e.weight * 3)
        };
    });

    return { nodes, links };
  }, [graphData]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#020617] border border-[#1e293b] rounded-sm overflow-hidden relative group">
      {dimensions.width > 0 && (
        <Suspense fallback={<div className="flex items-center justify-center h-full text-xs text-stone-500 font-mono">INITIALIZING NEURO-SYMBOLIC MATRIX...</div>}>
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={data}
            nodeLabel="label"
            nodeColor="color"
            nodeRelSize={4}
            linkColor="color"
            linkWidth="width"
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.2}
            backgroundColor="#020617"
            d3VelocityDecay={0.4}
            cooldownTicks={100}
            onNodeClick={onNodeClick}
            enableNodeDrag={false} 
          />
        </Suspense>
      )}
      
      {/* Interactive Legend Overlay */}
      <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm border border-stone-800 p-2 rounded-sm text-[9px] font-mono text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-[#ef4444]"></span> GRUDGE</div>
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-[#a855f7]"></span> OBSESSION</div>
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-[#db2777]"></span> TRAUMA BOND</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span> ALLIANCE</div>
      </div>
    </div>
  );
};

export default NetworkGraph;