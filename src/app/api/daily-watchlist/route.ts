import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

import idxTickers from '@/data/idx-tickers.json';

// Saham raksasa / mega cap yang dikecualikan dari Swing/Scalping karena gerakannya lambat & defensif
const DEFENSIVE_BIG_CAPS = new Set([
  'BBCA.JK', 'BBRI.JK', 'BMRI.JK', 'BBNI.JK', 'TLKM.JK', 'ASII.JK',
  'ICBP.JK', 'UNVR.JK', 'KLBF.JK', 'INDF.JK', 'AMMN.JK', 'BREN.JK', 'TPIA.JK'
]);

// Emiten Blue Chip fundamental untuk Investasi Jangka Panjang
const INVEST_CANDIDATES = [
  'BBCA.JK', 'BBRI.JK', 'BMRI.JK', 'BBNI.JK', 'ASII.JK', 'TLKM.JK',
  'ICBP.JK', 'INDF.JK', 'UNVR.JK', 'KLBF.JK', 'ADRO.JK', 'PTBA.JK',
  'ITMG.JK', 'PGAS.JK', 'JSMR.JK', 'ACES.JK', 'MYOR.JK', 'CPIN.JK',
  'MAPI.JK', 'SMGR.JK', 'BSDE.JK', 'PWON.JK', 'CTRA.JK', 'AKRA.JK',
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
  resistance?: number;
  support?: number;
  idealBuyPrice?: number;
  stopLoss?: number;
  riskPercent?: number;
  ihsgWarning?: string | null;
}

export interface IhsgData {
  price: number;
  changePercent: number;
  status: 'bullish' | 'sideways' | 'bearish';
  label: string;
  advice: string;
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

    // Ambil data pergerakan IHSG (^JKSE) secara realtime
    let ihsgData: IhsgData = {
      price: 0,
      changePercent: 0,
      status: 'sideways',
      label: 'Pasar Konsolidasi',
      advice: 'Selektif pilih saham berakumulasi volume tinggi.',
    };

    try {
      const ihsgRes = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EJKSE', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        cache: 'no-store',
      });
      if (ihsgRes.ok) {
        const ihsgJson = await ihsgRes.json();
        const meta = ihsgJson?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          const cur = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || cur;
          const pct = Math.round(((cur - prev) / prev) * 1000) / 10;
          let status: 'bullish' | 'sideways' | 'bearish' = 'sideways';
          let label = 'Pasar Konsolidasi';
          let advice = 'Pilih saham dengan volume spike kuat.';

          if (pct <= -0.4) {
            status = 'bearish';
            label = 'Pasar Melemah (Tekanan Jual)';
            advice = 'IHSG merah! Saham yang melesat rawan profit taking / tarik turun. Jangan kejar harga tinggi, prioritaskan kunci profit.';
          } else if (pct >= 0.3) {
            status = 'bullish';
            label = 'Pasar Kuat (Risk-On)';
            advice = 'IHSG hijau kondusif. Saham breakout berpotensi rally lanjutan.';
          }

          ihsgData = {
            price: Math.round(cur),
            changePercent: pct,
            status,
            label,
            advice,
          };
        }
      }
    } catch (e) {
      console.warn('Gagal memuat quote IHSG:', e);
    }

    const now = new Date();
    const past = new Date();
    past.setFullYear(now.getFullYear() - 5);
    const past90d = new Date();
    past90d.setDate(now.getDate() - 90);

    let targetTickers: { ticker: string; quote: any }[] = [];

    if (mode === 'swing') {
      // 1. Ambil data quote LIVE untuk SELURUH 955 emiten IDX
      const allSymbols = (idxTickers as string[]).map((t) => `${t}.JK`);
      const allQuotes = await yahooFinance.quote(allSymbols).catch(() => []);

      // 2. Filter: Hanya saham aktif transaksi (> 50.000 lembar), punya harga, dan EXCLUDE saham raksasa defensif
      const activeSwings = allQuotes.filter((q: any) => {
        if (!q.regularMarketPrice || q.regularMarketPrice <= 0) return false;
        if (DEFENSIVE_BIG_CAPS.has(q.symbol)) return false; // Exclude BBCA, BBRI, BMRI, BBNI, TLKM, ASII, dll
        if (!q.regularMarketVolume || q.regularMarketVolume < 50000) return false; // Filter saham tidur / mati
        return true;
      });

      // 3. Urutkan berdasarkan gabungan kenaikan harga + lonjakan volume untuk mengambil kandidat terpanas
      const topActive = activeSwings
        .sort((a: any, b: any) => {
          const volA = a.regularMarketVolume || 0;
          const volB = b.regularMarketVolume || 0;
          const avgA = a.averageDailyVolume10Day || volA;
          const avgB = b.averageDailyVolume10Day || volB;
          const spikeA = avgA > 0 ? volA / avgA : 1;
          const spikeB = avgB > 0 ? volB / avgB : 1;
          const scoreA = (a.regularMarketChangePercent || 0) * 2.5 + spikeA * 10;
          const scoreB = (b.regularMarketChangePercent || 0) * 2.5 + spikeB * 10;
          return scoreB - scoreA;
        })
        .slice(0, 45); // Ambil top 45 saham teraktif & terpanas di seluruh bursa IDX hari ini

      targetTickers = topActive.map((q: any) => ({ ticker: q.symbol, quote: q }));
    } else {
      // MODE INVESTASI: Fokus pada saham berfundamental solid
      const investQuotes = await yahooFinance.quote(INVEST_CANDIDATES).catch(() => []);
      targetTickers = investQuotes.map((q: any) => ({ ticker: q.symbol, quote: q }));
    }

    // Ambil data chart historis untuk kandidat terpilih secara paralel
    const results = await Promise.all(
      targetTickers.map(async ({ ticker, quote }) => {
        try {
          const [chartData, chartDaily] = await Promise.all([
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
          let resistance: number | undefined = undefined;
          let support: number | undefined = undefined;
          let idealBuyPrice: number | undefined = undefined;
          let stopLoss: number | undefined = undefined;
          let riskPercent: number | undefined = undefined;

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
            const todayVol = dailyQuotes[dailyQuotes.length - 1].volume || (quote.regularMarketVolume || 0);
            volSpike = avgVol > 0 ? Math.round((todayVol / avgVol) * 10) / 10 : 1;

            const resistanceRaw = Math.max(...last20.map((q: any) => q.high || q.close));
            const supportRaw = Math.min(...last20.map((q: any) => q.low || q.close));
            resistance = Math.round(resistanceRaw > price ? resistanceRaw : price * 1.05);
            support = Math.round(supportRaw < price ? supportRaw : price * 0.95);
            swingPotential = resistance > price ? Math.round(((resistance - price) / price) * 1000) / 10 : 5.0;

            // Harga Ideal Beli:
            if (ma20 && price > ma20) {
              idealBuyPrice = Math.round(Math.max(support, ma20 * 0.99));
            } else {
              idealBuyPrice = Math.round(support + (price - support) * 0.25);
            }

            // Stop Loss & Risk Loss (%):
            // Batas toleransi cut loss ketat: 1-2 tik di bawah support atau batas -4% s/d -5% dari entry
            const baselinePrice = idealBuyPrice || price;
            const slCandidate = Math.min(Math.round(baselinePrice * 0.96), Math.round(support * 0.98));
            stopLoss = slCandidate < baselinePrice ? slCandidate : Math.round(baselinePrice * 0.95);
            riskPercent = Math.round(Math.abs((baselinePrice - stopLoss) / baselinePrice) * 1000) / 10;
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
            resistance,
            support,
            idealBuyPrice,
            stopLoss,
            riskPercent,
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

      // 1. Kategori: Volume Breakout (Lonjakan Transaksi > 1.4x + Harga Hijau)
      const volumeBreakouts = validStocks
        .filter((s) => s.volSpike && s.volSpike >= 1.3 && s.changePercent > 0.5)
        .sort((a, b) => (b.volSpike || 0) - (a.volSpike || 0));
      volumeBreakouts.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'volume-breakout',
          categoryLabel: '🚀 Volume Breakout',
          highlightReason: `Volume transaksi meledak ${s.volSpike}x rata-rata 20 hari (Naik +${s.changePercent.toFixed(1)}%). Indikasi akumulasi bandar/institusi aktif.`,
          tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        });
      });

      // 2. Kategori: Oversold Swing Rebound (RSI <= 38 - Pantulan Cepat)
      const oversoldRebound = validStocks
        .filter((s) => s.rsi && s.rsi <= 38 && !dailyPicks.some((p) => p.ticker === s.ticker))
        .sort((a, b) => (a.rsi || 100) - (b.rsi || 100));
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
        .sort((a, b) => b.changePercent - a.changePercent);
      momentumRunners.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'momentum-runner',
          categoryLabel: '⚡ Momentum Uptrend',
          highlightReason: `Bertengger di atas garis MA20 dengan kenaikan +${s.changePercent.toFixed(1)}% hari ini. Potensi cuan jangka pendek cepat berlanjut.`,
          tagColor: 'bg-amber-100 text-amber-800 border-amber-300',
        });
      });

      // Saham potensi swing lainnya jika belum masuk
      const remaining = validStocks
        .filter((s) => !dailyPicks.some((p) => p.ticker === s.ticker))
        .sort((a, b) => (b.swingPotential || 0) - (a.swingPotential || 0));
      remaining.forEach((s) => {
        dailyPicks.push({
          ...s,
          category: 'rebound-momentum',
          categoryLabel: '🎯 Target Swing',
          highlightReason: `Potensi kenaikan ke resistance 20 hari +${s.swingPotential}%. Cocok untuk swing buy on weakness.`,
          tagColor: 'bg-teal-100 text-teal-800 border-teal-300',
        });
      });
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

    // Tambahkan label peringatan IHSG untuk mode Swing Trade
    if (mode === 'swing') {
      dailyPicks.forEach((p) => {
        if (ihsgData.status === 'bearish') {
          if (p.changePercent >= 7.0) {
            p.ihsgWarning = '⚠️ IHSG Sedang Lemah: Saham sudah naik tinggi, sangat rawan terkena profit taking / ditarik turun!';
          } else if (p.changePercent >= 2.0) {
            p.ihsgWarning = '⚠️ IHSG Melemah: Kenaikan tertahan sentimen pasar. Prioritaskan kunci cuan dekat resistance.';
          } else if (p.changePercent > 0) {
            p.ihsgWarning = '🛡️ Tahan Banting: Bertahan hijau saat IHSG memerah (Relative Strength positif).';
          }
        } else if (ihsgData.status === 'bullish') {
          if (p.changePercent >= 3.0) {
            p.ihsgWarning = '🔥 IHSG Kuat: Didukung arus modal bursa yang positif untuk rally lanjutan.';
          }
        }
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
      ihsg: ihsgData,
      picks: dailyPicks,
    });
  } catch (error: any) {
    console.error('Error fetching daily watchlist:', error);
    return NextResponse.json({ error: error?.message || 'Gagal memuat watchlist harian' }, { status: 500 });
  }
}
