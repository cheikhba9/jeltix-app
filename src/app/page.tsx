// Server Component — pas de 'use client', rendu immédiat côté serveur
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedSpotlight } from '@/components/home/FeaturedSpotlight';
import { EventCatalog } from '@/components/home/EventCatalog';

// Cache Edge Vercel pendant 60 secondes avec régénération en tâche de fond (ISR)
export const revalidate = 60;

export default function PublicHomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface selection:bg-[#4EED15] selection:text-[#002D8C]">
      {/* Navigation Header — Client Component (theme toggle) */}
      <PublicHeader />

      {/* Hero + Search — Client Component isolé */}
      <HeroSection />

      {/* Featured Event Spotlight + Countdown — Client Component isolé */}
      <FeaturedSpotlight />

      {/* Catalogue avec filtres — Client Component isolé */}
      <EventCatalog />

      <Footer />
    </div>
  );
}
