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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get('ref') || searchParams.get('orderRef');
    const token = searchParams.get('token');

    if (!ref && !token) {
      return NextResponse.json({ error: 'Référence ou token manquant' }, { status: 400 });
    }

    const currentDisk = readDiskSafely() || { orders: [], tickets: [] };

    // 1. Chercher dans les commandes locales
    let order = (currentDisk.orders || []).find(
      (o: any) => (ref && o.reference === ref) || (ref && o.id === ref)
    );

    let tickets = order
      ? (currentDisk.tickets || []).filter((t: any) => t.orderId === order.id)
      : [];

    // 2. Si non trouvé localement, chercher dans Supabase
    if (!order && ref) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: sbOrder } = await supabase
          .from('orders')
          .select('*, tickets(*)')
          .or(`reference.eq.${ref},id.eq.${ref}`)
          .maybeSingle();

        if (sbOrder) {
          order = sbOrder;
          tickets = sbOrder.tickets || [];
        }
      }
    }

    // 3. Si l'ordre est déjà confirmé
    if (order && order.paymentStatus === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        status: 'completed',
        order,
        tickets,
      });
    }

    // 4. Si token PayTech fourni, interroger directement l'API PayTech pour vérification en temps réel
    if (token) {
      const adapter = paymentGateway.getPaytechAdapter();
      if (adapter) {
        const check = await adapter.verifyPayment(token);
        if (check && check.status === 'completed') {
          return NextResponse.json({
            success: true,
            status: 'completed',
            paytechStatus: check.status,
            order,
            tickets,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: order?.paymentStatus || 'pending',
      order: order || null,
      tickets,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
