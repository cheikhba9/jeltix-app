import type { Metadata } from 'next';
import React from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;

  return {
    title: `Billet Jël Tix #${code} | E-Billet Officiel Sécurisé`,
    description: `Consultez et présentez votre e-billet officiel Jël Tix avec QR Code scannable pour l'accès à l'événement.`,
    openGraph: {
      title: `🎟️ E-Billet Officiel Jël Tix #${code}`,
      description: `Billet officiel avec QR code et signature cryptographique. Présentez ce pass aux portes d'accès.`,
      images: [
        {
          url: '/logo.png',
          width: 800,
          height: 800,
          alt: 'Jël Tix Billetterie Logo Officiel',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `🎟️ E-Billet Officiel Jël Tix #${code}`,
      description: `Billet officiel avec QR code et signature cryptographique.`,
      images: ['/logo.png'],
    },
  };
}

export default function TicketCodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
