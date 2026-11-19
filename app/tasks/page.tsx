'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService, parseNumericValue } from '../../lib/services/crm-service';
import { Task, OrganizationMember, Lead, Contact, Deal } from '../../lib/types/crm';
import { hasPermission } from '../../lib/permissions';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { TaskSkeleton } from '../../components/ui/skeleton';
import {
  CheckSquare,
  Plus,
  Calendar,
  User,
  CheckCircle2,
  Circle,
  Trash2,
  Edit,
  X,
  AlertCircle,
  Loader2,
  Building,
  Target,
  UserCheck,
  Briefcase,
  Link2,
  ExternalLink,
} from 'lucide-react';

export default function TasksPage() {
  const {
    currentOrg,
    currentRole,
    currentStatus,
    currentUser,
    effectiveOrgIds,
    isSuperAdmin: isSuper,
    memberships,
    isLoading: isWorkspaceLoading,
  } = useWorkspace();

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<OrganizationMember[]>([]);
  const [taskFilter, setTaskFilter] = useState<'pending' | 'completed' | 'urgent_high' | 'all'>('pending');
  const [isTasksLoading, setIsTasksLoading] = useState(true);

  // Connected Records state (Leads, Contacts, Deals)
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskFormData, setTaskFormData] = useState(() => ({
    organization_id: currentOrg?.id || '',
    title: '',
    description: '',
    due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    priority: 'medium' as Task['priority'],
    status: 'todo' as Task['status'],
    assigned_to: '',
    related_type: '' as '' | 'lead' | 'contact' | 'deal',
    related_id: '',
  }));

  useEffect(() => {
    if (currentOrg?.id) {
      setTaskFormData((prev) => ({
        ...prev,
        organization_id: currentOrg.id,
      }));
    }
  }, [currentOrg?.id]);

  const canCreateTask = isSuper || hasPermission(currentRole, currentStatus, 'crm:tasks:create', currentUser);
  const canUpdateTask = isSuper || hasPermission(currentRole, currentStatus, 'crm:tasks:update', currentUser);
  const canDeleteTask = isSuper || hasPermission(currentRole, currentStatus, 'crm:tasks:delete', currentUser);

  const orgIdsKey = effectiveOrgIds.join(',');

  const loadAllTaskData = useCallback(async () => {
    if (isWorkspaceLoading) return;
    if (effectiveOrgIds.length === 0) {
      setTasks([]);
      setIsTasksLoading(false);
      return;
    }
    setIsTasksLoading(true);
    try {
      const [members, taskList, leadsData, contactsData, dealsData] = await Promise.all([
        CRMService.getOrganizationMembers(effectiveOrgIds),
        CRMService.getTasks(effectiveOrgIds, 'all'),
        CRMService.getLeads(effectiveOrgIds),
        CRMService.getContacts(effectiveOrgIds),
        CRMService.getDeals(effectiveOrgIds),
      ]);
      setTeamMembers(members);
      setTasks(taskList);
      setLeads(leadsData);
      setContacts(contactsData);
      setDeals(dealsData);
    } catch (err) {
      console.error('Failed to load task management data:', err);
    } finally {
      setIsTasksLoading(false);
    }
  }, [isWorkspaceLoading, orgIdsKey]);

  const loadTasks = useCallback(async () => {
    if (isWorkspaceLoading || effectiveOrgIds.length === 0) return;
    try {
      const data = await CRMService.getTasks(effectiveOrgIds, 'all');
      setTasks(data);
    } catch (err) {
      console.error('Failed to reload tasks:', err);
    }
  }, [isWorkspaceLoading, orgIdsKey]);

  useEffect(() => {
    if (!isWorkspaceLoading && effectiveOrgIds.length > 0) {
      loadAllTaskData();
    }
  }, [isWorkspaceLoading, orgIdsKey, loadAllTaskData]);

  const handleToggleTaskStatus = async (task: Task) => {
    const targetOrgId = task.organization_id || currentOrg?.id;
    if (!targetOrgId || !canUpdateTask) return;
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';

    // Optimistic update so task immediately updates and moves to completed place without disappearing
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    try {
      await CRMService.updateTask(task.id, targetOrgId, { status: newStatus });
      toast.success(newStatus === 'completed' ? 'Task completed! Moved to Completed place' : 'Task restored to To-Do');
      await loadTasks();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
      await loadTasks();
    }
  };

  const getRelatedEntity = (task: Task) => {
    if (!task.related_type || !task.related_id) return null;
    if (task.related_type === 'lead') {
      const lead = leads.find((l) => l.id === task.related_id);
      return {
        type: 'lead',
        label: 'Lead',
        title: lead?.title || 'Lead Prospect',
        href: '/leads',
        icon: Target,
        badgeStyle: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE] hover:bg-[#DBEAFE]',
      };
    }
    if (task.related_type === 'contact') {
      const contact = contacts.find((c) => c.id === task.related_id);
      const name = contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 'Contact';
      return {
        type: 'contact',
        label: 'Contact',
        title: name || 'Contact Person',
        href: '/contacts',
        icon: UserCheck,
        badgeStyle: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0] hover:bg-[#D1FAE5]',
      };
    }
    if (task.related_type === 'deal') {
      const deal = deals.find((d) => d.id === task.related_id);
      return {
        type: 'deal',
        label: 'Deal',
        title: deal?.title || 'Deal Opportunity',
        href: '/deals',
        icon: Briefcase,
        badgeStyle: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE] hover:bg-[#EDE9FE]',
      };
    }
    return null;
  };

  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const urgentHighTasks = tasks.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed');

  const renderTaskRow = (task: Task) => {
    const isCompleted = task.status === 'completed';
    const relatedEntity = getRelatedEntity(task);

    return (
      <div
        key={task.id}
        className={`p-4 flex items-start justify-between hover:bg-[#F8FAFC] transition-colors ${
          isCompleted ? 'bg-[#F8FAFC]/75' : ''
        }`}
      >
        <div className="flex items-start space-x-3.5 flex-1 min-w-0">
          <button
            onClick={() => handleToggleTaskStatus(task)}
            className="mt-0.5 text-[#9AA2B1] hover:text-[#3659C9] transition-colors flex-shrink-0 cursor-pointer"
            title={isCompleted ? 'Mark incomplete (restore to To-Do)' : 'Mark complete (move to Completed place)'}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-[#047857]" />
            ) : (
              <Circle className="w-5 h-5 text-[#BAC0CE] hover:text-[#3659C9]" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <h4
                className={`text-sm font-semibold ${
                  isCompleted ? 'text-[#697386] line-through' : 'text-[#171B26]'
                }`}
              >
                {task.title}
              </h4>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${
                  isCompleted
                    ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                    : task.priority === 'urgent'
                    ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#B91C1C]/20'
                    : task.priority === 'high'
                    ? 'bg-[#FFFBEB] text-[#B45309] border border-[#B45309]/20'
                    : 'bg-[#F1F3F7] text-[#697386] border border-[#E7EAF0]'
                }`}
              >
                {isCompleted ? 'Completed' : task.priority}
              </span>

              {/* Connected CRM Record Badge (Lead / Contact / Deal) */}
              {relatedEntity && (
                <Link
                  href={relatedEntity.href}
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded text-xs font-medium border transition-colors ${relatedEntity.badgeStyle}`}
                  title={`Open ${relatedEntity.label}: ${relatedEntity.title}`}
                >
                  <relatedEntity.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate max-w-[180px] font-semibold">{relatedEntity.label}: {relatedEntity.title}</span>
                  <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0" />
                </Link>
              )}
            </div>

            {task.description && (
              <p className="text-xs text-[#697386] mt-1 line-clamp-2">
                {task.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#697386]">
              {task.organization?.name && (
                <span className="flex items-center text-[#171B26] font-medium">
                  <Building className="w-4 h-4 mr-1 text-[#9AA2B1]" />
                  {task.organization.name}
                </span>
              )}
              {task.due_date && (
                <span className="flex items-center tabular-nums">
                  <Calendar className="w-4 h-4 mr-1 text-[#9AA2B1]" />
                  Due: {new Date(task.due_date).toLocaleDateString()}
                </span>
              )}
              {task.assignee && (
                <span className="flex items-center text-[#697386]">
                  <User className="w-4 h-4 mr-1 text-[#9AA2B1]" />
                  {task.assignee.full_name || task.assignee.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 ml-3 flex-shrink-0">
          {canUpdateTask && (
            <button
              onClick={() => {
                setEditingTask(task);
                setTaskFormData({
                  organization_id: task.organization_id || currentOrg?.id || '',
                  title: task.title,
                  description: task.description || '',
                  due_date: task.due_date ? task.due_date.split('T')[0] : '',
                  priority: task.priority,
                  status: task.status,
                  assigned_to: task.assigned_to || '',
                  related_type: (task.related_type as any) || '',
                  related_id: task.related_id || '',
                });
                setIsTaskModalOpen(true);
              }}
              className="p-1.5 text-[#697386] hover:text-[#171B26] rounded-md hover:bg-[#F1F3F7] transition-colors"
              title="Edit Task"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {canDeleteTask && (
            <button
              onClick={() => handleDeleteTask(task.id)}
              className="p-1.5 text-[#697386] hover:text-[#B91C1C] rounded-md hover:bg-[#FEF2F2] transition-colors"
              title="Delete Task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'primary';
    action?: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetOrgId = editingTask
      ? (editingTask.organization_id || currentOrg?.id)
      : (taskFormData.organization_id || currentOrg?.id || effectiveOrgIds[0]);
    if (!targetOrgId || !currentUser) return;
    setIsSavingTask(true);
    try {
      const payload = {
        title: taskFormData.title,
        description: taskFormData.description || null,
        due_date: taskFormData.due_date ? new Date(taskFormData.due_date).toISOString() : null,
        priority: taskFormData.priority,
        status: taskFormData.status,
        assigned_to: taskFormData.assigned_to || null,
        related_type: taskFormData.related_type || null,
        related_id: taskFormData.related_id || null,
      };

      if (editingTask) {
        await CRMService.updateTask(editingTask.id, targetOrgId, payload);
        toast.success(`Task "${taskFormData.title}" updated!`);
      } else {
        await CRMService.createTask(
          targetOrgId,
          {
            ...payload,
            assigned_to: payload.assigned_to || currentUser.id,
          },
          currentUser.id
        );
        toast.success(`Task "${taskFormData.title}" created successfully!`);
      }
      setIsTaskModalOpen(false);
      await loadTasks();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const targetOrgId = task?.organization_id || currentOrg?.id;
    if (!targetOrgId || !canDeleteTask) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete Task',
      message: 'Are you sure you want to permanently delete this task?',
      confirmText: 'Delete Task',
      variant: 'danger',
      action: async () => {
        try {
          await CRMService.deleteTask(taskId, targetOrgId);
          toast.success('Task deleted successfully');
          await loadTasks();
        } catch (err: any) {
          toast.error(err.message || 'Delete failed');
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleOpenCreateTask = (relType?: '' | 'lead' | 'contact' | 'deal', relId?: string) => {
    setEditingTask(null);
    setTaskFormData({
      organization_id: currentOrg?.id || effectiveOrgIds[0] || '',
      title: '',
      description: '',
      due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      priority: 'medium',
      status: 'todo',
      assigned_to: currentUser?.id || '',
      related_type: relType || '',
      related_id: relId || '',
    });
    setIsTaskModalOpen(true);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#171B26] flex items-center space-x-2">
              <CheckSquare className="w-5 h-5 text-[#3659C9]" />
              <span>Tasks</span>
            </h1>
            <p className="text-[13px] text-[#697386] mt-0.5">
              Action items, follow-ups, and assigned to-dos for {currentOrg?.name}.
            </p>
          </div>
          <div className="flex items-center space-x-2.5">
            {canCreateTask && (
              <button
                onClick={() => handleOpenCreateTask()}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#3659C9] hover:bg-[#2B47A1] text-white text-[13px] font-medium shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Task Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            onClick={() => setTaskFilter('pending')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              taskFilter === 'pending'
                ? 'bg-blue-50/50 border-[#3659C9] ring-1 ring-[#3659C9] shadow-xs'
                : 'bg-white border-[#E7EAF0] shadow-xs hover:border-[#BAC0CE]'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-[#F0F4FE] text-[#3659C9] flex items-center justify-center flex-shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#697386]">Pending Tasks</p>
                {isWorkspaceLoading || isTasksLoading ? (
                  <div className="h-6 w-12 bg-slate-200/80 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg font-semibold text-[#171B26] tabular-nums">{pendingTasks.length}</p>
                )}
              </div>
            </div>
          </div>

          <div
            onClick={() => setTaskFilter('completed')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              taskFilter === 'completed'
                ? 'bg-[#ECFDF5]/60 border-[#047857] ring-1 ring-[#047857] shadow-xs'
                : 'bg-white border-[#E7EAF0] shadow-xs hover:border-[#BAC0CE]'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-[#ECFDF5] text-[#047857] flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#047857]">Completed Place</p>
                {isWorkspaceLoading || isTasksLoading ? (
                  <div className="h-6 w-12 bg-slate-200/80 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg font-semibold text-[#047857] tabular-nums">{completedTasks.length}</p>
                )}
              </div>
            </div>
          </div>

          <div
            onClick={() => setTaskFilter('urgent_high')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              taskFilter === 'urgent_high'
                ? 'bg-[#FEF2F2]/60 border-[#B91C1C] ring-1 ring-[#B91C1C] shadow-xs'
                : 'bg-white border-[#E7EAF0] shadow-xs hover:border-[#BAC0CE]'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#697386]">Urgent / High</p>
                {isWorkspaceLoading || isTasksLoading ? (
                  <div className="h-6 w-12 bg-slate-200/80 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg font-semibold text-[#B91C1C] tabular-nums">
                    {urgentHighTasks.length}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Task List Header & Filter */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold text-[#171B26]">Action Items</h2>
              <span className="text-[12px] text-[#697386] font-medium tabular-nums">
                ({taskFilter === 'urgent_high' ? urgentHighTasks.length : taskFilter === 'completed' ? completedTasks.length : taskFilter === 'all' ? tasks.length : pendingTasks.length})
              </span>
            </div>

            {/* Status Filters */}
            <div className="flex items-center space-x-1 bg-[#F1F3F7] p-1 rounded-lg border border-[#E7EAF0]">
              {[
                { id: 'pending', label: `Pending (${pendingTasks.length})` },
                { id: 'urgent_high', label: `Urgent / High (${urgentHighTasks.length})` },
                { id: 'completed', label: `Completed (${completedTasks.length})` },
                { id: 'all', label: `All (${tasks.length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTaskFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all cursor-pointer ${
                    taskFilter === f.id
                      ? 'bg-white text-[#171B26] shadow-xs font-semibold'
                      : 'text-[#697386] hover:text-[#171B26]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Task Content */}
          {isWorkspaceLoading || isTasksLoading ? (
            <TaskSkeleton rows={5} />
          ) : taskFilter === 'completed' ? (
            /* Dedicated Completed Place View with Inner Scroll */
            <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E7EAF0] flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#047857]" />
                  <h3 className="text-sm font-semibold text-[#171B26]">Completed Tasks</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] tabular-nums">
                    {completedTasks.length}
                  </span>
                </div>
              </div>
              {completedTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-9 h-9 text-[#BAC0CE] mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[#171B26]">No completed tasks yet</p>
                  <p className="text-xs text-[#697386] mt-1">
                    Check off action items in To-Do to have them show in this completed place.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E7EAF0] overflow-y-auto max-h-[calc(100vh-320px)] min-h-[250px]">
                  {completedTasks.map(renderTaskRow)}
                </div>
              )}
            </div>
          ) : taskFilter === 'urgent_high' ? (
            /* Dedicated Urgent & High Priority View with Inner Scroll */
            <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E7EAF0] flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-[#B91C1C]" />
                  <h3 className="text-sm font-semibold text-[#171B26]">Urgent & High Priority Tasks</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] tabular-nums">
                    {urgentHighTasks.length}
                  </span>
                </div>
              </div>
              {urgentHighTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-9 h-9 text-[#047857] mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-[#171B26]">No urgent or high priority tasks</p>
                  <p className="text-xs text-[#697386] mt-1">
                    All high and urgent priority items have been resolved or none are scheduled.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E7EAF0] overflow-y-auto max-h-[calc(100vh-320px)] min-h-[250px]">
                  {urgentHighTasks.map(renderTaskRow)}
                </div>
              )}
            </div>
          ) : (
            /* Pending or All View with Inner Scroll */
            <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E7EAF0] flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-4 h-4 text-[#3659C9]" />
                  <h3 className="text-sm font-semibold text-[#171B26]">
                    {taskFilter === 'all' ? 'All Tasks' : 'To-Do Tasks'}
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] tabular-nums">
                    {taskFilter === 'all' ? tasks.length : pendingTasks.length}
                  </span>
                </div>
              </div>
              {(taskFilter === 'all' ? tasks : pendingTasks).length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="w-9 h-9 text-[#047857] mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-[#171B26]">All caught up!</p>
                  <p className="text-xs text-[#697386] mt-1">
                    {taskFilter === 'all'
                      ? 'No tasks found.'
                      : completedTasks.length > 0
                      ? 'All pending tasks are complete. Click "Completed" to view them.'
                      : 'Create a new task to keep track of follow-ups across your CRM records.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E7EAF0] overflow-y-auto max-h-[calc(100vh-320px)] min-h-[250px]">
                  {(taskFilter === 'all' ? tasks : pendingTasks).map(renderTaskRow)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* TASK MODAL */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between flex-shrink-0 bg-[#F8FAFC]">
                <div>
                  <h3 className="font-semibold text-[#171B26] text-sm">
                    {editingTask ? 'Edit Task' : 'New Task'}
                  </h3>
                  <p className="text-[11px] text-[#697386] mt-0.5">
                    Connect action items to leads, contacts, or deals
                  </p>
                </div>
                <button
                  onClick={() => setIsTaskModalOpen(false)}
                  className="text-[#697386] hover:text-[#171B26] p-1 rounded-md hover:bg-[#F1F3F7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleTaskSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar">
                {isSuper && memberships.length > 0 && !editingTask && (
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                      Organization * <span className="text-[11px] text-[#5B21B6] font-normal">(Super Admin)</span>
                    </label>
                    <select
                      value={taskFormData.organization_id || currentOrg?.id}
                      onChange={(e) => setTaskFormData({ ...taskFormData, organization_id: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    >
                      {memberships.map((m) => (
                        <option key={m.organization.id} value={m.organization.id}>
                          {m.organization.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Follow up on contract review"
                    value={taskFormData.title}
                    onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  />
                </div>

                {/* CONNECT TO RECORD: Lead / Contact / Deal */}
                <div className="p-3 bg-[#F7F8FA] rounded-lg border border-[#E7EAF0] space-y-2.5">
                  <div className="flex items-center space-x-1.5 text-[12px] font-semibold text-[#171B26]">
                    <Link2 className="w-3.5 h-3.5 text-[#3659C9]" />
                    <span>Connect to CRM Record</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[#697386] mb-1">Record Type</label>
                      <select
                        value={taskFormData.related_type}
                        onChange={(e) => {
                          const relType = e.target.value as '' | 'lead' | 'contact' | 'deal';
                          setTaskFormData({
                            ...taskFormData,
                            related_type: relType,
                            related_id: '',
                          });
                        }}
                        className="w-full text-[12px] font-medium rounded-md border border-[#E7EAF0] bg-white px-2.5 py-1.5 text-[#171B26] focus:outline-none focus:border-[#3659C9]"
                      >
                        <option value="">None (General Task)</option>
                        <option value="lead">🎯 Lead</option>
                        <option value="contact">👤 Contact</option>
                        <option value="deal">💼 Deal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[#697386] mb-1">
                        Select {taskFormData.related_type ? taskFormData.related_type.charAt(0).toUpperCase() + taskFormData.related_type.slice(1) : 'Record'}
                      </label>
                      {taskFormData.related_type === 'lead' ? (
                        <select
                          value={taskFormData.related_id}
                          onChange={(e) => setTaskFormData({ ...taskFormData, related_id: e.target.value })}
                          className="w-full text-[12px] rounded-md border border-[#E7EAF0] bg-white px-2.5 py-1.5 text-[#171B26] focus:outline-none focus:border-[#3659C9]"
                        >
                          <option value="">Choose a Lead...</option>
                          {leads
                            .filter((l) => !taskFormData.organization_id || l.organization_id === taskFormData.organization_id)
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.title} ({l.company || 'Direct Inbound'})
                              </option>
                            ))}
                        </select>
                      ) : taskFormData.related_type === 'contact' ? (
                        <select
                          value={taskFormData.related_id}
                          onChange={(e) => setTaskFormData({ ...taskFormData, related_id: e.target.value })}
                          className="w-full text-[12px] rounded-md border border-[#E7EAF0] bg-white px-2.5 py-1.5 text-[#171B26] focus:outline-none focus:border-[#3659C9]"
                        >
                          <option value="">Choose a Contact...</option>
                          {contacts
                            .filter((c) => !taskFormData.organization_id || c.organization_id === taskFormData.organization_id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.first_name} {c.last_name} {c.company_name ? `(${c.company_name})` : ''}
                              </option>
                            ))}
                        </select>
                      ) : taskFormData.related_type === 'deal' ? (
                        <select
                          value={taskFormData.related_id}
                          onChange={(e) => setTaskFormData({ ...taskFormData, related_id: e.target.value })}
                          className="w-full text-[12px] rounded-md border border-[#E7EAF0] bg-white px-2.5 py-1.5 text-[#171B26] focus:outline-none focus:border-[#3659C9]"
                        >
                          <option value="">Choose a Deal...</option>
                          {deals
                            .filter((d) => !taskFormData.organization_id || d.organization_id === taskFormData.organization_id)
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.title} (₹{parseNumericValue(d.value).toLocaleString('en-IN')})
                              </option>
                            ))}
                        </select>
                      ) : (
                        <div className="text-[11px] text-[#9AA2B1] py-1.5 italic">
                          Task is not tied to a specific record.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Notes or details..."
                    value={taskFormData.description}
                    onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={taskFormData.due_date}
                      onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] tabular-nums focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Priority</label>
                    <select
                      value={taskFormData.priority}
                      onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value as any })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Assignee</label>
                  <select
                    value={taskFormData.assigned_to}
                    onChange={(e) => setTaskFormData({ ...taskFormData, assigned_to: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  >
                    <option value="">Assign to Me (Default)</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.user?.full_name || m.user?.email || 'Team member'} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[#E7EAF0] bg-slate-50 flex items-center justify-end space-x-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-3.5 py-2 text-[13px] font-medium text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTask}
                  className="px-4 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-colors flex items-center space-x-1 disabled:opacity-50"
                >
                  {isSavingTask && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>{editingTask ? 'Save Changes' : 'Create Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
        )}

        {/* In-UI Confirmation Dialog */}
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          variant={confirmState.variant}
          onConfirm={() => confirmState.action?.()}
          onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </AppShell>
  );
}
