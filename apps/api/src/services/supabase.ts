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

  const { data: liveness, error: livenessReadError } = await database.from("service_liveness").select("singleton").eq("singleton", true).maybeSingle();
  if (livenessReadError) throw new Error(`Database liveness read failed: ${livenessReadError.message}`);

  const livenessAction = liveness ? "deleted" : "inserted";
  const livenessWrite = liveness
    ? await database.from("service_liveness").delete().eq("singleton", true)
    : await database.from("service_liveness").insert({ singleton: true, touched_at: new Date().toISOString() });
  if (livenessWrite.error) throw new Error(`Database liveness ${livenessAction} failed: ${livenessWrite.error.message}`);

  const { data: state, error: stateReadError } = await database.from("service_maintenance_state").select("last_cleanup_at").eq("singleton", true).maybeSingle();
  if (stateReadError) throw new Error(`Database maintenance state read failed: ${stateReadError.message}`);

  const now = new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1_000).toISOString();
  const cleanupRan = !state?.last_cleanup_at || new Date(state.last_cleanup_at).getTime() <= now.getTime() - 24 * 60 * 60 * 1_000;
  const deleted: Record<string, number> = {};

  if (cleanupRan) {
    const cleanupTargets = [
      { table: "resume_versions", key: "resumeVersions" },
      { table: "ai_proposals", key: "aiProposals" },
      { table: "career_coaching_sessions", key: "careerCoachingSessions" },
      { table: "application_review_invites", key: "applicationReviewInvites" },
      { table: "organization_invites", key: "organizationInvites" },
    ] as const;

    for (const target of cleanupTargets) {
      const { data, error } = await database.from(target.table).delete().lt("created_at", cutoff).select("id");
      if (error) throw new Error(`Database cleanup failed for ${target.table}: ${error.message}`);
      deleted[target.key] = data?.length ?? 0;
    }

    const { error: stateWriteError } = await database
      .from("service_maintenance_state")
      .upsert({ singleton: true, last_cleanup_at: now.toISOString() }, { onConflict: "singleton" });
    if (stateWriteError) throw new Error(`Database maintenance state write failed: ${stateWriteError.message}`);
  }

  return { livenessAction, cleanupRan, deleted, cutoff };
}
