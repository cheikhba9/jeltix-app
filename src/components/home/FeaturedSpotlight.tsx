'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Clock, MapPin, Ticket as TicketIcon } from 'lucide-react';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatFCFA, formatDateWithDay } from '@/lib/utils/format';

// ─── Countdown Timer — Client Component isolé ────────────────────────────────
function CountdownTimer({ targetDateStr }: { targetDateStr: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDateStr) return;
    const targetDate = new Date(targetDateStr).getTime();

    const update = () => {
      const diff = Math.max(0, targetDate - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff / 3_600_000) % 24),
        minutes: Math.floor((diff / 60_000) % 60),
        seconds: Math.floor((diff / 1_000) % 60),
      });
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDateStr]);

  const units = [
    { v: timeLeft.days, label: 'Jours' },
    { v: timeLeft.hours, label: 'Heures' },
    { v: timeLeft.minutes, label: 'Min' },
    { v: timeLeft.seconds, label: 'Sec' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 text-center font-mono">
      {units.map(({ v, label }) => (
        <div key={label} className="bg-black/30 rounded-xl p-1.5">
          <p className="text-lg font-black text-[#4EED15]" suppressHydrationWarning>{v}</p>
          <p className="text-[9px] text-white/60">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── FeaturedSpotlight — Carte Événement Vedette + Countdown ─────────────────
export function FeaturedSpotlight() {
  const { events } = useJeltixStore();

  // Calcul du prochain événement futur
  const now = Date.now();
  const futureEvents = events
    .filter((e) => e.status === 'PUBLISHED' && new Date(e.startDate).getTime() > now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const countdownEvent = futureEvents[0] || null;
  const featuredEvent = countdownEvent || events[0] || null;

  if (!featuredEvent) return null;

  return (
    <section id="featured-event" className="max-w-[1440px] mx-auto px-4 sm:px-6 -mt-8 relative z-20 w-full scroll-mt-24">
      <div className="bg-gradient-to-r from-[#0038A8] via-[#0B4FD8] to-[#002878] rounded-3xl p-6 sm:p-8 shadow-2xl text-white border border-white/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-15 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Event Image */}
          <div className="lg:col-span-5 relative rounded-2xl overflow-hidden shadow-lg h-64 lg:h-80 group">
            <Image
              src={
                featuredEvent.bannerImage?.startsWith('http') || featuredEvent.bannerImage?.startsWith('data:')
                  ? featuredEvent.bannerImage
                  : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80'
              }
              alt={featuredEvent.title || 'Événement Vedette'}
              fill
              sizes="(max-width: 1024px) 100vw, 42vw"
              priority
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#4EED15] text-[#002D8C] font-black text-xs uppercase tracking-wider shadow-md">
              🔥 Événement Vedette
            </div>
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white font-bold text-xs">
              {featuredEvent.category}
            </div>
          </div>

          {/* Event Info & CTA */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#4EED15] font-mono font-bold">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDateWithDay(featuredEvent.startDate)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {featuredEvent.timeString}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mt-2 leading-tight tracking-tight">
                {featuredEvent.title}
              </h2>

              <p className="text-white/80 text-xs sm:text-sm mt-2 line-clamp-2 leading-relaxed">
                {featuredEvent.description}
              </p>

              <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium mt-3">
                <MapPin className="w-4 h-4 text-[#4EED15]" />
                <span>{featuredEvent.venue} ({featuredEvent.locationDetails})</span>
              </div>
            </div>

            {/* Countdown */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15">
              {countdownEvent ? (
                <>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/70 mb-2 font-bold">
                    Coup d&apos;envoi dans :
                  </p>
                  <CountdownTimer targetDateStr={countdownEvent.startDate} />
                </>
              ) : (
                <div className="flex items-center gap-2 py-1">
                  <span className="material-symbols-outlined text-[18px] text-white/60">event_busy</span>
                  <p className="text-xs font-mono text-white/70">Événement terminé — Prochaine édition bientôt</p>
                </div>
              )}
            </div>

            {/* Price & CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-white/15">
              <div>
                <span className="text-[11px] text-white/70 uppercase font-mono">À partir de</span>
                <p className="text-2xl sm:text-3xl font-black text-[#4EED15]">
                  {formatFCFA(featuredEvent.ticketTypes[0]?.price || 300)}{' '}
                  <span className="text-xs font-normal text-white">FCFA</span>
                </p>
              </div>

              <Link
                href={`/discover/${featuredEvent.slug}`}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#4EED15] hover:bg-[#42D40F] text-[#002D8C] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-[#4EED15]/30 transition-transform active:scale-95 cursor-pointer"
              >
                <TicketIcon className="w-5 h-5" />
                <span>Réserver mes places (Wave / OM)</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
