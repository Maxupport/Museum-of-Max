import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parsePermissions, generateAdminToken } from '@/lib/auth';
import { ALL_EXHIBIT_KEYS } from '@/lib/constants';

const PRESET_PASSCODES: Record<string, { id: string; code: string; note: string; permissions: string[] }> = {
  vc: {
    id: 'preset-vc',
    code: 'VC',
    note: '我想了解 Max 有什麼專業。 (新創風投、商業議題分析、職涯履歷)',
    permissions: ['vc', 'finance_insurance', 'career'],
  },
  nvc: {
    id: 'preset-nvc',
    code: 'NVC',
    note: '我想了解 Max 除了專業還會什麼！ (聲音探索、創作 Lab、人生擺渡)',
    permissions: ['sound', 'creation_lab', 'communication'],
  },
  max: {
    id: 'preset-max',
    code: 'Max',
    note: '我想知道 Max 創作過什麼 (創作 Lab、聲音探索)',
    permissions: ['creation_lab', 'sound'],
  },
  vvip: {
    id: 'preset-vvip',
    code: 'VVIP',
    note: '我想知道 Max 的所有事情！ (VVIP 全站展區通行證)',
    permissions: ['vc', 'career', 'finance_insurance', 'sound', 'creation_lab', 'communication'],
  },
  series: {
    id: 'preset-series',
    code: 'Series',
    note: '我想看連載故事！ (創作 Lab 小說連載直通門票)',
    permissions: ['creation_lab_novel'],
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passcode } = body;

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json({ ok: false, error: '請輸入通行密碼' }, { status: 400 });
    }

    const trimmedCode = passcode.trim().toLowerCase();

    const allPasscodes = await prisma.passcode.findMany();
    let found = allPasscodes.find((p) => p.code.trim().toLowerCase() === trimmedCode);

    if (!found && PRESET_PASSCODES[trimmedCode]) {
      const preset = PRESET_PASSCODES[trimmedCode];
      found = {
        id: preset.id,
        code: preset.code,
        note: preset.note,
        permissions: JSON.stringify(preset.permissions),
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    if (!found) {
      return NextResponse.json({ ok: false, error: '通行密碼無效，請確認後重試' }, { status: 401 });
    }

    const permissions = parsePermissions(found.permissions);

    // Check if passcode ONLY grants access to novel serialization (no other galleries)
    const isNovelOnlyDirect = (permissions.length === 1 && permissions[0] === 'creation_lab_novel') ||
      (permissions.includes('creation_lab_novel') && 
       !permissions.includes('vc') && 
       !permissions.includes('career') && 
       !permissions.includes('finance_insurance') && 
       !permissions.includes('sound') && 
       !permissions.includes('communication'));

    const hasNovelPermission = permissions.includes('creation_lab_novel') || 
      (found.note && (found.note.includes('小說') || found.note.includes('連載')));

    // Ensure creation_lab is granted if creation_lab_novel is present
    const activePermissions = (hasNovelPermission && !permissions.includes('creation_lab')) 
      ? [...permissions, 'creation_lab']
      : permissions;

    // All passcodes except novel-only passcodes start at Main Hall (/museum)
    const redirectUrl = isNovelOnlyDirect ? '/museum/creation_lab' : '/museum';

    const response = NextResponse.json({
      ok: true,
      permissions: activePermissions,
      redirectUrl,
      note: found.note,
      avatarUrl: found.avatarUrl,
    });

    // Store visitor token and permissions in HTTP-only cookies
    response.cookies.set('visitor_token', found.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    });

    response.cookies.set('visitor_permissions', JSON.stringify(activePermissions), {
      httpOnly: false, // Accessible in JS if needed or read server side
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });

    if (found.avatarUrl) {
      response.cookies.set('visitor_avatar_url', found.avatarUrl, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
    } else {
      response.cookies.set('visitor_avatar_url', '', { path: '/', maxAge: 0 });
    }

    const isCuratorPasscode = Boolean(found.note && (found.note.toLowerCase().includes('curator') || found.note.includes('策展人') || found.note.includes('管理員')));

    if (isCuratorPasscode) {
      const adminToken = generateAdminToken();
      response.cookies.set('admin_token', adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
      response.cookies.set('is_curator', 'true', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
    } else {
      // Clear any previous curator/admin cookies so visitor test is 100% clean
      response.cookies.set('is_curator', '', { path: '/', maxAge: 0 });
      response.cookies.set('admin_token', '', { path: '/', maxAge: 0 });
    }

    return response;
  } catch (error) {
    console.error('Visitor Auth Error:', error);
    return NextResponse.json({ ok: false, error: '伺服器內部錯誤' }, { status: 500 });
  }
}
