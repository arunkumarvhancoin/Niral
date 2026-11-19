'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService, parseNumericValue } from '../../lib/services/crm-service';
import { Deal, Pipeline, PipelineStage, Contact, Task } from '../../lib/types/crm';
import { hasPermission } from '../../lib/permissions';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { KanbanSkeleton } from '../../components/ui/skeleton';
import {
  BarChart3,
  Plus,
  DollarSign,
  Calendar,
  Building,
  User,
  ArrowRight,
  CheckCircle,
  X,
  Trash2,
  Edit,
  GripVertical,
  CheckCircle2,
  TrendingUp,
  XCircle,
  Archive,
  RotateCcw,
  Search,
  PauseCircle,
  MoreVertical,
  ExternalLink,
  Layers,
  Eye,
  CheckSquare,
  Circle,
} from 'lucide-react';

export default function DealsPage() {
  const {
    currentOrg,
    currentRole,
    currentStatus,
    currentUser,
    effectiveOrgIds,
    isSuperAdmin: isSuper,
    isAllOrgsSelected,
    isMultiOrgActive,
    memberships,
    isLoading: isWorkspaceLoading,
  } = useWorkspace();
  const [pipelines, setPipelines] = useState<(Pipeline & { stages: PipelineStage[] })[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab View State: 'pipeline' (Active Kanban), 'lost' (Closed Lost), 'inactive' (Dormant / On-Hold)
  const [activeView, setActiveView] = useState<'pipeline' | 'lost' | 'inactive'>('pipeline');
  const [archiveSearch, setArchiveSearch] = useState('');

  // Drag and Drop States
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Active dropdown card menu
  const [openMenuDealId, setOpenMenuDealId] = useState<string | null>(null);

  // Deal Details & Quick Status Actions Modal
  const [viewingDeal, setViewingDeal] = useState<Deal | null>(null);
  const [dealTasks, setDealTasks] = useState<Task[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isSavingDealTask, setIsSavingDealTask] = useState(false);

  // Deal Modal (Create & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState(() => ({
    organization_id: currentOrg?.id || '',
    title: '',
    value: 50000,
    pipeline_id: '',
    stage_id: '',
    contact_id: '',
    expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    status: 'open' as Deal['status'],
  }));

  useEffect(() => {
    if (currentOrg?.id) {
      setFormData((prev) => ({
        ...prev,
        organization_id: currentOrg.id,
      }));
    }
  }, [currentOrg?.id]);

  const canCreate = isSuper || hasPermission(currentRole, currentStatus, 'crm:deals:create', currentUser);
  const canUpdate = isSuper || hasPermission(currentRole, currentStatus, 'crm:deals:update', currentUser);
  const canDelete = isSuper || hasPermission(currentRole, currentStatus, 'crm:deals:delete', currentUser);

  const orgIdsKey = effectiveOrgIds.join(',');

  const loadPipelineData = useCallback(async () => {
    if (isWorkspaceLoading) return;
    if (effectiveOrgIds.length === 0) {
      setDeals([]);
      setContacts([]);
      setIsLoading(false);
      return;
    }
    if (deals.length === 0) {
      setIsLoading(true);
    }
    try {
      const pipeOrgId = currentOrg?.id || effectiveOrgIds[0];
      const [pipes, dealList, contactList] = await Promise.all([
        CRMService.getPipelines(pipeOrgId),
        CRMService.getDeals(effectiveOrgIds),
        CRMService.getContacts(effectiveOrgIds),
      ]);
      setPipelines(pipes);
      setDeals(dealList);
      setContacts(contactList);

      if (pipes.length > 0) {
        // Auto-select pipeline that has deals or is default
        const pipeWithDeals = pipes.find((p) =>
          dealList.some((d) => d.pipeline_id === p.id || p.stages?.some((s) => s.id === d.stage_id))
        );
        const defaultPipe = pipes.find((p) => p.is_default) || pipes[0];
        const chosenPipe = pipeWithDeals || defaultPipe;
        if (chosenPipe) {
          setSelectedPipelineId((prev) => {
            if (prev && pipes.some((p) => p.id === prev)) {
              return prev;
            }
            return chosenPipe.id;
          });

          if (chosenPipe.stages?.length > 0) {
            setFormData((prev) => ({
              ...prev,
              organization_id: currentOrg?.id || effectiveOrgIds[0],
              pipeline_id: chosenPipe.id,
              stage_id: chosenPipe.stages[0].id,
            }));
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [isWorkspaceLoading, orgIdsKey, currentOrg?.id]);

  useEffect(() => {
    if (!isWorkspaceLoading && effectiveOrgIds.length > 0) {
      loadPipelineData();
    }
  }, [isWorkspaceLoading, orgIdsKey, loadPipelineData]);

  // Load connected tasks when viewing a deal
  const viewingDealOrgId = viewingDeal?.organization_id || currentOrg?.id;
  const viewingDealId = viewingDeal?.id;

  useEffect(() => {
    if (viewingDealId && viewingDealOrgId) {
      CRMService.getTasks(viewingDealOrgId)
        .then((allTasks) => {
          setDealTasks(allTasks.filter((t) => t.related_type === 'deal' && t.related_id === viewingDealId));
        })
        .catch(() => {});
    } else {
      setDealTasks([]);
      setIsAddingTask(false);
      setNewTaskTitle('');
    }
  }, [viewingDealId, viewingDealOrgId]);

  // Close card menu on global click
  useEffect(() => {
    function handleClickOutside() {
      setOpenMenuDealId(null);
    }
    if (openMenuDealId) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuDealId]);

  const handleStageChange = async (dealId: string, newStageId: string) => {
    if (!canUpdate) return;
    const deal = deals.find((d) => d.id === dealId);
    const targetOrgId = deal?.organization_id || currentOrg?.id;
    if (!targetOrgId) return;

    try {
      const activePipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];
      const targetStage = activePipeline?.stages?.find((s) => s.id === newStageId);
      const isWon = targetStage?.name.toLowerCase().includes('won');
      const isLost = targetStage?.name.toLowerCase().includes('lost');
      const nextStatus = isWon ? 'won' : isLost ? 'lost' : 'open';

      // Optimistic update
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? { ...d, stage_id: newStageId, pipeline_id: activePipeline?.id || d.pipeline_id, status: nextStatus }
            : d
        )
      );

      await CRMService.updateDeal(dealId, targetOrgId, {
        stage_id: newStageId,
        pipeline_id: activePipeline?.id,
        status: nextStatus,
      });

      toast.success(
        isWon
          ? 'Deal marked Closed Won! 🏆'
          : isLost
          ? 'Deal moved to Lost Deals'
          : 'Deal stage updated'
      );
      await loadPipelineData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update deal stage');
      await loadPipelineData();
    }
  };

  const handleMarkStatus = async (dealId: string, status: 'open' | 'lost' | 'inactive') => {
    if (!canUpdate) return;
    const deal = deals.find((d) => d.id === dealId);
    const targetOrgId = deal?.organization_id || currentOrg?.id;
    if (!targetOrgId) return;

    const label = status === 'lost' ? 'Lost Deals' : status === 'inactive' ? 'Inactive Deals' : 'Active Pipeline';
    
    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, status } : d))
    );
    setOpenMenuDealId(null);

    try {
      await CRMService.updateDeal(dealId, targetOrgId, { status });
      toast.success(`Deal moved to ${label}!`);
      await loadPipelineData();
    } catch (err: any) {
      toast.error(err.message || `Failed to update deal status`);
      await loadPipelineData();
    }
  };

  const handleReactivateDeal = async (dealId: string, targetStageId?: string) => {
    if (!canUpdate) return;
    const deal = deals.find((d) => d.id === dealId);
    const targetOrgId = deal?.organization_id || currentOrg?.id;
    if (!targetOrgId) return;

    const activePipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];
    const firstStageId = targetStageId || activePipeline?.stages?.[0]?.id;
    if (!firstStageId) {
      toast.error('No pipeline stage available to reactivate deal into.');
      return;
    }

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, status: 'open', stage_id: firstStageId, pipeline_id: activePipeline?.id || d.pipeline_id }
          : d
      )
    );

    try {
      await CRMService.updateDeal(dealId, targetOrgId, {
        status: 'open',
        stage_id: firstStageId,
        pipeline_id: activePipeline?.id,
      });
      toast.success('Deal reactivated and returned to Active Pipeline!');
      await loadPipelineData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reactivate deal');
      await loadPipelineData();
    }
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    if (!canUpdate) return;
    setDraggedDealId(dealId);
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedDealId(null);
    setDragOverStageId(null);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain') || draggedDealId;
    setDragOverStageId(null);
    setDraggedDealId(null);

    if (dealId && targetStageId) {
      await handleStageChange(dealId, targetStageId);
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

  const handleOpenCreateModal = () => {
    const defaultPipe = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];
    const firstStage = defaultPipe?.stages?.[0];
    setEditingDeal(null);
    setFormData({
      organization_id: currentOrg?.id || effectiveOrgIds[0] || '',
      title: '',
      value: 50000,
      pipeline_id: defaultPipe?.id || '',
      stage_id: firstStage?.id || '',
      contact_id: '',
      expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'open',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (deal: Deal) => {
    // Immediately close the details popup so the edit popup opens right in front, never behind it
    setViewingDeal(null);
    setOpenMenuDealId(null);
    setEditingDeal(deal);
    const pipe = pipelines.find((p) => p.id === deal.pipeline_id) || pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];
    setFormData({
      organization_id: deal.organization_id || currentOrg?.id || '',
      title: deal.title || '',
      value: parseNumericValue(deal.value),
      pipeline_id: deal.pipeline_id || pipe?.id || '',
      stage_id: deal.stage_id || pipe?.stages?.[0]?.id || '',
      contact_id: deal.contact_id || '',
      expected_close_date: deal.expected_close_date || '',
      status: deal.status || 'open',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetOrgId = formData.organization_id || editingDeal?.organization_id || currentOrg?.id;
    if (!targetOrgId || !currentUser) return;
    try {
      if (editingDeal) {
        await CRMService.updateDeal(editingDeal.id, targetOrgId, {
          title: formData.title.trim(),
          value: parseNumericValue(formData.value),
          pipeline_id: formData.pipeline_id || undefined,
          stage_id: formData.stage_id || undefined,
          contact_id: formData.contact_id || null,
          expected_close_date: formData.expected_close_date || null,
          status: formData.status,
        });
        toast.success(`Deal "${formData.title}" updated successfully!`);
        setEditingDeal(null);
        if (viewingDeal?.id === editingDeal.id) {
          setViewingDeal((prev) =>
            prev
              ? {
                  ...prev,
                  title: formData.title.trim(),
                  value: parseNumericValue(formData.value),
                  pipeline_id: formData.pipeline_id || prev.pipeline_id,
                  stage_id: formData.stage_id || prev.stage_id,
                  contact_id: formData.contact_id || null,
                  expected_close_date: formData.expected_close_date || null,
                  status: formData.status,
                  contact: contacts.find((c) => c.id === formData.contact_id) || prev.contact,
                }
              : null
          );
        }
      } else {
        await CRMService.createDeal(targetOrgId, formData, currentUser.id);
        toast.success(`Deal "${formData.title}" created successfully!`);
      }
      setIsModalOpen(false);
      await loadPipelineData();
    } catch (err: any) {
      toast.error(err.message || (editingDeal ? 'Update failed' : 'Creation failed'));
    }
  };

  const handleDelete = (dealId: string) => {
    const deal = deals.find((d) => d.id === dealId);
    const targetOrgId = deal?.organization_id || currentOrg?.id;
    if (!targetOrgId || !canDelete) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete Deal',
      message: 'Are you sure you want to permanently delete this deal? This action cannot be undone.',
      confirmText: 'Delete Deal',
      variant: 'danger',
      action: async () => {
        try {
          await CRMService.deleteDeal(dealId, targetOrgId);
          toast.success('Deal deleted successfully');
          await loadPipelineData();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete deal');
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const activePipeline = useMemo(() => {
    if (pipelines.length === 0) return null;
    return pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];
  }, [pipelines, selectedPipelineId]);

  // Deal Categorization
  // Active deals on board: open deals + closed won deals (excluding lost & inactive)
  const activePipelineDeals = useMemo(
    () => deals.filter((d) => d.status !== 'lost' && d.status !== 'inactive'),
    [deals]
  );
  const openDeals = useMemo(() => deals.filter((d) => d.status === 'open'), [deals]);
  const wonDeals = useMemo(() => deals.filter((d) => d.status === 'won'), [deals]);
  const lostDeals = useMemo(() => deals.filter((d) => d.status === 'lost'), [deals]);
  const inactiveDeals = useMemo(() => deals.filter((d) => d.status === 'inactive'), [deals]);

  // Robust stage mapping for active board deals:
  // Guarantees that every active deal is reliably displayed in the appropriate stage column,
  // matching direct stage_id, joined stage ID, stage name, or gracefully placing in the first stage.
  const stageDealMap = useMemo(() => {
    const map = new Map<string, Deal[]>();
    if (!activePipeline?.stages || activePipeline.stages.length === 0) return map;

    const stages = activePipeline.stages;
    stages.forEach((s) => map.set(s.id, []));

    const firstStage = stages[0];
    const wonStage = stages.find((s) => s.probability === 100 || s.name.toLowerCase().includes('won')) || stages[stages.length - 1];

    activePipelineDeals.forEach((deal) => {
      // If multiple pipelines exist and deal is explicitly bound to another pipeline, skip from current board view
      if (pipelines.length > 1 && deal.pipeline_id && deal.pipeline_id !== activePipeline.id) {
        const belongsToOther = pipelines.some(
          (p) => p.id === deal.pipeline_id && p.id !== activePipeline.id
        );
        if (belongsToOther) {
          return;
        }
      }

      // 1. Direct stage ID match
      let matchedStage = stages.find((s) => s.id === deal.stage_id);

      // 2. Joined stage object ID match
      if (!matchedStage && deal.stage?.id) {
        const stageObjId = deal.stage.id;
        matchedStage = stages.find((s) => s.id === stageObjId);
      }

      // 3. Stage name match (case-insensitive)
      if (!matchedStage && deal.stage?.name) {
        const dealStageName = deal.stage.name.toLowerCase().trim();
        matchedStage = stages.find((s) => s.name.toLowerCase().trim() === dealStageName);
      }

      // 4. Fallback for unmapped active deals:
      // Never hide active opportunities! Won deals go to won stage; open deals go to initial pipeline stage.
      if (!matchedStage) {
        matchedStage = deal.status === 'won' ? wonStage : firstStage;
      }

      if (matchedStage) {
        const list = map.get(matchedStage.id) || [];
        list.push(deal);
        map.set(matchedStage.id, list);
      }
    });

    return map;
  }, [activePipeline, activePipelineDeals, pipelines]);

  const boardTotalDealsCount = useMemo(() => {
    let count = 0;
    stageDealMap.forEach((list) => {
      count += list.length;
    });
    return count;
  }, [stageDealMap]);

  // Active deals mapped to the current board
  const activeBoardDeals = useMemo(() => {
    const list: Deal[] = [];
    stageDealMap.forEach((stageList) => {
      list.push(...stageList);
    });
    return list;
  }, [stageDealMap]);

  const activeBoardOpenDeals = useMemo(
    () => activeBoardDeals.filter((d) => d.status === 'open'),
    [activeBoardDeals]
  );

  // When viewing a specific pipeline, compute stats for that pipeline so card totals exactly match column sums:
  const displayPipelineValue = useMemo(() => {
    if (pipelines.length > 1) {
      return activeBoardOpenDeals.reduce((sum, d) => sum + parseNumericValue(d.value), 0);
    }
    return openDeals.reduce((sum, d) => sum + parseNumericValue(d.value), 0);
  }, [pipelines.length, activeBoardOpenDeals, openDeals]);

  const displayOpenDealsCount = pipelines.length > 1 ? activeBoardOpenDeals.length : openDeals.length;

  const totalPipelineValue = openDeals.reduce((sum, d) => sum + parseNumericValue(d.value), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + parseNumericValue(d.value), 0);
  const lostValue = lostDeals.reduce((sum, d) => sum + parseNumericValue(d.value), 0);
  const inactiveValue = inactiveDeals.reduce((sum, d) => sum + parseNumericValue(d.value), 0);
  const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;
  const avgDealSize = deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + parseNumericValue(d.value), 0) / deals.length) : 0;

  // Filtered lists for archive search
  const filteredLostDeals = lostDeals.filter((d) => {
    if (!archiveSearch.trim()) return true;
    const q = archiveSearch.toLowerCase();
    const contactName = `${d.contact?.first_name || ''} ${d.contact?.last_name || ''}`.toLowerCase();
    return d.title.toLowerCase().includes(q) || contactName.includes(q);
  });

  const filteredInactiveDeals = inactiveDeals.filter((d) => {
    if (!archiveSearch.trim()) return true;
    const q = archiveSearch.toLowerCase();
    const contactName = `${d.contact?.first_name || ''} ${d.contact?.last_name || ''}`.toLowerCase();
    return d.title.toLowerCase().includes(q) || contactName.includes(q);
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#171B26]">Deals & Opportunities</h1>
            <p className="text-[13px] text-[#697386] mt-0.5">
              Pipeline tracking and deal management for {currentOrg?.name}.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#3659C9] hover:bg-[#2B47A1] text-white text-[13px] font-medium shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Deal</span>
            </button>
          )}
        </div>

        {/* Pipeline Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            onClick={() => {
              setActiveView('pipeline');
              setArchiveSearch('');
            }}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              activeView === 'pipeline'
                ? 'bg-[#F0F4FE]/60 border-[#3659C9] ring-1 ring-[#3659C9] shadow-xs'
                : 'bg-white border-[#E7EAF0] shadow-xs hover:border-[#BAC0CE]'
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#F1F3F7] text-[#3659C9] flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#697386]">Active Pipeline</p>
                <p className="text-xl font-bold text-[#171B26] truncate tabular-nums mt-0.5">₹{displayPipelineValue.toLocaleString('en-IN')}</p>
                <p className="text-xs text-[#697386] mt-0.5">{displayOpenDealsCount} open opportunities</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E7EAF0] shadow-xs flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] text-[#047857] flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#697386]">Won Revenue</p>
              <p className="text-xl font-bold text-[#047857] truncate tabular-nums mt-0.5">₹{wonValue.toLocaleString('en-IN')}</p>
              <p className="text-xs text-[#047857] font-medium mt-0.5">{wonDeals.length} closed won</p>
            </div>
          </div>

          <div
            onClick={() => setActiveView('lost')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              activeView === 'lost'
                ? 'bg-[#FEF2F2]/60 border-[#B91C1C] ring-1 ring-[#B91C1C] shadow-xs'
                : 'bg-white border-[#E7EAF0] shadow-xs hover:border-[#BAC0CE]'
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#697386]">Lost Deals</p>
                <p className="text-xl font-bold text-[#B91C1C] truncate tabular-nums mt-0.5">₹{lostValue.toLocaleString('en-IN')}</p>
                <p className="text-xs text-[#697386] mt-0.5">{lostDeals.length} closed lost</p>
              </div>
            </div>
          </div>

          <div
            onClick={() => setActiveView('inactive')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              activeView === 'inactive'
                ? 'bg-[#F1F3F7] border-[#697386] ring-1 ring-[#697386] shadow-xs'
                : 'bg-white border-[#E7EAF0] shadow-xs hover:border-[#BAC0CE]'
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#F1F3F7] text-[#697386] flex items-center justify-center flex-shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#697386]">Inactive / On-Hold</p>
                <p className="text-xl font-bold text-[#171B26] truncate tabular-nums mt-0.5">₹{inactiveValue.toLocaleString('en-IN')}</p>
                <p className="text-xs text-[#697386] mt-0.5">{inactiveDeals.length} dormant</p>
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-[#E7EAF0]">
          <div className="flex items-center space-x-1 p-0.5 bg-[#F1F3F7] rounded-md border border-[#E7EAF0] w-fit">
            <button
              onClick={() => {
                setActiveView('pipeline');
                setArchiveSearch('');
              }}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded text-[13px] font-medium transition-all ${
                activeView === 'pipeline'
                  ? 'bg-white text-[#171B26] shadow-xs font-semibold'
                  : 'text-[#697386] hover:text-[#171B26]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#3659C9]" />
              <span>Active Pipeline</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#F0F4FE] text-[#3659C9] font-medium border border-[#3659C9]/20 tabular-nums">
                {boardTotalDealsCount}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveView('lost');
                setArchiveSearch('');
              }}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded text-[13px] font-medium transition-all ${
                activeView === 'lost'
                  ? 'bg-white text-[#171B26] shadow-xs font-semibold'
                  : 'text-[#697386] hover:text-[#171B26]'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-[#B91C1C]" />
              <span>Lost Deals</span>
              {lostDeals.length > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#FEF2F2] text-[#B91C1C] font-medium border border-[#B91C1C]/20 tabular-nums">
                  {lostDeals.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveView('inactive');
                setArchiveSearch('');
              }}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded text-[13px] font-medium transition-all ${
                activeView === 'inactive'
                  ? 'bg-white text-[#171B26] shadow-xs font-semibold'
                  : 'text-[#697386] hover:text-[#171B26]'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-[#697386]" />
              <span>Inactive Deals</span>
              {inactiveDeals.length > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#F1F3F7] text-[#171B26] font-medium border border-[#E7EAF0] tabular-nums">
                  {inactiveDeals.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2.5">
            {activeView === 'pipeline' && pipelines.length > 1 && (
              <div className="flex items-center space-x-1.5">
                <span className="text-[12px] font-medium text-[#697386]">Pipeline:</span>
                <select
                  value={activePipeline?.id || ''}
                  onChange={(e) => setSelectedPipelineId(e.target.value)}
                  className="text-[12px] font-semibold bg-white border border-[#E7EAF0] rounded-md px-2.5 py-1 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all cursor-pointer shadow-2xs"
                >
                  {pipelines.map((p) => {
                    const pipeDealsCount = deals.filter(
                      (d) =>
                        d.status !== 'lost' &&
                        d.status !== 'inactive' &&
                        (d.pipeline_id === p.id || p.stages?.some((s) => s.id === d.stage_id))
                    ).length;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} {pipeDealsCount > 0 ? `(${pipeDealsCount})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {activeView !== 'pipeline' && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9AA2B1]" />
                <input
                  type="text"
                  placeholder={`Search ${activeView === 'lost' ? 'lost' : 'inactive'} deals...`}
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  className="w-full text-[13px] pl-8 pr-3 py-1.5 rounded-md border border-[#E7EAF0] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] bg-white text-[#171B26] placeholder:text-[#9AA2B1] transition-all"
                />
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            VIEW 1: ACTIVE PIPELINE (KANBAN BOARD - NO LOST/INACTIVE CLUTTER)
           ========================================================================= */}
        {activeView === 'pipeline' && (
          <>
            {isWorkspaceLoading || isLoading ? (
              <KanbanSkeleton columns={activePipeline?.stages?.length || 4} />
            ) : !activePipeline || !activePipeline.stages || activePipeline.stages.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-lg border border-[#E7EAF0]">
                <BarChart3 className="w-8 h-8 text-[#9AA2B1] mx-auto mb-2" />
                <p className="text-[13px] font-medium text-[#697386]">No active pipeline stages configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-start select-none">
                {activePipeline.stages.map((stage) => {
                  // Strictly filter for active pipeline deals (hide lost and inactive from the open board)
                  const stageDeals = stageDealMap.get(stage.id) || [];
                  const stageTotalValue = stageDeals.reduce((sum, d) => sum + parseNumericValue(d.value), 0);
                  const isDragOver = dragOverStageId === stage.id;
                  const stageColor = stage.color || '#3659C9';

                  return (
                    <div
                      key={stage.id}
                      onDragOver={(e) => handleDragOver(e, stage.id)}
                      onDragLeave={() => setDragOverStageId(null)}
                      onDrop={(e) => handleDrop(e, stage.id)}
                      className={`rounded-lg border transition-all flex flex-col min-h-[560px] overflow-hidden ${
                        isDragOver
                          ? 'bg-[#F0F4FE]/60 border-[#3659C9] ring-2 ring-[#3659C9]/20 shadow-xs'
                          : 'bg-[#F7F8FA] border-[#E7EAF0]'
                      }`}
                    >
                      {/* Top Color Accent */}
                      <div className="h-1 w-full" style={{ backgroundColor: stageColor }} />

                      {/* Column Header */}
                      <div className="p-3 pb-2.5 border-b border-[#E7EAF0] bg-white flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: stageColor }}
                            />
                            <h4 className="text-[12px] font-semibold text-[#171B26] uppercase tracking-wider">
                              {stage.name}
                            </h4>
                          </div>
                          <span className="text-[11px] text-[#697386] font-medium mt-0.5 block tabular-nums">
                            ₹{stageTotalValue.toLocaleString('en-IN')} &bull; {stageDeals.length} deals
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-[#697386] bg-[#F1F3F7] px-1.5 py-0.5 rounded border border-[#E7EAF0] tabular-nums">
                          {stage.probability}%
                        </span>
                      </div>

                      {/* Deals List with Inner Column Scrolling */}
                      <div className="p-2.5 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-340px)] min-h-[420px]">
                        {stageDeals.length === 0 ? (
                          <div
                            className={`py-12 text-center text-xs rounded-md border border-dashed transition-all flex flex-col items-center justify-center ${
                              isDragOver
                                ? 'border-[#3659C9] bg-[#F0F4FE] text-[#3659C9] font-medium'
                                : 'border-[#E7EAF0] text-[#9AA2B1] bg-white/40'
                            }`}
                          >
                            <BarChart3 className="w-5 h-5 text-[#9AA2B1] mb-1" />
                            <span>{isDragOver ? 'Drop deal here' : 'Drop deals here'}</span>
                          </div>
                        ) : (
                          stageDeals.map((deal) => {
                            const isBeingDragged = draggedDealId === deal.id;
                            const isWon = deal.status === 'won';
                            const isMenuOpen = openMenuDealId === deal.id;

                            return (
                              <div
                                key={deal.id}
                                draggable={canUpdate}
                                onDragStart={(e) => handleDragStart(e, deal.id)}
                                onDragEnd={handleDragEnd}
                                onClick={() => setViewingDeal(deal)}
                                className={`bg-white p-3 rounded-md border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#BAC0CE] hover:shadow-xs transition-all group relative border-l-2 cursor-pointer ${
                                  canUpdate ? 'active:cursor-grabbing' : ''
                                } ${isBeingDragged ? 'opacity-40 scale-95 border-dashed border-[#3659C9]' : ''}`}
                                style={{
                                  borderLeftColor: isWon ? '#047857' : stageColor,
                                }}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="flex items-start space-x-1.5 min-w-0 flex-1">
                                    {canUpdate && (
                                      <GripVertical
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-4 h-4 text-[#9AA2B1] group-hover:text-[#697386] mt-0.5 flex-shrink-0 cursor-grab"
                                      />
                                    )}
                                    <h5
                                      className="font-medium text-[#171B26] text-sm leading-snug group-hover:text-[#3659C9] transition-colors line-clamp-2"
                                      title={deal.title}
                                    >
                                      {deal.title}
                                    </h5>
                                  </div>

                                  {/* Quick Actions Menu Trigger */}
                                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuDealId(isMenuOpen ? null : deal.id);
                                      }}
                                      className="p-1 rounded-md border border-transparent group-hover:border-[#E7EAF0] group-hover:bg-[#F7F8FA] text-[#697386] hover:text-[#171B26] transition-colors"
                                      title="Deal Options (Mark as Lost, Inactive, Delete)"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>

                                    {/* Dropdown Options */}
                                    {isMenuOpen && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-[#E7EAF0] py-1 z-40 text-left animate-in fade-in-50 zoom-in-95 duration-100"
                                      >
                                        <button
                                          onClick={() => {
                                            setOpenMenuDealId(null);
                                            setViewingDeal(deal);
                                          }}
                                          className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-[#171B26] hover:bg-[#F1F3F7] font-medium transition-colors"
                                        >
                                          <Eye className="w-4 h-4 text-[#3659C9]" />
                                          <span>View Deal Details</span>
                                        </button>
                                        {canUpdate && (
                                          <button
                                            onClick={() => {
                                              setOpenMenuDealId(null);
                                              handleOpenEditModal(deal);
                                            }}
                                            className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-[#171B26] hover:bg-[#F1F3F7] font-medium transition-colors"
                                          >
                                            <Edit className="w-4 h-4 text-[#3659C9]" />
                                            <span>Edit Deal</span>
                                          </button>
                                        )}
                                        <div className="my-1 border-t border-[#E7EAF0]" />
                                        {canUpdate && (
                                          <>
                                            <button
                                              onClick={() => handleMarkStatus(deal.id, 'lost')}
                                              className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-[#B91C1C] hover:bg-[#FEF2F2] font-medium transition-colors"
                                            >
                                              <XCircle className="w-4 h-4 text-[#B91C1C]" />
                                              <span>Mark as Lost</span>
                                            </button>

                                            <button
                                              onClick={() => handleMarkStatus(deal.id, 'inactive')}
                                              className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-[#475569] hover:bg-[#F1F3F7] font-medium transition-colors"
                                            >
                                              <PauseCircle className="w-4 h-4 text-[#475569]" />
                                              <span>Mark as Inactive</span>
                                            </button>
                                            <div className="my-1 border-t border-[#E7EAF0]" />
                                          </>
                                        )}

                                        {canDelete && (
                                          <button
                                            onClick={() => {
                                              setOpenMenuDealId(null);
                                              handleDelete(deal.id);
                                            }}
                                            className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-[#B91C1C] hover:bg-[#FEF2F2] font-medium transition-colors"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                            <span>Delete Deal</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-2.5 flex items-center justify-between gap-2">
                                  <span className="font-semibold text-xs text-[#171B26] tabular-nums">
                                    ₹{Number(deal.value).toLocaleString('en-IN')}
                                  </span>
                                  {isSuper && deal.organization?.name && (
                                    <span
                                      className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#F1F3F7] text-[#697386] border border-[#E7EAF0] max-w-[130px] truncate"
                                      title={deal.organization.name}
                                    >
                                      <Building className="w-3 h-3 text-[#9AA2B1] flex-shrink-0" />
                                      <span className="truncate">{deal.organization.name}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* =========================================================================
            VIEW 2: LOST DEALS (HIDDEN ARCHIVE - CLEAN TABLE & CARD VIEW)
           ========================================================================= */}
        {activeView === 'lost' && (
          <div className="space-y-4">
            {/* Context Info Banner */}
            <div className="p-3.5 rounded-lg bg-white border border-[#E7EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-[#171B26]">Archived Lost Deals</h3>
                  <p className="text-[12px] text-[#697386] mt-0.5">
                    Deals marked closed-lost are preserved here to keep your active pipeline clean. You can reactivate them back into the pipeline anytime.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 text-xs font-medium text-[#697386]">
                <div className="px-2.5 py-1 rounded-md bg-[#FEF2F2] border border-[#B91C1C]/20 text-[12px] text-[#B91C1C] font-medium tabular-nums">
                  Lost Value: <span className="font-semibold text-[#B91C1C]">₹{lostValue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* List / Cards */}
            {filteredLostDeals.length === 0 ? (
              <div className="bg-white rounded-lg border border-[#E7EAF0] p-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="w-10 h-10 rounded-full bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center mx-auto mb-2">
                  <XCircle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#171B26]">
                  {archiveSearch ? 'No matching lost deals found' : 'No lost deals in record'}
                </h3>
                <p className="text-[12px] text-[#697386] mt-1 max-w-sm mx-auto">
                  {archiveSearch
                    ? `No lost deals match your search query "${archiveSearch}".`
                    : 'Deals marked as Closed Lost from your pipeline board will appear here for historical tracking.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px] divide-y divide-[#E7EAF0]">
                  {filteredLostDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F7F8FA] transition-colors"
                  >
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#B91C1C]/10">
                        <XCircle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-[13px] font-semibold text-[#171B26] truncate">{deal.title}</h4>
                          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-[#B91C1C]" />
                            Lost
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#697386] mt-1">
                          {deal.organization?.name && (
                            <span className="flex items-center text-[#171B26] font-medium">
                              <Building className="w-3.5 h-3.5 mr-1 text-[#9AA2B1]" />
                              {deal.organization.name}
                            </span>
                          )}
                          {deal.contact && (
                            <span className="flex items-center text-[#171B26] font-medium">
                              <User className="w-3.5 h-3.5 mr-1 text-[#9AA2B1]" />
                              {deal.contact.first_name} {deal.contact.last_name}
                              {deal.contact.company_name ? ` (${deal.contact.company_name})` : ''}
                            </span>
                          )}
                          {deal.stage && (
                            <span className="flex items-center">
                              <Layers className="w-3.5 h-3.5 mr-1 text-[#9AA2B1]" />
                              Last stage: {deal.stage.name}
                            </span>
                          )}
                          <span className="flex items-center text-[#697386] text-[11px] tabular-nums">
                            <Calendar className="w-3 h-3 mr-1 text-[#9AA2B1]" />
                            {new Date(deal.updated_at || deal.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E7EAF0]">
                      <div className="text-left sm:text-right">
                        <span className="text-[13px] font-semibold text-[#171B26] block tabular-nums">
                          ₹{Number(deal.value).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-[#697386]">Opportunity value</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {canUpdate && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(deal)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-white hover:bg-[#F1F3F7] text-[#171B26] text-[12px] font-medium border border-[#E7EAF0] transition-colors shadow-2xs"
                              title="Edit Deal details and valuation"
                            >
                              <Edit className="w-3.5 h-3.5 text-[#3659C9]" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleReactivateDeal(deal.id)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-white hover:bg-[#F1F3F7] text-[#171B26] text-[12px] font-medium border border-[#E7EAF0] transition-colors shadow-2xs"
                              title="Reactivate and return to Active Pipeline"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-[#3659C9]" />
                              <span>Reactivate</span>
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(deal.id)}
                            className="p-1.5 rounded-md text-[#697386] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                            title="Permanently Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            VIEW 3: INACTIVE / ON-HOLD DEALS (HIDDEN ARCHIVE - CLEAN TABLE & CARD VIEW)
           ========================================================================= */}
        {activeView === 'inactive' && (
          <div className="space-y-4">
            {/* Context Info Banner */}
            <div className="p-3.5 rounded-lg bg-white border border-[#E7EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-md bg-[#F1F3F7] text-[#697386] flex items-center justify-center flex-shrink-0">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-[#171B26]">Inactive & Dormant Deals</h3>
                  <p className="text-[12px] text-[#697386] mt-0.5">
                    Deals put on hold, cold leads, or paused discussions. They are kept off the active board so your team stays focused on hot opportunities.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 text-xs font-medium text-[#697386]">
                <div className="px-2.5 py-1 rounded-md bg-[#F1F3F7] border border-[#E7EAF0] text-[12px] text-[#171B26] font-medium tabular-nums">
                  Inactive Value: <span className="font-semibold text-[#171B26]">₹{inactiveValue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* List / Cards */}
            {filteredInactiveDeals.length === 0 ? (
              <div className="bg-white rounded-lg border border-[#E7EAF0] p-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="w-10 h-10 rounded-full bg-[#F1F3F7] text-[#697386] flex items-center justify-center mx-auto mb-2">
                  <Archive className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#171B26]">
                  {archiveSearch ? 'No matching inactive deals found' : 'No inactive deals'}
                </h3>
                <p className="text-[12px] text-[#697386] mt-1 max-w-sm mx-auto">
                  {archiveSearch
                    ? `No inactive deals match your search query "${archiveSearch}".`
                    : 'When you place a deal on hold or mark it inactive, it will be stored here safely.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px] divide-y divide-[#E7EAF0]">
                  {filteredInactiveDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F7F8FA] transition-colors"
                  >
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-md bg-[#F1F3F7] text-[#697386] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#E7EAF0]">
                        <PauseCircle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-[13px] font-semibold text-[#171B26] truncate">{deal.title}</h4>
                          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-[#F1F3F7] text-[#697386] border border-[#E7EAF0]">
                            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-[#697386]" />
                            Inactive
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#697386] mt-1">
                          {deal.organization?.name && (
                            <span className="flex items-center text-[#171B26] font-medium">
                              <Building className="w-3.5 h-3.5 mr-1 text-[#9AA2B1]" />
                              {deal.organization.name}
                            </span>
                          )}
                          {deal.contact && (
                            <span className="flex items-center text-[#171B26] font-medium">
                              <User className="w-3.5 h-3.5 mr-1 text-[#9AA2B1]" />
                              {deal.contact.first_name} {deal.contact.last_name}
                              {deal.contact.company_name ? ` (${deal.contact.company_name})` : ''}
                            </span>
                          )}
                          {deal.stage && (
                            <span className="flex items-center">
                              <Layers className="w-3.5 h-3.5 mr-1 text-[#9AA2B1]" />
                              Pipeline stage: {deal.stage.name}
                            </span>
                          )}
                          <span className="flex items-center text-[#697386] text-[11px] tabular-nums">
                            <Calendar className="w-3 h-3 mr-1 text-[#9AA2B1]" />
                            {new Date(deal.updated_at || deal.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E7EAF0]">
                      <div className="text-left sm:text-right">
                        <span className="text-[13px] font-semibold text-[#171B26] block tabular-nums">
                          ₹{Number(deal.value).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-[#697386]">Opportunity value</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {canUpdate && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(deal)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-white hover:bg-[#F1F3F7] text-[#171B26] text-[12px] font-medium border border-[#E7EAF0] transition-colors shadow-2xs"
                              title="Edit Deal details and valuation"
                            >
                              <Edit className="w-3.5 h-3.5 text-[#3659C9]" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleReactivateDeal(deal.id)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-white hover:bg-[#F1F3F7] text-[#171B26] text-[12px] font-medium border border-[#E7EAF0] transition-colors shadow-2xs"
                              title="Reactivate and return to Active Pipeline"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-[#3659C9]" />
                              <span>Reactivate</span>
                            </button>
                            <button
                              onClick={() => handleMarkStatus(deal.id, 'lost')}
                              className="p-1.5 rounded-md text-[#697386] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                              title="Move to Lost"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(deal.id)}
                            className="p-1.5 rounded-md text-[#697386] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                            title="Permanently Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: New / Edit Deal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[#171B26]/50 backdrop-blur-[2px] flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between flex-shrink-0 bg-[#F8FAFC]">
                <div>
                  <h3 className="font-semibold text-[#171B26] text-base">
                    {editingDeal ? 'Edit Deal Opportunity' : 'Create New Opportunity'}
                  </h3>
                  <p className="text-[12px] text-[#697386] mt-0.5">
                    {editingDeal
                      ? 'Update the deal value, stage, target close date, and associated contact.'
                      : 'Add a prospective deal to your sales pipeline.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingDeal(null);
                  }}
                  className="text-[#697386] hover:text-[#171B26] p-1.5 rounded-md hover:bg-[#F1F3F7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar">
                {isSuper && memberships.length > 0 && !editingDeal && (
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                      Organization * <span className="text-[11px] text-[#5B21B6] font-normal">(Super Admin)</span>
                    </label>
                    <select
                      value={formData.organization_id || currentOrg?.id}
                      onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
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
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Deal Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enterprise License Expansion"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] placeholder:text-[#9AA2B1] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Value (₹) *</label>
                    <input
                      type="number"
                      required
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] tabular-nums focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Target Close Date</label>
                    <input
                      type="date"
                      value={formData.expected_close_date}
                      onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] tabular-nums focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    />
                  </div>
                </div>

                {pipelines.length > 1 && (
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Pipeline</label>
                    <select
                      value={formData.pipeline_id || activePipeline?.id || ''}
                      onChange={(e) => {
                        const newPipeId = e.target.value;
                        const pipe = pipelines.find((p) => p.id === newPipeId);
                        setFormData({
                          ...formData,
                          pipeline_id: newPipeId,
                          stage_id: pipe?.stages?.[0]?.id || formData.stage_id,
                        });
                      }}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    >
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                    {editingDeal ? 'Pipeline Stage' : 'Initial Stage'}
                  </label>
                  <select
                    value={formData.stage_id}
                    onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  >
                    {(
                      pipelines.find((p) => p.id === formData.pipeline_id)?.stages ||
                      activePipeline?.stages ||
                      []
                    ).map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name} ({stage.probability}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Related Contact / Client</label>
                  <select
                    value={formData.contact_id}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  >
                    <option value="">No Contact Selected</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({c.company_name || 'No company'})
                      </option>
                    ))}
                  </select>
                </div>

                {editingDeal && (
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Deal Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Deal['status'] })}
                      className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                    >
                      <option value="open">Active / Open</option>
                      <option value="won">Closed Won 🏆</option>
                      <option value="lost">Closed Lost</option>
                      <option value="inactive">Inactive / On-Hold</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-[#E7EAF0] bg-slate-50 flex items-center justify-end space-x-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingDeal(null);
                  }}
                  className="px-3.5 py-2 text-[13px] font-medium text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-colors"
                >
                  {editingDeal ? 'Save Changes' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View & Manage Deal Actions */}
      {viewingDeal && (
        <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-[#E7EAF0] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between flex-shrink-0 bg-[#F8FAFC]">
              <div>
                <h3 className="font-semibold text-[#171B26] text-base">{viewingDeal.title}</h3>
                <p className="text-[12px] text-[#697386] mt-0.5">
                  {viewingDeal.organization?.name || 'Organization Deal'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenEditModal(viewingDeal);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-slate-50 border border-[#E7EAF0] text-[#171B26] shadow-2xs transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-[#3659C9]" />
                    <span>Edit Deal</span>
                  </button>
                )}
                <button
                  onClick={() => setViewingDeal(null)}
                  className="text-[#697386] hover:text-[#171B26] p-1.5 rounded-md hover:bg-[#F1F3F7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar">
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#F7F8FA] rounded-lg border border-[#E7EAF0]">
                  <div>
                    <span className="text-[11px] font-medium text-[#697386] uppercase tracking-wider">Deal Value</span>
                    <p className="text-xl font-bold text-[#171B26] tabular-nums mt-0.5">
                      ₹{Number(viewingDeal.value).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#697386] uppercase tracking-wider">Current Status</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                          viewingDeal.status === 'won'
                            ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                            : viewingDeal.status === 'lost'
                            ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                            : viewingDeal.status === 'inactive'
                            ? 'bg-[#F1F3F7] text-[#475569] border border-[#CBD5E1]'
                            : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                        }`}
                      >
                        {viewingDeal.status === 'won'
                          ? 'Closed Won'
                          : viewingDeal.status === 'lost'
                          ? 'Closed Lost'
                          : viewingDeal.status === 'inactive'
                          ? 'Inactive / On-Hold'
                          : 'Active Opportunity'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deal Details */}
                <div className="space-y-2 text-xs">
                  {viewingDeal.expected_close_date && (
                    <div className="flex justify-between py-1.5 border-b border-[#E7EAF0]">
                      <span className="text-[#697386]">Expected Closing Date:</span>
                      <span className="font-medium text-[#171B26] tabular-nums">{viewingDeal.expected_close_date}</span>
                    </div>
                  )}
                  {viewingDeal.contact && (
                    <div className="flex justify-between py-1.5 border-b border-[#E7EAF0]">
                      <span className="text-[#697386]">Associated Contact:</span>
                      <span className="font-medium text-[#171B26]">
                        {viewingDeal.contact.first_name} {viewingDeal.contact.last_name}
                        {viewingDeal.contact.company_name ? ` (${viewingDeal.contact.company_name})` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Move Stage Selector (Active Pipeline) */}
                {canUpdate && activePipeline && viewingDeal.status === 'open' && (
                  <div>
                    <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">
                      Pipeline Stage
                    </label>
                    <select
                      value={
                        activePipeline.stages.some((s) => s.id === viewingDeal.stage_id)
                          ? viewingDeal.stage_id
                          : activePipeline.stages[0]?.id || ''
                      }
                      onChange={async (e) => {
                        const newStageId = e.target.value;
                        await handleStageChange(viewingDeal.id, newStageId);
                        setViewingDeal((prev) => (prev ? { ...prev, stage_id: newStageId } : null));
                      }}
                      className="w-full text-xs py-2 px-3 rounded-lg border border-[#E7EAF0] bg-white text-[#171B26] focus:outline-none focus:border-[#3659C9]"
                    >
                      {activePipeline.stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.probability}%)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Connected Deal Tasks & Follow-ups */}
                <div className="pt-2 border-t border-[#E7EAF0]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-[#3659C9]" />
                      <span className="text-[12px] font-semibold text-[#171B26]">Deal Tasks & Follow-ups</span>
                      <span className="text-[11px] text-[#697386] tabular-nums">({dealTasks.length})</span>
                    </div>
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => setIsAddingTask(!isAddingTask)}
                        className="text-[11px] text-[#3659C9] hover:underline font-medium flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Task</span>
                      </button>
                    )}
                  </div>

                  {isAddingTask && (
                    <div className="flex items-center space-x-2 mb-2 p-2 bg-[#F7F8FA] rounded-md border border-[#E7EAF0]">
                      <input
                        type="text"
                        placeholder="e.g. Follow up on contract, send quotation..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!newTaskTitle.trim() || !currentUser || !viewingDealOrgId) return;
                            setIsSavingDealTask(true);
                            try {
                              const newTask = await CRMService.createTask(
                                viewingDealOrgId,
                                {
                                  title: newTaskTitle.trim(),
                                  related_type: 'deal',
                                  related_id: viewingDeal.id,
                                  due_date: new Date(Date.now() + 2 * 86400000).toISOString(),
                                },
                                currentUser.id
                              );
                              setDealTasks((prev) => [newTask, ...prev]);
                              setNewTaskTitle('');
                              setIsAddingTask(false);
                              toast.success('Task connected to deal!');
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to add task');
                            } finally {
                              setIsSavingDealTask(false);
                            }
                          }
                        }}
                        className="flex-1 text-xs py-1.5 px-2.5 rounded border border-[#E7EAF0] bg-white text-[#171B26] focus:outline-none focus:border-[#3659C9]"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={isSavingDealTask || !newTaskTitle.trim()}
                        onClick={async () => {
                          if (!newTaskTitle.trim() || !currentUser || !viewingDealOrgId) return;
                          setIsSavingDealTask(true);
                          try {
                            const newTask = await CRMService.createTask(
                              viewingDealOrgId,
                              {
                                title: newTaskTitle.trim(),
                                related_type: 'deal',
                                related_id: viewingDeal.id,
                                due_date: new Date(Date.now() + 2 * 86400000).toISOString(),
                              },
                              currentUser.id
                            );
                            setDealTasks((prev) => [newTask, ...prev]);
                            setNewTaskTitle('');
                            setIsAddingTask(false);
                            toast.success('Task connected to deal!');
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to add task');
                          } finally {
                            setIsSavingDealTask(false);
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium bg-[#3659C9] text-white rounded hover:bg-[#2B47A1] transition-colors disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {dealTasks.length === 0 ? (
                    <p className="text-[11px] text-[#9AA2B1] italic">No active tasks connected to this deal.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {dealTasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-2 rounded bg-[#F7F8FA] border border-[#E7EAF0] text-xs"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <button
                              type="button"
                              onClick={async () => {
                                const nextStatus = t.status === 'completed' ? 'todo' : 'completed';
                                setDealTasks((prev) =>
                                  prev.map((item) => (item.id === t.id ? { ...item, status: nextStatus } : item))
                                );
                                if (viewingDealOrgId) {
                                  await CRMService.updateTask(t.id, viewingDealOrgId, { status: nextStatus });
                                }
                              }}
                            >
                              {t.status === 'completed' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#047857]" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-[#BAC0CE] hover:text-[#3659C9]" />
                              )}
                            </button>
                            <span className={t.status === 'completed' ? 'line-through text-[#9AA2B1]' : 'text-[#171B26]'}>
                              {t.title}
                            </span>
                          </div>
                          {t.due_date && (
                            <span className="text-[10px] text-[#697386] tabular-nums flex-shrink-0">
                              {new Date(t.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status Action Buttons */}
                {canUpdate && (
                  <div className="pt-2">
                    <label className="block text-[12px] font-semibold text-[#171B26] mb-2">
                      Change Deal Status
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {viewingDeal.status !== 'lost' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await handleMarkStatus(viewingDeal.id, 'lost');
                            setViewingDeal(null);
                          }}
                          className="flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] transition-colors"
                        >
                          <XCircle className="w-4 h-4 text-[#B91C1C]" />
                          <span>Mark as Lost</span>
                        </button>
                      )}

                      {viewingDeal.status !== 'inactive' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await handleMarkStatus(viewingDeal.id, 'inactive');
                            setViewingDeal(null);
                          }}
                          className="flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#F1F3F7] hover:bg-[#E2E8F0] text-[#334155] border border-[#CBD5E1] transition-colors"
                        >
                          <PauseCircle className="w-4 h-4 text-[#475569]" />
                          <span>Mark as Inactive</span>
                        </button>
                      )}

                      {(viewingDeal.status === 'lost' || viewingDeal.status === 'inactive') && (
                        <button
                          type="button"
                          onClick={async () => {
                            await handleReactivateDeal(viewingDeal.id);
                            setViewingDeal(null);
                          }}
                          className="col-span-2 flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] transition-colors"
                        >
                          <ArrowRight className="w-4 h-4 text-[#1D4ED8]" />
                          <span>Reactivate to Active Pipeline</span>
                        </button>
                      )}

                      {viewingDeal.status === 'open' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const wonStage = activePipeline?.stages?.find((s) => s.probability === 100) || activePipeline?.stages?.[activePipeline.stages.length - 1];
                            if (wonStage) {
                              await handleStageChange(viewingDeal.id, wonStage.id);
                            }
                            setViewingDeal(null);
                          }}
                          className="flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0] transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#047857]" />
                          <span>Mark as Won</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E7EAF0] flex items-center justify-between flex-shrink-0">
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      const id = viewingDeal.id;
                      setViewingDeal(null);
                      handleDelete(id);
                    }}
                    className="text-xs text-[#B91C1C] hover:underline font-medium flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Deal</span>
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setViewingDeal(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-[#171B26] bg-white border border-[#E7EAF0] hover:bg-[#F1F3F7] rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
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
