import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Open-Meteo Air Quality API — free, no key required
    const params = new URLSearchParams({
      latitude: '51.5074',
      longitude: '-0.1278',
      current: 'pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,european_aqi',
    });

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Air Quality API: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    const current = data.current;

    return NextResponse.json({
      success: true,
      data: {
        pm25: current.pm2_5,
        pm10: current.pm10,
        no2: current.nitrogen_dioxide,
        co: current.carbon_monoxide,
        aqi: current.european_aqi,
      }
    });
  } catch (error) {
    console.error("Air Quality API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
