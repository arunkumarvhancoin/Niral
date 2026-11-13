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

/**
 * Helper to strictly find or auto-create the Bharat Play organization.
 * Guarantees that leads from this webhook ONLY enter the Bharat Play workspace.
 */
async function getBharatPlayOrganization(
  supabase: ReturnType<typeof createAdminClient>,
  requestedOrgId?: string | null
) {
  // 1. If explicit organizationId passed, check if it matches Bharat Play
  if (requestedOrgId) {
    const { data: orgById } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', requestedOrgId)
      .single();

    if (orgById) {
      return orgById;
    }
  }

  // 2. Look up strictly by slug 'bharat-play'
  const { data: orgBySlug } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', 'bharat-play')
    .maybeSingle();

  if (orgBySlug) {
    return orgBySlug;
  }

  // 3. Look up by case-insensitive name 'Bharat Play'
  const { data: orgByName } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .ilike('name', '%Bharat Play%')
    .maybeSingle();

  if (orgByName) {
    return orgByName;
  }

  // 4. Auto-create the Bharat Play organization if not yet created
  const { data: createdOrg, error: createErr } = await supabase
    .from('organizations')
    .insert({
      name: 'Bharat Play',
      slug: 'bharat-play',
      industry: 'Events & Entertainment',
      company_size: '1-10 employees',
      description: 'Bharat Play workshop registrations, gaming events, and attendee pipeline.',
    })
    .select('id, name, slug')
    .single();

  if (createErr) {
    console.error('Failed to auto-create Bharat Play organization:', createErr);
    throw new Error(`Unable to initialize Bharat Play organization: ${createErr.message}`);
  }

  return createdOrg;
}

/**
 * GET /api/webhooks/bharat-play
 * Returns status and the exact Organization ID for Bharat Play.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const bharatPlayOrg = await getBharatPlayOrganization(supabase);

    return NextResponse.json(
      {
        status: 'active',
        service: 'Bharat Play CRM Ingestion Webhook',
        organization: {
          id: bharatPlayOrg.id,
          name: bharatPlayOrg.name,
          slug: bharatPlayOrg.slug,
        },
        samplePayload: {
          fullName: 'John Doe',
          email: 'name@example.com',
          phone: '9876543210',
          members: '1 (Solo)',
          slot: '10:00 AM – 1:00 PM',
          totalPayable: 649,
          transactionId: 'UPI1234567890',
          paymentScreenshot: 'https://...',
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to inspect Bharat Play organization' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * POST /api/webhooks/bharat-play
 * Strictly ingests new leads and contacts into the Bharat Play organization.
 */
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

    // 2. Resolve Bharat Play Organization STRICTLY (never leaks to other organizations)
    const { searchParams } = new URL(request.url);
    const requestedOrgId =
      body.organizationId ||
      body.org_id ||
      request.headers.get('x-org-id') ||
      searchParams.get('org_id');

    const bharatPlayOrg = await getBharatPlayOrganization(supabase, requestedOrgId);
    const targetOrgId = bharatPlayOrg.id;

    // 3. Normalize Name
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || 'Bharat Play Guest';
    const lastName = nameParts.slice(1).join(' ') || '';

    // 4. Normalize registration fields
    const members = body.members || body.members_count || body.group_size || '1 (Solo)';
    const slot = body.slot || body.time_slot || body.chosen_slot || '10:00 AM – 1:00 PM';
    const rawAmount = body.totalPayable || body.amount || body.payable_amount || 649;
    const numericValue =
      typeof rawAmount === 'number'
        ? rawAmount
        : parseFloat(String(rawAmount).replace(/[^0-9.]/g, '')) || 649;

    const transactionId = body.transactionId || body.utr || body.upi_ref || body.upiRef || null;
    const screenshotUrl = body.paymentScreenshot || body.screenshot_url || body.paymentProof || null;

    // 5. Payment Status & Method detection
    const rawStatus = (body.paymentStatus || body.status || '').toUpperCase();
    const isPaid =
      rawStatus === 'PAID' ||
      body.source === 'Paid via Cashfree' ||
      (typeof body.notes === 'string' && body.notes.includes('PAYMENT STATUS: PAID'));

    const paymentStatus = isPaid ? 'PAID' : 'NOT PAID';
    const paymentMethod = body.paymentMethod || 'Cashfree';

    const leadTitle = `Bharat Play: ${fullName || firstName} (${members} · ${slot}) [${paymentStatus}]`;

    // 6. Check if lead already exists for this phone or email in Bharat Play to update/upgrade status
    // Only match existing lead if incoming status is PAID (to convert a pending unpaid lead from the same session),
    // otherwise new checkout submissions ALWAYS create a fresh lead so every registration attempt appears in the table.
    let existingLead: { id: string; converted_contact_id: string | null } | null = null;
    if (isPaid && (phone || email)) {
      const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from('leads')
        .select('id, converted_contact_id')
        .eq('organization_id', targetOrgId)
        .neq('status', 'Converted')
        .gte('created_at', past24Hours);

      if (phone && email) {
        query = query.or(`phone.eq.${phone},email.eq.${email}`);
      } else if (phone) {
        query = query.eq('phone', phone);
      } else if (email) {
        query = query.eq('email', email);
      }

      const { data: found } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      existingLead = found;
    }

    const registrationNotes = [
      `Bharat Play Reservation Details:`,
      `• Members/Group Size: ${members}`,
      `• Chosen Slot: ${slot}`,
      `• Total Amount: ₹${numericValue}`,
      `• Payment Status: ${paymentStatus}`,
      `• Payment Gateway / Method: ${paymentMethod}`,
      transactionId ? `• UPI Transaction / UTR: ${transactionId}` : null,
      screenshotUrl ? `• Payment Screenshot: ${screenshotUrl}` : null,
      `• Source: ${body.source || 'Bharat Play Checkout'}`,
      `• Registered: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`,
    ]
      .filter(Boolean)
      .join('\n');

    let finalLeadId: string;
    let finalContactId: string;

    if (existingLead) {
      finalLeadId = existingLead.id;
      finalContactId = existingLead.converted_contact_id || crypto.randomUUID();

      if (existingLead.converted_contact_id) {
        await supabase
          .from('contacts')
          .update({
            first_name: firstName,
            last_name: lastName || '-',
            email: email || undefined,
            phone: phone || undefined,
            notes: registrationNotes,
          })
          .eq('id', existingLead.converted_contact_id);
      }

      await supabase
        .from('leads')
        .update({
          title: leadTitle,
          value: numericValue,
          status: isPaid ? 'Converted' : 'New',
          created_at: new Date().toISOString(),
        })
        .eq('id', existingLead.id);
    } else {
      finalContactId = crypto.randomUUID();
      finalLeadId = crypto.randomUUID();

      await supabase.from('contacts').insert({
        id: finalContactId,
        organization_id: targetOrgId,
        first_name: firstName,
        last_name: lastName || '-',
        email: email || null,
        phone: phone || null,
        company_name: 'Bharat Play',
        status: isPaid ? 'customer' : 'lead',
        notes: registrationNotes,
      });

      const { error: leadError } = await supabase.from('leads').insert({
        id: finalLeadId,
        organization_id: targetOrgId,
        title: leadTitle,
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        company: 'Bharat Play',
        source: 'Event',
        status: isPaid ? 'Converted' : 'New',
        priority: 'High',
        value: numericValue,
        converted_contact_id: finalContactId,
      });

      if (leadError) {
        console.error('Failed to insert Bharat Play lead:', leadError);
        return NextResponse.json(
          { success: false, error: leadError.message },
          { status: 500, headers: corsHeaders() }
        );
      }
    }

    // 7. Log Activity in Bharat Play Activity Feed
    await supabase.from('activities').insert({
      organization_id: targetOrgId,
      type: 'note',
      title: `Event Booking [${paymentStatus}]: ${fullName || firstName}`,
      description: `Registered for Bharat Play. ${members} in group. Slot: ${slot}. Total: ₹${numericValue}. Payment Status: ${paymentStatus}.${
        screenshotUrl ? ' Payment Screenshot / Receipt Attached.' : ''
      }`,
      related_type: 'lead',
      related_id: finalLeadId,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Bharat Play registration synced successfully to Bharat Play workspace',
        organization: {
          id: bharatPlayOrg.id,
          name: bharatPlayOrg.name,
          slug: bharatPlayOrg.slug,
        },
        lead: {
          id: finalLeadId,
          title: leadTitle,
          status: isPaid ? 'Converted' : 'New',
          value: numericValue,
        },
        contactId: finalContactId,
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
