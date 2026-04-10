import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // OpenSky Network API (free, no key for limited use)
    // Expanded box: South East England (roughly Bournemouth to Norwich)
    // lomin: -2.0, lamin: 50.5, lomax: 2.0, lamax: 53.0
    const url = 'https://opensky-network.org/api/states/all?lamin=50.5&lomin=-2.0&lamax=53.0&lomax=2.0';
    const response = await fetch(url, { cache: 'no-store' });
    console.log(`OpenSky API Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.warn("OpenSky API non-OK response, returning empty safe data.");
      // OpenSky can be rate-limited, gracefully degrade
      return NextResponse.json({
        success: true,
        data: { flights: [], count: 0, available: false }
      });
    }

    const data = await response.json();
    console.log(`OpenSky Data: Found ${data?.states?.length || 0} total aircraft in area.`);
    const states = data.states || [];

    // Each state: [icao24, callsign, origin_country, time_position, last_contact,
    //              longitude, latitude, baro_altitude, on_ground, velocity,
    //              true_track, vertical_rate, sensors, geo_altitude, squawk,
    //              spi, position_source]
    const flights = states
      .filter(s => !s[8]) // not on ground
      .slice(0, 20) // cap at 20 flights
      .map(s => ({
        callsign: (s[1] || '').trim(),
        lat: s[6],
        lon: s[5],
        altitude: s[7], // meters
        velocity: s[9], // m/s
        verticalRate: s[11], // m/s
        heading: s[10],
      }));

    return NextResponse.json({
      success: true,
      data: {
        flights,
        count: flights.length,
        totalInArea: states.length,
        available: true,
      }
    });
  } catch (error) {
    console.error("Flights API error:", error);
    return NextResponse.json({
      success: true,
      data: { flights: [], count: 0, available: false }
    });
  }
}
