import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  fetchFullDatabaseFromSupabase,
  saveEventToSupabase,
  deleteEventFromSupabase,
  saveOrderAndTicketsToSupabase,
  validateScanInSupabase,
  getSupabaseAdmin,
  isUUID,
} from '@/lib/supabase/admin';

const DB_FILE = path.join(process.cwd(), 'data', 'local-db.json');

function ensureDbDir() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
}

function writeDiskSafely(data: any): boolean {
  try {
    ensureDbDir();
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    // Sur Vercel (read-only filesystem EROFS), on ignore silencieusement l'écriture disque
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

// Cache en mémoire volatile du runtime serveur pour des réponses ultra-rapides (< 5ms)
let serverMemoryCache: { data: any; timestamp: number } | null = null;
const MEMORY_CACHE_TTL_MS = 20_000; // 20 secondes

export async function GET() {
  try {
    const now = Date.now();
    if (serverMemoryCache && now - serverMemoryCache.timestamp < MEMORY_CACHE_TTL_MS) {
      return NextResponse.json(
        {
          exists: true,
          source: 'memory_cache',
          data: serverMemoryCache.data,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45',
          },
        }
      );
    }

    // 1. Tenter la lecture depuis Supabase Cloud (Données réelles et partagées)
    const cloudData = await fetchFullDatabaseFromSupabase();
    const diskData = readDiskSafely();

    if (cloudData && cloudData.events && cloudData.events.length > 0) {
      // Si nous avons des données Supabase, nous les fusionnons avec le disque local
      const mergedEvents = [...cloudData.events];
      const mergedTickets = [...(cloudData.tickets || [])];
      const mergedOrders = [...(cloudData.orders || [])];
      const mergedScans = [...(cloudData.scans || [])];
      const mergedUsers = [...(cloudData.users || [])];

      // Mettre en cache sur le disque si l'environnement le permet
      writeDiskSafely({
        events: mergedEvents,
        tickets: mergedTickets,
        orders: mergedOrders,
        scans: mergedScans,
        users: mergedUsers,
      });

      serverMemoryCache = {
        data: {
          events: mergedEvents,
          tickets: mergedTickets,
          orders: mergedOrders,
          scans: mergedScans,
          users: mergedUsers,
        },
        timestamp: Date.now(),
      };

      return NextResponse.json(
        {
          exists: true,
          source: 'supabase_cloud',
          data: serverMemoryCache.data,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45',
          },
        }
      );
    }

    // 2. Si Supabase est vide ou injoignable, se replier sur le disque local
    if (diskData) {
      serverMemoryCache = { data: diskData, timestamp: Date.now() };
      return NextResponse.json(
        {
          exists: true,
          source: 'local_disk',
          data: diskData,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
          },
        }
      );
    }

    return NextResponse.json({ exists: false, data: null });
  } catch (err: any) {
    console.error('Erreur GET local-db:', err);
    const diskData = readDiskSafely();
    if (diskData) {
      return NextResponse.json({ exists: true, source: 'fallback_disk', data: diskData });
    }
    return NextResponse.json({ exists: false, error: err.message }, { status: 200 });
  }
}

export async function POST(req: Request) {
  // Invalidation immédiate du cache mémoire sur toute écriture
  serverMemoryCache = null;

  try {
    const body = await req.json();

    // Cas 1 : Création atomique d'événement
    if (body.action === 'CREATE_EVENT' && body.event) {
      const createdEvent = await saveEventToSupabase(body.event);
      const currentDisk = readDiskSafely() || { events: [], tickets: [], orders: [], scans: [], users: [] };
      if (createdEvent) {
        currentDisk.events = [createdEvent, ...currentDisk.events.filter((e: any) => e.slug !== createdEvent.slug)];
        writeDiskSafely(currentDisk);
        return NextResponse.json({ success: true, event: createdEvent });
      }
    }

    // Cas 2 : Achat de billets (Commande + Tickets)
    if (body.action === 'PURCHASE' && body.order && body.tickets) {
      const res = await saveOrderAndTicketsToSupabase(body.order, body.tickets);
      const currentDisk = readDiskSafely() || { events: [], tickets: [], orders: [], scans: [], users: [] };
      currentDisk.orders = [body.order, ...(currentDisk.orders || [])];
      currentDisk.tickets = [...body.tickets, ...(currentDisk.tickets || [])];
      writeDiskSafely(currentDisk);
      return NextResponse.json({ success: res.success });
    }

    // Cas 3 : Validation du scan de billet
    if (body.action === 'VALIDATE_SCAN') {
      const scanResult = await validateScanInSupabase({
        ticketCode: body.ticketCode,
        gate: body.gate,
        controllerName: body.controllerName,
        controllerId: body.controllerId,
      });
      return NextResponse.json(scanResult);
    }

    // Cas 4 : Mise à jour de statut d'événement
    if (body.action === 'UPDATE_EVENT_STATUS' && body.eventId && body.status) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        if (isUUID(body.eventId)) {
          await supabase.from('events').update({ status: body.status }).eq('id', body.eventId);
        } else {
          await supabase.from('events').update({ status: body.status }).eq('slug', body.eventId);
        }
      }
      return NextResponse.json({ success: true });
    }

    // Cas 5 : Suppression d'événement (avec nettoyage complet et suppression en cascade)
    if (body.action === 'DELETE_EVENT' && (body.eventId || body.slug)) {
      const targetIdentifier = body.slug || body.eventId;
      const res = await deleteEventFromSupabase(targetIdentifier);

      const currentDisk = readDiskSafely() || { events: [], tickets: [], orders: [], scans: [], users: [] };
      currentDisk.events = (currentDisk.events || []).filter(
        (e: any) => e.id !== body.eventId && e.slug !== body.slug && e.id !== targetIdentifier && e.slug !== targetIdentifier
      );
      currentDisk.tickets = (currentDisk.tickets || []).filter(
        (t: any) => t.eventId !== body.eventId && t.eventId !== targetIdentifier
      );
      currentDisk.scans = (currentDisk.scans || []).filter(
        (s: any) => s.eventId !== body.eventId && s.eventId !== targetIdentifier
      );
      currentDisk.orders = (currentDisk.orders || []).filter(
        (o: any) => o.eventId !== body.eventId && o.eventId !== targetIdentifier
      );
      writeDiskSafely(currentDisk);

      // Invalider immédiatement le cache mémoire serveur
      serverMemoryCache = null;

      return NextResponse.json({ success: res.success, error: res.error });
    }

    // Cas 6 : Modification d'événement
    if (body.action === 'UPDATE_EVENT' && body.event) {
      const updatedEvent = await saveEventToSupabase(body.event);
      const currentDisk = readDiskSafely() || { events: [], tickets: [], orders: [], scans: [], users: [] };
      if (updatedEvent) {
        currentDisk.events = [
          updatedEvent,
          ...currentDisk.events.filter((e: any) => e.id !== updatedEvent.id && e.slug !== updatedEvent.slug),
        ];
        writeDiskSafely(currentDisk);
        serverMemoryCache = null;
        return NextResponse.json({ success: true, event: updatedEvent });
      }
      return NextResponse.json({ success: true });
    }

    // Cas 4 : Synchronisation complète du store
    writeDiskSafely(body);

    // Synchronisation en tâche de fond vers Supabase
    if (Array.isArray(body.events)) {
      for (const ev of body.events) {
        saveEventToSupabase(ev).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Erreur POST local-db:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
