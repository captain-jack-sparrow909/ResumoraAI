import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

let client: S3Client | null = null;

function getClient() {
  if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey) return null;
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
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
  const key = `users/${userId}/imports/${crypto.randomUUID()}-${safeName}`;
  const command = new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
    ContentType: contentType,
    Metadata: { owner: userId },
  });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 });
  return { uploadUrl, key, expiresIn: 600 };
}
