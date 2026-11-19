import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabase = await createClient();

    let data: any = null;
    let error: any = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName?.trim() || cleanEmail,
            },
          },
        });
        data = res.data;
        error = res.error;
        break;
      } catch (networkErr: any) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        throw networkErr;
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: 'Account created successfully!',
    });
  } catch (err: any) {
    console.error('Server signup error:', err);
    const isNetworkError =
      err?.message?.includes('fetch failed') ||
      err?.name === 'TypeError' ||
      err?.code === 'ECONNRESET' ||
      err?.code === 'ETIMEDOUT';

    return NextResponse.json(
      {
        error: isNetworkError
          ? 'Network timeout connecting to authentication server.'
          : err.message || 'Internal server error during account creation.',
        isNetworkError,
      },
      { status: isNetworkError ? 503 : 500 }
    );
  }
}

