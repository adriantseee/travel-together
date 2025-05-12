import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  console.log('Middleware executing for path:', req.nextUrl.pathname);
  
  const res = NextResponse.next();
  
  try {
    const supabase = createServerClient(
      "https://ofobfrdjurcwmesowslm.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mb2JmcmRqdXJjd21lc293c2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNTE3ODksImV4cCI6MjA2MjYyNzc4OX0.QBGKzglKyHa6lbiZiwaFqnYMys27mcqleqVpE-3MSe8",
      {
        cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => {
            res.cookies.set({ name, value, ...options });
          },
          remove: (name, options) => {
            res.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    console.log('Session in middleware:', session ? 'exists' : 'null');

    // We'll temporarily disable the redirects to troubleshoot
    /*
    // If user is not signed in and the current path is not /login or /register,
    // redirect the user to /login
    if (!session && req.nextUrl.pathname !== '/login' && req.nextUrl.pathname !== '/register') {
      const redirectUrl = new URL('/login', req.url);
      console.log('Redirecting to login');
      return NextResponse.redirect(redirectUrl);
    }
    
    // If user is signed in and the current path is /login or /register,
    // redirect the user to /dashboard
    if (session && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register')) {
      const redirectUrl = new URL('/dashboard', req.url);
      console.log('Redirecting to dashboard');
      return NextResponse.redirect(redirectUrl);
    }
    */
  } catch (error) {
    console.error('Middleware error:', error);
  }
  
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 