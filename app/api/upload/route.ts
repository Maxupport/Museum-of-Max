import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { validateAdminRequest } from '@/lib/auth';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { prepareUploadImage } from '@/lib/upload-image';

function getVercelBlobToken(): string | undefined {
  // 1. 標準與延伸名稱
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  if (process.env.VERCEL_BLOB_READ_WRITE_TOKEN) return process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  if (process.env.BLOB_TOKEN) return process.env.BLOB_TOKEN;
  if (process.env.sec_BLOB_READ_WRITE_TOKEN) return process.env.sec_BLOB_READ_WRITE_TOKEN;
  if (process.env.sec_READ_WRITE_TOKEN) return process.env.sec_READ_WRITE_TOKEN;
  if (process.env.third_BLOB_READ_WRITE_TOKEN) return process.env.third_BLOB_READ_WRITE_TOKEN;
  if (process.env.third_READ_WRITE_TOKEN) return process.env.third_READ_WRITE_TOKEN;

  // 2. 自動掃描 process.env 中值為 vercel_blob_rw_ 開頭的權杖
  for (const value of Object.values(process.env)) {
    if (typeof value === 'string' && value.startsWith('vercel_blob_rw_')) {
      return value;
    }
  }

  return undefined;
}

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權的造訪' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: '未接收到圖片檔案' }, { status: 400 });
    }

    let image;
    try {
      image = await prepareUploadImage(file);
    } catch (error) {
      return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
    }
    const uniqueFileName = `${randomUUID()}.${image.extension}`;

    const blobToken = getVercelBlobToken();

    // 1. 若環境變數包含 Vercel Blob Token
    if (blobToken) {
      const blob = await put(uniqueFileName, image.buffer, {
        access: 'public',
        token: blobToken,
        contentType: image.contentType,
      });
      return NextResponse.json({
        ok: true,
        url: blob.url,
        fileName: uniqueFileName,
      });
    }

    // 若在 Vercel 生態系運作但未連結 Blob Store，給予明確提示
    if (process.env.VERCEL) {
      return NextResponse.json({
        ok: false,
        error: '圖片上傳尚未設定，請在 Vercel 設定 BLOB_READ_WRITE_TOKEN。',
      }, { status: 400 });
    }

    // 2. 本機開發降級方案：儲存於 public/uploads
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, uniqueFileName);
    await writeFile(filePath, image.buffer);

    return NextResponse.json({
      ok: true,
      url: `/uploads/${uniqueFileName}`,
      fileName: uniqueFileName,
    });
  } catch (error: unknown) {
    console.error('File upload error:', error);
    return NextResponse.json({ ok: false, error: '圖片上傳失敗，請稍後再試' }, { status: 500 });
  }
}


