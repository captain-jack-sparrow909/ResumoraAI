import type { FastifyRequest } from "fastify";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { config } from "../config.js";

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!config.supabase.url || !config.supabase.secretKey) return null;
  adminClient ??= createClient(config.supabase.url, config.supabase.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export function getSupabaseAuth() {
  if (!config.supabase.url || !config.supabase.publishableKey) return null;
  authClient ??= createClient(config.supabase.url, config.supabase.publishableKey, {
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

export async function runDatabaseMaintenance(retentionDays: number) {
  const database = getSupabaseAdmin();
  if (!database) throw new Error("Database is not configured");

  const { data, error } = await database.rpc("run_service_maintenance", { retention_window_days: retentionDays });
  if (error) throw new Error(`Database maintenance failed: ${error.message}`);
  return data as {
    livenessAction: "inserted" | "deleted";
    cleanupRan: boolean;
    deleted: Record<string, number>;
    cutoff: string;
  };
}
