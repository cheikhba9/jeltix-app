import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  growth?: number;
  tag?: string;
  iconName: string;
  variant?: 'primary' | 'tertiary' | 'secondary' | 'neutral';
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  unit,
  growth,
  tag,
  iconName,
  variant = 'primary',
  loading = false,
}: StatCardProps) {
  const isTertiary = variant === 'tertiary';

  // Masquer growth si nul ou zéro (pas de données de croissance disponibles)
  const showGrowth = growth !== undefined && growth !== 0;
  const isNegativeGrowth = showGrowth && growth! < 0;

  return (
    <div
      className="bg-white dark:bg-[#0B1936] rounded-2xl p-5 shadow-xs relative overflow-hidden group border border-slate-200/90 dark:border-white/10 card-hover-glow cursor-default animate-fade-up"
    >
      {/* Subtle gradient overlay on hover */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
          isTertiary
            ? 'bg-gradient-to-br from-emerald-50/60 via-transparent to-transparent dark:from-emerald-950/20'
            : 'bg-gradient-to-br from-blue-50/60 via-transparent to-transparent dark:from-blue-950/20'
        }`}
      />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${
            isTertiary
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-[#4EED15]'
              : 'bg-blue-50 text-[#0038A8] dark:bg-blue-950/50 dark:text-[#4EED15]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">{iconName}</span>
        </div>

        {/* Badge de croissance — seulement si valeur non nulle */}
        {showGrowth && (
          <span
            className={`font-extrabold text-xs flex items-center gap-1 px-2.5 py-1 rounded-full ${
              isNegativeGrowth
                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40'
                : 'text-[#059669] dark:text-[#4EED15] bg-emerald-50 dark:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isNegativeGrowth ? 'trending_down' : 'trending_up'}
            </span>
            {isNegativeGrowth ? '' : '+'}{growth}%
          </span>
        )}

        {/* Badge tag (ex: "Aujourd'hui") */}
        {!showGrowth && tag && (
          <span className="text-slate-600 dark:text-white/80 font-bold text-xs flex items-center gap-1 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-full">
            {tag}
          </span>
        )}
      </div>

      <p className="text-xs font-mono font-extrabold text-slate-500 dark:text-white/60 uppercase tracking-wider mb-1.5 relative z-10">
        {title}
      </p>

      {loading && (value === undefined || value === null || value === '—') ? (
        <div className="h-8 w-32 rounded-lg skeleton-shimmer mt-1" />
      ) : (
        <h3
          className="text-3xl font-black text-slate-900 dark:text-white tracking-tight relative z-10"
          suppressHydrationWarning
        >
          {value ?? 0}
          {unit && (
            <span className="text-sm text-slate-500 dark:text-white/70 font-bold ml-1" suppressHydrationWarning>
              {unit}
            </span>
          )}
        </h3>
      )}
    </div>
  );
}
