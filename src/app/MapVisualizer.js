"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

// Expanded structural layout mirroring the sprawling geometry of the full London Tube Map
const MAP_DATA = {
  lines: {
    victoria: { 
      color: "#0098D4", 
      paths: [
        [[1000, -200], [800, 200], [600, 500], [450, 750], [350, 1100], [350, 1400]]
      ]
    },
    central: { 
      color: "#DC241F", 
      paths: [
        [[-200, 650], [200, 650], [450, 750], [800, 750], [1100, 600], [1600, 600]],
        [[1100, 600], [1300, 400], [1500, 300]] // Hainault loop hint
      ]
    },
    piccadilly: { 
      color: "#003688", 
      paths: [
        [[-300, 1200], [50, 950], [300, 800], [600, 750], [800, 500], [1000, 200], [1200, -100]],
        [[-300, 950], [50, 950]] // Uxbridge branch
      ]
    },
    jubilee: { 
      color: "#868F98", 
      paths: [
        [[100, 0], [300, 300], [500, 500], [700, 850], [1000, 850], [1200, 650], [1600, 650]]
      ]
    },
    northern: { 
      color: "#FFFFFF", 
      paths: [
        [[500, -100], [600, 200], [600, 500], [700, 800], [600, 1200], [500, 1600]], // Edgware & Bank Branch
        [[800, -100], [800, 300], [750, 500], [700, 800]] // High Barnet & CX Branch
      ]
    },
    bakerloo: { 
      color: "#B26300", 
      paths: [
        [[100, 100], [300, 300], [500, 500], [600, 750], [700, 900], [750, 1100]]
      ]
    },
    district: {
      color: "#00782A",
      paths: [
        [[-200, 850], [200, 850], [400, 950], [900, 950], [1200, 850], [1700, 850]], // Main line Upminster
        [[200, 1200], [200, 850]], // Wimbledon
        [[0, 1100], [200, 850]] // Richmond
      ]
    },
    circle: {
      color: "#FFD329",
      paths: [
        [[350, 700], [850, 700], [850, 950], [350, 950], [350, 700]] // Center loop
      ]
    },
    metropolitan: {
      color: "#9B0058",
      paths: [
        [[-300, 200], [200, 400], [500, 550], [850, 700]]
      ]
    },
    hammersmith: {
      color: "#F3A9BB",
      paths: [
        [[100, 650], [350, 700], [850, 700], [1000, 600], [1200, 550]]
      ]
    }
  },
  stationLabels: [
    { name: 'Oxford Circus', x: 600, y: 750, dx: -20, dy: -25 },
    { name: 'Piccadilly Circus', x: 600, y: 800, dx: 25, dy: 15 },
    { name: 'Green Park', x: 500, y: 750, dx: -15, dy: -25 },
    { name: 'Leicester Square', x: 700, y: 750, dx: 15, dy: -25 },
    { name: 'Charing Cross', x: 700, y: 800, dx: 25, dy: 5 },
    { name: 'Embankment', x: 750, y: 850, dx: 25, dy: 25 },
    { name: 'Westminster', x: 500, y: 850, dx: -25, dy: 25 },
    { name: 'Waterloo', x: 800, y: 900, dx: 25, dy: 25 },
    { name: 'King\'s Cross', x: 700, y: 500, dx: 25, dy: -25 },
    { name: 'Stratford', x: 1200, y: 650, dx: 0, dy: -25 },
    { name: 'Heathrow', x: -300, y: 1200, dx: 0, dy: 25 },
    { name: 'Epping', x: 1600, y: 600, dx: 25, dy: -5 },
    { name: 'Upminster', x: 1700, y: 850, dx: 0, dy: -25 },
  ]
};

function createPath(points) {
  if (!points || points.length === 0) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]} ${points[i][1]}`;
  }
  return d;
}

function getStationCoordinates(lineId, stationName) {
  const line = MAP_DATA.lines[lineId];
  if (!line || !line.paths[0]) return { x: 500, y: 500 };
  
  let hash = 0;
  for (let i = 0; i < stationName.length; i++) {
    hash = stationName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Pick an arbitrary path from the line and a vertex based on string hash
  const pathIndex = Math.abs(hash) % line.paths.length;
  const targetPath = line.paths[pathIndex];
  const vertexIndex = Math.abs(hash) % targetPath.length;
  
  return { x: targetPath[vertexIndex][0], y: targetPath[vertexIndex][1] };
}

const getAllVertices = () => {
    const vertices = [];
    const seen = new Set();
    Object.values(MAP_DATA.lines).forEach(line => {
        line.paths.forEach(path => {
          path.forEach(pt => {
              const key = `${pt[0]},${pt[1]}`;
              if (!seen.has(key)) {
                  seen.add(key);
                  vertices.push({ x: pt[0], y: pt[1] });
              }
          });
        });
    });
    return vertices;
}

export default function MapVisualizer({ activeEvents, zoomLevel = 1.0 }) {
  const [pulses, setPulses] = useState([]);
  const [vertices, setVertices] = useState([]);

  useEffect(() => {
     setVertices(getAllVertices());
  }, []);

  useEffect(() => {
    if (activeEvents.length > 0) {
      const latest = activeEvents[0];
      const coords = getStationCoordinates(latest.lineId, latest.stationName);

      setPulses(p => [...p, { 
        id: latest.id, 
        lineId: latest.lineId, 
        stationName: latest.stationName,
        x: coords.x,
        y: coords.y,
        timestamp: Date.now() 
      }]);
      
      // Let the pulse fade out over a few seconds
      setTimeout(() => {
        setPulses(p => p.filter(pulse => pulse.id !== latest.id));
      }, 3500);
    }
  }, [activeEvents]);

  // Compute viewBox dynamically based on zoom scale.
  // Expanded abstract viewBox to cover outer London
  const baseW = 2800;
  const baseH = 2400;
  const minX = -600;
  const minY = -400;

  const w = baseW / zoomLevel;
  const h = baseH / zoomLevel;
  const x = minX + (baseW - w) / 2;
  const y = minY + (baseH - h) / 2;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", backgroundColor: "#101015" }}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox={`${x} ${y} ${w} ${h}`} 
        preserveAspectRatio="xMidYMid slice"
        style={{ filter: "drop-shadow(0 0 10px rgba(0,0,0,0.5))", transition: "all 0.5s ease-out" }}
      >
        {/* Draw the massive network lines */}
        {Object.keys(MAP_DATA.lines).map(lineId => (
          <g key={lineId}>
            {MAP_DATA.lines[lineId].paths.map((pathPts, idx) => (
              <path
                key={idx}
                d={createPath(pathPts)}
                stroke={MAP_DATA.lines[lineId].color}
                strokeWidth="18"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        ))}

        {/* Draw all vertices as Stations */}
        {vertices.map((v, i) => (
            <circle 
                key={i} 
                cx={v.x} 
                cy={v.y} 
                r="7" 
                fill="#101015" 
                stroke="#FFFFFF" 
                strokeWidth="4" 
            />
        ))}

        {/* Labels for landmarks */}
        {MAP_DATA.stationLabels.map((lbl, i) => (
            <text 
                key={i} 
                x={lbl.x + lbl.dx} 
                y={lbl.y + lbl.dy} 
                fill="#EEEEEE" 
                fontSize="20" 
                fontWeight="bold" 
                fontFamily="sans-serif"
                textAnchor={lbl.anchor || "middle"}
                alignmentBaseline="middle"
            >
                {lbl.name}
            </text>
        ))}

        {/* Active Pulses */}
        <AnimatePresence>
          {pulses.map(pulse => {
            const lineData = MAP_DATA.lines[pulse.lineId];
            if (!lineData) return null;
            return (
              <motion.g key={pulse.id} transform={`translate(${pulse.x}, ${pulse.y})`}>
                <motion.circle
                    r="12"
                    fill="#FFF"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                />
                <motion.circle
                    r="40"
                    fill="none"
                    stroke={lineData.color}
                    strokeWidth="6"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: 2, ease: "easeOut" }}
                />
              </motion.g>
            )
          })}
        </AnimatePresence>
      </svg>
    </div>
  );
}
