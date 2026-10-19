import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { paymentGateway } from '@/lib/services/payments';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const DB_FILE = path.join(process.cwd(), 'data', 'local-db.json');

function readDiskSafely(): any | null {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    if (!content || !content.trim()) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function formatOrderAndTickets(order: any, rawTickets: any[]) {
  const formattedTickets = (rawTickets || []).map((t: any) => ({
    ...t,
    id: t.id,
    ticketCode: t.ticket_code || t.ticketCode,
    orderId: t.order_id || t.orderId || order?.id,
    ticketTypeId: t.ticket_type_id || t.ticketTypeId,
    customerName: t.customer_name || t.customerName || order?.customer_name || order?.customerName,
    customerPhone: t.customer_phone || t.customerPhone || order?.customer_phone || order?.customerPhone,
    pricePaid: t.price_paid ?? t.pricePaid ?? 0,
    seatNumber: t.seat_number || t.seatNumber || 'Placement Libre',
    gateRecommendation: t.gate_recommendation || t.gateRecommendation || 'Porte A - Entrée Principale',
    qrData: t.qr_data || t.qrData || t.ticket_code || t.ticketCode,
    status: t.status || 'VALID',
  }));

  const formattedOrder = {
    ...order,
    id: order.id,
    reference: order.reference,
    eventId: order.event_id || order.eventId,
    customerName: order.customer_name || order.customerName,
    customerPhone: order.customer_phone || order.customerPhone,
    customerEmail: order.customer_email || order.customerEmail,
    totalAmount: order.total_amount ?? order.totalAmount ?? 0,
    paymentStatus: 'COMPLETED',
    paymentMethod: order.payment_method || order.paymentMethod || 'PAYTECH',
  };

  return { formattedOrder, formattedTickets };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get('ref') || searchParams.get('orderRef');
    const token = searchParams.get('token');
    const isPaymentSuccess = searchParams.get('payment') === 'success';

    if (!ref && !token) {
      return NextResponse.json({ error: 'Référence ou token manquant' }, { status: 400 });
    }

    const currentDisk = readDiskSafely() || { orders: [], tickets: [] };

    // 1. Chercher dans les commandes locales
    let order = (currentDisk.orders || []).find(
      (o: any) => (ref && o.reference === ref) || (ref && o.id === ref)
    );

    let tickets = order
      ? (currentDisk.tickets || []).filter((t: any) => t.orderId === order.id || t.order_id === order.id)
      : [];

    // 2. Si non trouvé localement, chercher dans Supabase
    if (!order && ref) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const isRefUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
        let query = supabase.from('orders').select('*, tickets(*)');
        if (isRefUuid) {
          query = query.or(`id.eq.${ref},reference.eq.${ref}`);
        } else {
          query = query.eq('reference', ref);
        }
        const { data: sbOrder } = await query.maybeSingle();

        if (sbOrder) {
          order = sbOrder;
          tickets = sbOrder.tickets || [];
        }
      }
    }

    // 3. Si l'ordre est déjà confirmé ou si redirigé avec payment=success
    const statusVal = (order?.payment_status || order?.paymentStatus || '').toUpperCase();
    if (order && (statusVal === 'COMPLETED' || isPaymentSuccess)) {
      if (statusVal !== 'COMPLETED') {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase.from('orders').update({ payment_status: 'COMPLETED' }).eq('id', order.id);
        }
      }
      const { formattedOrder, formattedTickets } = formatOrderAndTickets(order, tickets);
      return NextResponse.json({
        success: true,
        status: 'completed',
        order: formattedOrder,
        tickets: formattedTickets,
      });
    }

    // 4. Si token PayTech fourni, interroger directement l'API PayTech
    if (token) {
      const adapter = paymentGateway.getPaytechAdapter();
      if (adapter) {
        const check = await adapter.verifyPayment(token);
        if (check && check.status === 'completed') {
          const { formattedOrder, formattedTickets } = formatOrderAndTickets(order, tickets);
          return NextResponse.json({
            success: true,
            status: 'completed',
            paytechStatus: check.status,
            order: formattedOrder,
            tickets: formattedTickets,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: statusVal.toLowerCase() || 'pending',
      order: order || null,
      tickets,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ref, token, isSuccess, pendingPayment } = body;

    const orderRef = ref || pendingPayment?.orderRef;
    if (!orderRef) {
      return NextResponse.json({ error: 'Référence de commande requise' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let order: any = null;
    let tickets: any[] = [];

    // 1. Vérifier si la commande existe déjà dans Supabase
    if (supabase) {
      const { data: sbOrder } = await supabase
        .from('orders')
        .select('*, tickets(*)')
        .eq('reference', orderRef)
        .maybeSingle();

      if (sbOrder) {
        order = sbOrder;
        tickets = sbOrder.tickets || [];
      }
    }

    // 2. Si la commande n'existe pas encore mais le retour PayTech est validé (isSuccess ou pendingPayment fourni)
    if (!order && isSuccess && pendingPayment && supabase) {
      const { saveOrderAndTicketsToSupabase } = await import('@/lib/supabase/admin');
      const { generateTicketCode } = await import('@/lib/utils/format');

      const items = Array.isArray(pendingPayment.items) ? pendingPayment.items : [];
      const newTickets: any[] = [];

      for (const it of items) {
        const qty = Math.max(1, Number(it.quantity) || 1);
        for (let i = 0; i < qty; i++) {
          const code = generateTicketCode();
          newTickets.push({
            id: `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ticketCode: code,
            ticketTypeId: it.ticketTypeId,
            ticketTypeName: it.ticketTypeName || 'Billet Standard',
            customerName: pendingPayment.customerName || 'Spectateur',
            customerPhone: pendingPayment.customerPhone || '',
            pricePaid: Number(it.unitPrice) || 0,
            status: 'VALID',
            gateRecommendation: 'Porte A - Entrée Principale',
            seatNumber: 'Placement Libre',
            qrData: code,
          });
        }
      }

      const newOrder: any = {
        id: `ord-${Date.now()}`,
        reference: orderRef,
        eventId: pendingPayment.eventId,
        eventTitle: pendingPayment.eventTitle || 'Événement Jël Tix',
        customerName: pendingPayment.customerName || 'Spectateur',
        customerPhone: pendingPayment.customerPhone || '',
        customerEmail: pendingPayment.customerEmail || '',
        totalAmount: Number(pendingPayment.totalPrice) || 0,
        paymentStatus: 'COMPLETED' as const,
        paymentMethod: pendingPayment.paymentMethod || 'PAYTECH',
        channel: 'ONLINE' as const,
        items: items,
        createdAt: new Date().toISOString(),
      };

      await saveOrderAndTicketsToSupabase(newOrder, newTickets);
      order = newOrder;
      tickets = newTickets;
    }

    const { formattedOrder, formattedTickets } = formatOrderAndTickets(order, tickets);

    return NextResponse.json({
      success: true,
      status: (order?.payment_status || order?.paymentStatus || 'completed').toLowerCase(),
      order: formattedOrder,
      tickets: formattedTickets,
    });
  } catch (err: any) {
    console.error('Erreur POST verify:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
