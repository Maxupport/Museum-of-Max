import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權的造訪' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { company, role, period, description, order } = body;

    const updated = await prisma.careerItem.update({
      where: { id },
      data: {
        ...(company && { company: company.trim() }),
        ...(role && { role: role.trim() }),
        ...(period && { period: period.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(order !== undefined && { order: Number(order) }),
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: unknown) {
    console.error('Update career item error:', error);
    const errorMessage = error instanceof Error ? error.message : '更新職涯經歷失敗';
    return NextResponse.json({ ok: false, error: `更新職涯經歷失敗 (${errorMessage})` }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權的造訪' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.careerItem.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Delete career item error:', error);
    const errorMessage = error instanceof Error ? error.message : '刪除職涯經歷失敗';
    return NextResponse.json({ ok: false, error: `刪除職涯經歷失敗 (${errorMessage})` }, { status: 500 });
  }
}
