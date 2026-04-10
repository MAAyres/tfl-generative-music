import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// All London Tube line IDs as recognized by the TFL API
const TUBE_LINES = [
  'victoria', 'central', 'northern', 'piccadilly', 'jubilee',
  'bakerloo', 'district', 'circle', 'metropolitan',
  'hammersmith-city', 'waterloo-city', 'elizabeth'
];

export async function GET() {
  try {
    const TFL_APP_KEY = process.env.TFL_APP_KEY;
    
    if (!TFL_APP_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'TFL_APP_KEY is not set. Add it to .env.local or Vercel Environment Variables.' 
      }, { status: 500 });
    }

    // The correct TFL endpoint is /Line/{comma-separated-ids}/Arrivals
    const lineIds = TUBE_LINES.join(',');
    const url = `https://api.tfl.gov.uk/Line/${lineIds}/Arrivals?app_key=${TFL_APP_KEY}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
      // Prevent Next.js from caching the fetch itself
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("TFL API returned:", response.status, errorText);
      return NextResponse.json({ 
        success: false, 
        error: `TFL API returned status ${response.status}` 
      }, { status: response.status });
    }

    const data = await response.json();

    // Group arrivals by lineId
    const arrivalsByLine = {};
    data.forEach(arrival => {
      const lineId = arrival.lineId;
      if (!arrivalsByLine[lineId]) {
        arrivalsByLine[lineId] = [];
      }
      arrivalsByLine[lineId].push({
        id: arrival.id,
        stationId: arrival.naptanId,
        stationName: arrival.stationName,
        lineName: arrival.lineName,
        timeToStation: arrival.timeToStation,
        towards: arrival.towards,
        expectedArrival: arrival.expectedArrival,
      });
    });

    // Sort each line's arrivals by timeToStation
    Object.keys(arrivalsByLine).forEach(lineId => {
      arrivalsByLine[lineId].sort((a, b) => a.timeToStation - b.timeToStation);
    });

    return NextResponse.json({ 
      success: true, 
      data: arrivalsByLine,
      totalArrivals: data.length,
    });
  } catch (error) {
    console.error("Error fetching TFL Data:", error);
    return NextResponse.json({ 
      success: false, 
      error: `Server error: ${error.message}` 
    }, { status: 500 });
  }
}
