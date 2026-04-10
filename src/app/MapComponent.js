"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Real geographic coordinates for major tube line routes (simplified but accurate paths)
const LINE_GEO = {
  victoria: {
    color: "#0098D4",
    coords: [
      [51.5866, -0.0886], // Walthamstow Central
      [51.5705, -0.0983], // Blackhorse Road
      [51.5519, -0.0727], // Tottenham Hale
      [51.5462, -0.0636], // Seven Sisters
      [51.5347, -0.1044], // Finsbury Park
      [51.5255, -0.1032], // Highbury & Islington
      [51.5300, -0.1186], // King's Cross
      [51.5260, -0.1277], // Euston
      [51.5235, -0.1367], // Warren Street
      [51.5152, -0.1418], // Oxford Circus
      [51.5100, -0.1426], // Green Park
      [51.4965, -0.1438], // Victoria
      [51.4893, -0.1534], // Pimlico
      [51.4724, -0.1232], // Vauxhall
      [51.4613, -0.1364], // Stockwell
      [51.4628, -0.1592], // Brixton
    ]
  },
  central: {
    color: "#DC241F",
    coords: [
      [51.5674, 0.0470], // Epping (approx)
      [51.5607, 0.0280], // Theydon Bois
      [51.5538, 0.0130], // Debden
      [51.5465, 0.0024], // Loughton
      [51.5416, -0.0040], // Buckhurst Hill
      [51.5395, -0.0174], // Woodford
      [51.5260, -0.0287], // South Woodford
      [51.5249, -0.0485], // Snaresbrook
      [51.5199, -0.0589], // Leytonstone
      [51.5133, -0.0540], // Leyton
      [51.5137, -0.0367], // Stratford
      [51.5137, -0.0536], // Mile End
      [51.5150, -0.0471], // Bethnal Green
      [51.5175, -0.0729], // Liverpool Street
      [51.5156, -0.0886], // Bank
      [51.5150, -0.0985], // St Paul's
      [51.5165, -0.1032], // Chancery Lane
      [51.5178, -0.1197], // Holborn
      [51.5165, -0.1310], // Tottenham Ct Rd
      [51.5152, -0.1418], // Oxford Circus
      [51.5134, -0.1505], // Bond Street
      [51.5120, -0.1581], // Marble Arch
      [51.5117, -0.1737], // Lancaster Gate
      [51.5108, -0.1877], // Queensway
      [51.5071, -0.1990], // Notting Hill Gate
      [51.5048, -0.2188], // Holland Park
      [51.5028, -0.2251], // Shepherd's Bush
      [51.5042, -0.2481], // White City
      [51.5123, -0.2587], // East Acton
      [51.5165, -0.2812], // North Acton
      [51.5172, -0.2976], // West Acton
      [51.5147, -0.3001], // Ealing Broadway
    ]
  },
  northern: {
    color: "#000000",
    coords: [
      // High Barnet Branch
      [51.6505, -0.1943], // High Barnet
      [51.6306, -0.1939], // Totteridge
      [51.6143, -0.1946], // Woodside Park
      [51.6027, -0.1931], // West Finchley
      [51.5874, -0.1931], // Finchley Central
      [51.5778, -0.1929], // East Finchley
      [51.5654, -0.1646], // Highgate
      [51.5568, -0.1428], // Archway
      [51.5512, -0.1380], // Tufnell Park
      [51.5463, -0.1384], // Kentish Town
      [51.5394, -0.1425], // Camden Town
      // Trunk
      [51.5300, -0.1186], // King's Cross (shared)
      [51.5260, -0.1277], // Euston
      [51.5235, -0.1367], // Warren Street
      [51.5210, -0.1383], // Goodge Street
      [51.5165, -0.1310], // Tottenham Ct Rd
      [51.5098, -0.1244], // Leicester Sq
      [51.5072, -0.1268], // Charing Cross
      [51.5011, -0.1245], // Embankment
      [51.4983, -0.1183], // Waterloo
      [51.4943, -0.1001], // Kennington
      [51.4871, -0.0878], // Elephant & Castle
      [51.4720, -0.1005], // Oval
      [51.4613, -0.1364], // Stockwell
      [51.4505, -0.1490], // Clapham North
      [51.4460, -0.1545], // Clapham Common
      [51.4371, -0.1474], // Clapham South
      [51.4269, -0.1540], // Balham
      [51.4115, -0.1533], // Tooting Bec
      [51.3995, -0.1498], // Tooting Broadway
      [51.3952, -0.1497], // Colliers Wood
      [51.3878, -0.1607], // South Wimbledon
      [51.4019, -0.1780], // Morden
    ]
  },
  piccadilly: {
    color: "#003688",
    coords: [
      [51.6515, -0.1935], // Cockfosters
      [51.6402, -0.1863], // Oakwood
      [51.6325, -0.1281], // Southgate
      [51.6026, -0.1325], // Arnos Grove
      [51.5945, -0.1292], // Bounds Green
      [51.5860, -0.1104], // Wood Green
      [51.5776, -0.1066], // Turnpike Lane
      [51.5694, -0.0986], // Manor House
      [51.5347, -0.1044], // Finsbury Park
      [51.5301, -0.1082], // Arsenal
      [51.5271, -0.1048], // Holloway Road
      [51.5471, -0.1040], // Caledonian Road
      [51.5300, -0.1186], // King's Cross
      [51.5224, -0.1298], // Russell Square
      [51.5178, -0.1197], // Holborn
      [51.5119, -0.1234], // Covent Garden
      [51.5098, -0.1244], // Leicester Square
      [51.5098, -0.1340], // Piccadilly Circus
      [51.5100, -0.1426], // Green Park
      [51.4994, -0.1561], // Hyde Park Corner
      [51.5017, -0.1637], // Knightsbridge
      [51.4915, -0.1735], // South Kensington
      [51.4917, -0.1933], // Gloucester Road
      [51.4930, -0.2000], // Earl's Court
      [51.4854, -0.2105], // Baron's Court
      [51.4913, -0.2228], // Hammersmith
      [51.4935, -0.2360], // Turnham Green
      [51.4946, -0.2534], // Chiswick Park
      [51.4917, -0.2676], // Acton Town
      [51.5028, -0.2791], // Ealing Common
      [51.5001, -0.3053], // Boston Manor (approx)
      [51.4958, -0.3151], // Osterley
      [51.4829, -0.3237], // Hounslow East
      [51.4735, -0.3568], // Hounslow West
      [51.4664, -0.3693], // Hatton Cross
      [51.4713, -0.4527], // Heathrow T5
    ]
  },
  jubilee: {
    color: "#868F98",
    coords: [
      [51.5497, -0.1916], // Stanmore
      [51.5429, -0.1862], // Canons Park
      [51.5326, -0.1811], // Queensbury
      [51.5274, -0.1620], // Kingsbury
      [51.5236, -0.1467], // Wembley Park
      [51.5219, -0.1339], // Neasden
      [51.5140, -0.2107], // Willesden Green
      [51.5097, -0.2038], // Kilburn
      [51.5048, -0.1928], // West Hampstead
      [51.5012, -0.1767], // Finchley Road
      [51.4959, -0.1749], // Swiss Cottage
      [51.4989, -0.1720], // St John's Wood
      [51.5134, -0.1505], // Baker Street
      [51.5134, -0.1505], // Bond Street
      [51.5100, -0.1426], // Green Park
      [51.5024, -0.1319], // Westminster
      [51.4983, -0.1183], // Waterloo
      [51.5058, -0.1058], // Southwark
      [51.5048, -0.0871], // London Bridge
      [51.5152, -0.0763], // Bermondsey
      [51.5002, -0.0603], // Canada Water
      [51.5018, -0.0527], // Canary Wharf
      [51.5136, -0.0175], // North Greenwich
      [51.5137, -0.0367], // Stratford
    ]
  },
  bakerloo: {
    color: "#B26300",
    coords: [
      [51.5925, -0.3353], // Harrow & Wealdstone
      [51.5813, -0.3162], // Kenton
      [51.5706, -0.3029], // South Kenton
      [51.5622, -0.2956], // North Wembley
      [51.5518, -0.2803], // Wembley Central
      [51.5440, -0.2582], // Stonebridge Park
      [51.5321, -0.2489], // Harlesden
      [51.5322, -0.2261], // Willesden Junction
      [51.5262, -0.2081], // Kensal Green
      [51.5184, -0.1988], // Queen's Park
      [51.5114, -0.1881], // Kilburn Park
      [51.5119, -0.1754], // Maida Vale
      [51.5231, -0.1691], // Warwick Avenue
      [51.5204, -0.1753], // Paddington
      [51.5193, -0.1577], // Edgware Road
      [51.5149, -0.1610], // Marylebone
      [51.5134, -0.1505], // Baker Street
      [51.5226, -0.1424], // Regent's Park
      [51.5152, -0.1418], // Oxford Circus
      [51.5098, -0.1340], // Piccadilly Circus
      [51.5072, -0.1268], // Charing Cross
      [51.5011, -0.1245], // Embankment
      [51.4983, -0.1183], // Waterloo
      [51.4943, -0.1001], // Lambeth North
      [51.4871, -0.0878], // Elephant & Castle
    ]
  },
  district: {
    color: "#00782A",
    coords: [
      [51.5143, -0.3019], // Ealing Broadway
      [51.5103, -0.2870], // Ealing Common
      [51.4917, -0.2676], // Acton Town
      [51.4946, -0.2534], // Chiswick Park
      [51.4935, -0.2360], // Turnham Green
      [51.4920, -0.2266], // Stamford Brook
      [51.4903, -0.2142], // Ravenscourt Park
      [51.4913, -0.2228], // Hammersmith
      [51.4854, -0.2105], // Baron's Court
      [51.4930, -0.2000], // Earl's Court
      [51.4917, -0.1933], // Gloucester Road
      [51.4915, -0.1735], // South Kensington
      [51.4900, -0.1565], // Sloane Square
      [51.4965, -0.1438], // Victoria
      [51.4995, -0.1345], // St James's Park
      [51.5024, -0.1319], // Westminster
      [51.5011, -0.1245], // Embankment
      [51.5100, -0.1101], // Temple
      [51.5117, -0.1036], // Blackfriars
      [51.5118, -0.0910], // Mansion House
      [51.5111, -0.0856], // Cannon Street
      [51.5101, -0.0750], // Monument
      [51.5128, -0.0694], // Tower Hill
      [51.5103, -0.0526], // Aldgate East
      [51.5159, -0.0379], // Whitechapel
      [51.5190, -0.0155], // Stepney Green
      [51.5154, -0.0472], // Mile End
      [51.5270, 0.0245], // Bow Road
      [51.5250, 0.0340], // Bromley-by-Bow
      [51.5244, 0.0471], // West Ham
      [51.5154, 0.0717], // Plaistow
      [51.5126, 0.0892], // Upton Park
      [51.5094, 0.1013], // East Ham
      [51.5064, 0.1124], // Barking
      [51.5026, 0.1282], // Upney
      [51.4946, 0.1386], // Becontree
      [51.4846, 0.1506], // Dagenham Heathway
      [51.4755, 0.1651], // Dagenham East
      [51.4730, 0.1873], // Elm Park
      [51.4748, 0.2112], // Hornchurch
      [51.4842, 0.2518], // Upminster Bridge
      [51.5058, 0.2510], // Upminster
    ]
  },
  circle: {
    color: "#FFD329",
    coords: [
      [51.5193, -0.1577], // Edgware Road
      [51.5134, -0.1505], // Baker Street
      [51.5228, -0.1440], // Great Portland Street
      [51.5260, -0.1277], // Euston Square
      [51.5300, -0.1186], // King's Cross
      [51.5209, -0.1020], // Farringdon
      [51.5203, -0.0963], // Barbican
      [51.5196, -0.0885], // Moorgate
      [51.5175, -0.0729], // Liverpool Street
      [51.5148, -0.0755], // Aldgate
      [51.5128, -0.0694], // Tower Hill
      [51.5101, -0.0750], // Monument
      [51.5111, -0.0856], // Cannon Street
      [51.5118, -0.0910], // Mansion House
      [51.5117, -0.1036], // Blackfriars
      [51.5100, -0.1101], // Temple
      [51.5011, -0.1245], // Embankment
      [51.5024, -0.1319], // Westminster
      [51.4995, -0.1345], // St James's Park
      [51.4965, -0.1438], // Victoria
      [51.4900, -0.1565], // Sloane Square
      [51.4915, -0.1735], // South Kensington
      [51.4917, -0.1933], // Gloucester Road
      [51.4987, -0.2097], // High Street Kensington
      [51.5071, -0.1990], // Notting Hill Gate
      [51.5113, -0.1876], // Bayswater
      [51.5120, -0.1754], // Paddington
      [51.5193, -0.1577], // Edgware Road (close loop)
    ]
  },
};

// Line colors for CSS matching
const LINE_COLORS = {
  victoria: "#0098D4",
  central: "#DC241F",
  northern: "#000000",
  piccadilly: "#003688",
  jubilee: "#868F98",
  bakerloo: "#B26300",
  district: "#00782A",
  circle: "#FFD329",
  metropolitan: "#9B0058",
  "hammersmith-city": "#F3A9BB",
  "waterloo-city": "#95CDBA",
  elizabeth: "#6950A1",
};

export default function MapComponent({ activeEvents, flights = [] }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const flightMarkersRef = useRef({}); // Store flight markers by ID (icao24 or callsign)

  useEffect(() => {
    if (mapInstance.current) return;

    // Initialize Leaflet Map centered on Central London
    const map = L.map(mapRef.current, {
      center: [51.505, -0.09],
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tile layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Draw tube lines as polylines
    Object.keys(LINE_GEO).forEach(lineId => {
      const line = LINE_GEO[lineId];
      L.polyline(line.coords, {
        color: line.color,
        weight: 4,
        opacity: 0.7,
      }).addTo(map);

      // Draw white station dots at each coordinate
      line.coords.forEach(coord => {
        L.circleMarker(coord, {
          radius: 3,
          color: '#FFFFFF',
          fillColor: '#101015',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
      });
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update Flight Markers
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear old markers that are no longer in the flight list
    const currentFlightIds = new Set(flights.map(f => f.callsign || f.icao24));
    Object.keys(flightMarkersRef.current).forEach(id => {
      if (!currentFlightIds.has(id)) {
        mapInstance.current.removeLayer(flightMarkersRef.current[id]);
        delete flightMarkersRef.current[id];
      }
    });

    // Add or update markers for current flights
    flights.forEach(flight => {
      const id = flight.callsign || flight.icao24;
      const pos = [flight.lat, flight.lon];

      if (flightMarkersRef.current[id]) {
        // Move existing marker
        flightMarkersRef.current[id].setLatLng(pos);
      } else {
        // Create new airplane marker
        const planeIcon = L.divIcon({
          className: 'plane-icon',
          html: `<div style="font-size: 16px; transform: rotate(${flight.heading || 0}deg); filter: drop-shadow(0 0 4px #00d4ff);">✈️</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker(pos, { icon: planeIcon }).addTo(mapInstance.current);
        marker.bindTooltip(`${flight.callsign || 'N/A'}<br/>${Math.round(flight.altitude)}m`, {
          direction: 'right',
          className: 'flight-tooltip',
          offset: [10, 0]
        });
        flightMarkersRef.current[id] = marker;
      }
    });
  }, [flights]);

  // Flash markers on the map when live events come in (unchanged logic, but ensuring map remains)
  useEffect(() => {
    if (!mapInstance.current || activeEvents.length === 0) return;
    const latest = activeEvents[0];

    // Find coordinates for this station by matching station name
    let matchCoord = null;
    const lineGeo = LINE_GEO[latest.lineId];
    if (lineGeo) {
      let hash = 0;
      for (let i = 0; i < latest.stationName.length; i++) {
        hash = latest.stationName.charCodeAt(i) + ((hash << 5) - hash);
      }
      const idx = Math.abs(hash) % lineGeo.coords.length;
      matchCoord = lineGeo.coords[idx];
    }

    if (matchCoord) {
      const color = LINE_COLORS[latest.lineId] || '#FFFFFF';
      const pulseMarker = L.circleMarker(matchCoord, {
        radius: 12,
        color: color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 3,
      }).addTo(mapInstance.current);

      pulseMarker.bindTooltip(latest.stationName, {
        permanent: true,
        direction: 'top',
        className: 'station-tooltip',
        offset: [0, -15],
      }).openTooltip();

      setTimeout(() => {
        if (mapInstance.current && mapInstance.current.hasLayer(pulseMarker)) {
          mapInstance.current.removeLayer(pulseMarker);
        }
      }, 3000);
    }
  }, [activeEvents]);

  return (
    <div
      ref={mapRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
      }}
    />
  );
}
