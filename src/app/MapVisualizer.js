"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

// Abstract coordinates for our simplified layout
const LINES = {
  victoria: {
    color: "#0098D4",
    path: "M 300 1200 Q 600 700 900 300 L 1200 100",
  },
  central: {
    color: "#DC241F",
    path: "M 200 750 L 1300 750",
  },
  northern: {
    color: "#FFFFFF",
    path: "M 750 200 L 750 1300",
  },
  jubilee: {
    color: "#868F98",
    path: "M 250 300 Q 600 600 1000 1200",
  },
  bakerloo: {
    color: "#B26300",
    path: "M 300 450 Q 750 900 1200 750",
  },
  piccadilly: {
    color: "#003688",
    path: "M 150 1200 Q 900 900 1350 300",
  }
};

// Generate a deterministic 0-100 percentage based on the station name string
function getStationSeed(stationName) {
  let hash = 0;
  for (let i = 0; i < stationName.length; i++) {
    hash = stationName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 100);
}

export default function MapVisualizer({ activeEvents }) {
  const [pulses, setPulses] = useState([]);

  useEffect(() => {
    if (activeEvents.length > 0) {
      const latest = activeEvents[0];
      setPulses(p => [...p, { 
        id: latest.id, 
        lineId: latest.lineId, 
        stationName: latest.stationName,
        timestamp: Date.now() 
      }]);
      
      // Remove pulses after 4 seconds to let them fade nicely
      setTimeout(() => {
        setPulses(p => p.filter(pulse => pulse.id !== latest.id));
      }, 4000);
    }
  }, [activeEvents]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* 
        By increasing the viewBox array negatively and making the total dimensions larger, 
        we effectively "zoom out" the abstract map so it feels much more atmospheric.
      */}
      <svg 
        width="100%" 
        height="100%" 
        viewBox="-200 -200 1900 1900" 
        preserveAspectRatio="xMidYMid slice"
        style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.05))" }}
      >
        {/* Draw abstract background line guides */}
        {Object.keys(LINES).map(lineId => (
          <g key={lineId}>
            <motion.path
              d={LINES[lineId].path}
              stroke={LINES[lineId].color}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.15 }}
              transition={{ duration: 3, ease: "easeInOut" }}
            />
          </g>
        ))}

        {/* Draw central intersection hub */}
        <motion.circle 
          cx="750" 
          cy="750" 
          r="8" 
          fill="#FFF" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 2, duration: 1 }}
        />
      </svg>

      {/* Render flashing stations using CSS offset-path overlaying the SVG */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <AnimatePresence>
          {pulses.map(pulse => {
            const lineData = LINES[pulse.lineId];
            if (!lineData) return null;
            
            const offsetPercentage = getStationSeed(pulse.stationName);
            
            return (
              <motion.div
                key={pulse.id}
                style={{
                  position: 'absolute',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: lineData.color,
                  // Position relative to the center of the viewport scaling to match SVG viewbox mostly, 
                  // but we map it directly internally using CSS motion paths!
                  offsetPath: `path('${lineData.path}')`,
                  offsetDistance: `${offsetPercentage}%`,
                  // We must offset the visual offset to account for the viewport differences 
                  // Because offset-path works on the container's 0 0, we can use a wrapper to scale.
                }}
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ 
                  opacity: [0, 1, 0.4, 0], 
                  scale: [0.5, 2.5, 1, 0.5],
                  boxShadow: [
                    `0 0 0px ${lineData.color}`,
                    `0 0 30px ${lineData.color}`,
                    `0 0 10px ${lineData.color}`,
                    `0 0 0px ${lineData.color}`
                  ]
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 3, ease: 'easeOut' }}
              >
                 {/* Visual core of the station flash */}
                 <div style={{width: '100%', height: '100%', background: '#fff', borderRadius:'50%', transform: 'scale(0.3)'}} />
                 <span style={{ 
                    position: 'absolute', 
                    top: '24px', 
                    left: '50%', 
                    transform: 'translateX(-50%)', 
                    color: '#fff', 
                    fontSize: '10px', 
                    whiteSpace: 'nowrap',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                 }}>
                   {pulse.stationName}
                 </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}
