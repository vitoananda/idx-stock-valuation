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
          .map((d: any) => ({
            date: new Date(d.date).toISOString().split('T')[0],
            amount: Math.round(d.amount * 100) / 100,
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10); // Ambil 10 pembagian dividen terakhir
      }
    } catch (e) {
      console.warn(`Chart data query error for ${ticker}`);
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
    // Yahoo kadang mengembalikan trailingAnnualDividendYield dalam bentuk desimal (0.074) atau persen
    let divYieldPercent: number | null = null;
    const rawYield = quote.trailingAnnualDividendYield ?? quote.dividendYield;
    if (rawYield !== null && rawYield !== undefined && rawYield > 0) {
      divYieldPercent = rawYield < 1 ? rawYield * 100 : rawYield;
    } else if (quote.trailingAnnualDividendRate && currentPrice > 0) {
      divYieldPercent = (quote.trailingAnnualDividendRate / currentPrice) * 100;
    }

    const dividendRate = quote.trailingAnnualDividendRate || (dividendHistory.length > 0 ? dividendHistory[0].amount : null);

    const cleanTicker = ticker.replace('.JK', '');

    return NextResponse.json({
      ticker: cleanTicker,
      fullTicker: ticker,
      name: quote.longName || quote.shortName || cleanTicker,
      price: currentPrice,
      changePercent: quote.regularMarketChangePercent || 0,
      currency: quote.currency || 'IDR',
      financialCurrency,
      eps: eps ? Math.round(eps * 100) / 100 : null,
      bvps: bookValue ? Math.round(bookValue * 100) / 100 : null,
      dividend: {
        yieldPercent: divYieldPercent ? Math.round(divYieldPercent * 100) / 100 : null,
        annualRate: dividendRate ? Math.round(dividendRate) : null,
        history: dividendHistory,
      },
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
