import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Signout warning in API:', err);
  }

  const response = NextResponse.json({
    success: true,
    message: 'Déconnecté avec succès.',
  });

  // Suppression absolue de tous les cookies de session
  response.cookies.set('jeltix_auth_session', '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  response.cookies.set('jeltix_user_profile', '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}

export async function GET(request: Request) {
  return POST(request);
}
