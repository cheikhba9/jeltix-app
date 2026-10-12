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

const INITIAL_EVENTS: EventItem[] = [
  {
    id: 'evt-1',
    slug: 'match-pilote-finale-coupe',
    title: 'Finale Coupe du Sénégal : ASC Jaraaf vs Teungueth FC',
    category: 'Football',
    venue: 'Stade Abdoulaye Wade',
    locationDetails: 'Dakar, Diamniadio',
    startDate: '2026-11-20T18:00:00Z',
    timeString: '18:00 UTC',
    bannerImage: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80',
    description: 'La grande finale de la Coupe du Sénégal opposant les deux meilleures formations de la saison dans un stade ultra-moderne de 50 000 places. Contrôle d’accès digitalisé Jël Tix aux tourniquets.',
    importantInfo: [
      "Les portes ouvrent 3 heures avant le coup d'envoi. Prévoyez d'arriver en avance.",
      "Votre billet électronique Jël Tix (QR Code dynamique) suffit à l'entrée.",
      "Les objets dangereux, fumigènes et bouteilles en verre sont strictement interdits."
    ],
    status: 'PUBLISHED',
    totalCapacity: 50000,
    soldCapacity: 42500,
    organizerId: 'usr-1',
    organizerName: 'Fédération Sénégalaise de Football',
    ticketTypes: [
      {
        id: 'tt-1',
        eventId: 'evt-1',
        name: 'Billet Gradins Virage',
        price: 300,
        badge: 'Populaire',
        description: 'Accès aux gradins généraux. Placement libre virages Nord & Sud.',
        totalQuantity: 35000,
        soldQuantity: 31200,
        isActive: true,
      },
      {
        id: 'tt-2',
        eventId: 'evt-1',
        name: 'Billet Tribune Couverte',
        price: 500,
        badge: 'Vue Optimale',
        description: 'Accès à la tribune couverte centrale. Vue optimale sur la pelouse.',
        totalQuantity: 12000,
        soldQuantity: 9800,
        isActive: true,
      },
      {
        id: 'tt-3',
        eventId: 'evt-1',
        name: 'Loge VIP Prestige',
        price: 5000,
        badge: 'VIP All-Access',
        description: 'Salon VIP climatisé, buffet dînatoire, parking réservé et accueil hôtesse.',
        totalQuantity: 3000,
        soldQuantity: 1500,
        isActive: true,
      },
    ],
    createdAt: '2026-04-01T10:00:00Z',
  },
  {
    id: 'evt-2',
    slug: 'choc-des-arenes-lutte',
    title: 'Choc Royal de Lutte Sénégalaise : Combat des Titans',
    category: 'Lutte Sénégalaise',
    venue: 'Arène Nationale de Pikine',
    locationDetails: 'Pikine, Dakar',
    startDate: '2026-11-28T16:30:00Z',
    timeString: '16:30 UTC',
    bannerImage: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=80',
    description: 'Le choc incontournable de l’arène sénégalaise pour le titre suprême du Roi des Arènes. Ambiance mémorable, bakk des lutteurs et tambours traditionnels.',
    importantInfo: [
      "Ouverture des portes dès 12h00.",
      "Accès dédié VIP et billetterie dématérialisée via application Jël Tix.",
      "Service d'ordre renforcé et contrôle biométrique/QR aux accès."
    ],
    status: 'PUBLISHED',
    totalCapacity: 22000,
    soldCapacity: 18400,
    organizerId: 'usr-2',
    organizerName: 'Gaston Productions & CNG Lutte',
    ticketTypes: [
      {
        id: 'tt-lutte-1',
        eventId: 'evt-2',
        name: 'Entrée Générale Découverte',
        price: 1500,
        badge: 'Gradins',
        description: 'Gradins généraux face aux chorégraphies des écuries.',
        totalQuantity: 16000,
        soldQuantity: 14200,
        isActive: true,
      },
      {
        id: 'tt-lutte-2',
        eventId: 'evt-2',
        name: 'Tribune Annexe Face Bakk',
        price: 3000,
        badge: 'Populaire',
        description: 'Place assise surélevée avec vue plongeante sur l’enceinte de sable.',
        totalQuantity: 4500,
        soldQuantity: 3400,
        isActive: true,
      },
      {
        id: 'tt-lutte-3',
        eventId: 'evt-2',
        name: 'Carré VIP Enceinte Privilège',
        price: 15000,
        badge: 'VIP Or',
        description: 'Au plus près des lutteurs, boisson offerte et entrée prioritaire.',
        totalQuantity: 1500,
        soldQuantity: 800,
        isActive: true,
      },
    ],
    createdAt: '2026-04-05T12:00:00Z',
  },
  {
    id: 'evt-3',
    slug: 'festival-des-arts-urbains',
    title: 'Dakar Urban Fest & Nuit Électro-Afrobeat 2026',
    category: 'Concert / Festival',
    venue: 'Esplanade du Grand Théâtre National',
    locationDetails: 'Dakar, Centre-Ville',
    startDate: '2026-12-15T20:00:00Z',
    timeString: '20:00 - 04:00 UTC',
    bannerImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
    description: 'Le plus grand rassemblement des cultures urbaines d’Afrique de l’Ouest avec les meilleurs artistes Hip-Hop, Mbalax nouvelle génération et DJs internationaux.',
    importantInfo: [
      "Entrée interdite aux mineurs non accompagnés.",
      "Pass bracelets Jël Tix distribués aux guichets rapides."
    ],
    status: 'PUBLISHED',
    totalCapacity: 8000,
    soldCapacity: 5900,
    organizerId: 'usr-2',
    organizerName: 'Dakar Live Agency',
    ticketTypes: [
      {
        id: 'tt-fest-1',
        eventId: 'evt-3',
        name: 'Pass Standard Électro',
        price: 5000,
        badge: 'Accès Général',
        description: 'Accès à la fosse générale face à la grande scène.',
        totalQuantity: 6000,
        soldQuantity: 4700,
        isActive: true,
      },
      {
        id: 'tt-fest-2',
        eventId: 'evt-3',
        name: 'Pass VIP Lounge & Backstage',
        price: 25000,
        badge: 'VIP Lounge',
        description: 'Bar ouvert, espace surélevé et rencontre artistes.',
        totalQuantity: 2000,
        soldQuantity: 1200,
        isActive: true,
      },
    ],
    createdAt: '2026-04-10T14:00:00Z',
  },
  {
    id: 'evt-4',
    slug: 'bal-playoffs-dakar',
    title: 'Basketball Africa League (BAL) : Dakar Sahara Conference',
    category: 'Basketball',
    venue: 'Dakar Arena',
    locationDetails: 'Diamniadio, Dakar',
    startDate: '2026-12-24T17:00:00Z',
    timeString: '17:00 UTC',
    bannerImage: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1200&q=80',
    description: 'Les phases finales de la prestigieuse Basketball Africa League à la Dakar Arena. Les meilleures franchises africaines s’affrontent pour le titre continental.',
    importantInfo: [
      "Accès facilité via le Train Express Régional (TER).",
      "Contrôle digital instantané aux portes."
    ],
    status: 'PUBLISHED',
    totalCapacity: 15000,
    soldCapacity: 11200,
    organizerId: 'usr-1',
    organizerName: 'NBA Africa / BAL Official',
    ticketTypes: [
      {
        id: 'tt-bal-1',
        eventId: 'evt-4',
        name: 'Gradins Supérieurs',
        price: 2000,
        badge: 'Gradins',
        description: 'Vue d’ensemble sur le parquet.',
        totalQuantity: 10000,
        soldQuantity: 7900,
        isActive: true,
      },
      {
        id: 'tt-bal-2',
        eventId: 'evt-4',
        name: 'Courtside VIP Plancher',
        price: 20000,
        badge: 'VIP Courtside',
        description: 'Au bord immédiat du parquet NBA.',
        totalQuantity: 5000,
        soldQuantity: 3300,
        isActive: true,
      },
    ],
    createdAt: '2026-04-12T16:00:00Z',
  },
  {
    id: 'evt-5',
    slug: 'nuit-des-oscars-de-vacances-2026',
    title: 'Grande Nuit des Oscars de Vacances 2026 & Trophées de l\'Excellence',
    category: 'Oscars & Soirées Gala',
    venue: 'Centre International de Conférences Abdou Diouf (CICAD)',
    locationDetails: 'Diamniadio, Dakar',
    startDate: '2027-01-05T19:30:00Z',
    timeString: '19:30 UTC',
    bannerImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    description: 'La prestigieuse cérémonie annuelle des Oscars de Vacances récompensant la jeunesse, la création culturelle, les artistes émergents et l\'excellence associative.',
    importantInfo: [
      "Tenue de soirée ou tenue traditionnelle de gala exigée.",
      "Tapis rouge et cocktail de bienvenue dès 18h30.",
      "Billet numérique Jël Tix scanné à l'entrée principale du CICAD."
    ],
    status: 'PUBLISHED',
    totalCapacity: 3500,
    soldCapacity: 2800,
    organizerId: 'usr-2',
    organizerName: 'Comité National des Oscars de Vacances',
    ticketTypes: [
      {
        id: 'tt-osc-1',
        eventId: 'evt-5',
        name: 'Pass Découverte Jeunesse',
        price: 2000,
        badge: 'Accès Salle',
        description: 'Accès aux gradins supérieurs et à la cérémonie officielle.',
        totalQuantity: 2000,
        soldQuantity: 1750,
        isActive: true,
      },
      {
        id: 'tt-osc-2',
        eventId: 'evt-5',
        name: 'Carré VIP Tapis Rouge',
        price: 10000,
        badge: 'VIP Cocktail',
        description: 'Accès Tapis Rouge, cocktail dinatoire et parterre d\'honneur.',
        totalQuantity: 1000,
        soldQuantity: 850,
        isActive: true,
      },
      {
        id: 'tt-osc-3',
        eventId: 'evt-5',
        name: 'Table Prestige Officiel (4 Personnes)',
        price: 50000,
        badge: 'Table VIP All-Access',
        description: 'Table nominative devant la scène avec champagne et service dédié.',
        totalQuantity: 500,
        soldQuantity: 200,
        isActive: true,
      },
    ],
    createdAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'evt-6',
    slug: 'grand-gala-du-rire-et-theatre',
    title: 'Le Grand Gala du Rire & Théâtre d\'Afrique',
    category: 'Théâtre & Humour',
    venue: 'Théâtre National Daniel Sorano',
    locationDetails: 'Dakar, Plateau',
    startDate: '2027-01-20T20:30:00Z',
    timeString: '20:30 UTC',
    bannerImage: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80',
    description: 'Une nuit exceptionnelle réunissant les plus grands comédiens, troupes de théâtre et artistes de stand-up du Sénégal et de la sous-région.',
    importantInfo: [
      "Ouverture des portes à 19h30. Spectacle ponctuel à 20h30.",
      "Placement assise numéroté garanti par le système Jël Tix."
    ],
    status: 'PUBLISHED',
    totalCapacity: 1200,
    soldCapacity: 950,
    organizerId: 'usr-1',
    organizerName: 'Sorano Spectacles & Productions',
    ticketTypes: [
      {
        id: 'tt-th-1',
        eventId: 'evt-6',
        name: 'Place Balcon Rire',
        price: 3000,
        badge: 'Balcon',
        description: 'Place assise au balcon avec vue d\'ensemble sur la scène.',
        totalQuantity: 700,
        soldQuantity: 610,
        isActive: true,
      },
      {
        id: 'tt-th-2',
        eventId: 'evt-6',
        name: 'Fauteuil Orchestre VIP',
        price: 10000,
        badge: 'VIP Orchestre',
        description: 'Fauteuil réservé au rez-de-chaussée tout près des comédiens.',
        totalQuantity: 500,
        soldQuantity: 340,
        isActive: true,
      },
    ],
    createdAt: '2026-04-20T11:00:00Z',
  }
];

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'tkt-1',
    ticketCode: 'JT-8921-X',
    orderId: 'cmd-1',
    eventId: 'evt-1',
    eventTitle: 'Finale Coupe du Sénégal : ASC Jaraaf vs Teungueth FC',
    ticketTypeId: 'tt-1',
    ticketTypeName: 'Billet Gradins Virage',
    gateRecommendation: 'Porte A - Entrée Principale',
    seatNumber: 'Virage Sud - Rang 14 / Place 8',
    customerName: 'Moussa Diop',
    customerPhone: '+221 77 123 45 67',
    pricePaid: 300,
    status: 'USED',
    usedAt: new Date(Date.now() - 12000).toISOString(),
    usedGate: 'Porte A - Entrée Principale',
    usedByController: 'Modou Ndiaye',
    qrData: 'JELTIX:JT-8921-X:evt-1:VALID',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'tkt-2',
    ticketCode: 'JT-1044-Y',
    orderId: 'cmd-2',
    eventId: 'evt-1',
    eventTitle: 'Finale Coupe du Sénégal : ASC Jaraaf vs Teungueth FC',
    ticketTypeId: 'tt-2',
    ticketTypeName: 'Billet Tribune Couverte',
    gateRecommendation: 'Porte C - VIP',
    seatNumber: 'Tribune Couverte - Rang 5 / Place 21',
    customerName: 'Awa Seck',
    customerPhone: '+221 78 987 65 43',
    pricePaid: 500,
    status: 'USED',
    usedAt: new Date(Date.now() - 45000).toISOString(),
    usedGate: 'Porte C - VIP',
    usedByController: 'Awa Seck',
    qrData: 'JELTIX:JT-1044-Y:evt-1:VALID',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'tkt-3',
    ticketCode: 'JT-9932-Z',
    orderId: 'cmd-3',
    eventId: 'evt-1',
    eventTitle: 'Finale Coupe du Sénégal : ASC Jaraaf vs Teungueth FC',
    ticketTypeId: 'tt-1',
    ticketTypeName: 'Billet Gradins Virage',
    gateRecommendation: 'Porte A - Entrée Principale',
    seatNumber: 'Virage Nord - Rang 8 / Place 3',
    customerName: 'Cheikh Tidiane Ba',
    customerPhone: '+221 76 444 33 22',
    pricePaid: 300,
    status: 'USED',
    usedAt: new Date(Date.now() - 120000).toISOString(),
    usedGate: 'Porte A - Entrée Principale',
    qrData: 'JELTIX:JT-9932-Z:evt-1:VALID',
    createdAt: new Date(Date.now() - 15000000).toISOString(),
  },
  {
    id: 'tkt-4',
    ticketCode: 'JT-4412-A',
    orderId: 'cmd-4',
    eventId: 'evt-1',
    eventTitle: 'Finale Coupe du Sénégal : ASC Jaraaf vs Teungueth FC',
    ticketTypeId: 'tt-1',
    ticketTypeName: 'Billet Gradins Virage',
    gateRecommendation: 'Porte B - Gradins',
    seatNumber: 'Virage Sud - Rang 20 / Place 15',
    customerName: 'Fatou Bintou Sow',
    customerPhone: '+221 70 888 99 11',
    pricePaid: 300,
    status: 'USED',
    usedAt: new Date(Date.now() - 180000).toISOString(),
    usedGate: 'Porte B - Gradins',
    qrData: 'JELTIX:JT-4412-A:evt-1:VALID',
    createdAt: new Date(Date.now() - 20000000).toISOString(),
  },
  // Ready to scan ticket for instant demo!
  {
    id: 'tkt-5',
    ticketCode: 'JT-7777-DEMO',
    orderId: 'cmd-5',
    eventId: 'evt-1',
    eventTitle: 'Finale Coupe du Sénégal : ASC Jaraaf vs Teungueth FC',
    ticketTypeId: 'tt-2',
    ticketTypeName: 'Billet Tribune Couverte',
    gateRecommendation: 'Porte C - VIP',
    seatNumber: 'Tribune Officielle - Place 42',
    customerName: 'Ibrahima Diallo',
    customerPhone: '+221 77 555 12 34',
    pricePaid: 500,
    status: 'VALID',
    qrData: 'JELTIX:JT-7777-DEMO:evt-1:VALID',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tkt-6',
    ticketCode: 'JT-2026-VIP',
    orderId: 'cmd-6',
    eventId: 'evt-2',
    eventTitle: 'Choc Royal de Lutte Sénégalaise : Combat des Titans',
    ticketTypeId: 'tt-lutte-3',
    ticketTypeName: 'Carré VIP Enceinte Privilège',
    gateRecommendation: 'Porte C - VIP',
    seatNumber: 'Enceinte Privilège - Table Or',
    customerName: 'Aïssatou Ndiaye',
    customerPhone: '+221 77 888 77 66',
    pricePaid: 15000,
    status: 'VALID',
    qrData: 'JELTIX:JT-2026-VIP:evt-2:VALID',
    createdAt: new Date().toISOString(),
  }
];

const INITIAL_SCANS: ScanLog[] = [
  {
    id: 'scn-1',
    ticketId: 'tkt-1',
    ticketCode: 'JT-8921-X',
    eventId: 'evt-1',
    ticketTypeName: 'Billet Gradins Virage',
    gate: 'Porte A - Entrée Principale',
    controllerName: 'Modou Ndiaye',
    result: 'VALID',
    scannedAt: new Date(Date.now() - 12000).toISOString(),
  },
  {
    id: 'scn-2',
    ticketId: 'tkt-2',
    ticketCode: 'JT-1044-Y',
    eventId: 'evt-1',
    ticketTypeName: 'Billet Tribune Couverte',
    gate: 'Porte C - VIP',
    controllerName: 'Awa Seck',
    result: 'ALREADY_SCANNED',
    errorMessage: 'Déjà scanné il y a 45 sec à la Porte C',
    scannedAt: new Date(Date.now() - 45000).toISOString(),
  },
  {
    id: 'scn-3',
    ticketId: 'tkt-3',
    ticketCode: 'JT-9932-Z',
    eventId: 'evt-1',
    ticketTypeName: 'Billet Gradins Virage',
    gate: 'Porte A - Entrée Principale',
    controllerName: 'Modou Ndiaye',
    result: 'VALID',
    scannedAt: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'scn-4',
    ticketId: 'tkt-4',
    ticketCode: 'JT-4412-A',
    eventId: 'evt-1',
    ticketTypeName: 'Billet Gradins Virage',
    gate: 'Porte B - Gradins',
    controllerName: 'Aliou Fall',
    result: 'VALID',
    scannedAt: new Date(Date.now() - 180000).toISOString(),
  }
];

const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-1',
    fullName: 'Super Administrateur',
    email: 'admin@foutaticket.sn',
    phone: '+221 77 000 00 00',
    role: 'SUPER_ADMIN',
    organization: 'Jël Tix & FoutaTicket',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-admin-2',
    fullName: 'Admin Jël Tix',
    email: 'admin@jeltix.sn',
    phone: '+221 77 000 00 01',
    role: 'SUPER_ADMIN',
    organization: 'Jël Tix SAS',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-2',
    fullName: 'Amadou Fall',
    email: 'amadou.organizer@gmail.com',
    phone: '+221 77 111 22 33',
    role: 'ORGANIZER',
    organization: 'Fédération Sénégalaise de Football',
    isActive: true,
    createdAt: '2026-02-15T00:00:00Z',
  },
  {
    id: 'usr-3',
    fullName: 'Vendeur Guichet A',
    email: 'seller.stade1@jeltix.sn',
    phone: '+221 78 222 33 44',
    role: 'SELLER',
    organization: 'Guichet Stade Abdoulaye Wade',
    isActive: true,
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'usr-4',
    fullName: 'Contrôleur Porte A',
    email: 'control.porteA@jeltix.sn',
    phone: '+221 76 333 44 55',
    role: 'CONTROLLER',
    organization: 'Sécurité Stade Abdoulaye Wade',
    isActive: true,
    createdAt: '2026-03-10T00:00:00Z',
  }
];

class JeltixStore {
  private events: EventItem[];
  private tickets: Ticket[];
  private scans: ScanLog[];
  private users: UserProfile[];
  private orders: Order[] = [];
  private currentUser: UserProfile | null = null;
  private listeners: Array<() => void> = [];

  private broadcastChannel: BroadcastChannel | null = null;
  private isSyncingFromDisk = false;

  constructor() {
    this.events = JSON.parse(JSON.stringify(INITIAL_EVENTS));
    this.tickets = JSON.parse(JSON.stringify(INITIAL_TICKETS));
    this.scans = JSON.parse(JSON.stringify(INITIAL_SCANS));
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.currentUser = this.users[0] || null;

    if (typeof window !== 'undefined') {
      try {
        const hasCleanedLegacy = localStorage.getItem('jeltix_clean_zero_v3');
        if (!hasCleanedLegacy) {
          localStorage.removeItem('jeltix_events_v2');
          localStorage.removeItem('jeltix_tickets_v2');
          localStorage.removeItem('jeltix_scans_v2');
          localStorage.removeItem('jeltix_orders_v2');
          localStorage.removeItem('jeltix_users_v2');
          localStorage.setItem('jeltix_clean_zero_v3', 'true');
        }

        this.reloadFromLocalStorage();
        this.initSync();
      } catch (err) {
        console.warn('Erreur lors du chargement des données locales Jël Tix:', err);
      }
    }
  }

  private reloadFromLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      const savedEvents = localStorage.getItem('jeltix_events_v3');
      const savedTickets = localStorage.getItem('jeltix_tickets_v3');
      const savedScans = localStorage.getItem('jeltix_scans_v3');
      const savedUsers = localStorage.getItem('jeltix_users_v3');
      const savedOrders = localStorage.getItem('jeltix_orders_v3');
      const savedCurrentUser =
        localStorage.getItem('jeltix_current_user_v2') || localStorage.getItem('jeltix_current_user');

      if (savedEvents) {
        try {
          const parsed = JSON.parse(savedEvents);
          if (Array.isArray(parsed) && parsed.length > 0) this.events = parsed;
        } catch {}
      }
      if (savedTickets) {
        try {
          const parsed = JSON.parse(savedTickets);
          if (Array.isArray(parsed) && parsed.length > 0) this.tickets = parsed;
        } catch {}
      }
      if (savedScans) {
        try {
          const parsed = JSON.parse(savedScans);
          if (Array.isArray(parsed) && parsed.length > 0) this.scans = parsed;
        } catch {}
      }
      if (savedUsers) {
        try {
          const parsed = JSON.parse(savedUsers);
          if (Array.isArray(parsed) && parsed.length > 0) this.users = parsed;
        } catch {}
      }
      if (savedOrders) {
        try { this.orders = JSON.parse(savedOrders); } catch {}
      }
      if (savedCurrentUser) {
        try { this.currentUser = JSON.parse(savedCurrentUser); } catch {}
      }

      if (!this.events || this.events.length === 0) {
        this.events = JSON.parse(JSON.stringify(INITIAL_EVENTS));
      }
      if (!this.tickets || this.tickets.length === 0) {
        this.tickets = JSON.parse(JSON.stringify(INITIAL_TICKETS));
      }
      if (!this.scans || this.scans.length === 0) {
        this.scans = JSON.parse(JSON.stringify(INITIAL_SCANS));
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

    // Storage event fallback for older contexts
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('jeltix_')) {
        this.reloadFromLocalStorage();
        this.listeners.forEach((l) => l());
      }
    });

    // Initial load from local file on Mac
    this.syncFromLocalDb();
  }

  public async syncFromLocalDb() {
    if (typeof window === 'undefined' || this.isSyncingFromDisk) return;
    this.isSyncingFromDisk = true;
    try {
      const res = await fetch('/api/local-db');
      if (res.ok) {
        const json = await res.json();
        if (json.exists && json.data) {
          if (Array.isArray(json.data.events) && json.data.events.length > 0) {
            this.events = json.data.events;
          }
          if (Array.isArray(json.data.tickets) && json.data.tickets.length > 0) {
            this.tickets = json.data.tickets;
          }
          if (Array.isArray(json.data.scans)) {
            this.scans = json.data.scans;
          }
          if (Array.isArray(json.data.orders)) {
            this.orders = json.data.orders;
          }
          if (Array.isArray(json.data.users) && json.data.users.length > 0) {
            this.users = json.data.users;
          }
          // Update localStorage cache
          localStorage.setItem('jeltix_events_v3', JSON.stringify(this.events));
          localStorage.setItem('jeltix_tickets_v3', JSON.stringify(this.tickets));
          localStorage.setItem('jeltix_scans_v3', JSON.stringify(this.scans));
          localStorage.setItem('jeltix_users_v3', JSON.stringify(this.users));
          localStorage.setItem('jeltix_orders_v3', JSON.stringify(this.orders));
          this.listeners.forEach((l) => l());
        } else {
          // File does not exist yet on Mac: save current state to create data/local-db.json
          this.persistToDisk();
        }
      }
    } catch (err) {
      console.warn('Notice sync local-db:', err);
    } finally {
      this.isSyncingFromDisk = false;
    }
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

  private save() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jeltix_events_v3', JSON.stringify(this.events));
      localStorage.setItem('jeltix_tickets_v3', JSON.stringify(this.tickets));
      localStorage.setItem('jeltix_scans_v3', JSON.stringify(this.scans));
      localStorage.setItem('jeltix_users_v3', JSON.stringify(this.users));
      localStorage.setItem('jeltix_orders_v3', JSON.stringify(this.orders));
      if (this.currentUser) {
        localStorage.setItem('jeltix_current_user_v2', JSON.stringify(this.currentUser));
        localStorage.setItem('jeltix_current_user', JSON.stringify(this.currentUser));
      }

      // Persist to Mac hard drive via local API
      this.persistToDisk();

      // Notify all other browser tabs in real time
      try {
        this.broadcastChannel?.postMessage({ type: 'SYNC', timestamp: Date.now() });
      } catch {}
    }
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

  // ATOMIC TICKET PURCHASE - 100% LOCAL ON MAC
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

    return { order, generatedTickets: newTickets };
  }

  // ATOMIC GATE SCAN VALIDATION - 100% LOCAL ON MAC
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

    // Case 1: Fake or Unknown Ticket
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

      return {
        success: false,
        result: 'INVALID',
        message: 'FAUX BILLET OU CODE INCONNU DANS LE REGISTRE JËL TIX',
      };
    }

    // Case 2: Double-Scan Fraud Attempt (Already Scanned)
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

      return {
        success: false,
        result: 'ALREADY_SCANNED',
        message: `ALERTE : Billet #${ticket.ticketCode} déjà scanné !`,
        ticket,
        previousScanDate: ticket.usedAt,
        previousScanGate: ticket.usedGate,
      };
    }

    // Case 3: Valid Ticket -> Mark as USED atomically
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

    return {
      success: true,
      result: 'VALID',
      message: `Billet #${ticket.ticketCode} VALIDÉ • Entrée autorisée`,
      ticket,
    };
  }

  // Create new event - 100% LOCAL ON MAC
  public createEvent(eventData: Omit<EventItem, 'id' | 'createdAt' | 'soldCapacity'>) {
    const newEvent: EventItem = {
      ...eventData,
      id: `evt-${Date.now()}`,
      soldCapacity: 0,
      createdAt: new Date().toISOString(),
    };
    this.events.unshift(newEvent);
    this.save();

    return newEvent;
  }

  // Update event status (PUBLISHED, DRAFT, CLOSED)
  public updateEventStatus(eventId: string, status: EventStatus) {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      event.status = status;
      this.save();
    }
  }

  // Delete event
  public deleteEvent(eventId: string) {
    this.events = this.events.filter((e) => e.id !== eventId);
    this.save();
  }

  // Add new user / controller / organizer
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

  // Toggle user status
  public toggleUserStatus(userId: string) {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      user.isActive = !user.isActive;
      this.save();
    }
  }

  // Real-time Dashboard KPIs calculation with strict role-based data isolation
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

  // Reset demo data
  public resetToDemoData() {
    this.events = JSON.parse(JSON.stringify(INITIAL_EVENTS));
    this.tickets = JSON.parse(JSON.stringify(INITIAL_TICKETS));
    this.scans = JSON.parse(JSON.stringify(INITIAL_SCANS));
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.orders = [];
    this.save();
  }
}

// Global Singleton Instance
export const jeltixStoreInstance = new JeltixStore();

// React Hook
export function useJeltixStore() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Initial sync with local Mac DB on mount
    jeltixStoreInstance.syncFromLocalDb();

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
      // Legacy alias for compatibility
      syncFromSupabase: () => jeltixStoreInstance.syncFromLocalDb(),
    }),
    [tick]
  );
}

// Backward compatibility hook aliases
export const useFoutaStore = useJeltixStore;
export const useStore = useJeltixStore;
