import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import type { GraphStats } from "../../types";

type GraphPayload = NonNullable<GraphStats["graph"]>;
type RawNode = GraphPayload["nodes"][number];
type RawEdge = GraphPayload["edges"][number];

type SimNode = {
  id: string;
  label: string;
  type: string;
  subtitle: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};
type SimLink = { source: string | SimNode; target: string | SimNode; type: string };

const W = 1200;
const H = 760;

// One familiar palette + size per node type. Skills also grow with how connected
// they are, giving a natural visual hierarchy without any extra UI.
const TYPE_META: Record<string, { tone: string; radius: number; z: number }> = {
  Candidate: { tone: "ink", radius: 18, z: 5 },
  Project: { tone: "purple", radius: 13, z: 4 },
  Experience: { tone: "orange", radius: 12, z: 3 },
  Credential: { tone: "teal", radius: 10, z: 2 },
  Skill: { tone: "blue", radius: 6, z: 1 },
};
const toneOf = (type: string) => TYPE_META[type]?.tone ?? "blue";

// Filter chips — show one type at a time (plus the candidate hub), or everything.
const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Project", label: "Projects" },
  { key: "Skill", label: "Skills" },
  { key: "Experience", label: "Experience" },
  { key: "Credential", label: "Credentials" },
];

const REL_COPY: Record<string, string> = {
  BUILT: "built",
  WORKED_AS: "role",
  HAS_SKILL: "skill",
  PROJ_UTILIZES: "uses",
  EXP_UTILIZES: "uses",
  CERTIFIES: "certifies",
  EDUCATES: "teaches",
  ACHIEVEMENT_USES: "uses",
  RELATED_SKILL: "related",
  SIMILAR_PROJECT: "similar",
  SUPPORTS_EXPERIENCE: "supports",
  HAS_CERTIFICATION: "credential",
  HAS_EDUCATION: "education",
  HAS_ACHIEVEMENT: "achievement",
};

function radiusFor(type: string, degree: number): number {
  const base = TYPE_META[type]?.radius ?? 6;
  return type === "Skill" ? base + Math.min(7, degree) : base;
}

export function GraphCanvas({ nodes, edges }: { nodes: RawNode[]; edges: RawEdge[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [hoverId, setHoverId] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [layout, setLayout] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [ready, setReady] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewRef = useRef<SVGGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const panState = useRef<{ active: boolean; lastX: number; lastY: number; moved: boolean }>({ active: false, lastX: 0, lastY: 0, moved: false });
  const dragState = useRef<{ id: string; moved: boolean } | null>(null);

  // Degree across the FULL graph (used for sizing + the details panel).
  const degree = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of edges) {
      map.set(edge.source, (map.get(edge.source) || 0) + 1);
      map.set(edge.target, (map.get(edge.target) || 0) + 1);
    }
    return map;
  }, [edges]);

  // What's on screen for the current filter: the chosen type (+ the candidate
  // hub so the graph never looks rootless), with edges between visible nodes.
  const { viewNodes, viewEdges, nodeById } = useMemo(() => {
    const keep = (node: RawNode) => filter === "all" || node.type === filter || node.type === "Candidate";
    const vNodes = nodes.filter(node => keep(node) && node.type !== "JobLead");
    const ids = new Set(vNodes.map(node => node.id));
    const vEdges = edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
    const byId = new Map(vNodes.map(node => [node.id, node]));
    return { viewNodes: vNodes, viewEdges: vEdges, nodeById: byId };
  }, [nodes, edges, filter]);

  // Run the force layout whenever the visible set changes. Settle synchronously
  // (off the paint frame) so the graph appears already laid out, then keep the
  // sim around so dragging a node nudges its neighbours like a real force graph.
  useEffect(() => {
    if (!viewNodes.length) {
      setLayout(new Map());
      setReady(true);
      return;
    }
    setReady(false);
    const handle = setTimeout(() => {
      const simNodes: SimNode[] = viewNodes.map(node => ({
        id: node.id,
        label: node.label,
        type: node.type,
        subtitle: node.subtitle || "",
        x: W / 2 + (Math.random() - 0.5) * 60,
        y: H / 2 + (Math.random() - 0.5) * 60,
      }));
      const index = new Map(simNodes.map(node => [node.id, node]));
      const simLinks: SimLink[] = viewEdges
        .filter(edge => index.has(edge.source) && index.has(edge.target))
        .map(edge => ({ source: edge.source, target: edge.target, type: edge.type }));

      const sim = forceSimulation(simNodes)
        .force("link", forceLink<SimNode, SimLink>(simLinks).id(node => node.id).distance(link => {
          const t = (typeof link.target === "object" ? link.target.type : "");
          return t === "Skill" ? 64 : 110;
        }).strength(0.22))
        .force("charge", forceManyBody().strength(-260).distanceMax(540))
        .force("center", forceCenter(W / 2, H / 2))
        .force("collide", forceCollide<SimNode>().radius(node => radiusFor(node.type, degree.get(node.id) || 0) + 7).iterations(2))
        .force("x", forceX(W / 2).strength(0.03))
        .force("y", forceY(H / 2).strength(0.05))
        .stop();

      const ticks = Math.min(420, 120 + simNodes.length * 2);
      for (let i = 0; i < ticks; i += 1) sim.tick();

      simRef.current = sim;
      const next = new Map<string, { x: number; y: number }>();
      simNodes.forEach(node => next.set(node.id, { x: node.x, y: node.y }));
      setLayout(next);
      setReady(true);
      fitToView(next);
    }, 0);
    return () => clearTimeout(handle);
    // fitToView is stable (useCallback); degree changes track edges.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewNodes, viewEdges, degree]);

  const fitToView = useCallback((positions: Map<string, { x: number; y: number }>) => {
    if (!positions.size) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    positions.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    const pad = 80;
    const spanX = Math.max(1, maxX - minX) + pad * 2;
    const spanY = Math.max(1, maxY - minY) + pad * 2;
    const nextZoom = Math.max(0.3, Math.min(1.8, Math.min(W / spanX, H / spanY)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoom(nextZoom);
    setPan({ x: W / 2 - cx * nextZoom, y: H / 2 - cy * nextZoom });
  }, []);

  // Neighbourhood of the focused node (itself + everything one hop away).
  const neighbourhood = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    for (const edge of viewEdges) {
      if (edge.source === selectedId) set.add(edge.target);
      if (edge.target === selectedId) set.add(edge.source);
    }
    return set;
  }, [selectedId, viewEdges]);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = useCallback(
    (node: { id: string; label: string }) => !normalizedQuery || node.label.toLowerCase().includes(normalizedQuery),
    [normalizedQuery],
  );

  const isActive = useCallback(
    (id: string, label: string) => {
      if (normalizedQuery && !label.toLowerCase().includes(normalizedQuery)) return false;
      if (neighbourhood) return neighbourhood.has(id);
      return true;
    },
    [normalizedQuery, neighbourhood],
  );

  // ── pointer → graph coordinate mapping (handles viewBox + pan/zoom) ──────────
  const toGraph = (clientX: number, clientY: number) => {
    const g = viewRef.current;
    const svg = svgRef.current;
    if (!g || !svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = g.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  };
  const rootScale = () => {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? ctm.a : 1;
  };

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = Math.max(0.25, Math.min(2.6, zoom * factor));
    const gp = toGraph(event.clientX, event.clientY);
    setPan(prev => ({ x: prev.x + (zoom - nextZoom) * gp.x, y: prev.y + (zoom - nextZoom) * gp.y }));
    setZoom(nextZoom);
  };

  const onStagePointerDown = (event: React.PointerEvent) => {
    if (dragState.current) return;
    panState.current = { active: true, lastX: event.clientX, lastY: event.clientY, moved: false };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };
  const onStagePointerMove = (event: React.PointerEvent) => {
    if (dragState.current) {
      const gp = toGraph(event.clientX, event.clientY);
      dragState.current.moved = true;
      const id = dragState.current.id;
      setLayout(prev => {
        const next = new Map(prev);
        next.set(id, { x: gp.x, y: gp.y });
        return next;
      });
      const node = simRef.current?.nodes().find(n => n.id === id);
      if (node) { node.fx = gp.x; node.fy = gp.y; }
      return;
    }
    if (!panState.current.active) return;
    const scale = rootScale();
    const dx = (event.clientX - panState.current.lastX) / scale;
    const dy = (event.clientY - panState.current.lastY) / scale;
    panState.current.lastX = event.clientX;
    panState.current.lastY = event.clientY;
    panState.current.moved = true;
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };
  const onStagePointerUp = (event: React.PointerEvent) => {
    if (dragState.current) {
      const node = simRef.current?.nodes().find(n => n.id === dragState.current?.id);
      if (node) { node.fx = null; node.fy = null; }
      dragState.current = null;
    } else if (panState.current.active && !panState.current.moved) {
      setSelectedId(""); // click on empty space clears focus
    }
    panState.current.active = false;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  };

  const onNodePointerDown = (event: React.PointerEvent, id: string) => {
    event.stopPropagation();
    dragState.current = { id, moved: false };
    (event.currentTarget.parentElement as Element)?.closest("svg")?.setPointerCapture?.(event.pointerId);
  };
  const onNodeClick = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    if (dragState.current?.moved) return; // a drag isn't a click
    setSelectedId(prev => (prev === id ? "" : id));
  };

  // disable native page scroll-zoom over the stage
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    svg.addEventListener("wheel", stop, { passive: false });
    return () => svg.removeEventListener("wheel", stop);
  }, []);

  const selectedNode = selectedId ? nodeById.get(selectedId) : undefined;
  const connections = useMemo(() => {
    if (!selectedId) return [] as { node: RawNode; rel: string }[];
    const out: { node: RawNode; rel: string }[] = [];
    const seen = new Set<string>();
    for (const edge of edges) {
      const otherId = edge.source === selectedId ? edge.target : edge.target === selectedId ? edge.source : "";
      if (!otherId || seen.has(otherId)) continue;
      const other = nodes.find(n => n.id === otherId);
      if (!other) continue;
      seen.add(otherId);
      out.push({ node: other, rel: REL_COPY[edge.type] || edge.type.toLowerCase().replace(/_/g, " ") });
    }
    return out.sort((a, b) => (TYPE_META[b.node.type]?.z ?? 0) - (TYPE_META[a.node.type]?.z ?? 0));
  }, [selectedId, edges, nodes]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const node of nodes) if (node.type !== "JobLead") c[node.type] = (c[node.type] || 0) + 1;
    return c;
  }, [nodes]);

  const showLabel = (type: string, id: string, label: string) =>
    type !== "Skill" || hoverId === id || selectedId === id || (!!normalizedQuery && label.toLowerCase().includes(normalizedQuery)) || (neighbourhood?.has(id) ?? false);

  return (
    <section className="card kg-card" aria-label="Knowledge graph">
      <div className="kg-toolbar">
        <div className="kg-filters" role="group" aria-label="Filter by type">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => { setFilter(key); setSelectedId(""); }}
            >
              {label}
              {key !== "all" && <span className="kg-count">{counts[key] || 0}</span>}
            </button>
          ))}
        </div>
        <label className="kg-search">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search nodes…"
            aria-label="Search graph nodes"
          />
        </label>
        <div className="kg-zoom" aria-label="Zoom">
          <button onClick={() => setZoom(z => Math.max(0.25, z / 1.15))} aria-label="Zoom out">−</button>
          <button onClick={() => setZoom(z => Math.min(2.6, z * 1.15))} aria-label="Zoom in">+</button>
          <button onClick={() => fitToView(layout)} aria-label="Fit to view">Fit</button>
        </div>
      </div>

      <div className="kg-body">
        <div className="kg-stage" >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="kg-svg"
            preserveAspectRatio="xMidYMid meet"
            onWheel={onWheel}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerLeave={onStagePointerUp}
            role="application"
            aria-label="Interactive knowledge graph. Scroll to zoom, drag to pan, click a node to focus it."
          >
            <g ref={viewRef} transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {ready && viewEdges.map((edge, i) => {
                const a = layout.get(edge.source);
                const b = layout.get(edge.target);
                if (!a || !b) return null;
                const active = (!neighbourhood || (neighbourhood.has(edge.source) && neighbourhood.has(edge.target)))
                  && (!normalizedQuery || (matches({ id: edge.source, label: nodeById.get(edge.source)?.label || "" }) || matches({ id: edge.target, label: nodeById.get(edge.target)?.label || "" })));
                return (
                  <line
                    key={`${edge.source}->${edge.target}-${i}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    className={`kg-edge ${active ? "" : "dim"}`}
                  />
                );
              })}
              {ready && viewNodes.map(node => {
                const p = layout.get(node.id);
                if (!p) return null;
                const r = radiusFor(node.type, degree.get(node.id) || 0);
                const tone = toneOf(node.type);
                const active = isActive(node.id, node.label);
                const selected = node.id === selectedId;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${p.x} ${p.y})`}
                    className={`kg-node ${active ? "" : "dim"} ${selected ? "selected" : ""}`}
                    onPointerDown={event => onNodePointerDown(event, node.id)}
                    onClick={event => onNodeClick(event, node.id)}
                    onMouseEnter={() => setHoverId(node.id)}
                    onMouseLeave={() => setHoverId("")}
                    style={{ ["--kg-tone" as string]: `var(--${tone})`, ["--kg-tone-soft" as string]: `var(--${tone}-soft)` }}
                  >
                    {selected && <circle r={r + 6} className="kg-node-ring" />}
                    <circle r={r} className="kg-node-dot" />
                    {showLabel(node.type, node.id, node.label) && (
                      <text y={r + 13} className="kg-node-label">{node.label.length > 26 ? `${node.label.slice(0, 25)}…` : node.label}</text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {!ready && <div className="kg-laying">Laying out graph…</div>}
          {ready && !viewNodes.length && <div className="kg-empty">No {filter === "all" ? "" : `${filter.toLowerCase()} `}nodes yet. Add context to build your graph.</div>}

          <div className="kg-legend" aria-hidden="true">
            {Object.entries(TYPE_META).filter(([type]) => type !== "Candidate").map(([type, meta]) => (
              <span key={type}><i style={{ background: `var(--${meta.tone})` }} />{type}</span>
            ))}
          </div>
        </div>

        <aside className={`kg-inspector ${selectedNode ? "open" : ""}`} aria-live="polite">
          {selectedNode ? (
            <>
              <div className="kg-inspector-head">
                <span className="kg-chip" style={{ background: `var(--${toneOf(selectedNode.type)}-soft)`, color: `var(--${toneOf(selectedNode.type)}-ink)` }}>{selectedNode.type}</span>
                <button className="kg-close" onClick={() => setSelectedId("")} aria-label="Close">×</button>
              </div>
              <h3 className="kg-inspector-title">{selectedNode.label}</h3>
              {selectedNode.subtitle && <p className="kg-inspector-sub">{selectedNode.subtitle}</p>}
              <div className="kg-inspector-count">{connections.length} connection{connections.length === 1 ? "" : "s"}</div>
              <ul className="kg-conn-list">
                {connections.map(({ node, rel }) => (
                  <li key={node.id}>
                    <button onClick={() => setSelectedId(node.id)}>
                      <i style={{ background: `var(--${toneOf(node.type)})` }} />
                      <span className="kg-conn-label">{node.label}</span>
                      <span className="kg-conn-rel">{rel}</span>
                    </button>
                  </li>
                ))}
                {!connections.length && <li className="kg-conn-empty">No connections yet.</li>}
              </ul>
            </>
          ) : (
            <div className="kg-inspector-hint">
              <h3>Explore your graph</h3>
              <p>Click any node to focus it and see what it connects to. Scroll to zoom, drag to pan, drag a node to rearrange.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
