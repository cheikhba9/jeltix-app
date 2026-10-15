'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatRelativeTime } from '@/lib/utils/format';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';

export function LiveScansFeed() {
  const { scans, events, currentUser } = useJeltixStore();
  const [mounted, setMounted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOrganizer = currentUser?.role === 'ORGANIZER';
  const isSeller = currentUser?.role === 'SELLER';

  const scopedScans = useMemo(() => {
    if (isOrganizer) {
      const orgEvents = events.filter((e) => e.organizerId === currentUser?.id);
      const orgEventIds = new Set(orgEvents.map((e) => e.id));
      return scans.filter((s) => orgEventIds.has(s.eventId));
    }
    if (isSeller) {
      const orgId = currentUser?.organizationId || currentUser?.id;
      const orgEvents = events.filter((e) => e.organizerId === orgId);
      const orgEventIds = new Set(orgEvents.map((e) => e.id));
      return scans.filter((s) => orgEventIds.has(s.eventId));
    }
    return scans;
  }, [scans, events, isOrganizer, isSeller, currentUser]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tick toutes les 30 secondes pour mettre à jour les temps relatifs
  useEffect(() => {
    const timer = setInterval(() => {
      setLastRefreshed(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const recentScans = scopedScans.slice(0, visibleCount);
  const hasMore = scopedScans.length > visibleCount;

  const validCount = scopedScans.filter((s) => s.result === 'VALID').length;
  const invalidCount = scopedScans.filter((s) => s.result !== 'VALID').length;

  return (
    <div
      className="bg-white dark:bg-[#0B1936] rounded-2xl p-6 shadow-xs flex flex-col h-[420px] border border-slate-200/90 dark:border-white/10 card-hover-glow"
      suppressHydrationWarning
    >
      {/* Header with live ping */}
      <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100 dark:border-white/5">
        <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span>Scans aux Portes</span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-emerald-600 dark:text-[#4EED15] bg-emerald-50 dark:bg-[#4EED15]/10 px-2.5 py-0.5 rounded-full font-black">
            LIVE
          </span>
        </div>
      </div>

      {/* Mini stats row */}
      {mounted && scopedScans.length > 0 && (
        <div className="flex items-center gap-3 mb-3 text-[11px]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{validCount} validés</span>
          </div>
          {invalidCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{invalidCount} alertes</span>
            </div>
          )}
        </div>
      )}

      {/* Scans list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-0.5 space-y-2 scrollbar-thin"
        suppressHydrationWarning
      >
        {!mounted ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        ) : recentScans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center pb-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px] text-slate-300 dark:text-white/20">
                qr_code_scanner
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Aucun scan récent</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Les scans apparaissent ici en temps réel
              </p>
            </div>
          </div>
        ) : (
          <>
            {recentScans.map((scan, idx) => {
              const isValid = scan.result === 'VALID';
              const isAlreadyScanned = scan.result === 'ALREADY_SCANNED';

              return (
                <div
                  key={scan.id}
                  suppressHydrationWarning
                  className={`rounded-xl p-3 flex items-center gap-3 border transition-all duration-200 hover:shadow-xs animate-fade-up stagger-${Math.min(idx + 1, 6)} ${
                    isValid
                      ? 'bg-green-50/50 dark:bg-green-950/20 border-green-100 dark:border-green-900/30 hover:bg-green-50 dark:hover:bg-green-950/30'
                      : 'bg-red-50/40 dark:bg-red-950/15 border-red-100 dark:border-red-900/20 hover:bg-red-50/70 dark:hover:bg-red-950/25'
                  }`}
                >
                  {/* Status icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isValid
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {isValid ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0" suppressHydrationWarning>
                    <p className="text-xs font-black font-mono text-slate-900 dark:text-white truncate" suppressHydrationWarning>
                      #{scan.ticketCode}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate" suppressHydrationWarning>
                      {scan.gate} · {formatRelativeTime(scan.scannedAt)}
                    </p>
                  </div>

                  {/* Status Tag */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black whitespace-nowrap shrink-0 ${
                      isValid
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                        : isAlreadyScanned
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {isValid ? '✓ OK' : isAlreadyScanned ? '2x' : '✗'}
                  </span>
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={() => setVisibleCount((n) => n + 5)}
                className="w-full py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors flex items-center justify-center gap-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Charger {Math.min(5, scans.length - visibleCount)} de plus…
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer link */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono" suppressHydrationWarning>
          {mounted ? `${scans.length} scan${scans.length !== 1 ? 's' : ''} total` : '—'}
        </p>
        <Link
          href="/scans"
          prefetch={true}
          className="text-slate-500 dark:text-slate-400 hover:text-[#0038A8] dark:hover:text-[#4EED15] text-xs font-bold transition-colors inline-flex items-center gap-1 active:scale-95"
        >
          <span>Tout l'historique</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
