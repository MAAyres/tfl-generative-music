import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Environment Agency Real Time Flood Monitoring API (free, no key)
    // Fetch Thames river level stations near London
    // Kingston station (ID: 7400) is a reliable Thames gauge in London
    const stationUrl = 'https://environment.data.gov.uk/flood-monitoring/id/stations/7400TH';
    const stationRes = await fetch(stationUrl, { cache: 'no-store' });

    if (!stationRes.ok) {
      return NextResponse.json({ success: false, error: `River API: ${stationRes.status}` }, { status: stationRes.status });
    }

    const stationData = await stationRes.json();
    const measures = stationData.items?.measures;

    // Get the latest reading
    let latestLevel = null;
    let typicalRange = null;

    if (measures) {
      // measures can be an object or array
      const measureUrl = Array.isArray(measures) ? measures[0]?.['@id'] : measures?.['@id'];
      if (measureUrl) {
        const readingRes = await fetch(`${measureUrl}/readings?_sorted&_limit=1`, { cache: 'no-store' });
        if (readingRes.ok) {
          const readingData = await readingRes.json();
          if (readingData.items && readingData.items.length > 0) {
            latestLevel = readingData.items[0].value;
          }
        }
      }
      // Get typical range
      const typicalHigh = Array.isArray(measures) ? measures[0]?.typicalRangeHigh : measures?.typicalRangeHigh;
      const typicalLow = Array.isArray(measures) ? measures[0]?.typicalRangeLow : measures?.typicalRangeLow;
      if (typicalHigh && typicalLow) {
        typicalRange = { high: typicalHigh, low: typicalLow };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        level: latestLevel,
        typicalRange,
        stationName: stationData.items?.label || 'Thames at Kingston',
      }
    });
  } catch (error) {
    console.error("River API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
