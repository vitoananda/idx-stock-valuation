import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

// Daftar saham liquid & teruji di IDX mencakup berbagai fraksi harga (Small-Mid-Big Cap)
const TOP_IDX_TICKERS = [
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
  'ACES.JK',
  'JSMR.JK',
  'MYOR.JK',
  'CPIN.JK',
  'MAPI.JK',
  'SMGR.JK',
  // Saham tier 100 - 1.000 & < 100 populer
  'GOTO.JK',
  'BUKA.JK',
  'BRIS.JK',
  'MEDC.JK',
  'ANTM.JK',
  'INCO.JK',
  'TINS.JK',
  'AKRA.JK',
  'ERAA.JK',
  'JPFA.JK',
  'BSDE.JK',
  'PWON.JK',
  'CTRA.JK',
  'SMRA.JK',
  'WIFI.JK',
  'BUMI.JK',
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
  volSpike?: number | null;
  trend?: 'uptrend' | 'downtrend' | 'sideways';
  swingPotential?: number; // Potensi kenaikan jangka pendek ke resistance (%)
  swingSignal?: string;
  swingSignalBadge?: string;
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

    // Ambil data quote dan chart historis secara paralel untuk semua emiten
    const stockResults = await Promise.all(
      TOP_IDX_TICKERS.map(async (ticker) => {
        try {
          const past90d = new Date();
          past90d.setDate(now.getDate() - 90);

          const [quote, chartMonthly, chartDaily] = await Promise.all([
            yahooFinance.quote(ticker),
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

            // MA20
            const last20 = dailyQuotes.slice(-20);
            const ma20 = last20.reduce((acc: number, q: any) => acc + q.close, 0) / 20;

            // Volume Spike
            const avgVol = last20.reduce((acc: number, q: any) => acc + (q.volume || 0), 0) / 20;
            const todayVol = dailyQuotes[dailyQuotes.length - 1].volume || 0;
            volSpike = avgVol > 0 ? Math.round((todayVol / avgVol) * 10) / 10 : 1;

            // Resistance 20D
            const resistance = Math.max(...last20.map((q: any) => q.high || q.close));
            swingPotential = resistance > price ? Math.round(((resistance - price) / price) * 1000) / 10 : 5.0;

            if (price > ma20) {
              trend = 'uptrend';
            } else if (price < ma20) {
              trend = 'downtrend';
            }

            // Sinyal Swing Cepat
            if (rsi <= 35) {
              swingSignal = '🟢 Oversold Rebound';
              swingSignalBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
            } else if (volSpike >= 1.5 && price >= ma20) {
              swingSignal = '🚀 Volume Breakout';
              swingSignalBadge = 'bg-indigo-100 text-indigo-800 border-indigo-300';
            } else if (trend === 'uptrend' && rsi >= 45 && rsi <= 65) {
              swingSignal = '📈 Momentum Run';
              swingSignalBadge = 'bg-blue-100 text-blue-800 border-blue-300';
            } else if (rsi >= 70) {
              swingSignal = '⚠️ Overbought';
              swingSignalBadge = 'bg-rose-100 text-rose-800 border-rose-300';
            }
          }

          const stockItem: ScreenerStock = {
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
            volSpike,
            trend,
            swingPotential,
            swingSignal,
            swingSignalBadge,
          };

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
      // Skor swing = (oversold bonus) + (volume breakout bonus) + (potensi kenaikan resistance) + (rebound momentum)
      stocks.sort((a, b) => {
        const getSwingScore = (s: ScreenerStock) => {
          let score = (s.swingPotential || 0) * 1.5;
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
