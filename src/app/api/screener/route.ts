import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

import idxTickers from '@/data/idx-tickers.json';

// Saham raksasa / mega cap yang dikecualikan dari Swing/Scalping karena gerakannya lambat & defensif
const DEFENSIVE_BIG_CAPS = new Set([
  'BBCA.JK', 'BBRI.JK', 'BMRI.JK', 'BBNI.JK', 'TLKM.JK', 'ASII.JK',
  'ICBP.JK', 'UNVR.JK', 'KLBF.JK', 'INDF.JK', 'AMMN.JK', 'BREN.JK', 'TPIA.JK'
]);

// Daftar saham solid & liquid untuk Investasi Jangka Panjang (Value & Dividend)
const INVEST_TICKERS = [
  'BBCA.JK', 'BBRI.JK', 'BMRI.JK', 'BBNI.JK', 'ASII.JK', 'TLKM.JK',
  'ICBP.JK', 'INDF.JK', 'UNVR.JK', 'KLBF.JK', 'ADRO.JK', 'PTBA.JK',
  'ITMG.JK', 'PGAS.JK', 'JSMR.JK', 'ACES.JK', 'MYOR.JK', 'CPIN.JK',
  'MAPI.JK', 'SMGR.JK', 'BSDE.JK', 'PWON.JK', 'CTRA.JK', 'AKRA.JK',
];

interface ScreenerStock {
  ticker: string;
  name: string;
  price: number;
  changePercent?: number;
  marketCap: number;
  marketCapFormatted: string;
  per: number | null;
  pbv: number | null;
  dividendYield: number | null;
  marginOfSafety: number;
  status: 'undervalued' | 'fair' | 'expensive';
  // Properti Trading / Swing Momentum
  rsi?: number | null;
  ma5?: number | null;
  ma10?: number | null;
  ma20?: number | null;
  isBullishAlignment?: boolean; // P >= MA5 >= MA10 >= MA20
  isGoldenCross?: boolean; // MA5 crossing or above MA10
  volSpike?: number | null;
  trend?: 'uptrend' | 'downtrend' | 'sideways';
  swingPotential?: number; // Potensi kenaikan jangka pendek ke resistance (%)
  swingSignal?: string;
  swingSignalBadge?: string;
  signalTags?: { label: string; badge: string; tooltip: string }[];
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
    const minCapParam = searchParams.get('minMarketCap');
    const parsedMinCap = minCapParam ? parseFloat(minCapParam) : NaN;
    // Default filter minimal Market Cap Rp 1 Triliun (atau nilai custom dari user input)
    const MIN_MARKET_CAP = !isNaN(parsedMinCap) && parsedMinCap >= 0 ? parsedMinCap : 1_000_000_000_000;

    // Kurs USDIDR untuk normalisasi emiten pembukuan USD (seperti ADRO, PTRO, MEDC)
    const fxQuote = await yahooFinance.quote('USDIDR=X').catch(() => null);
    const usdIdrRate = fxQuote?.regularMarketPrice || 16200;

    const now = new Date();
    const past = new Date();
    past.setFullYear(now.getFullYear() - 5);

    let targetTickers: { ticker: string; quote: any }[] = [];

    if (mode === 'swing') {
      // 1. Ambil data quote LIVE untuk SELURUH 955 emiten IDX
      const allSymbols = (idxTickers as string[]).map((t) => `${t}.JK`);
      const allQuotes = await yahooFinance.quote(allSymbols).catch(() => []);

      // 2. Filter: Hanya saham aktif transaksi (> 30.000 lembar), punya harga, dan EXCLUDE saham raksasa defensif
      const activeSwings = allQuotes.filter((q: any) => {
        if (!q.regularMarketPrice || q.regularMarketPrice <= 0) return false;
        if (DEFENSIVE_BIG_CAPS.has(q.symbol)) return false; // Exclude BBCA, BBRI, BMRI, BBNI, TLKM, ASII, dll
        if (!q.regularMarketVolume || q.regularMarketVolume < 30000) return false;
        return true;
      });

      // 3. Urutkan berdasarkan momentum & likuiditas untuk mengambil kandidat teraktif (top 60)
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
        .slice(0, 60);

      targetTickers = topActive.map((q: any) => ({ ticker: q.symbol, quote: q }));
    } else {
      // MODE INVESTASI: Fokus pada saham berfundamental solid
      const investQuotes = await yahooFinance.quote(INVEST_TICKERS).catch(() => []);
      targetTickers = investQuotes.map((q: any) => ({ ticker: q.symbol, quote: q }));
    }

    // Ambil data quote dan chart historis secara paralel untuk semua emiten
    const stockResults = await Promise.all(
      targetTickers.map(async ({ ticker, quote }) => {
        try {
          const past90d = new Date();
          past90d.setDate(now.getDate() - 90);

          const [chartMonthly, chartDaily] = await Promise.all([
            yahooFinance.chart(ticker, { period1: past, interval: '1mo' }).catch(() => null),
            yahooFinance.chart(ticker, { period1: past90d, interval: '1d' }).catch(() => null),
          ]);

          const price = quote.regularMarketPrice || quote.currentPrice;
          const marketCap = quote.marketCap || 0;

          // Filter anti-gorengan: hanya saham dengan Market Cap >= MIN_MARKET_CAP
          if (!price || marketCap < MIN_MARKET_CAP) return null;

          let eps = quote.epsTrailingTwelveMonths || null;
          let bookValue = quote.bookValue || null;

          // Normalisasi jika emiten mencatatkan pembukuan dalam USD
          if (quote.financialCurrency === 'USD') {
            if (bookValue && bookValue < 50) {
              bookValue = bookValue * usdIdrRate;
            }
          }

          const monthlyQuotes = chartMonthly?.quotes || [];
          const histPEs: number[] = [];
          const histPBVs: number[] = [];

          monthlyQuotes.forEach((item: any) => {
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

          // Gunakan rumus harga wajar yang identik 100% dengan panel detail saham:
          let fairPrice: number | null = null;
          if (perFair && pbvFair) {
            fairPrice = (perFair + pbvFair) / 2;
          } else {
            fairPrice = perFair || pbvFair;
          }

          const mos =
            fairPrice && fairPrice > 0
              ? ((fairPrice - price) / fairPrice) * 100
              : 0;

          // Format Market Cap dalam Triliun Rupiah (T)
          const triliun = marketCap / 1_000_000_000_000;
          const marketCapFormatted = `Rp ${triliun.toFixed(1)} T`;

          // Dividend Yield
          let divYield: number | null = null;
          const rawYield = quote.trailingAnnualDividendYield ?? quote.dividendYield;
          if (rawYield !== null && rawYield !== undefined && rawYield > 0) {
            divYield = rawYield < 1 ? rawYield * 100 : rawYield;
          }

          const trailingPE = quote.trailingPE || null;
          let currentPBV = quote.priceToBook || null;
          if (quote.financialCurrency === 'USD' && bookValue && bookValue > 0) {
            currentPBV = price / bookValue;
          }

          // Kalkulasi Indikator Swing & Momentum
          const dailyQuotes = (chartDaily?.quotes || []).filter((q: any) => q.close && q.close > 0);
          let rsi: number | null = null;
          let volSpike: number | null = null;
          let trend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
          let swingPotential = 0;
          let swingSignal = 'Neutral';
          let swingSignalBadge = 'bg-slate-100 text-slate-700 border-slate-200';
          let stockItem: ScreenerStock;

          if (dailyQuotes.length >= 20) {
            // RSI 14
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

            // MA5, MA10, MA20
            const last5 = dailyQuotes.slice(-5);
            const last10 = dailyQuotes.slice(-10);
            const last20 = dailyQuotes.slice(-20);

            const ma5 = last5.length >= 5 ? last5.reduce((acc: number, q: any) => acc + q.close, 0) / 5 : null;
            const ma10 = last10.length >= 10 ? last10.reduce((acc: number, q: any) => acc + q.close, 0) / 10 : null;
            const ma20 = last20.length >= 20 ? last20.reduce((acc: number, q: any) => acc + q.close, 0) / 20 : null;

            // Status Alignment MA & Golden Cross (MA5 vs MA10)
            const isBullishAlignment = !!(ma5 && ma10 && ma20 && price >= ma5 && ma5 >= ma10 && ma10 >= ma20);
            const isGoldenCross = !!(ma5 && ma10 && ma5 >= ma10 && (dailyQuotes.length >= 6 ? dailyQuotes.slice(-6, -1).reduce((acc: number, q: any) => acc + q.close, 0) / 5 < (dailyQuotes.length >= 11 ? dailyQuotes.slice(-11, -1).reduce((acc: number, q: any) => acc + q.close, 0) / 10 : 0) : false));

            // Volume Spike
            const avgVol = last20.reduce((acc: number, q: any) => acc + (q.volume || 0), 0) / 20;
            const todayVol = dailyQuotes[dailyQuotes.length - 1].volume || 0;
            volSpike = avgVol > 0 ? Math.round((todayVol / avgVol) * 10) / 10 : 1;

            // Resistance 20D
            const resistance = Math.max(...last20.map((q: any) => q.high || q.close));
            swingPotential = resistance > price ? Math.round(((resistance - price) / price) * 1000) / 10 : 5.0;

            if (price > (ma20 || 0)) {
              trend = 'uptrend';
            } else if (price < (ma20 || 0)) {
              trend = 'downtrend';
            }

            // Evaluasi SEMUA sinyal aktif secara independen (Multi-tagging)
            const activeTags: { label: string; badge: string; tooltip: string }[] = [];

            // 1. Tag Oversold
            if (rsi <= 35) {
              activeTags.push({
                label: '🟢 Oversold',
                badge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
                tooltip: `RSI ${rsi} (Jenuh Jual, potensi pantulan teknikal dekat)`,
              });
            } else if (rsi >= 70) {
              activeTags.push({
                label: '⚠️ Overbought',
                badge: 'bg-rose-50 text-rose-800 border-rose-300',
                tooltip: `RSI ${rsi} (Jenuh Beli, rawan profit taking)`,
              });
            }

            // 2. Tag Volume Breakout
            if (volSpike >= 1.5) {
              activeTags.push({
                label: '🚀 Volume Breakout',
                badge: 'bg-indigo-50 text-indigo-800 border-indigo-300 font-bold',
                tooltip: `Volume spike ${volSpike}x rata-rata 20 hari (Akumulasi dana besar)`,
              });
            }

            // 3. Tag Momentum Uptrend
            if (isBullishAlignment) {
              activeTags.push({
                label: '🔥 Bullish MA (5>10>20)',
                badge: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
                tooltip: 'Harga di atas MA5 > MA10 > MA20 (Susunan tren naik sempurna)',
              });
            } else if (isGoldenCross) {
              activeTags.push({
                label: '⚡ Golden Cross',
                badge: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold',
                tooltip: 'MA5 memotong ke atas MA10 (Akselerasi tren baru)',
              });
            } else if (trend === 'uptrend' && rsi >= 45 && rsi <= 68) {
              activeTags.push({
                label: '📈 Momentum Uptrend',
                badge: 'bg-blue-50 text-blue-800 border-blue-300',
                tooltip: 'Harga bertahan di atas MA20 dengan momentum stabil',
              });
            }

            // Sinyal Utama (Highlight Badge terkuat)
            if (activeTags.length > 0) {
              swingSignal = activeTags[0].label;
              swingSignalBadge = activeTags[0].badge;
            } else {
              swingSignal = 'Neutral';
              swingSignalBadge = 'bg-slate-100 text-slate-700 border-slate-200';
            }

            stockItem = {
              ticker: quote.symbol.replace('.JK', ''),
              name: quote.shortName || quote.longName || quote.symbol.replace('.JK', ''),
              price,
              changePercent: quote.regularMarketChangePercent ? Math.round(quote.regularMarketChangePercent * 10) / 10 : 0,
              marketCap,
              marketCapFormatted,
              per: trailingPE ? Math.round(trailingPE * 10) / 10 : null,
              pbv: currentPBV ? Math.round(currentPBV * 100) / 100 : null,
              dividendYield: divYield ? Math.round(divYield * 10) / 10 : null,
              marginOfSafety: Math.round(mos * 10) / 10,
              status: mos >= 15 ? 'undervalued' : mos <= -15 ? 'expensive' : 'fair',
              rsi,
              ma5: ma5 ? Math.round(ma5) : null,
              ma10: ma10 ? Math.round(ma10) : null,
              ma20: ma20 ? Math.round(ma20) : null,
              isBullishAlignment,
              isGoldenCross,
              volSpike,
              trend,
              swingPotential,
              swingSignal,
              swingSignalBadge,
              signalTags: activeTags,
            };
          } else {
            stockItem = {
              ticker: quote.symbol.replace('.JK', ''),
              name: quote.shortName || quote.longName || quote.symbol.replace('.JK', ''),
              price,
              changePercent: quote.regularMarketChangePercent ? Math.round(quote.regularMarketChangePercent * 10) / 10 : 0,
              marketCap,
              marketCapFormatted,
              per: trailingPE ? Math.round(trailingPE * 10) / 10 : null,
              pbv: currentPBV ? Math.round(currentPBV * 100) / 100 : null,
              dividendYield: divYield ? Math.round(divYield * 10) / 10 : null,
              marginOfSafety: Math.round(mos * 10) / 10,
              status: mos >= 15 ? 'undervalued' : mos <= -15 ? 'expensive' : 'fair',
            };
          }

          return stockItem;
        } catch {
          return null;
        }
      })
    );

    const stocks: ScreenerStock[] = stockResults.filter(
      (s): s is ScreenerStock => s !== null
    );

    if (mode === 'swing') {
      // Urutkan ranking untuk SWING TRADE:
      // Prioritaskan saham yang bisa cepat untung:
      // Skor swing = (oversold bonus) + (volume breakout bonus) + (potensi kenaikan resistance) + (rebound momentum) + (MA 5/10/20 Bullish Alignment)
      stocks.sort((a, b) => {
        const getSwingScore = (s: ScreenerStock) => {
          let score = (s.swingPotential || 0) * 1.5;
          // MA Alignment Bonus (Super Bullish Setup)
          if (s.isBullishAlignment) score += 35; // Susunan tangga naik sempurna P > MA5 > MA10 > MA20
          else if (s.isGoldenCross) score += 20; // MA5 di atas MA10
          else if (s.ma5 && s.price >= s.ma5) score += 10; // Menjaga support mingguan MA5

          if (s.rsi && s.rsi <= 35) score += 30; // Sangat murah teknikal, pantulan dekat
          else if (s.rsi && s.rsi <= 45) score += 15;
          if (s.volSpike && s.volSpike >= 1.5) score += 25; // Ledakan volume
          if (s.changePercent && s.changePercent > 0) score += s.changePercent * 3; // Sedang bergerak naik
          return score;
        };
        return getSwingScore(b) - getSwingScore(a);
      });
    } else {
      // Mode Invest: Urutkan dari yang paling undervalued (Margin of Safety tertinggi) ke bawah
      stocks.sort((a, b) => b.marginOfSafety - a.marginOfSafety);
    }

    const minCapDisplay = MIN_MARKET_CAP >= 1_000_000_000_000
      ? `Rp ${(MIN_MARKET_CAP / 1_000_000_000_000).toLocaleString('id-ID')} Triliun`
      : `Rp ${(MIN_MARKET_CAP / 1_000_000_000).toLocaleString('id-ID')} Miliar`;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      minMarketCap: minCapDisplay,
      minMarketCapRaw: MIN_MARKET_CAP,
      count: stocks.length,
      stocks,
    });
  } catch (error: any) {
    console.error('Error fetching screener data:', error?.message || error);
    return NextResponse.json(
      { error: 'Gagal memuat ranking saham undervalued.' },
      { status: 500 }
    );
  }
}
