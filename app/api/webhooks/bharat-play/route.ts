import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Helper for CORS response headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-org-id',
  };
}

// Handle preflight OPTIONS request from external website
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validate required fields
    const fullName = (body.fullName || body.name || body.full_name || '').trim();
    const email = (body.email || body.email_id || '').trim();
    const phone = (body.phone || body.phone_number || body.mobile || '').trim();

    if (!fullName && !email && !phone) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide at least a name, email, or phone number for the registration.',
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    const supabase = createAdminClient();

    // 2. Resolve Organization ID (header, body, slug, or default first org)
    const { searchParams } = new URL(request.url);
    let targetOrgId =
      body.organizationId ||
      body.org_id ||
      request.headers.get('x-org-id') ||
      searchParams.get('org_id');

    if (!targetOrgId && (body.orgSlug || body.org_slug || searchParams.get('org_slug'))) {
      const slug = body.orgSlug || body.org_slug || searchParams.get('org_slug');
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .single();
      if (org) targetOrgId = org.id;
    }

    if (!targetOrgId) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1);

      if (orgs && orgs.length > 0) {
        targetOrgId = orgs[0].id;
      }
    }

    if (!targetOrgId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No organization found to assign this lead to. Please create a workspace first.',
        },
        { status: 404, headers: corsHeaders() }
      );
    }

    // 3. Normalize Name
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || 'Bharat Play Guest';
    const lastName = nameParts.slice(1).join(' ') || '';

    // 4. Normalize details
    const members = body.members || body.members_count || body.group_size || '1 (Solo)';
    const slot = body.slot || body.time_slot || body.chosen_slot || '10:00 AM – 1:00 PM';
    const rawAmount = body.totalPayable || body.amount || body.payable_amount || 649;
    const numericValue =
      typeof rawAmount === 'number'
        ? rawAmount
        : parseFloat(String(rawAmount).replace(/[^0-9.]/g, '')) || 649;

    const transactionId = body.transactionId || body.utr || body.upi_ref || body.upiRef || null;
    const screenshotUrl = body.paymentScreenshot || body.screenshot_url || null;

    const leadTitle = `Bharat Play: ${fullName || firstName} (${members} · ${slot})`;

    // 5. Insert Lead into CRM
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        organization_id: targetOrgId,
        title: leadTitle,
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        company: 'Bharat Play',
        source: 'Event',
        status: 'New',
        priority: 'High',
        value: numericValue,
      })
      .select()
      .single();

    if (leadError) {
      console.error('Failed to insert lead:', leadError);
      return NextResponse.json(
        { success: false, error: leadError.message },
        { status: 500, headers: corsHeaders() }
      );
    }

    // 6. Create or update permanent Contact record
    const registrationNotes = [
      `Bharat Play Reservation Details:`,
      `• Members/Group Size: ${members}`,
      `• Chosen Slot: ${slot}`,
      `• Total Amount: ₹${numericValue}`,
      transactionId ? `• UPI Transaction / UTR: ${transactionId}` : null,
      screenshotUrl ? `• Payment Screenshot: ${screenshotUrl}` : null,
      `• Source: Bharat Play Registration Form`,
      `• Registered: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`,
    ]
      .filter(Boolean)
      .join('\n');

    const { data: contact } = await supabase
      .from('contacts')
      .insert({
        organization_id: targetOrgId,
        first_name: firstName,
        last_name: lastName || '-',
        email: email || null,
        phone: phone || null,
        company_name: 'Bharat Play',
        status: 'customer',
        notes: registrationNotes,
      })
      .select()
      .single();

    // Link contact to lead if created
    if (contact && lead) {
      await supabase
        .from('leads')
        .update({ converted_contact_id: contact.id })
        .eq('id', lead.id);
    }

    // 7. Log Activity in CRM Feed
    await supabase.from('activities').insert({
      organization_id: targetOrgId,
      type: 'meeting',
      title: `Event Booking: ${fullName || firstName}`,
      description: `Registered for Bharat Play. ${members} in group. Slot: ${slot}. Total Paid: ₹${numericValue}.`,
      related_type: 'lead',
      related_id: lead.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Bharat Play registration synced successfully to Niral CRM',
        lead: {
          id: lead.id,
          title: lead.title,
          status: lead.status,
          value: lead.value,
        },
        contactId: contact?.id || null,
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('Bharat Play webhook error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

