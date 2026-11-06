export type MemberRole = 'Owner' | 'Admin' | 'Manager' | 'Employee' | 'Viewer';

export type MemberStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'revoked';

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'revoked';

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: MemberRole;
  status: MemberStatus;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  user?: UserProfile;
  organization?: Organization;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: MemberRole;
  token: string;
  invited_by: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
  organization?: Organization;
  inviter?: UserProfile;
}

export interface OrganizationJoinRequest {
  id: string;
  organization_id: string;
  user_id: string;
  message: string | null;
  status: JoinRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  organization?: Organization;
  user?: UserProfile;
  reviewer?: UserProfile;
}

export interface Contact {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company_name: string | null;
  status: 'lead' | 'customer' | 'partner' | 'inactive';
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: UserProfile;
}

export interface Lead {
  id: string;
  organization_id: string;
  title: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: 'Website' | 'Referral' | 'Outreach' | 'Inbound' | 'Event' | 'Other';
  status: 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Converted';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  value: number;
  assigned_to: string | null;
  converted_contact_id: string | null;
  converted_deal_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: UserProfile;
}

export interface Pipeline {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  stages?: PipelineStage[];
}

export interface PipelineStage {
  id: string;
  organization_id: string;
  pipeline_id: string;
  name: string;
  order_index: number;
  probability: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  organization_id: string;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  title: string;
  value: number;
  expected_close_date: string | null;
  status: 'open' | 'won' | 'lost';
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  owner?: UserProfile;
  contact?: Contact;
  stage?: PipelineStage;
}

export interface Task {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to: string | null;
  related_type: 'contact' | 'deal' | 'lead' | 'organization' | null;
  related_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: UserProfile;
}

export interface Activity {
  id: string;
  organization_id: string;
  type: 'note' | 'call' | 'meeting' | 'follow_up' | 'email';
  title: string;
  description: string | null;
  performed_by: string | null;
  related_type: 'contact' | 'deal' | 'lead' | 'organization' | null;
  related_id: string | null;
  created_at: string;
  performer?: UserProfile;
}

export interface InAppNotification {
  id: string;
  organization_id: string | null;
  user_id: string;
  title: string;
  message: string;
  type: 'membership_request' | 'membership_approved' | 'membership_rejected' | 'invitation_received' | 'invitation_accepted' | 'task_assigned' | 'system';
  read: boolean;
  link: string | null;
  created_at: string;
}

