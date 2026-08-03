// Route search over the verified circulation graph.
//
// The model is never allowed to draw a path. It decides which two places the tenant
// is asking about; the doorways drawn on the plan decide how you actually walk
// between them. Every waypoint returned here comes from a reviewed `connects`
// relation in the floorplan index.

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildGraph(catalog) {
  const graph = new Map();
  for (const connection of catalog.connections || []) {
    const [first, second] = connection.regionIds;
    if (!graph.has(first)) graph.set(first, []);
    if (!graph.has(second)) graph.set(second, []);
    graph.get(first).push({ to: second, connection });
    graph.get(second).push({ to: first, connection });
  }
  return graph;
}

const graphCache = new WeakMap();

function graphFor(catalog) {
  if (!graphCache.has(catalog)) graphCache.set(catalog, buildGraph(catalog));
  return graphCache.get(catalog);
}

export function floorplanRegionIsConnected(catalog, regionId) {
  return graphFor(catalog).has(regionId);
}

const COMPASS = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];

function bearing(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const sector = Math.round(angle / (Math.PI / 4));
  return COMPASS[(sector + COMPASS.length) % COMPASS.length];
}

// Dijkstra over doorway-to-doorway walking distance. Ties are broken by leg count so
// the shortest sensible sequence of rooms wins rather than an equally long detour.
function shortestPath(graph, fromId, toId) {
  const best = new Map([[fromId, { cost: 0, legs: 0, previous: null, connection: null }]]);
  const visited = new Set();
  while (visited.size < best.size) {
    let currentId = null;
    for (const [id, entry] of best) {
      if (visited.has(id)) continue;
      if (currentId === null || entry.cost < best.get(currentId).cost) currentId = id;
    }
    if (currentId === null) break;
    if (currentId === toId) break;
    visited.add(currentId);
    const current = best.get(currentId);
    const currentPoint = current.connection ? current.connection.at : null;
    for (const edge of graph.get(currentId) || []) {
      if (visited.has(edge.to)) continue;
      const step = currentPoint ? distance(currentPoint, edge.connection.at) : 0;
      const candidate = { cost: current.cost + step, legs: current.legs + 1, previous: currentId, connection: edge.connection };
      const existing = best.get(edge.to);
      if (!existing || candidate.cost < existing.cost
        || (candidate.cost === existing.cost && candidate.legs < existing.legs)) {
        best.set(edge.to, candidate);
      }
    }
  }
  if (!best.has(toId)) return null;
  const sequence = [];
  for (let id = toId; id !== null; id = best.get(id).previous) {
    sequence.unshift({ regionId: id, connection: best.get(id).connection });
  }
  return sequence;
}

/**
 * Resolve a walking route between two regions using only drawn circulation.
 * Returns null when the plan does not connect them.
 */
export function routeBetweenRegions(catalog, fromRegionId, toRegionId) {
  if (!catalog || fromRegionId === toRegionId) return null;
  const graph = graphFor(catalog);
  if (!graph.has(fromRegionId) || !graph.has(toRegionId)) return null;
  const sequence = shortestPath(graph, fromRegionId, toRegionId);
  if (!sequence || sequence.length < 2) return null;

  const regionsById = new Map(catalog.regions.map((region) => [region.id, region]));
  const anchorOf = (regionId) => regionsById.get(regionId).labelAnchor;
  const points = [anchorOf(fromRegionId), ...sequence.slice(1).map((step) => step.connection.at), anchorOf(toRegionId)];

  const legs = sequence.slice(1).map((step, index) => {
    const previous = sequence[index];
    const start = index === 0 ? anchorOf(fromRegionId) : sequence[index].connection.at;
    return {
      fromRegionId: previous.regionId,
      toRegionId: step.regionId,
      via: step.connection.via,
      at: step.connection.at,
      direction: bearing(start, step.connection.at)
    };
  });

  return {
    regionIds: sequence.map((step) => step.regionId),
    legs,
    points,
    distance: points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0)
  };
}

/**
 * A compact, geometry-free description of the graph for the model. It can reason about
 * which rooms adjoin which without ever receiving drawing coordinates.
 */
export function circulationForModel(catalog) {
  return (catalog.connections || []).map(({ regionIds, via }) => ({ regionIds, via }));
}
