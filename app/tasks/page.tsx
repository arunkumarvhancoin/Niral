'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { Task, OrganizationMember } from '../../lib/types/crm';
import { hasPermission } from '../../lib/permissions';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
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
  } = useWorkspace();

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<OrganizationMember[]>([]);
  const [taskFilter, setTaskFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [isTasksLoading, setIsTasksLoading] = useState(true);

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
  }));

  const canCreateTask = isSuper || hasPermission(currentRole, currentStatus, 'crm:tasks:create', currentUser);
  const canUpdateTask = isSuper || hasPermission(currentRole, currentStatus, 'crm:tasks:update', currentUser);
  const canDeleteTask = isSuper || hasPermission(currentRole, currentStatus, 'crm:tasks:delete', currentUser);

  const orgIdsKey = effectiveOrgIds.join(',');

  const loadMembers = useCallback(async () => {
    if (effectiveOrgIds.length === 0) return;
    try {
      const members = await CRMService.getOrganizationMembers(effectiveOrgIds);
      setTeamMembers(members);
    } catch (err) {
      console.error(err);
    }
  }, [orgIdsKey]);

  const loadTasks = useCallback(async () => {
    if (effectiveOrgIds.length === 0) {
      setTasks([]);
      setIsTasksLoading(false);
      return;
    }
    if (tasks.length === 0) {
      setIsTasksLoading(true);
    }
    try {
      const data = await CRMService.getTasks(effectiveOrgIds, taskFilter);
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTasksLoading(false);
    }
  }, [orgIdsKey, taskFilter, tasks.length]);

  useEffect(() => {
    if (effectiveOrgIds.length > 0) {
      loadTasks();
      loadMembers();
    }
  }, [orgIdsKey, loadTasks, loadMembers]);

  const handleToggleTaskStatus = async (task: Task) => {
    const targetOrgId = task.organization_id || currentOrg?.id;
    if (!targetOrgId || !canUpdateTask) return;
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    try {
      await CRMService.updateTask(task.id, targetOrgId, { status: newStatus });
      toast.success(newStatus === 'completed' ? 'Task marked complete!' : 'Task status updated');
      await loadTasks();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
      await loadTasks();
    }
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
      if (editingTask) {
        await CRMService.updateTask(editingTask.id, targetOrgId, taskFormData);
        toast.success(`Task "${taskFormData.title}" updated!`);
      } else {
        await CRMService.createTask(
          targetOrgId,
          {
            ...taskFormData,
            assigned_to: taskFormData.assigned_to || currentUser.id,
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
                onClick={() => {
                  setEditingTask(null);
                  setTaskFormData({
                    organization_id: currentOrg?.id || effectiveOrgIds[0] || '',
                    title: '',
                    description: '',
                    due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
                    priority: 'medium',
                    status: 'todo',
                    assigned_to: currentUser?.id || '',
                  });
                  setIsTaskModalOpen(true);
                }}
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
          <div className="bg-white p-3.5 rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center space-x-3">
            <div className="w-8 h-8 rounded-md bg-[#F0F4FE] text-[#3659C9] flex items-center justify-center flex-shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#697386]">Pending Tasks</p>
              <p className="text-lg font-semibold text-[#171B26] tabular-nums">{tasks.filter((t) => t.status !== 'completed').length}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center space-x-3">
            <div className="w-8 h-8 rounded-md bg-[#ECFDF5] text-[#047857] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#697386]">Completed</p>
              <p className="text-lg font-semibold text-[#047857] tabular-nums">{tasks.filter((t) => t.status === 'completed').length}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center space-x-3">
            <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#697386]">Urgent / High</p>
              <p className="text-lg font-semibold text-[#B91C1C] tabular-nums">
                {tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length}
              </p>
            </div>
          </div>
        </div>

        {/* Task List Header & Filter */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold text-[#171B26]">Action Items</h2>
              <span className="text-[12px] text-[#697386] font-medium tabular-nums">({tasks.length})</span>
            </div>

            {/* Task Filters */}
            <div className="flex items-center space-x-1 bg-[#F1F3F7] p-0.5 rounded-md border border-[#E7EAF0]">
              {(['pending', 'completed', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTaskFilter(f)}
                  className={`px-2.5 py-1 rounded text-[12px] font-medium capitalize transition-all ${
                    taskFilter === f
                      ? 'bg-white text-[#171B26] shadow-xs font-semibold'
                      : 'text-[#697386] hover:text-[#171B26]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="divide-y divide-[#E7EAF0]">
              {isTasksLoading ? (
                <div className="py-12 text-center text-[13px] text-[#697386] flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-4 h-4 text-[#3659C9] animate-spin" />
                  <span>Loading tasks...</span>
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckSquare className="w-8 h-8 text-[#9AA2B1] mx-auto mb-2" />
                  <p className="text-[13px] font-medium text-[#171B26]">
                    {taskFilter === 'pending' ? 'All caught up!' : 'No tasks in this view'}
                  </p>
                  <p className="text-[12px] text-[#697386] mt-0.5">
                    {taskFilter === 'pending'
                      ? 'No pending action items for this workspace.'
                      : 'Create a new task to keep track of follow-ups.'}
                  </p>
                </div>
              ) : (
                tasks.map((task) => {
                  const isCompleted = task.status === 'completed';
                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 flex items-start justify-between hover:bg-[#F7F8FA] transition-colors ${
                        isCompleted ? 'bg-[#F7F8FA]/60 opacity-75' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleToggleTaskStatus(task)}
                          className="mt-0.5 text-[#9AA2B1] hover:text-[#3659C9] transition-colors flex-shrink-0"
                          title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-[#047857]" />
                          ) : (
                            <Circle className="w-4 h-4 text-[#BAC0CE] hover:text-[#3659C9]" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4
                              className={`text-[13px] font-medium ${
                                isCompleted ? 'text-[#697386] line-through' : 'text-[#171B26]'
                              }`}
                            >
                              {task.title}
                            </h4>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${
                                task.priority === 'urgent'
                                  ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#B91C1C]/20'
                                  : task.priority === 'high'
                                  ? 'bg-[#FFFBEB] text-[#B45309] border border-[#B45309]/20'
                                  : 'bg-[#F1F3F7] text-[#697386] border border-[#E7EAF0]'
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>

                          {task.description && (
                            <p className="text-[12px] text-[#697386] mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-[#697386]">
                            {task.organization?.name && (
                              <span className="flex items-center text-[#171B26] font-medium">
                                <Building className="w-3.5 h-3.5 mr-1 text-[#9AA2B1]" />
                                {task.organization.name}
                              </span>
                            )}
                            {task.due_date && (
                              <span className="flex items-center tabular-nums">
                                <Calendar className="w-3.5 h-3.5 mr-1 text-[#9AA2B1]" />
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {task.assignee && (
                              <span className="flex items-center text-[#697386]">
                                <User className="w-3.5 h-3.5 mr-1 text-[#9AA2B1]" />
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
                                due_date: task.due_date || '',
                                priority: task.priority,
                                status: task.status,
                                assigned_to: task.assigned_to || '',
                              });
                              setIsTaskModalOpen(true);
                            }}
                            className="p-1.5 text-[#697386] hover:text-[#171B26] rounded hover:bg-[#F1F3F7] transition-colors"
                            title="Edit Task"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteTask && (
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-[#697386] hover:text-[#B91C1C] rounded hover:bg-[#FEF2F2] transition-colors"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* TASK MODAL */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E7EAF0] max-w-md w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-[#E7EAF0] flex items-center justify-between">
                <h3 className="font-semibold text-[#171B26] text-sm">
                  {editingTask ? 'Edit Task' : 'New Task'}
                </h3>
                <button
                  onClick={() => setIsTaskModalOpen(false)}
                  className="text-[#697386] hover:text-[#171B26] p-1 rounded-md hover:bg-[#F1F3F7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleTaskSubmit} className="p-5 space-y-4">
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

                <div className="pt-3 border-t border-[#E7EAF0] flex items-center justify-end space-x-2">
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
