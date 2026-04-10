import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Determine the API Key from Environment, but provide a fallback if it isn't set yet.
    // The user mentioned they have a key limiting to 500 req/min.
    const TFL_APP_KEY = process.env.TFL_APP_KEY;
    
    // We fetch arrival predictions for all tube lines.
    // The query string appends the API key if it's available.
    const baseUrl = 'https://api.tfl.gov.uk/Line/Mode/tube/Arrivals';
    const url = TFL_APP_KEY ? `${baseUrl}?app_key=${TFL_APP_KEY}` : baseUrl;

    const response = await fetch(url, {
      method: "GET",
      // Set headers to respect standard cache limits
      headers: {
        "Cache-Control": "no-cache",
      }
    });

    if (!response.ok) {
      throw new Error(`TFL API error: ${response.status}`);
    }

    const data = await response.json();

    // The payload is often quite large, containing arrivals for all stations across all lines.
    // We return it cleanly mapped to group by lineId.
    const arrivalsByLine = {};
    data.forEach(arrival => {
      if (!arrivalsByLine[arrival.lineId]) {
        arrivalsByLine[arrival.lineId] = [];
      }
      // For the audio trigger, we are primarily interested in when the 'timeToStation' implies an immediate arrival.
      arrivalsByLine[arrival.lineId].push({
        id: arrival.id,
        stationId: arrival.naptanId,
        stationName: arrival.stationName,
        timeToStation: arrival.timeToStation,
        direction: arrival.direction,
      });
    });

    return NextResponse.json({ success: true, data: arrivalsByLine });
  } catch (error) {
    console.error("Error fetching TFL Data:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch TFL data' }, { status: 500 });
  }
}
