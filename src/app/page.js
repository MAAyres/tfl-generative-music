"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from 'next/dynamic';

// Leaflet must be loaded client-side only (no SSR)
const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });

import { initAudio, applyWeatherModulation, triggerArrivalPoint, setLineVolume } from "@/lib/audioEngine";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [activeEvents, setActiveEvents] = useState([]);
  const [apiStatus, setApiStatus] = useState('idle'); // idle | ok | error
  const [errorMsg, setErrorMsg] = useState('');

  const processedArrivals = useRef(new Set());
  const TFL_POLL_MS = 15000;

  const toggleAudio = async () => {
    if (!isPlaying) {
      await initAudio();
      setIsPlaying(true);
      fetchData();
    }
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
        processTFLData(tData.data);
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

  const processTFLData = (arrivalsByLine) => {
    const newEvents = [];

    Object.keys(arrivalsByLine).forEach(lineId => {
      arrivalsByLine[lineId].forEach(arrival => {
        if (arrival.timeToStation < 300) {
          if (!processedArrivals.current.has(arrival.id)) {
            triggerArrivalPoint(lineId, arrival.stationId);
            processedArrivals.current.add(arrival.id);

            newEvents.push({
              id: arrival.id,
              lineId,
              stationName: arrival.stationName,
              towards: arrival.towards || "",
              timeToStation: arrival.timeToStation,
              timestamp: Date.now()
            });
          }
        }
      });
    });

    if (newEvents.length > 0) {
      setActiveEvents(prev => [...newEvents, ...prev].slice(0, 15));
    }

    // Prevent memory leak
    if (processedArrivals.current.size > 5000) {
      processedArrivals.current.clear();
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(fetchData, TFL_POLL_MS);
    return () => clearInterval(interval);
  }, [isPlaying]);

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
            ✓ TFL Data Streaming
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

        <div style={{marginTop:'10px'}}>
          <h4 style={{color:'#fff',fontSize:'13px',borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:'8px',margin:'0 0 12px 0'}}>Live Events</h4>
          <div style={{display:'flex',flexDirection:'column',gap:'6px',maxHeight:'150px',overflowY:'auto'}}>
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
                    padding:'8px',
                    borderRadius:'6px',
                    borderLeft:`3px solid var(--${ev.lineId})`
                  }}
                >
                  <strong style={{display:'block',color:`var(--${ev.lineId})`,marginBottom:'2px',textTransform:'capitalize'}}>
                    {ev.lineId.replace('-',' ')}
                  </strong>
                  <span style={{color:'#eee'}}>{ev.stationName}</span>
                  <span style={{color:'#889',marginLeft:'8px'}}>{Math.round(ev.timeToStation)}s</span>
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
