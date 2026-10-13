import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const url = 'https://gnhpmmlagsoxudysomzk.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduaHBtbWxhZ3NveHVkeXNvbXprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTExOTgxMCwiZXhwIjoyMTA0Njk1ODEwfQ.RbT2hPcwBlB_FIXwJxZXhqMlGetMmBlobsPXyzyJgZo';

const admin = createClient(url, key, {
  auth: { persistSession: false },
});

async function main() {
  console.log('--- Initializing Supabase Cloud Sync ---');
  const dbFile = path.join(process.cwd(), 'data', 'local-db.json');
  if (!fs.existsSync(dbFile)) {
    console.log('No local-db.json found');
    return;
  }

  const raw = fs.readFileSync(dbFile, 'utf8');
  const data = JSON.parse(raw);

  // 1. Profiles
  for (const u of data.users || []) {
    const { error } = await admin.from('profiles').upsert(
      {
        id: u.id,
        email: u.email,
        full_name: u.fullName,
        phone: u.phone,
        role: u.role,
        organization: u.organization,
        is_active: u.isActive,
      },
      { onConflict: 'email' }
    );
    if (error) console.log('Profile error:', error.message);
  }
  console.log('✅ Profiles synced');

  // 2. Events & Ticket types
  for (const ev of data.events || []) {
    let { data: existing } = await admin
      .from('events')
      .select('id')
      .eq('slug', ev.slug)
      .maybeSingle();

    let eventId = existing?.id;

    if (!eventId) {
      const { data: newEv, error: evErr } = await admin
        .from('events')
        .insert({
          title: ev.title,
          slug: ev.slug,
          category: ev.category || 'Football',
          venue: ev.venue,
          location_details: ev.locationDetails,
          start_date: ev.startDate,
          banner_image: ev.bannerImage,
          description: ev.description,
          status: ev.status || 'PUBLISHED',
          total_capacity: ev.totalCapacity || 1000,
          sold_capacity: ev.soldCapacity || 0,
          organizer_id: 'a0000000-0000-0000-0000-000000000001',
        })
        .select()
        .single();

      if (evErr) {
        console.log('Event error:', evErr.message);
        continue;
      }
      eventId = newEv.id;
    }

    console.log('✅ Event ID:', eventId);

    for (const tt of ev.ticketTypes || []) {
      const { data: existingTt } = await admin
        .from('ticket_types')
        .select('id')
        .eq('event_id', eventId)
        .eq('name', tt.name)
        .maybeSingle();

      if (!existingTt) {
        const { error: ttErr } = await admin.from('ticket_types').insert({
          event_id: eventId,
          name: tt.name,
          price: tt.price,
          badge: tt.badge || null,
          description: tt.description || '',
          total_quantity: tt.totalQuantity || 1000,
          sold_quantity: tt.soldQuantity || 0,
          is_active: tt.isActive !== false,
        });
        if (ttErr) console.log('Ticket type error:', ttErr.message);
      }
    }
  }

  // 3. Orders & Tickets
  for (const ord of data.orders || []) {
    let { data: existingOrd } = await admin
      .from('orders')
      .select('id')
      .eq('reference', ord.reference)
      .maybeSingle();

    let orderId = existingOrd?.id;
    if (!orderId) {
      // Find event
      const { data: evRow } = await admin.from('events').select('id').limit(1).single();
      if (evRow) {
        const { data: newOrd, error: ordErr } = await admin
          .from('orders')
          .insert({
            reference: ord.reference,
            event_id: evRow.id,
            customer_name: ord.customerName,
            customer_phone: ord.customerPhone,
            customer_email: ord.customerEmail || null,
            total_amount: ord.totalAmount,
            payment_method: ord.paymentMethod || 'WAVE',
            payment_status: 'COMPLETED',
            channel: ord.channel || 'ONLINE',
          })
          .select()
          .single();

        if (ordErr) console.log('Order error:', ordErr.message);
        else orderId = newOrd.id;
      }
    }

    console.log('✅ Order ID:', orderId);
  }

  // 4. Tickets
  for (const tkt of data.tickets || []) {
    let { data: existingTkt } = await admin
      .from('tickets')
      .select('id')
      .eq('ticket_code', tkt.ticketCode)
      .maybeSingle();

    if (!existingTkt) {
      const { data: evRow } = await admin.from('events').select('id').limit(1).single();
      const { data: ttRow } = await admin.from('ticket_types').select('id').limit(1).single();

      if (evRow && ttRow) {
        const { error: tktErr } = await admin.from('tickets').insert({
          ticket_code: tkt.ticketCode,
          event_id: evRow.id,
          ticket_type_id: ttRow.id,
          customer_name: tkt.customerName,
          customer_phone: tkt.customerPhone,
          price_paid: tkt.pricePaid,
          status: tkt.status || 'VALID',
          gate_recommendation: tkt.gateRecommendation || 'Porte A',
          seat_number: tkt.seatNumber || 'Place 1',
          qr_data: tkt.qrData || tkt.ticketCode,
          used_at: tkt.usedAt || null,
          used_gate: tkt.usedGate || null,
          used_by_controller: tkt.usedByController || null,
        });
        if (tktErr) console.log('Ticket error:', tktErr.message);
      }
    }
  }

  // 5. Scans
  for (const scn of data.scans || []) {
    let { data: existingScn } = await admin
      .from('scans')
      .select('id')
      .eq('ticket_code', scn.ticketCode)
      .maybeSingle();

    if (!existingScn) {
      const { data: evRow } = await admin.from('events').select('id').limit(1).single();
      const { error: scnErr } = await admin.from('scans').insert({
        ticket_code: scn.ticketCode,
        event_id: evRow?.id,
        gate: scn.gate || 'Porte A',
        result: scn.result || 'VALID',
        controller_name: scn.controllerName || 'Contrôleur',
      });
      if (scnErr) console.log('Scan error:', scnErr.message);
    }
  }

  // Final check
  const { data: finalEvents } = await admin.from('events').select('id, title, ticket_types(id, name)');
  const { data: finalTickets } = await admin.from('tickets').select('id, ticket_code, status');
  console.log('=== SYNC REPORT ===');
  console.log('Events in Cloud:', finalEvents?.length, finalEvents);
  console.log('Tickets in Cloud:', finalTickets?.length, finalTickets);
}

main().catch(console.error);
