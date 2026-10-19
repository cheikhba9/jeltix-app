'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Smartphone,
  Clock,
  MessageCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

interface PaymentFailureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  errorMessage?: string | null;
  orderRef?: string | null;
  customerPhone?: string | null;
  amount?: number | null;
}

export function PaymentFailureModal({
  isOpen,
  onClose,
  onRetry,
  errorMessage,
  orderRef,
  customerPhone,
  amount,
}: PaymentFailureModalProps) {
  if (!isOpen) return null;

  const handleRetry = () => {
    onClose();
    if (onRetry) {
      onRetry();
    }
  };

  const supportWhatsAppUrl = `https://wa.me/221764027468?text=${encodeURIComponent(
    `Bonjour Jël Tix, j'ai rencontré un échec lors de mon paiement.${
      orderRef ? ` Référence: ${orderRef}.` : ''
    }${customerPhone ? ` Téléphone: ${customerPhone}.` : ''} Pouvez-vous m'assister ?`
  )}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="failure-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#0c1427] rounded-3xl border border-red-200 dark:border-red-900/40 shadow-2xl overflow-hidden transition-all scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top decorative gradient badge */}
        <div className="h-2 w-full bg-gradient-to-r from-red-500 via-amber-500 to-rose-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Fermer la boîte de dialogue"
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header Icon + Title */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-block text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50 font-mono mb-1">
                Transaction Interrompue
              </span>
              <h2
                id="failure-modal-title"
                className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight"
              >
                Le paiement a échoué
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                Votre transaction n’a pas pu être débitée ni confirmée par l'opérateur. Aucun montant n'a été prélevé sur votre compte.
              </p>
            </div>
          </div>

          {/* Specific error banner if provided */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 font-medium">
              <span className="font-bold">Détail :</span> {errorMessage}
            </div>
          )}

          {/* Causes fréquentes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-mono">
              <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>Pourquoi cela peut-il arriver ?</span>
            </h3>

            <div className="grid grid-cols-1 gap-2 text-xs">
              {/* Cause 1: Solde insuffisant */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    Solde Mobile Money ou bancaire insuffisant
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Le solde disponible sur votre compte Wave, Orange Money ou carte est inférieur au montant des billets{amount ? ` (${amount.toLocaleString('fr-FR')} FCFA)` : ''}.
                  </p>
                </div>
              </div>

              {/* Cause 2: Pas de compte Mobile Money ou mauvais numéro */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    Numéro sans compte Wave ou Orange Money actif
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Vérifiez que le numéro renseigné est bien actif et relié à l'application Mobile Money choisie.
                  </p>
                </div>
              </div>

              {/* Cause 3: Délai de confirmation dépassé ou refus */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5">
                <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    Délai d'autorisation dépassé ou transaction annulée
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    L'invite de paiement sur votre téléphone n'a pas été confirmée dans les délais impartis ou a été rejetée.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Que faire maintenant ? */}
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Conseils pour réussir votre achat :</span>
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800/90 dark:text-amber-300/80 pl-1">
              <li>Ouvrez votre application Wave ou déverrouillez votre téléphone avant de valider.</li>
              <li>Rechargez votre compte si votre solde est insuffisant.</li>
              <li>Vous pouvez également choisir un autre moyen de paiement (Orange Money, Wave, Free Money ou Carte).</li>
            </ul>
          </div>

          {/* Actions CTA */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#0038A8]/20 transition-all hover:scale-[0.99] active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Réessayer le Paiement</span>
            </button>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer text-center"
              >
                Modifier mes informations
              </button>

              <a
                href={supportWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors text-center"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Support WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
