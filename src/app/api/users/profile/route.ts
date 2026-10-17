import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import type { UserProfile } from '@/types';

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

const DB_FILE = path.join(process.cwd(), 'data', 'local-db.json');

function updateLocalDbUser(user: UserProfile) {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    if (!content) return;
    const db = JSON.parse(content);
    if (!Array.isArray(db.users)) return;

    const idx = db.users.findIndex(
      (u: any) => u.id === user.id || u.email?.toLowerCase() === user.email.toLowerCase()
    );
    if (idx !== -1) {
      db.users[idx] = {
        ...db.users[idx],
        fullName: user.fullName,
        phone: user.phone || db.users[idx].phone,
        organization: user.organization || db.users[idx].organization,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    }
  } catch (e) {
    console.warn('Erreur mise à jour local-db:', e);
  }
}

/**
 * PATCH /api/users/profile
 * Permet à un utilisateur connecté de modifier ses informations personnelles :
 * - Nom complet
 * - Téléphone
 * - Organisation
 * - Mot de passe (optionnel)
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, fullName, phone, organization, newPassword } = body;

    if (!userId && !email) {
      return NextResponse.json(
        { success: false, error: 'Identifiant ou email requis pour mettre à jour le profil.' },
        { status: 400 }
      );
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const supabaseAdmin = getAdminClient();

    // 1. Trouver le profil existant
    let targetProfileQuery = supabaseAdmin.from('profiles').select('*');
    if (userId) {
      targetProfileQuery = targetProfileQuery.eq('id', userId);
    } else {
      targetProfileQuery = targetProfileQuery.eq('email', cleanEmail);
    }

    const { data: currentProfile, error: fetchErr } = await targetProfileQuery.maybeSingle();
    if (fetchErr) {
      console.warn('Erreur recherche profil:', fetchErr.message);
    }

    const resolvedId = currentProfile?.id || userId;
    const resolvedEmail = currentProfile?.email || cleanEmail;

    // 2. Préparer les données de mise à jour du profil
    const profileUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof fullName === 'string' && fullName.trim()) {
      profileUpdate.full_name = fullName.trim();
    }
    if (phone !== undefined) {
      profileUpdate.phone = phone ? phone.trim() : null;
    }
    if (organization !== undefined) {
      profileUpdate.organization = organization ? organization.trim() : null;
    }

    // 3. Mettre à jour Supabase table profiles
    if (resolvedId) {
      const { error: updateProfileErr } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', resolvedId);

      if (updateProfileErr) {
        console.error('Erreur update profil Supabase:', updateProfileErr);
      }
    }

    // 4. Mettre à jour auth.users si changement de nom ou de mot de passe
    if (resolvedId) {
      const authUpdates: Record<string, any> = {};
      if (fullName) {
        authUpdates.user_metadata = {
          ...(currentProfile ? { role: currentProfile.role } : {}),
          full_name: fullName.trim(),
        };
      }
      if (newPassword && typeof newPassword === 'string' && newPassword.trim().length >= 6) {
        authUpdates.password = newPassword.trim();
      }

      if (Object.keys(authUpdates).length > 0) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(resolvedId, authUpdates);
        } catch (authErr) {
          console.warn('Erreur mise à jour auth.users:', authErr);
        }
      }
    }

    // 5. Construire le profil mis à jour
    const updatedUser: UserProfile = {
      id: resolvedId,
      email: resolvedEmail,
      fullName: profileUpdate.full_name || currentProfile?.full_name || fullName || 'Utilisateur',
      phone: profileUpdate.phone ?? currentProfile?.phone ?? phone,
      organization: profileUpdate.organization ?? currentProfile?.organization ?? organization,
      role: currentProfile?.role || 'ORGANIZER',
      organizationId: currentProfile?.organization_id || null,
      isActive: currentProfile?.is_active !== false,
      createdAt: currentProfile?.created_at || new Date().toISOString(),
    };

    // 6. Synchroniser local-db si disponible
    updateLocalDbUser(updatedUser);

    return NextResponse.json({
      success: true,
      message: 'Profil mis à jour avec succès.',
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('PATCH /api/users/profile exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur lors de la mise à jour du profil.' },
      { status: 500 }
    );
  }
}
