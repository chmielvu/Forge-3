import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

self.onmessage = (e) => {
  const { graph: exported, iterations = 50 } = e.data;
  
  // Rehydrate graph from serialized data
  const graph = new Graph({ multi: true, type: 'directed' });
  if (exported.nodes) {
      Object.keys(exported.nodes).forEach(k => {
          graph.addNode(k, exported.nodes[k]);
      });
  }
  if (exported.edges) {
      exported.edges.forEach((e: any) => {
          if(graph.hasNode(e.source) && graph.hasNode(e.target)) {
              graph.addEdge(e.source, e.target, e.attributes);
          }
      });
  }

  // Run Layout
  const positions = forceAtlas2(graph, { 
      iterations, 
      settings: { 
          gravity: 1.0,
          barnesHutOptimize: true 
      } 
  });

  self.postMessage({
    type: 'done',
    positions: positions
  });
};

export {};