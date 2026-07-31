const value = (name: string) => process.env[name]?.trim() || undefined;

export const config = {
  port: Number(value("PORT") ?? 4000),
  webOrigins: (value("WEB_ORIGIN") ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim()),
  supabase: {
    url: value("SUPABASE_URL"),
    anonKey: value("SUPABASE_ANON_KEY"),
    serviceRoleKey: value("SUPABASE_SERVICE_ROLE_KEY"),
  },
  deepseek: {
    apiKey: value("DEEPSEEK_API_KEY"),
    model: value("DEEPSEEK_MODEL") ?? "deepseek-v4-pro",
    baseUrl: value("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com",
  },
  r2: {
    accountId: value("R2_ACCOUNT_ID"),
    accessKeyId: value("R2_ACCESS_KEY_ID"),
    secretAccessKey: value("R2_SECRET_ACCESS_KEY"),
    bucket: value("R2_BUCKET") ?? "resumora-documents",
  },
};

export const capabilities = {
  database: Boolean(config.supabase.url && config.supabase.anonKey && config.supabase.serviceRoleKey),
  ai: Boolean(config.deepseek.apiKey),
  storage: Boolean(config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey),
};
