import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'data', 'local-db.json');

function ensureDbFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function GET() {
  try {
    ensureDbFile();
    if (!fs.existsSync(DB_FILE)) {
      return NextResponse.json({ exists: false, data: null });
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    if (!content || !content.trim()) {
      return NextResponse.json({ exists: false, data: null });
    }
    const data = JSON.parse(content);
    return NextResponse.json({ exists: true, data });
  } catch (err: any) {
    console.error('Erreur lecture local-db:', err);
    return NextResponse.json({ exists: false, error: err.message }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    ensureDbFile();
    const body = await req.json();
    
    // Écriture atomique avec fichier temporaire pour éviter toute corruption
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(body, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    return NextResponse.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Erreur écriture local-db:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
