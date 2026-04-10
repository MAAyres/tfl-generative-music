"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });

import { initAudio, applyWeatherModulation, triggerArrivalPoint, setLineVolume, setScale, getScaleNames } from "@/lib/audioEngine";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [activeEvents, setActiveEvents] = useState([]);
  const [apiStatus, setApiStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedScale, setSelectedScale] = useState('C Minor Pentatonic');
  const [totalArrivals, setTotalArrivals] = useState(0);

  // We no longer track "processed" IDs. Instead, each poll picks the closest
  // arrivals per line and staggers note triggers across the poll interval.
  const scheduledTimeouts = useRef([]);
  const isPlayingRef = useRef(false);

  const TFL_POLL_MS = 15000;

  const toggleAudio = async () => {
    if (!isPlaying) {
      await initAudio();
      setIsPlaying(true);
      isPlayingRef.current = true;
      fetchData();
    }
  };

  const handleScaleChange = (e) => {
    const name = e.target.value;
    setSelectedScale(name);
    setScale(name);
  };

  const fetchData = async () => {
    // Weather
    try {
      const wRes = await fetch("/api/weather");
      const wData = await wRes.json();
      if (wData.success) {
        setWeatherData(wData.data);
        applyWeatherModulation(wData.data);
      }
    } catch (err) {
      console.error("Weather fetch error:", err);
    }

    // TFL
    try {
      const tRes = await fetch("/api/tfl");
      const tData = await tRes.json();
      if (tData.success) {
        setApiStatus('ok');
        setErrorMsg('');
        setTotalArrivals(tData.totalArrivals || 0);
        scheduleNotesFromData(tData.data);
      } else {
        setApiStatus('error');
        setErrorMsg(tData.error || 'Unknown error');
      }
    } catch (err) {
      console.error("TFL fetch error:", err);
      setApiStatus('error');
      setErrorMsg(err.message);
    }
  };

  const scheduleNotesFromData = (arrivalsByLine) => {
    // Clear any previously scheduled notes
    scheduledTimeouts.current.forEach(t => clearTimeout(t));
    scheduledTimeouts.current = [];

    const newUIEvents = [];

    // For each line, take the 3 closest arriving trains.
    // Stagger their note triggers evenly across the 15-second poll interval.
    // This creates a continuous, rhythmic stream of notes.
    const linesWithArrivals = Object.keys(arrivalsByLine);
    let globalIndex = 0;

    linesWithArrivals.forEach(lineId => {
      const arrivals = arrivalsByLine[lineId];
      // Sort by closest first (should already be sorted by API route)
      const closest = arrivals.slice(0, 3);

      closest.forEach((arrival, i) => {
        // Spread notes across the polling interval with slight randomness
        const baseDelay = (globalIndex * 800) + (i * 300); // spread them out
        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;

        const timeoutId = setTimeout(() => {
          if (!isPlayingRef.current) return;

          triggerArrivalPoint(lineId, arrival.stationId);

          // Push to UI
          setActiveEvents(prev => [{
            id: `${lineId}-${arrival.stationId}-${Date.now()}`,
            lineId,
            stationName: arrival.stationName,
            towards: arrival.towards || "",
            timeToStation: arrival.timeToStation,
            timestamp: Date.now()
          }, ...prev].slice(0, 20));
        }, delay);

        scheduledTimeouts.current.push(timeoutId);
      });

      globalIndex++;
    });
  };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(fetchData, TFL_POLL_MS);
    return () => {
      clearInterval(interval);
      scheduledTimeouts.current.forEach(t => clearTimeout(t));
    };
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      scheduledTimeouts.current.forEach(t => clearTimeout(t));
    };
  }, []);

  return (
    <main className="map-container">
      <MapComponent activeEvents={activeEvents} />

      <div className="control-panel">
        <div>
          <button
            className={`glow-btn ${isPlaying ? 'active' : ''}`}
            onClick={toggleAudio}
          >
            {isPlaying ? 'System Active' : 'Start Integration'}
          </button>
          {!isPlaying && <p style={{fontSize:'11px',color:'#889',textAlign:'center'}}>Click to initialize Web Audio</p>}
        </div>

        {/* API Status */}
        {apiStatus === 'error' && (
          <div style={{background:'rgba(220,36,31,0.15)',border:'1px solid rgba(220,36,31,0.4)',borderRadius:'8px',padding:'10px',fontSize:'11px',color:'#ff6b6b'}}>
            <strong>TFL API Error:</strong> {errorMsg}
          </div>
        )}
        {apiStatus === 'ok' && (
          <div style={{background:'rgba(0,120,42,0.15)',border:'1px solid rgba(0,120,42,0.4)',borderRadius:'8px',padding:'10px',fontSize:'11px',color:'#6bff7b'}}>
            ✓ TFL Data Streaming ({totalArrivals} predictions)
          </div>
        )}

        {weatherData && (
          <>
            <div className="metric">
              <span className="metric-label">Temp → Tempo</span>
              <span className="metric-value">{weatherData.temperature}°C</span>
            </div>
            <div className="metric">
              <span className="metric-label">Wind → Filter</span>
              <span className="metric-value">{weatherData.windSpeed} km/h</span>
            </div>
            <div className="metric">
              <span className="metric-label">Humidity → Reverb</span>
              <span className="metric-value">{weatherData.humidity}%</span>
            </div>
          </>
        )}

        {/* Scale Selector */}
        <div style={{marginTop:'10px'}}>
          <h4 style={{color:'#fff',fontSize:'13px',borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:'8px',margin:'0 0 12px 0'}}>Musical Scale</h4>
          <select 
            value={selectedScale} 
            onChange={handleScaleChange}
            style={{
              width:'100%',
              padding:'8px 12px',
              background:'rgba(255,255,255,0.08)',
              color:'#fff',
              border:'1px solid rgba(255,255,255,0.15)',
              borderRadius:'6px',
              fontSize:'13px',
              cursor:'pointer',
              outline:'none',
            }}
          >
            {getScaleNames().map(name => (
              <option key={name} value={name} style={{background:'#1a1a2e',color:'#fff'}}>{name}</option>
            ))}
          </select>
        </div>

        {/* Line Volumes */}
        <div style={{marginTop:'10px'}}>
          <h4 style={{color:'#fff',fontSize:'13px',borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:'8px',margin:'0 0 12px 0'}}>Line Volumes</h4>
          {['victoria','jubilee','northern','piccadilly','central','bakerloo','district','circle','metropolitan','hammersmith-city'].map(line => (
            <div key={line} style={{display:'flex',alignItems:'center',marginBottom:'6px',fontSize:'11px'}}>
              <span style={{width:'70px',color:`var(--${line})`,textTransform:'capitalize',fontSize:'10px'}}>{line.replace('-',' ')}</span>
              <input
                type="range"
                min="-60" max="0" defaultValue="-10"
                onChange={(e) => setLineVolume(line, parseFloat(e.target.value))}
                style={{flex:1,accentColor:`var(--${line})`}}
              />
            </div>
          ))}
        </div>

        {/* Live Events Feed */}
        <div style={{marginTop:'10px'}}>
          <h4 style={{color:'#fff',fontSize:'13px',borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:'8px',margin:'0 0 12px 0'}}>Live Events</h4>
          <div style={{display:'flex',flexDirection:'column',gap:'4px',maxHeight:'150px',overflowY:'auto'}}>
            <AnimatePresence>
              {activeEvents.map(ev => (
                <motion.div
                  key={ev.id}
                  initial={{opacity:0,x:20}}
                  animate={{opacity:1,x:0}}
                  exit={{opacity:0}}
                  style={{
                    fontSize:'10px',
                    background:'rgba(255,255,255,0.05)',
                    padding:'6px 8px',
                    borderRadius:'6px',
                    borderLeft:`3px solid var(--${ev.lineId})`
                  }}
                >
                  <strong style={{color:`var(--${ev.lineId})`,textTransform:'capitalize'}}>
                    {ev.lineId.replace('-',' ')}
                  </strong>
                  <span style={{color:'#eee',marginLeft:'6px'}}>{ev.stationName}</span>
                  <span style={{color:'#889',marginLeft:'6px'}}>{Math.round(ev.timeToStation)}s</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {activeEvents.length === 0 && isPlaying && apiStatus !== 'error' && (
              <span style={{fontSize:'12px',color:'#889'}}>Waiting for train events...</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
