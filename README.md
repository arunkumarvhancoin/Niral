# NextGen Multi-Tenant SaaS CRM Platform

A modern, scalable, multi-tenant CRM platform built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS v3**, **Supabase Authentication**, **Supabase PostgreSQL & Row Level Security (RLS)**, and **Zustand**.

---
  
## Architecture & Tenant Isolation

### 1. Hybrid Organization Model 
- **Global User Identity**: Users register once with a unified global identity linked to Supabase Auth (`auth.users` & `profiles`). A single user account can belong to multiple companies with completely different roles.
- **Tenant Scoping**: Every organization-specific table (`contacts`, `leads`, `deals`, `pipelines`, `pipeline_stages`, `tasks`, `activities`, `notifications`, `organization_invitations`, `organization_join_requests`) contains `organization_id` foreign keys and composite indexes.
- **Database Row Level Security (RLS)**: Enforced via PostgreSQL policies and non-recursive `SECURITY DEFINER` functions (`is_org_member`, `has_org_role`, `get_user_org_role`). Pending, suspended, rejected, or revoked members are strictly barred from querying or modifying company CRM records.
- **Last Active Owner Protection**: A PostgreSQL database trigger (`trg_prevent_last_owner_removal`) prevents removing or demoting the last active `Owner` in any organization. 

### 2. Role-Based Access Control (RBAC)
Permissions are centralized in `lib/permissions.ts` and validated both server-side and by database RLS:

| Permission | Owner | Admin | Manager | Employee | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Delete Organization | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Organization Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Members & Roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve / Reject Join Requests | ✅ | ✅ | ❌ | ❌ | ❌ |
| Send & Manage Invitations | ✅ | ✅ | ❌ | ❌ | ❌ |
| Full CRM Management (Deals/Leads/Contacts) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create / Update Records & Tasks | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read-Only CRM Records | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Multi-Tenant Scenarios Verification (1–10)

The application includes an active persona bar in development mode allowing instant verification of all acceptance criteria:

1. **User A creates Company A**: User A is automatically assigned the `Owner` role with immediate workspace activation.
2. **User B creates Company B**: User B becomes the `Owner` of Company B.
3. **User A requests access to Company B**: User A navigates to `/onboarding?step=join`, finds Company B, and submits a membership request with an optional note.
4. **User B approves User A**: User B switches to Company B, opens `/team?tab=requests`, and approves User A with the `Employee` role.
5. **User A workspace switching**: User A can toggle between Company A and Company B via the Slack/Linear-style organization switcher in the sidebar.
6. **Different roles per company**: User A is `Owner` in Company A, but `Employee` in Company B.
7. **Strict CRM data isolation**: Switching workspaces clears stale context and fetches exclusively that organization's contacts, leads, deals, tasks, and audit activities.
8. **User C access restriction**: User C cannot view or query Company A or B records without an approved membership.
9. **Immediate revocation**: Revoking User A's membership in Company B immediately blocks access to Company B.
10. **Role independence**: Demoting or modifying a user's role in Company A does not impact their role in Company B.

---

## Getting Started

### 1. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Set your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Database Migration
Run the SQL migration located at `supabase/migrations/20261106_initial_crm_schema.sql` in your Supabase SQL Editor. It creates:
- Schema tables (`profiles`, `organizations`, `organization_members`, `organization_invitations`, `organization_join_requests`, `contacts`, `leads`, `deals`, `pipelines`, `pipeline_stages`, `tasks`, `activities`, `notifications`).
- Trigger to automatically create a `profiles` entry when a user signs up.
- Trigger to safeguard against deleting or demoting the last active Owner.
- Non-recursive RLS security functions and row level security policies for all tables.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## CRM Modules Scoped to Active Workspace
- **Dashboard**: Live metrics on total contacts, leads, conversion velocity, open pipeline value, won revenue, upcoming tasks, and recent audit activity.
- **Contacts**: CRUD management with company tagging, status categorization (lead, customer, partner, inactive), and audit logging.
- **Leads**: Pipeline capture, priority tagging, and 1-click lead conversion into customer contact + deal.
- **Deals & Pipelines**: Visual pipeline stages (Discovery, Proposal, Negotiation, Won), win probabilities, close dates, and stage advancement.
- **Tasks**: Priority tracking (Low, Medium, High, Urgent), due date scheduling, and user assignment.
- **Activities**: Chronological audit trail for notes, client calls, meetings, follow-ups, and email logs.
- **Team**: Membership administration, email invitation generation with expiring tokens, and join request approval workflow.
- **Organization Settings**: Company branding, logo, slug, size, industry, and ownership controls.
