-- =====================================================================
-- NEXTGEN MULTI-TENANT CRM PLATFORM - PRODUCTION REAL DATA SEED SCRIPT
-- Execute this script in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================================

-- Step 1: Ensure Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Clean slate (Optional - uncomment if you want to reset demo data)
-- TRUNCATE TABLE public.notifications, public.activities, public.tasks, public.deals, public.leads, public.contacts, public.pipeline_stages, public.pipelines, public.organization_join_requests, public.organization_invitations, public.organization_members, public.organizations CASCADE;

-- Step 3: Insert Real Organizations
-- Company 1: Apex Cloud Technologies
INSERT INTO public.organizations (
    id,
    name,
    slug,
    logo_url,
    industry,
    company_size,
    website,
    description
) VALUES (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Apex Cloud Technologies',
    'apex-cloud',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160&auto=format&fit=crop&q=80',
    'Enterprise Cloud & Cyber Security',
    '50-200 employees',
    'https://apexcloud.io',
    'High-reliability multi-region Kubernetes orchestration and Zero-Trust cloud network architecture.'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    industry = EXCLUDED.industry,
    website = EXCLUDED.website;

-- Company 2: Meridian Life Sciences
INSERT INTO public.organizations (
    id,
    name,
    slug,
    logo_url,
    industry,
    company_size,
    website,
    description
) VALUES (
    'b2c3d4e5-0002-4000-8000-000000000002',
    'Meridian Life Sciences',
    'meridian-bio',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=160&auto=format&fit=crop&q=80',
    'Biotechnology & Genomic Medicine',
    '20-50 employees',
    'https://meridianlifesci.com',
    'Next-generation RNA sequencing platforms and AI-guided molecular oncology diagnostics.'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    industry = EXCLUDED.industry,
    website = EXCLUDED.website;

-- Company 3: Nova Vanguard Financial
INSERT INTO public.organizations (
    id,
    name,
    slug,
    logo_url,
    industry,
    company_size,
    website,
    description
) VALUES (
    'c3d4e5f6-0003-4000-8000-000000000003',
    'Nova Vanguard Financial',
    'nova-vanguard',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=160&auto=format&fit=crop&q=80',
    'Fintech & Institutional Capital',
    '200-1000 employees',
    'https://novavanguard.capital',
    'Automated algorithmic trading gateways, quantitative risk engine, and prime liquidity.'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    industry = EXCLUDED.industry,
    website = EXCLUDED.website;

-- Step 4: Sales Pipelines & Pipeline Stages
-- Apex Pipeline
INSERT INTO public.pipelines (id, organization_id, name, is_default)
VALUES ('p1111111-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Enterprise Sales Pipeline', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pipeline_stages (id, organization_id, pipeline_id, name, order_index, probability, color)
VALUES 
    ('s101-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'p1111111-0001-4000-8000-000000000001', 'Discovery & Qualification', 0, 20, '#3b82f6'),
    ('s102-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'p1111111-0001-4000-8000-000000000001', 'Technical Evaluation (POC)', 1, 45, '#8b5cf6'),
    ('s103-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'p1111111-0001-4000-8000-000000000001', 'Security & Legal Review', 2, 75, '#f59e0b'),
    ('s104-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'p1111111-0001-4000-8000-000000000001', 'Closed Won', 3, 100, '#10b981')
ON CONFLICT (id) DO NOTHING;

-- Meridian Pipeline
INSERT INTO public.pipelines (id, organization_id, name, is_default)
VALUES ('p2222222-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'Clinical Diagnostics Pipeline', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pipeline_stages (id, organization_id, pipeline_id, name, order_index, probability, color)
VALUES 
    ('s201-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'p2222222-0002-4000-8000-000000000002', 'Assay Validation Study', 0, 25, '#06b6d4'),
    ('s202-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'p2222222-0002-4000-8000-000000000002', 'IRB Ethics Approval', 1, 60, '#3b82f6'),
    ('s203-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'p2222222-0002-4000-8000-000000000002', 'Hospital Procurement', 2, 85, '#f59e0b'),
    ('s204-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'p2222222-0002-4000-8000-000000000002', 'Closed Contract Signed', 3, 100, '#10b981')
ON CONFLICT (id) DO NOTHING;

-- Step 5: Real Contacts for Apex Cloud
INSERT INTO public.contacts (id, organization_id, first_name, last_name, email, phone, job_title, company_name, status, notes)
VALUES
    ('c101-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Elena', 'Rostova', 'elena.rostova@datadrive-systems.com', '+1 (415) 890-2341', 'VP of Cloud Infrastructure', 'DataDrive Systems Corp', 'customer', 'Key executive sponsor for US-East cluster migration.'),
    ('c102-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Marcus', 'Sterling', 'msterling@hyperion-networks.io', '+1 (650) 412-9908', 'Chief Information Security Officer', 'Hyperion Networks', 'customer', 'Requires SOC2 Type II report and zero-trust perimeter audit.'),
    ('c103-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'David', 'Kowalski', 'dkowalski@quantum-scale.net', '+1 (206) 554-1823', 'Director of Engineering', 'QuantumScale Labs', 'lead', 'Interested in auto-scaling observability pipeline.')
ON CONFLICT (id) DO NOTHING;

-- Real Contacts for Meridian Life Sciences
INSERT INTO public.contacts (id, organization_id, first_name, last_name, email, phone, job_title, company_name, status, notes)
VALUES
    ('c201-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'Dr. Aris', 'Thorne', 'athorne@stanford-genomics.edu', '+1 (415) 329-8812', 'Chair of Molecular Pathology', 'Stanford Medical Center', 'customer', 'Leading the pediatric rare-variant clinical trial.'),
    ('c202-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'Beatrice', 'Vance', 'bvance@novabiotech-partners.com', '+1 (617) 948-2201', 'VP of Clinical Operations', 'NovaBio Partners', 'partner', 'Evaluating companion diagnostics for Phase II breast cancer therapy.')
ON CONFLICT (id) DO NOTHING;

-- Step 6: Real Leads
INSERT INTO public.leads (id, organization_id, title, first_name, last_name, email, phone, company, source, status, priority, value)
VALUES
    ('l101-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Global Multi-Region Disaster Recovery RFP', 'Julian', 'Mercer', 'jmercer@synthex-cloud.com', '+1 (408) 723-1190', 'Synthex Cloud Holding', 'Inbound', 'Qualified', 'High', 185000.00),
    ('l102-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Kubernetes Security Gatekeeper Deployment', 'Sophia', 'Chen', 'schen@fintech-vault.org', '+1 (212) 674-8890', 'FintechVault Group', 'Referral', 'Contacted', 'Urgent', 92000.00),
    ('l201-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'NextGen Liquid Biopsy Screening Trial', 'Dr. Christian', 'Troy', 'ctroy@miami-oncology.org', '+1 (305) 881-2244', 'Miami Oncology Institute', 'Event', 'Qualified', 'Urgent', 145000.00)
ON CONFLICT (id) DO NOTHING;

-- Step 7: Real Opportunity Deals
INSERT INTO public.deals (id, organization_id, pipeline_id, stage_id, contact_id, title, value, expected_close_date, status)
VALUES
    ('d101-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'p1111111-0001-4000-8000-000000000001', 's103-0001-4000-8000-000000000001', 'c101-0001-4000-8000-000000000001', 'DataDrive Multi-Cluster Enterprise Architecture', 175000.00, '2026-12-15', 'open'),
    ('d102-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'p1111111-0001-4000-8000-000000000001', 's104-0001-4000-8000-000000000001', 'c102-0001-4000-8000-000000000001', 'Hyperion Zero-Trust Infrastructure Expansion', 110000.00, '2026-10-28', 'won'),
    ('d201-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'p2222222-0002-4000-8000-000000000002', 's203-0002-4000-8000-000000000002', 'c201-0002-4000-8000-000000000002', 'Stanford Pediatric Pathology NGS Sequencing Batch', 145000.00, '2026-11-30', 'open')
ON CONFLICT (id) DO NOTHING;

-- Step 8: Real Tasks
INSERT INTO public.tasks (id, organization_id, title, description, due_date, priority, status, related_type, related_id)
VALUES
    ('t101-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Submit SOC2 Type II Compliance & Cloud Architecture Packet', 'Deliver detailed technical documentation for DataDrive security committee review.', (NOW() + interval '3 days'), 'urgent', 'in_progress', 'deal', 'd101-0001-4000-8000-000000000001'),
    ('t102-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Schedule Kubernetes Failover Simulation Demonstration', 'Demonstrate 99.999% uptime active-active traffic switching to Hyperion leadership.', (NOW() + interval '7 days'), 'high', 'todo', 'deal', 'd102-0001-4000-8000-000000000001'),
    ('t201-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'Finalize FDA 510(k) Pre-Market Notification Submission', 'Coordinate clinical validation data with Stanford regulatory compliance officer.', (NOW() + interval '4 days'), 'urgent', 'todo', 'deal', 'd201-0002-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Step 9: Real Audit Activities
INSERT INTO public.activities (id, organization_id, type, title, description, related_type, related_id, created_at)
VALUES
    ('act101-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'meeting', 'Executive Architecture Review Meeting', 'Completed deep-dive with VP of Infrastructure Elena Rostova. Approved 3-region topology.', 'contact', 'c101-0001-4000-8000-000000000001', (NOW() - interval '1 day')),
    ('act102-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'call', 'Security Agreement & SLA Finalization Call', 'Confirmed 15-minute P1 incident response SLA and zero-trust identity federation.', 'deal', 'd101-0001-4000-8000-000000000001', (NOW() - interval '2 days')),
    ('act201-0002-4000-8000-000000000002', 'b2c3d4e5-0002-4000-8000-000000000002', 'meeting', 'Pathology Lab Protocol Alignment', 'Reviewed specimen handling procedures and cold-chain logistics for genomic sequencing assay.', 'deal', 'd201-0002-4000-8000-000000000002', (NOW() - interval '3 days'))
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- STEP 10: AUTO-ASSIGN YOUR CURRENT AUTHENTICATED USER TO ALL 3 COMPANIES
-- (Run this snippet after you sign up in the UI with your email)
-- Replace 'YOUR_USER_ID_OR_EMAIL' with your email or ID, or run:
-- =====================================================================
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Automatically picks the first registered user in auth.users
    SELECT id INTO target_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    
    IF target_user_id IS NOT NULL THEN
        -- Link as Owner in Apex Cloud Technologies
        INSERT INTO public.organization_members (user_id, organization_id, role, status, joined_at)
        VALUES (target_user_id, 'a1b2c3d4-0001-4000-8000-000000000001', 'Owner', 'approved', NOW())
        ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'Owner', status = 'approved';

        -- Link as Manager in Meridian Life Sciences
        INSERT INTO public.organization_members (user_id, organization_id, role, status, joined_at)
        VALUES (target_user_id, 'b2c3d4e5-0002-4000-8000-000000000002', 'Manager', 'approved', NOW())
        ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'Manager', status = 'approved';

        -- Link as Admin in Nova Vanguard Financial
        INSERT INTO public.organization_members (user_id, organization_id, role, status, joined_at)
        VALUES (target_user_id, 'c3d4e5f6-0003-4000-8000-000000000003', 'Admin', 'approved', NOW())
        ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'Admin', status = 'approved';

        RAISE NOTICE 'Successfully assigned user % to all 3 seeded enterprise workspaces!', target_user_id;
    ELSE
        RAISE NOTICE 'No user found in auth.users yet. Create an account via /auth/register then re-run Step 10.';
    END IF;
END $$;

