
'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { KnowledgeGraph, KGotEdge } from '../lib/types/kgot';

interface Props {
  graphData: KnowledgeGraph;
}

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  group: string;
  val: number;
}

const NODE_COLORS = {
  ENTITY: '#ef4444', 
  LOCATION: '#3b82f6',
  EVENT: '#eab308',
  CONCEPT: '#a855f7',
};

const NetworkGraph: React.FC<Props> = ({ graphData }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const simulationNodes = useMemo(() => {
    if (!graphData || !graphData.nodes) return [];
    return Object.values(graphData.nodes).map((n: any) => ({
      id: n.id,
      label: n.label,
      group: n.type,
      val: n.type === 'ENTITY' ? 20 : 10
    })) as SimulationNode[];
  }, [graphData]);

  const simulationLinks = useMemo(() => {
    if (!graphData || !graphData.edges) return [];
    return graphData.edges.map((e: KGotEdge) => ({
      source: e.source,
      target: e.target,
      label: e.label,
      value: e.weight
    })) as d3.SimulationLinkDatum<SimulationNode>[];
  }, [graphData]);

  useEffect(() => {
    if (!svgRef.current || simulationNodes.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    const simulation = d3.forceSimulation<SimulationNode>(simulationNodes)
      .force("link", d3.forceLink(simulationLinks).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(30));

    const link = svg.append("g")
      .selectAll("line")
      .data(simulationLinks)
      .join("line")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5);

    const node = svg.append("g")
      .selectAll("circle")
      .data(simulationNodes)
      .join("circle")
      .attr("r", d => d.val)
      .attr("fill", d => NODE_COLORS[d.group as keyof typeof NODE_COLORS] || '#ffffff')
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
      .call(drag(simulation) as any);

    const labels = svg.append("g")
      .selectAll("text")
      .data(simulationNodes)
      .join("text")
      .text(d => d.label)
      .attr("font-size", "10px")
      .attr("fill", "#a8a29e")
      .attr("dx", 15)
      .attr("dy", 4)
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      labels
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    function drag(simulation: any) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    return () => simulation.stop();
  }, [simulationNodes, simulationLinks]);

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden relative">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default NetworkGraph;
