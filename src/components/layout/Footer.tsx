import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function Footer() {
  return (
    <footer className="w-full bg-white dark:bg-[#040915] text-slate-800 dark:text-white border-t border-slate-200 dark:border-white/10 mt-auto pt-12 pb-8 shadow-xs transition-colors">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-200 dark:border-white/10">
          {/* Brand & Slogan Column */}
          <div className="space-y-4 md:col-span-1">
            <div className="bg-slate-100 dark:bg-white/5 p-2 rounded-2xl inline-block shadow-xs border border-slate-200 dark:border-white/10">
              <Logo size="md" href="/" />
            </div>
            <p className="text-xs text-slate-600 dark:text-white/70 leading-relaxed max-w-xs mt-3">
              La plateforme de référence pour la billetterie digitale, le contrôle d'accès anti-fraude et l'encaissement instantané au Sénégal et en Afrique de l'Ouest.
            </p>
            <div className="flex items-center gap-2 pt-2 text-xs font-bold text-[#2CA808] dark:text-[#4EED15]">
              <span className="w-2 h-2 rounded-full bg-[#2CA808] dark:bg-[#4EED15] animate-pulse" />
              <span>Système Opérationnel 99.99%</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 font-mono">
              Spectateurs & Fans
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-white/70 font-medium">
              <li>
                <Link href="/" className="hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors">
                  Tous les Événements
                </Link>
              </li>
              <li>
                <Link href="/discover" className="hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors">
                  Voir tous les événements
                </Link>
              </li>
              <li>
                <Link href="/tickets" className="hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors">
                  Vérifier / Télécharger mon billet
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors">
                  Guide d'achat Mobile Money
                </Link>
              </li>
            </ul>
          </div>

          {/* Organizers & Field Operators */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 font-mono">
              Organisateurs & Équipes
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-white/70 font-medium">
              <li>
                <Link href="/dashboard" className="hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors">
                  Tableau de Bord Backoffice
                </Link>
              </li>
              <li>
                <Link href="/events/new" className="hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors">
                  Publier un Événement
                </Link>
              </li>
              <li>
                <Link href="/sales/pos" className="hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors">
                  Caisse Guichet (POS)
                </Link>
              </li>
              <li>
                <Link href="/scan" target="_blank" className="hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors">
                  Scanner PWA Contrôleur
                </Link>
              </li>
            </ul>
          </div>

          {/* Security & Payment Badges */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 font-mono">
              Moyens de Paiement Sécurisés
            </h4>
            <p className="text-xs text-slate-600 dark:text-white/70 mb-3 font-medium">
              Encaissement instantané 100% sécurisé via les opérateurs leaders :
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-bold text-xs flex items-center gap-1 border border-slate-200 dark:border-white/10">
                🌊 Wave
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-[#FF7900] font-bold text-xs flex items-center gap-1 border border-orange-200 dark:border-orange-800/50">
                🟠 Orange Money
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 text-[#FF2D55] font-bold text-xs flex items-center gap-1 border border-red-200 dark:border-red-800/50">
                🔴 Free Money
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-950/30 text-[#2CA808] dark:text-[#4EED15] font-bold text-xs flex items-center gap-1 border border-green-200 dark:border-green-800/50">
                💳 Carte Bancaire
              </span>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-white/50 font-semibold">
              <span className="material-symbols-outlined text-[16px] text-[#2CA808] dark:text-[#4EED15]">verified_user</span>
              <span>Chiffrement SSL & QR Code Dynamique Anti-Copie</span>
            </div>
          </div>
        </div>

        {/* Bottom bar with Theme Toggle */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-white/50 font-medium">
          <p className="font-mono">
            © 2026 Jël Tix • Saisissez • Réservez • Profitez. Tous droits réservés.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ThemeToggle showLabel={true} />
            <Link href="#" className="hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors">
              Mentions Légales
            </Link>
            <a
              href="https://wa.me/221764027468"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-white hover:text-[#0038A8] dark:hover:text-[#4EED15] transition-colors"
              title="Support WhatsApp officiel Jël Tix"
            >
              <span>Support WhatsApp :</span>
              <span className="font-mono text-[#0038A8] dark:text-[#4EED15]">+221 76 402 74 68</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
