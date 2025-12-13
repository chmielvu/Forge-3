
'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { KnowledgeGraph } from '../lib/types/kgot';

// Dynamic import to avoid SSR issues with canvas/window
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-xs text-stone-500 font-mono">INITIALIZING NEURO-SYMBOLIC MATRIX...</div>
});

interface Props {
  graphData: KnowledgeGraph;
  onNodeClick?: (node: any) => void;
}

const NODE_COLORS = {
  SUBJECT: '#f59e0b', // Amber-500 (Player/Victims)
  FACULTY: '#881337', // Rose-900 (The Oppressors)
  PREFECT: '#10b981', // Emerald-500 (The Enforcers)
  LOCATION: '#3b82f6', // Blue-500
  EVENT: '#eab308',   // Yellow-500
  CONCEPT: '#a855f7', // Purple-500
  ENTITY: '#ef4444',  // Red-500 (Fallback)
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
      val: n.type === 'FACULTY' ? 30 : n.type === 'SUBJECT' ? 20 : 10, // Size hierarchy
      color: NODE_COLORS[n.type as keyof typeof NODE_COLORS] || '#78716c'
    }));

    const links = graphData.edges.map((e: any) => ({
      source: e.source,
      target: e.target,
      name: e.label,
      color: e.weight > 0.7 ? '#ef4444' : '#475569', // Red for high tension/weight
      width: e.weight * 2
    }));

    return { nodes, links };
  }, [graphData]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#020617] border border-[#1e293b] rounded-sm overflow-hidden relative">
      {dimensions.width > 0 && (
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
          backgroundColor="#020617" // Matches Forge Black
          d3VelocityDecay={0.4} // Adds "weight" to the physics
          cooldownTicks={100}
          onNodeClick={onNodeClick}
          enableNodeDrag={false} // Lock nodes for stability or enable if preferred
        />
      )}
    </div>
  );
};

export default NetworkGraph;
