import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
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
 * GET /api/users/team?organizerId=...&organizerEmail=...
 * Récupère tous les membres de l'équipe rattachés à cet organisateur.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizerId = searchParams.get('organizerId');
    const organizerEmail = searchParams.get('organizerEmail')?.trim().toLowerCase();

    const supabaseAdmin = getAdminClient();

    let targetOrgId = organizerId;

    // Si on a l'email de l'organisateur mais pas d'ID fiable, chercher son profil
    if (organizerEmail && (!targetOrgId || targetOrgId === 'undefined')) {
      const { data: orgProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', organizerEmail)
        .maybeSingle();

      if (orgProfile) {
        targetOrgId = orgProfile.id;
      }
    }

    if (!targetOrgId || targetOrgId === 'undefined') {
      return NextResponse.json({ success: true, members: [] });
    }

    const { data: members, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('organization_id', targetOrgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Erreur récupération équipe:', error.message);
      return NextResponse.json({ success: false, error: error.message, members: [] }, { status: 500 });
    }

    const formattedMembers: UserProfile[] = (members || []).map((m) => ({
      id: m.id,
      email: m.email,
      fullName: m.full_name,
      role: m.role as UserRole,
      phone: m.phone || undefined,
      organizationId: m.organization_id,
      isActive: m.is_active !== false,
      createdAt: m.created_at,
    }));

    return NextResponse.json({ success: true, members: formattedMembers });
  } catch (err: any) {
    console.error('GET /api/users/team exception:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

/**
 * POST /api/users/team
 * Crée un membre de l'équipe (Vendeur Guichet ou Contrôleur Porte)
 * - Crée le compte Auth Supabase avec mot de passe initial
 * - Crée ou rattache le profil dans la table profiles
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      organizerId: providedOrgId,
      organizerEmail: providedOrgEmail,
      email,
      fullName,
      role,
      phone,
      password,
    } = body;

    if (!email || !fullName || !role) {
      return NextResponse.json(
        { success: false, error: 'Email, nom complet et rôle sont requis.' },
        { status: 400 }
      );
    }

    if (!['SELLER', 'CONTROLLER'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Rôle invalide. Seuls Vendeur (SELLER) ou Contrôleur (CONTROLLER) sont autorisés.' },
        { status: 400 }
      );
    }

    function isValidUUID(str?: string | null): boolean {
      if (!str) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOrgEmail = (providedOrgEmail || '').trim().toLowerCase();
    const memberPassword = password && password.trim().length >= 6 ? password.trim() : 'Jeltix2026!';

    const supabaseAdmin = getAdminClient();

    // 1. Identifier ou assurer le profil de l'organisateur dans la table profiles
    let organizerProfileId = isValidUUID(providedOrgId) ? providedOrgId : null;

    if (cleanOrgEmail) {
      // Chercher si l'organisateur a déjà son profil
      const { data: existingOrg } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('email', cleanOrgEmail)
        .maybeSingle();

      if (existingOrg && isValidUUID(existingOrg.id)) {
        organizerProfileId = existingOrg.id;
      } else {
        // Vérifier dans auth.users
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const orgAuthUser = authUsers?.users?.find(
          (u) => u.email?.toLowerCase() === cleanOrgEmail
        );

        const newOrgId = (orgAuthUser && isValidUUID(orgAuthUser.id)) ? orgAuthUser.id : crypto.randomUUID();
        const orgRole = isSuperAdminEmail(cleanOrgEmail) ? 'SUPER_ADMIN' : 'ORGANIZER';

        // Créer le profil manquant de l'organisateur
        const { data: createdOrg } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: newOrgId,
            email: cleanOrgEmail,
            full_name: orgAuthUser?.user_metadata?.full_name || cleanOrgEmail.split('@')[0],
            role: orgRole,
            is_active: true,
          })
          .select()
          .single();

        if (createdOrg && isValidUUID(createdOrg.id)) {
          organizerProfileId = createdOrg.id;
        }
      }
    }

    // 2. Vérifier si l'utilisateur existe déjà dans auth.users
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
    let targetAuthUser = allUsers?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    if (!targetAuthUser) {
      // Création du compte utilisateur dans Supabase Auth
      const { data: newUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: memberPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
          organization_id: organizerProfileId,
        },
      });

      if (createAuthErr || !newUser.user) {
        console.error('Erreur création auth.users:', createAuthErr?.message);
        return NextResponse.json(
          { success: false, error: createAuthErr?.message || 'Erreur création du compte d’accès.' },
          { status: 500 }
        );
      }

      targetAuthUser = newUser.user;
    } else {
      // Utilisateur déjà existant : mettre à jour son mot de passe et confirmer son email immédiatement
      const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        targetAuthUser.id,
        {
          password: memberPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role,
            organization_id: organizerProfileId,
          },
        }
      );
      if (updateErr) {
        console.warn('Notice mise à jour authUser:', updateErr.message);
      } else if (updated.user) {
        targetAuthUser = updated.user;
      }
    }

    // 3. Upsert du profil dans la table `profiles`
    const { data: savedProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: targetAuthUser.id,
        email: cleanEmail,
        full_name: fullName,
        role: role,
        phone: phone || null,
        organization_id: organizerProfileId || null,
        is_active: true,
      })
      .select()
      .single();

    if (profileErr || !savedProfile) {
      console.error('Erreur insertion profiles:', profileErr?.message);
      return NextResponse.json(
        { success: false, error: profileErr?.message || 'Erreur lors de l’enregistrement du profil.' },
        { status: 500 }
      );
    }

    const resultProfile: UserProfile = {
      id: savedProfile.id,
      email: savedProfile.email,
      fullName: savedProfile.full_name,
      role: savedProfile.role as UserRole,
      phone: savedProfile.phone || undefined,
      organizationId: savedProfile.organization_id,
      isActive: savedProfile.is_active !== false,
      createdAt: savedProfile.created_at,
    };

    return NextResponse.json({
      success: true,
      profile: resultProfile,
      defaultPassword: memberPassword,
      message: `Membre ${fullName} créé avec succès !`,
    });
  } catch (err: any) {
    console.error('POST /api/users/team exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur interne du serveur.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/team
 * Modifie le statut actif / inactif d'un membre
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { memberId, isActive } = body;

    if (!memberId) {
      return NextResponse.json({ success: false, error: 'ID du membre requis.' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: Boolean(isActive) })
      .eq('id', memberId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Statut mis à jour.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Erreur serveur.' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/team
 * Détache un membre de l'organisation
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json({ success: false, error: 'ID du membre requis.' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ organization_id: null })
      .eq('id', memberId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Membre retiré de l’équipe.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
