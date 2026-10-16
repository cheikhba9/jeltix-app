// React Server Component — pas de 'use client' ici.
// Seul DashboardShell (client minimal) gère l'état interactif.
import React from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
