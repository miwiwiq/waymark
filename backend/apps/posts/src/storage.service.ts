import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireEnv } from '@app/common';
import { Injectable } from '@nestjs/common';

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const READ_URL_TTL_SECONDS = 60 * 60;

/** MinIO through the S3 API, so moving to real S3 is a config change (clarification 2). */
@Injectable()
export class StorageService {
  private readonly bucket = requireEnv('S3_BUCKET');
  // Server-side calls use the Docker-network address, but signed URLs must
  // carry the address the browser sees, so one client exists only for signing.
  private readonly internal = createClient(requireEnv('S3_ENDPOINT'));
  private readonly signer = createClient(requireEnv('S3_PUBLIC_ENDPOINT'));

  /**
   * The browser must send exactly this Content-Type. The SDK signs only the
   * host header by default, so content-type is added to the signed headers.
   */
  presignUpload(key: string, contentType: string): Promise<string> {
    return getSignedUrl(
      this.signer,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(['content-type']) },
    );
  }

  /** Decision P3: the bucket is private; every response gets fresh 1-hour links. */
  signRead(key: string): Promise<string> {
    return getSignedUrl(this.signer, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: READ_URL_TTL_SECONDS,
    });
  }

  /** The stored type and size, or null if nothing was uploaded under this key. */
  async inspect(key: string): Promise<{ contentType: string; size: number } | null> {
    try {
      const head = await this.internal.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { contentType: head.ContentType ?? '', size: head.ContentLength ?? 0 };
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }
}

function createClient(endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true, // MinIO serves buckets as paths, not subdomains
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY'),
      secretAccessKey: requireEnv('S3_SECRET_KEY'),
    },
    // Newer SDKs add checksum parameters to pre-signed PUT URLs by default,
    // which a plain browser upload can't satisfy.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}
