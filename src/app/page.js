"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });

import {
  initAudio, applyWeatherModulation, triggerArrivalPoint,
  setScale, getScaleNames, toggleMuteLine,
  toggleDrums, setDrumVolume, updateDrumPattern,
  applyTrafficModulation, applyAirQualityModulation, applyStockModulation,
  applyRiverModulation, triggerFlightTwinkles,
} from "@/lib/audioEngine";
import { motion, AnimatePresence } from "framer-motion";

const ALL_LINES = ['victoria','jubilee','northern','piccadilly','central','bakerloo','district','circle','metropolitan','hammersmith-city','waterloo-city','elizabeth'];
const LINE_COLORS = {
  victoria:'#0098D4',jubilee:'#868F98',northern:'#FFF',piccadilly:'#003688',
  central:'#DC241F',bakerloo:'#B26300',district:'#00782A',circle:'#FFD329',
  metropolitan:'#9B0058','hammersmith-city':'#F3A9BB','waterloo-city':'#95CDBA',elizabeth:'#6950A1'
};

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [trafficData, setTrafficData] = useState(null);
  const [airData, setAirData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [riverData, setRiverData] = useState(null);
  const [flightData, setFlightData] = useState(null);
  const [flightStatus, setFlightStatus] = useState('idle');
  const [syntheticFlights, setSyntheticFlights] = useState([]);
  const flightFailCount = useRef(0);
  const [activeEvents, setActiveEvents] = useState([]);
  const [apiStatus, setApiStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedScale, setSelectedScale] = useState('C Minor Pentatonic');
  const [totalArrivals, setTotalArrivals] = useState(0);
  const [drumsOn, setDrumsOn] = useState(false);
  const [lineMutes, setLineMutes] = useState({});

  const scheduledTimeouts = useRef([]);
  const isPlayingRef = useRef(false);
  const slowPollCounter = useRef(0);

  const TFL_POLL_MS = 5000;

  const toggleAudio = async () => {
    if (!isPlaying) {
      await initAudio();
      setIsPlaying(true);
      isPlayingRef.current = true;
      fetchAllData();
    }
  };

  const handleScaleChange = (e) => { setSelectedScale(e.target.value); setScale(e.target.value); };
  const handleDrumToggle = () => { const n = !drumsOn; setDrumsOn(n); toggleDrums(n); };
  const handleMuteToggle = (lineId) => {
    const isMuted = toggleMuteLine(lineId);
    setLineMutes(prev => ({ ...prev, [lineId]: isMuted }));
  };

  const fetchAllData = async () => {
    // TFL arrivals (every 5s)
    try {
      const tRes = await fetch("/api/tfl");
      const tData = await tRes.json();
      if (tData.success) {
        setApiStatus('ok'); setErrorMsg('');
        const total = tData.totalArrivals || 0;
        setTotalArrivals(total);
        scheduleNotesFromData(tData.data);
        if (weatherData) updateDrumPattern(total, weatherData.windSpeed);
        else updateDrumPattern(total, 10);
      } else { setApiStatus('error'); setErrorMsg(tData.error || 'Unknown'); }
    } catch (err) { setApiStatus('error'); setErrorMsg(err.message); }

    // Flights: Now every cycle (5s) for better responsiveness and debugging
    fetchFlightData();

    // Slow data: every 6th cycle (~30s)
    slowPollCounter.current++;
    if (slowPollCounter.current % 6 === 1) {
      fetchSlowData();
    }
  };

  const fetchSlowData = async () => {
    try { const r = await fetch("/api/weather"); const d = await r.json(); if (d.success) { setWeatherData(d.data); applyWeatherModulation(d.data); } } catch (e) {}
    try { const r = await fetch("/api/traffic"); const d = await r.json(); if (d.success) { setTrafficData(d.data); applyTrafficModulation(d.data); } } catch (e) {}
    try { const r = await fetch("/api/airquality"); const d = await r.json(); if (d.success) { setAirData(d.data); applyAirQualityModulation(d.data); } } catch (e) {}
    try { const r = await fetch("/api/stocks"); const d = await r.json(); if (d.success) { setStockData(d.data); applyStockModulation(d.data); } } catch (e) {}
    try { const r = await fetch("/api/river"); const d = await r.json(); if (d.success) { setRiverData(d.data); applyRiverModulation(d.data); } } catch (e) {}
  };

  const fetchFlightData = async () => {
    try {
      setFlightStatus('loading');
      const r = await fetch("/api/flights");
      const d = await r.json();
      
      if (d.success && d.data.available && d.data.count > 0) {
        setFlightData(d.data);
        setFlightStatus('ok');
        setSyntheticFlights([]); // Clear synthetic if real works
        flightFailCount.current = 0;
        triggerFlightTwinkles(d.data);
      } else {
        // Increment fail count if no data or unavailable
        flightFailCount.current++;
        if (flightFailCount.current >= 2) {
          setFlightStatus('synthetic');
          updateSyntheticSkies();
        } else {
          setFlightStatus('waiting');
        }
      }
    } catch (e) {
      console.error("Flight fetch fail:", e);
      flightFailCount.current++;
      if (flightFailCount.current >= 2) setFlightStatus('synthetic');
      else setFlightStatus('error');
    }
  };

  const updateSyntheticSkies = () => {
    // Generate or update 4-6 synthetic flights moving across London
    setSyntheticFlights(prev => {
      let next = [...prev];
      // If we have none, spawn a bunch
      if (next.length < 4) {
        for (let i = 0; i < 5; i++) {
          next.push({
            icao24: `SYNTH-${Math.random().toString(36).substr(2, 5)}`,
            callsign: `GEN-${100 + Math.floor(Math.random()*900)}`,
            lat: 51.3 + Math.random() * 0.4,
            lon: -0.5 + Math.random() * 0.8,
            altitude: 2000 + Math.random() * 8000,
            velocity: 150 + Math.random() * 100,
            heading: Math.random() * 360,
            isSynthetic: true
          });
        }
      } else {
        // Move existing ones slightly based on heading/velocity (approx 5s movement)
        next = next.map(f => {
          const dist = (f.velocity * 5) / 111000; // rough deg conversion
          const rad = (f.heading * Math.PI) / 180;
          let newLat = f.lat + dist * Math.cos(rad);
          let newLon = f.lon + dist * Math.sin(rad);
          
          // Re-spawn if they leave the box
          if (newLat < 51.0 || newLat > 52.0 || newLon < -1.0 || newLon > 1.0) {
            newLat = 51.3 + Math.random() * 0.4;
            newLon = -0.5 + Math.random() * 0.8;
          }
          return { ...f, lat: newLat, lon: newLon };
        });
      }
      // Trigger twinkles for these synthetic planes
      triggerFlightTwinkles({ flights: next, available: true });
      return next;
    });
  };

  const scheduleNotesFromData = (arrivalsByLine) => {
    scheduledTimeouts.current.forEach(t => clearTimeout(t));
    scheduledTimeouts.current = [];
    let globalIndex = 0;

    Object.keys(arrivalsByLine).forEach(lineId => {
      const closest = arrivalsByLine[lineId].slice(0, 2);
      closest.forEach((arrival, i) => {
        const delay = (globalIndex * 350) + (i * 200) + Math.random() * 300;
        const timeoutId = setTimeout(() => {
          if (!isPlayingRef.current) return;
          triggerArrivalPoint(lineId, arrival.stationId);
          setActiveEvents(prev => [{
            id: `${lineId}-${arrival.stationId}-${Date.now()}-${Math.random()}`,
            lineId, stationName: arrival.stationName,
            towards: arrival.towards || "", timeToStation: arrival.timeToStation,
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
    const interval = setInterval(fetchAllData, TFL_POLL_MS);
    return () => { clearInterval(interval); scheduledTimeouts.current.forEach(t => clearTimeout(t)); };
  }, [isPlaying]);

  useEffect(() => () => {
    isPlayingRef.current = false;
    scheduledTimeouts.current.forEach(t => clearTimeout(t));
  }, []);

  const sectionHeader = (title) => (
    <h4 style={{color:'#fff',fontSize:'11px',borderBottom:'1px solid rgba(255,255,255,0.08)',paddingBottom:'5px',margin:'0 0 8px 0',letterSpacing:'0.5px',textTransform:'uppercase',fontWeight:700}}>{title}</h4>
  );

  return (
    <main className="map-container">
      <MapComponent 
        activeEvents={activeEvents} 
        flights={flightStatus === 'synthetic' ? syntheticFlights : (flightData?.flights || [])} 
      />

      <div className="control-panel">
        <button className={`glow-btn ${isPlaying ? 'active' : ''}`} onClick={toggleAudio}>
          {isPlaying ? '● System Active' : 'Start Integration'}
        </button>

        {apiStatus === 'error' && (
          <div style={{background:'rgba(220,36,31,0.15)',border:'1px solid rgba(220,36,31,0.4)',borderRadius:'6px',padding:'6px 8px',fontSize:'10px',color:'#ff6b6b'}}>
            <strong>API Error:</strong> {errorMsg}
          </div>
        )}
        {apiStatus === 'ok' && (
          <div style={{background:'rgba(0,120,42,0.1)',borderRadius:'6px',padding:'5px 8px',fontSize:'10px',color:'#6bff7b'}}>
            ✓ {totalArrivals} trains
          </div>
        )}

        {/* Data Feeds */}
        <div>
          {sectionHeader('Live Data → Audio')}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',fontSize:'9px'}}>
            {weatherData && <>
              <div className="data-chip">🌡 {weatherData.temperature}°C <span>→ Tempo</span></div>
              <div className="data-chip">💨 {weatherData.windSpeed}km/h <span>→ Filter / Swing</span></div>
              <div className="data-chip">💧 {weatherData.humidity}% <span>→ Reverb</span></div>
            </>}
            {airData && <>
              <div className="data-chip">🏭 PM2.5: {airData.pm25} <span>→ Bitcrusher</span></div>
              <div className="data-chip">🌫 AQI: {airData.aqi} <span>→ Resonance</span></div>
            </>}
            {trafficData && (
              <div className="data-chip">🚗 {trafficData.totalDisruptions} <span>→ ADSR</span></div>
            )}
            {stockData?.available && <>
              <div className="data-chip" style={{color: parseFloat(stockData.change) >= 0 ? '#6bff7b' : '#ff6b6b'}}>
                📈 {parseFloat(stockData.changePercent) >= 0 ? '+' : ''}{stockData.changePercent}% <span>→ Delay / FM</span>
              </div>
            </>}
            {riverData?.level != null && (
              <div className="data-chip">🌊 {riverData.level}m <span>→ Sub Drone</span></div>
            )}
            <div className="data-chip" style={{
              color: flightStatus === 'ok' ? '#b0f2ff' : flightStatus === 'synthetic' ? '#ff9f43' : flightStatus === 'loading' ? '#aaa' : '#ff6b6b'
            }}>
              ✈️ {flightStatus === 'loading' ? 'Scanning Skies...' : 
                  flightStatus === 'ok' ? `${flightData?.count || 0} flights` : 
                  flightStatus === 'synthetic' ? 'Synthesizing Skies' :
                  flightStatus === 'waiting' ? 'Buffering Skies...' : 'Link Failed'}
              <span>→ Twinkle {flightStatus === 'loading' && '...'}</span>
            </div>
          </div>
        </div>

        {/* Scale */}
        <div>
          {sectionHeader('Scale')}
          <select value={selectedScale} onChange={handleScaleChange}
            style={{width:'100%',padding:'6px 10px',background:'rgba(255,255,255,0.08)',color:'#fff',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'6px',fontSize:'12px',cursor:'pointer',outline:'none'}}>
            {getScaleNames().map(n => <option key={n} value={n} style={{background:'#1a1a2e'}}>{n}</option>)}
          </select>
        </div>

        {/* Drums */}
        <div>
          {sectionHeader('Drums')}
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <button onClick={handleDrumToggle} style={{
              padding:'4px 12px',borderRadius:'5px',fontSize:'11px',fontWeight:600,cursor:'pointer',
              border: drumsOn ? '1px solid #FFD329' : '1px solid rgba(255,255,255,0.12)',
              background: drumsOn ? 'rgba(255,211,41,0.15)' : 'rgba(255,255,255,0.05)',
              color: drumsOn ? '#FFD329' : '#778',transition:'all 0.2s',
            }}>{drumsOn ? '● On' : '○ Off'}</button>
            <input type="range" min="-30" max="0" defaultValue="-6"
              onChange={(e) => setDrumVolume(parseFloat(e.target.value))}
              style={{flex:1,accentColor:'#FFD329'}} />
          </div>
        </div>

        {/* Lines */}
        <div>
          {sectionHeader('Lines')}
          <div style={{display:'flex',flexWrap:'wrap',gap:'3px'}}>
            {ALL_LINES.map(line => (
              <button key={line} onClick={() => handleMuteToggle(line)} style={{
                padding:'3px 7px',borderRadius:'4px',fontSize:'8px',fontWeight:700,cursor:'pointer',
                textTransform:'capitalize',transition:'all 0.2s',
                border:`1px solid ${LINE_COLORS[line]}40`,
                background: lineMutes[line] ? 'rgba(255,255,255,0.03)' : `${LINE_COLORS[line]}25`,
                color: lineMutes[line] ? '#445' : LINE_COLORS[line],
                opacity: lineMutes[line] ? 0.35 : 1,
              }}>{line.replace('-',' ')}</button>
            ))}
          </div>
        </div>

        {/* Events */}
        <div>
          {sectionHeader('Events')}
          <div style={{display:'flex',flexDirection:'column',gap:'2px',maxHeight:'80px',overflowY:'auto'}}>
            <AnimatePresence>
              {activeEvents.slice(0, 10).map(ev => (
                <motion.div key={ev.id} initial={{opacity:0,x:15}} animate={{opacity:1,x:0}} exit={{opacity:0}}
                  style={{fontSize:'9px',background:'rgba(255,255,255,0.04)',padding:'3px 6px',borderRadius:'3px',borderLeft:`2px solid ${LINE_COLORS[ev.lineId] || '#fff'}`}}>
                  <strong style={{color:LINE_COLORS[ev.lineId],textTransform:'capitalize'}}>{ev.lineId.replace('-',' ')}</strong>
                  <span style={{color:'#ccc',marginLeft:'4px'}}>{ev.stationName}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
