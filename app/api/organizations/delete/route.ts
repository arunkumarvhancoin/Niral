import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { isSuperAdmin, isBharatPlay } from '../../../../lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const orgId = body?.orgId;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required.' },
        { status: 400 }
      );
    }

    // 1. Authenticate user session
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in to delete this organization.' },
        { status: 401 }
      );
    }

    // 2. Fetch the organization to confirm it exists and check if protected
    const { data: org, error: orgFetchErr } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', orgId)
      .maybeSingle();

    if (orgFetchErr || !org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found or already deleted.' },
        { status: 404 }
      );
    }

    // Protect Bharat Play core platform workspace
    if (isBharatPlay(org)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bharat Play is a protected core platform organization workspace and cannot be deleted.',
        },
        { status: 403 }
      );
    }

    // 3. Verify user's permission (must be Owner or Super Admin)
    const isSuper = isSuperAdmin(user.email);
    if (!isSuper) {
      const { data: membership, error: memErr } = await supabase
        .from('organization_members')
        .select('role, status')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (memErr || !membership || membership.role !== 'Owner' || membership.status !== 'approved') {
        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden: Only the Organization Owner or a Super Admin can delete this organization.',
          },
          { status: 403 }
        );
      }
    }

    // 4. Delete organization and all linked entities
    let dbClient = supabase;
    try {
      dbClient = createAdminClient() as any;
    } catch {
      dbClient = supabase;
    }

    // Delete in reverse foreign key order to prevent constraint violation
    await dbClient.from('notifications').delete().eq('organization_id', orgId);
    await dbClient.from('activities').delete().eq('organization_id', orgId);
    await dbClient.from('tasks').delete().eq('organization_id', orgId);
    await dbClient.from('deals').delete().eq('organization_id', orgId);
    await dbClient.from('leads').delete().eq('organization_id', orgId);
    await dbClient.from('contacts').delete().eq('organization_id', orgId);
    await dbClient.from('pipeline_stages').delete().eq('organization_id', orgId);
    await dbClient.from('pipelines').delete().eq('organization_id', orgId);
    await dbClient.from('organization_join_requests').delete().eq('organization_id', orgId);
    await dbClient.from('organization_invitations').delete().eq('organization_id', orgId);
    await dbClient.from('organization_members').delete().eq('organization_id', orgId);

    const { error: deleteOrgErr } = await dbClient.from('organizations').delete().eq('id', orgId);

    if (deleteOrgErr) {
      throw new Error(deleteOrgErr.message || 'Failed to delete organization record.');
    }

    return NextResponse.json({
      success: true,
      message: `Organization "${org.name}" has been permanently deleted.`,
    });
  } catch (err: any) {
    console.error('Error deleting organization:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete organization.' },
      { status: 500 }
    );
  }
}
