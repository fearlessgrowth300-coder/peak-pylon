import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ServerDb = any;

export async function requireAdmin(accessToken: string) {
  const db = supabaseAdmin as ServerDb;
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  const user = authData.user;
  if (authError || !user) throw new Error("Your admin session is no longer valid. Sign in again.");

  const { data: adminRole, error: roleError } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError || !adminRole) throw new Error("Only the community admin can manage integrations.");
  return { db, user };
}

export async function readIntegrationSecret(db: ServerDb, secretName: string) {
  const { data, error } = await db
    .from("integration_secrets")
    .select("secret_value")
    .eq("secret_name", secretName)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.secret_value === "string" ? data.secret_value.trim() : "";
}

export async function writeIntegrationSecret(
  db: ServerDb,
  secretName: string,
  secretValue: string,
  userId: string,
) {
  const { error } = await db.from("integration_secrets").upsert(
    {
      secret_name: secretName,
      secret_value: secretValue,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "secret_name" },
  );
  if (error) throw error;
}

export async function readIntegrationSetting<T>(
  db: ServerDb,
  settingName: string,
  fallback: T,
): Promise<T> {
  const { data, error } = await db
    .from("integration_settings")
    .select("setting_value")
    .eq("setting_name", settingName)
    .maybeSingle();
  if (error) throw error;
  return (data?.setting_value as T | undefined) ?? fallback;
}

export async function writeIntegrationSetting(
  db: ServerDb,
  settingName: string,
  settingValue: unknown,
  userId: string | null,
) {
  const { error } = await db.from("integration_settings").upsert(
    {
      setting_name: settingName,
      setting_value: settingValue,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_name" },
  );
  if (error) throw error;
}
