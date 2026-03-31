'use client';
import { useState, useRef, useCallback } from "react";

/*
  FLOOR ZONE MAPPER
  =================
  1. Place your building image as /selector.png in public/
  2. Run this page alongside your project
  3. Select a floor from the left panel
  4. Click points on the image to trace the polygon for that floor
  5. When done, copy the output code and paste it into your page.tsx
  
  Tips:
  - Click points clockwise around each floor
  - Use "Undo" to remove the last point
  - Use "Clear" to start over for a floor
  - The SVG viewBox is 600x579 to match your image aspect ratio — 
    adjust if your image has different proportions
*/

const FLOORS = [
  { id: 6, label: "6. NP" },
  { id: 5, label: "5. NP" },
  { id: 4, label: "4. NP" },
  { id: 3, label: "3. NP" },
  { id: 2, label: "2. NP" },
];

// ← CHANGE THIS to match your image's natural aspect ratio
const VB_W = 600;
const VB_H = 579;

const COLORS: Record<number, string> = {
  6: "#e74c3c",
  5: "#e67e22",
  4: "#f1c40f",
  3: "#2ecc71",
  2: "#3498db",
};

export default function FloorMapper() {
  const [zones, setZones] = useState<Record<number, [number, number][]>>({});
  const [activeFloor, setActiveFloor] = useState<number>(6);
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * VB_W);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * VB_H);

    setZones(prev => ({
      ...prev,
      [activeFloor]: [...(prev[activeFloor] || []), [x, y]],
    }));
  }, [activeFloor]);

  const handleMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * VB_W);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * VB_H);
    setCursor([x, y]);
  }, []);

  const undo = () => {
    setZones(prev => {
      const pts = prev[activeFloor] || [];
      if (pts.length === 0) return prev;
      return { ...prev, [activeFloor]: pts.slice(0, -1) };
    });
  };

  const clear = () => {
    setZones(prev => ({ ...prev, [activeFloor]: [] }));
  };

  const clearAll = () => setZones({});

  // Generate the output code
  const output = `const FLOOR_ZONES: Record<number, string> = {\n${FLOORS.map(f => {
    const pts = zones[f.id] || [];
    const str = pts.map(p => `${p[0]},${p[1]}`).join(" ");
    return `  ${f.id}: "${str}",`;
  }).join("\n")}\n};`;

  const activePoints = zones[activeFloor] || [];
  const activeColor = COLORS[activeFloor] || "#999";

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#1a1a2e", color: "#eee", minHeight: "100vh", display: "flex" }}>
      
      {/* LEFT PANEL */}
      <div style={{ width: 280, background: "#16213e", padding: 20, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0, overflowY: "auto" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>Floor Zone Mapper</h1>
        <p style={{ fontSize: 12, color: "#8899aa", margin: 0, lineHeight: 1.5 }}>
          Select a floor, then click on the building image to place polygon points. Go clockwise.
        </p>

        <div style={{ borderTop: "1px solid #2a3a5a", paddingTop: 12 }}>
          <p style={{ fontSize: 11, color: "#6688aa", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 }}>Active Floor</p>
          {FLOORS.map(f => {
            const pts = zones[f.id] || [];
            const isActive = activeFloor === f.id;
            return (
              <button key={f.id} onClick={() => setActiveFloor(f.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", padding: "10px 14px", marginBottom: 4,
                  background: isActive ? COLORS[f.id] + "25" : "transparent",
                  border: isActive ? `2px solid ${COLORS[f.id]}` : "1px solid #2a3a5a",
                  borderRadius: 8, cursor: "pointer", color: "#eee",
                  fontSize: 14, fontWeight: isActive ? 700 : 400,
                  transition: "all 0.15s",
                }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS[f.id], display: "inline-block" }} />
                  {f.label}
                </span>
                <span style={{ fontSize: 11, color: "#6688aa" }}>{pts.length} pts</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={undo} style={{ flex: 1, padding: "8px 0", borderRadius: 6, background: "#2a3a5a", border: "none", color: "#ccc", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            ↩ Undo
          </button>
          <button onClick={clear} style={{ flex: 1, padding: "8px 0", borderRadius: 6, background: "#2a3a5a", border: "none", color: "#ccc", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            ✕ Clear
          </button>
        </div>
        <button onClick={clearAll} style={{ padding: "8px 0", borderRadius: 6, background: "#3a1a1a", border: "1px solid #5a2a2a", color: "#e88", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          Clear All Floors
        </button>

        {/* Coordinates list */}
        <div style={{ borderTop: "1px solid #2a3a5a", paddingTop: 12 }}>
          <p style={{ fontSize: 11, color: "#6688aa", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 }}>
            Points for {FLOORS.find(f => f.id === activeFloor)?.label}
          </p>
          <div style={{ fontSize: 12, color: "#99aabb", fontFamily: "monospace", lineHeight: 1.8 }}>
            {activePoints.length === 0 && <span style={{ color: "#556677" }}>Click on image to add points...</span>}
            {activePoints.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Point {i + 1}: <span style={{ color: activeColor }}>{p[0]}, {p[1]}</span></span>
                <button onClick={() => {
                  setZones(prev => ({
                    ...prev,
                    [activeFloor]: (prev[activeFloor] || []).filter((_, idx) => idx !== i)
                  }));
                }} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Cursor position */}
        {cursor && (
          <div style={{ fontSize: 12, color: "#556677", fontFamily: "monospace", textAlign: "center", padding: 4 }}>
            Cursor: {cursor[0]}, {cursor[1]}
          </div>
        )}
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20, gap: 16 }}>
        
        {/* Image + SVG overlay */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "relative", maxWidth: "100%", maxHeight: "calc(100vh - 200px)" }}>
            <img
              src="/selector.png"
              alt="Building"
              style={{ display: "block", maxWidth: "100%", maxHeight: "calc(100vh - 200px)", objectFit: "contain" }}
              draggable={false}
            />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              onClick={handleClick}
              onMouseMove={handleMove}
              onMouseLeave={() => setCursor(null)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "crosshair" }}
            >
              {/* Render all floors' polygons */}
              {FLOORS.map(f => {
                const pts = zones[f.id] || [];
                if (pts.length < 2) return null;
                const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(" ");
                const isActive = f.id === activeFloor;
                return (
                  <g key={f.id}>
                    <polygon
                      points={pointsStr}
                      fill={COLORS[f.id] + (isActive ? "30" : "15")}
                      stroke={COLORS[f.id]}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      strokeDasharray={isActive ? "none" : "6,3"}
                    />
                    {/* Floor label */}
                    {pts.length >= 3 && (() => {
                      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
                      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
                      return <text x={cx} y={cy + 4} textAnchor="middle" fontSize="14" fontWeight="700"
                        fill="#fff" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)", pointerEvents: "none" }}>{f.label}</text>;
                    })()}
                  </g>
                );
              })}

              {/* Active floor points */}
              {activePoints.map((p, i) => (
                <g key={i}>
                  <circle cx={p[0]} cy={p[1]} r="6" fill={activeColor} stroke="#fff" strokeWidth="2" />
                  <text x={p[0] + 10} y={p[1] + 4} fontSize="10" fill="#fff" fontWeight="600"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)", pointerEvents: "none" }}>{i + 1}</text>
                </g>
              ))}

              {/* Preview line from last point to cursor */}
              {cursor && activePoints.length > 0 && (
                <line
                  x1={activePoints[activePoints.length - 1][0]}
                  y1={activePoints[activePoints.length - 1][1]}
                  x2={cursor[0]} y2={cursor[1]}
                  stroke={activeColor} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6"
                />
              )}

              {/* Cursor crosshair */}
              {cursor && (
                <g opacity="0.4">
                  <line x1={cursor[0]} y1={0} x2={cursor[0]} y2={VB_H} stroke="#fff" strokeWidth="0.5" />
                  <line x1={0} y1={cursor[1]} x2={VB_W} y2={cursor[1]} stroke="#fff" strokeWidth="0.5" />
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Output code */}
        <div style={{ background: "#0d1117", border: "1px solid #2a3a5a", borderRadius: 8, padding: 16, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 11, color: "#6688aa", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: 0 }}>
              Output — paste into page.tsx
            </p>
            <button
              onClick={() => { navigator.clipboard.writeText(output); }}
              style={{ padding: "4px 12px", borderRadius: 4, background: "#2a9d5c", border: "none", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              Copy
            </button>
          </div>
          <pre style={{ fontSize: 13, color: "#c9d1d9", fontFamily: "'Fira Code', 'Cascadia Code', monospace", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {output}
          </pre>
        </div>
      </div>
    </div>
  );
}