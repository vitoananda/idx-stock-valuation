import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

function calculateStats(values: number[]) {
  const valid = values.filter((v) => v !== null && !isNaN(v) && v > 0);
  if (valid.length === 0) return { mean: 0, std: 0 };
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / valid.length;
  return { mean, std: Math.sqrt(variance) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  let ticker = rawTicker.trim().toUpperCase();
  if (!ticker.endsWith('.JK')) {
    ticker += '.JK';
  }

  try {
    const quote = await yahooFinance.quote(ticker);
    if (!quote || (!quote.regularMarketPrice && !quote.currentPrice)) {
      return NextResponse.json(
        { error: `Saham ${ticker} tidak ditemukan di Bursa Efek Indonesia (IDX).` },
        { status: 404 }
      );
    }

    const currentPrice = quote.regularMarketPrice || quote.currentPrice || 0;
    const financialCurrency = quote.financialCurrency || 'IDR';

    // Periksa apakah laporan keuangan emiten menggunakan USD (seperti PTRO, ADRO, MEDC, ITMG)
    let usdRate = 1;
    if (financialCurrency === 'USD') {
      try {
        const usdQuote = await yahooFinance.quote('USDIDR=X');
        usdRate = usdQuote.regularMarketPrice || usdQuote.currentPrice || 16000;
      } catch (e) {
        usdRate = 16000;
      }
    }

    let trailingPE = quote.trailingPE || null;
    let priceToBook = quote.priceToBook || null;
    let eps = quote.epsTrailingTwelveMonths || null;
    let bookValue = quote.bookValue || null;

    // Normalisasi jika emiten mencatatkan BV/EPS dalam USD tapi harga saham dalam IDR
    if (financialCurrency === 'USD') {
      if (bookValue && bookValue < 10) {
        const bvpsIdr = bookValue * usdRate;
        priceToBook = currentPrice / bvpsIdr;
        bookValue = bvpsIdr;
      }
      if (eps && eps < 5 && trailingPE && trailingPE > 1000) {
        const epsIdr = eps * usdRate;
        trailingPE = currentPrice / epsIdr;
        eps = epsIdr;
      }
    }

    if (priceToBook && priceToBook > 1000 && bookValue) {
      const adjustedBV = bookValue * 16000;
      priceToBook = currentPrice / adjustedBV;
      bookValue = adjustedBV;
    }

    if (!eps && trailingPE && currentPrice) {
      eps = currentPrice / trailingPE;
    }
    if (!bookValue && priceToBook && currentPrice) {
      bookValue = currentPrice / priceToBook;
    }

    // Ambil histori harga 5 tahun & dividen
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 5);

    let historical: any[] = [];
    let dividendHistory: { date: string; amount: number }[] = [];

    try {
      const chartData = await yahooFinance.chart(ticker, {
        period1: startDate.toISOString().split('T')[0],
        period2: endDate.toISOString().split('T')[0],
        interval: '1mo',
        events: 'div',
      });

      if (chartData && chartData.quotes) {
        historical = chartData.quotes;
      }

      if (chartData && chartData.events && chartData.events.dividends) {
        dividendHistory = chartData.events.dividends
          .map((d: any) => {
            const exDateTime = new Date(d.date).getTime();
            // Cari harga penutupan sebelum hari ex-date (Cum-Date)
            const priorQuotes = (historical || []).filter(
              (q: any) => q.close && new Date(q.date).getTime() < exDateTime
            );
            const cumQuote = priorQuotes.length > 0 ? priorQuotes[priorQuotes.length - 1] : null;
            const cumPrice = cumQuote && cumQuote.close ? Math.round(cumQuote.close) : null;
            const yieldOnCum = cumPrice && cumPrice > 0 ? Math.round(((d.amount / cumPrice) * 100) * 10) / 10 : null;

            return {
              date: new Date(d.date).toISOString().split('T')[0],
              amount: Math.round(d.amount * 100) / 100,
              cumDate: cumQuote ? new Date(cumQuote.date).toISOString().split('T')[0] : null,
              cumPrice, // Harga penutupan Cum-Date per lembar (Rp)
              yieldOnCum, // Yield saat Cum-Date (%)
            };
          })
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10); // Ambil 10 pembagian dividen terakhir
      }
    } catch (e) {
      console.warn(`Chart data query error for ${ticker}`);
    }

    // Ambil data teknikal harian 120 hari terakhir untuk Swing Trading (RSI, MA20, MA50, Vol Spike, Support, Resistance)
    let technicals: any = null;
    try {
      const dailyStart = new Date();
      dailyStart.setDate(endDate.getDate() - 130);
      const dailyData = await yahooFinance.chart(ticker, {
        period1: dailyStart.toISOString().split('T')[0],
        period2: endDate.toISOString().split('T')[0],
        interval: '1d',
      }).catch(() => null);

      if (dailyData && dailyData.quotes && dailyData.quotes.length >= 15) {
        const validQuotes = dailyData.quotes.filter((q: any) => q.close !== null && q.close !== undefined && q.close > 0);
        const closes = validQuotes.map((q: any) => q.close);

        // MA5, MA10, MA20, MA50
        const ma5 = closes.length >= 5 ? closes.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5 : null;
        const ma10 = closes.length >= 10 ? closes.slice(-10).reduce((a: number, b: number) => a + b, 0) / 10 : null;
        const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20 : null;
        const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50 : null;

        // Status Alignment MA
        const isBullishAlignment = ma5 && ma10 && ma20 && currentPrice >= ma5 && ma5 >= ma10 && ma10 >= ma20;
        const isGoldenCross = ma5 && ma10 && ma5 >= ma10 && (closes.length >= 6 ? closes.slice(-6, -1).reduce((a: number, b: number) => a + b, 0) / 5 < (closes.length >= 11 ? closes.slice(-11, -1).reduce((a: number, b: number) => a + b, 0) / 10 : 0) : false);

        // RSI 14
        let gains = 0;
        let losses = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
          const diff = closes[i] - closes[i - 1];
          if (diff >= 0) gains += diff;
          else losses += Math.abs(diff);
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        let rsi = 50;
        if (avgLoss === 0) rsi = 100;
        else {
          const rs = avgGain / avgLoss;
          rsi = 100 - (100 / (1 + rs));
        }

        // Volume Spike (Hari ini vs Avg 20 Hari)
        const volumes = validQuotes.map((q: any) => q.volume || 0);
        const todayVol = volumes[volumes.length - 1] || 0;
        const recentVols = volumes.slice(-20);
        const avgVol20 = recentVols.length > 0 ? recentVols.reduce((a: number, b: number) => a + b, 0) / recentVols.length : 0;
        const volSpike = avgVol20 > 0 ? todayVol / avgVol20 : 1;

        // Resistance 20 Hari (Tertinggi) & Support 20 Hari (Terendah)
        const last20Highs = validQuotes.slice(-20).map((q: any) => q.high || q.close);
        const last20Lows = validQuotes.slice(-20).map((q: any) => q.low || q.close);
        const resistance = Math.max(...last20Highs);
        const support = Math.min(...last20Lows);

        // Harga Ideal Beli & Stop Loss (sinkron dengan Watchlist Harian):
        let idealBuyPrice: number;
        if (ma20 && currentPrice > ma20) {
          idealBuyPrice = Math.round(Math.max(support, ma20 * 0.99));
        } else {
          idealBuyPrice = Math.round(support + (currentPrice - support) * 0.25);
        }

        const slCandidate = Math.min(Math.round(idealBuyPrice * 0.96), Math.round(support * 0.98));
        const stopLoss = slCandidate < idealBuyPrice ? slCandidate : Math.round(idealBuyPrice * 0.95);
        const riskPercent = Math.round(Math.abs((idealBuyPrice - stopLoss) / idealBuyPrice) * 1000) / 10;

        // Status Tren & Signal
        let trend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
        if (ma20 && currentPrice > ma20) {
          trend = 'uptrend';
        } else if (ma20 && currentPrice < ma20) {
          trend = 'downtrend';
        }

        // Evaluasi SEMUA sinyal aktif (Multi-tagging)
        const activeTags: { label: string; badge: string; tooltip: string }[] = [];

        if (rsi <= 35) {
          activeTags.push({
            label: '🟢 Oversold (Jenuh Jual)',
            badge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
            tooltip: `RSI ${Math.round(rsi * 10) / 10} di zona jenuh jual. Potensi pantulan rebound teknikal.`,
          });
        } else if (rsi >= 70) {
          activeTags.push({
            label: '⚠️ Overbought (Jenuh Beli)',
            badge: 'bg-rose-50 text-rose-800 border-rose-300',
            tooltip: `RSI ${Math.round(rsi * 10) / 10} terlalu panas. Rawan aksi ambil untung (profit taking).`,
          });
        }

        if (volSpike >= 1.5) {
          activeTags.push({
            label: '🚀 Volume Breakout',
            badge: 'bg-indigo-50 text-indigo-800 border-indigo-300 font-bold',
            tooltip: `Volume spike ${Math.round(volSpike * 10) / 10}x rata-rata 20 hari. Terjadi akumulasi transaksi besar.`,
          });
        }

        if (isBullishAlignment) {
          activeTags.push({
            label: '🔥 Bullish MA (5 > 10 > 20)',
            badge: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
            tooltip: 'Harga di atas MA5 > MA10 > MA20. Formasi tren naik sempurna.',
          });
        } else if (isGoldenCross) {
          activeTags.push({
            label: '⚡ Golden Cross (MA5 > MA10)',
            badge: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold',
            tooltip: 'MA5 memotong ke atas MA10. Awal akselerasi momentum tren baru.',
          });
        } else if (trend === 'uptrend' && rsi >= 45 && rsi <= 68) {
          activeTags.push({
            label: '📈 Momentum Uptrend',
            badge: 'bg-blue-50 text-blue-800 border-blue-300',
            tooltip: 'Harga bertahan kokoh di atas garis MA20.',
          });
        }

        let signal = activeTags.length > 0 ? activeTags[0].label : 'Neutral';
        let signalBadge = activeTags.length > 0 ? activeTags[0].badge : 'bg-slate-100 text-slate-700';

        technicals = {
          rsi: Math.round(rsi * 10) / 10,
          ma5: ma5 ? Math.round(ma5) : null,
          ma10: ma10 ? Math.round(ma10) : null,
          ma20: ma20 ? Math.round(ma20) : null,
          ma50: ma50 ? Math.round(ma50) : null,
          isBullishAlignment: !!isBullishAlignment,
          isGoldenCross: !!isGoldenCross,
          volSpike: Math.round(volSpike * 10) / 10,
          resistance: Math.round(resistance),
          support: Math.round(support),
          idealBuyPrice,
          stopLoss,
          riskPercent,
          trend,
          signal,
          signalBadge,
          activeTags,
        };
      }
    } catch (e) {
      console.warn(`Technical data query error for ${ticker}`);
    }

    // Ambil data kesehatan finansial, profitabilitas, serta profil sektor perusahaan
    let financialHealth = {
      roe: null as number | null,
      der: null as number | null,
      profitMargin: null as number | null,
      revenueGrowth: null as number | null,
      earningsGrowth: null as number | null,
      isBank: false,
    };

    let companyProfile = {
      sector: null as string | null,
      industry: null as string | null,
      website: null as string | null,
    };

    try {
      const summary = await yahooFinance.quoteSummary(ticker, {
        modules: ['financialData', 'defaultKeyStatistics', 'assetProfile'],
      }).catch(() => null);

      if (summary) {
        if (summary.assetProfile) {
          companyProfile = {
            sector: summary.assetProfile.sectorDisp || summary.assetProfile.sector || null,
            industry: summary.assetProfile.industryDisp || summary.assetProfile.industry || null,
            website: summary.assetProfile.website || null,
          };
        }

        if (summary.financialData) {
          const fd = summary.financialData;
          const roe = fd.returnOnEquity !== undefined && fd.returnOnEquity !== null ? Math.round(fd.returnOnEquity * 1000) / 10 : null; // in %
          const der = fd.debtToEquity !== undefined && fd.debtToEquity !== null ? Math.round((fd.debtToEquity / 100) * 100) / 100 : null; // Yahoo delivers debtToEquity in percent (e.g. 41.12 = 0.41x)
          const profitMargin = fd.profitMargins !== undefined && fd.profitMargins !== null ? Math.round(fd.profitMargins * 1000) / 10 : null; // in %
          const revenueGrowth = fd.revenueGrowth !== undefined && fd.revenueGrowth !== null ? Math.round(fd.revenueGrowth * 1000) / 10 : null; // in %
          const earningsGrowth = fd.earningsGrowth !== undefined && fd.earningsGrowth !== null ? Math.round(fd.earningsGrowth * 1000) / 10 : null; // in %

          // Sektor perbankan biasanya tidak memiliki DER standar karena simpanan nasabah dihitung liabilitas
          const sectorStr = (companyProfile.sector || quote.sector || '').toLowerCase();
          const industryStr = (companyProfile.industry || quote.industry || '').toLowerCase();
          const isBank = sectorStr.includes('financial') || industryStr.includes('bank');

          financialHealth = {
            roe,
            der,
            profitMargin,
            revenueGrowth,
            earningsGrowth,
            isBank,
          };
        }
      }
    } catch (e) {
      console.warn(`Financial health query error for ${ticker}`);
    }

    const histPEs: number[] = [];
    const histPBVs: number[] = [];

    if (historical && historical.length > 0) {
      historical.forEach((h) => {
        if (h.close && eps && eps > 0) histPEs.push(h.close / eps);
        if (h.close && bookValue && bookValue > 0) histPBVs.push(h.close / bookValue);
      });
    }

    const peStats = calculateStats(histPEs);
    const pbvStats = calculateStats(histPBVs);

    const perMean = peStats.mean > 0 ? peStats.mean : trailingPE ? trailingPE * 1.15 : 15;
    const perStd = peStats.std > 0 ? peStats.std : perMean * 0.25;

    const pbvMean = pbvStats.mean > 0 ? pbvStats.mean : priceToBook ? priceToBook * 1.1 : 2.0;
    const pbvStd = pbvStats.std > 0 ? pbvStats.std : pbvMean * 0.25;

    // Dividend Yield & Rate
    // Yahoo kadang mengembalikan trailingAnnualDividendYield dalam bentuk desimal (0.074) atau persen, atau bahkan null untuk IDX
    let divYieldPercent: number | null = null;
    const rawYield = quote.trailingAnnualDividendYield ?? quote.dividendYield;
    if (rawYield !== null && rawYield !== undefined && rawYield > 0) {
      divYieldPercent = rawYield < 1 ? rawYield * 100 : rawYield;
    } else if (quote.trailingAnnualDividendRate && currentPrice > 0) {
      divYieldPercent = (quote.trailingAnnualDividendRate / currentPrice) * 100;
    } else if (dividendHistory && dividendHistory.length > 0 && currentPrice > 0) {
      // Fallback: hitung yield dari dividen riil per lembar terakhir dibagi harga terkini
      const latestAnnualDiv = dividendHistory[0].amount;
      if (latestAnnualDiv > 0) {
        divYieldPercent = (latestAnnualDiv / currentPrice) * 100;
      }
    }

    const dividendRate = quote.trailingAnnualDividendRate || (dividendHistory.length > 0 ? dividendHistory[0].amount : null);

    const cleanTicker = ticker.replace('.JK', '');
    const logoUrl = `https://assets.stockbit.com/logos/companies/${cleanTicker}.png`;

    return NextResponse.json({
      ticker: cleanTicker,
      fullTicker: ticker,
      name: quote.longName || quote.shortName || cleanTicker,
      sector: companyProfile.sector,
      industry: companyProfile.industry,
      website: companyProfile.website,
      logoUrl,
      price: currentPrice,
      changePercent: quote.regularMarketChangePercent || 0,
      currency: quote.currency || 'IDR',
      financialCurrency,
      marketCap: quote.marketCap || null,
      marketCapFormatted: quote.marketCap ? `Rp ${(quote.marketCap / 1_000_000_000_000).toFixed(1)} T` : '-',
      eps: eps ? Math.round(eps * 100) / 100 : null,
      bvps: bookValue ? Math.round(bookValue * 100) / 100 : null,
      dividend: {
        yieldPercent: divYieldPercent ? Math.round(divYieldPercent * 100) / 100 : null,
        annualRate: dividendRate ? Math.round(dividendRate) : null,
        history: dividendHistory,
      },
      health: financialHealth,
      technicals,
      per: {
        current: trailingPE ? Math.round(trailingPE * 10) / 10 : null,
        minus1SD: Math.max(0.1, Math.round((perMean - perStd) * 10) / 10),
        mean: Math.round(perMean * 10) / 10,
        plus1SD: Math.round((perMean + perStd) * 10) / 10,
        fairPrice: eps && eps > 0 ? Math.round(eps * perMean) : null,
      },
      pbv: {
        current: priceToBook ? Math.round(priceToBook * 100) / 100 : null,
        minus1SD: Math.max(0.1, Math.round((pbvMean - pbvStd) * 100) / 100),
        mean: Math.round(pbvMean * 100) / 100,
        plus1SD: Math.round((pbvMean + pbvStd) * 100) / 100,
        fairPrice: bookValue && bookValue > 0 ? Math.round(bookValue * pbvMean) : null,
      },
    });
  } catch (error: any) {
    console.error(`Error querying ${ticker}:`, error?.message || error);
    return NextResponse.json(
      { error: `Gagal memuat data untuk ${ticker}. Pastikan kode saham benar.` },
      { status: 500 }
    );
  }
}
