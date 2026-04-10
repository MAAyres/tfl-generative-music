import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // OpenSky Network API (free, no key for limited use)
    // Bounding box around London: lat 51.3-51.7, lon -0.5 to 0.3
    const url = 'https://opensky-network.org/api/states/all?lamin=51.3&lomin=-0.5&lamax=51.7&lomax=0.3';
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      // OpenSky can be rate-limited, gracefully degrade
      return NextResponse.json({
        success: true,
        data: { flights: [], count: 0, available: false }
      });
    }

    const data = await response.json();
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
