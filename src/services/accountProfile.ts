import type { User } from '@supabase/supabase-js';

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

// Display-only metadata. Authorization and storage ownership always use user.id.
export function getAccountProfile(user: User | null, guest: { name: string; email: string } | null = null) {
  if (!user) return { name: guest ? text(guest.name) || 'Guest' : 'Job Seeker', email: '', isGuest: !!guest };
  const email = text(user.email);
  const metadata = user.user_metadata || {};
  const customName = metadata.jobtic_display_name_owner === user.id ? text(metadata.jobtic_display_name) : '';
  const google = user.identities?.find(identity => identity.provider === 'google' && identity.user_id === user.id
    && (!identity.identity_data?.email || text(identity.identity_data.email).toLowerCase() === email.toLowerCase()));
  const googleName = google ? text(google.identity_data?.full_name) || text(google.identity_data?.name) || text(google.identity_data?.given_name) : '';
  // provider is the original signup provider, not necessarily the latest login method.
  const usesGoogle = !!google || user.app_metadata?.provider === 'google';
  // A Google account must not inherit a stale full_name from app settings or email signup metadata.
  const accountName = usesGoogle ? googleName : text(metadata.full_name) || text(metadata.name) || googleName;
  return { name: customName || accountName || email.split('@')[0] || 'Your account', email, isGuest: false };
}

export function createAccountGuard() {
  let owner: string | null = null;
  let epoch = 0;
  return {
    setOwner(next: string | null) { if (next !== owner) { owner = next; epoch++; } },
    capture() { return { owner, epoch }; },
    accepts(snapshot: { owner: string | null; epoch: number }, resultOwner: string) {
      return snapshot.owner === resultOwner && snapshot.owner === owner && snapshot.epoch === epoch;
    }
  };
}
