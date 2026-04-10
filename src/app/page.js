"use client";

import { useEffect, useState, useRef } from "react";
import { initAudio, applyWeatherModulation, triggerArrivalPoint } from "@/lib/audioEngine";
import { motion, AnimatePresence } from "framer-motion";
import MapVisualizer from "./MapVisualizer";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [activeEvents, setActiveEvents] = useState([]);
  
  // A ref to keep track of triggered arrivals to prevent double-firing
  const processedArrivals = useRef(new Set());

  // Polling intervals
  const TFL_POLL_MS = 15000; // Poll TFL every 15s to respect 500/min limits natively
  const WEATHER_POLL_MS = 60000; // Weather changes slower, poll every 60s

  const toggleAudio = async () => {
    if (!isPlaying) {
      await initAudio();
      setIsPlaying(true);
      fetchData(); // Initial immediate fetch
    } else {
      // In Tone.js stopping requires context suspension or transport stop.
      // We could suspend here, but for simplicity we'll just toggle UI.
    }
  };

  const fetchData = async () => {
    // Weather fetch
    try {
      const wRes = await fetch("/api/weather");
      const wData = await wRes.json();
      if (wData.success) {
        setWeatherData(wData.data);
        if (isPlaying) {
          applyWeatherModulation(wData.data);
        }
      }
    } catch (err) {
      console.error("Failed weather:", err);
    }

    // TFL fetch
    try {
      const tRes = await fetch("/api/tfl");
      const tData = await tRes.json();
      if (tData.success && isPlaying) {
        processTFLData(tData.data);
      }
    } catch (err) {
      console.error("Failed TFL:", err);
    }
  };

  const processTFLData = (arrivalsByLine) => {
    // Evaluate arrivals and trigger audio for those very close.
    // 'timeToStation' is in seconds. Let's trigger if it's < 60s.
    const newEvents = [];
    
    Object.keys(arrivalsByLine).forEach(lineId => {
      arrivalsByLine[lineId].forEach(arrival => {
        if (arrival.timeToStation < 60) {
          if (!processedArrivals.current.has(arrival.id)) {
            // New imminent arrival! Trigger the audio.
            triggerArrivalPoint(lineId, arrival.stationId);
            processedArrivals.current.add(arrival.id);
            
            newEvents.push({
              id: arrival.id,
              lineId,
              stationName: arrival.stationName,
              direction: arrival.direction || "Unknown",
              timestamp: Date.now()
            });
          }
        }
      });
    });

    if (newEvents.length > 0) {
      setActiveEvents(prev => [...newEvents, ...prev].slice(0, 10)); // Keep last 10 in UI
    }
    
    // Clear old processed arrivals casually to prevent memory leak
    if (processedArrivals.current.size > 2000) {
      processedArrivals.current.clear();
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    
    const tflInterval = setInterval(() => {
      fetchData();
    }, TFL_POLL_MS);

    return () => clearInterval(tflInterval);
  }, [isPlaying]);

  return (
    <main className="map-container">
      <MapVisualizer activeEvents={activeEvents} />

      <div className="control-panel">
        <div>
          <button 
            className={`glow-btn ${isPlaying ? 'active' : ''}`} 
            onClick={toggleAudio}
          >
            {isPlaying ? 'System Active' : 'Start Integration'}
          </button>
          {!isPlaying && <p style={{fontSize: '11px', color: '#889', textAlign: 'center'}}>Click to initialize Web Audio</p>}
        </div>

        {weatherData && (
          <>
            <div className="metric">
              <span className="metric-label">Temp (Tempo)</span>
              <span className="metric-value">{weatherData.temperature}°C</span>
            </div>
            <div className="metric">
              <span className="metric-label">Wind (Filter)</span>
              <span className="metric-value">{weatherData.windSpeed} km/h</span>
            </div>
            <div className="metric">
              <span className="metric-label">Humidity (Reverb)</span>
              <span className="metric-value">{weatherData.humidity}%</span>
            </div>
          </>
        )}

        <div style={{ marginTop: '20px' }}>
          <h4 style={{ color: '#fff', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', margin: '0 0 12px 0' }}>Live Events</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            <AnimatePresence>
              {activeEvents.map(ev => (
                <motion.div 
                  key={ev.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ 
                    fontSize: '11px',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '8px',
                    borderRadius: '6px',
                    borderLeft: `3px solid var(--${ev.lineId})`
                  }}
                >
                  <strong style={{ display: 'block', color: `var(--${ev.lineId})`, marginBottom:'4px' }}>
                    {ev.lineId.toUpperCase()}
                  </strong>
                  <span style={{ color: '#eee'}}>{ev.stationName}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {activeEvents.length === 0 && isPlaying && (
              <span style={{ fontSize: '12px', color: '#889' }}>Waiting for train events...</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
