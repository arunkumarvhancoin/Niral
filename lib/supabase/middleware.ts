import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

    // If variables are missing, malformed, or default placeholders, safely bypass middleware
    if (
      !supabaseUrl ||
      !supabaseKey ||
      !supabaseUrl.startsWith('http') ||
      supabaseUrl.includes('your-project') ||
      supabaseKey.includes('your-anon-key')
    ) {
      return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user ?? null;
    } catch {
      // Supabase auth service unreachable or invalid session token
      user = null;
    }

    const isAuthPage =
      request.nextUrl.pathname.startsWith('/auth') ||
      request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/register' ||
      request.nextUrl.pathname === '/forgot-password' ||
      request.nextUrl.pathname.startsWith('/invite');

    if (
      !user &&
      !isAuthPage &&
      !request.nextUrl.pathname.startsWith('/_next') &&
      request.nextUrl.pathname !== '/'
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }
  } catch (err) {
    console.error('Error in updateSession middleware:', err);
  }

  return supabaseResponse;
}
