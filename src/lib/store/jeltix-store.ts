'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  EventItem,
  Order,
  Ticket,
  ScanLog,
  UserProfile,
  DashboardKPIs,
  PaymentMethod,
  OrderItem,
  ScanResultType,
  EventStatus,
} from '@/types';
import { generateTicketCode, generateOrderReference } from '../utils/format';
import { createClient } from '@/lib/supabase/client';

// ZERO MOCK DATA - Prêt pour les données réelles
const INITIAL_EVENTS: EventItem[] = [];
const INITIAL_TICKETS: Ticket[] = [];
const INITIAL_SCANS: ScanLog[] = [];

// Uniquement les comptes administrateurs légitimes
const INITIAL_USERS: UserProfile[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    fullName: 'Admin Jël Tix',
    email: 'admin@jeltix.sn',
    phone: '+221 77 000 00 01',
    role: 'SUPER_ADMIN',
    organization: 'Jël Tix SAS',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    fullName: 'Super Administrateur',
    email: 'admin@foutaticket.sn',
    phone: '+221 77 000 00 00',
    role: 'SUPER_ADMIN',
    organization: 'Jël Tix & FoutaTicket',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    fullName: 'Mamadou Cheikh Ba',
    email: 'mamadoucheikhba9@gmail.com',
    phone: '+221 77 000 00 02',
    role: 'SUPER_ADMIN',
    organization: 'Jël Tix SAS',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    fullName: 'Mamadou Cheikh Ba (MCB)',
    email: 'mcbfd9@gmail.com',
    phone: '+221 77 000 00 03',
    role: 'SUPER_ADMIN',
    organization: 'Jël Tix SAS',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

function mapSupabaseEventToModel(record: any): EventItem {
  const seenTypes = new Set<string>();
  const ticketTypes: TicketType[] = [];

  for (const tt of record.ticket_types || []) {
    const key = (tt.name || '').trim().toLowerCase();
    if (!key || seenTypes.has(key)) continue;
    seenTypes.add(key);
    ticketTypes.push({
      id: tt.id,
      eventId: tt.event_id || record.id,
      name: tt.name,
      price: Number(tt.price) || 0,
      badge: tt.badge || '',
      description: tt.description || '',
      totalQuantity: Number(tt.total_quantity) || 0,
      soldQuantity: Number(tt.sold_quantity) || 0,
      isActive: tt.is_active !== false,
    });
  }

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    category: record.category || 'Événement',
    venue: record.venue || '',
    locationDetails: record.location_details || '',
    startDate: record.start_date || new Date().toISOString(),
    timeString:
      record.time_string ||
      (record.start_date
        ? new Date(record.start_date).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }) + ' UTC'
        : '18:00 UTC'),
    bannerImage:
      record.banner_image ||
      'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    description: record.description || '',
    importantInfo: Array.isArray(record.important_info) ? record.important_info : [],
    status: record.status || 'PUBLISHED',
    totalCapacity: Number(record.total_capacity) || 0,
    soldCapacity: Number(record.sold_capacity) || 0,
    organizerId: record.organizer_id || 'a0000000-0000-0000-0000-000000000001',
    organizerName: record.organizer_name || 'Organisateur Officiel',
    ticketTypes,
    createdAt: record.created_at || new Date().toISOString(),
  };
}

function mapSupabaseTicketToModel(record: any): Ticket {
  return {
    id: record.id,
    ticketCode: record.ticket_code,
    orderId: record.order_id || '',
    eventId: record.event_id,
    eventTitle: record.events?.title || record.event_title || '',
    ticketTypeId: record.ticket_type_id,
    ticketTypeName: record.ticket_types?.name || record.ticket_type_name || 'Billet Standard',
    gateRecommendation: record.gate_recommendation || 'Porte A - Entrée Principale',
    seatNumber: record.seat_number || 'Placement Libre',
    customerName: record.customer_name,
    customerPhone: record.customer_phone,
    pricePaid: Number(record.price_paid) || 0,
    status: record.status || 'VALID',
    usedAt: record.used_at || undefined,
    usedGate: record.used_gate || undefined,
    usedByController: record.used_by_controller || undefined,
    qrData: record.qr_data || record.ticket_code,
    createdAt: record.created_at || new Date().toISOString(),
  };
}

function mapSupabaseScanToModel(record: any): ScanLog {
  return {
    id: record.id,
    ticketId: record.ticket_id || '',
    ticketCode: record.ticket_code,
    eventId: record.event_id || '',
    ticketTypeName: record.ticket_type_name || 'Billet',
    gate: record.gate || 'Porte A',
    controllerName: record.controller_name || 'Contrôleur',
    result: record.result || 'VALID',
    errorMessage: record.error_message || undefined,
    scannedAt: record.scanned_at || record.created_at || new Date().toISOString(),
  };
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of secondary) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of primary) {
    if (item && item.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

function mergeTickets(primary: Ticket[], secondary: Ticket[]): Ticket[] {
  const map = new Map<string, Ticket>();
  for (const item of secondary) {
    if (!item) continue;
    const key = (item.ticketCode || item.id || '').trim().toUpperCase();
    if (key) map.set(key, item);
  }
  for (const item of primary) {
    if (!item) continue;
    const key = (item.ticketCode || item.id || '').trim().toUpperCase();
    if (key) {
      const existing = map.get(key);
      if (existing) {
        const isUsed = existing.status === 'USED' || item.status === 'USED';
        map.set(key, {
          ...existing,
          ...item,
          status: isUsed ? 'USED' : 'VALID',
          usedAt: existing.usedAt || item.usedAt,
          usedGate: existing.usedGate || item.usedGate,
          usedByController: existing.usedByController || item.usedByController,
        });
      } else {
        map.set(key, item);
      }
    }
  }
  return Array.from(map.values());
}

class JeltixStore {
  private events: EventItem[] = [];
  private tickets: Ticket[] = [];
  private scans: ScanLog[] = [];
  private users: UserProfile[] = [];
  private orders: Order[] = [];
  private currentUser: UserProfile | null = null;
  private listeners: Array<() => void> = [];

  private broadcastChannel: BroadcastChannel | null = null;
  private isSyncing = false;

  constructor() {
    this.events = JSON.parse(JSON.stringify(INITIAL_EVENTS));
    this.tickets = JSON.parse(JSON.stringify(INITIAL_TICKETS));
    this.scans = JSON.parse(JSON.stringify(INITIAL_SCANS));
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.currentUser = this.users[0] || null;

    if (typeof window !== 'undefined') {
      try {
        // Purge intégrale de tous les anciens caches contenant des données fictives
        const hasPurgedV4 = localStorage.getItem('jeltix_purged_fake_data_v4');
        if (!hasPurgedV4) {
          const oldKeys = [
            'jeltix_events_v3',
            'jeltix_tickets_v3',
            'jeltix_scans_v3',
            'jeltix_orders_v3',
            'jeltix_users_v3',
            'jeltix_events_v2',
            'jeltix_tickets_v2',
            'jeltix_scans_v2',
            'jeltix_orders_v2',
            'jeltix_users_v2',
            'jeltix_events',
            'jeltix_tickets',
            'jeltix_scans',
            'jeltix_orders',
            'foutaticket_events',
            'foutaticket_tickets',
            'foutaticket_scans',
          ];
          oldKeys.forEach((k) => localStorage.removeItem(k));
          localStorage.setItem('jeltix_purged_fake_data_v4', 'true');
        }

        this.reloadFromLocalStorage();
        this.initSync();
      } catch (err) {
        console.warn('Erreur initialisation Jël Tix store:', err);
      }
    }
  }

  private reloadFromLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      const savedEvents = localStorage.getItem('jeltix_events_v4');
      const savedTickets = localStorage.getItem('jeltix_tickets_v4');
      const savedScans = localStorage.getItem('jeltix_scans_v4');
      const savedUsers = localStorage.getItem('jeltix_users_v4');
      const savedOrders = localStorage.getItem('jeltix_orders_v4');
      const savedCurrentUser =
        localStorage.getItem('jeltix_current_user_v4') ||
        localStorage.getItem('jeltix_current_user');

      if (savedEvents) {
        try {
          const parsed = JSON.parse(savedEvents);
          if (Array.isArray(parsed)) this.events = parsed;
        } catch {}
      }
      if (savedTickets) {
        try {
          const parsed = JSON.parse(savedTickets);
          if (Array.isArray(parsed)) this.tickets = parsed;
        } catch {}
      }
      if (savedScans) {
        try {
          const parsed = JSON.parse(savedScans);
          if (Array.isArray(parsed)) this.scans = parsed;
        } catch {}
      }
      if (savedUsers) {
        try {
          const parsed = JSON.parse(savedUsers);
          if (Array.isArray(parsed) && parsed.length > 0) this.users = parsed;
        } catch {}
      }
      if (savedOrders) {
        try {
          const parsed = JSON.parse(savedOrders);
          if (Array.isArray(parsed)) this.orders = parsed;
        } catch {}
      }
      if (savedCurrentUser) {
        try {
          this.currentUser = JSON.parse(savedCurrentUser);
        } catch {}
      }

      if (!this.users || this.users.length === 0) {
        this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
      }
      if (!this.currentUser) {
        this.currentUser = this.users[0] || null;
      }
    } catch (e) {
      console.warn('Erreur reloadFromLocalStorage:', e);
    }
  }

  private initSync() {
    if (typeof window === 'undefined') return;

    // Cross-tab real-time sync with BroadcastChannel
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('jeltix_bus');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'SYNC') {
            this.reloadFromLocalStorage();
            this.listeners.forEach((l) => l());
          }
        };
      }
    } catch {}

    // Storage event fallback for other windows
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('jeltix_')) {
        this.reloadFromLocalStorage();
        this.listeners.forEach((l) => l());
      }
    });

    // Synchronisation hybride : Supabase Cloud prioritaire, Mac local-db fallback
    this.syncFromSupabaseAndDisk();
  }

  private lastSyncTime = 0;
  private readonly SYNC_THROTTLE_MS = 25_000; // 25s de cache mémoire entre les rafraîchissements

  public async syncFromSupabaseAndDisk(force = false) {
    if (typeof window === 'undefined' || this.isSyncing) return;
    const now = Date.now();
    if (!force && this.lastSyncTime > 0 && now - this.lastSyncTime < this.SYNC_THROTTLE_MS) {
      return;
    }
    this.isSyncing = true;
    let didSync = false;

    // 1. Récupération optimisée unifiée (/api/local-db) — Supabase Admin + Cache serveur
    try {
      const res = await fetch('/api/local-db');
      if (res.ok) {
        const json = await res.json();
        if (json.exists && json.data) {
          if (Array.isArray(json.data.events) && json.data.events.length > 0) {
            this.events = mergeById(this.events, json.data.events);
          }
          if (Array.isArray(json.data.tickets) && json.data.tickets.length > 0) {
            this.tickets = mergeTickets(this.tickets, json.data.tickets);
          }
          if (Array.isArray(json.data.scans) && json.data.scans.length > 0) {
            this.scans = mergeById(this.scans, json.data.scans);
          }
          if (Array.isArray(json.data.orders) && json.data.orders.length > 0) {
            this.orders = mergeById(this.orders, json.data.orders);
          }
          if (Array.isArray(json.data.users) && json.data.users.length > 0) {
            this.users = mergeById(this.users, json.data.users);
          }

          this.saveLocalOnly();
          this.listeners.forEach((l) => l());
          didSync = true;
        }
      }
    } catch (diskErr) {
      console.warn('Notice sync local-db:', diskErr);
    }

    // 2. Si /api/local-db a réussi, PAS besoin de 4 requêtes redondantes directes vers Supabase !
    // Repli direct client Supabase uniquement si /api/local-db n'a pas répondu
    if (!didSync) {
      try {
        const supabase = createClient();
        const { data: sbEvents, error: eventsErr } = await supabase
          .from('events')
          .select(`*, ticket_types (*)`)
          .order('start_date', { ascending: true });

        if (!eventsErr && Array.isArray(sbEvents) && sbEvents.length > 0) {
          const remoteEvents = sbEvents.map(mapSupabaseEventToModel);
          this.events = mergeById(this.events, remoteEvents);
          this.saveLocalOnly();
          this.listeners.forEach((l) => l());
        }
      } catch (sbErr) {
        console.warn('Repli Supabase client direct:', sbErr);
      }
    }

    this.lastSyncTime = Date.now();
    this.isSyncing = false;
  }

  // Alias pour rétrocompatibilité
  public syncFromLocalDb() {
    return this.syncFromSupabaseAndDisk();
  }

  public async persistToDiskAsync(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const res = await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: this.events,
          tickets: this.tickets,
          scans: this.scans,
          users: this.users,
          orders: this.orders,
        }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Erreur écriture disque local-db:', err);
      return false;
    }
  }

  private persistToDisk() {
    this.persistToDiskAsync().catch(() => {});
  }

  private saveLocalOnly() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jeltix_events_v4', JSON.stringify(this.events));
      localStorage.setItem('jeltix_tickets_v4', JSON.stringify(this.tickets));
      localStorage.setItem('jeltix_scans_v4', JSON.stringify(this.scans));
      localStorage.setItem('jeltix_users_v4', JSON.stringify(this.users));
      localStorage.setItem('jeltix_orders_v4', JSON.stringify(this.orders));
      if (this.currentUser) {
        localStorage.setItem('jeltix_current_user_v4', JSON.stringify(this.currentUser));
      }
      this.persistToDisk();
    }
  }

  private save() {
    this.saveLocalOnly();
    try {
      this.broadcastChannel?.postMessage({ type: 'SYNC', timestamp: Date.now() });
    } catch {}
    this.listeners.forEach((l) => l());
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public setCurrentUser(user: UserProfile | null): void {
    this.currentUser = user;
    this.save();
  }

  public getEvents() {
    return this.events;
  }

  public getEventBySlug(slug: string) {
    return this.events.find((e) => e.slug === slug || e.id === slug);
  }

  public getTickets() {
    return this.tickets;
  }

  public getTicketByCode(code: string) {
    const clean = code.trim().toUpperCase();
    return this.tickets.find(
      (t) =>
        t.ticketCode.toUpperCase() === clean ||
        t.ticketCode.replace('JT-', 'FT-') === clean ||
        t.ticketCode.replace('FT-', 'JT-') === clean
    );
  }

  public getScans() {
    return this.scans;
  }

  public getUsers() {
    return this.users;
  }

  public getOrders() {
    return this.orders;
  }

  // ACHAT DE BILLETS — INSTANTANÉ EN LOCAL + SYNCHRONISATION SUPABASE
  public purchaseTickets(params: {
    eventId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    items: OrderItem[];
    paymentMethod: PaymentMethod;
    channel?: 'ONLINE' | 'POS_GUICHET';
    sellerId?: string;
  }): { order: Order; generatedTickets: Ticket[] } {
    const event = this.events.find((e) => e.id === params.eventId || e.slug === params.eventId);
    if (!event) throw new Error('Événement introuvable');

    const totalAmount = params.items.reduce((sum, it) => sum + it.subtotal, 0);
    const orderRef = generateOrderReference();

    const order: Order = {
      id: `ord-${Date.now()}`,
      reference: orderRef,
      eventId: event.id,
      eventTitle: event.title,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail || '',
      items: params.items,
      totalAmount,
      paymentMethod: params.paymentMethod,
      paymentStatus: 'COMPLETED',
      sellerId: params.sellerId,
      channel: params.channel || 'ONLINE',
      createdAt: new Date().toISOString(),
    };

    const newTickets: Ticket[] = [];

    params.items.forEach((item) => {
      const ticketType = event.ticketTypes.find((tt) => tt.id === item.ticketTypeId);
      if (ticketType) {
        ticketType.soldQuantity += item.quantity;
      }
      event.soldCapacity += item.quantity;

      for (let i = 0; i < item.quantity; i++) {
        let code = generateTicketCode();
        while (
          this.tickets.some((t) => t.ticketCode.toUpperCase() === code.toUpperCase()) ||
          newTickets.some((t) => t.ticketCode.toUpperCase() === code.toUpperCase())
        ) {
          code = generateTicketCode();
        }
        const tkt: Ticket = {
          id: `tkt-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
          ticketCode: code,
          orderId: order.id,
          eventId: event.id,
          eventTitle: event.title,
          ticketTypeId: item.ticketTypeId,
          ticketTypeName: item.ticketTypeName,
          gateRecommendation:
            item.ticketTypeName.toLowerCase().includes('vip') ||
            item.ticketTypeName.toLowerCase().includes('tribune')
              ? 'Porte C - VIP'
              : 'Porte A - Entrée Principale',
          seatNumber: `Place ${Math.floor(10 + Math.random() * 900)}`,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          pricePaid: item.unitPrice,
          status: 'VALID',
          qrData: `JELTIX:${code}:${event.id}:VALID`,
          createdAt: new Date().toISOString(),
        };
        newTickets.push(tkt);
      }
    });

    this.orders.unshift(order);
    this.tickets.unshift(...newTickets);
    this.save();

    // Persistance asynchrone via /api/local-db (Admin Supabase & Disque Mac)
    (async () => {
      try {
        await fetch('/api/local-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'PURCHASE',
            order,
            tickets: newTickets,
          }),
        });
      } catch (err) {
        console.warn('Notice synchronisation achat:', err);
      }
    })();

    return { order, generatedTickets: newTickets };
  }

  // VALIDATION ATOMIQUE DU SCAN — INSTANTANÉ EN LOCAL + SYNCHRONISATION SUPABASE
  public validateScanAtomic(
    ticketCode: string,
    gate: string = 'Porte A - Entrée Principale',
    controllerName: string = 'Contrôleur Porte A'
  ): {
    success: boolean;
    result: ScanResultType;
    message: string;
    ticket?: Ticket;
    previousScanDate?: string;
    previousScanGate?: string;
  } {
    const cleanCode = ticketCode.trim().toUpperCase();
    const ticket = this.tickets.find(
      (t) =>
        t.ticketCode.toUpperCase() === cleanCode ||
        t.ticketCode.replace('JT-', 'FT-') === cleanCode ||
        t.ticketCode.replace('FT-', 'JT-') === cleanCode
    );

    // Cas 1 : Faux billet ou billet inconnu
    if (!ticket) {
      const scanLog: ScanLog = {
        id: `scn-${Date.now()}`,
        ticketId: '',
        ticketCode: cleanCode,
        eventId: '',
        ticketTypeName: 'Inconnu',
        gate,
        controllerName,
        result: 'INVALID',
        errorMessage: 'Billet introuvable ou faux code QR',
        scannedAt: new Date().toISOString(),
      };
      this.scans.unshift(scanLog);
      this.save();

      // Journaliser le faux scan via /api/local-db
      fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VALIDATE_SCAN',
          ticketCode: cleanCode,
          gate,
          controllerName,
        }),
      }).catch(() => {});

      return {
        success: false,
        result: 'INVALID',
        message: 'FAUX BILLET OU CODE INCONNU DANS LE REGISTRE JËL TIX',
      };
    }

    // Cas 2 : Tentative de double passage (Fraude)
    if (ticket.status === 'USED') {
      const scanLog: ScanLog = {
        id: `scn-${Date.now()}`,
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        eventId: ticket.eventId,
        ticketTypeName: ticket.ticketTypeName,
        gate,
        controllerName,
        result: 'ALREADY_SCANNED',
        errorMessage: `Déjà scanné ${
          ticket.usedAt ? `à ${new Date(ticket.usedAt).toLocaleTimeString()}` : 'précédemment'
        } à ${ticket.usedGate || gate}`,
        scannedAt: new Date().toISOString(),
      };
      this.scans.unshift(scanLog);
      this.save();

      // Journaliser l'alerte double scan via /api/local-db
      fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VALIDATE_SCAN',
          ticketCode: cleanCode,
          gate,
          controllerName,
        }),
      }).catch(() => {});

      return {
        success: false,
        result: 'ALREADY_SCANNED',
        message: `ALERTE : Billet #${ticket.ticketCode} déjà scanné !`,
        ticket,
        previousScanDate: ticket.usedAt,
        previousScanGate: ticket.usedGate,
      };
    }

    // Cas 3 : Billet valide -> Passage autorisé
    ticket.status = 'USED';
    ticket.usedAt = new Date().toISOString();
    ticket.usedGate = gate;
    ticket.usedByController = controllerName;

    const scanLog: ScanLog = {
      id: `scn-${Date.now()}`,
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      eventId: ticket.eventId,
      ticketTypeName: ticket.ticketTypeName,
      gate,
      controllerName,
      result: 'VALID',
      scannedAt: new Date().toISOString(),
    };

    this.scans.unshift(scanLog);
    this.save();

    // Mettre à jour dans Supabase Cloud via /api/local-db
    fetch('/api/local-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'VALIDATE_SCAN',
        ticketCode: cleanCode,
        gate,
        controllerName,
      }),
    }).catch(() => {});

    return {
      success: true,
      result: 'VALID',
      message: `Billet #${ticket.ticketCode} VALIDÉ • Entrée autorisée`,
      ticket,
    };
  }

  // ENREGISTREMENT INSTANTANÉ D'UN SCAN ET SYNCHRONISATION DU STATUT DU BILLET
  public recordScanEvent(scanLog: ScanLog, updatedTicket?: Partial<Ticket>): void {
    // 1. Ajouter le log de scan dans this.scans
    this.scans = [scanLog, ...this.scans.filter((s) => s.id !== scanLog.id)];

    // 2. Mettre à jour le statut du billet local
    if (updatedTicket && updatedTicket.ticketCode) {
      const cleanCode = updatedTicket.ticketCode.trim().toUpperCase();
      const idx = this.tickets.findIndex((t) => {
        const tc = t.ticketCode.trim().toUpperCase();
        return (
          tc === cleanCode ||
          tc.replace('JT-', 'FT-') === cleanCode ||
          tc.replace('FT-', 'JT-') === cleanCode
        );
      });
      if (idx !== -1) {
        this.tickets[idx] = {
          ...this.tickets[idx],
          ...updatedTicket,
        };
      }
    }

    this.saveLocalOnly();
    this.save();
    this.listeners.forEach((l) => l());
  }

  // CRÉATION D'UN NOUVEL ÉVÉNEMENT — LOCAL + PERSISTANCE DISQUE MAC + SUPABASE EN FOND
  public async createEvent(eventData: Omit<EventItem, 'id' | 'createdAt' | 'soldCapacity'>) {
    const newEvent: EventItem = {
      ...eventData,
      id: `evt-${Date.now()}`,
      soldCapacity: 0,
      createdAt: new Date().toISOString(),
    };
    this.events.unshift(newEvent);
    this.saveLocalOnly();
    this.save();

    // Attendre explicitement l'écriture sur le disque Mac pour garantir la persistance immédiate
    await this.persistToDiskAsync();

    // Créer immédiatement dans Supabase Cloud via l'API sécurisée
    try {
      const res = await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_EVENT',
          event: newEvent,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.event && json.event.id) {
          newEvent.id = json.event.id;
          if (json.event.ticketTypes) {
            newEvent.ticketTypes = json.event.ticketTypes;
          }
          this.saveLocalOnly();
          this.save();
        }
      }
    } catch (err) {
      console.warn('Notice createEvent cloud sync:', err);
    }

    return newEvent;
  }

  // Mise à jour statut
  public async updateEventStatus(eventId: string, status: EventStatus) {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      event.status = status;
      this.save();
      await this.persistToDiskAsync();
      try {
        fetch('/api/local-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE_EVENT_STATUS',
            eventId,
            status,
          }),
        }).catch(() => {});
      } catch {}
    }
  }

  // Suppression événement avec suppression locale immédiate et cascade Supabase
  public async deleteEvent(eventIdOrSlug: string) {
    const target = this.events.find((e) => e.id === eventIdOrSlug || e.slug === eventIdOrSlug);
    const idToDelete = target?.id || eventIdOrSlug;
    const slugToDelete = target?.slug || eventIdOrSlug;

    this.events = this.events.filter((e) => e.id !== idToDelete && e.slug !== slugToDelete);
    this.save();
    await this.persistToDiskAsync();
    this.lastSyncTime = Date.now();

    try {
      await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_EVENT',
          eventId: idToDelete,
          slug: slugToDelete,
        }),
      });
    } catch (err) {
      console.warn('Notice suppression événement backend:', err);
    }
  }

  // Modification complète d'événement
  public async updateEvent(eventIdOrSlug: string, updatedData: Partial<EventItem>) {
    const index = this.events.findIndex((e) => e.id === eventIdOrSlug || e.slug === eventIdOrSlug);
    if (index === -1) throw new Error('Événement introuvable');

    const current = this.events[index];
    const seenTypes = new Set<string>();
    const sanitizedTicketTypes = updatedData.ticketTypes
      ? updatedData.ticketTypes.filter((tt) => {
          const key = (tt.name || '').trim().toLowerCase();
          if (!key || seenTypes.has(key)) return false;
          seenTypes.add(key);
          return true;
        })
      : current.ticketTypes;

    const totalCap = sanitizedTicketTypes
      ? sanitizedTicketTypes.reduce((sum, tt) => sum + (Number(tt.totalQuantity) || 0), 0)
      : (updatedData.totalCapacity ?? current.totalCapacity);

    const merged: EventItem = {
      ...current,
      ...updatedData,
      totalCapacity: totalCap,
      ticketTypes: sanitizedTicketTypes,
    };

    this.events[index] = merged;
    this.save();
    await this.persistToDiskAsync();
    this.lastSyncTime = Date.now();

    try {
      await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_EVENT',
          event: merged,
        }),
      });
    } catch (err) {
      console.warn('Notice modification événement backend:', err);
    }

    return merged;
  }

  // Ajout utilisateur
  public addUser(userData: Omit<UserProfile, 'id' | 'createdAt'>) {
    const newUser: UserProfile = {
      ...userData,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.users.unshift(newUser);
    this.save();
    return newUser;
  }

  public toggleUserStatus(userId: string) {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      user.isActive = !user.isActive;
      this.save();
    }
  }

  // KPIs en temps réel
  public getDashboardKPIs(): DashboardKPIs {
    const isOrganizer = this.currentUser?.role === 'ORGANIZER';
    const isSeller = this.currentUser?.role === 'SELLER';

    const scopedEvents = isOrganizer
      ? this.events.filter((e) => e.organizerId === this.currentUser?.id)
      : isSeller
      ? this.events.filter((e) => e.organizerId === (this.currentUser?.organizationId || this.currentUser?.id))
      : this.events;

    const scopedEventIds = new Set(scopedEvents.map((e) => e.id));

    const scopedTickets = isOrganizer
      ? this.tickets.filter((t) => scopedEventIds.has(t.eventId))
      : this.tickets;

    const scopedOrders = isOrganizer
      ? this.orders.filter((o) => scopedEventIds.has(o.eventId))
      : this.orders;

    const scopedScans = isOrganizer
      ? this.scans.filter((s) => scopedEventIds.has(s.eventId))
      : this.scans;

    const totalRevenue =
      scopedOrders.length > 0
        ? scopedOrders.reduce((sum, o) => sum + o.totalAmount, 0)
        : scopedTickets.reduce((sum, t) => sum + t.pricePaid, 0);

    const totalTicketsSold = scopedEvents.reduce((sum, e) => sum + e.soldCapacity, 0);
    const activeEventsCount = scopedEvents.filter((e) => e.status === 'PUBLISHED').length;
    const successfulScansCount = scopedScans.filter((s) => s.result === 'VALID').length;
    const totalCapacity = scopedEvents.reduce((sum, e) => sum + e.totalCapacity, 0);
    const globalFillRate =
      totalCapacity > 0 ? Math.round((totalTicketsSold / totalCapacity) * 100) : 0;

    return {
      totalRevenue,
      revenueGrowth: 0,
      totalTicketsSold,
      ticketsGrowth: 0,
      activeEventsCount,
      successfulScansCount,
      globalFillRate,
    };
  }

  // Réinitialisation propre (zéro fausses données)
  public resetToDemoData() {
    this.events = [];
    this.tickets = [];
    this.scans = [];
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.orders = [];
    this.save();
  }
}

// Instance Singleton
export const jeltixStoreInstance = new JeltixStore();

// React Hook
export function useJeltixStore() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Initial sync
    jeltixStoreInstance.syncFromSupabaseAndDisk();

    return jeltixStoreInstance.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return useMemo(
    () => ({
      events: jeltixStoreInstance.getEvents(),
      tickets: jeltixStoreInstance.getTickets(),
      scans: jeltixStoreInstance.getScans(),
      users: jeltixStoreInstance.getUsers(),
      orders: jeltixStoreInstance.getOrders(),
      getEventBySlug: (slug: string) => jeltixStoreInstance.getEventBySlug(slug),
      getTicketByCode: (code: string) => jeltixStoreInstance.getTicketByCode(code),
      purchaseTickets: (params: Parameters<typeof jeltixStoreInstance.purchaseTickets>[0]) =>
        jeltixStoreInstance.purchaseTickets(params),
      validateScanAtomic: (code: string, gate?: string, controller?: string) =>
        jeltixStoreInstance.validateScanAtomic(code, gate, controller),
      recordScanEvent: (scanLog: ScanLog, updatedTicket?: Partial<Ticket>) =>
        jeltixStoreInstance.recordScanEvent(scanLog, updatedTicket),
      createEvent: (data: Parameters<typeof jeltixStoreInstance.createEvent>[0]) =>
        jeltixStoreInstance.createEvent(data),
      updateEventStatus: (id: string, status: EventStatus) =>
        jeltixStoreInstance.updateEventStatus(id, status),
      updateEvent: (id: string, data: Parameters<typeof jeltixStoreInstance.updateEvent>[1]) =>
        jeltixStoreInstance.updateEvent(id, data),
      deleteEvent: (id: string) => jeltixStoreInstance.deleteEvent(id),
      addUser: (data: Parameters<typeof jeltixStoreInstance.addUser>[0]) =>
        jeltixStoreInstance.addUser(data),
      toggleUserStatus: (id: string) => jeltixStoreInstance.toggleUserStatus(id),
      currentUser: jeltixStoreInstance.getCurrentUser(),
      setCurrentUser: (user: UserProfile | null) => jeltixStoreInstance.setCurrentUser(user),
      getDashboardKPIs: () => jeltixStoreInstance.getDashboardKPIs(),
      resetToDemoData: () => jeltixStoreInstance.resetToDemoData(),
      syncFromLocalDb: () => jeltixStoreInstance.syncFromLocalDb(),
      syncFromSupabase: () => jeltixStoreInstance.syncFromSupabaseAndDisk(),
    }),
    [tick]
  );
}

// Aliases pour rétrocompatibilité
export const useFoutaStore = useJeltixStore;
export const useStore = useJeltixStore;
