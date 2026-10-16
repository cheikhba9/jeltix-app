import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { isSuperAdminEmail } from '@/lib/services/profiles.service';
import type { UserProfile, UserRole } from '@/types';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Variables Supabase manquantes pour les opérations d’administration.');
  }
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * POST /api/auth/verify
 * Vérifie et prépare l'accès avant ou après tentative de connexion :
 * 1. S'assure que l'email est marqué comme confirmé dans auth.users
 * 2. Récupère le profil exact en base avec son rôle réel (SELLER, CONTROLLER, ORGANIZER, SUPER_ADMIN)
 * 3. Vérifie si le compte est actif
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email requis.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseAdmin = getAdminClient();

    // 1. Chercher l'utilisateur dans auth.users
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = allUsers?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    if (!authUser) {
      return NextResponse.json({
        success: false,
        error: 'Aucun compte associé à cette adresse email.',
      }, { status: 404 });
    }

    // 2. Si l'email n'était pas confirmé, le confirmer immédiatement pour éviter "Email not confirmed"
    if (!authUser.email_confirmed_at) {
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        email_confirm: true,
      });
    }

    // 3. Récupérer le profil en base
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    const isSuperAdmin = isSuperAdminEmail(cleanEmail);
    const computedRole: UserRole = isSuperAdmin
      ? 'SUPER_ADMIN'
      : (profile?.role || authUser.user_metadata?.role || 'ORGANIZER') as UserRole;

    const computedName =
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      cleanEmail.split('@')[0];

    // Si le profil n'existait pas encore dans la table profiles, le créer
    if (!profile) {
      await supabaseAdmin.from('profiles').upsert({
        id: authUser.id,
        email: cleanEmail,
        full_name: computedName,
        role: computedRole,
        organization_id: authUser.user_metadata?.organization_id || null,
        is_active: true,
      });
    }

    if (profile && profile.is_active === false) {
      return NextResponse.json({
        success: false,
        error: 'Ce compte a été suspendu par votre administrateur ou organisateur.',
        isSuspended: true,
      }, { status: 403 });
    }

    const userProfile: UserProfile = {
      id: profile?.id || authUser.id,
      email: cleanEmail,
      fullName: computedName,
      role: computedRole,
      phone: profile?.phone || authUser.phone || undefined,
      organization: profile?.organization || undefined,
      organizationId: profile?.organization_id || authUser.user_metadata?.organization_id || null,
      isActive: profile ? profile.is_active !== false : true,
      createdAt: profile?.created_at || authUser.created_at,
    };

    return NextResponse.json({
      success: true,
      profile: userProfile,
    });
  } catch (err: any) {
    console.error('POST /api/auth/verify exception:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
