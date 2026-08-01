import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

let client: S3Client | null = null;

function getClient() {
  if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey) return null;
  client ??= new S3Client({
    region: "auto",
    endpoint: config.r2.endpoint ?? `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
  return client;
}

export async function createUploadUrl(userId: string, filename: string, contentType: string) {
  const r2 = getClient();
  if (!r2) return null;
  const safeName = filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-100);
  const key = `imports/users/${userId}/${crypto.randomUUID()}-${safeName}`;
  const command = new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
    ContentType: contentType,
    Metadata: { owner: userId },
  });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 });
  return { uploadUrl, key, expiresIn: 600 };
}

export async function deleteExpiredImports(retentionDays: number) {
  const r2 = getClient();
  if (!r2) throw new Error("Storage is not configured");

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1_000);
  let scanned = 0;
  let deleted = 0;

  // The second prefix covers objects created before imports were moved to a
  // top-level lifecycle-friendly namespace.
  for (const prefix of ["imports/", "users/"]) {
    let continuationToken: string | undefined;
    do {
      const page = await r2.send(new ListObjectsV2Command({ Bucket: config.r2.bucket, Prefix: prefix, ContinuationToken: continuationToken, MaxKeys: 1_000 }));
      const expiredKeys = (page.Contents ?? [])
        .filter((object) => {
          const isImport = prefix === "imports/" || object.Key?.includes("/imports/");
          return isImport && object.LastModified && object.LastModified < cutoff;
        })
        .flatMap((object) => object.Key ? [{ Key: object.Key }] : []);

      scanned += page.Contents?.length ?? 0;
      if (expiredKeys.length) {
        const result = await r2.send(new DeleteObjectsCommand({ Bucket: config.r2.bucket, Delete: { Objects: expiredKeys, Quiet: true } }));
        if (result.Errors?.length) throw new Error(`Storage cleanup failed for ${result.Errors.length} object(s)`);
        deleted += expiredKeys.length;
      }

      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return { scanned, deleted, cutoff: cutoff.toISOString() };
}
