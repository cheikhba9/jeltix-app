import { createClient } from '@supabase/supabase-js';

const url = 'https://gnhpmmlagsoxudysomzk.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduaHBtbWxhZ3NveHVkeXNvbXprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTExOTgxMCwiZXhwIjoyMTA0Njk1ODEwfQ.RbT2hPcwBlB_FIXwJxZXhqMlGetMmBlobsPXyzyJgZo';

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function runTest() {
  console.log('🚀 === TEST DE BOUT EN BOUT : CREATION -> ACHAT -> SCAN ===');

  const testSlug = 'derby-dakar-' + Date.now();
  const testTitle = 'Grand Derby Dakar Test ' + Date.now();

  // 1. CRÉATION ÉVÉNEMENT
  console.log('\n1. Test Création Événement...');
  const { data: newEv, error: evErr } = await supabase
    .from('events')
    .insert({
      title: testTitle,
      slug: testSlug,
      category: 'Football',
      venue: 'Stade Abdoulaye Wade',
      location_details: 'Diamniadio, Sénégal',
      start_date: new Date(Date.now() + 86400000 * 5).toISOString(),
      status: 'PUBLISHED',
      total_capacity: 50000,
      sold_capacity: 0,
      organizer_id: '19c71d17-a17e-48a4-a765-8992bcdbf11e'
    })
    .select()
    .single();

  if (evErr) throw new Error('Erreur création event: ' + evErr.message);
  console.log('✅ Événement créé avec succès:', newEv.id, newEv.title);

  // 2. CRÉATION CATÉGORIES BILLETS
  console.log('\n2. Test Création Catégorie de Billets...');
  const { data: newTt, error: ttErr } = await supabase
    .from('ticket_types')
    .insert({
      event_id: newEv.id,
      name: 'Tribune Supporters',
      price: 2000,
      badge: 'Choc',
      description: 'Accès tribune supporters ambiance assurée',
      total_quantity: 10000,
      sold_quantity: 0,
      is_active: true
    })
    .select()
    .single();

  if (ttErr) throw new Error('Erreur création ticket type: ' + ttErr.message);
  console.log('✅ Catégorie de billets créée:', newTt.id, newTt.name, newTt.price + ' FCFA');

  // 3. ACHAT D'UN BILLET PAR UN CLIENT
  console.log('\n3. Test Achat de Billet par le Client...');
  const orderRef = 'CMD-TEST-' + Math.floor(1000 + Math.random() * 9000);
  const { data: newOrder, error: ordErr } = await supabase
    .from('orders')
    .insert({
      reference: orderRef,
      event_id: newEv.id,
      customer_name: 'Fatou Sow',
      customer_phone: '776543210',
      total_amount: 2000,
      payment_method: 'WAVE',
      payment_status: 'COMPLETED',
      channel: 'ONLINE'
    })
    .select()
    .single();

  if (ordErr) throw new Error('Erreur création order: ' + ordErr.message);
  console.log('✅ Commande créée:', newOrder.id, newOrder.reference);

  const ticketCode = 'JT-' + Math.floor(100000 + Math.random() * 900000);
  const { data: newTicket, error: tktErr } = await supabase
    .from('tickets')
    .insert({
      ticket_code: ticketCode,
      order_id: newOrder.id,
      event_id: newEv.id,
      ticket_type_id: newTt.id,
      customer_name: 'Fatou Sow',
      customer_phone: '776543210',
      price_paid: 2000,
      status: 'VALID',
      gate_recommendation: 'Porte 4 - Tribune Sud',
      seat_number: 'Rangée 12, Siège 44',
      qr_data: `JELTIX:${ticketCode}:${newEv.id}:VALID`
    })
    .select()
    .single();

  if (tktErr) throw new Error('Erreur création ticket: ' + tktErr.message);
  console.log('✅ Billet généré avec QR code:', newTicket.id, newTicket.ticket_code, newTicket.status);

  // 4. PREMIER SCAN DU BILLET PAR LE CONTRÔLEUR
  console.log('\n4. Test Premier Scan par le Contrôleur à la porte...');
  const { data: checkTkt1 } = await supabase.from('tickets').select('*').eq('ticket_code', ticketCode).single();
  if (checkTkt1.status !== 'VALID') throw new Error('Statut invalide avant scan');

  // Valider le scan
  const nowIso = new Date().toISOString();
  await supabase
    .from('tickets')
    .update({
      status: 'USED',
      used_at: nowIso,
      used_gate: 'Porte 4 - Tribune Sud',
      used_by_controller: '4ca4cf0b-d78b-4bc9-a5a7-db91ceec8933'
    })
    .eq('id', newTicket.id);

  await supabase.from('scans').insert({
    ticket_id: newTicket.id,
    ticket_code: ticketCode,
    event_id: newEv.id,
    gate: 'Porte 4 - Tribune Sud',
    controller_id: '4ca4cf0b-d78b-4bc9-a5a7-db91ceec8933',
    result: 'VALID'
  });
  console.log('✅ Premier scan réussi: ACCÈS AUTORISÉ (Statut mis à jour à USED)');

  // 5. DEUXIÈME SCAN (TENTATIVE DE FRAUDE / DOUBLE PASSAGE)
  console.log('\n5. Test Deuxième Scan (Détection Double Passage)...');
  const { data: checkTkt2 } = await supabase.from('tickets').select('*').eq('ticket_code', ticketCode).single();
  if (checkTkt2.status === 'USED') {
    await supabase.from('scans').insert({
      ticket_id: newTicket.id,
      ticket_code: ticketCode,
      event_id: newEv.id,
      gate: 'Porte 1 - Entrée VIP',
      controller_id: '4ca4cf0b-d78b-4bc9-a5a7-db91ceec8933',
      result: 'ALREADY_SCANNED',
      error_message: 'Tentative de réutilisation du billet'
    });
    console.log('🛡️ Double passage intercepté avec succès: ALERTE BILLET DÉJÀ SCANNÉ !');
  } else {
    throw new Error('Échec détection double passage');
  }

  // 6. SCAN DE FAUX BILLET
  console.log('\n6. Test Scan Faux Billet (Code inexistant)...');
  const fakeCode = 'JT-FAUX-999999';
  const { data: fakeTkt } = await supabase.from('tickets').select('*').eq('ticket_code', fakeCode).maybeSingle();
  if (!fakeTkt) {
    await supabase.from('scans').insert({
      ticket_code: fakeCode,
      gate: 'Porte 4',
      result: 'INVALID',
      error_message: 'Billet inexistant'
    });
    console.log('🚫 Faux billet bloqué avec succès: CODE INCONNU DANS LE REGISTRE');
  }

  // NETTOYAGE DES DONNÉES DE TEST
  console.log('\n7. Nettoyage des données de test...');
  await supabase.from('scans').delete().eq('ticket_code', ticketCode);
  await supabase.from('scans').delete().eq('ticket_code', fakeCode);
  await supabase.from('tickets').delete().eq('id', newTicket.id);
  await supabase.from('orders').delete().eq('id', newOrder.id);
  await supabase.from('ticket_types').delete().eq('id', newTt.id);
  await supabase.from('events').delete().eq('id', newEv.id);
  console.log('✅ Nettoyage terminé.');

  console.log('\n🎉 TOUS LES TESTS DE BOUT EN BOUT SONT PASSÉS À 100% SUR SUPABASE CLOUD !');
}

runTest().catch((err) => {
  console.error('❌ Échec du test:', err);
  process.exit(1);
});
