import { createClient } from '@/lib/supabase/client';
import { UserProfile, UserRole } from '@/types';

/**
 * Designated Super Administrator emails — Mamadou Cheikh Ba only.
 * ONLY these two Google accounts will ever receive the SUPER_ADMIN role.
 * No other email can self-assign or be assigned SUPER_ADMIN.
 */
export const SUPER_ADMIN_EMAILS = [
  'admin@jeltix.sn',
  'admin@foutaticket.sn',
  'mamadoucheikhba9@gmail.com',
  'mcbfd9@gmail.com',
];

/**
 * Strict Super Admin check — exact match only, no wildcard patterns.
 */
export function isSuperAdminEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === clean);
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 1500): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout de ${ms}ms dépassé`)), ms)
    ),
  ]);
}

/**
 * Fetch or sync profile in Supabase profiles table
 */
export async function syncUserProfile(
  id: string,
  email: string,
  fullName: string,
  requestedRole: UserRole = 'ORGANIZER'
): Promise<UserProfile> {
  const supabase = createClient();
  const cleanEmail = email.trim().toLowerCase();

  // Enforce Super Admin constraint: Nobody can self-assign SUPER_ADMIN unless in designated whitelist
  const effectiveRole: UserRole = isSuperAdminEmail(cleanEmail)
    ? 'SUPER_ADMIN'
    : requestedRole === 'SUPER_ADMIN'
    ? 'ORGANIZER'
    : requestedRole;

  try {
    // 1. Check if profile already exists (protégé par timeout 1.5s)
    const { data: existingProfile } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .single(),
      1500
    );

    if (existingProfile) {
      return {
        id: existingProfile.id,
        email: existingProfile.email,
        fullName: existingProfile.full_name,
        role: existingProfile.role,
        avatarUrl: existingProfile.avatar_url,
        organizationId: existingProfile.organization_id || undefined,
        isActive: existingProfile.is_active !== false,
        createdAt: existingProfile.created_at,
      };
    }

    // 2. Create new profile in Supabase (protégé par timeout 1.5s)
    const { data: newProfile, error } = await withTimeout(
      supabase
        .from('profiles')
        .insert({
          id,
          email: cleanEmail,
          full_name: fullName,
          role: effectiveRole,
          is_active: true,
        })
        .select()
        .single(),
      1500
    );

    if (!error && newProfile) {
      return {
        id: newProfile.id,
        email: newProfile.email,
        fullName: newProfile.full_name,
        role: newProfile.role,
        isActive: newProfile.is_active !== false,
        createdAt: newProfile.created_at,
      };
    }
  } catch (err) {
    console.warn('Supabase profile sync fallback (résilient instantané):', err);
  }

  // Fallback memory profile
  return {
    id,
    email: cleanEmail,
    fullName,
    role: effectiveRole,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Fetch all profiles across the entire platform (Super Admin only)
 * Queries the server API route /api/users which synchronizes Supabase Auth and Profiles table
 */
export async function fetchAllProfilesAdmin(): Promise<UserProfile[]> {
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        return data.users;
      }
    }
  } catch (err) {
    console.warn('fetchAllProfilesAdmin API error, fallback to client Supabase:', err);
  }

  try {
    const supabase = createClient();
    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      1500
    );

    if (error || !data) {
      return [];
    }

    return data.map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      role: p.role,
      avatarUrl: p.avatar_url,
      organization: p.organization,
      isActive: p.is_active !== false,
      createdAt: p.created_at,
    }));
  } catch {
    return [];
  }
}
