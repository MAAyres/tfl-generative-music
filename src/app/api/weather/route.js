import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Open-Meteo API doesn't require an API key for its standard limits.
    // We fetch London's coordinates: Latitude 51.5074, Longitude -0.1278
    const params = new URLSearchParams({
      latitude: '51.5074',
      longitude: '-0.1278',
      current_weather: 'true'
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current_weather;

    // For missing data like humidity, which 'current_weather' doesn't usually provide,
    // we could fetch 'hourly=relativehumidity_2m'. But simpler: proxy it via the 'current' endpoints that were introduced later.
    // For now we will structure what we have, and simulate or expand later:
    // Actually, Open-Meteo current endpoint supports specific variables:
    const detailedParams = new URLSearchParams({
      latitude: '51.5074',
      longitude: '-0.1278',
      current: 'temperature_2m,relative_humidity_2m,wind_speed_10m'
    });
    
    // We'll refetch with the specific `current` array to get exactly what we mapped!
    const updatedResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${detailedParams.toString()}`);
    const updatedData = await updatedResponse.json();

    const result = {
      temperature: updatedData.current.temperature_2m,
      humidity: updatedData.current.relative_humidity_2m,
      windSpeed: updatedData.current.wind_speed_10m,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching Weather Data:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch weather data' }, { status: 500 });
  }
}
