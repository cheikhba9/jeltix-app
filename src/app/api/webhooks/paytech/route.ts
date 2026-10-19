import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { paymentGateway } from '@/lib/services/payments';
import { generateTicketCode } from '@/lib/utils/format';
import { saveOrderAndTicketsToSupabase } from '@/lib/supabase/admin';
import { Order, Ticket } from '@/types';

const DB_FILE = path.join(process.cwd(), 'data', 'local-db.json');

function writeDiskSafely(data: any): boolean {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch {
    return false;
  }
}

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

export async function POST(req: Request) {
  try {
    const adapter = paymentGateway.getPaytechAdapter();
    if (!adapter) {
      console.warn('[PayTech Webhook] Clés PayTech non configurées dans l’environnement');
      return NextResponse.json({ error: 'PayTech configuration missing' }, { status: 500 });
    }

    const contentType = req.headers.get('content-type') || '';
    const rawBody = await req.text();

    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    let parsedBody: Record<string, any> | undefined = undefined;
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(rawBody);
      parsedBody = Object.fromEntries(params.entries());
    } else {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {}
    }

    // 1. Vérification cryptographique de la signature (HMAC-SHA256 ou SHA256 des clés)
    const verification = await adapter.verifyWebhook(rawBody, headers, parsedBody);

    if (!verification.isValid) {
      console.error('[PayTech Webhook] Rejet : Signature ou données IPN invalides', {
        headers,
        error: verification.error,
      });
      return NextResponse.json({ error: 'Invalid IPN signature' }, { status: 400 });
    }

    const { status, rawPayload, paymentId } = verification;
    const customField = rawPayload?.decodedCustomField || {};

    console.log(`[PayTech Webhook] Notification reçue pour paiement ${paymentId} • Statut: ${status}`);

    // Si le paiement est réussi, émettre les billets et persister la commande
    if (status === 'SUCCESS') {
      const currentDisk = readDiskSafely() || { events: [], tickets: [], orders: [], scans: [], users: [] };
      const orderRef = customField.orderRef || paymentId;

      // Idempotence : Vérifier si la commande a déjà été traitée
      const alreadyProcessed = (currentDisk.orders || []).some(
        (o: Order) => o.reference === orderRef || o.id === orderRef
      );

      if (alreadyProcessed) {
        console.log(`[PayTech Webhook] Commande ${orderRef} déjà traitée. Idempotence validée.`);
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      const orderId = `ord-pt-${Date.now()}`;
      const items = Array.isArray(customField.items) ? customField.items : [];

      const order: Order = {
        id: orderId,
        reference: orderRef,
        eventId: customField.eventId || 'evt-default',
        eventTitle: customField.eventTitle || 'Événement Jël Tix',
        customerName: customField.customerName || 'Client PayTech',
        customerPhone: customField.customerPhone || rawPayload?.client_phone || '+221 76 402 74 68',
        customerEmail: customField.customerEmail || '',
        items,
        totalAmount: Number(verification.amountPaid || customField.totalPrice || 0),
        paymentMethod: (customField.paymentMethod || 'PAYTECH') as any,
        paymentStatus: 'COMPLETED',
        channel: 'ONLINE',
        createdAt: new Date().toISOString(),
      };

      const newTickets: Ticket[] = [];

      for (const it of items) {
        const qty = Number(it.quantity) || 1;
        const unitPrice = Number(it.unitPrice) || Math.round((Number(it.subtotal) || 0) / qty);

        for (let i = 0; i < qty; i++) {
          const code = generateTicketCode();
          newTickets.push({
            id: `tkt-pt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ticketCode: code,
            orderId: order.id,
            eventId: order.eventId,
            eventTitle: order.eventTitle,
            ticketTypeId: it.ticketTypeId || 'tt-default',
            ticketTypeName: it.ticketTypeName || 'Billet Standard',
            gateRecommendation: 'Porte A - Entrée Principale',
            seatNumber: 'Placement Libre',
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            pricePaid: unitPrice,
            status: 'VALID',
            qrData: code,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Si aucun item spécifié, générer 1 billet par défaut avec le montant total
      if (newTickets.length === 0) {
        const code = generateTicketCode();
        newTickets.push({
          id: `tkt-pt-${Date.now()}`,
          ticketCode: code,
          orderId: order.id,
          eventId: order.eventId,
          eventTitle: order.eventTitle,
          ticketTypeId: 'tt-default',
          ticketTypeName: 'Billet Mobile Money',
          gateRecommendation: 'Porte A - Entrée Principale',
          seatNumber: 'Placement Libre',
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          pricePaid: order.totalAmount,
          status: 'VALID',
          qrData: code,
          createdAt: new Date().toISOString(),
        });
      }

      // Sauvegarde dans Supabase Cloud
      try {
        await saveOrderAndTicketsToSupabase(order, newTickets);
      } catch (err) {
        console.warn('[PayTech Webhook] Erreur sauvegarde Supabase:', err);
      }

      // Sauvegarde sur le stockage local
      currentDisk.orders = [order, ...(currentDisk.orders || [])];
      currentDisk.tickets = [...newTickets, ...(currentDisk.tickets || [])];

      // Mise à jour de la jauge de l'événement
      const eventToUpdate = (currentDisk.events || []).find((e: any) => e.id === order.eventId);
      if (eventToUpdate) {
        eventToUpdate.soldCapacity = (Number(eventToUpdate.soldCapacity) || 0) + newTickets.length;
      }

      writeDiskSafely(currentDisk);

      console.log(`[PayTech Webhook] Succès : Commande ${order.reference} enregistrée • ${newTickets.length} billet(s) émis.`);

      return NextResponse.json({
        success: true,
        orderId: order.id,
        reference: order.reference,
        ticketsCount: newTickets.length,
      });
    }

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    console.error('[PayTech Webhook] Erreur interne:', err);
    return NextResponse.json(
      { error: err.message || 'Internal webhook error' },
      { status: 500 }
    );
  }
}
