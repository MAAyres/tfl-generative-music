import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const TFL_APP_KEY = process.env.TFL_APP_KEY;
    if (!TFL_APP_KEY) {
      return NextResponse.json({ success: false, error: 'TFL_APP_KEY not set' }, { status: 500 });
    }

    // Fetch current road disruptions across London
    const url = `https://api.tfl.gov.uk/Road/all/Disruption?app_key=${TFL_APP_KEY}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `TFL Road API: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();

    // Summarize: total disruptions, severity breakdown
    const severityCounts = { Minimal: 0, Moderate: 0, Severe: 0, Serious: 0 };
    data.forEach(d => {
      const sev = d.severity || 'Minimal';
      if (severityCounts[sev] !== undefined) severityCounts[sev]++;
      else severityCounts['Minimal']++;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalDisruptions: data.length,
        severity: severityCounts,
      }
    });
  } catch (error) {
    console.error("Traffic API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
