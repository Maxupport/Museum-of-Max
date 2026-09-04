import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { validateAdminRequest } from '@/lib/auth';
import { put } from '@vercel/blob';

function getVercelBlobToken(): string | undefined {
  // 1. 標準與延伸名稱
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  if (process.env.VERCEL_BLOB_READ_WRITE_TOKEN) return process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  if (process.env.BLOB_TOKEN) return process.env.BLOB_TOKEN;
  if (process.env.sec_BLOB_READ_WRITE_TOKEN) return process.env.sec_BLOB_READ_WRITE_TOKEN;
  if (process.env.sec_READ_WRITE_TOKEN) return process.env.sec_READ_WRITE_TOKEN;

  // 2. 自動掃描 process.env 中值為 vercel_blob_rw_ 開頭的權杖
  for (const [key, value] of Object.entries(process.env)) {
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
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: '未接收到圖片檔案' }, { status: 400 });
    }

    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: '僅支援上傳圖片檔案 (PNG, JPG, WEBP, SVG)' }, { status: 400 });
    }

    // 產生不重複檔名
    const fileExt = path.extname(file.name) || '.png';
    const cleanBaseName = path.basename(file.name, fileExt).replace(/[^a-zA-Z0-9]/g, '_');
    const uniqueFileName = `${cleanBaseName}_${Date.now()}${fileExt}`;

    const blobToken = getVercelBlobToken();

    // 1. 若環境變數包含 Vercel Blob Token
    if (blobToken) {
      const blob = await put(uniqueFileName, file, {
        access: 'public',
        token: blobToken,
      });
      return NextResponse.json({
        ok: true,
        url: blob.url,
        fileName: uniqueFileName,
      });
    }

    // 若在 Vercel 生態系運作但未連結 Blob Store，給予明確提示
    if (process.env.VERCEL) {
      const presentKeys = Object.keys(process.env).filter(
        k => k.includes('BLOB') || k.includes('STORE') || k.includes('TOKEN') || k.startsWith('sec_')
      );
      return NextResponse.json({
        ok: false,
        error: `圖片上傳失敗：未找到有效的 Vercel Blob Token (以 vercel_blob_rw_ 開頭)。請確認 Settings -> Environment Variables 存有名為 BLOB_READ_WRITE_TOKEN 的變數。目前檢測到的相關變數名稱為: [${presentKeys.join(', ')}]`,
      }, { status: 400 });
    }

    // 2. 本機開發降級方案：儲存於 public/uploads
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, uniqueFileName);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      ok: true,
      url: `/uploads/${uniqueFileName}`,
      fileName: uniqueFileName,
    });
  } catch (error: unknown) {
    console.error('File upload error:', error);
    const errorMessage = error instanceof Error ? error.message : '圖片上傳失敗';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}


