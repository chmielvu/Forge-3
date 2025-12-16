
import type { KGotCore } from './core';
import forceAtlas2 from 'graphology-layout-forceatlas2'; // Import for main thread fallback
import { BEHAVIOR_CONFIG } from '@/config/behaviorTuning';

let worker: Worker | null = null;
let workerAvailable: boolean | null = null; // Track worker availability

function getWorker(): Worker | null {
  // If TEST_MODE is active, explicitly disable workers.
  if (BEHAVIOR_CONFIG.TEST_MODE) {
      if (workerAvailable !== false) { // Only log once if it's not already marked false
          console.warn("[Layout] TEST_MODE active: Disabling Web Worker for layout.");
      }
      workerAvailable = false;
      return null;
  }

  // If workers were previously determined unavailable, respect that.
  if (workerAvailable === false) return null;

  if (!worker) {
    try {
        worker = new Worker(new URL('./layout.worker.ts', import.meta.url).href, {
            type: 'module'
        });
        
        worker.onerror = (e) => {
            console.error("[Layout] Worker error:", e);
            workerAvailable = false; // Mark as unavailable on error
            worker = null; // Clear worker instance
        };
        workerAvailable = true;
    } catch (e) {
        console.error("[Layout] Failed to initialize layout worker (falling back to main thread):", e);
        workerAvailable = false; // Mark as unavailable
        worker = null;
        return null;
    }
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

  const w = getWorker();
  
  if (!w) {
      if (workerAvailable !== false) { // Only log if not already logged by getWorker()
        console.warn("[Layout] Worker not available, running layout on main thread (synchronous).");
        workerAvailable = false; // Ensure it's marked
      }
      // Fallback to synchronous execution on main thread
      const positions = forceAtlas2(graph, {
          iterations,
          settings: {
              gravity: 1.0,
              barnesHutOptimize: true
          }
      });
      Object.keys(positions).forEach((node) => {
        if (graph.hasNode(node)) {
          graph.mergeNodeAttributes(node, {
            x: positions[node].x,
            y: positions[node].y
          });
        }
      });
      return Promise.resolve(); // Resolve immediately
  }

  return new Promise((resolve, reject) => {
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