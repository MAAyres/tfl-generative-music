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

    // Slow data: every 6th cycle (~30s)
    slowPollCounter.current++;
    if (slowPollCounter.current % 6 === 1) {
      fetchSlowData();
    }

    // Flight twinkles: every 3rd cycle (~15s)
    if (slowPollCounter.current % 3 === 0) {
      fetchFlightData();
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
      const r = await fetch("/api/flights");
      const d = await r.json();
      if (d.success) {
        setFlightData(d.data);
        triggerFlightTwinkles(d.data);
      }
    } catch (e) {}
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
      <MapComponent activeEvents={activeEvents} flights={flightData?.flights || []} />

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
            {flightData?.available && (
              <div className="data-chip">✈️ {flightData.count} flights <span>→ Twinkle</span></div>
            )}
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
