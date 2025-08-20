import { supabase } from "./supabaseClient";

export async function ensureAnonSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) await supabase.auth.signInAnonymously();
}

export async function saveNameToAuth(name: string) {
  await supabase.auth.updateUser({ data: { name } });
}