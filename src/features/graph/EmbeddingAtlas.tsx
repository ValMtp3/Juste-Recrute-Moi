import { useRef, useState } from "react";
import type { TouchEvent, TouchList, WheelEvent as ReactWheelEvent } from "react";
import type { GraphStats } from "../../types";

type GraphPayload = NonNullable<GraphStats["graph"]>;
type GraphNodePayload = GraphPayload["nodes"][number];
type EmbeddingPoint = NonNullable<GraphStats["embedding"]>["points"][number];
type CameraMode = "orbit" | "front" | "top";
type SpatialCamera = { yaw: number; pitch: number; zoom: number };
type AtlasPoint = EmbeddingPoint & { hasVector: boolean };

function truncate(text: string, max = 24) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
function normalizeAngle(value: number) {
  let next = value % 360;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return Number(next.toFixed(1));
}
function isBadVectorLabel(value: string) {
  const lower = String(value || "").trim().toLowerCase();
  return !lower
    || lower.includes("404:")
    || lower.includes("not_found")
    || lower.includes("not found")
    || lower.includes("error code")
    || lower.includes("failed to fetch")
    || lower.includes("server returned")
    || lower.includes("traceback");
}
function seededUnit(seed: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

const TONES: Record<string, string> = {
  Profile: "purple",
  Skill: "orange",
  Project: "pink",
  Experience: "green",
  Candidate: "purple",
  Credential: "blue",
  Certification: "blue",
  Education: "blue",
  Achievement: "blue",
  JobLead: "blue",
};
function vectorTone(type: string) {
  return TONES[type] || "orange";
}

function graphNodePoint(node: GraphNodePayload, index: number): AtlasPoint {
  const typeSalt = node.type.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const angle = seededUnit(node.id, 211 + typeSalt) * Math.PI * 2;
  const ring = 0.22 + seededUnit(node.id, 307 + index) * 0.72;
  const vertical = (seededUnit(node.id, 419 + typeSalt) - 0.5) * 1.7;
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    x: clamp(Math.cos(angle) * ring, -1, 1),
    y: clamp(Math.sin(angle) * ring * 0.74 + vertical * 0.18, -1, 1),
    z: clamp(vertical, -1, 1),
    hasVector: false,
  };
}

function profileAtlasPoints(stats: GraphStats): AtlasPoint[] {
  const vectorPoints: AtlasPoint[] = (stats.embedding?.points || [])
    .filter(point => !isBadVectorLabel(point.label))
    .map(point => ({ ...point, hasVector: true }));
  const vectorKeys = new Set(vectorPoints.flatMap(point => [
    point.id,
    `${point.type}:${point.label}`.toLowerCase(),
  ]));
  const graphNodes = (stats.graph?.nodes || [])
    .filter(node => node.type !== "JobLead" && !isBadVectorLabel(node.label));
  const fallbackPoints = graphNodes
    .filter(node => !vectorKeys.has(node.id) && !vectorKeys.has(`${node.type}:${node.label}`.toLowerCase()))
    .map((node, index) => graphNodePoint(node, index));
  return [...vectorPoints, ...fallbackPoints].slice(0, 220);
}

function projectPoint(point: EmbeddingPoint, index: number, mode: CameraMode, camera: SpatialCamera) {
  const x = Math.max(-1, Math.min(1, point.x));
  const y = Math.max(-1, Math.min(1, point.y));
  const z = Math.max(-1, Math.min(1, point.z ?? Math.sin((index + 1) * 1.618) * 0.72));
  const base = mode === "front" ? { x, y, z } : mode === "top" ? { x, y: z, z: y } : { x, y, z };
  const yaw = (mode === "orbit" ? camera.yaw : 0) * (Math.PI / 180);
  const pitch = (mode === "orbit" ? camera.pitch : 0) * (Math.PI / 180);
  const yawed = {
    x: base.x * Math.cos(yaw) - base.z * Math.sin(yaw),
    y: base.y,
    z: base.x * Math.sin(yaw) + base.z * Math.cos(yaw),
  };
  return {
    x: yawed.x,
    y: yawed.y * Math.cos(pitch) - yawed.z * Math.sin(pitch),
    z: yawed.y * Math.sin(pitch) + yawed.z * Math.cos(pitch),
  };
}

export function EmbeddingAtlas({ stats }: { stats: GraphStats }) {
  const [mode, setMode] = useState<CameraMode>("orbit");
  const [selectedId, setSelectedId] = useState<string>("");
  const [camera, setCamera] = useState<SpatialCamera>({ yaw: -38, pitch: 24, zoom: 1 });
  const embeddingStageRef = useRef<HTMLDivElement | null>(null);
  const embeddingPinchRef = useRef({ active: false, distance: 0, zoom: 1 });
  const points = profileAtlasPoints(stats);
  const vectorRows = points.filter(point => point.hasVector).length;
  const graphRows = (stats.graph?.nodes || []).filter(node => node.type !== "JobLead").length;
  const selected = points.find(point => point.id === selectedId);
  const projected = points
    .map((point, index) => ({ point, projected: projectPoint(point, index, mode, camera) }))
    .sort((a, b) => a.projected.z - b.projected.z);
  const counts = points.reduce<Record<string, number>>((acc, point) => {
    acc[point.type] = (acc[point.type] || 0) + 1;
    return acc;
  }, {});
  const selectedProjected = selected ? projectPoint(selected, points.findIndex(point => point.id === selected.id), mode, camera) : null;
  const nearest = selected && selectedProjected
    ? points
        .filter(point => point.id !== selected.id)
        .map((point, index) => {
          const p = projectPoint(point, index, mode, camera);
          const distance = Math.sqrt((p.x - selectedProjected.x) ** 2 + (p.y - selectedProjected.y) ** 2 + (p.z - selectedProjected.z) ** 2);
          return { point, distance };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6)
    : points.slice(0, 6).map(point => ({ point, distance: 0 }));
  const embeddingTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const [first, second] = [touches[0], touches[1]];
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };
  const rotateEmbedding = (deltaX: number, deltaY: number) => {
    if (mode !== "orbit") return;
    setCamera(value => ({
      ...value,
      yaw: normalizeAngle(value.yaw + deltaX * 0.28),
      pitch: normalizeAngle(value.pitch - deltaY * 0.22),
    }));
  };
  const handleEmbeddingWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.target as Node)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey) {
      setCamera(value => ({ ...value, zoom: clamp(Number((value.zoom - event.deltaY * 0.0011).toFixed(2)), 0.65, 2.2) }));
      return;
    }
    rotateEmbedding(event.deltaX, event.deltaY);
  };
  const handleEmbeddingTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      event.stopPropagation();
      embeddingPinchRef.current = { active: true, distance: embeddingTouchDistance(event.touches), zoom: camera.zoom };
    }
  };
  const handleEmbeddingTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    event.stopPropagation();
    const distance = embeddingTouchDistance(event.touches);
    const start = embeddingPinchRef.current.distance || distance || 1;
    if (embeddingPinchRef.current.active && Math.abs(distance - start) > 8) {
      setCamera(value => ({ ...value, zoom: clamp(Number((embeddingPinchRef.current.zoom * (distance / start)).toFixed(2)), 0.65, 2.2) }));
      return;
    }
    const first = event.touches[0];
    const second = event.touches[1];
    const midpointX = (first.clientX + second.clientX) / 2;
    const midpointY = (first.clientY + second.clientY) / 2;
    const previous = embeddingStageRef.current?.dataset;
    const lastX = Number(previous?.touchX || midpointX);
    const lastY = Number(previous?.touchY || midpointY);
    rotateEmbedding(midpointX - lastX, midpointY - lastY);
    if (previous) {
      previous.touchX = String(midpointX);
      previous.touchY = String(midpointY);
    }
  };
  const handleEmbeddingTouchEnd = () => {
    embeddingPinchRef.current.active = false;
    if (embeddingStageRef.current?.dataset) {
      delete embeddingStageRef.current.dataset.touchX;
      delete embeddingStageRef.current.dataset.touchY;
    }
  };

  return (
    <section className="card graph-embedding-atlas-card" aria-labelledby="embedding-atlas-title">
      <div className="graph-card-head graph-studio-head">
        <div>
          <span className="eyebrow">Profile atlas</span>
          <h3 id="embedding-atlas-title">Profile space</h3>
          <p>Every profile graph entity is shown. Items with vectors use embedding coordinates; missing vectors get stable graph positions.</p>
        </div>
        <div className="graph-head-pills">
          <span className="pill mono">{points.length} items</span>
          <span className="pill mono">{vectorRows} vectors</span>
          <span className="pill mono">{mode}</span>
        </div>
      </div>
      <div className="graph-studio-toolbar">
        <div className="graph-filter-bar" aria-label="Embedding camera">
          {[
            ["orbit", "3D orbit"],
            ["front", "2D map"],
            ["top", "Depth map"],
          ].map(([id, label]) => (
            <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id as CameraMode)}>{label}</button>
          ))}
        </div>
        <div className="graph-zoom-controls" aria-label="Embedding zoom controls">
          <button onClick={() => setCamera(value => ({ ...value, zoom: clamp(Number((value.zoom - 0.15).toFixed(2)), 0.65, 2.2) }))}>-</button>
          <input
            aria-label="Embedding zoom"
            type="range"
            min="0.65"
            max="2.2"
            step="0.05"
            value={camera.zoom}
            onChange={event => setCamera(value => ({ ...value, zoom: Number(event.target.value) }))}
          />
          <button onClick={() => setCamera(value => ({ ...value, zoom: clamp(Number((value.zoom + 0.15).toFixed(2)), 0.65, 2.2) }))}>+</button>
          <button onClick={() => setCamera({ yaw: -38, pitch: 24, zoom: 1 })}>Reset</button>
          <span>{Math.round(camera.zoom * 100)}%</span>
        </div>
        {mode === "orbit" && (
          <div className="graph-rotation-controls" aria-label="3D rotation controls">
            <label>
              <span>Yaw</span>
              <input type="range" min="-180" max="180" step="2" value={camera.yaw} onChange={event => setCamera(value => ({ ...value, yaw: Number(event.target.value) }))} />
            </label>
            <label>
              <span>Pitch</span>
              <input type="range" min="-180" max="180" step="2" value={camera.pitch} onChange={event => setCamera(value => ({ ...value, pitch: Number(event.target.value) }))} />
            </label>
          </div>
        )}
      </div>
      <div className="graph-studio-metrics" aria-label="Embedding summary">
        <div>
          <span>{points.length}</span>
          <small>profile items</small>
        </div>
        <div>
          <span>{vectorRows}</span>
          <small>vector-backed</small>
        </div>
        <div>
          <span>{Object.keys(counts).length}</span>
          <small>entity groups</small>
        </div>
        <div>
          <span>{graphRows}</span>
          <small>graph rows</small>
        </div>
      </div>
      <div className="graph-embedding-atlas-layout">
        <div
          ref={embeddingStageRef}
          className="graph-embedding-stage graph-embedding-stage-interactive"
          onWheel={handleEmbeddingWheel}
          onTouchStart={handleEmbeddingTouchStart}
          onTouchMove={handleEmbeddingTouchMove}
          onTouchEnd={handleEmbeddingTouchEnd}
          onTouchCancel={handleEmbeddingTouchEnd}
        >
          {points.length > 0 ? (
            <svg viewBox="0 0 920 520" className="graph-embedding-atlas-svg" role="img" aria-label="Profile graph and vector projection">
              <defs>
                <radialGradient id="embeddingGlow">
                  <stop offset="0%" stopColor="rgba(var(--white-rgb),0.95)" />
                  <stop offset="100%" stopColor="rgba(var(--cream-rgb),0.25)" />
                </radialGradient>
              </defs>
              <ellipse cx="460" cy="260" rx="330" ry="170" className="graph-embedding-orbit" />
              <line x1="130" y1="260" x2="790" y2="260" className="graph-embedding-axis" />
              <line x1="460" y1="84" x2="460" y2="436" className="graph-embedding-axis" />
              <circle cx="460" cy="260" r="112" className="graph-embedding-core" />
              {projected.map(({ point, projected: p }) => {
                const tone = vectorTone(point.type);
                const perspective = 1 + p.z * 0.18;
                const px = 460 + p.x * 310 * camera.zoom * perspective;
                const py = 260 + p.y * 170 * camera.zoom * perspective;
                const depth = (p.z + 1) / 2;
                const radius = (4.5 + depth * 7) * (0.82 + camera.zoom * 0.18);
                const active = point.id === selected?.id;
                return (
                  <g
                    key={`${point.type}-${point.id}`}
                    className={`graph-embedding-point ${active ? "active" : ""} ${point.hasVector ? "vector-backed" : "graph-backed"}`}
                    transform={`translate(${px},${py})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${point.type} ${point.hasVector ? "vector" : "profile item"} ${point.label}`}
                    onClick={() => setSelectedId(active ? "" : point.id)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(active ? "" : point.id);
                      }
                    }}
                  >
                    <circle r={radius + 7} fill={`var(--${tone}-soft)`} opacity={0.15 + depth * 0.25} />
                    <circle
                      r={radius}
                      fill={`var(--${tone})`}
                      stroke={`var(--${tone}-ink)`}
                      strokeWidth={active ? 2.6 : 1.4}
                    >
                      <title>{`${point.label} (${point.type}${point.hasVector ? ", vector-backed" : ", graph-only"})`}</title>
                    </circle>
                    {active && (
                      <>
                        <line x1={0} y1={0} x2="42" y2="-24" className="graph-embedding-callout-line" />
                        <rect x="42" y="-42" width="170" height="32" rx="9" className="graph-embedding-callout" />
                        <text x="54" y="-23" className="graph-atlas-label">{truncate(point.label, 22)}</text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="graph-vector-empty compact">
              <strong>No vector rows yet</strong>
              <span>No profile graph items are available yet. Add profile context or run graph repair.</span>
            </div>
          )}
        </div>
        <aside className="graph-studio-inspector">
          <div className="graph-board-subhead">
            <span className="eyebrow">Profile focus</span>
            <span className="pill mono">{Object.keys(counts).length} groups</span>
          </div>
          <h4>{selected ? selected.label : "Profile atlas"}</h4>
          <p>{selected ? `${selected.type} profile item${selected.hasVector ? " with a local vector row." : " without a vector yet, placed from the graph."}` : points.length ? "Select a point to inspect nearby visible profile evidence and entity group." : "No profile graph items are available yet."}</p>
          <div className="graph-mini-label">Nearest visible profile items</div>
          <div className="graph-node-pick-list compact">
            {nearest.map(({ point }) => (
              <button key={point.id} className="graph-node-pick" onClick={() => setSelectedId(point.id)}>
                <span>{truncate(point.label, 26)}</span>
                <small>{point.hasVector ? point.type : `${point.type} · graph`}</small>
              </button>
            ))}
          </div>
          <div className="graph-mini-label">Groups</div>
          <div className="graph-legend stacked">
            {Object.entries(counts).map(([type, count]) => (
              <span key={type}><i className={`legend-dot ${type.toLowerCase()}`} /> {type}<b>{count}</b></span>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
