'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { useStore } from '@/lib/store/jeltix-store';
import { createClient } from '@/lib/supabase/client';
import { getRoleLabel } from '@/components/layout/Header';
import {
  ExternalLink,
  X,
  LogOut,
  LayoutDashboard,
  Calendar,
  CreditCard,
  QrCode,
  BarChart3,
  Users,
  Store,
  ShoppingCart,
  Ticket,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'ORGANIZER', 'SELLER'],
    description: 'Vue d\'ensemble & KPIs',
  },
  {
    href: '/events',
    label: 'Événements',
    icon: Calendar,
    roles: ['SUPER_ADMIN', 'ORGANIZER'],
    description: 'Catalogue & Billetterie',
  },
  {
    href: '/tickets',
    label: 'Recherche Billets',
    icon: Ticket,
    roles: ['SUPER_ADMIN', 'ORGANIZER', 'SELLER'],
    description: 'Retrouver & renvoyer un billet perdu',
  },
  {
    href: '/sales',
    label: 'Ventes & Recettes',
    icon: CreditCard,
    roles: ['SUPER_ADMIN', 'ORGANIZER', 'SELLER'],
    description: 'Journal des transactions',
  },
  {
    href: '/scans',
    label: 'Contrôle & Scans',
    icon: QrCode,
    roles: ['SUPER_ADMIN', 'ORGANIZER', 'CONTROLLER'],
    description: 'Historique des scans',
  },
  {
    href: '/reports',
    label: 'Rapports & Audit',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'ORGANIZER'],
    description: 'Analytics & exports',
  },
  {
    href: '/users',
    label: 'Gestion Utilisateurs',
    icon: Users,
    roles: ['SUPER_ADMIN', 'ORGANIZER'],
    description: 'Équipes & permissions',
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, setCurrentUser } = useStore();
  const userRole = currentUser?.role || 'SUPER_ADMIN';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Logout error:', err);
    }
    setCurrentUser(null as any);
    if (typeof window !== 'undefined') {
      document.cookie = 'jeltix_auth_session=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'jeltix_user_profile=; path=/; max-age=0; SameSite=Lax';
      localStorage.removeItem('jeltix_current_user');
      localStorage.removeItem('jeltix_current_user_v2');
      sessionStorage.clear();
      window.location.href = '/login?logout=true';
    }
  };

  const accessibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  const displayName = currentUser?.fullName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Utilisateur');
  const roleLabel = getRoleLabel(currentUser?.role, currentUser?.email);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Panel */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-white dark:bg-[#060D1E] text-slate-800 dark:text-white z-50 flex flex-col border-r border-slate-200 dark:border-white/8 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-5 bg-white dark:bg-[#040915] border-b border-slate-200 dark:border-white/8 shrink-0">
          <Logo size="sm" href="/dashboard" />

          <button
            onClick={onCloseMobile}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden cursor-pointer transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto space-y-0.5">

          {/* Section principale */}
          {accessibleNavItems.length > 0 && (
            <>
              <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40 font-mono">
                Administration
              </p>
              {accessibleNavItems.map((item, idx) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={onCloseMobile}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] text-sm group relative ${
                      isActive
                        ? 'bg-[#0038A8] text-white shadow-sm font-bold'
                        : 'text-slate-600 dark:text-white/65 hover:bg-slate-100 dark:hover:bg-white/6 hover:text-slate-900 dark:hover:text-white font-medium'
                    }`}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#4EED15] rounded-r-full" />
                    )}

                    <item.icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-400 dark:text-white/40 group-hover:text-slate-700 dark:group-hover:text-white/70'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <span className="block truncate">
                        {item.href === '/users' && userRole === 'ORGANIZER' ? 'Mon Équipe' : item.label}
                      </span>
                      {!isActive && (
                        <span className="text-[10px] text-slate-400 dark:text-white/30 font-normal hidden group-hover:block transition-all">
                          {item.href === '/users' && userRole === 'ORGANIZER' ? 'Vendeurs & Contrôleurs' : item.description}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </>
          )}

          {/* Section opérations terrain */}
          <div className="pt-5">
            <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40 font-mono">
              Terrain
            </p>

            {(userRole === 'SUPER_ADMIN' || userRole === 'ORGANIZER' || userRole === 'SELLER') && (
              <Link
                href="/sales/pos"
                prefetch={true}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] text-sm font-medium group relative ${
                  pathname === '/sales/pos'
                    ? 'bg-[#0038A8] text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-white/65 hover:bg-slate-100 dark:hover:bg-white/6 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {pathname === '/sales/pos' && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#4EED15] rounded-r-full" />
                )}
                <CreditCard className="w-5 h-5 text-emerald-500 dark:text-[#4EED15] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">Guichet POS</span>
                  <span className="text-[10px] text-emerald-500/70 dark:text-[#4EED15]/60 font-normal">
                    Caisse & encaissement
                  </span>
                </div>
              </Link>
            )}

            {(userRole === 'SUPER_ADMIN' || userRole === 'ORGANIZER' || userRole === 'CONTROLLER') && (
              <Link
                href="/scan"
                prefetch={true}
                target="_blank"
                onClick={onCloseMobile}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] text-sm font-medium text-slate-600 dark:text-white/65 hover:bg-slate-100 dark:hover:bg-white/6 hover:text-slate-900 dark:hover:text-white group"
              >
                <QrCode className="w-5 h-5 text-[#0038A8] dark:text-[#4EED15] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">Scanner Contrôleur</span>
                  <span className="text-[10px] text-slate-400/70 dark:text-white/30 font-normal">
                    PWA — s'ouvre dans un nouvel onglet
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 shrink-0" />
              </Link>
            )}

            <Link
              href="/"
              prefetch={true}
              target="_blank"
              onClick={onCloseMobile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] text-sm font-medium text-slate-600 dark:text-white/65 hover:bg-slate-100 dark:hover:bg-white/6 hover:text-slate-900 dark:hover:text-white group"
            >
              <Store className="w-5 h-5 text-slate-400 dark:text-white/40 group-hover:text-[#0038A8] dark:group-hover:text-[#4EED15] shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block truncate">Portail Spectateurs</span>
                <span className="text-[10px] text-slate-400/70 dark:text-white/30 font-normal">
                  Site public de vente
                </span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 shrink-0" />
            </Link>
          </div>
        </nav>

        {/* User Session Footer */}
        <div className="p-3 shrink-0 border-t border-slate-200 dark:border-white/8">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/8">
            <div className="flex items-center gap-2.5 mb-2.5">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0038A8] to-[#0D52D6] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                {(displayName.charAt(0) + (displayName.split(' ')[1]?.charAt(0) || '')).toUpperCase().substring(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black text-slate-900 dark:text-white truncate" suppressHydrationWarning>
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[10px] font-bold text-[#0038A8] dark:text-[#4EED15] font-mono truncate" suppressHydrationWarning>
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border border-red-100 dark:border-red-900/30 active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnecter la session</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
