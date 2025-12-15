
import type { KGotCore } from './core';

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export async function runLayoutAsync(core: KGotCore, iterations = 50): Promise<void> {
  const graph = core.internalGraph;

  // Manually serialize to avoid Graphology export complexity with structured attributes
  const serialized = {
      nodes: {} as Record<string, any>,
      edges: [] as any[]
  };
  
  graph.forEachNode((node, attrs) => {
      serialized.nodes[node] = attrs;
  });
  
  graph.forEachEdge((edge, attrs, source, target) => {
      serialized.edges.push({ source, target, attributes: attrs });
  });

  return new Promise((resolve, reject) => {
    const w = getWorker();
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'done') {
        const positions = e.data.positions;
        Object.keys(positions).forEach((node) => {
          if (graph.hasNode(node)) {
            graph.mergeNodeAttributes(node, {
              x: positions[node].x,
              y: positions[node].y
            });
          }
        });
        w.removeEventListener('message', handler);
        resolve();
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ graph: serialized, iterations });
  });
}
