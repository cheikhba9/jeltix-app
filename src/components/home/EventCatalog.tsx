'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatFCFA, formatDateFrench } from '@/lib/utils/format';

const CATEGORIES = [
  { id: 'all', label: 'Tous les événements', icon: '✨' },
  { id: 'Oscars & Soirées Gala', label: 'Oscars & Galas de Vacances', icon: '🏆' },
  { id: 'Concert / Festival', label: 'Concerts & Festivals', icon: '🎵' },
  { id: 'Théâtre & Humour', label: 'Théâtre & Stand-up', icon: '🎭' },
  { id: 'Football', label: 'Football & Sports', icon: '⚽' },
  { id: 'Lutte Sénégalaise', label: 'Lutte & Combats Tradis', icon: '🥊' },
  { id: 'Basketball', label: 'Basketball D1 / BAL', icon: '🏀' },
];

export function EventCatalog() {
  const { events } = useJeltixStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Écoute les recherches déclenchées depuis la HeroSearchBar
  useEffect(() => {
    const handler = (e: Event) => {
      const { query } = (e as CustomEvent<{ query: string }>).detail;
      setSearchQuery(query);
    };
    window.addEventListener('jeltix-search', handler);
    return () => window.removeEventListener('jeltix-search', handler);
  }, []);

  const filteredEvents = useMemo(
    () =>
      events.filter((evt) => {
        const matchesCategory = selectedCategory === 'all' || evt.category === selectedCategory;
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q ||
          evt.title.toLowerCase().includes(q) ||
          evt.venue.toLowerCase().includes(q) ||
          evt.locationDetails.toLowerCase().includes(q);
        return matchesCategory && matchesSearch;
      }),
    [events, selectedCategory, searchQuery],
  );

  return (
    <section id="event-catalog" className="max-w-[1440px] mx-auto px-4 sm:px-6 py-16 w-full space-y-8">
      {/* Header + Filtres */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h3 className="text-2xl font-black text-on-surface">Tous les Événements Disponibles</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Trouvez vos places et réservez instantanément avec votre numéro de téléphone.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-[#0038A8] text-white shadow-md'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">search_off</span>
          <p className="text-on-surface-variant font-medium">Aucun événement trouvé pour cette recherche.</p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            className="mt-2 text-sm font-bold text-primary underline cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => {
            const ticketTypes = evt.ticketTypes || [];
            const minPrice = ticketTypes.length > 0 ? Math.min(...ticketTypes.map((t) => t.price || 0)) : 0;
            const totalCap = evt.totalCapacity || 1;
            const soldCap = evt.soldCapacity || 0;
            const fillRate = Math.round((soldCap / totalCap) * 100);

            return (
              <div
                key={evt.id}
                className="bg-surface-container-lowest rounded-3xl overflow-hidden border border-outline-variant/30 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
              >
                {/* Banner Thumbnail */}
                <div className="relative h-36 w-full overflow-hidden rounded-t-2xl shrink-0">
                  <Image
                    src={evt.bannerImage}
                    alt={evt.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white font-bold text-xs">
                    {evt.category}
                  </div>
                  <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-[#4EED15] text-[#002D8C] font-black text-[10px] uppercase tracking-wider font-mono shadow-md">
                    {fillRate}% Vendu
                  </div>
                </div>

                {/* Event Details */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDateFrench(evt.startDate)}</span>
                      <span>•</span>
                      <span>{evt.timeString}</span>
                    </div>

                    <h4 className="text-lg font-black text-on-surface group-hover:text-primary transition-colors leading-tight">
                      {evt.title}
                    </h4>

                    <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{evt.venue} ({evt.locationDetails})</span>
                    </p>
                  </div>

                  {/* Stock Gauge */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
                      <span>Remplissage</span>
                      <span>{soldCap.toLocaleString('fr-FR')} / {totalCap.toLocaleString('fr-FR')} places</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#0038A8] to-[#4EED15] rounded-full transition-all"
                        style={{ width: `${Math.min(100, fillRate)}%` }}
                      />
                    </div>
                  </div>

                  {/* Price & CTA */}
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20">
                    <div>
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase">Dès</span>
                      <p className="text-lg font-black text-primary font-mono">
                        {formatFCFA(minPrice)}{' '}
                        <span className="text-xs font-normal text-on-surface-variant">FCFA</span>
                      </p>
                    </div>

                    <Link
                      href={`/discover/${evt.slug}`}
                      className="px-4 py-2 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                    >
                      <span>Réserver</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
