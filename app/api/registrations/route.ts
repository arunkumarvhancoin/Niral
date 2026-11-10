import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '../../../lib/supabase/admin';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/registrations
 * Returns all Bharat Play workshop registrations using server-side admin client.
 * Completely immune to client-side RLS membership restrictions.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Resolve Bharat Play organization
    const { data: bharatPlayOrg } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', 'bharat-play')
      .maybeSingle();

    const orgId = bharatPlayOrg?.id;

    // 2. Query all leads for Bharat Play with linked contact notes
    let query = supabase
      .from('leads')
      .select('*, contact:converted_contact_id(notes)')
      .order('created_at', { ascending: false });

    if (orgId) {
      query = query.or(`organization_id.eq.${orgId},company.eq.Bharat Play,title.ilike.Bharat Play%`);
    } else {
      query = query.or(`company.eq.Bharat Play,title.ilike.Bharat Play%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to query registrations:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        registrations: data || [],
      },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('API /api/registrations error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * DELETE /api/registrations?id=<leadId>
 * Deletes a registration record and its associated contact.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing registration ID' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const supabase = createAdminClient();

    // Check if lead has linked contact
    const { data: lead } = await supabase
      .from('leads')
      .select('id, converted_contact_id')
      .eq('id', id)
      .maybeSingle();

    const { error: deleteErr } = await supabase.from('leads').delete().eq('id', id);

    if (deleteErr) {
      return NextResponse.json(
        { success: false, error: deleteErr.message },
        { status: 500, headers: corsHeaders() }
      );
    }

    // Delete linked contact if present
    if (lead?.converted_contact_id) {
      await supabase.from('contacts').delete().eq('id', lead.converted_contact_id);
    }

    return NextResponse.json(
      { success: true, message: 'Registration deleted successfully' },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete registration' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
