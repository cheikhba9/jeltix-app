'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useStore } from '@/lib/store/jeltix-store';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Mail,
  Lock,
  Briefcase,
  CreditCard,
  QrCode,
  Shield,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import type { UserRole, UserProfile } from '@/types';
import { getDefaultRouteForRole } from '@/types';
import { isSuperAdminEmail, syncUserProfile } from '@/lib/services/profiles.service';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');
  const isLogout = searchParams.get('logout') === 'true';

  const { setCurrentUser, users, addUser, currentUser } = useStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Signout error:', err);
    }
    setCurrentUser(null as any);
    if (typeof window !== 'undefined') {
      document.cookie = 'jeltix_auth_session=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'jeltix_user_profile=; path=/; max-age=0; SameSite=Lax';
      localStorage.removeItem('jeltix_current_user');
      localStorage.removeItem('jeltix_current_user_v2');
      sessionStorage.clear();
    }
    setSuccessMsg('Vous avez été déconnecté avec succès.');
  }, [setCurrentUser]);

  useEffect(() => {
    if (isLogout) {
      handleLogout();
    }
  }, [isLogout, handleLogout]);

function withTimeout<T>(promise: PromiseLike<T>, ms = 1500): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout de ${ms}ms dépassé`)), ms)
    ),
  ]);
}

  // Sync Supabase session to local store without automatically bouncing to dashboard
  useEffect(() => {
    if (isLogout) return;
    const syncProfile = async () => {
      if (currentUser) return;
      try {
        const supabase = createClient();
        const { data: { user } } = await withTimeout(supabase.auth.getUser(), 1500);
        if (!user?.email) return;

        const cleanEmail = user.email.trim().toLowerCase();
        const { isSuperAdminEmail: isAdmin, syncUserProfile } = await import('@/lib/services/profiles.service');

        // Vérifier d'abord si un profil existe déjà avec un rôle défini en DB
        const { data: existingProfile } = await withTimeout(
          supabase
            .from('profiles')
            .select('id, email, full_name, role, avatar_url, organization_id, is_active, created_at')
            .eq('email', cleanEmail)
            .maybeSingle(),
          1500
        ).catch(() => ({ data: null }));

        const role: import('@/types').UserRole = isAdmin(cleanEmail)
          ? 'SUPER_ADMIN'
          : ((existingProfile?.role || user.user_metadata?.role || 'ORGANIZER') as import('@/types').UserRole);

        const profile = await syncUserProfile(
          user.id,
          cleanEmail,
          existingProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || cleanEmail.split('@')[0],
          role
        );

        if (existingProfile?.organization_id) {
          profile.organizationId = existingProfile.organization_id;
        }

        setCurrentUser(profile);
        addUser(profile);
        if (typeof document !== 'undefined') {
          document.cookie = 'jeltix_auth_session=true; path=/; max-age=604800; SameSite=Lax';
          localStorage.setItem('jeltix_current_user', JSON.stringify(profile));
        }

        // Only auto-redirect if explicitly flagged by oauth return param
        if (searchParams.get('oauth') === 'true') {
          const dest = profile.role === 'SELLER' ? '/sales/pos'
            : profile.role === 'CONTROLLER' ? '/scan'
            : redirectPath || '/dashboard';
          router.push(dest);
          router.refresh();
        }
      } catch (err) {
        // En cas de timeout ou absence de réseau, ignorer silencieusement
      }
    };
    syncProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMsg('Veuillez renseigner votre email et mot de passe.');
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      let activeUser: UserProfile;

      if (mode === 'register') {
        // 1. Inscription Organisateur sécurisée avec auto-confirmation d'email
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            fullName: fullName.trim() || undefined,
          }),
        });

        const regData = await regRes.json();
        if (!regRes.ok || !regData.success) {
          setErrorMsg(regData.error || 'Erreur lors de la création du compte.');
          setIsLoading(false);
          return;
        }

        // 2. Ouvrir la session Supabase cliente
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        activeUser = regData.user;
        setSuccessMsg(`Compte créé avec succès ! Bienvenue ${activeUser.fullName}.`);
      } else {
        // 1. Vérification préalable : validation email confirmée et récupération du rôle exact
        let verifiedProfile: UserProfile | null = null;
        try {
          const verifyRes = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail }),
          });

          if (verifyRes.ok) {
            const vData = await verifyRes.json();
            if (vData.success && vData.profile) {
              verifiedProfile = vData.profile;
            } else if (vData.isSuspended) {
              setErrorMsg(vData.error || 'Ce compte a été suspendu.');
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Notice verify check:', e);
        }

        // 2. Authentification par mot de passe Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (authError) {
          const msg =
            authError.message === 'Invalid login credentials'
              ? 'Email ou mot de passe incorrect. Vérifiez vos identifiants.'
              : authError.message === 'Email not confirmed'
              ? 'Validation de l’adresse email requise. Veuillez réessayer.'
              : authError.message || 'Identifiants invalides.';
          setErrorMsg(msg);
          setIsLoading(false);
          return;
        }

        // 3. Charger le profil réel depuis Supabase
        let dbProfile: any = null;
        if (authData.user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, organization_id, is_active')
            .eq('id', authData.user.id)
            .maybeSingle();
          dbProfile = prof;
        }

        const isAdmin = isSuperAdminEmail(cleanEmail);
        const role = isAdmin
          ? 'SUPER_ADMIN'
          : ((dbProfile?.role || verifiedProfile?.role || authData.user?.user_metadata?.role || 'ORGANIZER') as UserRole);

        activeUser = {
          id: dbProfile?.id || verifiedProfile?.id || authData.user?.id || `usr-${Date.now()}`,
          email: cleanEmail,
          fullName:
            dbProfile?.full_name ||
            verifiedProfile?.fullName ||
            authData.user?.user_metadata?.full_name ||
            cleanEmail.split('@')[0],
          role,
          organizationId: dbProfile?.organization_id || verifiedProfile?.organizationId || null,
          isActive: dbProfile ? dbProfile.is_active !== false : true,
          createdAt: dbProfile?.created_at || new Date().toISOString(),
        };

        setSuccessMsg(
          `Ravi de vous revoir ${activeUser.fullName} ! Redirection vers ${
            activeUser.role === 'SELLER'
              ? 'le Guichet Caisse'
              : activeUser.role === 'CONTROLLER'
              ? 'le Scanner de Billets'
              : 'le Tableau de bord'
          }…`
        );
      }

      // 4. Enregistrer la session dans le store et les cookies
      setCurrentUser(activeUser);
      addUser(activeUser);
      if (typeof document !== 'undefined') {
        document.cookie = 'jeltix_auth_session=true; path=/; max-age=604800; SameSite=Lax';
        localStorage.setItem('jeltix_current_user', JSON.stringify(activeUser));
      }

      // 5. Redirection stricte selon le rôle RBAC
      let destination = redirectPath;
      if (activeUser.role === 'SELLER') {
        destination = '/sales/pos';
      } else if (activeUser.role === 'CONTROLLER') {
        destination = '/scan';
      } else if (!destination || destination === '/login') {
        destination = getDefaultRouteForRole(activeUser.role);
      }

      setTimeout(() => {
        router.push(destination!);
        router.refresh();
      }, 350);
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue lors de l’opération.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://jeltix.vercel.app';
      const redirectUrl = `${origin}/auth/callback${redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : ''}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        if (error.message?.includes('provider is not enabled') || (error as any).code === 'validation_failed') {
          setErrorMsg(
            'Google OAuth n’a pas encore été activé dans votre console Supabase (Authentication > Providers > Google). En attendant, utilisez vos identifiants ou le bouton d’accès rapide 1-clic ci-dessous.'
          );
          setIsLoading(false);
          return;
        }
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setErrorMsg(err.message || 'Erreur lors de la redirection vers Google.');
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#F0F4F9] dark:bg-[#071229] text-slate-900 dark:text-white flex flex-col justify-between relative overflow-hidden transition-colors selection:bg-[#4EED15]/30">
      {/* Top Header Bar */}
      <header className="w-full max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between z-10">
        <Logo size="md" href="/" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#0038A8] dark:hover:text-[#4EED15] px-3.5 py-2 rounded-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span>Retour à l'accueil</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Center Container */}
      <main className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col items-center justify-center z-10">
        
        {/* The Curved Authentication Card (Desktop & Mobile Responsive) */}
        <div className="w-full max-w-[860px] bg-white dark:bg-[#0E1A33] rounded-[32px] sm:rounded-[40px] shadow-[0_20px_50px_rgba(0,56,168,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-200/90 dark:border-white/10 overflow-hidden relative min-h-[540px] flex flex-col md:flex-row transition-all duration-300">
          
          {/* ============================================================ */}
          {/* MOBILE ONLY: Top Curved Welcome Banner */}
          {/* ============================================================ */}
          <div className="md:hidden w-full bg-[#5B8DEF] dark:bg-[#1A4BB8] text-white p-6 pb-8 rounded-b-[42px] flex flex-col items-center text-center relative overflow-hidden shadow-inner">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? 'Bonjour & Bienvenue !' : 'Ravi de vous revoir !'}
            </h2>
            <p className="text-xs text-blue-100 mt-1 font-medium">
              {mode === 'login' ? "Vous n'avez pas encore de compte ?" : 'Vous avez déjà un compte ?'}
            </p>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="mt-3 px-7 py-1.5 rounded-full border border-white/80 hover:bg-white hover:text-[#5B8DEF] text-white text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
            >
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </div>

          {/* ============================================================ */}
          {/* FORM CONTAINER (Desktop Left / Mobile Bottom) */}
          {/* ============================================================ */}
          <div className="flex-1 p-6 sm:p-10 md:p-12 flex flex-col justify-center">
            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white text-center mb-6 tracking-tight">
              {mode === 'login' ? 'Connexion' : 'Inscription'}
            </h1>

            {/* Notification Alerts */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 max-w-sm mx-auto w-full">
              {/* Name field in Register mode */}
              {mode === 'register' && (
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nom complet ou Organisation"
                    className="w-full pl-4 pr-11 py-3 rounded-xl bg-[#F0F4F9] dark:bg-slate-800/80 border-none text-slate-800 dark:text-white placeholder-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#5B8DEF] transition-all"
                  />
                  <User className="w-4 h-4 text-slate-700 dark:text-slate-300 absolute right-4 top-1/2 -translate-y-1/2" />
                </div>
              )}

              {/* Email field */}
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Adresse Email"
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-[#F0F4F9] dark:bg-slate-800/80 border-none text-slate-800 dark:text-white placeholder-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#5B8DEF] transition-all"
                />
                <Mail className="w-4 h-4 text-slate-700 dark:text-slate-300 absolute right-4 top-1/2 -translate-y-1/2" />
              </div>

              {/* Password field */}
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-[#F0F4F9] dark:bg-slate-800/80 border-none text-slate-800 dark:text-white placeholder-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#5B8DEF] transition-all font-mono"
                />
                <Lock className="w-4 h-4 text-slate-700 dark:text-slate-300 absolute right-4 top-1/2 -translate-y-1/2" />
              </div>

              {/* Info message in Register mode: role is assigned by admin */}
              {mode === 'register' && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
                  🎪 Votre compte sera créé en tant qu'<strong>Organisateur</strong>.
                  Les rôles Vendeur (Caisse) et Contrôleur (Scanner) sont créés par l'Organisateur depuis son tableau de bord.
                </div>
              )}

              {/* Forgot Password Link (Only in Login mode) */}
              {mode === 'login' && (
                <div className="text-center pt-0.5">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Pour réinitialiser votre mot de passe, un lien sera envoyé à votre adresse email.');
                    }}
                    className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-[#5B8DEF] transition-colors"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
              )}

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[#6C97F3] hover:bg-[#5A87EC] text-white font-bold text-xs tracking-wide shadow-md shadow-[#6C97F3]/25 transition-all hover:scale-[0.99] active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Chargement...</span>
                  </span>
                ) : mode === 'login' ? (
                  'Se connecter'
                ) : (
                  'Créer mon compte'
                )}
              </button>

              {/* Social Platforms Separator */}
              <div className="relative my-3 pt-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold">
                  <span className="bg-white dark:bg-[#0E1A33] px-3 text-slate-400 dark:text-slate-500">
                    {mode === 'login' ? 'ou continuer avec' : 'ou s’inscrire avec'}
                  </span>
                </div>
              </div>

              {/* Unique Google Button */}
              <div className="flex justify-center pt-0.5">
                <button
                  type="button"
                  onClick={handleGoogleOAuth}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center justify-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                  title="Continuer avec Google"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continuer avec Google</span>
                </button>
              </div>
            </form>
          </div>

          {/* ============================================================ */}
          {/* DESKTOP ONLY: Right Curved Organic Banner */}
          {/* ============================================================ */}
          <div className="hidden md:flex w-5/12 bg-[#6C97F3] dark:bg-[#1A4BB8] text-white p-8 lg:p-12 flex-col items-center justify-center text-center relative overflow-hidden rounded-l-[140px] shadow-lg">
            {/* Subtle internal gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
                {mode === 'login' ? 'Bonjour & Bienvenue !' : 'Ravi de vous revoir !'}
              </h2>
              <p className="text-xs lg:text-sm text-blue-100 font-medium">
                {mode === 'login' ? "Vous n'avez pas encore de compte ?" : 'Vous avez déjà un compte ?'}
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="px-8 py-2 rounded-xl border-2 border-white hover:bg-white hover:text-[#6C97F3] text-white text-xs font-extrabold transition-all duration-200 shadow-sm active:scale-95 cursor-pointer"
                >
                  {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[1440px] mx-auto px-6 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500 z-10">
        <p>© 2026 FoutaTicket & Jël Tix • Plateforme de Billetterie & Sécurité</p>
      </footer>
    </div>
  );
}
