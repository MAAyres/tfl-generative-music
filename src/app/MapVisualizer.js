"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

// Abstract coordinates for our simplified layout
// We spread these out across a 1000x1000 viewport
const LINES = {
  victoria: {
    color: "#0098D4",
    path: "M 200 800 Q 400 500 600 200 L 800 100",
  },
  central: {
    color: "#DC241F",
    path: "M 100 500 L 900 500",
  },
  northern: {
    color: "#FFFFFF",
    path: "M 500 100 L 500 900",
  },
  jubilee: {
    color: "#868F98",
    path: "M 150 200 Q 400 400 700 800",
  },
  bakerloo: {
    color: "#B26300",
    path: "M 200 300 Q 500 600 800 500",
  },
  piccadilly: {
    color: "#003688",
    path: "M 100 800 Q 600 600 900 200",
  }
};

export default function MapVisualizer({ activeEvents }) {
  const [pulses, setPulses] = useState([]);

  useEffect(() => {
    // When a new event arrives, we create a pulse animation
    // along the corresponding line SVG.
    if (activeEvents.length > 0) {
      const latest = activeEvents[0]; // the newly added one is at index 0 usually, wait, my code added it to index 0.
      setPulses(p => [...p, { id: latest.id, lineId: latest.lineId, timestamp: Date.now() }]);
      
      // Remove pulses after 3 seconds
      setTimeout(() => {
        setPulses(p => p.filter(pulse => pulse.id !== latest.id));
      }, 3000);
    }
  }, [activeEvents]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 1000 1000" 
        preserveAspectRatio="xMidYMid slice"
        style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.1))" }}
      >
        {/* Draw abstract lines */}
        {Object.keys(LINES).map(lineId => (
          <g key={lineId}>
            <motion.path
              d={LINES[lineId].path}
              stroke={LINES[lineId].color}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.2 }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
          </g>
        ))}

        {/* Draw active pulses travelling along their specific lines */}
        <AnimatePresence>
          {pulses.map(pulse => (
            LINES[pulse.lineId] && (
              <motion.circle
                key={pulse.id}
                r="8"
                fill={LINES[pulse.lineId].color}
                style={{ 
                  filter: `drop-shadow(0 0 12px ${LINES[pulse.lineId].color}) blur(1px)` 
                }}
                initial={{ offsetDistance: "0%", opacity: 0, scale: 0.5 }}
                animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1, 0.5] }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 2.5, ease: "easeOut" }}
              >
                {/* CSS Motion Path requires offset-path which Framer Motion doesn't natively morph universally on SVG inner elements, 
                    so instead we'll animate simple expanding nodes on the center, simulating the system reacting. */}
                <animateMotion 
                  dur="2.5s" 
                  repeatCount="1"
                  path={LINES[pulse.lineId].path} 
                />
              </motion.circle>
            )
          ))}
        </AnimatePresence>

        {/* Draw central intersection hub */}
        <motion.circle 
          cx="500" 
          cy="500" 
          r="6" 
          fill="#FFF" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 2, duration: 1 }}
        />
      </svg>
    </div>
  );
}
