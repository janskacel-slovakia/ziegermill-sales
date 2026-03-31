import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return null;

  const sb = getSupabaseAdmin();
  
  // Clean expired sessions
  await sb.from('admin_sessions').delete().lt('expires_at', new Date().toISOString());

  const { data: session } = await sb
    .from('admin_sessions')
    .select('user_id, admin_users(id, username, display_name, role)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!session) return null;
  return (session as any).admin_users;
}