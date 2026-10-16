export default function DashboardLoading() {
  return (
    <div className="w-full py-4 flex items-center justify-center">
      <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className="w-2 h-2 rounded-full bg-[#0038A8] dark:bg-[#4EED15] animate-ping" />
        <span>Chargement sécurisé de vos données…</span>
      </div>
    </div>
  );
}
