import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

// Emiten berfundamental liquid & teruji di IDX
const WATCHLIST_CANDIDATES = [
  'BBCA.JK',
  'BBRI.JK',
  'BMRI.JK',
  'BBNI.JK',
  'ASII.JK',
  'TLKM.JK',
  'ICBP.JK',
  'INDF.JK',
  'UNVR.JK',
  'KLBF.JK',
  'ADRO.JK',
  'PTBA.JK',
  'ITMG.JK',
  'PGAS.JK',
  'JSMR.JK',
  'ACES.JK',
  'MYOR.JK',
  'CPIN.JK',
  'MAPI.JK',
  'SMGR.JK',
];

export interface DailyPick {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  marketCapFormatted: string;
  category: 'super-undervalued' | 'high-dividend' | 'rebound-momentum' | 'oversold-bluechip' | 'volume-breakout' | 'swing-rebound' | 'momentum-runner';
  categoryLabel: string;
  highlightReason: string;
  tagColor: string;
  per: number | null;
  pbv: number | null;
  dividendYield: number | null;
  distanceFrom52wLow: number; // Dalam persen dari harga terendah 52 minggu
  // Swing Trade additions
  rsi?: number | null;
  volSpike?: number | null;
  swingPotential?: number;
}

function calculateStats(values: number[]) {
  const valid = values.filter((v) => v !== null && !isNaN(v) && v > 0);
  if (valid.length === 0) return { mean: 0, std: 0 };
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / valid.length;
  return { mean, std: Math.sqrt(variance) };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') === 'swing' ? 'swing' : 'invest';

    const fxQuote = await yahooFinance.quote('USDIDR=X').catch(() => null);
    const usdIdrRate = fxQuote?.regularMarketPrice || 16200;

    const now = new Date();
    const past = new Date();
    past.setFullYear(now.getFullYear() - 5);
    const past90d = new Date();
    past90d.setDate(now.getDate() - 90);

    // Ambil data quote dan chart secara paralel
    const results = await Promise.all(
      WATCHLIST_CANDIDATES.map(async (ticker) => {
        try {
          const [quote, chartData, chartDaily] = await Promise.all([
            yahooFinance.quote(ticker),
            yahooFinance.chart(ticker, { period1: past, interval: '1mo' }).catch(() => null),
            yahooFinance.chart(ticker, { period1: past90d, interval: '1d' }).catch(() => null),
          ]);

          const price = quote.regularMarketPrice || quote.currentPrice;
          if (!price) return null;

          let eps = quote.epsTrailingTwelveMonths || null;
          let bookValue = quote.bookValue || null;

          if (quote.financialCurrency === 'USD') {
            if (bookValue && bookValue < 50) {
              bookValue = bookValue * usdIdrRate;
            }
          }

          const quotes = chartData?.quotes || [];
          const histPEs: number[] = [];
          const histPBVs: number[] = [];
          quotes.forEach((item: any) => {
            const p = item.close;
            if (p && p > 0) {
              if (eps && eps > 0) histPEs.push(p / eps);
              if (bookValue && bookValue > 0) histPBVs.push(p / bookValue);
            }
          });

          const peStats = calculateStats(histPEs);
          const pbvStats = calculateStats(histPBVs);
          const perMean = peStats.mean > 0 ? peStats.mean : quote.trailingPE ? quote.trailingPE * 1.15 : 15;
          const pbvMean = pbvStats.mean > 0 ? pbvStats.mean : quote.priceToBook ? quote.priceToBook * 1.1 : 2.0;

          const perFair = eps && eps > 0 ? eps * perMean : null;
          const pbvFair = bookValue && bookValue > 0 ? bookValue * pbvMean : null;
          const fairPrice = perFair && pbvFair ? (perFair + pbvFair) / 2 : perFair || pbvFair;

          const mos = fairPrice && fairPrice > 0 ? ((fairPrice - price) / fairPrice) * 100 : 0;

          // Hitung Dividend Yield
          let divYield: number | null = null;
          const rawYield = quote.trailingAnnualDividendYield ?? quote.dividendYield;
          if (rawYield !== null && rawYield !== undefined && rawYield > 0) {
            divYield = rawYield < 1 ? Math.round(rawYield * 1000) / 10 : Math.round(rawYield * 10) / 10;
          }

          // Hitung Jarak dari 52-Week Low
          const low52 = quote.fiftyTwoWeekLow || price;
          const distanceFrom52wLow = Math.round(((price - low52) / low52) * 1000) / 10;

          const changePercent = quote.regularMarketChangePercent || 0;
          const trailingPE = quote.trailingPE ? Math.round(quote.trailingPE * 10) / 10 : null;
          const priceToBook = quote.priceToBook ? Math.round(quote.priceToBook * 100) / 100 : null;
          const marketCap = quote.marketCap || 0;
          const marketCapFormatted = `Rp ${(marketCap / 1_000_000_000_000).toFixed(1)} T`;

          // Indikator Teknikal Singkat untuk Swing Trade
          const dailyQuotes = (chartDaily?.quotes || []).filter((q: any) => q.close && q.close > 0);
          let rsi: number | null = null;
          let volSpike: number | null = null;
          let swingPotential = 0;
          let ma20: number | null = null;

          if (dailyQuotes.length >= 20) {
            let gains = 0;
            let losses = 0;
            for (let i = dailyQuotes.length - 14; i < dailyQuotes.length; i++) {
              const prev = Number(dailyQuotes[i - 1]?.close || 0);
              const curr = Number(dailyQuotes[i]?.close || 0);
              const diff = curr - prev;
              if (diff >= 0) gains += diff;
              else losses += Math.abs(diff);
            }
            const avgGain = gains / 14;
            const avgLoss = losses / 14;
            const calculatedRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
            rsi = Math.round(calculatedRsi * 10) / 10;

            const last20 = dailyQuotes.slice(-20);
            ma20 = last20.reduce((acc: number, q: any) => acc + q.close, 0) / 20;
            const avgVol = last20.reduce((acc: number, q: any) => acc + (q.volume || 0), 0) / 20;
            const todayVol = dailyQuotes[dailyQuotes.length - 1].volume || 0;
            volSpike = avgVol > 0 ? Math.round((todayVol / avgVol) * 10) / 10 : 1;

            const resistance = Math.max(...last20.map((q: any) => q.high || q.close));
            swingPotential = resistance > price ? Math.round(((resistance - price) / price) * 1000) / 10 : 5.0;
          }

          return {
            ticker: ticker.replace('.JK', ''),
            name: quote.shortName || quote.longName || ticker.replace('.JK', ''),
            price,
            changePercent,
            marketCap,
            marketCapFormatted,
            per: trailingPE,
            pbv: priceToBook,
            dividendYield: divYield,
            marginOfSafety: Math.round(mos * 10) / 10,
            distanceFrom52wLow,
            rsi,
            volSpike,
            swingPotential,
            ma20,
          };
        } catch {
          return null;
        }
      })
    );

    const validStocks = results.filter((s): s is NonNullable<typeof s> => s !== null);

    const dailyPicks: DailyPick[] = [];

    if (mode === 'swing') {
      // ==========================================
      // MODE SWING TRADE: CARI SAHAM CUAN CEPAT
      // ==========================================

      // 1. Kategori: Volume Breakout (Lonjakan Transaksi > 1.5x + Harga Hijau)
      const volumeBreakouts = validStocks
        .filter((s) => s.volSpike && s.volSpike >= 1.4 && s.changePercent > 0.5)
        .sort((a, b) => (b.volSpike || 0) - (a.volSpike || 0))
        .slice(0, 2);
      volumeBreakouts.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'volume-breakout',
          categoryLabel: '🚀 Volume Breakout',
          highlightReason: `Volume transaksi meledak ${s.volSpike}x rata-rata 20 hari (Naik +${s.changePercent.toFixed(1)}%). Indikasi akumulasi bandar/institusi aktif.`,
          tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        });
      });

      // 2. Kategori: Oversold Swing Rebound (RSI < 38 - Pantulan Cepat)
      const oversoldRebound = validStocks
        .filter((s) => s.rsi && s.rsi <= 38 && !dailyPicks.some((p) => p.ticker === s.ticker))
        .sort((a, b) => (a.rsi || 100) - (b.rsi || 100))
        .slice(0, 2);
      oversoldRebound.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'swing-rebound',
          categoryLabel: '🟢 Oversold Pantulan',
          highlightReason: `RSI(14) hanya ${s.rsi} (sangat jenuh jual). Ruang upside rebound ke resistance terdekat: +${s.swingPotential}%.`,
          tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        });
      });

      // 3. Kategori: Momentum Runner (Above MA20 + Hijau Konsisten)
      const momentumRunners = validStocks
        .filter((s) => s.changePercent >= 1.0 && s.ma20 && s.price > s.ma20 && !dailyPicks.some((p) => p.ticker === s.ticker))
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 2);
      momentumRunners.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'momentum-runner',
          categoryLabel: '⚡ Momentum Uptrend',
          highlightReason: `Bertengger di atas garis MA20 dengan kenaikan +${s.changePercent.toFixed(1)}% hari ini. Potensi cuan jangka pendek cepat berlanjut.`,
          tagColor: 'bg-amber-100 text-amber-800 border-amber-300',
        });
      });

      // Jika masih kurang dari 4 picks, isi dengan saham potensi swing tertinggi
      if (dailyPicks.length < 4) {
        const remaining = validStocks
          .filter((s) => !dailyPicks.some((p) => p.ticker === s.ticker))
          .sort((a, b) => (b.swingPotential || 0) - (a.swingPotential || 0))
          .slice(0, 4 - dailyPicks.length);
        remaining.forEach((s) => {
          dailyPicks.push({
            ...s,
            category: 'rebound-momentum',
            categoryLabel: '🎯 Target Swing',
            highlightReason: `Potensi kenaikan ke resistance 20 hari +${s.swingPotential}%. Cocok untuk swing buy on weakness.`,
            tagColor: 'bg-teal-100 text-teal-800 border-teal-300',
          });
        });
      }
    } else {
      // ==========================================
      // MODE INVESTASI: CARI FUNDAMENTAL & VALUASI DISKON
      // ==========================================

      // 1. Kategori: Diskon Valuasi Terbesar (Super Undervalued)
      const sortedByMoS = [...validStocks].sort((a, b) => b.marginOfSafety - a.marginOfSafety);
      const topUndervalued = sortedByMoS.filter((s) => s.marginOfSafety >= 20).slice(0, 2);
      topUndervalued.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'super-undervalued',
          categoryLabel: 'Diskon Jumbo (Undervalued)',
          highlightReason: `Margin of Safety +${s.marginOfSafety}%. Harga saat ini jauh di bawah rata-rata historis 5 tahun.`,
          tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        });
      });

      // 2. Kategori: Saham Dividen Jumbo (Yield > 6%)
      const highDividend = validStocks
        .filter((s) => s.dividendYield && s.dividendYield >= 6.0 && !dailyPicks.some((p) => p.ticker === s.ticker))
        .sort((a, b) => (b.dividendYield || 0) - (a.dividendYield || 0))
        .slice(0, 2);
      highDividend.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'high-dividend',
          categoryLabel: 'Dividen Jumbo',
          highlightReason: `Yield dividen ${s.dividendYield}% per tahun. Cashflow pasif tinggi untuk investor income.`,
          tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        });
      });

      // 3. Kategori: Rebound Hari Ini (Momentum + Undervalued)
      const reboundPicks = validStocks
        .filter((s) => s.changePercent >= 1.5 && s.marginOfSafety > 10 && !dailyPicks.some((p) => p.ticker === s.ticker))
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 2);
      reboundPicks.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'rebound-momentum',
          categoryLabel: 'Rebound Hijau Hari Ini',
          highlightReason: `Naik +${s.changePercent.toFixed(1)}% hari ini dengan valuasi yang masih tergolong murah (MoS +${s.marginOfSafety}%).`,
          tagColor: 'bg-teal-100 text-teal-800 border-teal-300',
        });
      });

      // 4. Kategori: Dekat Bottom 52 Minggu (Oversold Bluechip)
      const oversoldPicks = validStocks
        .filter((s) => s.distanceFrom52wLow <= 12 && s.marginOfSafety > 10 && !dailyPicks.some((p) => p.ticker === s.ticker))
        .sort((a, b) => a.distanceFrom52wLow - b.distanceFrom52wLow)
        .slice(0, 2);
      oversoldPicks.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'oversold-bluechip',
          categoryLabel: 'Dekat Dasar (52W Low)',
          highlightReason: `Hanya berjarak ${s.distanceFrom52wLow}% dari harga terendah 1 tahunnya. Potensi downside sudah terbatas.`,
          tagColor: 'bg-amber-100 text-amber-800 border-amber-300',
        });
      });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      dateFormatted: new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      count: dailyPicks.length,
      picks: dailyPicks,
    });
  } catch (error: any) {
    console.error('Error fetching daily watchlist:', error);
    return NextResponse.json({ error: error?.message || 'Gagal memuat watchlist harian' }, { status: 500 });
  }
}
