import sharp from 'sharp';

// Leave room below the hosting platform's request limit for multipart headers.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const formats = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' } as const;

export async function prepareUploadImage(file: File) {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('圖片大小須介於 1 byte 與 4 MB 之間');
  const format = formats[file.type as keyof typeof formats];
  if (!format) throw new Error('僅支援 PNG、JPG、WebP 圖片（不支援 SVG）');
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) > 1) throw new Error('unsupported image');
    // Decode and re-encode: do not publish arbitrary bytes, metadata, or a user-supplied extension.
    const buffer = await image.rotate().toFormat(format).toBuffer();
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('image too large');
    return { buffer, extension: format === 'jpeg' ? 'jpg' : format, contentType: file.type };
  } catch {
    throw new Error('圖片內容無效、格式不符、解析度過大或為動畫，請改用 4 MB 以下的靜態圖片（最多 1600 萬像素）');
  }
}
