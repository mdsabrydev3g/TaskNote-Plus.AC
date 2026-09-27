import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected app surface.
  if (pathname.startsWith('/app')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const claims = token ? await verifySessionToken(token) : null;
    if (!claims) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next();
  response.headers.set('x-tasknote-plus', '1');
  return response;
}

export const config = {
  matcher: ['/app/:path*'],
};
