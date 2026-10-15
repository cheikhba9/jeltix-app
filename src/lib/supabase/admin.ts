import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { EventItem, Ticket, Order, ScanLog, UserProfile, ScanResultType } from '@/types';

let adminClientInstance: SupabaseClient | null = null;

export function isUUID(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClientInstance) return adminClientInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || key.length < 20) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY non configurée pour les opérations admin.');
    return null;
  }

  adminClientInstance = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return adminClientInstance;
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 1800): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout de ${ms}ms dépassé`)), ms)
    ),
  ]);
}

/**
 * Récupère l'intégralité des données réelles depuis Supabase Cloud en contournant le RLS.
 */
export async function fetchFullDatabaseFromSupabase(): Promise<{
  events: EventItem[];
  tickets: Ticket[];
  orders: Order[];
  scans: ScanLog[];
  users: UserProfile[];
} | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    // 1. Événements avec ticket_types (protégé par timeout de 1.8s anti-blocage)
    const { data: sbEvents, error: evErr } = await withTimeout(
      supabase
        .from('events')
        .select('*, ticket_types(*)')
        .order('start_date', { ascending: true }),
      1800
    );

    if (evErr) {
      console.warn('Erreur lecture events Supabase:', evErr.message);
      return null;
    }

    const events: EventItem[] = (sbEvents || []).map((ev: any) => ({
      id: ev.id,
      slug: ev.slug,
      title: ev.title,
      category: ev.category || 'Football',
      venue: ev.venue || '',
      locationDetails: ev.location_details || '',
      startDate: ev.start_date || new Date().toISOString(),
      timeString:
        ev.time_string ||
        (ev.start_date
          ? new Date(ev.start_date).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            }) + ' UTC'
          : '18:00 UTC'),
      bannerImage:
        ev.banner_image ||
        'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
      description: ev.description || '',
      status: ev.status || 'PUBLISHED',
      totalCapacity: Number(ev.total_capacity) || 0,
      soldCapacity: Number(ev.sold_capacity) || 0,
      organizerId: ev.organizer_id || 'a0000000-0000-0000-0000-000000000001',
      organizerName: ev.organizer_name || 'Organisateur Officiel',
      ticketTypes: (ev.ticket_types || []).map((tt: any) => ({
        id: tt.id,
        eventId: tt.event_id,
        name: tt.name,
        price: Number(tt.price) || 0,
        badge: tt.badge || '',
        description: tt.description || '',
        totalQuantity: Number(tt.total_quantity) || 0,
        soldQuantity: Number(tt.sold_quantity) || 0,
        isActive: tt.is_active !== false,
      })),
      createdAt: ev.created_at || new Date().toISOString(),
    }));

    // 2. Tickets
    const { data: sbTickets } = await supabase
      .from('tickets')
      .select('*, events(title), ticket_types(name)')
      .order('created_at', { ascending: false });

    const tickets: Ticket[] = (sbTickets || []).map((t: any) => ({
      id: t.id,
      ticketCode: t.ticket_code,
      orderId: t.order_id || '',
      eventId: t.event_id,
      eventTitle: t.events?.title || '',
      ticketTypeId: t.ticket_type_id,
      ticketTypeName: t.ticket_types?.name || 'Billet Standard',
      gateRecommendation: t.gate_recommendation || 'Porte A - Entrée Principale',
      seatNumber: t.seat_number || 'Placement Libre',
      customerName: t.customer_name,
      customerPhone: t.customer_phone,
      pricePaid: Number(t.price_paid) || 0,
      status: t.status || 'VALID',
      usedAt: t.used_at || undefined,
      usedGate: t.used_gate || undefined,
      usedByController: t.used_by_controller || undefined,
      qrData: t.qr_data || t.ticket_code,
      createdAt: t.created_at || new Date().toISOString(),
    }));

    // 3. Orders
    const { data: sbOrders } = await supabase
      .from('orders')
      .select('*, events(title)')
      .order('created_at', { ascending: false });

    const orders: Order[] = (sbOrders || []).map((o: any) => ({
      id: o.id,
      reference: o.reference,
      eventId: o.event_id,
      eventTitle: o.events?.title || '',
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      customerEmail: o.customer_email || '',
      items: [],
      totalAmount: Number(o.total_amount) || 0,
      paymentMethod: o.payment_method || 'WAVE',
      paymentStatus: o.payment_status || 'COMPLETED',
      sellerId: o.seller_id || undefined,
      channel: o.channel || 'ONLINE',
      createdAt: o.created_at || new Date().toISOString(),
    }));

    // 4. Scans
    const { data: sbScans } = await supabase
      .from('scans')
      .select('*')
      .order('scanned_at', { ascending: false });

    const scans: ScanLog[] = (sbScans || []).map((s: any) => ({
      id: s.id,
      ticketId: s.ticket_id || '',
      ticketCode: s.ticket_code,
      eventId: s.event_id || '',
      ticketTypeName: 'Billet',
      gate: s.gate || 'Porte A',
      controllerName: 'Contrôleur',
      result: s.result || 'VALID',
      errorMessage: s.error_message || undefined,
      scannedAt: s.scanned_at || s.created_at || new Date().toISOString(),
    }));

    // 5. Profiles (Users)
    const { data: sbProfiles } = await supabase.from('profiles').select('*');
    const users: UserProfile[] = (sbProfiles || []).map((p: any) => ({
      id: p.id,
      fullName: p.full_name || 'Utilisateur',
      email: p.email,
      phone: p.phone || '',
      role: p.role || 'CLIENT',
      organization: p.organization || undefined,
      isActive: p.is_active !== false,
      createdAt: p.created_at || new Date().toISOString(),
    }));

    return { events, tickets, orders, scans, users };
  } catch (err: any) {
    console.warn('Erreur fetchFullDatabaseFromSupabase:', err.message);
    return null;
  }
}

/**
 * Enregistre / met à jour un événement et ses types de billets dans Supabase
 */
export async function saveEventToSupabase(eventData: Partial<EventItem>): Promise<EventItem | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    let safeOrganizerId = isUUID(eventData.organizerId) ? eventData.organizerId : null;
    if (!safeOrganizerId) {
      safeOrganizerId = 'a0000000-0000-0000-0000-000000000003'; // Super Admin Mamadou Cheikh Ba (seedé par SETUP_COMPLET.sql)
    }

    const payload: any = {
      title: eventData.title,
      slug: eventData.slug,
      category: eventData.category || 'Football',
      venue: eventData.venue,
      location_details: eventData.locationDetails || 'Dakar, Sénégal',
      start_date: eventData.startDate || new Date().toISOString(),
      banner_image: eventData.bannerImage,
      description: eventData.description,
      status: eventData.status || 'PUBLISHED',
      total_capacity: eventData.totalCapacity || 1000,
      sold_capacity: eventData.soldCapacity || 0,
      organizer_id: safeOrganizerId,
    };

    if (isUUID(eventData.id)) {
      payload.id = eventData.id;
    }

    const { data: eventRow, error: evErr } = await withTimeout(
      supabase
        .from('events')
        .upsert(payload, { onConflict: 'slug' })
        .select()
        .single(),
      2000
    );

    if (evErr) {
      console.error('Erreur upsert event Supabase:', evErr.message);
      return null;
    }

    const eventId = eventRow.id;

    // Ticket types
    const createdTicketTypes = [];
    if (eventData.ticketTypes && eventData.ticketTypes.length > 0) {
      for (const tt of eventData.ticketTypes) {
        const ttPayload: any = {
          event_id: eventId,
          name: tt.name,
          price: Number(tt.price) || 0,
          badge: tt.badge || null,
          description: tt.description || '',
          total_quantity: Number(tt.totalQuantity) || 1000,
          sold_quantity: Number(tt.soldQuantity) || 0,
          is_active: tt.isActive !== false,
        };

        if (isUUID(tt.id)) {
          ttPayload.id = tt.id;
        }

        const { data: ttRow, error: ttErr } = await supabase
          .from('ticket_types')
          .upsert(ttPayload)
          .select()
          .single();

        if (ttRow) {
          createdTicketTypes.push({
            id: ttRow.id,
            eventId: ttRow.event_id,
            name: ttRow.name,
            price: Number(ttRow.price),
            badge: ttRow.badge || '',
            description: ttRow.description || '',
            totalQuantity: Number(ttRow.total_quantity),
            soldQuantity: Number(ttRow.sold_quantity) || 0,
            isActive: ttRow.is_active !== false,
          });
        }
      }
    }

    return {
      id: eventRow.id,
      slug: eventRow.slug,
      title: eventRow.title,
      category: eventRow.category,
      venue: eventRow.venue,
      locationDetails: eventRow.location_details,
      startDate: eventRow.start_date,
      timeString: eventData.timeString || '18:00 UTC',
      bannerImage: eventRow.banner_image,
      description: eventRow.description,
      status: eventRow.status,
      totalCapacity: Number(eventRow.total_capacity),
      soldCapacity: Number(eventRow.sold_capacity),
      organizerId: eventRow.organizer_id,
      organizerName: eventData.organizerName || 'Organisateur',
      ticketTypes: createdTicketTypes,
      createdAt: eventRow.created_at,
    };
  } catch (err: any) {
    console.error('Erreur saveEventToSupabase:', err.message);
    return null;
  }
}

/**
 * Enregistre une commande et ses billets générés dans Supabase
 */
export async function saveOrderAndTicketsToSupabase(
  order: Order,
  tickets: Ticket[]
): Promise<{ success: boolean; orderId?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { success: false };

  try {
    // 1. Insérer la commande
    const safeEventId = isUUID(order.eventId) ? order.eventId : null;

    let targetEventId = safeEventId;
    if (!targetEventId) {
      if (order.eventTitle) {
        const { data: evByTitle } = await supabase
          .from('events')
          .select('id')
          .ilike('title', `%${order.eventTitle}%`)
          .limit(1)
          .maybeSingle();
        if (evByTitle) targetEventId = evByTitle.id;
      }
      if (!targetEventId) {
        const { data: ev } = await supabase.from('events').select('id').limit(1).maybeSingle();
        targetEventId = ev?.id || null;
      }
    }

    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .insert({
        reference: order.reference,
        event_id: targetEventId,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        customer_email: order.customerEmail || null,
        total_amount: order.totalAmount,
        payment_method: order.paymentMethod,
        payment_status: 'COMPLETED',
        seller_id: isUUID(order.sellerId) ? order.sellerId : null,
        channel: order.channel || 'ONLINE',
      })
      .select()
      .single(),
      2000
    );

    if (orderErr) {
      console.error('Erreur insert orders Supabase:', orderErr.message);
      return { success: false };
    }

    // 2. Insérer les billets
    const ticketInserts = [];
    for (const t of tickets) {
      // Résoudre ticket_type_id
      let safeTtId = isUUID(t.ticketTypeId) ? t.ticketTypeId : null;
      if (!safeTtId && targetEventId) {
        if (t.ticketTypeName) {
          const { data: ttByName } = await supabase
            .from('ticket_types')
            .select('id')
            .eq('event_id', targetEventId)
            .ilike('name', `%${t.ticketTypeName}%`)
            .limit(1)
            .maybeSingle();
          if (ttByName) safeTtId = ttByName.id;
        }
        if (!safeTtId) {
          const { data: tt } = await supabase
            .from('ticket_types')
            .select('id')
            .eq('event_id', targetEventId)
            .limit(1)
            .maybeSingle();
          safeTtId = tt?.id || null;
        }
      }

      ticketInserts.push({
        ticket_code: t.ticketCode,
        order_id: orderRow.id,
        event_id: targetEventId,
        ticket_type_id: safeTtId,
        customer_name: t.customerName,
        customer_phone: t.customerPhone,
        price_paid: t.pricePaid,
        status: t.status || 'VALID',
        gate_recommendation: t.gateRecommendation || 'Porte A - Entrée Principale',
        seat_number: t.seatNumber || 'Placement Libre',
        qr_data: t.qrData || t.ticketCode,
      });
    }

    if (ticketInserts.length > 0) {
      const { error: tktErr } = await supabase.from('tickets').insert(ticketInserts);
      if (tktErr) console.warn('Erreur insert tickets Supabase:', tktErr.message);
    }

    // 3. Incrémenter sold_capacity
    if (targetEventId) {
      const { data: evRow } = await supabase
        .from('events')
        .select('sold_capacity')
        .eq('id', targetEventId)
        .single();
      if (evRow) {
        await supabase
          .from('events')
          .update({ sold_capacity: (evRow.sold_capacity || 0) + tickets.length })
          .eq('id', targetEventId);
      }
    }

    return { success: true, orderId: orderRow.id };
  } catch (err: any) {
    console.error('Erreur saveOrderAndTicketsToSupabase:', err.message);
    return { success: false };
  }
}

/**
 * Validation atomique du scan de billet dans Supabase
 */
export async function validateScanInSupabase(params: {
  ticketCode: string;
  gate?: string;
  controllerName?: string;
  controllerId?: string;
}): Promise<{
  success: boolean;
  result: ScanResultType;
  message: string;
  ticket?: any;
  previousScanDate?: string;
  previousScanGate?: string;
}> {
  const supabase = getSupabaseAdmin();
  const cleanCode = params.ticketCode.trim().toUpperCase();
  const gate = params.gate || 'Porte A - Entrée Principale';
  const controllerName = params.controllerName || 'Agent Contrôle';
  const safeControllerId = isUUID(params.controllerId) ? params.controllerId : null;

  if (!supabase) {
    return {
      success: false,
      result: 'INVALID',
      message: 'Base Supabase indisponible',
    };
  }

  try {
    // 1. Chercher le billet (avec timeout de 2s)
    const { data: ticket, error: tktErr } = await withTimeout(
      supabase
        .from('tickets')
        .select('*, events(title), ticket_types(name)')
        .or(`ticket_code.eq.${cleanCode},ticket_code.eq.${cleanCode.replace('JT-', 'FT-')},ticket_code.eq.${cleanCode.replace('FT-', 'JT-')}`)
        .maybeSingle(),
      2000
    );

    if (tktErr || !ticket) {
      // Faux billet -> Journaliser
      await supabase.from('scans').insert({
        ticket_code: cleanCode,
        gate,
        controller_id: safeControllerId,
        result: 'INVALID',
        error_message: 'Faux billet ou code inconnu',
      });

      return {
        success: false,
        result: 'INVALID',
        message: 'FAUX BILLET OU CODE INCONNU DANS LE REGISTRE JËL TIX',
      };
    }

    // 2. Déjà scanné -> Double passage
    if (ticket.status === 'USED') {
      await supabase.from('scans').insert({
        ticket_id: ticket.id,
        ticket_code: ticket.ticket_code,
        event_id: ticket.event_id,
        gate,
        controller_id: safeControllerId,
        result: 'ALREADY_SCANNED',
        error_message: `Double passage détecté à ${gate}`,
      });

      return {
        success: false,
        result: 'ALREADY_SCANNED',
        message: `ALERTE : Billet #${ticket.ticket_code} DÉJÀ SCANNÉ !`,
        ticket,
        previousScanDate: ticket.used_at,
        previousScanGate: ticket.used_gate,
      };
    }

    // 3. Valide -> Marquer comme USED
    const nowIso = new Date().toISOString();
    await supabase
      .from('tickets')
      .update({
        status: 'USED',
        used_at: nowIso,
        used_gate: gate,
        used_by_controller: safeControllerId,
      })
      .eq('id', ticket.id);

    await supabase.from('scans').insert({
      ticket_id: ticket.id,
      ticket_code: ticket.ticket_code,
      event_id: ticket.event_id,
      gate,
      controller_id: safeControllerId,
      result: 'VALID',
    });

    ticket.status = 'USED';
    ticket.used_at = nowIso;
    ticket.used_gate = gate;

    return {
      success: true,
      result: 'VALID',
      message: `Billet #${ticket.ticket_code} VALIDÉ • Entrée autorisée`,
      ticket,
    };
  } catch (err: any) {
    console.error('Erreur validateScanInSupabase:', err.message);
    return {
      success: false,
      result: 'INVALID',
      message: `Erreur validation: ${err.message}`,
    };
  }
}
