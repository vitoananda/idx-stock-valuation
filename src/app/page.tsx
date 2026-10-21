'use client';

import React, { useState, useEffect } from 'react';
import { Search, Info, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle, Coins, Calendar } from 'lucide-react';

interface MetricBand {
  current: number | null;
  minus1SD: number;
  mean: number;
  plus1SD: number;
  fairPrice: number | null;
}

interface DividendPayment {
  date: string;
  amount: number;
}

interface DividendData {
  yieldPercent: number | null;
  annualRate: number | null;
  history: DividendPayment[];
}

interface StockData {
  ticker: string;
  fullTicker: string;
  name: string;
  price: number;
  changePercent: number;
  eps: number | null;
  bvps: number | null;
  dividend: DividendData;
  per: MetricBand;
  pbv: MetricBand;
}

export default function Home() {
  const [tickerInput, setTickerInput] = useState('BBRI');
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStock = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/stock/${query.trim().toUpperCase()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat data saham');
      }

      setStock(data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
      setStock(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock('BBRI');
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStock(tickerInput);
  };

  const formatRupiah = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Evaluasi Status Valuasi Berdasarkan Harga Sekarang vs Harga Wajar
  const getValuationEvaluation = () => {
    if (!stock) return null;

    let fairPrice: number | null = null;
    if (stock.per.fairPrice && stock.pbv.fairPrice) {
      fairPrice = (stock.per.fairPrice + stock.pbv.fairPrice) / 2;
    } else {
      fairPrice = stock.per.fairPrice || stock.pbv.fairPrice;
    }

    const marginOfSafety =
      fairPrice && fairPrice > 0
        ? ((fairPrice - stock.price) / fairPrice) * 100
        : null;

    if (marginOfSafety !== null && marginOfSafety < -15) {
      return {
        level: 'expensive',
        title: 'Cenderung Mahal (Di Atas Harga Wajar)',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        cardBorder: 'border-rose-200 bg-rose-50/20',
        fairPrice,
        marginOfSafety,
        explanation: `Harga pasar saat ini (${formatRupiah(stock.price)}) sudah ${Math.abs(marginOfSafety).toFixed(1)}% LEBIH TINGGI daripada estimasi harga wajar historisnya (${formatRupiah(fairPrice)}). Valuasi tergolong mahal / priced-in.`,
        actionHint: '⚠️ Kurang ideal untuk entry baru bagi investor nilai. Jika sudah punya, pertimbangkan cicil profit (take profit).'
      };
    } else if (marginOfSafety !== null && marginOfSafety > 15) {
      return {
        level: 'cheap',
        title: 'Undervalued (Diskon / Murah)',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        cardBorder: 'border-emerald-200 bg-emerald-50/20',
        fairPrice,
        marginOfSafety,
        explanation: `Harga pasar saat ini (${formatRupiah(stock.price)}) berada di DISKON ${marginOfSafety.toFixed(1)}% di bawah harga wajarnya (${formatRupiah(fairPrice)}). Memiliki bantalan risiko (Margin of Safety) yang bagus.`,
        actionHint: '✅ Area beli yang menarik untuk investasi jangka menengah-panjang secara bertahap.'
      };
    } else {
      const isSlightlyAbove = marginOfSafety !== null && marginOfSafety < 0;
      return {
        level: 'fair',
        title: isSlightlyAbove ? 'Harga Wajar (Sedikit Premium)' : 'Harga Wajar (Fair Value)',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        cardBorder: 'border-amber-200 bg-amber-50/20',
        fairPrice,
        marginOfSafety,
        explanation: `Harga saat ini (${formatRupiah(stock.price)}) berada dekat dengan estimasi harga rata-rata historisnya (${formatRupiah(fairPrice)}). Tidak sedang diskon besar, tapi juga belum bubble.`,
        actionHint: 'ℹ️ Layak dipantau atau cicil kecil (DCA) jika fundamental perusahaan masih bertumbuh stabil.'
      };
    }
  };

  const evalResult = getValuationEvaluation();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6">

        {/* Top Header */}
        <header className="border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                IDX / BEI LIVE
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Valuasi Saham & Analisis Dividen
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Apakah Harga Saham Ini Murah atau Mahal?
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Menilai kewajaran harga saham berdasarkan perbandingan laba (PER), aset (PBV), dan imbal hasil dividen.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mt-5 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-2.5 text-xs font-mono font-bold text-slate-400">
                KODE:
              </span>
              <input
                type="text"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                placeholder="Ketik kode saham (contoh: BBRI, PTBA, ITMG, ADRO, BBNI, BMRI, ASII)..."
                className="w-full bg-white text-slate-900 text-sm font-semibold uppercase rounded-lg pl-16 pr-4 py-2 border border-slate-300 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{loading ? 'Memeriksa...' : 'Cek Nilai'}</span>
            </button>
          </form>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs">
            <span className="text-slate-400 mr-1">Saham dividen & populer:</span>
            {['BBRI', 'BBNI', 'BMRI', 'BBCA', 'PTBA', 'ITMG', 'ADRO', 'ASII', 'TLKM', 'PTRO'].map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTickerInput(t);
                    fetchStock(t);
                  }}
                  className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:border-slate-400 font-mono text-xs font-medium cursor-pointer"
                >
                  {t}
                </button>
              )
            )}
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stock Data Display */}
        {stock && evalResult && (
          <div className="space-y-6">

            {/* Verdict Hero Card */}
            <div
              className={`p-6 rounded-xl border bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 ${evalResult.cardBorder}`}
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded border border-slate-200">
                    {stock.fullTicker}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">{stock.name}</h2>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {formatRupiah(stock.price)}
                  </span>
                  <span
                    className={`inline-flex items-center text-xs font-semibold ${
                      stock.changePercent >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {stock.changePercent >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    )}
                    {stock.changePercent >= 0 ? '+' : ''}
                    {stock.changePercent.toFixed(2)}% hari ini
                  </span>
                </div>

                {/* Penjelasan Jelas Bahasa Manusia */}
                <div className="pt-2 text-xs text-slate-700 space-y-1 bg-white/70 p-3 rounded-lg border border-slate-200/80">
                  <p className="font-medium text-slate-900">{evalResult.explanation}</p>
                  <p className="text-slate-600">{evalResult.actionHint}</p>
                </div>
              </div>

              {/* Status Badge & Kesimpulan Angka */}
              <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 text-left md:text-right shrink-0 min-w-[210px]">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  KESIMPULAN VALUASI
                </span>
                <span
                  className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold border ${evalResult.badgeClass}`}
                >
                  {evalResult.title}
                </span>

                <div className="mt-3 text-xs space-y-1">
                  <div className="text-slate-500">
                    Estimasi Harga Wajar:{' '}
                    <span className="font-bold text-slate-900 font-mono">
                      {formatRupiah(evalResult.fairPrice)}
                    </span>
                  </div>
                  {evalResult.marginOfSafety !== null && (
                    <div className="text-slate-500">
                      Diskon (Margin of Safety):{' '}
                      <span
                        className={`font-bold font-mono ${
                          evalResult.marginOfSafety >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {evalResult.marginOfSafety >= 0 ? '+' : ''}
                        {evalResult.marginOfSafety.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dividend Highlight Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Informasi & Riwayat Dividen</h3>
                    <p className="text-xs text-slate-500">Imbal hasil dividen tunai yang dibagikan kepada pemegang saham</p>
                  </div>
                </div>

                {stock.dividend.yieldPercent !== null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-500">Estimasi Dividend Yield:</span>
                    <span className="text-lg font-extrabold text-emerald-700 font-mono">
                      {stock.dividend.yieldPercent.toFixed(2)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                    Tidak Ada Riwayat Dividen Rutin
                  </span>
                )}
              </div>

              {/* Dividend Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-500 block">Nominal Dividen Terakhir / Setahun:</span>
                  <div className="text-base font-bold text-slate-900 font-mono">
                    {stock.dividend.annualRate ? `Rp ${stock.dividend.annualRate.toLocaleString('id-ID')} / lembar` : '-'}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {stock.dividend.annualRate ? `Setara Rp ${(stock.dividend.annualRate * 100).toLocaleString('id-ID')} per 1 lot (100 lembar)` : 'Belum membagikan dividen tahun ini'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-500 block">Evaluasi Yield:</span>
                  <div className="text-sm font-semibold text-slate-800">
                    {!stock.dividend.yieldPercent || stock.dividend.yieldPercent === 0
                      ? 'Saham Non-Dividen (Fokus Capital Gain)'
                      : stock.dividend.yieldPercent >= 6
                      ? '🔥 Sangat Menarik (Di atas bunga deposito & obligasi)'
                      : stock.dividend.yieldPercent >= 3
                      ? '✅ Wajar / Standar Blue Chip'
                      : 'ℹ️ Rendah (Perusahaan menahan laba untuk ekspansi)'}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Yield = (Total Dividen per Lembar ÷ Harga Saham Hari Ini) × 100%
                  </span>
                </div>
              </div>

              {/* Historical Dividend Table */}
              {stock.dividend.history && stock.dividend.history.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Riwayat Pembagian Dividen Terakhir:
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                          <th className="py-2 px-3">Tanggal Ex-Date</th>
                          <th className="py-2 px-3 text-right">Dividen per Lembar</th>
                          <th className="py-2 px-3 text-right">Per 1 Lot (100 Lembar)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {stock.dividend.history.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 font-medium text-slate-900">{formatDate(item.date)}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                              Rp {item.amount.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              Rp {(item.amount * 100).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Side-by-side PER & PBV Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* PER Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      1. PER (Kelipatan Laba)
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-slate-900">
                        {stock.per.current ? `${stock.per.current.toFixed(1)}x` : 'N/A (Rugi)'}
                      </span>
                      <span className="text-xs text-slate-400">PER saat ini</span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                      !stock.per.current || stock.per.current <= 0
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : stock.per.current < stock.per.minus1SD
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : stock.per.current > stock.per.mean
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {!stock.per.current || stock.per.current <= 0
                      ? 'Rugi'
                      : stock.per.current < stock.per.minus1SD
                      ? 'Diskon Murah'
                      : stock.per.current > stock.per.mean
                      ? 'Di Atas Rata-rata'
                      : 'Wajar'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Artinya: Butuh <strong>{stock.per.current ? stock.per.current.toFixed(0) : '-'} tahun</strong> agar modal Anda tertutup dari laba bersih perusahaan saat ini. Rata-rata historisnya adalah <strong>{stock.per.mean.toFixed(1)}x</strong>.
                </p>

                {/* 5-Yr Bands breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 text-[11px] block">Zona Diskon (-1σ)</span>
                    <span className="font-mono font-bold text-slate-700">
                      {stock.per.minus1SD.toFixed(1)}x
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 text-[11px] block">Rata-rata Normal</span>
                    <span className="font-mono font-bold text-slate-700">
                      {stock.per.mean.toFixed(1)}x
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 text-[11px] block">Zona Mahal (+1σ)</span>
                    <span className="font-mono font-bold text-slate-700">
                      {stock.per.plus1SD.toFixed(1)}x
                    </span>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Harga Wajar Versi PER:</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {formatRupiah(stock.per.fairPrice)}
                    </span>
                  </div>
                  {stock.per.fairPrice && (
                    <div className="flex justify-between text-slate-600">
                      <span>Kondisi Harga Saat Ini:</span>
                      <span
                        className={`font-semibold font-mono ${
                          stock.price <= stock.per.fairPrice
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {stock.price <= stock.per.fairPrice ? 'Diskon ' : 'Lebih Mahal '}
                        {Math.abs(
                          ((stock.price - stock.per.fairPrice) / stock.per.fairPrice) * 100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* PBV Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      2. PBV (Kelipatan Nilai Buku / Aset)
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-slate-900">
                        {stock.pbv.current ? `${stock.pbv.current.toFixed(2)}x` : '-'}
                      </span>
                      <span className="text-xs text-slate-400">PBV saat ini</span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                      !stock.pbv.current || stock.pbv.current <= 0
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : stock.pbv.current < stock.pbv.minus1SD
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : stock.pbv.current > stock.pbv.mean
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {!stock.pbv.current || stock.pbv.current <= 0
                      ? '-'
                      : stock.pbv.current < stock.pbv.minus1SD
                      ? 'Diskon Murah'
                      : stock.pbv.current > stock.pbv.mean
                      ? 'Di Atas Rata-rata'
                      : 'Wajar'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Artinya: Anda membeli saham dengan harga <strong>{stock.pbv.current ? stock.pbv.current.toFixed(2) : '-'} kali lipat</strong> dari modal bersih perusahaan per lembar saham.
                </p>

                {/* 5-Yr Bands breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 text-[11px] block">Zona Diskon (-1σ)</span>
                    <span className="font-mono font-bold text-slate-700">
                      {stock.pbv.minus1SD.toFixed(2)}x
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 text-[11px] block">Rata-rata Normal</span>
                    <span className="font-mono font-bold text-slate-700">
                      {stock.pbv.mean.toFixed(2)}x
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 text-[11px] block">Zona Mahal (+1σ)</span>
                    <span className="font-mono font-bold text-slate-700">
                      {stock.pbv.plus1SD.toFixed(2)}x
                    </span>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Harga Wajar Versi PBV:</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {formatRupiah(stock.pbv.fairPrice)}
                    </span>
                  </div>
                  {stock.pbv.fairPrice && (
                    <div className="flex justify-between text-slate-600">
                      <span>Kondisi Harga Saat Ini:</span>
                      <span
                        className={`font-semibold font-mono ${
                          stock.price <= stock.pbv.fairPrice
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {stock.price <= stock.pbv.fairPrice ? 'Diskon ' : 'Lebih Mahal '}
                        {Math.abs(
                          ((stock.price - stock.pbv.fairPrice) / stock.pbv.fairPrice) * 100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Panduan Pemula Super Sederhana */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Info className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">
              Panduan Praktis Cara Mengambil Keputusan
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-emerald-800 block">
                🟢 Kapan Waktu Bagus Beli? (Diskon)
              </span>
              <p className="text-slate-600 leading-relaxed">
                Ketika Margin of Safety bernilai <strong>Positif (+)</strong> di atas 10% dan PER/PBV berada di bawah garis rata-rata normal. Jika dividen yield di atas 6%, risiko penurunan harga makin terproteksi oleh arus kas dividen.
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-bold text-rose-800 block">
                🔴 Kapan Harus Berhati-hati? (Kemahalan)
              </span>
              <p className="text-slate-600 leading-relaxed">
                Ketika Margin of Safety bernilai <strong>Negatif (-)</strong> dan harga saat ini jauh lebih tinggi daripada harga wajarnya. Jika pasar terkoreksi, saham seperti ini rentan anjlok mendekati harga wajarnya kembali.
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
