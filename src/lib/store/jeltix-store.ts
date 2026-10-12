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
  const ticketTypes = (record.ticket_types || []).map((tt: any) => ({
    id: tt.id,
    eventId: tt.event_id,
    name: tt.name,
    price: Number(tt.price) || 0,
    badge: tt.badge || '',
    description: tt.description || '',
    totalQuantity: Number(tt.total_quantity) || 0,
    soldQuantity: Number(tt.sold_quantity) || 0,
    isActive: tt.is_active !== false,
  }));

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
    customerEmail: record.customer_email || undefined,
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

  public async syncFromSupabaseAndDisk() {
    if (typeof window === 'undefined' || this.isSyncing) return;
    this.isSyncing = true;

    // 1. Essayer de charger depuis Supabase Cloud en direct
    try {
      const supabase = createClient();
      const { data: sbEvents, error: eventsErr } = await supabase
        .from('events')
        .select(`*, ticket_types (*)`)
        .order('start_date', { ascending: true });

      if (!eventsErr && Array.isArray(sbEvents)) {
        this.events = sbEvents.map(mapSupabaseEventToModel);

        // Tickets
        const { data: sbTickets } = await supabase.from('tickets').select('*');
        if (Array.isArray(sbTickets)) {
          this.tickets = sbTickets.map(mapSupabaseTicketToModel);
        }

        // Scans
        const { data: sbScans } = await supabase.from('scans').select('*').order('created_at', { ascending: false });
        if (Array.isArray(sbScans)) {
          this.scans = sbScans.map(mapSupabaseScanToModel);
        }

        // Orders
        const { data: sbOrders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (Array.isArray(sbOrders)) {
          this.orders = sbOrders.map((o: any) => ({
            id: o.id,
            reference: o.reference,
            eventId: o.event_id,
            eventTitle: '',
            customerName: o.customer_name,
            customerPhone: o.customer_phone,
            customerEmail: o.customer_email || '',
            items: [],
            totalAmount: Number(o.total_amount) || 0,
            paymentMethod: o.payment_method || 'WAVE',
            paymentStatus: o.payment_status || 'COMPLETED',
            sellerId: o.seller_id,
            channel: o.channel || 'ONLINE',
            createdAt: o.created_at || new Date().toISOString(),
          }));
        }

        this.saveLocalOnly();
        this.listeners.forEach((l) => l());
        this.isSyncing = false;
        return;
      }
    } catch (sbErr) {
      console.warn('Note Supabase cloud (utilisation du stockage local Mac):', sbErr);
    }

    // 2. Fallback local Mac Disk (/api/local-db)
    try {
      const res = await fetch('/api/local-db');
      if (res.ok) {
        const json = await res.json();
        if (json.exists && json.data) {
          if (Array.isArray(json.data.events)) this.events = json.data.events;
          if (Array.isArray(json.data.tickets)) this.tickets = json.data.tickets;
          if (Array.isArray(json.data.scans)) this.scans = json.data.scans;
          if (Array.isArray(json.data.orders)) this.orders = json.data.orders;
          if (Array.isArray(json.data.users) && json.data.users.length > 0) this.users = json.data.users;

          this.saveLocalOnly();
          this.listeners.forEach((l) => l());
        }
      }
    } catch (diskErr) {
      console.warn('Notice sync local-db:', diskErr);
    } finally {
      this.isSyncing = false;
    }
  }

  // Alias pour rétrocompatibilité
  public syncFromLocalDb() {
    return this.syncFromSupabaseAndDisk();
  }

  private persistToDisk() {
    if (typeof window === 'undefined') return;
    fetch('/api/local-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: this.events,
        tickets: this.tickets,
        scans: this.scans,
        users: this.users,
        orders: this.orders,
      }),
    }).catch(() => {});
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
        const code = generateTicketCode();
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

    // Persistance asynchrone dans Supabase Cloud
    (async () => {
      try {
        const supabase = createClient();
        const { data: orderRow, error: orderErr } = await supabase
          .from('orders')
          .insert({
            reference: order.reference,
            event_id: order.eventId,
            customer_name: order.customerName,
            customer_phone: order.customerPhone,
            customer_email: order.customerEmail || null,
            total_amount: order.totalAmount,
            payment_method: order.paymentMethod,
            payment_status: 'COMPLETED',
            seller_id: order.sellerId || null,
            channel: order.channel || 'ONLINE',
          })
          .select()
          .single();

        if (orderRow) {
          await supabase.from('tickets').insert(
            newTickets.map((t) => ({
              ticket_code: t.ticketCode,
              order_id: orderRow.id,
              event_id: t.eventId,
              ticket_type_id: t.ticketTypeId,
              customer_name: t.customerName,
              customer_phone: t.customerPhone,
              price_paid: t.pricePaid,
              status: 'VALID',
              gate_recommendation: t.gateRecommendation,
              seat_number: t.seatNumber,
              qr_data: t.qrData,
            }))
          );

          // Synchroniser les jauges dans Supabase
          for (const item of params.items) {
            const { data: ttRow } = await supabase
              .from('ticket_types')
              .select('sold_quantity')
              .eq('id', item.ticketTypeId)
              .single();
            if (ttRow) {
              await supabase
                .from('ticket_types')
                .update({ sold_quantity: (ttRow.sold_quantity || 0) + item.quantity })
                .eq('id', item.ticketTypeId);
            }
          }

          const { data: evRow } = await supabase
            .from('events')
            .select('sold_capacity')
            .eq('id', event.id)
            .single();
          if (evRow) {
            await supabase
              .from('events')
              .update({ sold_capacity: (evRow.sold_capacity || 0) + newTickets.length })
              .eq('id', event.id);
          }
        } else if (orderErr) {
          console.warn('Note Supabase orders insert:', orderErr.message);
        }
      } catch (sbErr) {
        console.warn('Notice Supabase purchase sync:', sbErr);
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

      // Journaliser le faux scan dans Supabase
      (async () => {
        try {
          const supabase = createClient();
          await supabase.from('scans').insert({
            ticket_code: cleanCode,
            gate,
            result: 'INVALID',
            error_message: 'Faux billet ou code inconnu',
          });
        } catch {}
      })();

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

      // Journaliser l'alerte double scan dans Supabase
      (async () => {
        try {
          const supabase = createClient();
          await supabase.from('scans').insert({
            ticket_id: ticket.id,
            ticket_code: ticket.ticketCode,
            event_id: ticket.eventId,
            gate,
            result: 'ALREADY_SCANNED',
            error_message: `Double passage détecté à ${gate}`,
          });
        } catch {}
      })();

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

    // Mettre à jour dans Supabase
    (async () => {
      try {
        const supabase = createClient();
        await supabase
          .from('tickets')
          .update({
            status: 'USED',
            used_at: ticket.usedAt,
            used_gate: gate,
            used_by_controller: controllerName,
          })
          .eq('ticket_code', ticket.ticketCode);

        await supabase.from('scans').insert({
          ticket_id: ticket.id,
          ticket_code: ticket.ticketCode,
          event_id: ticket.eventId,
          gate,
          result: 'VALID',
        });
      } catch {}
    })();

    return {
      success: true,
      result: 'VALID',
      message: `Billet #${ticket.ticketCode} VALIDÉ • Entrée autorisée`,
      ticket,
    };
  }

  // CRÉATION D'UN NOUVEL ÉVÉNEMENT — LOCAL + PERSISTANCE DIRECTE SUPABASE
  public createEvent(eventData: Omit<EventItem, 'id' | 'createdAt' | 'soldCapacity'>) {
    const newEvent: EventItem = {
      ...eventData,
      id: `evt-${Date.now()}`,
      soldCapacity: 0,
      createdAt: new Date().toISOString(),
    };
    this.events.unshift(newEvent);
    this.save();

    // Persister dans Supabase Cloud
    (async () => {
      try {
        const supabase = createClient();
        const { data: eventRow, error: eventErr } = await supabase
          .from('events')
          .insert({
            slug: newEvent.slug,
            title: newEvent.title,
            category: newEvent.category,
            venue: newEvent.venue,
            location_details: newEvent.locationDetails,
            start_date: newEvent.startDate,
            banner_image: newEvent.bannerImage,
            description: newEvent.description,
            status: newEvent.status || 'PUBLISHED',
            total_capacity: newEvent.totalCapacity,
            sold_capacity: 0,
            organizer_id: newEvent.organizerId || 'a0000000-0000-0000-0000-000000000001',
          })
          .select()
          .single();

        if (eventRow) {
          // Si Supabase a généré un UUID officiel, associer les types de billets
          if (newEvent.ticketTypes && newEvent.ticketTypes.length > 0) {
            const ttInserts = newEvent.ticketTypes.map((tt) => ({
              event_id: eventRow.id,
              name: tt.name,
              price: tt.price,
              badge: tt.badge || null,
              description: tt.description || '',
              total_quantity: tt.totalQuantity,
              sold_quantity: 0,
              is_active: tt.isActive !== false,
            }));

            const { data: ttRows } = await supabase.from('ticket_types').insert(ttInserts).select();
            if (ttRows) {
              newEvent.ticketTypes = ttRows.map((tt: any) => ({
                id: tt.id,
                eventId: tt.event_id,
                name: tt.name,
                price: Number(tt.price),
                badge: tt.badge || '',
                description: tt.description || '',
                totalQuantity: Number(tt.total_quantity),
                soldQuantity: Number(tt.sold_quantity) || 0,
                isActive: tt.is_active !== false,
              }));
              newEvent.id = eventRow.id;
              this.save();
            }
          }
        } else if (eventErr) {
          console.warn('Note insertion Supabase events:', eventErr.message);
        }
      } catch (err) {
        console.warn('Notice Supabase createEvent:', err);
      }
    })();

    return newEvent;
  }

  // Mise à jour statut
  public updateEventStatus(eventId: string, status: EventStatus) {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      event.status = status;
      this.save();
      try {
        const supabase = createClient();
        supabase.from('events').update({ status }).eq('id', eventId).then(() => {});
      } catch {}
    }
  }

  // Suppression événement
  public deleteEvent(eventId: string) {
    this.events = this.events.filter((e) => e.id !== eventId);
    this.save();
    try {
      const supabase = createClient();
      supabase.from('events').delete().eq('id', eventId).then(() => {});
    } catch {}
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

    const scopedEvents = isOrganizer
      ? this.events.filter((e) => e.organizerId === this.currentUser?.id)
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
      createEvent: (data: Parameters<typeof jeltixStoreInstance.createEvent>[0]) =>
        jeltixStoreInstance.createEvent(data),
      updateEventStatus: (id: string, status: EventStatus) =>
        jeltixStoreInstance.updateEventStatus(id, status),
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
