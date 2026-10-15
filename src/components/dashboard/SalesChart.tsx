'use client';

import { useState, memo, useMemo } from 'react';
import Link from 'next/link';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import type { Order } from '@/types';
import { formatFCFA } from '@/lib/utils/format';

interface DataPoint {
  day: string;
  sales: number;
  revenue: number;
  cx: number;
  cy: number;
}

/** Calcule les données des 7 derniers jours depuis les orders réels du store */
function buildChartData(orders: Order[]): DataPoint[] {
  const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const today = new Date();

  const days: { label: string; date: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({ label: DAY_LABELS[d.getDay()], date: d });
  }

  const buckets = days.map(({ label, date }) => {
    const dayStr = date.toISOString().split('T')[0];
    const dayOrders = orders.filter((o) => o.createdAt.startsWith(dayStr));
    const sales = dayOrders.reduce((sum, o) => {
      return sum + o.items.reduce((s, it) => s + it.quantity, 0);
    }, 0);
    const revenue = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    return { label, sales, revenue };
  });

  const maxSales = Math.max(...buckets.map((b) => b.sales), 1);

  return buckets.map((b, i) => {
    const cx = Math.round((i / (buckets.length - 1)) * 800);
    const normalizedY = b.sales / maxSales;
    const cy = Math.round(280 - normalizedY * 240);
    return { day: b.label, sales: b.sales, revenue: b.revenue, cx, cy };
  });
}

function buildSmoothPath(points: { cx: number; cy: number }[]): string {
  if (points.length === 0) return '';
  let d = `M${points[0].cx},${points[0].cy}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.cx + curr.cx) / 2;
    d += ` C${cpX},${prev.cy} ${cpX},${curr.cy} ${curr.cx},${curr.cy}`;
  }
  return d;
}

// ID unique par instance pour éviter les conflits de gradient SVG
const GRADIENT_ID = `chartGrad-${Math.random().toString(36).slice(2, 7)}`;

export const SalesChart = memo(function SalesChart() {
  const { orders, events, currentUser } = useJeltixStore();
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  const isOrganizer = currentUser?.role === 'ORGANIZER';
  const isSeller = currentUser?.role === 'SELLER';

  const scopedOrders = useMemo(() => {
    if (isOrganizer) {
      const orgEvents = events.filter((e) => e.organizerId === currentUser?.id);
      const orgEventIds = new Set(orgEvents.map((e) => e.id));
      return orders.filter((o) => orgEventIds.has(o.eventId));
    }
    if (isSeller) {
      const orgId = currentUser?.organizationId || currentUser?.id;
      const orgEvents = events.filter((e) => e.organizerId === orgId);
      const orgEventIds = new Set(orgEvents.map((e) => e.id));
      return orders.filter((o) => (o.sellerId && o.sellerId === currentUser?.id) || orgEventIds.has(o.eventId));
    }
    return orders;
  }, [orders, events, isOrganizer, isSeller, currentUser]);

  const dataPoints = useMemo(() => buildChartData(scopedOrders), [scopedOrders]);
  const linePath = useMemo(() => buildSmoothPath(dataPoints), [dataPoints]);
  const areaPath = useMemo(() => {
    if (dataPoints.length === 0) return '';
    const firstPt = dataPoints[0];
    const lastPt = dataPoints[dataPoints.length - 1];
    return `M${firstPt.cx},300 ${buildSmoothPath(dataPoints).slice(1)} L${lastPt.cx},300 Z`;
  }, [dataPoints]);

  const hasData = scopedOrders.length > 0;

  // Totaux synthétiques
  const weekTotalSales = dataPoints.reduce((s, d) => s + d.sales, 0);
  const weekTotalRevenue = dataPoints.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="bg-white dark:bg-[#0B1936] rounded-2xl p-6 shadow-xs flex flex-col h-full min-h-[420px] border border-slate-200/90 dark:border-white/10 card-hover-glow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Ventes — 7 derniers jours
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {hasData
              ? 'Évolution quotidienne des encaissements en ligne et guichet'
              : 'Aucune vente enregistrée — les données apparaîtront au premier achat'}
          </p>
        </div>
        <Link
          href="/sales"
          prefetch={true}
          className="text-[#0038A8] dark:text-[#4EED15] hover:bg-blue-50 dark:hover:bg-white/5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shrink-0"
        >
          <span>Voir détail</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>

      {/* KPI mini-row (uniquement si des données existent) */}
      {hasData && (
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 font-bold">Billets vendus</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">{weekTotalSales.toLocaleString('fr-FR')}</span>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 font-bold">Recettes</span>
            <span className="text-xl font-black text-[#0038A8] dark:text-[#4EED15]">{formatFCFA(weekTotalRevenue)}</span>
          </div>
        </div>
      )}

      {/* Hover Info Tooltip */}
      <div className="h-7 mb-2 flex items-center">
        {hoveredPoint ? (
          <div className="flex items-center gap-3 text-xs bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 animate-fade-in">
            <span className="font-black text-[#0038A8] dark:text-[#4EED15]">{hoveredPoint.day} :</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {hoveredPoint.sales} billet{hoveredPoint.sales !== 1 ? 's' : ''}
            </span>
            {hoveredPoint.revenue > 0 && (
              <span className="text-slate-500 dark:text-slate-400">
                · {formatFCFA(hoveredPoint.revenue)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Survolez un point pour voir le détail journalier
          </p>
        )}
      </div>

      {/* SVG Interactive Chart */}
      <div className="flex-1 relative w-full h-full flex items-end pb-8">
        {!hasData ? (
          <div className="absolute inset-0 flex items-center justify-center pb-8">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-white/20">
                  bar_chart
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Aucune donnée de vente</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Commencez par créer une vente au guichet ou en ligne
                </p>
              </div>
              <Link
                href="/events/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0038A8] text-white text-xs font-bold hover:bg-[#002D8C] transition-colors"
              >
                <span className="material-symbols-outlined text-[14px] text-[#4EED15]">add</span>
                Créer un événement
              </Link>
            </div>
          </div>
        ) : (
          <svg
            className="w-full h-full text-[#0038A8] dark:text-[#4EED15] absolute bottom-8 left-0 overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 800 300"
          >
            <defs>
              <linearGradient id={GRADIENT_ID} x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%"   stopColor="currentColor" stopOpacity="0.20" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Grille horizontale subtile */}
            {[75, 150, 225].map((y) => (
              <line
                key={y}
                x1="0" y1={y} x2="800" y2={y}
                stroke="currentColor"
                strokeOpacity="0.06"
                strokeWidth="1"
              />
            ))}

            {/* Area Fill */}
            <path d={areaPath} fill={`url(#${GRADIENT_ID})`} />

            {/* Line Curve */}
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3.5"
              className="transition-all duration-300"
            />

            {/* Interactive Circle Points */}
            {dataPoints.map((pt, idx) => (
              <g key={idx} className="cursor-pointer">
                {/* Zone de hover agrandie (invisible) */}
                <circle
                  cx={pt.cx}
                  cy={pt.cy}
                  r={20}
                  fill="transparent"
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                <circle
                  cx={pt.cx}
                  cy={pt.cy}
                  r={hoveredPoint?.day === pt.day ? 8 : 5}
                  fill="white"
                  stroke="currentColor"
                  strokeWidth={hoveredPoint?.day === pt.day ? 3.5 : 2.5}
                  className="transition-all duration-200 pointer-events-none"
                />
                {/* Halo sur point survolé */}
                {hoveredPoint?.day === pt.day && (
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r={16}
                    fill="currentColor"
                    fillOpacity="0.1"
                    className="pointer-events-none"
                  />
                )}
              </g>
            ))}
          </svg>
        )}

        {/* Days Axis */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 font-mono px-1">
          {dataPoints.map((pt) => (
            <span
              key={pt.day}
              className={`transition-all duration-200 ${
                hoveredPoint?.day === pt.day
                  ? 'text-[#0038A8] dark:text-[#4EED15] scale-110 font-black'
                  : ''
              }`}
            >
              {pt.day}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});
