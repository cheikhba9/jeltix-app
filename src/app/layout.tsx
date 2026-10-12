import type { Metadata, Viewport } from "next";
import React from "react";
import { Inter } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/lib/theme/ThemeContext";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

// ─── Self-hosted fonts via next/font ─────────────────────────────────────────
// Auto-hébergées par Next.js → zéro appel CDN → zéro layout shift → LCP amélioré
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0038A8",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://jeltix.com"),
  title: "Jël Tix | Billetterie Événements, Oscars de Vacances, Galas, Concerts & Matchs",
  description:
    "Plateforme universelle de billetterie et contrôle d'accès anti-fraude au Sénégal et en Afrique de l'Ouest. Réservez vos billets pour vos Oscars de vacances, Galas, Concerts, Festivals, Spectacles de Théâtre et Matchs en quelques clics avec Wave, Orange Money et Free Money.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Jël Tix | Saisissez • Réservez • Profitez",
    description:
      "Billetterie en ligne universelle pour tous types d'événements et contrôle d'accès sécurisé.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`h-full ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Material Symbols icon font — chargé via preconnect + stylesheet direct.
          next/font ne supporte pas les icon fonts variables. display=optional
          évite tout impact sur le LCP (n'attend pas le chargement de la font).
        */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        className="min-h-screen bg-white dark:bg-[#050D1E] text-slate-900 dark:text-white font-sans antialiased flex flex-col selection:bg-[#4EED15] selection:text-[#002D8C]"
        suppressHydrationWarning
      >
        {/*
          Anti-FOUC : lit la préférence depuis localStorage AVANT la hydration
          React pour éviter le flash de mauvais thème. beforeInteractive =
          s'exécute en premier, bloquant le rendu le minimum de temps.
        */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('jeltix_theme');if(s==='dark'){document.documentElement.classList.add('dark');}else if(!s&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');localStorage.setItem('jeltix_theme','dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
        <NavigationProgress />
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
