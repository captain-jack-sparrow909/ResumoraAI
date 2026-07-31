import type { FastifyRequest } from "fastify";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { config } from "../config.js";

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) return null;
  adminClient ??= createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export function getSupabaseAuth() {
  if (!config.supabase.url || !config.supabase.anonKey) return null;
  authClient ??= createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return authClient;
}

export async function getRequestUser(request: FastifyRequest): Promise<User | null> {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const client = getSupabaseAuth();
  if (!token || !client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user;
}
