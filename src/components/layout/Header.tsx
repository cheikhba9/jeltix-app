'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useStore } from '@/lib/store/jeltix-store';
import { createClient } from '@/lib/supabase/client';
import { isSuperAdminEmail } from '@/lib/services/profiles.service';
import type { UserProfile, UserRole } from '@/types';
import {
  Menu,
  User,
  Info,
  LogOut,
  ChevronDown,
  X,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  Calendar,
  Sparkles,
  Server,
  Layers,
  Pencil,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface HeaderProps {
  onOpenMobileSidebar?: () => void;
}

export function getRoleLabel(role?: string, email?: string): string {
  if (role === 'SUPER_ADMIN' || (email && isSuperAdminEmail(email))) {
    return 'Super Administrateur';
  }
  switch (role) {
    case 'ORGANIZER':
      return 'Organisateur';
    case 'SELLER':
      return 'Vendeur';
    case 'CONTROLLER':
      return 'Scanner Contrôleur';
    case 'FINANCE':
      return 'Finance & Audit';
    default:
      return 'Super Administrateur';
  }
}

export function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'JT';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

// ── Breadcrumb Component ──────────────────────────────────────────────────────

const ROUTE_META: Record<string, { label: string; icon: string; parent?: string }> = {
  '/dashboard':  { label: 'Tableau de bord', icon: 'dashboard' },
  '/events':     { label: 'Événements',        icon: 'event',      parent: '/dashboard' },
  '/events/new': { label: 'Nouvel événement',  icon: 'add_circle', parent: '/events' },
  '/sales':      { label: 'Ventes & Recettes', icon: 'payments',   parent: '/dashboard' },
  '/sales/pos':  { label: 'Guichet POS',       icon: 'point_of_sale', parent: '/sales' },
  '/scans':      { label: 'Scans & Contrôle',  icon: 'qr_code_scanner', parent: '/dashboard' },
  '/reports':    { label: 'Rapports & Audit',  icon: 'bar_chart',  parent: '/dashboard' },
  '/users':      { label: 'Gestion Utilisateurs', icon: 'group',   parent: '/dashboard' },
};

function HeaderBreadcrumb() {
  const pathname = usePathname();

  // Chercher la route exacte ou la plus proche par préfixe
  const matchedKey = Object.keys(ROUTE_META)
    .filter((k) => pathname === k || pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0];

  const current = matchedKey ? ROUTE_META[matchedKey] : null;
  const parent  = current?.parent ? ROUTE_META[current.parent] : null;

  if (!current) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-[#0038A8]/10 dark:bg-[#4EED15]/10 text-[#0038A8] dark:text-[#4EED15] hidden sm:flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">verified_user</span>
        </div>
        <span className="text-xs font-extrabold text-slate-700 dark:text-white/90 tracking-wider uppercase font-mono hidden sm:block">
          Administration
        </span>
      </div>
    );
  }

  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 min-w-0">
      {/* Icône page courante */}
      <div className="w-9 h-9 rounded-xl bg-[#0038A8]/10 dark:bg-[#4EED15]/10 text-[#0038A8] dark:text-[#4EED15] hidden sm:flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[18px]">{current.icon}</span>
      </div>

      <div className="flex items-center gap-1 min-w-0">
        {/* Parent (si applicable) */}
        {parent && current.parent && (
          <>
            <Link
              href={current.parent}
              prefetch={true}
              className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors hidden md:block truncate"
            >
              {parent.label}
            </Link>
            <span className="text-slate-300 dark:text-white/20 hidden md:block text-xs">/</span>
          </>
        )}

        {/* Page courante */}
        <div>
          <span className="text-sm font-black text-slate-900 dark:text-white truncate block max-w-[180px] sm:max-w-none">
            {current.label}
          </span>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block font-mono">
            Jël Tix • Serveur Dakar ✓
          </p>
        </div>
      </div>
    </nav>
  );
}

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const router = useRouter();

  const { currentUser, setCurrentUser } = useStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // États d'édition du profil utilisateur
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFullName, setProfileFullName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileOrganization, setProfileOrganization] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const { addToast } = useToast();

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Synchronisation automatique de la session Supabase
  const syncSession = useCallback(async () => {
    try {
      // Vérification immédiate du cache local pour réactivité instantanée
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('jeltix_current_user_v2') || localStorage.getItem('jeltix_current_user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && !currentUser) {
              setCurrentUser(parsed);
            }
          } catch {}
        }
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const cleanEmail = user.email.trim().toLowerCase();
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      const role = isSuperAdminEmail(cleanEmail)
        ? 'SUPER_ADMIN'
        : ((profile?.role || 'ORGANIZER') as UserRole);
      const fullName = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || cleanEmail.split('@')[0];

      const userObj: UserProfile = {
        id: profile?.id || user.id,
        email: cleanEmail,
        fullName,
        role,
        phone: profile?.phone || '',
        organization: profile?.organization || 'Jël Tix SAS',
        isActive: profile?.is_active !== false,
        createdAt: profile?.created_at || new Date().toISOString(),
      };

      setCurrentUser(userObj);
      if (typeof window !== 'undefined') {
        localStorage.setItem('jeltix_current_user_v2', JSON.stringify(userObj));
        localStorage.setItem('jeltix_current_user', JSON.stringify(userObj));
      }
    } catch (err) {
      console.warn('Sync session error in Header:', err);
    }
  }, [setCurrentUser]);

  useEffect(() => {
    syncSession();
  }, [syncSession]);

  // Fermeture des menus au clic extérieur
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Déconnexion propre
  const handleLogout = async () => {
    setShowUserDropdown(false);
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

  const displayName = currentUser?.fullName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Utilisateur');
  const roleLabel = getRoleLabel(currentUser?.role, currentUser?.email);
  const initials = getInitials(displayName);

  // Ouverture et synchronisation du formulaire profil
  const openProfileModal = () => {
    setIsEditingProfile(false);
    setProfileFullName(currentUser?.fullName || '');
    setProfilePhone(currentUser?.phone || '');
    setProfileOrganization(currentUser?.organization || '');
    setProfileNewPassword('');
    setShowPasswordSection(false);
    setShowPasswordText(false);
    setShowUserDropdown(false);
    setShowProfileModal(true);
  };

  // Enregistrement des modifications du profil
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profileFullName.trim()) {
      addToast({
        type: 'warning',
        title: 'Nom requis',
        message: 'Veuillez saisir votre nom complet.',
      });
      return;
    }

    if (profileNewPassword && profileNewPassword.trim().length < 6) {
      addToast({
        type: 'warning',
        title: 'Mot de passe trop court',
        message: 'Le mot de passe doit comporter au moins 6 caractères.',
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          email: currentUser?.email,
          fullName: profileFullName.trim(),
          phone: profilePhone.trim(),
          organization: profileOrganization.trim(),
          newPassword: profileNewPassword ? profileNewPassword.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la mise à jour du profil.');
      }

      const updatedUser: UserProfile = {
        ...(currentUser || ({} as any)),
        ...data.user,
        fullName: profileFullName.trim(),
        phone: profilePhone.trim() || undefined,
        organization: profileOrganization.trim() || undefined,
      };

      setCurrentUser(updatedUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('jeltix_current_user', JSON.stringify(updatedUser));
      }

      addToast({
        type: 'success',
        title: 'Profil mis à jour',
        message: 'Vos informations personnelles ont été enregistrées avec succès.',
      });

      setIsEditingProfile(false);
      setProfileNewPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      console.error('Erreur handleSaveProfile:', err);
      addToast({
        type: 'error',
        title: 'Erreur',
        message: err.message || 'Impossible de mettre à jour votre profil.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 lg:left-72 right-0 h-20 bg-white/95 dark:bg-[#071229]/95 backdrop-blur-xl shadow-[0_2px_10px_rgba(0,45,140,0.04)] border-b border-slate-200 dark:border-white/10 z-30 flex items-center justify-between px-4 sm:px-8 transition-colors">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Mobile Sidebar Hamburger Toggle */}
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/15 transition-colors cursor-pointer shrink-0"
            aria-label="Ouvrir le menu latéral"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb dynamique */}
          <HeaderBreadcrumb />
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Light / Dark Mode Toggle Button */}
          <ThemeToggle />

          {/* Public portal link button */}
          <Link
            href="/"
            target="_blank"
            prefetch={true}
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-[#0038A8] dark:text-white text-xs font-bold transition-colors border border-slate-200 dark:border-white/10 active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px] text-[#2CA808] dark:text-[#4EED15]">open_in_new</span>
            <span>Portail Public</span>
          </Link>

          {/* Notification Bell with interactive dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors relative cursor-pointer"
              title="Notifications"
              aria-expanded={showNotifications}
              aria-haspopup="true"
            >
              <span className="material-symbols-outlined text-[24px]">notifications</span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-[#0B1936] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-slate-900 dark:text-white">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                  <p className="text-xs font-extrabold uppercase">Notifications Jël Tix</p>
                </div>
                <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                  <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-white/20">notifications_off</span>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Aucune notification pour le moment</p>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Tab with Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-white/10 hover:opacity-90 transition-all cursor-pointer select-none group"
              title="Menu utilisateur"
              aria-expanded={showUserDropdown}
              aria-haspopup="true"
            >
              {/* Nom & Rôle de l'utilisateur */}
              <div className="text-right hidden md:block">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-none group-hover:text-[#0038A8] dark:group-hover:text-[#4EED15] transition-colors">
                  {displayName}
                </p>
                <p className="text-[11px] text-[#0038A8] dark:text-[#4EED15] font-bold mt-1">
                  {roleLabel}
                </p>
              </div>

              {/* Avatar avec initiales */}
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0038A8] to-[#0D52D6] text-white flex items-center justify-center shadow-md font-black text-sm tracking-wider ring-2 ring-transparent group-hover:ring-[#0038A8]/30 dark:group-hover:ring-[#4EED15]/40 transition-all">
                  <span>{initials}</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-[#071229] flex items-center justify-center shadow-xs border border-slate-200 dark:border-white/10">
                  <ChevronDown className={`w-3 h-3 text-slate-600 dark:text-slate-300 transition-transform duration-200 ${showUserDropdown ? 'rotate-180 text-[#0038A8] dark:text-[#4EED15]' : ''}`} />
                </div>
              </div>
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-3 w-72 sm:w-80 bg-white dark:bg-[#0E1A33] border border-slate-200 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,45,140,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-slate-900 dark:text-white">
                {/* En-tête du menu : Carte utilisateur */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0038A8] to-[#0D52D6] text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                      {currentUser?.email || 'compte@jeltix.sn'}
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0038A8]/10 dark:bg-[#4EED15]/15 text-[#0038A8] dark:text-[#4EED15] text-[10px] font-black uppercase font-mono">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{roleLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Liste des actions */}
                <div className="space-y-1">
                  {/* Bouton 1 : Mon profil */}
                  <button
                    onClick={openProfileModal}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-[#0038A8] dark:hover:text-[#4EED15] text-xs font-bold transition-all cursor-pointer group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#0038A8] dark:text-[#4EED15] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs">Mon profil</p>
                      <p className="text-[10px] text-slate-400 font-normal">Identifiants et détails du compte</p>
                    </div>
                  </button>

                  {/* Bouton 2 : Information */}
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowInfoModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-[#0038A8] dark:hover:text-[#4EED15] text-xs font-bold transition-all cursor-pointer group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-[#2CA808] dark:text-[#4EED15] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Info className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs">Information</p>
                      <p className="text-[10px] text-slate-400 font-normal">Permissions, rôle &amp; statut système</p>
                    </div>
                  </button>
                </div>

                {/* Séparateur & Déconnexion */}
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-white/10">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold transition-all cursor-pointer group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-xs">Déconnecter</p>
                      <p className="text-[10px] text-red-400/80 font-normal">Fermer la session actuelle</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* MODALE 1 : MON PROFIL (CONSULTATION & ÉDITION) */}
      {/* ============================================================ */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0E1A33] text-slate-900 dark:text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header de la modale */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isEditingProfile
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-[#0038A8]/10 text-[#0038A8] dark:text-[#4EED15]'
                }`}>
                  {isEditingProfile ? <Pencil className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {isEditingProfile ? 'Modifier mes informations' : 'Mon Profil Utilisateur'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isEditingProfile ? 'Mettez à jour vos coordonnées personnelles' : 'Détails et coordonnées'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false);
                  setIsEditingProfile(false);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODE CONSULTATION */}
            {!isEditingProfile ? (
              <>
                {/* Avatar & Nom */}
                <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-white/5 dark:to-blue-950/20 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0038A8] to-[#0D52D6] text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-extrabold truncate">{displayName}</h4>
                      <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0038A8] text-white text-[10px] font-bold font-mono">
                        {roleLabel}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="p-2.5 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:border-[#0038A8] dark:hover:border-[#4EED15] text-[#0038A8] dark:text-[#4EED15] hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0 inline-flex items-center gap-1.5 text-xs font-bold"
                    title="Modifier mon profil"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Modifier</span>
                  </button>
                </div>

                {/* Détails du compte */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                    <Mail className="w-4 h-4 text-[#0038A8] dark:text-[#4EED15] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase font-mono">Adresse Email</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{currentUser?.email || 'Non renseigné'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                    <Phone className="w-4 h-4 text-[#0038A8] dark:text-[#4EED15] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase font-mono">Téléphone</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{currentUser?.phone || '+221 77 000 00 00'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                    <Building2 className="w-4 h-4 text-[#0038A8] dark:text-[#4EED15] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase font-mono">Organisation</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{currentUser?.organization || 'Jël Tix SAS'}</p>
                    </div>
                  </div>
                </div>

                {/* Actions Consultation */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="flex-1 py-3 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white text-xs font-bold text-center transition-all shadow-md inline-flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Modifier mes informations</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              /* MODE ÉDITION DU PROFIL */
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Champ 1 : Nom complet */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Nom complet &amp; Prénom
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      placeholder="ex: Mamadou Cheikh Ba"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0038A8] dark:focus:ring-[#4EED15] transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Champ 2 : Téléphone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Numéro de Téléphone
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="ex: +221 77 123 45 67"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0038A8] dark:focus:ring-[#4EED15] transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Champ 3 : Organisation */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Organisation / Entreprise
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={profileOrganization}
                      onChange={(e) => setProfileOrganization(e.target.value)}
                      placeholder="ex: Jël Tix SAS ou FoutaTicket"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0038A8] dark:focus:ring-[#4EED15] transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Champ 4 : Adresse Email (Lecture seule sécurisée) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Adresse Email
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono inline-flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Identifiant lié au compte</span>
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      disabled
                      value={currentUser?.email || ''}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed font-mono"
                    />
                  </div>
                </div>

                {/* Section Optionnelle : Modifier le mot de passe */}
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/3">
                  <button
                    type="button"
                    onClick={() => setShowPasswordSection(!showPasswordSection)}
                    className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-[#0038A8] dark:text-[#4EED15]" />
                      <span>Modifier mon mot de passe</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#0038A8] dark:text-[#4EED15]">
                      {showPasswordSection ? 'Masquer' : 'Déplier'}
                    </span>
                  </button>

                  {showPasswordSection && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 space-y-2 animate-in fade-in duration-200">
                      <div className="relative">
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={profileNewPassword}
                          onChange={(e) => setProfileNewPassword(e.target.value)}
                          placeholder="Nouveau mot de passe (min. 6 caractères)"
                          className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#071229] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0038A8] dark:focus:ring-[#4EED15]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordText(!showPasswordText)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        >
                          {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Laissez vide si vous ne souhaitez pas modifier votre mot de passe actuel.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions Édition */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex-1 py-3 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white text-xs font-bold text-center transition-all shadow-md inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enregistrement…</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Enregistrer les modifications</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isSavingProfile}
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileNewPassword('');
                      setShowPasswordSection(false);
                    }}
                    className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-white/15 transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALE 2 : INFORMATIONS COMPTE & SYSTÈME */}
      {/* ============================================================ */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0E1A33] text-slate-900 dark:text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-[#2CA808] dark:text-[#4EED15] flex items-center justify-center">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Informations &amp; Permissions</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Statut du compte et niveau d'accès</p>
                </div>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Statut du compte */}
            <div className="p-3.5 rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-[#4EED15] shrink-0" />
              <div>
                <p className="text-xs font-extrabold text-green-900 dark:text-green-300">Compte Actif &amp; Certifié</p>
                <p className="text-[11px] text-green-700 dark:text-green-400 font-medium">
                  Votre session est authentifiée et protégée par chiffrement SSL.
                </p>
              </div>
            </div>

            {/* Permissions associées au rôle */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-[#0038A8] dark:text-[#4EED15]" />
                <span>Périmètre de votre rôle : {roleLabel}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {currentUser?.role === 'SUPER_ADMIN' &&
                  "Contrôle total sur l'ensemble de la plateforme : supervision globale, gestion de tous les organisateurs, accès aux recettes consolidées, aux audits et aux modifications de mots de passe de tous les utilisateurs."}
                {currentUser?.role === 'ORGANIZER' &&
                  "Gestion complète de vos événements : création et tarification des billets, suivi des ventes en direct, gestion de votre équipe de terrain (vendeurs de guichet et contrôleurs) avec droit de modification de leurs mots de passe."}
                {currentUser?.role === 'SELLER' &&
                  "Accès exclusif à la caisse guichet (POS) : encaissement des billets physiques et validation instantanée des paiements espèces et Mobile Money."}
                {currentUser?.role === 'CONTROLLER' &&
                  "Accès exclusif au scanner PWA de contrôle d'accès : vérification caméra anti-fraude des QR codes aux portes des événements."}
                {currentUser?.role === 'FINANCE' &&
                  "Accès aux rapports financiers consolidés, aux exports comptables CSV et aux audits de trésorerie."}
              </p>
            </div>

            {/* Informations Infrastructure */}
            <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 font-mono">
              <div className="flex justify-between">
                <span>Plateforme :</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">Jël Tix v1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>Infrastructure :</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">Next.js 16 + Supabase</span>
              </div>
              <div className="flex justify-between">
                <span>Serveur Régional :</span>
                <span className="font-bold text-green-600 dark:text-[#4EED15]">Dakar (Opérationnel)</span>
              </div>
            </div>

            {/* Bouton de fermeture */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="w-full py-3 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white text-xs font-bold text-center transition-all shadow-md cursor-pointer"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
