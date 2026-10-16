import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevenueByPaymentMethod {
  method: 'WAVE' | 'ORANGE_MONEY' | 'FREE_MONEY' | 'CASH';
  label: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
}

export interface RevenueByEvent {
  eventId: string;
  title: string;
  venue: string;
  totalRevenue: number;
  ticketsSold: number;
  ordersCount: number;
}

export interface DailySalesPoint {
  date: string;
  revenue: number;
  ticketsSold: number;
}

export interface PlatformKPIs {
  totalRevenue: number;
  jeltixCommission: number;
  netToOrganizers: number;
  averageBasket: number;
  totalOrders: number;
  totalTicketsSold: number;
  activeEventsCount: number;
  successfulScansToday: number;
  totalScansToday: number;
  revenueByMethod: RevenueByPaymentMethod[];
  revenueByEvent: RevenueByEvent[];
  dailySales: DailySalesPoint[];
}

export interface OrganizerKPIs {
  totalRevenue: number;
  jeltixCommission: number;
  netToMe: number;
  averageBasket: number;
  totalOrders: number;
  totalTicketsSold: number;
  activeEventsCount: number;
  successfulScansToday: number;
  revenueByMethod: RevenueByPaymentMethod[];
  revenueByEvent: RevenueByEvent[];
  dailySales: DailySalesPoint[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_META: Record<string, { label: string; color: string }> = {
  WAVE: { label: 'Wave Sénégal', color: '#1DC9FE' },
  ORANGE_MONEY: { label: 'Orange Money', color: '#FF7900' },
  FREE_MONEY: { label: 'Free Money', color: '#FF2D55' },
  CASH: { label: 'Guichet Espèces', color: '#4EED15' },
};

function buildPaymentBreakdown(
  orders: Array<{ payment_method: string; total_amount: number }>
): RevenueByPaymentMethod[] {
  const map = new Map<string, { total: number; count: number }>();

  for (const o of orders) {
    const m = o.payment_method || 'CASH';
    const cur = map.get(m) || { total: 0, count: 0 };
    map.set(m, { total: cur.total + (o.total_amount || 0), count: cur.count + 1 });
  }

  const grandTotal = orders.reduce((s, o) => s + (o.total_amount || 0), 0);

  return Array.from(map.entries()).map(([method, { total, count }]) => ({
    method: method as RevenueByPaymentMethod['method'],
    label: METHOD_META[method]?.label ?? method,
    color: METHOD_META[method]?.color ?? '#888',
    total,
    count,
    percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
  })).sort((a, b) => b.total - a.total);
}

function buildDailySales(
  orders: Array<{ created_at: string; total_amount: number; ticket_count?: number }>
): DailySalesPoint[] {
  const map = new Map<string, { revenue: number; ticketsSold: number }>();

  for (const o of orders) {
    const date = o.created_at?.slice(0, 10) ?? '';
    if (!date) continue;
    const cur = map.get(date) || { revenue: 0, ticketsSold: 0 };
    map.set(date, {
      revenue: cur.revenue + (o.total_amount || 0),
      ticketsSold: cur.ticketsSold + (o.ticket_count || 1),
    });
  }

  return Array.from(map.entries())
    .map(([date, { revenue, ticketsSold }]) => ({ date, revenue, ticketsSold }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchPlatformKPIs(): Promise<PlatformKPIs> {
  const supabase = createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [ordersRes, eventsRes, scansRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, event_id, total_amount, payment_method, created_at, payment_status')
      .eq('payment_status', 'COMPLETED')
      .order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('id, title, venue, sold_capacity, status')
      .order('created_at', { ascending: false }),
    supabase
      .from('scans')
      .select('id, result, scanned_at')
      .gte('scanned_at', todayStart.toISOString()),
  ]);

  let orders = ordersRes.data ?? [];
  let events = eventsRes.data ?? [];
  let scans = scansRes.data ?? [];

  // Fallback local Mac Disk (/api/local-db) si Supabase est vide
  if (events.length === 0 && typeof window !== 'undefined') {
    try {
      const localRes = await fetch('/api/local-db');
      if (localRes.ok) {
        const json = await localRes.json();
        if (json.exists && json.data) {
          if (Array.isArray(json.data.events) && json.data.events.length > 0) {
            events = json.data.events.map((e: any) => ({
              id: e.id,
              title: e.title,
              venue: e.venue,
              sold_capacity: Number(e.soldCapacity) || 0,
              status: e.status || 'PUBLISHED',
            }));
          }
          if (Array.isArray(json.data.orders) && json.data.orders.length > 0) {
            orders = json.data.orders.map((o: any) => ({
              id: o.id,
              event_id: o.eventId,
              total_amount: Number(o.totalAmount) || 0,
              payment_method: o.paymentMethod || 'WAVE',
              created_at: o.createdAt || new Date().toISOString(),
              payment_status: o.paymentStatus || 'COMPLETED',
            }));
          }
          if (Array.isArray(json.data.scans) && json.data.scans.length > 0) {
            scans = json.data.scans.map((s: any) => ({
              id: s.id,
              result: s.result || 'VALID',
              scanned_at: s.scannedAt || new Date().toISOString(),
            }));
          }
        }
      }
    } catch {}
  }

  let ticketCounts: { order_id: string }[] = [];
  if (orders.length > 0) {
    const { data } = await supabase
      .from('tickets')
      .select('order_id')
      .in('order_id', orders.map((o) => o.id));
    ticketCounts = data ?? [];
  }

  const ticketsPerOrder = new Map<string, number>();
  for (const t of ticketCounts) {
    ticketsPerOrder.set(t.order_id, (ticketsPerOrder.get(t.order_id) ?? 0) + 1);
  }

  const ordersWithCount = orders.map((o) => ({
    ...o,
    ticket_count: ticketsPerOrder.get(o.id) ?? 0,
  }));

  const eventRevMap = new Map<string, { revenue: number; tickets: number; orders: number }>();
  for (const o of ordersWithCount) {
    const cur = eventRevMap.get(o.event_id) ?? { revenue: 0, tickets: 0, orders: 0 };
    eventRevMap.set(o.event_id, {
      revenue: cur.revenue + (o.total_amount || 0),
      tickets: cur.tickets + (o.ticket_count || 0),
      orders: cur.orders + 1,
    });
  }

  const revenueByEvent: RevenueByEvent[] = events
    .filter((e) => eventRevMap.has(e.id))
    .map((e) => {
      const stats = eventRevMap.get(e.id)!;
      return {
        eventId: e.id,
        title: e.title,
        venue: e.venue,
        totalRevenue: stats.revenue,
        ticketsSold: stats.tickets,
        ordersCount: stats.orders,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalOrders = orders.length;
  const totalTicketsSold = events.reduce((s, e) => s + (e.sold_capacity || 0), 0);
  const activeEventsCount = events.filter((e) => e.status === 'PUBLISHED').length;
  const successfulScansToday = scans.filter((s) => s.result === 'VALID').length;
  const totalScansToday = scans.length;

  return {
    totalRevenue,
    jeltixCommission: Math.round(totalRevenue * 0.03),
    netToOrganizers: Math.round(totalRevenue * 0.97),
    averageBasket: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    totalOrders,
    totalTicketsSold,
    activeEventsCount,
    successfulScansToday,
    totalScansToday,
    revenueByMethod: buildPaymentBreakdown(orders),
    revenueByEvent,
    dailySales: buildDailySales(ordersWithCount),
  };
}

export async function fetchOrganizerKPIs(organizerId: string): Promise<OrganizerKPIs> {
  const supabase = createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: orgEvents } = await supabase
    .from('events')
    .select('id, title, venue, sold_capacity, status')
    .eq('organizer_id', organizerId);

  const orgEventIds = (orgEvents ?? []).map((e) => e.id);

  if (orgEventIds.length === 0) {
    return {
      totalRevenue: 0,
      jeltixCommission: 0,
      netToMe: 0,
      averageBasket: 0,
      totalOrders: 0,
      totalTicketsSold: 0,
      activeEventsCount: 0,
      successfulScansToday: 0,
      revenueByMethod: [],
      revenueByEvent: [],
      dailySales: [],
    };
  }

  const [ordersRes, scansRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, event_id, total_amount, payment_method, created_at, payment_status')
      .in('event_id', orgEventIds)
      .eq('payment_status', 'COMPLETED')
      .order('created_at', { ascending: false }),
    supabase
      .from('scans')
      .select('id, result, event_id, scanned_at')
      .in('event_id', orgEventIds)
      .gte('scanned_at', todayStart.toISOString()),
  ]);

  const orders = ordersRes.data ?? [];
  const scans = scansRes.data ?? [];

  let ticketCounts: { order_id: string }[] = [];
  if (orders.length > 0) {
    const { data } = await supabase
      .from('tickets')
      .select('order_id')
      .in('order_id', orders.map((o) => o.id));
    ticketCounts = data ?? [];
  }

  const ticketsPerOrder = new Map<string, number>();
  for (const t of ticketCounts) {
    ticketsPerOrder.set(t.order_id, (ticketsPerOrder.get(t.order_id) ?? 0) + 1);
  }

  const ordersWithCount = orders.map((o) => ({
    ...o,
    ticket_count: ticketsPerOrder.get(o.id) ?? 0,
  }));

  const eventRevMap = new Map<string, { revenue: number; tickets: number; orders: number }>();
  for (const o of ordersWithCount) {
    const cur = eventRevMap.get(o.event_id) ?? { revenue: 0, tickets: 0, orders: 0 };
    eventRevMap.set(o.event_id, {
      revenue: cur.revenue + (o.total_amount || 0),
      tickets: cur.tickets + (o.ticket_count || 0),
      orders: cur.orders + 1,
    });
  }

  const revenueByEvent: RevenueByEvent[] = (orgEvents ?? []).map((e) => {
    const stats = eventRevMap.get(e.id) ?? { revenue: 0, tickets: 0, orders: 0 };
    return {
      eventId: e.id,
      title: e.title,
      venue: e.venue,
      totalRevenue: stats.revenue,
      ticketsSold: stats.tickets,
      ordersCount: stats.orders,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalOrders = orders.length;
  const totalTicketsSold = (orgEvents ?? []).reduce((s, e) => s + (e.sold_capacity || 0), 0);
  const activeEventsCount = (orgEvents ?? []).filter((e) => e.status === 'PUBLISHED').length;
  const successfulScansToday = scans.filter((s) => s.result === 'VALID').length;

  return {
    totalRevenue,
    jeltixCommission: Math.round(totalRevenue * 0.03),
    netToMe: Math.round(totalRevenue * 0.97),
    averageBasket: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    totalOrders,
    totalTicketsSold,
    activeEventsCount,
    successfulScansToday,
    revenueByMethod: buildPaymentBreakdown(orders),
    revenueByEvent,
    dailySales: buildDailySales(ordersWithCount),
  };
}

export async function fetchOrdersForCSV(organizerId?: string): Promise<string> {
  const supabase = createClient();

  let eventIds: string[] | null = null;

  if (organizerId) {
    const { data: orgEvents } = await supabase
      .from('events')
      .select('id')
      .eq('organizer_id', organizerId);
    eventIds = (orgEvents ?? []).map((e) => e.id);
    if (eventIds.length === 0) return '';
  }

  let query = supabase
    .from('orders')
    .select('reference, customer_name, customer_phone, customer_email, event_id, total_amount, payment_method, payment_status, channel, created_at, events (title, venue)')
    .eq('payment_status', 'COMPLETED')
    .order('created_at', { ascending: false });

  if (eventIds) {
    query = query.in('event_id', eventIds) as typeof query;
  }

  const { data: orders } = await query;
  if (!orders || orders.length === 0) return '';

  const header = 'Reference,Client,Téléphone,Email,Événement,Lieu,Canal,Montant_FCFA,Mode_Paiement,Statut,Date\n';
  const rows = (orders as any[]).map((o) => {
    const evt = o.events;
    return [
      `"${o.reference}"`,
      `"${o.customer_name}"`,
      `"${o.customer_phone}"`,
      `"${o.customer_email || ''}"`,
      `"${evt?.title || ''}"`,
      `"${evt?.venue || ''}"`,
      `"${o.channel}"`,
      o.total_amount,
      `"${o.payment_method}"`,
      `"${o.payment_status}"`,
      `"${o.created_at}"`,
    ].join(',');
  }).join('\n');

  return header + rows;
}
