import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-change-me'
);

// Routes that don't require authentication
const publicRoutes = [
    '/login',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/callback',
    '/api/persist', // POST only (XSS payload polling) - GET/PUT protected in route
];

// Routes that should be completely public (no redirect)
const publicApiRoutes = [
    '/api/callback',
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public API routes
    if (publicApiRoutes.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Root path serves XSS payload - public
    if (pathname === '/') {
        return NextResponse.next();
    }

    // Allow public routes
    if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
        return NextResponse.next();
    }

    // Allow static files and Next.js internals
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Check for session cookie
    const token = request.cookies.get('nexss_session')?.value;

    if (!token) {
        // No token - redirect to login for pages, return 401 for API
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verify JWT token
    try {
        await jwtVerify(token, JWT_SECRET);
        return NextResponse.next();
    } catch {
        // Invalid token - clear cookie and redirect
        const response = pathname.startsWith('/api/')
            ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            : NextResponse.redirect(new URL('/login', request.url));
        
        response.cookies.set('nexss_session', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/',
        });
        
        return response;
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
