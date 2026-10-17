'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useStore } from '@/lib/store/jeltix-store';
import { Menu, X, Calendar, LogIn, Ticket, Sparkles, LayoutDashboard } from 'lucide-react';

export function PublicHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser, setCurrentUser } = useStore();

  // Instant local session recovery if not already in store
  useEffect(() => {
    if (!currentUser && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('jeltix_current_user_v2') || localStorage.getItem('jeltix_current_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.id) setCurrentUser(parsed);
        }
      } catch {}
    }
  }, [currentUser, setCurrentUser]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-[#071229]/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 shadow-[0_2px_15px_rgba(0,45,140,0.04)] transition-colors">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        {/* Official Jël Tix Logo */}
        <Logo size="md" href="/" />

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold">
          <Link
            href="/#event-catalog"
            className={`transition-colors py-1 relative ${
              pathname === '/' || pathname === '/discover'
                ? 'text-[#0038A8] dark:text-[#4EED15] font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#4EED15] after:rounded-full'
                : 'text-slate-600 dark:text-slate-300 hover:text-[#0038A8] dark:hover:text-[#4EED15]'
            }`}
          >
            Événements
          </Link>

          <Link
            href="/#featured-event"
            className="text-slate-600 dark:text-slate-300 hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors py-1 flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-[#4EED15]" />
            <span>Événement vedette</span>
          </Link>
        </nav>

        {/* Desktop Quick Actions & Theme Toggle */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Light / Dark Mode Toggle Button */}
          <ThemeToggle />

          {/* Mes Billets (Affiché UNIQUEMENT si l'utilisateur est connecté) */}
          {currentUser && (
            <Link
              href="/tickets"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-[#0038A8] dark:text-white font-bold text-xs border border-slate-200 dark:border-white/10 transition-colors"
            >
              <Ticket className="w-4 h-4 text-[#2CA808] dark:text-[#4EED15]" />
              <span>Mes Billets</span>
            </Link>
          )}

          {/* Connexion ou Tableau de bord */}
          {currentUser ? (
            <Link
              href={
                currentUser.role === 'SELLER'
                  ? '/sales/pos'
                  : currentUser.role === 'CONTROLLER'
                  ? '/scan'
                  : '/dashboard'
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0038A8] to-[#0D52D6] hover:from-[#002D8C] hover:to-[#0B4FD8] text-white font-extrabold text-xs shadow-md shadow-[#0038A8]/20 transition-all hover:scale-[0.98] active:scale-95"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Tableau de bord</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0038A8] to-[#0D52D6] hover:from-[#002D8C] hover:to-[#0B4FD8] text-white font-extrabold text-xs shadow-md shadow-[#0038A8]/20 transition-all hover:scale-[0.98] active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Connexion</span>
            </Link>
          )}
        </div>

        {/* Mobile Hamburger & Theme Toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-[#071229] border-b border-slate-200 dark:border-white/10 px-6 py-4 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <Link
            href="/#event-catalog"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 py-2 text-sm font-bold text-slate-900 dark:text-white hover:text-[#0038A8]"
          >
            <Calendar className="w-5 h-5 text-[#0038A8] dark:text-[#4EED15]" />
            <span>Événements</span>
          </Link>

          <Link
            href="/#featured-event"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 py-2 text-sm font-bold text-slate-900 dark:text-white hover:text-[#0038A8]"
          >
            <Sparkles className="w-5 h-5 text-amber-500 dark:text-[#4EED15]" />
            <span>Événement vedette</span>
          </Link>

          {/* Mes Billets (Mobile : affiché UNIQUEMENT si connecté) */}
          {currentUser && (
            <Link
              href="/tickets"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-[#0038A8]"
            >
              <Ticket className="w-5 h-5 text-[#2CA808] dark:text-[#4EED15]" />
              <span>Mes Billets</span>
            </Link>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-white/10">
            {currentUser ? (
              <Link
                href={
                  currentUser.role === 'SELLER'
                    ? '/sales/pos'
                    : currentUser.role === 'CONTROLLER'
                    ? '/scan'
                    : '/dashboard'
                }
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0038A8] to-[#0D52D6] text-white font-bold text-center text-sm flex items-center justify-center gap-2 shadow-md"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Tableau de bord ({currentUser.fullName.split(' ')[0]})</span>
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0038A8] to-[#0D52D6] text-white font-bold text-center text-sm flex items-center justify-center gap-2 shadow-md"
              >
                <LogIn className="w-4 h-4" />
                <span>Connexion</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
