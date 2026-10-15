'use client';

import { useState, useMemo, useCallback } from 'react';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatRelativeTime } from '@/lib/utils/format';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Lock,
  Search,
  Filter,
  Download,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  SlidersHorizontal,
  FileSpreadsheet,
  DoorOpen,
  UserCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { ScanLog } from '@/types';

type FilterResult = 'ALL' | 'VALID' | 'ALREADY_SCANNED' | 'INVALID';

export default function ScansPage() {
  const { scans, events, currentUser } = useJeltixStore();
  const { addToast } = useToast();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrganizer = currentUser?.role === 'ORGANIZER';
  const isController = currentUser?.role === 'CONTROLLER';
  const isAuthorized = isSuperAdmin || isOrganizer || isController;

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterResult>('ALL');
  const [selectedGate, setSelectedGate] = useState<string>('ALL');
  const [selectedScan, setSelectedScan] = useState<ScanLog | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Scans strictement scopés par rôle (0 si nouvel organisateur sans événement)
  const scopedScans = useMemo(() => {
    if (isSuperAdmin) return scans;
    if (isOrganizer) {
      const orgEvents = events.filter((e) => e.organizerId === currentUser?.id);
      const orgEventIds = new Set(orgEvents.map((e) => e.id));
      return scans.filter((s) => orgEventIds.has(s.eventId));
    }
    if (isController) {
      const orgId = currentUser?.organizationId;
      if (orgId) {
        const orgEvents = events.filter((e) => e.organizerId === orgId);
        const orgEventIds = new Set(orgEvents.map((e) => e.id));
        return scans.filter((s) => orgEventIds.has(s.eventId) || s.controllerName === currentUser?.fullName);
      }
      return scans;
    }
    return [];
  }, [scans, events, isSuperAdmin, isOrganizer, isController, currentUser]);

  // Gates list extracted from scans
  const availableGates = useMemo(() => {
    const set = new Set<string>();
    scopedScans.forEach((s) => {
      if (s.gate) set.add(s.gate);
    });
    return Array.from(set);
  }, [scopedScans]);

  // Filtered scans
  const filteredScans = useMemo(() => {
    return scopedScans.filter((scan) => {
      // Status filter
      if (statusFilter !== 'ALL' && scan.result !== statusFilter) {
        return false;
      }
      // Gate filter
      if (selectedGate !== 'ALL' && scan.gate !== selectedGate) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const codeMatch = scan.ticketCode?.toLowerCase().includes(query);
        const typeMatch = scan.ticketTypeName?.toLowerCase().includes(query);
        const controllerMatch = scan.controllerName?.toLowerCase().includes(query);
        const gateMatch = scan.gate?.toLowerCase().includes(query);
        if (!codeMatch && !typeMatch && !controllerMatch && !gateMatch) {
          return false;
        }
      }
      return true;
    });
  }, [scopedScans, statusFilter, selectedGate, searchQuery]);

  // Metrics
  const totalScans = scopedScans.length;
  const validScans = scopedScans.filter((s) => s.result === 'VALID').length;
  const duplicateScans = scopedScans.filter((s) => s.result === 'ALREADY_SCANNED').length;
  const invalidScans = scopedScans.filter((s) => s.result === 'INVALID').length;
  const fraudScans = duplicateScans + invalidScans;
  const successRate = totalScans > 0 ? Math.round((validScans / totalScans) * 100) : 100;

  // Export CSV handler
  const handleExportCSV = useCallback(() => {
    setIsExporting(true);
    try {
      if (scans.length === 0) {
        addToast({
          type: 'warning',
          title: 'Aucune donnée',
          message: 'Il n\'y a aucun scan à exporter pour le moment.',
        });
        return;
      }

      const headers = ['ID', 'Code Billet', 'Type Billet', 'Porte', 'Contrôleur', 'Résultat', 'Horodatage ISO'];
      const rows = filteredScans.map((s) => [
        s.id,
        `"${s.ticketCode}"`,
        `"${s.ticketTypeName || 'Standard'}"`,
        `"${s.gate || 'Porte A'}"`,
        `"${s.controllerName || 'Agent'}"`,
        s.result,
        new Date(s.scannedAt).toISOString(),
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `jeltix-audit-scans-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast({
        type: 'success',
        title: 'Export Réussi',
        message: `${filteredScans.length} enregistrements exportés en CSV.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Erreur d\'exportation',
        message: 'Impossible de générer le fichier CSV.',
      });
    } finally {
      setIsExporting(false);
    }
  }, [filteredScans, scans.length, addToast]);

  if (currentUser && !isAuthorized) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 ring-8 ring-amber-500/10">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-on-surface mb-1">Accès Restreint aux Scans</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mb-5 leading-relaxed">
          Le journal des flux d'entrées et contrôles d'accès est réservé aux Agents de Contrôle et Super Administrateurs.
        </p>
        <Link
          href={currentUser.role === 'SELLER' ? '/sales/pos' : '/dashboard'}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold inline-flex items-center gap-2 hover:scale-[0.98] transition-transform shadow-md"
        >
          <span>Retourner à mon espace</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface-container/60 p-6 rounded-3xl border border-outline-variant/30 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4EED15] animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-tertiary">
              Audit Contrôle d'Accès Temps Réel
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">Journal des Scans & Portes</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Surveillance continue des tourniquets, vérification anti-fraude et détection des doubles passages.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportCSV}
            disabled={isExporting || scans.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/40 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-40"
            title="Exporter l'historique en CSV"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Exporter CSV ({filteredScans.length})</span>
          </button>

          <Link
            href="/scan"
            target="_blank"
            className="bg-primary hover:bg-primary-hover text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
          >
            <QrCode className="w-4 h-4 text-[#4EED15]" />
            <span>Ouvrir Scanner Contrôleur PWA</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </Link>
        </div>
      </div>

      {/* 4 Interactive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total card */}
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-primary/5 dark:bg-primary/10 border-primary ring-2 ring-primary/20 shadow-md'
              : 'bg-surface-container border-outline-variant/30 hover:border-outline-variant'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider font-bold">
              Total Passages
            </span>
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <QrCode className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-on-surface font-mono">{totalScans}</p>
          <p className="text-[11px] text-on-surface-variant font-mono mt-1">
            {scans.length > 0 ? 'Flux continu actif' : 'En attente de scans'}
          </p>
        </button>

        {/* Valid card */}
        <button
          onClick={() => setStatusFilter('VALID')}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'VALID'
              ? 'bg-tertiary/5 dark:bg-tertiary/10 border-tertiary ring-2 ring-tertiary/20 shadow-md'
              : 'bg-surface-container border-outline-variant/30 hover:border-outline-variant'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-tertiary uppercase tracking-wider font-bold">
              Entrées Validées
            </span>
            <span className="p-2 rounded-xl bg-tertiary/10 text-tertiary">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-tertiary font-mono">{validScans}</p>
          <p className="text-[11px] text-tertiary/80 font-mono mt-1">
            {successRate}% de conformité
          </p>
        </button>

        {/* Duplicate card */}
        <button
          onClick={() => setStatusFilter('ALREADY_SCANNED')}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'ALREADY_SCANNED'
              ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
              : 'bg-surface-container border-outline-variant/30 hover:border-outline-variant'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold">
              Doublons / Re-scans
            </span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {duplicateScans}
          </p>
          <p className="text-[11px] text-on-surface-variant font-mono mt-1">
            Rejets double entrée
          </p>
        </button>

        {/* Invalid / Fraud card */}
        <button
          onClick={() => setStatusFilter('INVALID')}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'INVALID'
              ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500 ring-2 ring-red-500/20 shadow-md'
              : 'bg-surface-container border-outline-variant/30 hover:border-outline-variant'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-error uppercase tracking-wider font-bold">
              Billets Invalides
            </span>
            <span className="p-2 rounded-xl bg-error/10 text-error">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-error font-mono">{invalidScans}</p>
          <p className="text-[11px] text-on-surface-variant font-mono mt-1">
            Codes inconnus ou faux
          </p>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/30 flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher code (#JT-), contrôleur, porte…"
            className="w-full bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/60 text-xs pl-10 pr-8 py-2.5 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Status buttons */}
          <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-xl border border-outline-variant/40 shrink-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setStatusFilter('VALID')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'VALID'
                  ? 'bg-[#107c10] dark:bg-[#4EED15] text-white dark:text-[#002D8C] shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Valides
            </button>
            <button
              onClick={() => setStatusFilter('ALREADY_SCANNED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'ALREADY_SCANNED'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Doublons
            </button>
            <button
              onClick={() => setStatusFilter('INVALID')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'INVALID'
                  ? 'bg-error text-on-error shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Invalides
            </button>
          </div>

          {/* Gate dropdown */}
          {availableGates.length > 0 && (
            <select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="bg-surface-container-high text-on-surface text-xs font-bold px-3 py-2 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none shrink-0 cursor-pointer"
            >
              <option value="ALL">Toutes les portes</option>
              {availableGates.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Result counter */}
      <div className="flex items-center justify-between text-xs text-on-surface-variant px-1 font-mono">
        <span>
          Affichage de <strong className="text-on-surface">{filteredScans.length}</strong> sur {totalScans} scans enregistrés
        </span>
        {(statusFilter !== 'ALL' || selectedGate !== 'ALL' || searchQuery) && (
          <button
            onClick={() => {
              setStatusFilter('ALL');
              setSelectedGate('ALL');
              setSearchQuery('');
            }}
            className="text-primary hover:underline font-bold"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Scans — Mobile Cards View */}
      <div className="md:hidden flex flex-col gap-3">
        {filteredScans.length === 0 ? (
          <div className="bg-surface-container rounded-3xl p-8 text-center border border-outline-variant/30 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-3">
              <QrCode className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-on-surface">Aucun scan correspondant</p>
            <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
              Aucun passage ne correspond aux filtres actifs ou aucun scan n'a encore été réalisé.
            </p>
          </div>
        ) : (
          filteredScans.map((scan) => {
            const isValid = scan.result === 'VALID';
            const isAlreadyScanned = scan.result === 'ALREADY_SCANNED';
            return (
              <div
                key={scan.id}
                onClick={() => setSelectedScan(scan)}
                className="bg-surface-container rounded-2xl p-4 border border-outline-variant/30 flex items-start gap-3 active:scale-[0.99] transition cursor-pointer hover:border-outline-variant"
              >
                <span
                  className={`mt-1 w-3 h-3 rounded-full shrink-0 ${
                    isValid ? 'bg-green-500 ring-4 ring-green-500/20' : isAlreadyScanned ? 'bg-amber-500 ring-4 ring-amber-500/20' : 'bg-red-500 ring-4 ring-red-500/20'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-xs text-primary truncate">#{scan.ticketCode}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full font-black text-[10px] font-mono shrink-0 ${
                        isValid
                          ? 'bg-green-100 dark:bg-green-950/80 text-green-700 dark:text-green-300'
                          : isAlreadyScanned
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                          : 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {isValid ? 'VALIDE' : isAlreadyScanned ? 'DÉJÀ SCANNÉ' : 'INVALIDE'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-on-surface mt-1">{scan.ticketTypeName || 'Billet Standard'}</p>
                  <p className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                    <DoorOpen className="w-3 h-3" />
                    <span>{scan.gate || 'Porte A'}</span>
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant font-mono truncate flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      {scan.controllerName || 'Agent'}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(scan.scannedAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Scans — Desktop Table View */}
      <div className="hidden md:block bg-surface-container rounded-3xl border border-outline-variant/30 overflow-hidden shadow-sm">
        <div className="p-4 bg-surface-container-low border-b border-surface-container-high flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-on-surface">Historique d'audit des scans en direct</h2>
            <span className="text-[11px] font-mono text-tertiary bg-tertiary/10 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              Direct
            </span>
          </div>
          <span className="text-xs font-mono text-on-surface-variant">
            {filteredScans.length} entrées affichées
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant border-b border-surface-container-high uppercase tracking-wider font-mono">
                <th className="p-4">Billet</th>
                <th className="p-4">Type</th>
                <th className="p-4">Porte / Tourniquet</th>
                <th className="p-4">Agent Contrôleur</th>
                <th className="p-4">Horodatage</th>
                <th className="p-4 text-center">Statut</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/60">
              {filteredScans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-on-surface-variant text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <QrCode className="w-8 h-8 text-on-surface-variant/40" />
                      <p className="font-bold text-sm text-on-surface">Aucun scan trouvé</p>
                      <p className="text-xs text-on-surface-variant">
                        Essayez de modifier vos filtres ou effectuez un scan depuis le terminal contrôleur.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredScans.map((scan) => {
                  const isValid = scan.result === 'VALID';
                  const isAlreadyScanned = scan.result === 'ALREADY_SCANNED';
                  return (
                    <tr
                      key={scan.id}
                      onClick={() => setSelectedScan(scan)}
                      className="hover:bg-surface-container-highest/60 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 font-mono font-black text-xs text-primary group-hover:underline">
                        #{scan.ticketCode}
                      </td>
                      <td className="p-4 font-bold text-on-surface">{scan.ticketTypeName || 'Billet Standard'}</td>
                      <td className="p-4 text-on-surface flex items-center gap-1.5">
                        <DoorOpen className="w-3.5 h-3.5 text-on-surface-variant" />
                        <span>{scan.gate || 'Porte A'}</span>
                      </td>
                      <td className="p-4 text-on-surface-variant font-mono">
                        {scan.controllerName || 'Agent Contrôle'}
                      </td>
                      <td className="p-4 text-on-surface-variant font-mono">
                        {formatRelativeTime(scan.scannedAt)}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-black text-[10px] font-mono ${
                            isValid
                              ? 'bg-green-100 dark:bg-green-950/80 text-green-700 dark:text-green-300'
                              : isAlreadyScanned
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {isValid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> VALIDE
                            </>
                          ) : isAlreadyScanned ? (
                            <>
                              <AlertTriangle className="w-3 h-3" /> DÉJÀ SCANNÉ
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> INVALIDE
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedScan(scan);
                          }}
                          className="p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition"
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scan Detail Modal */}
      {selectedScan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl max-w-md w-full border border-outline-variant/40 shadow-2xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div
              className={`p-6 text-white flex items-center justify-between ${
                selectedScan.result === 'VALID'
                  ? 'bg-gradient-to-r from-emerald-600 to-green-700'
                  : selectedScan.result === 'ALREADY_SCANNED'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700'
                  : 'bg-gradient-to-r from-red-600 to-red-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  {selectedScan.result === 'VALID' ? (
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  ) : selectedScan.result === 'ALREADY_SCANNED' ? (
                    <AlertTriangle className="w-7 h-7 text-white" />
                  ) : (
                    <XCircle className="w-7 h-7 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-lg">
                    {selectedScan.result === 'VALID'
                      ? 'Accès Accordé'
                      : selectedScan.result === 'ALREADY_SCANNED'
                      ? 'Alerte : Billet Déjà Scanné'
                      : 'Accès Refusé : Billet Invalide'}
                  </h3>
                  <p className="text-xs text-white/80 font-mono">#{selectedScan.ticketCode}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedScan(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/30 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Type de billet</span>
                  <span className="font-bold text-on-surface">{selectedScan.ticketTypeName || 'Billet Standard'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Porte d'entrée</span>
                  <span className="font-bold text-on-surface">{selectedScan.gate || 'Porte A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Agent contrôleur</span>
                  <span className="font-mono text-on-surface">{selectedScan.controllerName || 'Agent Contrôle'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Horodatage précis</span>
                  <span className="font-mono text-on-surface">
                    {new Date(selectedScan.scannedAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}{' '}
                    ({new Date(selectedScan.scannedAt).toLocaleDateString('fr-FR')})
                  </span>
                </div>
              </div>

              {selectedScan.result === 'ALREADY_SCANNED' && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                  <p className="font-bold mb-0.5">Tentative de double passage détectée</p>
                  Ce billet a déjà été validé à l'entrée par un contrôleur. Vérifiez l'identité du porteur pour éviter toute fraude de duplicata.
                </div>
              )}

              {selectedScan.result === 'INVALID' && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300 text-xs leading-relaxed">
                  <p className="font-bold mb-0.5">Code billet non répertorié</p>
                  Ce QR code ne correspond à aucun billet actif dans la base de données de l'événement.
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedScan(null)}
                  className="w-full py-2.5 rounded-xl bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface font-bold text-xs transition"
                >
                  Fermer l'inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
