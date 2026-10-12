'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store/jeltix-store';
import { UserRole, UserProfile } from '@/types';
import { syncUserProfile, fetchAllProfilesAdmin, isSuperAdminEmail } from '@/lib/services/profiles.service';
import { InviteUserSchema } from '@/lib/validations';
import {
  createTeamMember,
  getTeamMembers,
  toggleTeamMemberStatus,
  removeFromTeam,
  changeUserPassword,
} from '@/lib/services/team-management.service';
import Link from 'next/link';
import {
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  X,
  Power,
  Lock,
  ArrowLeft,
  Users,
  RefreshCw,
  Trash2,
  QrCode,
  ShoppingCart,
  AlertTriangle,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Shared badge helper
// ─────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: UserRole }) {
  switch (role) {
    case 'SUPER_ADMIN':
      return <span className="px-2.5 py-1 rounded-full bg-primary text-white font-black text-[10px] font-mono">SUPER ADMIN</span>;
    case 'ORGANIZER':
      return <span className="px-2.5 py-1 rounded-full bg-[#2CA808] dark:bg-[#4EED15] text-white dark:text-[#002D8C] font-black text-[10px] font-mono">ORGANISATEUR</span>;
    case 'SELLER':
      return <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-black text-[10px] font-mono">VENDEUR GUICHET</span>;
    case 'CONTROLLER':
      return <span className="px-2.5 py-1 rounded-full bg-[#0038A8]/15 text-[#0038A8] dark:text-[#4EED15] font-black text-[10px] font-mono">CONTRÔLEUR PORTE</span>;
    case 'FINANCE':
      return <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] font-mono">FINANCE &amp; AUDIT</span>;
    default:
      return <span className="px-2.5 py-1 rounded-full bg-surface-variant text-on-surface-variant font-bold text-[10px] font-mono">{role}</span>;
  }
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${active ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-slate-400'}`} />
      {active ? 'Actif' : 'Désactivé'}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Toast component
// ─────────────────────────────────────────────────────────────
function Toast({ message, type = 'success' }: { message: string; type?: 'success' | 'error' }) {
  return (
    <div className={`fixed top-20 left-4 right-4 sm:left-auto sm:top-24 sm:right-8 z-50 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border animate-in fade-in slide-in-from-right-4 duration-300 ${type === 'success' ? 'bg-[#0038A8] text-white border-white/20' : 'bg-red-600 text-white border-red-400/30'}`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4 text-[#4EED15]" /> : <AlertTriangle className="w-4 h-4 text-red-200" />}
      <span className="text-xs font-bold">{message}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal — Modifier le mot de passe (Admin & Organisateur)
// ─────────────────────────────────────────────────────────────
interface ChangePasswordModalProps {
  targetUser: { id?: string; fullName: string; email: string; role: string };
  callerEmail?: string;
  isSuperAdmin?: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ChangePasswordModal({
  targetUser,
  callerEmail,
  isSuperAdmin = false,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const res = await changeUserPassword({
      targetEmail: targetUser.email,
      targetUserId: targetUser.id,
      newPassword,
      callerEmail,
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erreur lors de la modification.');
      return;
    }

    onSuccess(res.message || 'Mot de passe mis à jour avec succès.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0B1936] text-slate-900 dark:text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">Changer le mot de passe</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isSuperAdmin ? 'Super Administration Jël Tix' : 'Gestion d’équipe Organisateur'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target user recap */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0038A8]/10 text-[#0038A8] dark:text-[#4EED15] font-black flex items-center justify-center text-xs shrink-0">
              {targetUser.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                {targetUser.fullName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                {targetUser.email}
              </p>
            </div>
          </div>
          <RoleBadge role={targetUser.role as UserRole} />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
              Nouveau mot de passe *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
              Confirmer le mot de passe *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Répétez le nouveau mot de passe"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary text-xs"
            />
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {isSuperAdmin
              ? "En tant qu'Administrateur, ce mot de passe sera immédiatement actif pour cet utilisateur sur l'ensemble de la plateforme."
              : "En tant qu'Organisateur, vous attribuez ce mot de passe à votre agent de terrain (contrôleur ou guichetier)."}
          </p>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white font-bold cursor-pointer shadow-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement…</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Définir le mot de passe</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ORGANIZER — Team Management View
// ─────────────────────────────────────────────────────────────
function OrganizerTeamView({
  organizerId,
  organizerName,
  organizerEmail,
}: {
  organizerId: string;
  organizerName: string;
  organizerEmail?: string;
}) {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserProfile | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SELLER' | 'CONTROLLER'>('CONTROLLER');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const data = await getTeamMembers(organizerId, organizerEmail);
    setMembers(data);
    setLoading(false);
  }, [organizerId, organizerEmail]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const result = await createTeamMember({
      organizerId,
      organizerEmail,
      email,
      fullName,
      role,
      phone: phone || undefined,
      password: password.trim() || undefined,
    });

    if (result.success && result.profile) {
      setMembers((prev) => [result.profile!, ...prev]);
      showToast(`${fullName} ajouté·e à votre équipe ! Mot de passe : ${result.defaultPassword || 'Jeltix2026!'}`);
      setShowModal(false);
      setFullName(''); setEmail(''); setPhone(''); setPassword('');
    } else {
      showToast(result.error || 'Erreur lors de la création.', 'error');
    }
    setSubmitting(false);
  };

  const handleToggleStatus = async (member: UserProfile) => {
    const result = await toggleTeamMemberStatus(organizerId, member.id);
    if (result.success) {
      setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, isActive: !m.isActive } : m));
      showToast(`Statut de ${member.fullName} modifié.`);
    } else {
      showToast(result.error || 'Erreur.', 'error');
    }
  };

  const handleRemove = async (member: UserProfile) => {
    if (!confirm(`Retirer ${member.fullName} de l'équipe ? Son compte Jël Tix sera conservé mais désassocié.`)) return;
    const result = await removeFromTeam(organizerId, member.id);
    if (result.success) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      showToast(`${member.fullName} retiré·e de l'équipe.`);
    } else {
      showToast(result.error || 'Erreur.', 'error');
    }
  };

  const sellers = members.filter((m) => m.role === 'SELLER');
  const controllers = members.filter((m) => m.role === 'CONTROLLER');

  return (
    <div className="flex flex-col w-full gap-6">
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface">Mon Équipe</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Vendeurs guichet et contrôleurs de porte rattachés à <span className="font-bold text-primary">{organizerName}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadMembers}
            disabled={loading}
            className="p-2.5 rounded-xl border border-outline-variant/40 bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-primary-hover hover:scale-[0.98] transition-all shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Ajouter un Membre</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Équipe', value: members.length, icon: <Users className="w-4 h-4" />, color: 'text-primary bg-primary/10' },
          { label: 'Vendeurs Guichet', value: sellers.length, icon: <ShoppingCart className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'Contrôleurs Porte', value: controllers.length, icon: <QrCode className="w-4 h-4" />, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-container rounded-2xl border border-outline-variant/30 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-extrabold text-on-surface font-mono">{stat.value}</p>
              <p className="text-[11px] text-on-surface-variant">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Members Table */}
      <div className="bg-surface-container rounded-3xl border border-outline-variant/30 overflow-hidden shadow-sm">
        <div className="p-4 bg-surface-container-low border-b border-outline-variant/20 flex justify-between items-center">
          <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Membres de l'équipe
          </h2>
          <span className="text-xs text-on-surface-variant font-mono">{members.length} membre{members.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement de l'équipe…</span>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary/50" />
            </div>
            <p className="font-bold text-on-surface text-sm">Aucun membre pour l'instant</p>
            <p className="text-xs text-on-surface-variant max-w-xs">
              Ajoutez vos vendeurs de guichet et contrôleurs de porte. Ils recevront un accès sécurisé à leurs outils dédiés.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer hover:bg-primary-hover transition-colors"
            >
              Ajouter le premier membre
            </button>
          </div>
        ) : (
          <>
            {/* Vue Mobile — cartes */}
            <div className="md:hidden divide-y divide-outline-variant/20">
              {members.map((m) => (
                <div key={m.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl font-black flex items-center justify-center text-xs shrink-0 ${m.role === 'SELLER' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'}`}>
                        {m.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-on-surface text-sm truncate">{m.fullName}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono truncate">{m.email}</p>
                      </div>
                    </div>
                    <StatusDot active={m.isActive} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <RoleBadge role={m.role} />
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPasswordTarget(m)}
                        className="px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 text-amber-700 dark:text-amber-300 font-bold text-[10px] border border-amber-200 dark:border-amber-800/40 cursor-pointer transition-colors inline-flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>MDP</span>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(m)}
                        className="px-2 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-[10px] border border-outline-variant/30 cursor-pointer transition-colors inline-flex items-center gap-1"
                      >
                        <Power className="w-3 h-3 text-primary" />
                        <span>{m.isActive ? 'Désactiver' : 'Activer'}</span>
                      </button>
                      <button
                        onClick={() => handleRemove(m)}
                        className="p-1.5 rounded-lg text-red-500/70 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                        title="Retirer de l'équipe"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Vue Desktop — table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant border-b border-outline-variant/20 uppercase tracking-wider font-mono">
                    <th className="p-4">Membre</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Téléphone</th>
                    <th className="p-4">Rôle</th>
                    <th className="p-4 text-center">Statut</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-container-high/50 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl font-black flex items-center justify-center text-xs shrink-0 ${m.role === 'SELLER' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'}`}>
                            {m.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-extrabold text-on-surface text-sm">{m.fullName}</p>
                            <p className="text-[10px] text-on-surface-variant font-mono">
                              Ajouté le {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-on-surface-variant">{m.email}</td>
                      <td className="p-4 font-mono text-on-surface-variant">{m.phone || '—'}</td>
                      <td className="p-4"><RoleBadge role={m.role} /></td>
                      <td className="p-4 text-center"><StatusDot active={m.isActive} /></td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPasswordTarget(m)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold text-[11px] border border-amber-200 dark:border-amber-800/40 cursor-pointer transition-colors inline-flex items-center gap-1 shadow-xs"
                            title="Changer le mot de passe du membre"
                          >
                            <KeyRound className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Mot de passe</span>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(m)}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-[11px] border border-outline-variant/30 cursor-pointer transition-colors inline-flex items-center gap-1"
                            title={m.isActive ? 'Désactiver' : 'Activer'}
                          >
                            <Power className="w-3 h-3 text-primary" />
                            <span>{m.isActive ? 'Désactiver' : 'Activer'}</span>
                          </button>
                          <button
                            onClick={() => handleRemove(m)}
                            className="p-1.5 rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Retirer de l'équipe"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Info Banner */}
      <div className="rounded-2xl border border-[#0038A8]/20 bg-[#0038A8]/5 p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-on-surface-variant space-y-1">
          <p className="font-bold text-on-surface">Comment ça marche ?</p>
          <p>Les membres pré-enregistrés ici recevront automatiquement leur rôle (Vendeur ou Contrôleur) lors de leur première connexion avec leur email.</p>
          <p>Un <span className="font-bold text-emerald-600">Vendeur Guichet</span> accède au POS Caisse. Un <span className="font-bold text-violet-600">Contrôleur Porte</span> accède au scanner QR.</p>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B1936] text-slate-900 dark:text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black">Ajouter un Membre</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Vendeur guichet ou contrôleur de porte</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              {/* Role selector */}
              <div className="grid grid-cols-2 gap-2">
                {(['CONTROLLER', 'SELLER'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-3 px-3 rounded-xl border-2 text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${role === r ? (r === 'CONTROLLER' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300') : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-600 dark:text-slate-300'}`}
                  >
                    {r === 'CONTROLLER' ? <QrCode className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                    <span>{r === 'CONTROLLER' ? 'Contrôleur Porte' : 'Vendeur Guichet'}</span>
                  </button>
                ))}
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">Nom Complet *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Babacar Ndiaye"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary text-xs"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">Email Professionnel *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="babacar@exemple.sn"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary text-xs"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">Téléphone <span className="font-normal text-slate-400">(optionnel)</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+221 77 000 00 00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary text-xs"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">
                  Mot de passe initial <span className="font-normal text-slate-400">(optionnel, défaut : Jeltix2026!)</span>
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Jeltix2026!"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary text-xs font-mono"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white font-bold cursor-pointer shadow-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Enregistrement…</span></> : <><UserPlus className="w-4 h-4" /><span>Ajouter à l'équipe</span></>}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {passwordTarget && (
        <ChangePasswordModal
          targetUser={passwordTarget}
          callerEmail={organizerEmail}
          isSuperAdmin={false}
          onClose={() => setPasswordTarget(null)}
          onSuccess={(msg) => showToast(msg, 'success')}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUPER_ADMIN — Global User Management View
// ─────────────────────────────────────────────────────────────
function SuperAdminUsersView() {
  const { toggleUserStatus, currentUser } = useStore();
  const [dbUsers, setDbUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [passwordTarget, setPasswordTarget] = useState<UserProfile | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('ORGANIZER');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadDbUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllProfilesAdmin();
      if (data && Array.isArray(data)) {
        setDbUsers(data);
      }
    } catch (err) {
      console.warn('Load profiles error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDbUsers();
  }, [loadDbUsers]);

  // Statistics
  const totalCount = dbUsers.length;
  const superAdminCount = dbUsers.filter((u) => u.role === 'SUPER_ADMIN').length;
  const organizerCount = dbUsers.filter((u) => u.role === 'ORGANIZER').length;
  const controllerCount = dbUsers.filter((u) => u.role === 'CONTROLLER').length;
  const sellerCount = dbUsers.filter((u) => u.role === 'SELLER').length;
  const financeCount = dbUsers.filter((u) => u.role === 'FINANCE').length;

  // Filtered display
  const displayUsers = dbUsers.filter((usr) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      usr.fullName.toLowerCase().includes(term) ||
      usr.email.toLowerCase().includes(term) ||
      (usr.phone && usr.phone.toLowerCase().includes(term)) ||
      (usr.organization && usr.organization.toLowerCase().includes(term));

    const matchesRole = roleFilter === 'ALL' || usr.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = InviteUserSchema.safeParse({ fullName, email, phone, role, organization });
    if (!validation.success) {
      showToast(validation.error.issues[0]?.message || 'Informations invalides', 'error');
      return;
    }
    const validData = validation.data;
    setSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: validData.fullName,
          email: validData.email,
          phone: validData.phone,
          role: validData.role,
          organization: validData.organization,
          password: password.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Compte ${validData.fullName} créé avec succès ! Mot de passe : ${data.defaultPassword || 'Jeltix2026!'}`, 'success');
        setShowInviteModal(false);
        setFullName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setOrganization('');
        loadDbUsers();
      } else {
        showToast(data.error || 'Erreur lors de la création', 'error');
      }
    } catch {
      showToast('Erreur de connexion au serveur.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (usr: UserProfile) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: usr.id, isActive: !usr.isActive }),
      });
      if (res.ok) {
        setDbUsers((prev) => prev.map((u) => (u.id === usr.id ? { ...u, isActive: !u.isActive } : u)));
        showToast(`Statut de ${usr.fullName} modifié.`, 'success');
        return;
      }
    } catch {}
    toggleUserStatus(usr.id);
    showToast(`Statut de ${usr.fullName} modifié.`, 'success');
  };

  const handleDeleteUser = async (usr: UserProfile) => {
    if (isSuperAdminEmail(usr.email)) {
      showToast('Action impossible : les comptes Super Administrateur sont protégés.', 'error');
      return;
    }

    if (!window.confirm(`Confirmez-vous la suppression définitive du compte de ${usr.fullName} (${usr.email}) ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users?userId=${usr.id}&email=${encodeURIComponent(usr.email)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Compte ${usr.fullName} supprimé avec succès.`, 'success');
        setDbUsers((prev) => prev.filter((u) => u.id !== usr.id));
      } else {
        showToast(data.error || 'Erreur lors de la suppression.', 'error');
      }
    } catch {
      showToast('Erreur lors de la suppression.', 'error');
    }
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black tracking-wider uppercase font-mono">
              Contrôle Global Plateforme
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">Gestion des Utilisateurs &amp; Rôles</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Vue exhaustive de tous les comptes enregistrés sur Jël Tix : Super Admins, Organisateurs, Vendeurs et Contrôleurs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDbUsers}
            disabled={loading}
            className="p-2.5 rounded-xl border border-outline-variant/40 bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer"
            title="Actualiser la liste"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:scale-[0.98] transition-transform shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Créer un Compte</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-on-surface-variant">Total Comptes</p>
            <p className="text-xl font-black text-on-surface">{totalCount}</p>
          </div>
        </div>
        <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-on-surface-variant">Organisateurs</p>
            <p className="text-xl font-black text-on-surface">{organizerCount}</p>
          </div>
        </div>
        <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-on-surface-variant">Contrôleurs &amp; Vendeurs</p>
            <p className="text-xl font-black text-on-surface">{controllerCount + sellerCount}</p>
          </div>
        </div>
        <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-on-surface-variant">Super Admins</p>
            <p className="text-xl font-black text-on-surface">{superAdminCount}</p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-surface-container rounded-3xl border border-outline-variant/30 overflow-hidden shadow-sm">
        {/* Filter & Search Bar */}
        <div className="p-4 bg-surface-container-low border-b border-surface-container-high flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, email, téléphone, organisation…"
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:ring-2 focus:ring-primary"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { label: 'Tous', value: 'ALL', count: totalCount },
              { label: 'Super Admins', value: 'SUPER_ADMIN', count: superAdminCount },
              { label: 'Organisateurs', value: 'ORGANIZER', count: organizerCount },
              { label: 'Contrôleurs', value: 'CONTROLLER', count: controllerCount },
              { label: 'Vendeurs', value: 'SELLER', count: sellerCount },
              ...(financeCount > 0 ? [{ label: 'Finance', value: 'FINANCE' as const, count: financeCount }] : []),
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setRoleFilter(tab.value as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  roleFilter === tab.value
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    roleFilter === tab.value
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-mono">Chargement des comptes de la plateforme…</p>
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              {searchTerm || roleFilter !== 'ALL'
                ? 'Aucun utilisateur ne correspond à vos critères de recherche.'
                : 'Aucun compte trouvé sur la plateforme.'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant border-b border-surface-container-high uppercase tracking-wider font-mono">
                  <th className="p-4">Utilisateur</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Organisation / Équipe</th>
                  <th className="p-4">Rôle</th>
                  <th className="p-4 text-center">Statut</th>
                  <th className="p-4">Créé le</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {displayUsers.map((usr) => {
                  const isUserSuperAdmin = isSuperAdminEmail(usr.email);
                  return (
                    <tr key={usr.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-black flex items-center justify-center text-xs flex-shrink-0">
                            {usr.fullName ? usr.fullName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-extrabold text-on-surface text-sm">{usr.fullName}</p>
                            <p className="text-[11px] text-on-surface-variant font-mono">{usr.phone || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-mono text-on-surface-variant">{usr.email}</td>
                      <td className="p-4 text-xs font-medium text-on-surface">
                        {usr.organization || (isUserSuperAdmin ? 'Jël Tix SAS' : 'Plateforme')}
                      </td>
                      <td className="p-4">
                        <RoleBadge role={usr.role} />
                      </td>
                      <td className="p-4 text-center">
                        <StatusDot active={usr.isActive} />
                      </td>
                      <td className="p-4 text-xs text-on-surface-variant font-mono whitespace-nowrap">
                        {usr.createdAt
                          ? new Date(usr.createdAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {usr.role === 'ORGANIZER' && (
                            <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800/40 inline-flex items-center gap-1 shadow-xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Approuvé</span>
                            </span>
                          )}
                          <button
                            onClick={() => setPasswordTarget(usr)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold text-[11px] border border-amber-200 dark:border-amber-800/40 cursor-pointer transition-colors inline-flex items-center gap-1 shadow-xs"
                            title="Modifier le mot de passe"
                          >
                            <KeyRound className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Mot de passe</span>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(usr)}
                            className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-[11px] border border-outline-variant/30 cursor-pointer transition-colors inline-flex items-center gap-1"
                            title={usr.isActive ? 'Désactiver le compte' : 'Activer le compte'}
                          >
                            <Power className="w-3 h-3 text-primary" />
                            <span>{usr.isActive ? 'Désactiver' : 'Activer'}</span>
                          </button>
                          {!isUserSuperAdmin && (
                            <button
                              onClick={() => handleDeleteUser(usr)}
                              className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Supprimer définitivement ce compte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Créer / Inviter un Utilisateur */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B1936] text-slate-900 dark:text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black">Créer un Nouveau Compte</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ajoute directement un utilisateur avec ses accès sur la plateforme.
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">Nom Complet *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Babacar Ndiaye"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">Email Professionnel *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: babacar@jeltix.sn"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">Numéro de Téléphone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+221 77..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">Rôle Système *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none font-bold cursor-pointer"
                  >
                    <option value="ORGANIZER">Organisateur</option>
                    <option value="CONTROLLER">Contrôleur Porte</option>
                    <option value="SELLER">Vendeur Guichet</option>
                    <option value="FINANCE">Finance &amp; Audit</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">Organisation / Poste</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Stade Abdoulaye Wade"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">
                  Mot de passe initial <span className="font-normal text-slate-400">(défaut : Jeltix2026!)</span>
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Jeltix2026!"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white font-bold cursor-pointer shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Créer le Compte</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 font-bold cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Change Modal for Super Admin */}
      {passwordTarget && (
        <ChangePasswordModal
          targetUser={passwordTarget}
          callerEmail={currentUser?.email}
          isSuperAdmin={true}
          onClose={() => setPasswordTarget(null)}
          onSuccess={(msg) => {
            showToast(msg);
            loadDbUsers();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Root Page — Strictly reserved for SUPER_ADMIN per RBAC matrix
// ─────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { currentUser } = useStore();
  const [adminTab, setAdminTab] = useState<'GLOBAL' | 'TEAM'>('GLOBAL');

  const isSuper =
    currentUser?.role === 'SUPER_ADMIN' ||
    (Boolean(currentUser?.email) && isSuperAdminEmail(currentUser!.email));

  // Vue Organisateur : Gestion directe de son équipe (Vendeurs & Contrôleurs)
  if (currentUser?.role === 'ORGANIZER') {
    return (
      <div className="flex flex-col gap-6">
        <OrganizerTeamView
          organizerId={currentUser.id}
          organizerName={currentUser.organization || currentUser.fullName || 'Mon Organisation'}
          organizerEmail={currentUser.email}
        />
      </div>
    );
  }

  // Accès restreint pour les vendeurs et contrôleurs
  if (currentUser && !isSuper) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-on-surface mb-2">Accès Restreint</h2>
        <p className="text-xs text-on-surface-variant max-w-md mb-6 leading-relaxed">
          La gestion de l'équipe et des comptes est réservée exclusivement aux Organisateurs et Super Administrateurs de Jël Tix.
        </p>
        <Link
          href={currentUser?.role === 'SELLER' ? '/sales/pos' : currentUser?.role === 'CONTROLLER' ? '/scan' : '/dashboard'}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retourner à mon espace ({currentUser?.role === 'SELLER' ? 'Guichet POS' : currentUser?.role === 'CONTROLLER' ? 'Scanner' : 'Tableau de bord'})</span>
        </Link>
      </div>
    );
  }

  // Super Admin view: allows managing all platform accounts or viewing organizer team structure
  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Tabs for Super Admin */}
      <div className="inline-flex p-1 rounded-2xl bg-surface-container border border-outline-variant/30 self-start">
        <button
          onClick={() => setAdminTab('GLOBAL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
            adminTab === 'GLOBAL'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Tous les Comptes Plateforme</span>
        </button>
        <button
          onClick={() => setAdminTab('TEAM')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
            adminTab === 'TEAM'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Mon Équipe d'Organisation</span>
        </button>
      </div>

      {adminTab === 'GLOBAL' ? (
        <SuperAdminUsersView />
      ) : (
        <OrganizerTeamView
          organizerId={currentUser?.id || 'admin-super'}
          organizerName={currentUser?.fullName || 'Super Admin'}
          organizerEmail={currentUser?.email || 'admin@jeltix.sn'}
        />
      )}
    </div>
  );
}


