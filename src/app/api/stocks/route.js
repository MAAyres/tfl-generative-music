import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Yahoo Finance v8 API for FTSE100 (^FTSE)
    // This is a public endpoint that returns quote data
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EFTSE?interval=1m&range=1d';

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0',
      }
    });

    if (!response.ok) {
      // Fallback: try with a different approach
      return NextResponse.json({
        success: true,
        data: {
          price: null,
          change: null,
          changePercent: null,
          available: false,
        }
      });
    }

    const data = await response.json();
    const meta = data.chart?.result?.[0]?.meta;
    const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];

    if (!meta) {
      return NextResponse.json({
        success: true,
        data: { price: null, change: null, changePercent: null, available: false }
      });
    }

    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    // Get recent volatility from the last 30 minutes of data
    const closes = quotes?.close?.filter(c => c !== null) || [];
    const recentCloses = closes.slice(-30);
    let volatility = 0;
    if (recentCloses.length > 1) {
      const diffs = [];
      for (let i = 1; i < recentCloses.length; i++) {
        diffs.push(Math.abs(recentCloses[i] - recentCloses[i - 1]));
      }
      volatility = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    }

    return NextResponse.json({
      success: true,
      data: {
        price: currentPrice,
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2),
        volatility: volatility.toFixed(4),
        available: true,
      }
    });
  } catch (error) {
    console.error("Stocks API error:", error);
    // Don't fail hard — stocks are a nice-to-have
    return NextResponse.json({
      success: true,
      data: { price: null, change: null, changePercent: null, available: false }
    });
  }
}
