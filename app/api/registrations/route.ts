import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { isBharatPlay } from '../../../lib/permissions';

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
 * GET /api/registrations?orgId=<orgId>
 * Strictly multi-tenant:
 * 1. Verifies the user is authenticated.
 * 2. Verifies the user is an APPROVED member of the requested organization in organization_members.
 * 3. Returns ONLY the registrations for that specific organization.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in to view registrations.' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { searchParams } = new URL(request.url);
    let targetOrgId = searchParams.get('orgId') || searchParams.get('org_id');

    // If no orgId is passed, resolve the user's active membership or Bharat Play if they are a member
    if (!targetOrgId) {
      const { data: userMembership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();

      targetOrgId = userMembership?.organization_id || null;
    }

    if (!targetOrgId) {
      return NextResponse.json(
        { success: false, error: 'No organization specified or active membership found.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Strict multi-tenant authorization check:
    // Does the authenticated user have an approved membership in this specific organization?
    const { data: membership, error: memberErr } = await supabase
      .from('organization_members')
      .select('role, status')
      .eq('organization_id', targetOrgId)
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (memberErr || !membership) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: You are not an approved member of this organization.',
        },
        { status: 403, headers: corsHeaders() }
      );
    }

    // Verify target organization is Bharat Play (registrations module is exclusive to Bharat Play)
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', targetOrgId)
      .maybeSingle();

    if (!isBharatPlay(orgData)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Registrations are only available for Bharat Play.',
          registrations: [],
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Query registrations strictly for targetOrgId
    const { data, error } = await supabase
      .from('leads')
      .select('*, contact:converted_contact_id(notes)')
      .eq('organization_id', targetOrgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to query registrations for org:', targetOrgId, error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        organizationId: targetOrgId,
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
 * DELETE /api/registrations?id=<leadId>&orgId=<orgId>
 * Strictly multi-tenant & RBAC:
 * 1. Verifies the user is authenticated.
 * 2. Verifies the user is an Owner, Admin, or Manager in the organization.
 * 3. Verifies the lead actually belongs to this organization before deleting.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in to delete registrations.' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const orgId = searchParams.get('orgId') || searchParams.get('org_id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing registration ID' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // 1. Fetch lead to confirm its organization
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, organization_id, converted_contact_id')
      .eq('id', id)
      .maybeSingle();

    if (leadErr || !lead) {
      return NextResponse.json(
        { success: false, error: 'Registration record not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const targetOrgId = orgId || lead.organization_id;

    // 2. Strict RBAC: Check that user has an approved Owner, Admin, or Manager role in this organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role, status')
      .eq('organization_id', targetOrgId)
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (
      !membership ||
      !['Owner', 'Admin', 'Manager'].includes(membership.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Only Owners, Admins, and Managers of this organization can delete registrations.',
        },
        { status: 403, headers: corsHeaders() }
      );
    }

    // 3. Delete lead using the authenticated client (adhering to RLS) or admin client
    const { error: deleteErr } = await supabase.from('leads').delete().eq('id', id);

    if (deleteErr) {
      return NextResponse.json(
        { success: false, error: deleteErr.message },
        { status: 500, headers: corsHeaders() }
      );
    }

    // Delete linked contact if present
    if (lead.converted_contact_id) {
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
