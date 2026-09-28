export type MediaMeta = { color?: string; width?: number; height?: number };

const TIMEOUT_MS = 5000;
const cache = new WeakMap<File, Promise<MediaMeta>>();

/**
 * A local file's average colour and pixel size, sent with the post for
 * placeholders and card tints (P2). Read once per file; empty when the browser
 * can't decode it (e.g. some MOV codecs) or takes too long.
 */
export function readMediaMeta(file: File): Promise<MediaMeta> {
  let meta = cache.get(file);
  if (!meta) {
    meta = Promise.race([
      file.type.startsWith("video/") ? readVideo(file) : readImage(file),
      new Promise<MediaMeta>((resolve) => setTimeout(() => resolve({}), TIMEOUT_MS)),
    ]).catch(() => ({}));
    cache.set(file, meta);
  }
  return meta;
}

async function readImage(file: File): Promise<MediaMeta> {
  const bitmap = await createImageBitmap(file);
  try {
    return { color: averageColor(bitmap), width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

// The first frame, from an off-screen video element.
function readVideo(file: File): Promise<MediaMeta> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  return new Promise<MediaMeta>((resolve, reject) => {
    video.onloadeddata = () => {
      video.currentTime = 0.1;
    };
    video.onseeked = () =>
      resolve({ color: averageColor(video), width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => reject(new Error("The browser can't decode this video"));
    video.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

function averageColor(source: CanvasImageSource): string | undefined {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return undefined;
  }
  context.drawImage(source, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);
  const sum = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 128) {
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
      count++;
    }
  }
  if (count === 0) {
    return undefined;
  }
  return `#${sum.map((channel) => Math.round(channel / count).toString(16).padStart(2, "0")).join("")}`;
}
