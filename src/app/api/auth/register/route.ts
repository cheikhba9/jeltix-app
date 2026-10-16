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
 * POST /api/auth/register
 * Enregistrement serveur robuste pour les comptes Organisateurs :
 * - Crée le compte Auth Supabase avec email confirmé immédiatement
 * - Met à jour le mot de passe si le compte existait déjà
 * - Insère le profil dans la table profiles avec un UUID valide
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName, phone, organization } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email et mot de passe sont obligatoires.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (fullName || cleanEmail.split('@')[0] || 'Organisateur').trim();
    const role: UserRole = isSuperAdminEmail(cleanEmail) ? 'SUPER_ADMIN' : 'ORGANIZER';

    const supabaseAdmin = getAdminClient();

    // 1. Vérifier si l'utilisateur existe dans auth.users
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
    let authUser = allUsers?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    if (!authUser) {
      // Création d'un nouveau compte avec email_confirm: true (évite le blocage Email not confirmed)
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          role,
        },
      });

      if (createErr || !created.user) {
        console.error('Erreur createUser register:', createErr?.message);
        return NextResponse.json(
          { success: false, error: createErr?.message || 'Erreur lors de la création du compte.' },
          { status: 500 }
        );
      }
      authUser = created.user;
    } else {
      // Mettre à jour le mot de passe et confirmer l'email si déjà présent
      const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        {
          password,
          email_confirm: true,
          user_metadata: {
            full_name: cleanName,
            role,
          },
        }
      );
      if (updateErr) {
        console.warn('Notice update auth user:', updateErr.message);
      } else if (updated.user) {
        authUser = updated.user;
      }
    }

    // 2. Insérer ou mettre à jour dans la table profiles avec le vrai UUID Supabase
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.id,
        email: cleanEmail,
        full_name: cleanName,
        role,
        phone: phone || null,
        organization: organization || (role === 'SUPER_ADMIN' ? 'Jël Tix SAS' : cleanName),
        is_active: true,
      })
      .select()
      .single();

    if (profileErr) {
      console.error('Erreur upsert profile register:', profileErr.message);
      return NextResponse.json(
        { success: false, error: 'Compte créé mais erreur sur le profil: ' + profileErr.message },
        { status: 500 }
      );
    }

    const userProfile: UserProfile = {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role as UserRole,
      phone: profile.phone || undefined,
      organization: profile.organization || undefined,
      organizationId: profile.organization_id || null,
      isActive: profile.is_active !== false,
      createdAt: profile.created_at,
    };

    return NextResponse.json({
      success: true,
      user: userProfile,
      message: `Compte ${cleanName} créé avec succès !`,
    });
  } catch (err: any) {
    console.error('POST /api/auth/register exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur lors de l’inscription.' },
      { status: 500 }
    );
  }
}
