import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { capabilities, config } from "../apps/api/src/config.js";

type Result = { service: string; ok: boolean; detail: string };
const results: Result[] = [];

const record = (service: string, ok: boolean, detail: string) => {
  results.push({ service, ok, detail });
};

async function checkDeepSeek() {
  if (!config.deepseek.apiKey) return record("DeepSeek", false, "API key is missing");
  try {
    const response = await fetch(`${config.deepseek.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.deepseek.apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    record("DeepSeek", response.ok, response.ok ? `credentials accepted; configured model ${config.deepseek.model}` : `credential check returned HTTP ${response.status}`);
  } catch {
    record("DeepSeek", false, "could not reach the configured API endpoint");
  }
}

async function checkSupabase() {
  const { url, publishableKey, secretKey, jwksUrl } = config.supabase;
  if (!url || !publishableKey || !secretKey) {
    record("Supabase Auth", false, "URL, publishable key, or secret key is missing");
    return;
  }

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(12_000),
    });
    record("Supabase Auth", response.ok, response.ok ? "publishable key accepted" : `returned HTTP ${response.status}`);
  } catch {
    record("Supabase Auth", false, "could not reach the project auth endpoint");
  }

  try {
    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.from("resumes").select("id").limit(1);
    record("Supabase DB", !error, error ? `schema check failed (${error.code ?? "database error"}); apply the Phase 1 migration` : "secret key accepted and resumes table is available");
    const phaseTwoChecks = await Promise.all(
      ["job_postings", "resume_variants", "ai_proposals", "cover_letters"].map(async (table) => ({
        table,
        result: await admin.from(table).select("id").limit(1),
      })),
    );
    const missingPhaseTwo = phaseTwoChecks.find(({ result }) => result.error);
    record(
      "Supabase Phase 2",
      !missingPhaseTwo,
      missingPhaseTwo
        ? `table ${missingPhaseTwo.table} failed (${missingPhaseTwo.result.error?.code ?? "database error"}); apply the Phase 2 migration`
        : "all four job intelligence tables are available",
    );
    const phaseThreeChecks = await Promise.all(
      ["applications", "application_activities", "interview_packs", "application_reviews"].map(async (table) => ({
        table,
        result: await admin.from(table).select("id").limit(1),
      })),
    );
    const missingPhaseThree = phaseThreeChecks.find(({ result }) => result.error);
    record(
      "Supabase Phase 3",
      !missingPhaseThree,
      missingPhaseThree
        ? `table ${missingPhaseThree.table} failed (${missingPhaseThree.result.error?.code ?? "database error"}); apply the Phase 3 migration`
        : "all four application workspace tables are available",
    );
    const collaborationChecks = await Promise.all(
      ["application_review_invites"].map(async (table) => ({
        table,
        result: await admin.from(table).select("id").limit(1),
      })),
    );
    const missingCollaboration = collaborationChecks.find(({ result }) => result.error);
    const reviewColumnCheck = await admin.from("application_reviews").select("invite_id,decision").limit(1);
    record(
      "Supabase Reviews",
      !missingCollaboration && !reviewColumnCheck.error,
      missingCollaboration
        ? `table ${missingCollaboration.table} failed (${missingCollaboration.result.error?.code ?? "database error"}); apply the Phase 3 collaboration migration`
        : reviewColumnCheck.error
          ? `review decision columns failed (${reviewColumnCheck.error.code ?? "database error"}); apply the Phase 3 collaboration migration`
          : "hashed invitations and reviewer decision fields are available",
    );
    const phaseFourChecks = await Promise.all(
      [
        { table: "career_goals", key: "user_id" },
        { table: "career_outcomes", key: "id" },
        { table: "career_learning_plans", key: "id" },
        { table: "career_coaching_sessions", key: "id" },
      ].map(async ({ table, key }) => ({
        table,
        result: await admin.from(table).select(key).limit(1),
      })),
    );
    const missingPhaseFour = phaseFourChecks.find(({ result }) => result.error);
    record(
      "Supabase Phase 4",
      !missingPhaseFour,
      missingPhaseFour
        ? `table ${missingPhaseFour.table} failed (${missingPhaseFour.result.error?.code ?? "database error"}); apply the Phase 4 migration`
        : "career goals, outcomes, learning plans, and coaching tables are available",
    );
    const publishingChecks = await Promise.all(
      [
        { table: "portfolio_publications", key: "id" },
        { table: "organizations", key: "id" },
        { table: "organization_members", key: "organization_id" },
        { table: "organization_invites", key: "id" },
        { table: "organization_data_grants", key: "organization_id" },
        { table: "organization_participant_profiles", key: "organization_id" },
        { table: "organization_cohorts", key: "id" },
        { table: "organization_cohort_members", key: "cohort_id" },
      ].map(async ({ table, key }) => ({
        table,
        result: await admin.from(table).select(key).limit(1),
      })),
    );
    const missingPublishing = publishingChecks.find(({ result }) => result.error);
    record(
      "Supabase Phase 4B",
      !missingPublishing,
      missingPublishing
        ? `table ${missingPublishing.table} failed (${missingPublishing.result.error?.code ?? "database error"}); apply the Phase 4 publishing migration`
        : "portfolio publishing, memberships, consent grants, and cohort tables are available",
    );
    const maintenanceChecks = await Promise.all(
      ["service_liveness", "service_maintenance_state"].map(async (table) => ({
        table,
        result: await admin.from(table).select("singleton").limit(1),
      })),
    );
    const missingMaintenance = maintenanceChecks.find(({ result }) => result.error);
    record(
      "Supabase upkeep",
      !missingMaintenance,
      missingMaintenance
        ? `table ${missingMaintenance.table} failed (${missingMaintenance.result.error?.code ?? "database error"}); apply the free-tier maintenance migration`
        : "private liveness toggle and retention schema are available",
    );
  } catch {
    record("Supabase DB", false, "could not query the project database");
  }

  if (jwksUrl) {
    try {
      const response = await fetch(jwksUrl, { signal: AbortSignal.timeout(12_000) });
      const body = response.ok ? await response.json() as { keys?: unknown[] } : null;
      record("Supabase JWKS", Boolean(response.ok && body?.keys?.length), response.ok && body?.keys?.length ? `${body.keys.length} signing key(s) available` : `returned HTTP ${response.status}`);
    } catch {
      record("Supabase JWKS", false, "could not load signing keys");
    }
  } else {
    record("Supabase JWKS", false, "JWKS URL is missing");
  }
}

async function checkR2() {
  const { endpoint, accountId, accessKeyId, secretAccessKey, bucket } = config.r2;
  const resolvedEndpoint = endpoint ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  if (!resolvedEndpoint || !accessKeyId || !secretAccessKey || !bucket) {
    record("Cloudflare R2", false, "endpoint, credentials, or bucket name is missing");
    return;
  }
  try {
    const client = new S3Client({
      region: "auto",
      endpoint: resolvedEndpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    record("Cloudflare R2", true, `bucket ${bucket} is reachable`);
  } catch (error) {
    const name = error instanceof Error ? error.name : "request error";
    record("Cloudflare R2", false, `bucket check failed (${name})`);
  }
}

async function main() {
  await Promise.all([checkDeepSeek(), checkSupabase(), checkR2()]);

  console.log("Resumora integration audit\n");
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.service.padEnd(16)} ${result.detail}`);
  }
  console.log(`\nConfigured capabilities: database=${capabilities.database}, storage=${capabilities.storage}, ai=${capabilities.ai}`);

  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

void main();
