'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatDateFrench, formatFCFA } from '@/lib/utils/format';
import { useToast } from '@/components/ui/Toast';
import { EventStatus, Event } from '@/types';
import {
  Calendar,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Filter,
  TrendingUp,
  Lock,
  Eye,
  X,
  Share2,
  Copy,
  Ticket,
  Users,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function EventsManagementPage() {
  const { events, updateEventStatus, deleteEvent, currentUser } = useJeltixStore();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const ITEMS_PER_PAGE = 8;

  // Accès restreint : Seuls Super Admin et Organisateurs peuvent gérer les événements
  if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ORGANIZER') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 ring-8 ring-amber-500/10">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-on-surface mb-1">Accès Restreint</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mb-5 leading-relaxed">
          La gestion des événements et de la billetterie est réservée aux Organisateurs et Super Administrateurs.
        </p>
        <Link
          href={currentUser.role === 'SELLER' ? '/sales/pos' : '/scan'}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold inline-flex items-center gap-2 shadow-md hover:scale-[0.98] transition"
        >
          <span>Aller à mon espace ({currentUser.role === 'SELLER' ? 'Guichet POS' : 'Scanner'})</span>
        </Link>
      </div>
    );
  }

  // Multi-tenant isolation: Organizers strictly see only their own events
  const scopedEvents = useMemo(() => {
    if (!currentUser || currentUser.role === 'SUPER_ADMIN') {
      return events;
    }
    return events.filter((evt) => evt.organizerId === currentUser.id);
  }, [events, currentUser]);

  const filteredEvents = useMemo(() => {
    return scopedEvents.filter((evt) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        evt.title.toLowerCase().includes(q) ||
        evt.venue.toLowerCase().includes(q) ||
        evt.locationDetails.toLowerCase().includes(q) ||
        evt.category.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && evt.status === 'PUBLISHED') ||
        (statusFilter === 'draft' && evt.status === 'DRAFT') ||
        (statusFilter === 'closed' && evt.status === 'CLOSED');

      return matchesSearch && matchesStatus;
    });
  }, [scopedEvents, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / ITEMS_PER_PAGE));
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleStatusChangeFilter = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (eventId: string, nextStatus: EventStatus) => {
    updateEventStatus(eventId, nextStatus);
    addToast({
      type: 'success',
      title: 'Statut mis à jour',
      message: `Événement passé en mode ${nextStatus}.`,
    });
  };

  const handleDelete = (eventId: string, title: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'événement "${title}" ? Cette action est irréversible.`)) {
      deleteEvent(eventId);
      addToast({
        type: 'info',
        title: 'Événement supprimé',
        message: `L'événement "${title}" a été retiré.`,
      });
      if (selectedEvent?.id === eventId) setSelectedEvent(null);
    }
  };

  const handleCopyPublicLink = (slug: string) => {
    const url = `${window.location.origin}/discover/${slug}`;
    navigator.clipboard.writeText(url);
    addToast({
      type: 'success',
      title: 'Lien copié !',
      message: 'Le lien public vers la billetterie a été copié dans votre presse-papiers.',
    });
  };

  const totalSold = scopedEvents.reduce((s, e) => s + e.soldCapacity, 0);
  const totalCap = scopedEvents.reduce((s, e) => s + e.totalCapacity, 0);
  const avgFillRate = totalCap > 0 ? Math.round((totalSold / totalCap) * 100) : 0;
  const totalRevenue = scopedEvents.reduce((s, e) => {
    const eventRev = (e.ticketTypes || []).reduce(
      (catSum: number, cat) => catSum + (cat.soldQuantity || 0) * (cat.price || 0),
      0
    );
    return s + eventRev;
  }, 0);
  const activeEventsCount = scopedEvents.filter((e) => e.status === 'PUBLISHED').length;

  return (
    <div className="flex flex-col w-full relative gap-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface-container/60 p-6 rounded-3xl border border-outline-variant/30 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-primary">
              Catalogue & Programmation
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">Gestion des Événements</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Pilotez votre calendrier, surveillez les jauges et contrôlez vos billetteries en temps réel.
          </p>
        </div>

        <Link
          href="/events/new"
          className="bg-primary hover:bg-primary-hover text-on-primary px-5 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un événement</span>
        </Link>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Événements Actifs */}
        <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">event_available</span>
          </div>
          <div>
            <p className="text-[10px] font-extrabold font-mono text-on-surface-variant uppercase tracking-wider">
              Événements Actifs
            </p>
            <p className="text-2xl sm:text-3xl font-black text-on-surface mt-0.5">
              {activeEventsCount}
            </p>
          </div>
        </div>

        {/* Card 2: Billets Vendus */}
        <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">confirmation_number</span>
          </div>
          <div>
            <p className="text-[10px] font-extrabold font-mono text-on-surface-variant uppercase tracking-wider">
              Billets Émis
            </p>
            <p className="text-2xl sm:text-3xl font-black text-tertiary mt-0.5">
              {totalSold.toLocaleString('fr-FR')}
            </p>
          </div>
        </div>

        {/* Card 3: Chiffre d'Affaires */}
        <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">payments</span>
          </div>
          <div>
            <p className="text-[10px] font-extrabold font-mono text-on-surface-variant uppercase tracking-wider">
              Recettes Billetterie
            </p>
            <p className="text-2xl sm:text-3xl font-black text-on-surface mt-0.5 font-mono">
              {formatFCFA(totalRevenue)} <span className="text-xs font-normal text-on-surface-variant">F</span>
            </p>
          </div>
        </div>

        {/* Card 4: Taux de Remplissage Global */}
        <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold font-mono text-on-surface-variant uppercase tracking-wider">
              Remplissage Global
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-2xl sm:text-3xl font-black text-tertiary font-mono">{avgFillRate}%</p>
              <TrendingUp className="w-4 h-4 text-tertiary" />
            </div>
          </div>
        </div>
      </div>

      {/* Table Toolbar Container */}
      <div className="bg-surface-container rounded-3xl p-5 border border-outline-variant/30 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Search Box */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Rechercher par titre, lieu, catégorie…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-xs font-medium border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filter Pill Dropdown */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex items-center bg-surface-container-high rounded-xl px-3 py-1.5 border border-outline-variant/40">
              <Filter className="w-3.5 h-3.5 text-on-surface-variant mr-2" />
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChangeFilter(e.target.value)}
                className="bg-transparent text-on-surface text-xs font-extrabold outline-none cursor-pointer pr-2"
              >
                <option value="all">Tous les statuts</option>
                <option value="published">Publiés</option>
                <option value="draft">Brouillons</option>
                <option value="closed">Clôturés</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="w-full rounded-2xl border border-outline-variant/30 overflow-hidden">
          {/* Vue Mobile (Cartes) */}
          <div className="md:hidden divide-y divide-outline-variant/20 bg-surface-container-low">
            {scopedEvents.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm font-bold text-on-surface">Aucun événement n&apos;a encore été créé</p>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                  Votre catalogue est actuellement vide. Publiez votre premier événement dès maintenant.
                </p>
                <Link
                  href="/events/new"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:scale-[0.98] transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer mon premier événement</span>
                </Link>
              </div>
            ) : paginatedEvents.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-xs">
                Aucun événement trouvé pour ces critères de recherche.
              </div>
            ) : (
              paginatedEvents.map((evt) => {
                const fillPercent = Math.round((evt.soldCapacity / evt.totalCapacity) * 100);
                return (
                  <div key={evt.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-outline-variant/30 shadow-xs">
                        <Image
                          src={evt.bannerImage}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-on-surface text-sm truncate">{evt.title}</p>
                        <span className="text-[10px] font-extrabold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-md inline-block mt-1">
                          {evt.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1 text-on-surface font-bold">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span>{formatDateFrench(evt.startDate)}</span>
                      </div>
                      <select
                        value={evt.status}
                        onChange={(e) => handleStatusChange(evt.id, e.target.value as EventStatus)}
                        className={`px-2 py-1 rounded-full text-[10px] font-extrabold font-mono border cursor-pointer outline-none ${
                          evt.status === 'PUBLISHED'
                            ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-500/30'
                            : evt.status === 'DRAFT'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-400/30'
                            : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-500/30'
                        }`}
                      >
                        <option value="PUBLISHED">● PUBLIÉ</option>
                        <option value="DRAFT">● BROUILLON</option>
                        <option value="CLOSED">🔒 CLÔTURÉ</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="font-extrabold text-on-surface">
                          {evt.soldCapacity.toLocaleString('fr-FR')}{' '}
                          <span className="font-sans font-normal text-[10px] text-on-surface-variant">vendus</span>
                        </span>
                        <span className="text-on-surface-variant">/ {evt.totalCapacity.toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            fillPercent >= 100 ? 'bg-slate-400' : fillPercent > 0 ? 'bg-tertiary' : 'bg-outline-variant/30'
                          }`}
                          style={{ width: `${Math.min(100, fillPercent)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-[10px] font-mono text-on-surface-variant truncate pr-2">
                        {evt.venue}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setSelectedEvent(evt)}
                          className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors"
                          title="Inspecter les tarifs et jauges"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyPublicLink(evt.slug)}
                          className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors"
                          title="Copier le lien public"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/discover/${evt.slug}`}
                          target="_blank"
                          className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors"
                          title="Voir la page publique"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(evt.id, evt.title)}
                          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors"
                          title="Supprimer l'événement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Vue Desktop (Table) */}
          <div className="hidden md:block overflow-x-auto w-full bg-surface-container-low">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container text-[11px] font-extrabold text-on-surface-variant border-b border-outline-variant/30 uppercase tracking-wider font-mono">
                  <th className="p-4">Événement</th>
                  <th className="p-4">Lieu</th>
                  <th className="p-4">Date & Heure</th>
                  <th className="p-4">Jauge / Ventes</th>
                  <th className="p-4 text-center">Statut</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {scopedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center space-y-3">
                      <p className="text-sm font-bold text-on-surface">Aucun événement n&apos;a encore été créé</p>
                      <p className="text-xs text-on-surface-variant max-w-sm mx-auto mb-4">
                        Votre catalogue est actuellement vide. Publiez votre premier événement dès maintenant.
                      </p>
                      <Link
                        href="/events/new"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:scale-[0.98] transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Créer mon premier événement</span>
                      </Link>
                    </td>
                  </tr>
                ) : paginatedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant text-xs">
                      Aucun événement trouvé pour ces critères de recherche.
                    </td>
                  </tr>
                ) : (
                  paginatedEvents.map((evt) => {
                    const fillPercent = Math.round((evt.soldCapacity / evt.totalCapacity) * 100);

                    return (
                      <tr key={evt.id} className="hover:bg-surface-container-highest/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-outline-variant/30 shadow-xs">
                              <Image
                                src={evt.bannerImage}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div>
                              <p className="font-extrabold text-on-surface text-sm">{evt.title}</p>
                              <span className="text-[10px] font-extrabold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                                {evt.category}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <p className="font-bold text-on-surface">{evt.venue}</p>
                          <p className="text-on-surface-variant text-[11px] font-mono">{evt.locationDetails}</p>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-1 text-on-surface font-bold">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            <span>{formatDateFrench(evt.startDate)}</span>
                          </div>
                          <p className="text-on-surface-variant font-mono text-[11px] mt-0.5">{evt.timeString}</p>
                        </td>

                        <td className="p-4">
                          <div className="w-36 space-y-1">
                            <div className="flex justify-between font-mono text-[11px]">
                              <span className="font-extrabold text-on-surface">
                                {evt.soldCapacity.toLocaleString('fr-FR')}
                              </span>
                              <span className="text-on-surface-variant">
                                / {evt.totalCapacity.toLocaleString('fr-FR')}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  fillPercent >= 100
                                    ? 'bg-slate-400'
                                    : fillPercent > 0
                                    ? 'bg-tertiary'
                                    : 'bg-outline-variant/30'
                                }`}
                                style={{ width: `${Math.min(100, fillPercent)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          <select
                            value={evt.status}
                            onChange={(e) => handleStatusChange(evt.id, e.target.value as EventStatus)}
                            className={`px-3 py-1 rounded-full text-[10px] font-extrabold font-mono border cursor-pointer outline-none ${
                              evt.status === 'PUBLISHED'
                                ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-500/30'
                                : evt.status === 'DRAFT'
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-400/30'
                                : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-500/30'
                            }`}
                          >
                            <option value="PUBLISHED">● PUBLIÉ</option>
                            <option value="DRAFT">● BROUILLON</option>
                            <option value="CLOSED">🔒 CLÔTURÉ</option>
                          </select>
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedEvent(evt)}
                              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
                              title="Inspecter les tarifs et jauges"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyPublicLink(evt.slug)}
                              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
                              title="Copier le lien public"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <Link
                              href={`/discover/${evt.slug}`}
                              target="_blank"
                              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
                              title="Voir la page publique"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => handleDelete(evt.id, evt.title)}
                              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors cursor-pointer"
                              title="Supprimer l'événement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Barre de pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs text-on-surface-variant font-medium">
          <p>
            Affichage de {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredEvents.length)}–
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length)} sur {filteredEvents.length} événement
            {filteredEvents.length !== 1 ? 's' : ''}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 font-mono font-bold">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    page === currentPage
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Event Details & Ticket Categories Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl max-w-lg w-full border border-outline-variant/40 shadow-2xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="relative h-40 w-full overflow-hidden">
              <Image
                src={selectedEvent.bannerImage}
                alt={selectedEvent.title}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 flex flex-col justify-end text-white">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-primary/80 px-2 py-0.5 rounded-md self-start mb-1">
                  {selectedEvent.category}
                </span>
                <h3 className="font-black text-lg truncate">{selectedEvent.title}</h3>
                <p className="text-xs text-white/80 font-mono flex items-center gap-2 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{selectedEvent.venue}</span>
                  <span>•</span>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{selectedEvent.timeString}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-on-surface mb-2 flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-primary" />
                  <span>Catégories de Billets & Jauges</span>
                </h4>

                <div className="space-y-2">
                  {(selectedEvent.ticketTypes || []).map((tt) => {
                    const pct = tt.totalQuantity > 0 ? Math.round((tt.soldQuantity / tt.totalQuantity) * 100) : 0;
                    return (
                      <div
                        key={tt.id}
                        className="bg-surface-container rounded-2xl p-3 border border-outline-variant/30 space-y-1.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-on-surface">{tt.name}</span>
                          <span className="font-black font-mono text-primary text-sm">
                            {formatFCFA(tt.price)} FCFA
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-mono">
                          <span>{tt.soldQuantity} vendus sur {tt.totalQuantity}</span>
                          <span>{pct}% vendu</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className="h-full bg-tertiary rounded-full"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleCopyPublicLink(selectedEvent.slug)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier le lien public</span>
                </button>

                <Link
                  href={`/discover/${selectedEvent.slug}`}
                  target="_blank"
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-hover transition flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ouvrir Billetterie</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
