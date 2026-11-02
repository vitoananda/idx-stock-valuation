'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, Maximize2 } from 'lucide-react';

interface ChartPoint {
  date: string;
  close: number;
  volume: number;
}

interface StockPriceChartProps {
  data?: ChartPoint[];
  currentPrice: number;
  fairPrice?: number | null;
  support?: number | null;
  resistance?: number | null;
  ma20?: number | null;
  ticker: string;
}

type Timeframe = '1M' | '3M' | '6M' | '1Y';

export const StockPriceChart: React.FC<StockPriceChartProps> = ({
  data = [],
  currentPrice,
  fairPrice,
  support,
  resistance,
  ma20,
  ticker,
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('3M');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);

  // Filter quotes based on selected timeframe
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Sort ascending by date
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const countMap: Record<Timeframe, number> = {
      '1M': 22,
      '3M': 65,
      '6M': 130,
      '1Y': 260,
    };
    
    const sliceCount = countMap[timeframe] || 65;
    return sorted.slice(-sliceCount);
  }, [data, timeframe]);

  // Price calculations and stats
  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const closes = filteredData.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const firstPrice = closes[0];
    const lastPrice = closes[closes.length - 1];
    const change = lastPrice - firstPrice;
    const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;
    const isUp = change >= 0;

    return { min, max, firstPrice, lastPrice, change, changePercent, isUp };
  }, [filteredData]);

  // SVG Coordinates & Path computation
  const chartLayout = useMemo(() => {
    if (filteredData.length < 2 || !stats) return null;

    const width = 650;
    const height = 220;
    const padding = { top: 20, right: 15, bottom: 25, left: 15 };

    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    // Buffer min & max so line doesn't touch the very edges
    const range = stats.max - stats.min;
    const buffer = range === 0 ? stats.min * 0.05 : range * 0.08;
    const yMin = Math.max(0, stats.min - buffer);
    const yMax = stats.max + buffer;
    const yRange = yMax - yMin || 1;

    // Calculate (x, y) for each data point
    const points = filteredData.map((pt, i) => {
      const x = padding.left + (i / (filteredData.length - 1)) * innerWidth;
      const y = padding.top + innerHeight - ((pt.close - yMin) / yRange) * innerHeight;
      return { x, y, ...pt };
    });

    // Build SVG Path string
    const pathD = points.reduce((acc, curr, i) => {
      if (i === 0) return `M ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
      // Linear or subtle curve
      return `${acc} L ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
    }, '');

    // Area fill path closing to the bottom
    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    const bottomY = padding.top + innerHeight;
    const areaD = `${pathD} L ${lastPt.x.toFixed(1)},${bottomY} L ${firstPt.x.toFixed(1)},${bottomY} Z`;

    // Helper for overlay horizontal line Y-coordinate
    const getYForPrice = (price: number) => {
      if (price < yMin || price > yMax) return null;
      return padding.top + innerHeight - ((price - yMin) / yRange) * innerHeight;
    };

    return {
      width,
      height,
      padding,
      innerWidth,
      innerHeight,
      yMin,
      yMax,
      points,
      pathD,
      areaD,
      getYForPrice,
    };
  }, [filteredData, stats]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm text-center">
        <p className="text-xs text-slate-500">Data grafik historis harga sedang tidak tersedia.</p>
      </div>
    );
  }

  const activeHover = hoverIndex !== null && chartLayout ? chartLayout.points[hoverIndex] : null;
  const displayPrice = activeHover ? activeHover.close : (stats?.lastPrice ?? currentPrice);
  const displayDate = activeHover ? activeHover.date : (filteredData[filteredData.length - 1]?.date ?? '');
  const isUp = stats?.isUp ?? true;
  const strokeColor = isUp ? '#10b981' : '#f43f5e'; // emerald-500 : rose-500
  const gradientId = `chart-gradient-${ticker}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
      {/* Header with Title, Price info, and Timeframe tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              Grafik Pergerakan Harga
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {timeframe}
              </span>
            </h3>
            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                showOverlays
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
              title="Tampilkan garis Support, Resistance, dan Harga Wajar pada chart"
            >
              {showOverlays ? '✓ S/R & Wajar' : '+ S/R & Wajar'}
            </button>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono">
              Rp {displayPrice.toLocaleString('id-ID')}
            </span>
            {stats && (
              <span
                className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                  stats.change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {stats.change >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {stats.change >= 0 ? '+' : ''}
                {stats.change.toLocaleString('id-ID')} ({stats.changePercent.toFixed(2)}%)
              </span>
            )}
            {activeHover ? (
              <span className="text-[11px] text-slate-400 font-medium ml-1">
                📅 {new Date(activeHover.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium ml-1">
                (Rentang {timeframe})
              </span>
            )}
          </div>
        </div>

        {/* Timeframe selector buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          {(['1M', '3M', '6M', '1Y'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => {
                setTimeframe(tf);
                setHoverIndex(null);
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                timeframe === tf
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tf === '1M' ? '1 Bulan' : tf === '3M' ? '3 Bulan' : tf === '6M' ? '6 Bulan' : '1 Tahun'}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive SVG Chart Container */}
      {chartLayout && (
        <div className="relative w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${chartLayout.width} ${chartLayout.height}`}
            className="w-full h-48 sm:h-56 block overflow-visible"
            onMouseLeave={() => setHoverIndex(null)}
            onTouchEnd={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines (Min & Max reference lines) */}
            <line
              x1={chartLayout.padding.left}
              y1={chartLayout.padding.top}
              x2={chartLayout.width - chartLayout.padding.right}
              y2={chartLayout.padding.top}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <line
              x1={chartLayout.padding.left}
              y1={chartLayout.height - chartLayout.padding.bottom}
              x2={chartLayout.width - chartLayout.padding.right}
              y2={chartLayout.height - chartLayout.padding.bottom}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
              strokeWidth="1"
            />

            {/* Technical & Valuation Overlays */}
            {showOverlays && (
              <>
                {/* Fair Price Line */}
                {fairPrice && chartLayout.getYForPrice(fairPrice) !== null && (
                  <g>
                    <line
                      x1={chartLayout.padding.left}
                      y1={chartLayout.getYForPrice(fairPrice)!}
                      x2={chartLayout.width - chartLayout.padding.right}
                      y2={chartLayout.getYForPrice(fairPrice)!}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      strokeWidth="1.2"
                    />
                    <text
                      x={chartLayout.width - chartLayout.padding.right - 2}
                      y={chartLayout.getYForPrice(fairPrice)! - 4}
                      textAnchor="end"
                      fill="#6366f1"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      Wajar: {fairPrice.toLocaleString('id-ID')}
                    </text>
                  </g>
                )}

                {/* Resistance Line */}
                {resistance && chartLayout.getYForPrice(resistance) !== null && (
                  <g>
                    <line
                      x1={chartLayout.padding.left}
                      y1={chartLayout.getYForPrice(resistance)!}
                      x2={chartLayout.width - chartLayout.padding.right}
                      y2={chartLayout.getYForPrice(resistance)!}
                      stroke="#f43f5e"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                      strokeOpacity="0.8"
                    />
                    <text
                      x={chartLayout.padding.left + 4}
                      y={chartLayout.getYForPrice(resistance)! - 4}
                      fill="#e11d48"
                      fontSize="9"
                      fontWeight="600"
                    >
                      Resist: {resistance.toLocaleString('id-ID')}
                    </text>
                  </g>
                )}

                {/* Support Line */}
                {support && chartLayout.getYForPrice(support) !== null && (
                  <g>
                    <line
                      x1={chartLayout.padding.left}
                      y1={chartLayout.getYForPrice(support)!}
                      x2={chartLayout.width - chartLayout.padding.right}
                      y2={chartLayout.getYForPrice(support)!}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                      strokeOpacity="0.8"
                    />
                    <text
                      x={chartLayout.padding.left + 4}
                      y={chartLayout.getYForPrice(support)! + 10}
                      fill="#059669"
                      fontSize="9"
                      fontWeight="600"
                    >
                      Supp: {support.toLocaleString('id-ID')}
                    </text>
                  </g>
                )}
              </>
            )}

            {/* Gradient area underneath */}
            <path d={chartLayout.areaD} fill={`url(#${gradientId})`} />

            {/* Main Price Line */}
            <path
              d={chartLayout.pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover Crosshair & Pointer */}
            {activeHover && (
              <g>
                {/* Vertical cursor line */}
                <line
                  x1={activeHover.x}
                  y1={chartLayout.padding.top}
                  x2={activeHover.x}
                  y2={chartLayout.height - chartLayout.padding.bottom}
                  stroke="#94a3b8"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                {/* Glowing Dot on Line */}
                <circle
                  cx={activeHover.x}
                  cy={activeHover.y}
                  r="5"
                  fill="#ffffff"
                  stroke={strokeColor}
                  strokeWidth="3"
                />
              </g>
            )}

            {/* Invisible interactive hover slices */}
            {chartLayout.points.map((pt, i) => {
              const sliceWidth = chartLayout.innerWidth / chartLayout.points.length;
              return (
                <rect
                  key={i}
                  x={pt.x - sliceWidth / 2}
                  y={0}
                  width={sliceWidth}
                  height={chartLayout.height}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIndex(i)}
                  onTouchMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const touchX = e.touches[0].clientX - rect.left;
                    const index = Math.floor((touchX / rect.width) * chartLayout.points.length);
                    if (index >= 0 && index < chartLayout.points.length) {
                      setHoverIndex(index);
                    }
                  }}
                />
              );
            })}
          </svg>

          {/* Bottom Date range labels */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono px-2 pt-1 border-t border-slate-100">
            <span>
              {filteredData[0]?.date
                ? new Date(filteredData[0].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                : '-'}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-sans">
                Terendah: <strong className="font-mono text-slate-700">Rp {stats?.min.toLocaleString('id-ID')}</strong>
              </span>
              <span className="text-slate-500 font-sans">
                Tertinggi: <strong className="font-mono text-slate-700">Rp {stats?.max.toLocaleString('id-ID')}</strong>
              </span>
            </div>
            <span>
              {filteredData[filteredData.length - 1]?.date
                ? new Date(filteredData[filteredData.length - 1].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                : '-'}
            </span>
          </div>
        </div>
      )}

      {/* Legend / Info Bar */}
      {showOverlays && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: strokeColor }} />
            <span>Harga Saham</span>
          </div>
          {fairPrice && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-indigo-500" />
              <span>Harga Wajar Valuasi (Rp {fairPrice.toLocaleString('id-ID')})</span>
            </div>
          )}
          {resistance && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500" />
              <span>Resistance (Rp {resistance.toLocaleString('id-ID')})</span>
            </div>
          )}
          {support && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-500" />
              <span>Support (Rp {support.toLocaleString('id-ID')})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
