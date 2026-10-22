'use client';

import React, { useState, useEffect } from 'react';
import { Search, Info, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle, Coins, Calendar, Calculator, ChevronDown, ChevronUp, Wallet, BookOpen, Target, Layers, X, Compass, DollarSign, ShieldAlert, Award, TrendingUp, Filter, Star, Activity, Sparkles, TrendingDown, Trash2, Flame, Zap } from 'lucide-react';

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
  cumDate?: string | null;
  cumPrice?: number | null;
  yieldOnCum?: number | null;
}

interface DividendData {
  yieldPercent: number | null;
  annualRate: number | null;
  history: DividendPayment[];
}

interface FinancialHealth {
  roe: number | null;
  der: number | null;
  profitMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  isBank: boolean;
}

interface DailyPickItem {
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
  marginOfSafety: number;
  distanceFrom52wLow: number;
  rsi?: number | null;
  volSpike?: number | null;
  swingPotential?: number;
}

interface TechnicalIndicators {
  rsi: number;
  ma20: number | null;
  ma50: number | null;
  volSpike: number;
  resistance: number;
  support: number;
  trend: 'uptrend' | 'downtrend' | 'sideways';
  signal: string;
  signalBadge: string;
}

interface StockData {
  ticker: string;
  fullTicker: string;
  name: string;
  price: number;
  changePercent: number;
  marketCap?: number | null;
  marketCapFormatted?: string;
  eps: number | null;
  bvps: number | null;
  dividend: DividendData;
  health?: FinancialHealth;
  technicals?: TechnicalIndicators;
  per: MetricBand;
  pbv: MetricBand;
}

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
  rsi?: number | null;
  volSpike?: number | null;
  trend?: 'uptrend' | 'downtrend' | 'sideways';
  swingPotential?: number;
  swingSignal?: string;
  swingSignalBadge?: string;
}

// Helper untuk format angka dengan separator titik (contoh: 10000000 -> 10.000.000)
const formatThousand = (num: number | string): string => {
  if (num === '' || num === null || num === undefined) return '';
  const clean = num.toString().replace(/\D/g, '');
  if (!clean) return '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseThousand = (str: string): number => {
  const clean = str.replace(/\./g, '').trim();
  const val = Number(clean);
  return isNaN(val) ? 0 : val;
};

export default function Home() {
  const [tickerInput, setTickerInput] = useState('BBRI');
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  // Tab Sidebar Kanan: 'plan' (Rencana Beli) | 'ranking' (Rank Saham Diskon) | 'daily' (Pilihan Menarik Hari Ini) | 'watchlist' (Watchlist Saya)
  const [rightPanelTab, setRightPanelTab] = useState<'plan' | 'ranking' | 'daily' | 'watchlist'>('plan');

  // State Watchlist Harian (Pilihan Saham Menarik Hari Ini)
  const [dailyPicks, setDailyPicks] = useState<DailyPickItem[]>([]);
  const [dailyLoading, setDailyLoading] = useState<boolean>(false);
  const [dailyDateFormatted, setDailyDateFormatted] = useState<string>('');

  const fetchDailyWatchlist = async (overrideMode?: 'invest' | 'swing') => {
    setDailyLoading(true);
    const activeMode = overrideMode || tradeMode;
    try {
      const res = await fetch(`/api/daily-watchlist?mode=${activeMode}`);
      const data = await res.json();
      if (res.ok && data.picks) {
        setDailyPicks(data.picks);
        setDailyDateFormatted(data.dateFormatted || '');
      }
    } catch (e) {
      console.error('Error fetching daily watchlist:', e);
    } finally {
      setDailyLoading(false);
    }
  };

  // Modal Popups State untuk alat bantu opsional:
  const [activeModal, setActiveModal] = useState<'dividend' | null>(null);

  // State Tab Kalkulator Average Down:
  const [avgDownTab, setAvgDownTab] = useState<'target' | 'simulate'>('target');

  // State Kalkulator Target Dividen
  const [targetDivInput, setTargetDivInput] = useState<string>('10.000.000');

  // State Kalkulator Average Down
  const [currentLotsInput, setCurrentLotsInput] = useState<string>('50');
  const [currentAvgPriceInput, setCurrentAvgPriceInput] = useState<string>('5.500');
  const [targetAvgPriceInput, setTargetAvgPriceInput] = useState<string>('5.100');
  const [simBuyLotsInput, setSimBuyLotsInput] = useState<string>('25');

  // State Strategi Beli & Money Management (Panel Kanan)
  const [tradeMode, setTradeMode] = useState<'invest' | 'swing'>('invest'); // 'invest' (Long-Term) | 'swing' (Fast/Swing Trade)
  const [hasPosition, setHasPosition] = useState<boolean>(false); // Apakah sudah punya barang atau belum
  const [budgetInput, setBudgetInput] = useState<string>('10.000.000'); // default budget modal Rp 10 Juta
  const [strategyMode, setStrategyMode] = useState<'pyramid' | 'dca' | 'lumpsum'>('pyramid');

  // State Screener Ranking Saham Undervalued
  const [screenerList, setScreenerList] = useState<ScreenerStock[]>([]);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerMinCapInput, setScreenerMinCapInput] = useState<string>('1'); // Dalam Triliun (default 1T)
  const [activeMinCapDisplay, setActiveMinCapDisplay] = useState<string>('Rp 1 Triliun');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under100' | '100to1000' | 'above1000'>('all');

  // State Watchlist (MongoDB + Fallback)
  interface WatchlistItem {
    ticker: string;
    name: string;
    addedAt: string;
    notes?: string;
  }
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState<boolean>(false);
  const [watchlistStorage, setWatchlistStorage] = useState<string>('');

  const fetchWatchlist = async () => {
    setWatchlistLoading(true);
    try {
      const res = await fetch('/api/watchlist');
      const data = await res.json();
      if (res.ok && data.items) {
        setWatchlist(data.items);
        setWatchlistStorage(data.storage);
      }
    } catch (e) {
      console.error('Error fetching watchlist:', e);
    } finally {
      setWatchlistLoading(false);
    }
  };

  const toggleWatchlist = async (ticker: string, name: string) => {
    const isSaved = watchlist.some((w) => w.ticker === ticker);
    try {
      if (isSaved) {
        setWatchlist((prev) => prev.filter((w) => w.ticker !== ticker));
        await fetch(`/api/watchlist?ticker=${ticker}`, { method: 'DELETE' });
      } else {
        const newItem = { ticker, name, addedAt: new Date().toISOString() };
        setWatchlist((prev) => [newItem, ...prev]);
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, name }),
        });
      }
    } catch (e) {
      console.error('Error toggling watchlist:', e);
    }
  };

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
      // Reset semua field rencana ketika ganti saham
      setHasPosition(false);
      setBudgetInput('10.000.000');
      setAvgDownTab('target');
      setCurrentLotsInput('50');
      setSimBuyLotsInput('25');

      // Tentukan default strategyMode sesuai status harga wajar saham:
      // Jika harga wajar (fair), otomatis default ke DCA. Jika diskon (cheap), default ke Piramida.
      let fair = null;
      if (data.per?.fairPrice && data.pbv?.fairPrice) {
        fair = (data.per.fairPrice + data.pbv.fairPrice) / 2;
      } else {
        fair = data.per?.fairPrice || data.pbv?.fairPrice;
      }
      const mos = fair && fair > 0 && data.price ? ((fair - data.price) / fair) * 100 : 0;
      if (mos > 15) {
        setStrategyMode('pyramid'); // Diskon jumbo: Piramida agresif di bawah
      } else {
        setStrategyMode('dca'); // Harga wajar atau premium: Cicil DCA berkala
      }

      if (data.price) {
        // Otomatis set perkiraan avg nyangkut dan target avg sesuai harga saham baru
        setCurrentAvgPriceInput(formatThousand(Math.round(data.price * 1.15)));
        setTargetAvgPriceInput(formatThousand(Math.round(data.price * 1.05)));
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
      setStock(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchScreener = async (customCapInTrillion?: number, overrideMode?: 'invest' | 'swing') => {
    setScreenerLoading(true);
    const activeMode = overrideMode || tradeMode;
    try {
      const capTrillion = customCapInTrillion !== undefined ? customCapInTrillion : (parseFloat(screenerMinCapInput.replace(/,/g, '.')) || 1);
      const capInBytes = capTrillion * 1_000_000_000_000;
      const res = await fetch(`/api/screener?minMarketCap=${capInBytes}&mode=${activeMode}`);
      const data = await res.json();
      if (res.ok && data.stocks) {
        setScreenerList(data.stocks);
        if (data.minMarketCap) {
          setActiveMinCapDisplay(data.minMarketCap);
        }
      }
    } catch (err) {
      console.error('Failed to fetch screener ranking', err);
    } finally {
      setScreenerLoading(false);
    }
  };

  useEffect(() => {
    fetchStock('BBRI');
    fetchScreener(undefined, tradeMode);
    fetchWatchlist();
    fetchDailyWatchlist(tradeMode);
  }, []);

  // Sinkronisasi otomatis saat mode global (Invest vs Swing) berubah
  const handleTradeModeChange = (newMode: 'invest' | 'swing') => {
    setTradeMode(newMode);
    fetchScreener(undefined, newMode);
    fetchDailyWatchlist(newMode);
  };

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

  // 1. Kalkulasi Target Dividen
  const calculateDividendRequirement = () => {
    if (!stock || !stock.dividend.annualRate || stock.dividend.annualRate <= 0) return null;
    const targetDividend = parseThousand(targetDivInput);
    if (targetDividend <= 0) return null;

    const divPerShare = stock.dividend.annualRate;
    const divPerLot = divPerShare * 100;
    const requiredLots = Math.ceil(targetDividend / divPerLot);
    const requiredShares = requiredLots * 100;
    const totalCapitalNeeded = requiredLots * stock.price * 100;

    return {
      divPerShare,
      divPerLot,
      requiredLots,
      requiredShares,
      totalCapitalNeeded,
      yieldPercent: stock.dividend.yieldPercent || (divPerShare / stock.price) * 100,
    };
  };

  // 2. Kalkulasi Average Down - Mode 1: Target Avg
  type AvgDownResult =
    | { possible: false; message: string }
    | {
        possible: true;
        additionalLotsNeeded: number;
        capitalNeeded: number;
        newTotalLots: number;
        actualNewAvg: number;
      };

  const calculateAvgDown = (): AvgDownResult | null => {
    if (!stock || !stock.price) return null;
    const P0 = parseThousand(currentAvgPriceInput);
    const L0 = parseThousand(currentLotsInput);
    const P1 = stock.price;
    const Target = parseThousand(targetAvgPriceInput);

    if (L0 <= 0 || P0 <= 0 || Target <= 0) {
      return {
        possible: false,
        message: 'Masukkan jumlah lot dan harga rata-rata yang lebih besar dari 0.'
      };
    }

    if (Target <= P1) {
      return {
        possible: false,
        message: `Target avg (${formatRupiah(Target)}) tidak boleh lebih rendah atau sama dengan harga beli saat ini (${formatRupiah(P1)}). Anda tidak bisa menurunkan rata-rata di bawah harga pasar beli saat ini.`
      };
    }

    if (Target >= P0) {
      return {
        possible: false,
        message: `Target avg (${formatRupiah(Target)}) harus lebih rendah dari avg Anda saat ini (${formatRupiah(P0)}).`
      };
    }

    const additionalLotsNeeded = Math.ceil((L0 * (P0 - Target)) / (Target - P1));
    const capitalNeeded = additionalLotsNeeded * P1 * 100;
    const newTotalLots = L0 + additionalLotsNeeded;
    const actualNewAvg = Math.round(((P0 * L0 * 100) + capitalNeeded) / (newTotalLots * 100));

    return {
      possible: true,
      additionalLotsNeeded,
      capitalNeeded,
      newTotalLots,
      actualNewAvg,
    };
  };

  // 3. Kalkulasi Average Down - Mode 2: "Kalau Saya Beli {n} Lot"
  const calculateSimulatedAvg = () => {
    if (!stock || !stock.price) return null;
    const P0 = parseThousand(currentAvgPriceInput);
    const L0 = parseThousand(currentLotsInput);
    const buyLots = parseThousand(simBuyLotsInput);
    const P1 = stock.price;

    if (L0 <= 0 || P0 <= 0 || buyLots <= 0) return null;

    const oldTotalCost = P0 * L0 * 100;
    const newBuyCost = P1 * buyLots * 100;
    const combinedTotalLots = L0 + buyLots;
    const combinedTotalCost = oldTotalCost + newBuyCost;
    const resultingAvgPrice = Math.round(combinedTotalCost / (combinedTotalLots * 100));
    const avgReduction = P0 - resultingAvgPrice;
    const reductionPercent = ((P0 - resultingAvgPrice) / P0) * 100;

    return {
      buyLots,
      newBuyCost,
      combinedTotalLots,
      resultingAvgPrice,
      avgReduction,
      reductionPercent,
    };
  };

  // 4. Kalkulator Rencana Strategi Beli Berdasarkan Budget
  const calculateBuyStrategy = () => {
    if (!stock || !stock.price || !evalResult) return null;
    const budget = parseThousand(budgetInput);
    if (budget <= 0) return null;

    const P0 = stock.price;
    const mos = evalResult.marginOfSafety ?? 0;
    const valuationLevel = evalResult.level;

    let rationale = '';
    if (valuationLevel === 'cheap') {
      rationale = `Saham ${stock.ticker} sedang diskon (MoS +${mos.toFixed(1)}%). Rekomendasi: Cicil Piramida 3 Tahap (40% beli sekarang, 30% antre di dip ringan, 30% simpan jika ada koreksi).`;
    } else if (valuationLevel === 'expensive') {
      rationale = `Saham ${stock.ticker} sedang kemahalan (MoS ${mos.toFixed(1)}%). DILARANG ALL IN! Jangan FOMO. Sangat disarankan wait and see atau hanya cicil sangat kecil (10%-20%).`;
    } else {
      rationale = `Saham ${stock.ticker} berada di harga wajar. Rekomendasi: Cicil Rutin Berkala / DCA (bagi modal menjadi 3 bagian sama rata) untuk memperkecil risiko fluktuasi.`;
    }

    // Piramida (40% - 30% - 30%)
    const p1Price = P0;
    const p2Price = Math.round(P0 * 0.96); // dip -4%
    const p3Price = Math.round(P0 * 0.92); // dip -8%

    const p1Lots = Math.max(1, Math.floor((budget * 0.4) / (p1Price * 100)));
    const p2Lots = Math.max(1, Math.floor((budget * 0.3) / (p2Price * 100)));
    const p3Lots = Math.max(1, Math.floor((budget * 0.3) / (p3Price * 100)));

    const p1Cost = p1Lots * p1Price * 100;
    const p2Cost = p2Lots * p2Price * 100;
    const p3Cost = p3Lots * p3Price * 100;
    const pyramidTotalCost = p1Cost + p2Cost + p3Cost;
    const pyramidRemainingCash = Math.max(0, budget - pyramidTotalCost);
    const pyramidTotalLots = p1Lots + p2Lots + p3Lots;
    const pyramidBlendedAvg = Math.round(pyramidTotalCost / (pyramidTotalLots * 100));

    // DCA 3 Periode Sama Rata
    const dcaLotsPerStage = Math.max(1, Math.floor((budget / 3) / (P0 * 100)));
    const dcaTotalLots = dcaLotsPerStage * 3;
    const dcaTotalCost = dcaTotalLots * P0 * 100;
    const dcaRemainingCash = Math.max(0, budget - dcaTotalCost);

    // All-In / Lump Sum
    const lumpSumLots = Math.floor(budget / (P0 * 100));
    const lumpSumCost = lumpSumLots * P0 * 100;
    const lumpSumRemaining = budget - lumpSumCost;

    return {
      budget,
      valuationLevel,
      rationale,
      pyramid: {
        t1: { lots: p1Lots, price: p1Price, cost: p1Cost, pct: '40%' },
        t2: { lots: p2Lots, price: p2Price, cost: p2Cost, pct: '30%' },
        t3: { lots: p3Lots, price: p3Price, cost: p3Cost, pct: '30%' },
        totalLots: pyramidTotalLots,
        totalCost: pyramidTotalCost,
        remainingCash: pyramidRemainingCash,
        blendedAvg: pyramidBlendedAvg,
      },
      dca: {
        stages: 3,
        lotsPerStage: dcaLotsPerStage,
        costPerStage: dcaLotsPerStage * P0 * 100,
        totalLots: dcaTotalLots,
        totalCost: dcaTotalCost,
        remainingCash: dcaRemainingCash,
      },
      lumpSum: {
        lots: lumpSumLots,
        cost: lumpSumCost,
        remainingCash: lumpSumRemaining,
        isRisky: valuationLevel !== 'cheap',
      },
      // FITUR 2: TARGET PROFIT (TAKE PROFIT PLAN)
      takeProfit: {
        tp1: {
          targetPrice: evalResult.fairPrice ? Math.round(evalResult.fairPrice) : Math.round(P0 * 1.15),
          gainPercent: evalResult.fairPrice && evalResult.fairPrice > P0
            ? Math.round(((evalResult.fairPrice - P0) / P0) * 1000) / 10
            : 15,
          label: 'Harga Wajar (Konservatif)',
          action: 'Jual 50% muatan saat harga kembali ke rata-rata historis',
        },
        tp2: {
          targetPrice: stock.per.plus1SD && stock.eps
            ? Math.round((stock.eps * stock.per.plus1SD + (stock.bvps && stock.pbv.plus1SD ? stock.bvps * stock.pbv.plus1SD : stock.eps * stock.per.plus1SD)) / 2)
            : Math.round(P0 * 1.35),
          gainPercent: Math.round((((stock.per.plus1SD && stock.eps ? (stock.eps * stock.per.plus1SD) : P0 * 1.35) - P0) / P0) * 1000) / 10,
          label: 'Puncak Valuasi / +1 SD (Optimis)',
          action: 'Trailing stop / lepas sisa 50% saat euforia pasar',
        },
      },
      // TARGET PROFIT & STOP LOSS KHUSUS SWING TRADE (JANGKA PENDEK)
      swingTrade: {
        tp1: {
          targetPrice: stock.technicals?.resistance ? stock.technicals.resistance : Math.round(P0 * 1.05), // +5% atau Resistance
          gainPercent: stock.technicals?.resistance
            ? Math.round(((stock.technicals.resistance - P0) / P0) * 1000) / 10
            : 5.0,
          label: 'TP 1 Swing: Resistance Terdekat',
          action: 'Amankan cuan 50% saat membentur resistance jangka pendek',
        },
        tp2: {
          targetPrice: Math.round(P0 * 1.10), // +10% target swing
          gainPercent: 10.0,
          label: 'TP 2 Swing: Momentum Breakout (+10%)',
          action: 'Kunci profit sisa 50% saat momentum swing maksimal',
        },
        sl: {
          slPrice: stock.technicals?.support ? Math.min(Math.round(P0 * 0.96), stock.technicals.support) : Math.round(P0 * 0.95), // -4% s/d -5%
          lossPercent: stock.technicals?.support
            ? Math.round(((Math.min(Math.round(P0 * 0.96), stock.technicals.support) - P0) / P0) * 1000) / 10
            : -5.0,
          label: 'Cut Loss Ketat (Support)',
          action: 'Disiplin exit jika breakdown support teknikal 20 hari',
        },
        rrRatio: (() => {
          const potGain = (stock.technicals?.resistance ? stock.technicals.resistance : P0 * 1.05) - P0;
          const potLoss = P0 - (stock.technicals?.support ? Math.min(Math.round(P0 * 0.96), stock.technicals.support) : P0 * 0.95);
          if (potLoss <= 0) return '1 : 2.5';
          const r = Math.round((potGain / potLoss) * 10) / 10;
          return `1 : ${r > 0 ? r : 2.0}`;
        })(),
      },
      // STOP LOSS STANDAR INVESTING
      stopLoss: {
        slPrice: Math.round(P0 * 0.92), // -8% batas risiko standar investing
        lossPercent: -8.0,
        slDeepPrice: stock.per.minus1SD && stock.eps ? Math.round(stock.eps * stock.per.minus1SD) : Math.round(P0 * 0.88),
        action: 'Cut loss jika breakdown di bawah support / terjadi pemburukan fundamental drastis',
      }
    };
  };

  const divTargetResult = calculateDividendRequirement();
  const avgDownResult = calculateAvgDown();
  const simAvgResult = calculateSimulatedAvg();
  const strategyResult = calculateBuyStrategy();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10 space-y-6">

        {/* Top Navigation & Header */}
        <header className="border-b border-slate-200 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  IDX / BEI LIVE
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Valuasi Fundamental, Rencana Eksekusi & Screener
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                Apakah Harga Saham Ini Murah atau Mahal?
              </h1>
            </div>

            {/* GLOBAL MODE SWITCHER: INVESTASI (LONG TERM) VS SWING TRADE (FAST CUAN) */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto shadow-xs">
              <button
                type="button"
                onClick={() => handleTradeModeChange('invest')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  tradeMode === 'invest'
                    ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Mode Investasi Jangka Panjang (Valuasi Murah & Dividen)"
              >
                <span>🌿</span>
                <span>Mode Investasi</span>
                {tradeMode === 'invest' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTradeModeChange('swing')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  tradeMode === 'swing'
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-extrabold border border-amber-500/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Mode Swing Trade (Cari Cuan Cepat / Jangka Pendek)"
              >
                <Zap className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                <span>Mode Swing Trade</span>
                {tradeMode === 'swing' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>
                )}
              </button>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
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
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
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

        {/* 2-COLUMN MAIN LAYOUT: KIRI (FUNDAMENTAL & RUMUS) | KANAN (RENCANA BELI & RANKING SAHAM) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* KOLOM KIRI (7 COLS): DATA FUNDAMENTAL, VERDICT, DIVIDEN & RUMUS */}
          <div className="lg:col-span-7 space-y-6">
            {stock && evalResult && (
              <>
                {/* Verdict Hero Card */}
                <div
                  className={`p-5 sm:p-6 rounded-xl border bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${evalResult.cardBorder}`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded border border-slate-200">
                        {stock.fullTicker}
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">{stock.name}</h2>
                      {stock.marketCapFormatted && (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          M.Cap: {stock.marketCapFormatted}
                        </span>
                      )}
                      {/* Button Toggle Watchlist */}
                      <button
                        type="button"
                        onClick={() => toggleWatchlist(stock.ticker, stock.name)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                          watchlist.some((w) => w.ticker === stock.ticker)
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                        title="Simpan ke Watchlist"
                      >
                        <Star className={`w-3.5 h-3.5 ${watchlist.some((w) => w.ticker === stock.ticker) ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                        <span>{watchlist.some((w) => w.ticker === stock.ticker) ? 'Tersimpan' : 'Watchlist'}</span>
                      </button>
                    </div>

                    <div className="flex items-baseline gap-3 pt-1">
                      <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
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

                    <div className="pt-2 text-xs text-slate-700 space-y-1 bg-white/70 p-3 rounded-lg border border-slate-200/80">
                      <p className="font-medium text-slate-900">{evalResult.explanation}</p>
                      <p className="text-slate-600">{evalResult.actionHint}</p>
                    </div>
                  </div>

                  {/* Status Badge & Kesimpulan Angka */}
                  <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-5 text-left sm:text-right shrink-0 min-w-[190px]">
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

                {/* BLOCK / TAB RUMUS PERHITUNGAN HARGA WAJAR */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setShowFormulaDetails(!showFormulaDetails)}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/70 hover:bg-slate-50 text-left transition-colors cursor-pointer border-b border-slate-200"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-slate-200 text-slate-700">
                        <Calculator className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                          Bedah Rumus & Perhitungan Angka Riil
                          <span className="text-[10px] font-normal text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            Transparan
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Lihat kalkulasi harga wajar ({formatRupiah(evalResult.fairPrice)}) langkah demi langkah.
                        </p>
                      </div>
                    </div>

                    <div className="text-slate-400">
                      {showFormulaDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  {showFormulaDetails && (
                    <div className="p-4 sm:p-5 space-y-4 text-xs divide-y divide-slate-100">
                      {/* Rumus 1: Harga Wajar PER */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            1. Rumus Harga Wajar PER = EPS × Rata-rata PER 5 Tahun
                          </span>
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {formatRupiah(stock.per.fairPrice)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 font-mono text-[11px] text-slate-700">
                          = Rp {stock.eps ? stock.eps.toLocaleString('id-ID') : '0'} × {stock.per.mean.toFixed(1)}x = <strong className="text-slate-900">{formatRupiah(stock.per.fairPrice)}</strong>
                        </div>
                      </div>

                      {/* Rumus 2: Harga Wajar PBV */}
                      <div className="space-y-1.5 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            2. Rumus Harga Wajar PBV = BVPS × Rata-rata PBV 5 Tahun
                          </span>
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {formatRupiah(stock.pbv.fairPrice)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 font-mono text-[11px] text-slate-700">
                          = Rp {stock.bvps ? stock.bvps.toLocaleString('id-ID') : '0'} × {stock.pbv.mean.toFixed(2)}x = <strong className="text-slate-900">{formatRupiah(stock.pbv.fairPrice)}</strong>
                        </div>
                      </div>

                      {/* Rumus 3: Rata-rata Komposit & MoS */}
                      <div className="space-y-1.5 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            3. Rata-rata Komposit & Margin of Safety
                          </span>
                          <span className={`font-mono font-bold px-2 py-0.5 rounded border ${evalResult.badgeClass}`}>
                            MoS: {evalResult.marginOfSafety !== null ? `${evalResult.marginOfSafety >= 0 ? '+' : ''}${evalResult.marginOfSafety.toFixed(1)}%` : '-'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 font-mono text-[11px] space-y-1 text-slate-700">
                          <div>Harga Wajar = ({formatRupiah(stock.per.fairPrice)} + {formatRupiah(stock.pbv.fairPrice)}) ÷ 2 = <strong className="text-indigo-700">{formatRupiah(evalResult.fairPrice)}</strong></div>
                          <div>MoS = (({formatRupiah(evalResult.fairPrice)} - {formatRupiah(stock.price)}) ÷ {formatRupiah(evalResult.fairPrice)}) × 100% = <strong className={evalResult.marginOfSafety !== null && evalResult.marginOfSafety >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{evalResult.marginOfSafety !== null ? `${evalResult.marginOfSafety >= 0 ? '+' : ''}${evalResult.marginOfSafety.toFixed(1)}%` : '-'}</strong></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Side-by-side PER & PBV Cards (DENGAN EPS & BVPS) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* PER Card */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          1. PER (Price to Earnings)
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-xl sm:text-2xl font-extrabold text-slate-900">
                            {stock.per.current ? `${stock.per.current.toFixed(1)}x` : 'N/A (Rugi)'}
                          </span>
                          <span className="text-xs text-slate-400">Current</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        !stock.per.current || stock.per.current <= 0
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : stock.per.current < stock.per.minus1SD
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : stock.per.current > stock.per.mean
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {stock.per.current ? `${stock.per.current < stock.per.minus1SD ? 'Diskon' : stock.per.current > stock.per.mean ? 'Mahal' : 'Wajar'}` : 'Rugi'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100 text-[11px] space-y-0.5">
                      <div className="flex justify-between items-center font-bold text-emerald-900">
                        <span>EPS (Laba Bersih per Lembar):</span>
                        <span className="font-mono text-xs">{stock.eps ? `Rp ${stock.eps.toLocaleString('id-ID')}` : '-'}</span>
                      </div>
                      <p className="text-emerald-700 text-[10px]">
                        Laba Rp {stock.eps ? (stock.eps * 100).toLocaleString('id-ID') : '0'} per 1 lot saham per tahun.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 text-[10px] block">Diskon (-1σ)</span>
                        <span className="font-mono font-bold text-slate-700">{stock.per.minus1SD.toFixed(1)}x</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 text-[10px] block">Normal (Mean)</span>
                        <span className="font-mono font-bold text-slate-700">{stock.per.mean.toFixed(1)}x</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 text-[10px] block">Mahal (+1σ)</span>
                        <span className="font-mono font-bold text-slate-700">{stock.per.plus1SD.toFixed(1)}x</span>
                      </div>
                    </div>
                  </div>

                  {/* PBV Card */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          2. PBV (Price to Book Value)
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-xl sm:text-2xl font-extrabold text-slate-900">
                            {stock.pbv.current ? `${stock.pbv.current.toFixed(2)}x` : '-'}
                          </span>
                          <span className="text-xs text-slate-400">Current</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        !stock.pbv.current || stock.pbv.current <= 0
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : stock.pbv.current < stock.pbv.minus1SD
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : stock.pbv.current > stock.pbv.mean
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {stock.pbv.current ? `${stock.pbv.current < stock.pbv.minus1SD ? 'Diskon' : stock.pbv.current > stock.pbv.mean ? 'Mahal' : 'Wajar'}` : '-'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-blue-50/40 border border-blue-100 text-[11px] space-y-0.5">
                      <div className="flex justify-between items-center font-bold text-blue-900">
                        <span>BVPS (Nilai Modal per Lembar):</span>
                        <span className="font-mono text-xs">{stock.bvps ? `Rp ${stock.bvps.toLocaleString('id-ID')}` : '-'}</span>
                      </div>
                      <p className="text-blue-700 text-[10px]">
                        Nilai aset bersih jika seluruh utang dilunasi hari ini.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 text-[10px] block">Diskon (-1σ)</span>
                        <span className="font-mono font-bold text-slate-700">{stock.pbv.minus1SD.toFixed(2)}x</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 text-[10px] block">Normal (Mean)</span>
                        <span className="font-mono font-bold text-slate-700">{stock.pbv.mean.toFixed(2)}x</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 text-[10px] block">Mahal (+1σ)</span>
                        <span className="font-mono font-bold text-slate-700">{stock.pbv.plus1SD.toFixed(2)}x</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FITUR 1: CARD KESEHATAN KEUANGAN & ANTI VALUE TRAP */}
                {stock.health && (() => {
                  const h = stock.health;
                  let score = 0;
                  const warnings: string[] = [];
                  const strengths: string[] = [];

                  // 1. ROE (Maksimal 30 poin)
                  if (h.roe !== null) {
                    if (h.roe >= 15) {
                      score += 30;
                      strengths.push(`ROE prima (${h.roe}%)`);
                    } else if (h.roe >= 10) {
                      score += 22;
                      strengths.push(`ROE solid (${h.roe}%)`);
                    } else if (h.roe >= 5) {
                      score += 14;
                    } else {
                      score += 5;
                      warnings.push(`ROE rendah (${h.roe}%), efisiensi laba atas modal minim`);
                    }
                  } else {
                    score += 15;
                  }

                  // 2. DER / Utang (Maksimal 30 poin)
                  if (h.isBank) {
                    score += 25; // Bank wajar leverage tinggi
                    strengths.push('Sektor Perbankan (Leverage regulasi OJK)');
                  } else if (h.der !== null) {
                    if (h.der <= 0.8) {
                      score += 30;
                      strengths.push(`Utang sangat aman (DER ${h.der}x)`);
                    } else if (h.der <= 1.5) {
                      score += 22;
                      strengths.push(`Utang terkendali (DER ${h.der}x)`);
                    } else if (h.der <= 2.2) {
                      score += 12;
                      warnings.push(`Rasio utang mulai tinggi (DER ${h.der}x)`);
                    } else {
                      score += 4;
                      warnings.push(`Beban utang tinggi (DER ${h.der}x)`);
                    }
                  } else {
                    score += 18;
                  }

                  // 3. Net Margin (Maksimal 20 poin)
                  if (h.profitMargin !== null) {
                    if (h.profitMargin >= 15) {
                      score += 20;
                      strengths.push(`Margin laba tebal (${h.profitMargin}%)`);
                    } else if (h.profitMargin >= 8) {
                      score += 15;
                      strengths.push(`Margin laba sehat (${h.profitMargin}%)`);
                    } else if (h.profitMargin >= 2) {
                      score += 10;
                    } else {
                      score += 2;
                      warnings.push(`Margin laba tipis (${h.profitMargin}%)`);
                    }
                  } else {
                    score += 10;
                  }

                  // 4. Pertumbuhan Laba / Revenue YoY (Maksimal 20 poin)
                  const growth = h.earningsGrowth !== null ? h.earningsGrowth : h.revenueGrowth;
                  if (growth !== null) {
                    if (growth >= 10) {
                      score += 20;
                      strengths.push(`Laba bertumbuh kuat (+${growth}%)`);
                    } else if (growth >= 0) {
                      score += 14;
                      strengths.push(`Laba bertumbuh YoY (+${growth}%)`);
                    } else if (growth >= -15) {
                      score += 8;
                      warnings.push(`Pertumbuhan laba terkontraksi (${growth}%)`);
                    } else {
                      score += 2;
                      warnings.push(`Penurunan laba tajam (${growth}%)`);
                    }
                  } else {
                    score += 10;
                  }

                  // Tentukan Badge & Status
                  let badgeText = '🟢 Fundamental Sehat';
                  let badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  if (score < 45 || (h.roe !== null && h.roe < 3 && h.der !== null && h.der > 2.0)) {
                    badgeText = '⚠️ Waspada Risiko';
                    badgeBg = 'bg-rose-50 text-rose-800 border-rose-200';
                  } else if (score < 68) {
                    badgeText = '🟡 Cukup Solid';
                    badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
                  }

                  return (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700">
                            <Activity className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900">Kesehatan Finansial & Anti "Value Trap"</h3>
                            <p className="text-[11px] text-slate-500">Evaluasi multi-faktor: cetak laba, beban utang, margin & tren pertumbuhan.</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${badgeBg}`}>
                            <span>{badgeText}</span>
                            <span className="font-mono text-[11px] opacity-80">({score}/100)</span>
                          </span>
                        </div>
                      </div>

                      {/* 4 Kartu Metrik Utama */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {/* ROE */}
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] text-slate-500 font-medium block">ROE (Cetak Laba)</span>
                          <div className="flex items-baseline gap-1">
                            <span className={`font-mono font-bold text-sm ${h.roe !== null && h.roe >= 15 ? 'text-emerald-700' : h.roe !== null && h.roe < 5 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {h.roe !== null ? `${h.roe}%` : '-'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block leading-tight">
                            {h.roe !== null && h.roe >= 15 ? '✅ Sangat Efisien' : h.roe !== null && h.roe >= 8 ? 'Lumayan' : h.roe !== null && h.roe >= 5 ? 'Sedang' : 'Rendah'}
                          </span>
                        </div>

                        {/* DER (Debt to Equity) */}
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] text-slate-500 font-medium block">DER (Rasio Utang)</span>
                          <div className="flex items-baseline gap-1">
                            <span className={`font-mono font-bold text-sm ${h.der !== null && h.der <= 1.0 ? 'text-emerald-700' : h.der !== null && h.der > 2.0 ? 'text-rose-700' : 'text-slate-800'}`}>
                              {h.der !== null ? `${h.der}x` : h.isBank ? 'N/A (Bank)' : '-'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block leading-tight">
                            {h.isBank ? 'Sektor Finansial' : h.der !== null && h.der <= 1.0 ? '✅ Utang Aman' : h.der !== null && h.der <= 2.0 ? 'Utang Sedang' : 'Waspada Utang'}
                          </span>
                        </div>

                        {/* Profit Margin */}
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] text-slate-500 font-medium block">Net Margin</span>
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono font-bold text-sm text-slate-800">
                              {h.profitMargin !== null ? `${h.profitMargin}%` : '-'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block leading-tight">
                            {h.profitMargin !== null && h.profitMargin >= 10 ? '✅ Margin Tebal' : 'Margin Laba'}
                          </span>
                        </div>

                        {/* Revenue / Earnings Growth */}
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                          <span className="text-[10px] text-slate-500 font-medium block">Pertumbuhan Laba</span>
                          <div className="flex items-baseline gap-1">
                            <span className={`font-mono font-bold text-sm ${
                              h.earningsGrowth !== null && h.earningsGrowth >= 0
                                ? 'text-emerald-700'
                                : h.earningsGrowth !== null
                                ? 'text-rose-700'
                                : 'text-slate-800'
                            }`}>
                              {h.earningsGrowth !== null
                                ? `${h.earningsGrowth >= 0 ? '+' : ''}${h.earningsGrowth}%`
                                : h.revenueGrowth !== null
                                ? `${h.revenueGrowth >= 0 ? '+' : ''}${h.revenueGrowth}%`
                                : '-'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block leading-tight">
                            {h.earningsGrowth !== null && h.earningsGrowth >= 0 ? '📈 Laba Naik YoY' : h.earningsGrowth !== null ? '📉 Laba Turun YoY' : 'Pertumbuhan YoY'}
                          </span>
                        </div>
                      </div>

                      {/* Baris Rincian Diagnosa: Kenapa Status Ini Diberikan */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-500 font-medium">Diagnosa Skor:</span>
                          {strengths.map((s, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                              ✓ {s}
                            </span>
                          ))}
                          {warnings.map((w, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1 font-medium">
                              ⚠️ {w}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* FITUR KHUSUS TRADING: RADAR TEKNIKAL & MOMENTUM SWING */}
                {stock.technicals && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
                          <Flame className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            Radar Teknikal & Momentum Swing
                            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              Trader Setup
                            </span>
                          </h3>
                          <p className="text-[11px] text-slate-500">Cek RSI, aliran volume spike & posisi Moving Average untuk timing entry cepat.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${stock.technicals.signalBadge}`}>
                          {stock.technicals.signal}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {/* RSI (14) */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[10px] text-slate-500 font-medium block">RSI (14 Hari)</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`font-mono font-bold text-sm ${
                            stock.technicals.rsi <= 35
                              ? 'text-emerald-700 font-extrabold'
                              : stock.technicals.rsi >= 70
                              ? 'text-rose-700'
                              : 'text-slate-800'
                          }`}>
                            {stock.technicals.rsi}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block leading-tight">
                          {stock.technicals.rsi <= 30
                            ? '🔥 Sangat Murah (Oversold)'
                            : stock.technicals.rsi <= 45
                            ? 'Bawah (Siap Mantul)'
                            : stock.technicals.rsi >= 70
                            ? '⚠️ Terlalu Panas (Overbought)'
                            : 'Zona Netral'}
                        </span>
                      </div>

                      {/* Moving Average Status (MA20) */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[10px] text-slate-500 font-medium block">MA20 (Tren Pendek)</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono font-bold text-sm text-slate-800">
                            {stock.technicals.ma20 ? formatRupiah(stock.technicals.ma20) : '-'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block leading-tight">
                          {stock.technicals.ma20 && stock.price >= stock.technicals.ma20
                            ? '✅ Di Atas MA20 (Uptrend)'
                            : 'Di Bawah MA20 (Tekanan)'}
                        </span>
                      </div>

                      {/* Volume Spike Ratio */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[10px] text-slate-500 font-medium block">Aktivitas Volume</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`font-mono font-bold text-sm ${
                            stock.technicals.volSpike >= 1.5 ? 'text-indigo-700 font-extrabold' : 'text-slate-800'
                          }`}>
                            {stock.technicals.volSpike}x
                          </span>
                          <span className="text-[10px] text-slate-400">vs Rata-rata</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block leading-tight">
                          {stock.technicals.volSpike >= 2.0
                            ? '🚀 Spike Besar (Smart Money)'
                            : stock.technicals.volSpike >= 1.2
                            ? 'Cukup Ramai'
                            : 'Volume Normal / Sepi'}
                        </span>
                      </div>

                      {/* Area Support & Resistance 20 Hari */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[10px] text-slate-500 font-medium block">Range 20 Hari</span>
                        <div className="text-[11px] font-mono font-semibold space-y-0.5">
                          <div className="flex justify-between text-rose-700">
                            <span>Resist:</span>
                            <span>{formatRupiah(stock.technicals.resistance)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-700">
                            <span>Supp:</span>
                            <span>{formatRupiah(stock.technicals.support)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dividend Highlight Section */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900">Informasi & Riwayat Dividen</h3>
                      </div>
                    </div>

                    {stock.dividend.yieldPercent !== null ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-slate-500">Dividend Yield:</span>
                        <span className="text-base font-extrabold text-emerald-700 font-mono">
                          {stock.dividend.yieldPercent.toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        Non-Dividen / Belum Rutin
                      </span>
                    )}
                  </div>

                  {/* Tabel Riwayat Dividen Masa Lalu */}
                  {stock.dividend.history && stock.dividend.history.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                            <th className="py-2 px-2.5">Tanggal Ex-Date</th>
                            <th className="py-2 px-2.5 text-right">Harga Cum-Date / Lembar</th>
                            <th className="py-2 px-2.5 text-right">Dividen / Lembar (DPS)</th>
                            <th className="py-2 px-2.5 text-right">Yield saat Cum-Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {stock.dividend.history.slice(0, 5).map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="py-2 px-2.5 font-medium text-slate-900">{formatDate(item.date)}</td>
                              <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-700">
                                {item.cumPrice ? formatRupiah(item.cumPrice) : '-'}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700 text-xs">
                                Rp {item.amount.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono text-slate-600">
                                {item.yieldOnCum ? (
                                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    {item.yieldOnCum.toFixed(1)}%
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* KALKULATOR TARGET DIVIDEN TAHUNAN (EMBEDDED LANGSUNG) */}
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-emerald-100 text-emerald-800">
                        <Target className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        Kalkulator Target Dividen Pasif ({stock.ticker})
                      </span>
                    </div>

                    {stock.dividend.annualRate && stock.dividend.annualRate > 0 ? (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            Mau dapat dividen pasif berapa per tahun?
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-2 font-mono font-bold text-slate-400 text-xs">Rp</span>
                              <input
                                type="text"
                                value={targetDivInput}
                                onChange={(e) => setTargetDivInput(formatThousand(e.target.value))}
                                placeholder="10.000.000"
                                className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-slate-500"
                              />
                            </div>
                            <div className="flex gap-1">
                              {[5000000, 10000000, 25000000].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setTargetDivInput(formatThousand(amt))}
                                  className="px-2 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[10px] cursor-pointer"
                                >
                                  {amt / 1000000} Jt
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {divTargetResult && (
                          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 space-y-2 text-[11px]">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Kebutuhan Lot Saham:</span>
                              <span className="font-extrabold text-emerald-800 font-mono text-xs">
                                {divTargetResult.requiredLots.toLocaleString('id-ID')} Lot ({divTargetResult.requiredShares.toLocaleString('id-ID')} lembar)
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Estimasi Modal yang Dibutuhkan:</span>
                              <span className="font-extrabold text-slate-900 font-mono text-xs">
                                {formatRupiah(divTargetResult.totalCapitalNeeded)}
                              </span>
                            </div>
                            <div className="pt-1 border-t border-emerald-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="text-[10px] text-slate-500">
                                * Dividen terakhir Rp {divTargetResult.divPerShare.toLocaleString('id-ID')} / lembar @ {formatRupiah(stock.price)}.
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setBudgetInput(formatThousand(divTargetResult.totalCapitalNeeded));
                                  setHasPosition(false);
                                  setRightPanelTab('plan');
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1 shadow-sm transition cursor-pointer self-end sm:self-auto"
                              >
                                <Compass className="w-3 h-3" />
                                <span>Kirim ke Rencana Beli</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                        Saham {stock.ticker} belum memiliki catatan nominal dividen rutin untuk disimulasikan.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* KOLOM KANAN (5 COLS): FITUR RENCANA BELI (LANGSUNG TAMPIL DI UI) & RANKING SAHAM NON-GORENGAN */}
          <div className="lg:col-span-5 space-y-4">

            {/* TAB SELECTOR KANAN (4 TABS) */}
            <div className="grid grid-cols-4 p-1 bg-slate-200/80 rounded-xl text-[11px] font-bold shadow-inner">
              <button
                type="button"
                onClick={() => setRightPanelTab('plan')}
                className={`py-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                  rightPanelTab === 'plan'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Rencana Beli & Avg Down"
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="truncate">Rencana</span>
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('ranking')}
                className={`py-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                  rightPanelTab === 'ranking'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Rank Saham Diskon (M.Cap)"
              >
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span className="truncate">Rank Diskon</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightPanelTab('daily');
                  fetchDailyWatchlist();
                }}
                className={`py-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                  rightPanelTab === 'daily'
                    ? 'bg-white text-rose-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Watchlist Saham Menarik Hari Ini"
              >
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span className="truncate">Hari Ini ({dailyPicks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightPanelTab('watchlist');
                  fetchWatchlist();
                }}
                className={`py-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                  rightPanelTab === 'watchlist'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Watchlist Tersimpan (MongoDB)"
              >
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span className="truncate">Watchlist ({watchlist.length})</span>
              </button>
            </div>

            {/* PANEL KANAN 1: RENCANA STRATEGI BELI & ALOKASI BUDGET + AVERAGE DOWN */}
            {rightPanelTab === 'plan' && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Rencana Strategi & Posisi</h3>
                      <p className="text-xs text-slate-500">Saham: {stock?.ticker} (@ {formatRupiah(stock?.price)})</p>
                    </div>
                  </div>

                  {/* Mode Switcher: Invest vs Swing */}
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleTradeModeChange('invest')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                        tradeMode === 'invest'
                          ? 'bg-white text-emerald-800 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>🌿 Invest</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTradeModeChange('swing')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                        tradeMode === 'swing'
                          ? 'bg-amber-400 text-slate-950 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-slate-950" />
                      <span>⚡ Swing Trade</span>
                    </button>
                  </div>
                </div>

                {/* PILIHAN: SUDAH PUNYA BARANG ATAU BELUM? */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    Status Kepemilikan Saham Ini:
                  </label>
                  <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setHasPosition(false)}
                      className={`py-2 rounded-md transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                        !hasPosition
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <span>Belum Punya (Entry Baru)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasPosition(true)}
                      className={`py-2 rounded-md transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                        hasPosition
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Sudah Punya (Avg Down)</span>
                    </button>
                  </div>
                </div>

                {/* KONDISI 1: BELUM PUNYA BARANG (STRATEGI ENTRY DARI BUDGET) */}
                {!hasPosition && (
                  <div className="space-y-3.5">
                    {/* Input Budget Modal */}
                    <div className="space-y-2 text-xs">
                      <label className="font-semibold text-slate-700 block">
                        Berapa Budget / Modal Anda untuk {stock?.ticker}? (IDR):
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">Rp</span>
                        <input
                          type="text"
                          value={budgetInput}
                          onChange={(e) => setBudgetInput(formatThousand(e.target.value))}
                          placeholder="Contoh: 10.000.000"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-3 py-1.5 text-slate-900 font-bold font-mono outline-none focus:border-slate-500 text-sm"
                        />
                      </div>

                      {/* Quick Chips & Kolaborasi Dividen */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                        <div className="flex flex-wrap gap-1.5">
                          {[5000000, 10000000, 25000000, 50000000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setBudgetInput(formatThousand(amt))}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] cursor-pointer"
                            >
                              Rp {amt / 1000000} Juta
                            </button>
                          ))}
                        </div>

                        {stock?.dividend?.annualRate && stock?.price && parseThousand(budgetInput) > 0 && (
                          <span className="text-[10px] text-emerald-800 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            💰 Potensi Dividen: ~{formatRupiah((parseThousand(budgetInput) / (stock.price * 100)) * (stock.dividend.annualRate * 100))}/thn
                          </span>
                        )}
                      </div>
                    </div>

                    {strategyResult && (
                      <div className="space-y-3.5 text-xs">
                        {/* Saran All-In vs Cicil */}
                        <div className={`p-3 rounded-xl border space-y-1 ${
                          strategyResult.valuationLevel === 'cheap'
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                            : strategyResult.valuationLevel === 'expensive'
                            ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                            : 'bg-amber-50/50 border-amber-200 text-amber-900'
                        }`}>
                          <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider">
                            {strategyResult.valuationLevel === 'cheap' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : strategyResult.valuationLevel === 'expensive' ? (
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            ) : (
                              <Info className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span>Saran Money Management:</span>
                          </div>
                          <p className="leading-relaxed text-[11px]">
                            {strategyResult.rationale}
                          </p>
                        </div>

                        {/* Selector Strategi */}
                        <div className="space-y-2">
                          <span className="font-bold text-slate-800 text-[11px] block">Pilih Rencana Eksekusi Lot:</span>
                          <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-lg text-xs font-semibold text-center">
                            <button
                              type="button"
                              onClick={() => setStrategyMode('pyramid')}
                              className={`py-1.5 px-1 rounded-md transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                strategyMode === 'pyramid'
                                  ? 'bg-white text-indigo-700 shadow-sm font-bold'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              <span>Piramida</span>
                              {strategyResult.valuationLevel === 'cheap' && (
                                <span className="text-[9px] font-normal px-1 rounded bg-emerald-100 text-emerald-800">
                                  Disarankan
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStrategyMode('dca')}
                              className={`py-1.5 px-1 rounded-md transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                strategyMode === 'dca'
                                  ? 'bg-white text-indigo-700 shadow-sm font-bold'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              <span>Cicil DCA</span>
                              {strategyResult.valuationLevel !== 'cheap' && (
                                <span className="text-[9px] font-normal px-1 rounded bg-amber-100 text-amber-800">
                                  Disarankan
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStrategyMode('lumpsum')}
                              className={`py-1.5 px-1 rounded-md transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                strategyMode === 'lumpsum'
                                  ? 'bg-white text-indigo-700 shadow-sm font-bold'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              <span>All-In</span>
                            </button>
                          </div>

                          {/* Detail Eksekusi Piramida */}
                          {strategyMode === 'pyramid' && (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                              <div className="space-y-1.5">
                                <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                  <div>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 mr-1.5">Tahap 1 (40%)</span>
                                    <span className="font-semibold text-slate-800">Sekarang @ {formatRupiah(strategyResult.pyramid.t1.price)}</span>
                                  </div>
                                  <span className="font-bold font-mono text-emerald-700">{strategyResult.pyramid.t1.lots} Lot</span>
                                </div>

                                <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                  <div>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 mr-1.5">Tahap 2 (30%)</span>
                                    <span className="font-semibold text-slate-800">Antre @ {formatRupiah(strategyResult.pyramid.t2.price)}</span>
                                  </div>
                                  <span className="font-bold font-mono text-slate-800">{strategyResult.pyramid.t2.lots} Lot</span>
                                </div>

                                <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                  <div>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 mr-1.5">Tahap 3 (30%)</span>
                                    <span className="font-semibold text-slate-800">Cadangan @ {formatRupiah(strategyResult.pyramid.t3.price)}</span>
                                  </div>
                                  <span className="font-bold font-mono text-slate-800">{strategyResult.pyramid.t3.lots} Lot</span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <span className="text-slate-500 block">Total Lot:</span>
                                  <span className="font-bold text-slate-900 font-mono text-xs">{strategyResult.pyramid.totalLots} Lot</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Estimasi Avg:</span>
                                  <span className="font-bold text-emerald-700 font-mono text-xs">~{formatRupiah(strategyResult.pyramid.blendedAvg)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Total Modal:</span>
                                  <span className="font-bold text-slate-900 font-mono text-xs">{formatRupiah(strategyResult.pyramid.totalCost)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Sisa Tunai (Buffer):</span>
                                  <span className="font-bold text-slate-600 font-mono text-xs">{formatRupiah(strategyResult.pyramid.remainingCash)}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Detail DCA */}
                          {strategyMode === 'dca' && (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-600">Alokasi per Pembelian:</span>
                                  <span className="font-bold font-mono text-indigo-700">{strategyResult.dca.lotsPerStage} Lot / tahap</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-600">Budget per Periode:</span>
                                  <span className="font-bold font-mono text-slate-800">{formatRupiah(strategyResult.dca.costPerStage)}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-100 pt-1">
                                  <span className="text-slate-600">Total Lot (3 Periode):</span>
                                  <span className="font-extrabold font-mono text-slate-900">{strategyResult.dca.totalLots} Lot (~{formatRupiah(strategyResult.dca.totalCost)})</span>
                                </div>
                              </div>

                              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-950 space-y-1">
                                <span className="font-bold flex items-center gap-1 text-amber-900">
                                  <Info className="w-3.5 h-3.5 text-amber-600" />
                                  Apa itu Strategi DCA?
                                </span>
                                <p className="leading-relaxed text-slate-600 text-[11px]">
                                  <strong>DCA (Dollar-Cost Averaging)</strong> adalah strategi membagi budget modal Anda secara merata ke dalam beberapa periode waktu (misal: tiap bulan / tanggal gajian) tanpa memusingkan naik-turun harga harian.
                                </p>
                                <p className="leading-relaxed text-slate-600 text-[11px]">
                                  <strong>Keuntungan:</strong> Menghilangkan stres salah timing. Jika besok harga turun Anda mendapat lot lebih murah, jika besok harga naik Anda sudah punya barang yang floating profit.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Detail All-In */}
                          {strategyMode === 'lumpsum' && (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-600">Langsung Beli Hari Ini:</span>
                                  <span className="font-extrabold font-mono text-indigo-700 text-sm">{strategyResult.lumpSum.lots} Lot</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-600">Total Dana Terpakai:</span>
                                  <span className="font-bold font-mono text-slate-900">{formatRupiah(strategyResult.lumpSum.cost)}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-100 pt-1">
                                  <span className="text-slate-600">Sisa Uang Tunai:</span>
                                  <span className="font-bold font-mono text-slate-600">{formatRupiah(strategyResult.lumpSum.remainingCash)}</span>
                                </div>
                              </div>

                              {strategyResult.lumpSum.isRisky && (
                                <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 leading-relaxed">
                                  ⚠️ Saham tidak sedang diskon besar. All-in berisiko tinggi jika besok harga saham pullback.
                                </p>
                              )}
                            </div>
                          )}
                          {/* FITUR 2: TARGET PROFIT & STOP LOSS (RISK MANAGEMENT) */}
                          {strategyResult.takeProfit && (() => {
                            // Hitung total lot yang direncanakan dibeli berdasarkan mode eksekusi yang sedang aktif:
                            const plannedLots =
                              strategyMode === 'pyramid'
                                ? strategyResult.pyramid.totalLots
                                : strategyMode === 'dca'
                                ? strategyResult.dca.totalLots
                                : strategyResult.lumpSum.lots;

                            const entryPrice =
                              strategyMode === 'pyramid'
                                ? strategyResult.pyramid.blendedAvg
                                : stock?.price || 0;

                            const isSwing = tradeMode === 'swing' && !!strategyResult.swingTrade;
                            const tp1Price = isSwing ? strategyResult.swingTrade!.tp1.targetPrice : strategyResult.takeProfit.tp1.targetPrice;
                            const tp2Price = isSwing ? strategyResult.swingTrade!.tp2.targetPrice : strategyResult.takeProfit.tp2.targetPrice;
                            const slPrice = isSwing
                              ? strategyResult.swingTrade!.sl.slPrice
                              : (strategyResult.stopLoss?.slPrice || Math.round(entryPrice * 0.92));

                            const tp1GainPct = isSwing ? strategyResult.swingTrade!.tp1.gainPercent : strategyResult.takeProfit.tp1.gainPercent;
                            const tp2GainPct = isSwing ? strategyResult.swingTrade!.tp2.gainPercent : strategyResult.takeProfit.tp2.gainPercent;
                            const slLossPct = isSwing ? strategyResult.swingTrade!.sl.lossPercent : (strategyResult.stopLoss?.lossPercent || 8);

                            // Porsi jual bertahap: TP1 jual 50%, TP2 jual 50%
                            const halfLots = Math.max(1, Math.floor(plannedLots * 0.5));
                            const tp1Profit = (tp1Price - entryPrice) * (halfLots * 100);
                            const tp2Profit = (tp2Price - entryPrice) * ((plannedLots - halfLots) * 100);
                            const slLoss = Math.abs(entryPrice - slPrice) * (plannedLots * 100);

                            return (
                              <div className={`p-3.5 rounded-xl border space-y-2.5 text-xs transition-colors ${
                                isSwing ? 'bg-amber-50/40 border-amber-300' : 'bg-indigo-50/50 border-indigo-200'
                              }`}>
                                <div className={`flex items-center justify-between pb-1.5 border-b ${
                                  isSwing ? 'border-amber-200' : 'border-indigo-200/60'
                                }`}>
                                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                                    {isSwing ? (
                                      <>
                                        <Zap className="w-3.5 h-3.5 text-amber-600" />
                                        <span className="text-amber-950">Rencana Exit Swing (RR {strategyResult.swingTrade?.rrRatio}):</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                        <span className="text-indigo-950">Rencana Jual & Stop Loss:</span>
                                      </>
                                    )}
                                  </div>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                    isSwing ? 'text-amber-800 bg-amber-100' : 'text-indigo-700 bg-indigo-100'
                                  }`}>
                                    Basis: {plannedLots} Lot {strategyMode === 'pyramid' ? '(Avg ~' + formatRupiah(entryPrice) + ')' : ''}
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {/* TP 1 */}
                                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between shadow-xs">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        <strong className="text-slate-800 text-xs">
                                          {isSwing ? 'TP 1 (Area Resistance):' : 'TP 1:'} {formatRupiah(tp1Price)}
                                        </strong>
                                        <span className="text-[10px] font-bold text-emerald-700 font-mono">
                                          (+{tp1GainPct}%)
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        {isSwing
                                          ? `Amankan profit 50% (${halfLots} lot) saat sentuh resistance terdekat`
                                          : `Jual 50% (${halfLots} lot) saat harga kembali wajar`}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] text-slate-400 block">Estimasi Cuan:</span>
                                      <span className="font-bold font-mono text-emerald-700 text-xs">
                                        +{formatRupiah(tp1Profit)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* TP 2 */}
                                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between shadow-xs">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${isSwing ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
                                        <strong className="text-slate-800 text-xs">
                                          {isSwing ? 'TP 2 (Breakout Rally):' : 'TP 2:'} {formatRupiah(tp2Price)}
                                        </strong>
                                        <span className={`text-[10px] font-bold font-mono ${isSwing ? 'text-amber-700' : 'text-indigo-700'}`}>
                                          (+{tp2GainPct}%)
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        {isSwing
                                          ? `Trailing sisa 50% (${plannedLots - halfLots} lot) jika breakout lanjut`
                                          : `Jual sisa 50% (${plannedLots - halfLots} lot) saat euforia (+1 SD)`}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] text-slate-400 block">Estimasi Cuan:</span>
                                      <span className={`font-bold font-mono text-xs ${isSwing ? 'text-amber-700' : 'text-indigo-700'}`}>
                                        +{formatRupiah(tp2Profit)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* STOP LOSS (SL) */}
                                  <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                        <strong className="text-slate-900 text-xs">
                                          {isSwing ? 'Stop Loss Ketat (SL):' : 'Stop Loss (SL):'} {formatRupiah(slPrice)}
                                        </strong>
                                        <span className="text-[10px] font-bold text-rose-700 font-mono">
                                          (-{slLossPct}%)
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500">
                                        {isSwing
                                          ? 'Cut loss disiplin jika breakdown support teknikal 20D'
                                          : 'Cut loss disiplin jika breakdown support / fundamental drop'}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] text-rose-500 block">Batas Risiko:</span>
                                      <span className="font-bold font-mono text-rose-700 text-xs">
                                        -{formatRupiah(slLoss)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* KONDISI 2: SUDAH PUNYA BARANG (STRATEGI AVERAGE DOWN & PENYELAMATAN NYANGKUT) */}
                {hasPosition && (
                  <div className="space-y-3.5">
                    {/* Input Kepemilikan Saat Ini */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <span className="font-bold text-slate-800 text-[11px] block uppercase tracking-wide">
                        Portofolio Anda Saat Ini:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-600 block mb-1 font-medium">Lot Dimiliki:</label>
                          <input
                            type="text"
                            value={currentLotsInput}
                            onChange={(e) => setCurrentLotsInput(formatThousand(e.target.value))}
                            placeholder="Contoh: 50"
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-bold font-mono outline-none focus:border-slate-500"
                          />
                        </div>
                        <div>
                          <label className="text-slate-600 block mb-1 font-medium">Harga Avg Anda (Rp):</label>
                          <input
                            type="text"
                            value={currentAvgPriceInput}
                            onChange={(e) => setCurrentAvgPriceInput(formatThousand(e.target.value))}
                            placeholder="Contoh: 5.500"
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-bold font-mono outline-none focus:border-slate-500"
                          />
                        </div>
                      </div>

                      {/* Info Floating PnL / Posisi */}
                      {(() => {
                        const curPrice = stock?.price || 0;
                        const myAvg = parseThousand(currentAvgPriceInput);
                        const myLots = parseThousand(currentLotsInput);
                        if (curPrice > 0 && myAvg > 0 && myLots > 0) {
                          const floatingPct = ((curPrice - myAvg) / myAvg) * 100;
                          const isLoss = floatingPct < 0;
                          return (
                            <div className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                              isLoss ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}>
                              <span>Status Floating:</span>
                              <span className="font-bold font-mono">
                                {isLoss ? 'Nyangkut / Minus' : 'Profit'} {floatingPct.toFixed(1)}% ({formatRupiah(curPrice - myAvg)} / lbr)
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Rekomendasi Taktik & Strategi Avg Down Konkret */}
                    {evalResult && (() => {
                      const curPrice = stock?.price || 0;
                      const myAvg = parseThousand(currentAvgPriceInput);
                      const myLots = parseThousand(currentLotsInput);
                      const isMinus = myAvg > 0 && curPrice < myAvg;
                      const minusPct = myAvg > 0 ? ((myAvg - curPrice) / myAvg) * 100 : 0;

                      return (
                        <div className="space-y-2.5">
                          {/* Card Rekomendasi Aksi */}
                          <div className={`p-3 rounded-xl border space-y-2 text-xs ${
                            evalResult.level === 'cheap'
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                              : evalResult.level === 'expensive'
                              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                              : 'bg-amber-50/70 border-amber-200 text-amber-950'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                {evalResult.level === 'cheap' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : evalResult.level === 'expensive' ? (
                                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                ) : (
                                  <Info className="w-3.5 h-3.5 text-amber-600" />
                                )}
                                Rekomendasi Tindakan:
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                evalResult.level === 'cheap'
                                  ? 'bg-emerald-200/60 text-emerald-800'
                                  : evalResult.level === 'expensive'
                                  ? 'bg-rose-200/60 text-rose-800'
                                  : 'bg-amber-200/60 text-amber-800'
                              }`}>
                                {evalResult.level === 'cheap' ? '🟢 SANGAT LAYAK AVG DOWN' : evalResult.level === 'expensive' ? '🔴 JANGAN AVG DOWN SEKARANG' : '🟡 CICIL HATI-HATI'}
                              </span>
                            </div>

                            <p className="leading-relaxed text-[11px]">
                              {evalResult.level === 'cheap'
                                ? `Saham ${stock?.ticker} sedang terdiskon (${evalResult.marginOfSafety?.toFixed(1)}% di bawah harga wajar). Valuasi murah memberikan bantalan margin of safety tinggi.`
                                : evalResult.level === 'expensive'
                                ? `Saham ${stock?.ticker} masih di atas harga wajar historisnya. Avg down saat valuasi mahal berisiko "menangkap pisau jatuh" jika harga terus terkoreksi.`
                                : `Saham ${stock?.ticker} berada di sekitar harga wajar historisnya. Hindari all-in avg down, prioritaskan cicil terukur.`}
                            </p>

                            {/* Taktik Eksekusi Konkret */}
                            <div className="pt-2 border-t border-slate-200/60 space-y-1.5 text-[11px]">
                              <span className="font-bold block text-slate-800">Panduan Eksekusi:</span>
                              {evalResult.level === 'cheap' ? (
                                <ul className="space-y-1 list-disc list-inside text-slate-700">
                                  <li><strong>Golden Window:</strong> Manfaatkan diskon ini dengan menyerap setidaknya <strong>1x s/d 1.5x dari lot lama</strong> ({myLots > 0 ? `+${myLots} s/d +${Math.round(myLots * 1.5)} Lot` : '+lot seimbang'}) agar avg langsung terpangkas signifikan mendekati harga pasar.</li>
                                  <li>Jika modal terbatas, gunakan <strong>Piramida Beli</strong>: 50% beli sekarang @ {formatRupiah(curPrice)}, 50% cadangkan jika bandar masih menekan ke bawah.</li>
                                </ul>
                              ) : evalResult.level === 'expensive' ? (
                                <ul className="space-y-1 list-disc list-inside text-slate-700">
                                  <li><strong>Wait & See:</strong> Simpan peluru tunai Anda. Tunggu harga saham terkoreksi mendekati harga wajar ({formatRupiah(evalResult.fairPrice)}) sebelum menambah muatan.</li>
                                  <li>Jika floating loss melebihi toleransi risiko (-10% ke atas) dan prospek kinerja memburuk, pertimbangkan <strong>Cut Loss parsial</strong> daripada memaksakan avg down.</li>
                                </ul>
                              ) : (
                                <ul className="space-y-1 list-disc list-inside text-slate-700">
                                  <li>Beli bertahap dengan porsi kecil (20%-30% dari kapasitas modal).</li>
                                  <li>Jangan avg down tiap turun 1-2%. Terapkan aturan <strong>minimum jarak koreksi -7% s/d -10%</strong> antar pembelian agar tidak cepat kehabisan peluru.</li>
                                </ul>
                              )}
                            </div>
                          </div>

                          {/* Rule of Thumb Box */}
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                            <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-slate-800">Prinsip Emas Avg Down:</strong> Hanya lakukan avg down pada saham berfundamental sehat & valuasi murah. Jangan pernah avg down saham gorengan atau emiten yang labanya terus anjlok.
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Mode Avg Down: Target Avg vs Beli Lot */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setAvgDownTab('target')}
                          className={`py-1.5 rounded-md transition text-center cursor-pointer ${
                            avgDownTab === 'target'
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          1. Target Harga Avg
                        </button>
                        <button
                          type="button"
                          onClick={() => setAvgDownTab('simulate')}
                          className={`py-1.5 rounded-md transition text-center cursor-pointer ${
                            avgDownTab === 'simulate'
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          2. Simulasi Tambah Lot
                        </button>
                      </div>

                      {/* SUB-MODE 1: TARGET AVG */}
                      {avgDownTab === 'target' && (
                        <div className="space-y-3 text-xs">
                          <div>
                            <div className="flex justify-between items-baseline mb-1">
                              <label className="font-semibold text-slate-700">Mau Harga Avg Turun Jadi Berapa? (Rp):</label>
                              <span className="text-[11px] text-slate-400">Harga Pasar: {formatRupiah(stock?.price)}</span>
                            </div>
                            <input
                              type="text"
                              value={targetAvgPriceInput}
                              onChange={(e) => setTargetAvgPriceInput(formatThousand(e.target.value))}
                              placeholder="Contoh: 5.100"
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-bold font-mono outline-none focus:border-slate-500"
                            />
                          </div>

                          {avgDownResult && avgDownResult.possible ? (
                            <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2">
                              <div className="text-[11px] text-indigo-900 font-semibold uppercase tracking-wide">
                                Kebutuhan Dana & Lot:
                              </div>
                              <div className="flex justify-between items-baseline border-b border-indigo-200/60 pb-1.5">
                                <span className="text-slate-600">Perlu Beli Tambahan:</span>
                                <span className="text-sm font-extrabold text-indigo-700 font-mono">
                                  +{avgDownResult.additionalLotsNeeded.toLocaleString('id-ID')} Lot
                                </span>
                              </div>
                              <div className="flex justify-between items-baseline border-b border-indigo-200/60 pb-1.5">
                                <span className="text-slate-600">Modal Tambahan Diperlukan:</span>
                                <span className="text-sm font-extrabold text-slate-900 font-mono">
                                  {formatRupiah(avgDownResult.capitalNeeded)}
                                </span>
                              </div>
                              <div className="flex justify-between items-baseline pt-0.5 text-[11px]">
                                <span className="text-slate-600">Total Lot Nanti:</span>
                                <span className="font-bold text-slate-800 font-mono">
                                  {avgDownResult.newTotalLots.toLocaleString('id-ID')} Lot (~{formatRupiah(avgDownResult.actualNewAvg)})
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-relaxed">
                              {avgDownResult?.message || 'Masukkan target avg yang valid.'}
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUB-MODE 2: SIMULASI BELI LOT */}
                      {avgDownTab === 'simulate' && (
                        <div className="space-y-3 text-xs">
                          <div>
                            <div className="flex justify-between items-baseline mb-1">
                              <label className="font-semibold text-slate-700">Jika Beli Tambahan Sebanyak (Lot):</label>
                              <span className="text-[11px] text-slate-400">@ {formatRupiah(stock?.price)}</span>
                            </div>
                            <input
                              type="text"
                              value={simBuyLotsInput}
                              onChange={(e) => setSimBuyLotsInput(formatThousand(e.target.value))}
                              placeholder="Contoh: 25"
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-bold font-mono outline-none focus:border-slate-500"
                            />

                            {/* Preset Quick Chips */}
                            <div className="flex gap-1.5 mt-1.5">
                              {[10, 25, 50, 100].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setSimBuyLotsInput(formatThousand(amt))}
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[10px] cursor-pointer"
                                >
                                  +{amt} Lot
                                </button>
                              ))}
                            </div>
                          </div>

                          {simAvgResult ? (
                            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                              <div className="text-[11px] text-emerald-900 font-semibold uppercase tracking-wide">
                                Hasil Simulasi Avg Baru:
                              </div>
                              <div className="flex justify-between items-baseline border-b border-emerald-200/60 pb-1.5">
                                <span className="text-slate-600">Modal Diperlukan:</span>
                                <span className="font-bold text-slate-900 font-mono">
                                  {formatRupiah(simAvgResult.newBuyCost)}
                                </span>
                              </div>
                              <div className="flex justify-between items-baseline border-b border-emerald-200/60 pb-1.5">
                                <span className="text-slate-600">Total Kepemilikan:</span>
                                <span className="font-bold text-slate-800 font-mono">
                                  {simAvgResult.combinedTotalLots.toLocaleString('id-ID')} Lot
                                </span>
                              </div>
                              <div className="flex justify-between items-baseline pt-0.5">
                                <div>
                                  <span className="text-slate-700 font-bold block">Avg Baru:</span>
                                  <span className="text-[10px] text-emerald-700 font-medium">
                                    Turun Rp {simAvgResult.avgReduction.toLocaleString('id-ID')} ({simAvgResult.reductionPercent.toFixed(1)}%)
                                  </span>
                                </div>
                                <span className="text-base font-black text-emerald-700 font-mono">
                                  {formatRupiah(simAvgResult.resultingAvgPrice)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-slate-50 text-slate-500 text-[11px]">
                              Masukkan jumlah lot tambahan untuk melihat simulasi.
                            </div>
                          )}
                        </div>
                      )}
                      {/* SUB-MODE 2: SIMULASI BELI LOT SELESAI */}

                      {/* KOLABORASI: TARGET PROFIT & STOP LOSS UNTUK PORTOFOLIO YANG SEDANG DIMILIKI */}
                      {(() => {
                        const myAvg = parseThousand(currentAvgPriceInput);
                        const myLots = parseThousand(currentLotsInput);
                        const curPrice = stock?.price || 0;
                        if (myAvg <= 0 || myLots <= 0 || curPrice <= 0 || !strategyResult?.takeProfit) return null;

                        const isSwing = tradeMode === 'swing' && !!strategyResult.swingTrade;
                        const tp1Price = isSwing ? strategyResult.swingTrade!.tp1.targetPrice : strategyResult.takeProfit.tp1.targetPrice;
                        const tp2Price = isSwing ? strategyResult.swingTrade!.tp2.targetPrice : strategyResult.takeProfit.tp2.targetPrice;
                        // SL untuk posisi pegangan: support teknikal / batas cut loss jika ambrol lebih dalam
                        const slPrice = isSwing ? strategyResult.swingTrade!.sl.slPrice : Math.round(curPrice * 0.92);

                        const halfLots = Math.max(1, Math.floor(myLots * 0.5));
                        // PnL dihitung dari Avg modal nyangkut riil
                        const tp1GainTotal = (tp1Price - myAvg) * (halfLots * 100);
                        const tp2GainTotal = (tp2Price - myAvg) * ((myLots - halfLots) * 100);
                        const slLossTotal = (myAvg - slPrice) * (myLots * 100);

                        const tp1PctFromAvg = ((tp1Price - myAvg) / myAvg) * 100;
                        const tp2PctFromAvg = ((tp2Price - myAvg) / myAvg) * 100;
                        const slPctFromAvg = ((slPrice - myAvg) / myAvg) * 100;

                        return (
                          <div className={`pt-3 border-t border-slate-200 space-y-2.5`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                                {isSwing ? (
                                  <>
                                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="text-amber-950">Rencana Exit Swing (RR {strategyResult.swingTrade?.rrRatio}):</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                    <span className="text-indigo-950">Rencana Exit (TP & SL) dari Avg Anda:</span>
                                  </>
                                )}
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                isSwing ? 'text-amber-800 bg-amber-100' : 'text-indigo-700 bg-indigo-100'
                              }`}>
                                Basis: {myLots} Lot @ {formatRupiah(myAvg)}
                              </span>
                            </div>

                            <div className="space-y-2">
                              {/* TP 1 */}
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between shadow-xs">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <strong className="text-slate-800 text-xs">
                                      {isSwing ? 'TP 1 (Area Resistance):' : 'TP 1:'} {formatRupiah(tp1Price)}
                                    </strong>
                                    <span className={`text-[10px] font-bold font-mono ${tp1PctFromAvg >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                      ({tp1PctFromAvg >= 0 ? '+' : ''}{tp1PctFromAvg.toFixed(1)}% dari Avg)
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    {isSwing
                                      ? `Jual 50% (${halfLots} lot) saat mendekati resistance`
                                      : `Jual 50% (${halfLots} lot) saat harga wajar tercapai`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block">Hasil di Portofolio:</span>
                                  <span className={`font-bold font-mono text-xs ${tp1GainTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {tp1GainTotal >= 0 ? '+' : ''}{formatRupiah(tp1GainTotal)}
                                  </span>
                                </div>
                              </div>

                              {/* TP 2 */}
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between shadow-xs">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${isSwing ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
                                    <strong className="text-slate-800 text-xs">
                                      {isSwing ? 'TP 2 (Breakout Rally):' : 'TP 2:'} {formatRupiah(tp2Price)}
                                    </strong>
                                    <span className={`text-[10px] font-bold font-mono ${tp2PctFromAvg >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                                      ({tp2PctFromAvg >= 0 ? '+' : ''}{tp2PctFromAvg.toFixed(1)}% dari Avg)
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    {isSwing
                                      ? `Trailing profit sisa 50% (${myLots - halfLots} lot) jika momentum breakout berlanjut`
                                      : `Lepas sisa 50% (${myLots - halfLots} lot) saat euforia pasar (+1 SD)`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block">Hasil di Portofolio:</span>
                                  <span className={`font-bold font-mono text-xs ${tp2GainTotal >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                                    {tp2GainTotal >= 0 ? '+' : ''}{formatRupiah(tp2GainTotal)}
                                  </span>
                                </div>
                              </div>

                              {/* STOP LOSS */}
                              <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                    <strong className="text-slate-900 text-xs">
                                      {isSwing ? 'Batas Cut Loss Ketat (SL):' : 'Batas Cut Loss (SL):'} {formatRupiah(slPrice)}
                                    </strong>
                                    <span className="text-[10px] font-bold text-rose-700 font-mono">
                                      ({slPctFromAvg.toFixed(1)}% dari Avg)
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    {isSwing
                                      ? 'Disiplin cut loss jika breakdown support teknikal 20D'
                                      : 'Batas risiko toleransi jika penurunan berlanjut di bawah support pasar'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-rose-500 block">Maksimal Risiko:</span>
                                  <span className="font-bold font-mono text-rose-700 text-xs">
                                    -{formatRupiah(Math.abs(slLossTotal))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PANEL KANAN 2: RANKING SAHAM UNDERVALUED DENGAN FILTER CUSTOM MARKET CAP */}
            {rightPanelTab === 'ranking' && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${
                      tradeMode === 'swing'
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      {tradeMode === 'swing' ? <Zap className="w-4 h-4 text-amber-900" /> : <Award className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {tradeMode === 'swing' ? 'Rank Saham Potensi Cuan Cepat (Swing)' : 'Rank Saham Undervalued'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {tradeMode === 'swing' ? 'Disortir berdasarkan Momentum & Ruang Cuan ke Resistance' : `Filter Market Cap: > ${activeMinCapDisplay}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchScreener()}
                    disabled={screenerLoading}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                    title="Refresh data ranking"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${screenerLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* INPUT CUSTOM FILTER MARKET CAP */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-slate-700 block">
                      Minimal Market Cap (Triliun Rp):
                    </label>
                    <span className="text-[10px] text-slate-400">Filter Anti-Gorengan</span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      fetchScreener();
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 font-mono font-bold text-slate-400 text-xs">Rp</span>
                      <input
                        type="text"
                        value={screenerMinCapInput}
                        onChange={(e) => setScreenerMinCapInput(e.target.value)}
                        placeholder="Contoh: 1 (atau 5, 10, 50)"
                        className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-8 py-1.5 text-slate-900 font-bold font-mono outline-none focus:border-slate-500 text-xs"
                      />
                      <span className="absolute right-3 top-2 font-bold text-slate-400 text-xs">T</span>
                    </div>

                    <button
                      type="submit"
                      disabled={screenerLoading}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>Terapkan</span>
                    </button>
                  </form>

                  {/* Quick Chip Presets untuk Market Cap */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400">Pilihan Cepat:</span>
                    {[0.5, 1, 5, 10, 50].map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => {
                          setScreenerMinCapInput(cap.toString());
                          fetchScreener(cap);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                          screenerMinCapInput === cap.toString()
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold'
                            : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                      >
                        &gt; {cap}T
                      </button>
                    ))}
                  </div>
                </div>

                {/* FILTER FRAKSI HARGA SAHAM: 1 - 100, 100 - 1.000, > 1.000 */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-slate-700 block">
                      Filter Rentang Harga Saham (Per Lembar):
                    </label>
                    <span className="text-[10px] text-slate-400">Fraksi Harga</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 p-1 bg-white rounded-lg border border-slate-200 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setPriceFilter('all')}
                      className={`py-1 rounded-md transition text-center cursor-pointer ${
                        priceFilter === 'all'
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceFilter('under100')}
                      className={`py-1 rounded-md transition text-center cursor-pointer ${
                        priceFilter === 'under100'
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1 - 100
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceFilter('100to1000')}
                      className={`py-1 rounded-md transition text-center cursor-pointer ${
                        priceFilter === '100to1000'
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      100 - 1k
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceFilter('above1000')}
                      className={`py-1 rounded-md transition text-center cursor-pointer ${
                        priceFilter === 'above1000'
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      &gt; 1k
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {tradeMode === 'swing' ? (
                      <>
                        ⚡ <strong>Mode Swing Trade Aktif:</strong> Memprioritaskan saham dengan <strong>Volume Breakout</strong>, <strong>Pantulan Oversold (RSI)</strong>, dan ruang kenaikan tercepat ke Resistance.
                      </>
                    ) : (
                      <>
                        🌿 <strong>Mode Investasi Aktif:</strong> Diurutkan dari yang memiliki diskon valuasi fundamental (Margin of Safety) tertinggi.
                      </>
                    )}
                  </span>
                </div>

                {screenerLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                    <span>{tradeMode === 'swing' ? 'Memindai momentum & sinyal swing cepat...' : 'Memindai valuasi saham liquid IDX...'}</span>
                  </div>
                ) : (() => {
                  const filteredStocks = screenerList.filter((item) => {
                    if (priceFilter === 'under100') return item.price >= 1 && item.price <= 100;
                    if (priceFilter === '100to1000') return item.price > 100 && item.price <= 1000;
                    if (priceFilter === 'above1000') return item.price > 1000;
                    return true;
                  });

                  if (filteredStocks.length === 0) {
                    return (
                      <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                        <p className="font-semibold text-slate-600">Tidak ada saham dalam rentang harga ini</p>
                        <p className="text-[11px]">Coba ganti filter rentang harga atau kurangi batas minimal Market Cap.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                      {filteredStocks.map((item, idx) => (
                      <div
                        key={item.ticker}
                        onClick={() => {
                          setTickerInput(item.ticker);
                          fetchStock(item.ticker);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          stock?.ticker === item.ticker
                            ? tradeMode === 'swing'
                              ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-200'
                              : 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold font-mono ${
                              tradeMode === 'swing'
                                ? 'bg-amber-100 border-amber-300 text-amber-900'
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}>
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-xs text-slate-900 font-mono">{item.ticker}</span>
                            {tradeMode === 'swing' && item.swingSignal && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${item.swingSignalBadge}`}>
                                {item.swingSignal}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 truncate max-w-[110px]">{item.name}</span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            {tradeMode === 'swing' ? (
                              <>
                                <span>RSI: <strong className={item.rsi && item.rsi <= 35 ? 'text-emerald-700 font-bold' : item.rsi && item.rsi >= 70 ? 'text-rose-700 font-bold' : 'text-slate-700'}>{item.rsi || '-'}</strong></span>
                                <span>•</span>
                                <span>Vol: <strong className={item.volSpike && item.volSpike >= 1.5 ? 'text-indigo-700 font-bold' : 'text-slate-700'}>{item.volSpike ? `${item.volSpike}x` : '1x'}</strong></span>
                                <span>•</span>
                                <span>Tren: <strong className="text-slate-700">{item.trend === 'uptrend' ? '📈 Naik' : item.trend === 'downtrend' ? '📉 Turun' : '➡️ Sideways'}</strong></span>
                              </>
                            ) : (
                              <>
                                <span>M.Cap: <strong className="text-slate-700">{item.marketCapFormatted}</strong></span>
                                <span>•</span>
                                <span>PER: <strong className="text-slate-700">{item.per ? `${item.per}x` : '-'}</strong></span>
                                {item.dividendYield && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-700 font-semibold">Yield {item.dividendYield}%</span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-xs text-slate-900 font-mono block">
                            {formatRupiah(item.price)}
                          </span>
                          {tradeMode === 'swing' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                              Upside +{item.swingPotential}%
                            </span>
                          ) : (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                              item.marginOfSafety >= 15
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.marginOfSafety <= -15
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              MoS {item.marginOfSafety >= 0 ? '+' : ''}{item.marginOfSafety}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            )}

            {/* PANEL KANAN 3: WATCHLIST HARIAN (SAHAM MENARIK HARI INI) */}
            {rightPanelTab === 'daily' && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${
                      tradeMode === 'swing'
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-rose-50 border-rose-200 text-rose-600'
                    }`}>
                      {tradeMode === 'swing' ? <Zap className="w-4 h-4 text-amber-900" /> : <Flame className="w-4 h-4 text-rose-600" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {tradeMode === 'swing' ? 'Watchlist Swing Trade (Pilihan Cepat Cuan)' : 'Watchlist Harian (Pilihan Hari Ini)'}
                      </h3>
                      <p className="text-xs text-slate-500">{dailyDateFormatted || 'Update Realtime Hari Ini'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchDailyWatchlist()}
                    disabled={dailyLoading}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                    title="Refresh rekomendasi hari ini"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${dailyLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-1.5 ${
                  tradeMode === 'swing'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-rose-50/50 border-rose-200 text-rose-950'
                }`}>
                  {tradeMode === 'swing' ? (
                    <Zap className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  ) : (
                    <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>
                    {tradeMode === 'swing' ? (
                      <>
                        ⚡ <strong>Pilihan Cuan Cepat Swing Trade:</strong> Memindai saham IDX dengan <strong>Volume Breakout</strong> (lonjakan transaksi), <strong>Oversold Rebound</strong> (pantulan RSI), dan <strong>Momentum Uptrend</strong> di atas MA20.
                      </>
                    ) : (
                      <>
                        🌿 <strong>Pilihan Investasi Hari Ini:</strong> Saham IDX terkurasi otomatis berdasarkan <strong>Valuasi Diskon Tinggi (MoS)</strong>, <strong>Dividen Jumbo</strong>, dan <strong>Dekat Bottom 52 Minggu</strong>.
                      </>
                    )}
                  </span>
                </div>

                {dailyLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                    <span>{tradeMode === 'swing' ? 'Menganalisis sinyal & volume swing trade...' : 'Menganalisis emiten menarik hari ini...'}</span>
                  </div>
                ) : dailyPicks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-600">Belum ada sinyal menarik saat ini</p>
                    <p className="text-[11px]">Silakan klik tombol refresh untuk memindai pasar.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                    {dailyPicks.map((pick) => (
                      <div
                        key={pick.ticker}
                        onClick={() => {
                          setTickerInput(pick.ticker);
                          fetchStock(pick.ticker);
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                          stock?.ticker === pick.ticker
                            ? tradeMode === 'swing'
                              ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-200'
                              : 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-200'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Header Kartu: Ticker & Badge Kategori */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-sm text-slate-900">{pick.ticker}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${pick.tagColor}`}>
                                {pick.categoryLabel}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 truncate block mt-0.5">{pick.name}</span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-extrabold text-xs text-slate-900 block">
                              {formatRupiah(pick.price)}
                            </span>
                            <span className={`inline-block font-mono text-[11px] font-bold ${
                              pick.changePercent >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                              {pick.changePercent >= 0 ? '+' : ''}{pick.changePercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Alasan Kenapa Menarik */}
                        <div className="p-2 rounded-lg bg-slate-50 text-[11px] text-slate-700 leading-relaxed border border-slate-100 flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{pick.highlightReason}</span>
                        </div>

                        {/* Quick Stats: PER, PBV, MoS, Yield / Swing Indicators */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-100">
                          {tradeMode === 'swing' ? (
                            <>
                              <span>RSI: <strong className={pick.rsi && pick.rsi <= 38 ? 'text-emerald-700 font-bold' : 'text-slate-700'}>{pick.rsi || '-'}</strong></span>
                              <span>•</span>
                              <span>Vol Spike: <strong className={pick.volSpike && pick.volSpike >= 1.4 ? 'text-indigo-700 font-bold' : 'text-slate-700'}>{pick.volSpike ? `${pick.volSpike}x` : '1x'}</strong></span>
                              <span>•</span>
                              <span className="text-amber-800 font-bold">Upside Target: +{pick.swingPotential}%</span>
                            </>
                          ) : (
                            <>
                              <span>M.Cap: <strong className="text-slate-700">{pick.marketCapFormatted}</strong></span>
                              <span>•</span>
                              <span>PER: <strong className="text-slate-700">{pick.per ? `${pick.per}x` : '-'}</strong></span>
                              <span>•</span>
                              <span>PBV: <strong className="text-slate-700">{pick.pbv ? `${pick.pbv}x` : '-'}</strong></span>
                              {pick.dividendYield && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-bold">Yield {pick.dividendYield}%</span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PANEL KANAN 4: WATCHLIST SAHAM PANTAUAN (MONGODB READY) */}
            {rightPanelTab === 'watchlist' && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                      <Star className="w-4 h-4 fill-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Watchlist Saham</h3>
                      <p className="text-xs text-slate-500">
                        {watchlistStorage === 'mongodb' ? '🟢 Terhubung ke MongoDB' : '🟡 Mode Memori Lokal (Belum ada MONGODB_URI)'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={fetchWatchlist}
                    disabled={watchlistLoading}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                    title="Refresh data watchlist"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${watchlistLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    Klik kartu saham untuk langsung membuka analisa valuasinya di panel kiri. Anda bisa menambahkan saham ke Watchlist dengan menekan tombol bintang ⭐ di kartu atas.
                  </span>
                </div>

                {watchlistLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                    <span>Memuat watchlist...</span>
                  </div>
                ) : watchlist.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                    <Star className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-semibold text-slate-600">Belum ada saham di Watchlist</p>
                    <p className="text-[11px]">Buka saham apa saja lalu klik tombol <strong>"Watchlist"</strong> di atas.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {watchlist.map((item) => (
                      <div
                        key={item.ticker}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          stock?.ticker === item.ticker
                            ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div
                          onClick={() => {
                            setTickerInput(item.ticker);
                            fetchStock(item.ticker);
                          }}
                          className="space-y-1 cursor-pointer flex-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 font-mono">{item.ticker}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[170px]">{item.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            Disimpan: {formatDate(item.addedAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTickerInput(item.ticker);
                              fetchStock(item.ticker);
                            }}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
                          >
                            Buka
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleWatchlist(item.ticker, item.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Hapus dari watchlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </div>



    </div>
  );
}
