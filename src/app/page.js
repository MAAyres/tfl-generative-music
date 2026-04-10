"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });

import {
  initAudio, applyWeatherModulation, triggerArrivalPoint,
  setLineVolume, setScale, getScaleNames,
  toggleDrums, setDrumVolume, updateDrumPattern
} from "@/lib/audioEngine";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [activeEvents, setActiveEvents] = useState([]);
  const [apiStatus, setApiStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedScale, setSelectedScale] = useState('C Minor Pentatonic');
  const [totalArrivals, setTotalArrivals] = useState(0);
  const [drumsOn, setDrumsOn] = useState(false);

  const scheduledTimeouts = useRef([]);
  const isPlayingRef = useRef(false);

  // Faster polling for more real-time feel
  const TFL_POLL_MS = 5000;

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

  const handleDrumToggle = () => {
    const newState = !drumsOn;
    setDrumsOn(newState);
    toggleDrums(newState);
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
        const total = tData.totalArrivals || 0;
        setTotalArrivals(total);
        scheduleNotesFromData(tData.data);

        // Update drum pattern with live data density
        if (weatherData) {
          updateDrumPattern(total, weatherData.windSpeed, weatherData.humidity);
        } else {
          updateDrumPattern(total, 10, 50);
        }
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
    // Clear previously scheduled
    scheduledTimeouts.current.forEach(t => clearTimeout(t));
    scheduledTimeouts.current = [];

    const linesWithArrivals = Object.keys(arrivalsByLine);
    let globalIndex = 0;

    linesWithArrivals.forEach(lineId => {
      const arrivals = arrivalsByLine[lineId];
      // Pick 2 closest trains per line per poll
      const closest = arrivals.slice(0, 2);

      closest.forEach((arrival, i) => {
        // Spread evenly across the 5-second window
        const baseDelay = (globalIndex * 350) + (i * 200);
        const jitter = Math.random() * 300;
        const delay = baseDelay + jitter;

        const timeoutId = setTimeout(() => {
          if (!isPlayingRef.current) return;

          triggerArrivalPoint(lineId, arrival.stationId);

          setActiveEvents(prev => [{
            id: `${lineId}-${arrival.stationId}-${Date.now()}-${Math.random()}`,
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
          <button className={`glow-btn ${isPlaying ? 'active' : ''}`} onClick={toggleAudio}>
            {isPlaying ? 'System Active' : 'Start Integration'}
          </button>
          {!isPlaying && <p style={{fontSize:'11px',color:'#889',textAlign:'center'}}>Click to initialize Web Audio</p>}
        </div>

        {apiStatus === 'error' && (
          <div style={{background:'rgba(220,36,31,0.15)',border:'1px solid rgba(220,36,31,0.4)',borderRadius:'8px',padding:'10px',fontSize:'11px',color:'#ff6b6b'}}>
            <strong>TFL API Error:</strong> {errorMsg}
          </div>
        )}
        {apiStatus === 'ok' && (
          <div style={{background:'rgba(0,120,42,0.15)',border:'1px solid rgba(0,120,42,0.4)',borderRadius:'8px',padding:'10px',fontSize:'11px',color:'#6bff7b'}}>
            ✓ Streaming ({totalArrivals} trains)
          </div>
        )}

        {weatherData && (
          <>
            <div className="metric">
              <span className="metric-label">Temp → Tempo</span>
              <span className="metric-value">{weatherData.temperature}°C</span>
            </div>
            <div className="metric">
              <span className="metric-label">Wind → Filter / Swing</span>
              <span className="metric-value">{weatherData.windSpeed} km/h</span>
            </div>
            <div className="metric">
              <span className="metric-label">Humidity → Reverb</span>
              <span className="metric-value">{weatherData.humidity}%</span>
            </div>
          </>
        )}

        {/* Scale Selector */}
        <div>
          <h4 style={{color:'#fff',fontSize:'13px',borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:'8px',margin:'0 0 10px 0'}}>Musical Scale</h4>
          <select
            value={selectedScale}
            onChange={handleScaleChange}
            style={{width:'100%',padding:'8px 12px',background:'rgba(255,255,255,0.08)',color:'#fff',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',fontSize:'13px',cursor:'pointer',outline:'none'}}
          >
            {getScaleNames().map(name => (
              <option key={name} value={name} style={{background:'#1a1a2e',color:'#fff'}}>{name}</option>
            ))}
          </select>
        </div>

        {/* Drum Machine */}
        <div>
          <h4 style={{color:'#fff',fontSize:'13px',borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:'8px',margin:'0 0 10px 0'}}>Drum Machine</h4>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
            <button
              onClick={handleDrumToggle}
              style={{
                padding:'6px 16px',
                borderRadius:'6px',
                border: drumsOn ? '1px solid #FFD329' : '1px solid rgba(255,255,255,0.15)',
                background: drumsOn ? 'rgba(255,211,41,0.15)' : 'rgba(255,255,255,0.05)',
                color: drumsOn ? '#FFD329' : '#889',
                cursor:'pointer',
                fontSize:'12px',
                fontWeight:600,
                transition:'all 0.3s ease',
              }}
            >
              {drumsOn ? '● Drums On' : '○ Drums Off'}
            </button>
          </div>
          <div style={{display:'flex',alignItems:'center',fontSize:'11px'}}>
            <span style={{width:'60px',color:'#889'}}>Volume</span>
            <input
              type="range" min="-30" max="0" defaultValue="-6"
              onChange={(e) => setDrumVolume(parseFloat(e.target.value))}
              style={{flex:1,accentColor:'#FFD329'}}
            />
          </div>
          <p style={{fontSize:'10px',color:'#556',marginTop:'8px',lineHeight:'1.4'}}>
            Pattern density: {totalArrivals} active trains<br/>
            {weatherData && <>Swing: {weatherData.windSpeed} km/h wind</>}
          </p>
        </div>

        {/* Line Volumes */}
        <div>
          <h4 style={{color:'#fff',fontSize:'13px',borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:'8px',margin:'0 0 10px 0'}}>Line Volumes</h4>
          {['victoria','jubilee','northern','piccadilly','central','bakerloo','district','circle','metropolitan','hammersmith-city'].map(line => (
            <div key={line} style={{display:'flex',alignItems:'center',marginBottom:'5px',fontSize:'11px'}}>
              <span style={{width:'70px',color:`var(--${line})`,textTransform:'capitalize',fontSize:'10px'}}>{line.replace('-',' ')}</span>
              <input type="range" min="-60" max="0" defaultValue="-10"
                onChange={(e) => setLineVolume(line, parseFloat(e.target.value))}
                style={{flex:1,accentColor:`var(--${line})`}}
              />
            </div>
          ))}
        </div>

        {/* Live Events Feed */}
        <div>
          <h4 style={{color:'#fff',fontSize:'13px',borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:'8px',margin:'0 0 10px 0'}}>Live Events</h4>
          <div style={{display:'flex',flexDirection:'column',gap:'3px',maxHeight:'120px',overflowY:'auto'}}>
            <AnimatePresence>
              {activeEvents.map(ev => (
                <motion.div key={ev.id} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0}}
                  style={{fontSize:'10px',background:'rgba(255,255,255,0.05)',padding:'5px 8px',borderRadius:'4px',borderLeft:`3px solid var(--${ev.lineId})`}}
                >
                  <strong style={{color:`var(--${ev.lineId})`,textTransform:'capitalize'}}>
                    {ev.lineId.replace('-',' ')}
                  </strong>
                  <span style={{color:'#eee',marginLeft:'6px'}}>{ev.stationName}</span>
                  <span style={{color:'#667',marginLeft:'6px'}}>{Math.round(ev.timeToStation)}s</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {activeEvents.length === 0 && isPlaying && apiStatus !== 'error' && (
              <span style={{fontSize:'12px',color:'#889'}}>Waiting for events...</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
