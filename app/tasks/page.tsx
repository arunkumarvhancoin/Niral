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
} from 'lucide-react';

export default function TasksPage() {
  const { currentOrg, currentRole, currentStatus, currentUser } = useWorkspace();

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
    title: '',
    description: '',
    due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    priority: 'medium' as Task['priority'],
    status: 'todo' as Task['status'],
    assigned_to: '',
  }));

  const canCreateTask = hasPermission(currentRole, currentStatus, 'crm:tasks:create');
  const canUpdateTask = hasPermission(currentRole, currentStatus, 'crm:tasks:update');
  const canDeleteTask = hasPermission(currentRole, currentStatus, 'crm:tasks:delete');

  const loadMembers = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      const members = await CRMService.getOrganizationMembers(currentOrg.id);
      setTeamMembers(members);
    } catch (err) {
      console.error(err);
    }
  }, [currentOrg?.id]);

  const loadTasks = useCallback(async () => {
    if (!currentOrg?.id) return;
    if (tasks.length === 0) {
      setIsTasksLoading(true);
    }
    try {
      const data = await CRMService.getTasks(currentOrg.id, taskFilter);
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTasksLoading(false);
    }
  }, [currentOrg?.id, taskFilter, tasks.length]);

  useEffect(() => {
    if (currentOrg?.id) {
      loadTasks();
      loadMembers();
    }
  }, [currentOrg?.id, loadTasks, loadMembers]);

  const handleToggleTaskStatus = async (task: Task) => {
    if (!currentOrg || !canUpdateTask) return;
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    try {
      await CRMService.updateTask(task.id, currentOrg.id, { status: newStatus });
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
    if (!currentOrg || !currentUser) return;
    setIsSavingTask(true);
    try {
      if (editingTask) {
        await CRMService.updateTask(editingTask.id, currentOrg.id, taskFormData);
        toast.success(`Task "${taskFormData.title}" updated!`);
      } else {
        await CRMService.createTask(
          currentOrg.id,
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
    if (!currentOrg || !canDeleteTask) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete Task',
      message: 'Are you sure you want to permanently delete this task?',
      confirmText: 'Delete Task',
      variant: 'danger',
      action: async () => {
        try {
          await CRMService.deleteTask(taskId, currentOrg.id);
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <CheckSquare className="w-5 h-5 text-primary-600" />
              <span>Tasks</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Action items, follow-ups, and assigned to-dos for {currentOrg?.name}.
            </p>
          </div>
          <div className="flex items-center space-x-2.5">
            {canCreateTask && (
              <button
                onClick={() => {
                  setEditingTask(null);
                  setTaskFormData({
                    title: '',
                    description: '',
                    due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
                    priority: 'medium',
                    status: 'todo',
                    assigned_to: currentUser?.id || '',
                  });
                  setIsTaskModalOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Task Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-500/10 flex-shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pending Tasks</p>
              <p className="text-base font-bold text-slate-900">{tasks.filter((t) => t.status !== 'completed').length}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-500/10 flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Completed</p>
              <p className="text-base font-bold text-emerald-600">{tasks.filter((t) => t.status === 'completed').length}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center ring-1 ring-rose-500/10 flex-shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Urgent / High</p>
              <p className="text-base font-bold text-rose-600">
                {tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length}
              </p>
            </div>
          </div>
        </div>

        {/* Task List Header & Filter */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2">
              <CheckSquare className="w-4 h-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">Action Items</h2>
              <span className="text-xs text-slate-400 font-medium">({tasks.length})</span>
            </div>

            {/* Task Filters */}
            <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg">
              {(['pending', 'completed', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTaskFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                    taskFilter === f
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {isTasksLoading ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                  <span>Loading tasks...</span>
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600">
                    {taskFilter === 'pending' ? 'All caught up!' : 'No tasks in this view'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
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
                      className={`p-3.5 flex items-start justify-between hover:bg-slate-50/70 transition-colors ${
                        isCompleted ? 'bg-slate-50/40 opacity-75' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleToggleTaskStatus(task)}
                          className="mt-0.5 text-slate-400 hover:text-primary-600 transition-colors flex-shrink-0"
                          title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 hover:text-primary-500" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4
                              className={`text-xs font-semibold ${
                                isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'
                              }`}
                            >
                              {task.title}
                            </h4>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.2 rounded capitalize ${
                                task.priority === 'urgent'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : task.priority === 'high'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>

                          {task.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                            {task.due_date && (
                              <span className="flex items-center">
                                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {task.assignee && (
                              <span className="flex items-center text-slate-500">
                                <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
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
                                title: task.title,
                                description: task.description || '',
                                due_date: task.due_date || '',
                                priority: task.priority,
                                status: task.status,
                                assigned_to: task.assigned_to || '',
                              });
                              setIsTaskModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                            title="Edit Task"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteTask && (
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
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
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingTask ? 'Edit Task' : 'New Task'}
                </h3>
                <button
                  onClick={() => setIsTaskModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleTaskSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Follow up on contract review"
                    value={taskFormData.title}
                    onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Notes or details..."
                    value={taskFormData.description}
                    onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={taskFormData.due_date}
                      onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                    <select
                      value={taskFormData.priority}
                      onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value as any })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Assignee</label>
                  <select
                    value={taskFormData.assigned_to}
                    onChange={(e) => setTaskFormData({ ...taskFormData, assigned_to: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="">Assign to Me (Default)</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.user?.full_name || m.user?.email || 'Team member'} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTask}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors flex items-center space-x-1 disabled:opacity-50"
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
