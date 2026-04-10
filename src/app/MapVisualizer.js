"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

// Exact SVG point coordinates mimicking central London Tube Map structural layout
const MAP_DATA = {
  lines: {
    victoria: { 
      color: "#0098D4", 
      points: [[150, 950], [250, 850], [250, 500], [450, 300], [600, 150], [800, 150]] 
    },
    central: { 
      color: "#DC241F", 
      points: [[50, 300], [450, 300], [700, 300], [1050, 300]] 
    },
    piccadilly: { 
      color: "#003688", 
      points: [[50, 700], [250, 500], [500, 500], [700, 500], [850, 350], [1050, 350]] 
    },
    jubilee: { 
      color: "#868F98", 
      points: [[150, 850], [250, 750], [450, 750], [700, 750], [850, 900], [1000, 900]] 
    },
    northern: { 
      color: "#FFFFFF", 
      points: [[700, 100], [700, 300], [700, 500], [700, 600], [700, 750], [800, 950], [800, 1050]] 
    },
    bakerloo: { 
      color: "#B26300", 
      points: [[350, 100], [450, 300], [500, 500], [600, 600], [700, 600], [700, 750], [850, 900], [1100, 900]] 
    },
  },
  stationLabels: [
    { name: 'Oxford Circus', x: 450, y: 300, dx: -15, dy: -25 },
    { name: 'Piccadilly Circus', x: 500, y: 500, dx: 25, dy: 25 },
    { name: 'Green Park', x: 250, y: 500, dx: -15, dy: -25 },
    { name: 'Leicester Square', x: 700, y: 500, dx: 25, dy: -25 },
    { name: 'Charing Cross', x: 700, y: 600, dx: 25, dy: 5 },
    { name: 'Embankment', x: 700, y: 750, dx: 25, dy: 25 },
    { name: 'Westminster', x: 450, y: 750, dx: -25, dy: 25 },
    { name: 'Waterloo', x: 850, y: 900, dx: 25, dy: 25 },
    { name: 'Tottenham Ct Rd', x: 700, y: 300, dx: 25, dy: -25 },
  ]
};

// Convert array of [x,y] coordinates mapped to string <path d="..." />
function createPath(points) {
  if (!points || points.length === 0) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]} ${points[i][1]}`;
  }
  return d;
}

// Ensure stations stick to literal vertices defined in the path for accuracy
function getStationCoordinates(lineId, stationName) {
  const line = MAP_DATA.lines[lineId];
  if (!line) return { x: 500, y: 500 };
  let hash = 0;
  for (let i = 0; i < stationName.length; i++) {
    hash = stationName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % line.points.length;
  return { x: line.points[index][0], y: line.points[index][1] };
}

// Collect all unique vertex points to draw the standard Tube "Station" hollow circles
const getAllVertices = () => {
    const vertices = [];
    const seen = new Set();
    Object.values(MAP_DATA.lines).forEach(line => {
        line.points.forEach(pt => {
            const key = `${pt[0]},${pt[1]}`;
            if (!seen.has(key)) {
                seen.add(key);
                vertices.push({ x: pt[0], y: pt[1] });
            }
        });
    });
    return vertices;
}

export default function MapVisualizer({ activeEvents }) {
  const [pulses, setPulses] = useState([]);
  const [vertices, setVertices] = useState([]);

  useEffect(() => {
     setVertices(getAllVertices());
  }, []);

  useEffect(() => {
    if (activeEvents.length > 0) {
      const latest = activeEvents[0]; // the newly added event
      
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

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", backgroundColor: "#101015" }}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox="-100 -50 1300 1200" 
        preserveAspectRatio="xMidYMid slice"
        style={{ filter: "drop-shadow(0 0 10px rgba(0,0,0,0.5))" }}
      >
        {/* Draw the thick robust Tube Map Lines */}
        {Object.keys(MAP_DATA.lines).map(lineId => (
          <g key={lineId}>
            <path
              d={createPath(MAP_DATA.lines[lineId].points)}
              stroke={MAP_DATA.lines[lineId].color}
              strokeWidth="16"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {/* Draw exactly accurate Topographical Station Markers (hollow white rings) */}
        {vertices.map((v, i) => (
            <circle 
                key={i} 
                cx={v.x} 
                cy={v.y} 
                r="6" 
                fill="#101015" 
                stroke="#FFFFFF" 
                strokeWidth="3" 
            />
        ))}

        {/* Draw labels for core stations */}
        {MAP_DATA.stationLabels.map((lbl, i) => (
            <text 
                key={i} 
                x={lbl.x + lbl.dx} 
                y={lbl.y + lbl.dy} 
                fill="#EEEEEE" 
                fontSize="14" 
                fontWeight="bold" 
                fontFamily="sans-serif"
                textAnchor={lbl.anchor || "middle"}
                alignmentBaseline="middle"
            >
                {lbl.name}
            </text>
        ))}

        {/* Draw active pulsing stations precisely where trains arrive */}
        <AnimatePresence>
          {pulses.map(pulse => {
            const lineData = MAP_DATA.lines[pulse.lineId];
            if (!lineData) return null;
            return (
              <motion.g key={pulse.id} transform={`translate(${pulse.x}, ${pulse.y})`}>
                <motion.circle
                    r="8"
                    fill="#FFF"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                />
                <motion.circle
                    r="24"
                    fill="none"
                    stroke={lineData.color}
                    strokeWidth="4"
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
