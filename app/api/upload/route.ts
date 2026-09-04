import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { validateAdminRequest } from '@/lib/auth';
import { put } from '@vercel/blob';

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

    // 1. 若環境變數包含 Vercel Blob Token (在 Vercel 啟用 Blob 後會自動注入 BLOB_READ_WRITE_TOKEN)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(uniqueFileName, file, {
        access: 'public',
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
        error: '圖片上傳失敗：未連結 Vercel Blob。請至 Vercel Dashboard -> Storage -> Blob 點擊「Connect to Project」將 Blob 連結至此專案。',
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


