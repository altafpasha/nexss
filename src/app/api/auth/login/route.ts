import { NextRequest, NextResponse } from 'next/server';
import { login, logAction } from '@/lib/auth';
import { getClientIP } from '@/lib/utils';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password required' },
                { status: 400 }
            );
        }

        const ip = getClientIP(request);
        const userAgent = request.headers.get('user-agent') || '';

        const result = await login(username, password, ip, userAgent);

        if (!result) {
            await logAction(null, 'login_failed', `Failed login attempt for: ${username}`, ip);
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        await logAction(result.user.id, 'login', 'User logged in', ip);

        // Create response with cookie
        const response = NextResponse.json({
            success: true,
            user: {
                id: result.user.id,
                username: result.user.username,
                email: result.user.email,
                rank: result.user.rank,
            },
        });

        // Set HTTP-only cookie for session
        response.cookies.set('nexss_session', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('[Auth] Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
