'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { Deal, Pipeline, PipelineStage, Contact } from '../../lib/types/crm';
import { hasPermission } from '../../lib/permissions';
import { toast } from '../../lib/stores/toast-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
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
  Sparkles,
  XCircle,
  Archive,
  RotateCcw,
  Search,
  PauseCircle,
  MoreVertical,
  ExternalLink,
  Layers,
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
  } = useWorkspace();
  const [pipelines, setPipelines] = useState<(Pipeline & { stages: PipelineStage[] })[]>([]);
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

  // New Deal Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(() => ({
    organization_id: currentOrg?.id || '',
    title: '',
    value: 50000,
    pipeline_id: '',
    stage_id: '',
    contact_id: '',
    expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  }));

  const canCreate = isSuper || hasPermission(currentRole, currentStatus, 'crm:deals:create', currentUser);
  const canUpdate = isSuper || hasPermission(currentRole, currentStatus, 'crm:deals:update', currentUser);
  const canDelete = isSuper || hasPermission(currentRole, currentStatus, 'crm:deals:delete', currentUser);

  const orgIdsKey = effectiveOrgIds.join(',');

  const loadPipelineData = useCallback(async () => {
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
      const pipes = await CRMService.getPipelines(pipeOrgId);
      setPipelines(pipes);

      const dealList = await CRMService.getDeals(effectiveOrgIds);
      setDeals(dealList);

      const contactList = await CRMService.getContacts(effectiveOrgIds);
      setContacts(contactList);

      if (pipes.length > 0 && pipes[0].stages?.length > 0) {
        setFormData((prev) => ({
          ...prev,
          organization_id: currentOrg?.id || effectiveOrgIds[0],
          pipeline_id: pipes[0].id,
          stage_id: pipes[0].stages[0].id,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgIdsKey, currentOrg?.id, deals.length]);

  useEffect(() => {
    if (effectiveOrgIds.length > 0) {
      loadPipelineData();
    }
  }, [orgIdsKey, loadPipelineData]);

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
      const activePipeline = pipelines[0];
      const targetStage = activePipeline?.stages?.find((s) => s.id === newStageId);
      const isWon = targetStage?.name.toLowerCase().includes('won');
      const isLost = targetStage?.name.toLowerCase().includes('lost');
      const nextStatus = isWon ? 'won' : isLost ? 'lost' : 'open';

      // Optimistic update
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId, status: nextStatus } : d))
      );

      await CRMService.updateDeal(dealId, targetOrgId, {
        stage_id: newStageId,
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

    const activePipeline = pipelines[0];
    const firstStageId = targetStageId || activePipeline?.stages?.[0]?.id;
    if (!firstStageId) {
      toast.error('No pipeline stage available to reactivate deal into.');
      return;
    }

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, status: 'open', stage_id: firstStageId } : d))
    );

    try {
      await CRMService.updateDeal(dealId, targetOrgId, {
        status: 'open',
        stage_id: firstStageId,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetOrgId = formData.organization_id || currentOrg?.id;
    if (!targetOrgId || !currentUser) return;
    try {
      await CRMService.createDeal(targetOrgId, formData, currentUser.id);
      toast.success(`Deal "${formData.title}" created successfully!`);
      setIsModalOpen(false);
      await loadPipelineData();
    } catch (err: any) {
      toast.error(err.message || 'Creation failed');
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

  const activePipeline = pipelines[0];

  // Deal Categorization
  // Active deals on board: open deals + closed won deals (excluding lost & inactive)
  const activePipelineDeals = deals.filter((d) => d.status !== 'lost' && d.status !== 'inactive');
  const openDeals = deals.filter((d) => d.status === 'open');
  const wonDeals = deals.filter((d) => d.status === 'won');
  const lostDeals = deals.filter((d) => d.status === 'lost');
  const inactiveDeals = deals.filter((d) => d.status === 'inactive');

  const totalPipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const lostValue = lostDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const inactiveValue = inactiveDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;
  const avgDealSize = deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + Number(d.value || 0), 0) / deals.length) : 0;

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
              onClick={() => setIsModalOpen(true)}
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
            onClick={() => setActiveView('pipeline')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              activeView === 'pipeline'
                ? 'bg-[#F0F4FE]/60 border-[#3659C9] ring-1 ring-[#3659C9] shadow-xs'
                : 'bg-white border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#BAC0CE]'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-[#F1F3F7] text-[#3659C9] flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#697386]">Active Pipeline</p>
                <p className="text-lg font-semibold text-[#171B26] truncate tabular-nums">₹{totalPipelineValue.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-[#697386]">{openDeals.length} open opportunities</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center space-x-3">
            <div className="w-8 h-8 rounded-md bg-[#ECFDF5] text-[#047857] flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#697386]">Won Revenue</p>
              <p className="text-lg font-semibold text-[#047857] truncate tabular-nums">₹{wonValue.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-[#047857] font-medium">{wonDeals.length} closed won</p>
            </div>
          </div>

          <div
            onClick={() => setActiveView('lost')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              activeView === 'lost'
                ? 'bg-[#FEF2F2]/60 border-[#B91C1C] ring-1 ring-[#B91C1C] shadow-xs'
                : 'bg-white border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#BAC0CE]'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center flex-shrink-0">
                <XCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#697386]">Lost Deals</p>
                <p className="text-lg font-semibold text-[#B91C1C] truncate tabular-nums">₹{lostValue.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-[#697386]">{lostDeals.length} closed lost</p>
              </div>
            </div>
          </div>

          <div
            onClick={() => setActiveView('inactive')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              activeView === 'inactive'
                ? 'bg-[#F1F3F7] border-[#697386] ring-1 ring-[#697386] shadow-xs'
                : 'bg-white border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#BAC0CE]'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-[#F1F3F7] text-[#697386] flex items-center justify-center flex-shrink-0">
                <Archive className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#697386]">Inactive / On-Hold</p>
                <p className="text-lg font-semibold text-[#171B26] truncate tabular-nums">₹{inactiveValue.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-[#697386]">{inactiveDeals.length} dormant</p>
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
                {activePipelineDeals.length}
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

        {/* =========================================================================
            VIEW 1: ACTIVE PIPELINE (KANBAN BOARD - NO LOST/INACTIVE CLUTTER)
           ========================================================================= */}
        {activeView === 'pipeline' && (
          <>
            {isLoading ? (
              <div className="py-20 text-center text-xs text-[#697386]">Loading pipeline board...</div>
            ) : !activePipeline || !activePipeline.stages || activePipeline.stages.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-lg border border-[#E7EAF0]">
                <BarChart3 className="w-8 h-8 text-[#9AA2B1] mx-auto mb-2" />
                <p className="text-[13px] font-medium text-[#697386]">No active pipeline stages configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-start select-none">
                {activePipeline.stages.map((stage) => {
                  // Strictly filter for active pipeline deals (hide lost and inactive from the open board)
                  const stageDeals = activePipelineDeals.filter((d) => d.stage_id === stage.id);
                  const stageTotalValue = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
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

                      {/* Deals List */}
                      <div className="p-2.5 space-y-2 flex-1 overflow-y-auto">
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
                                className={`bg-white p-3 rounded-md border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#BAC0CE] transition-all group relative border-l-2 ${
                                  canUpdate ? 'cursor-grab active:cursor-grabbing' : ''
                                } ${isBeingDragged ? 'opacity-40 scale-95 border-dashed border-[#3659C9]' : ''}`}
                                style={{
                                  borderLeftColor: isWon ? '#047857' : stageColor,
                                }}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start space-x-1.5 flex-1 pr-1">
                                    {canUpdate && (
                                      <GripVertical className="w-3.5 h-3.5 text-[#9AA2B1] group-hover:text-[#697386] mt-0.5 flex-shrink-0" />
                                    )}
                                    <div>
                                      <h5 className="font-medium text-[#171B26] text-[13px] leading-snug">
                                        {deal.title}
                                      </h5>
                                      {deal.organization?.name && (
                                        <div className="mt-1">
                                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F1F3F7] text-[#697386] border border-[#E7EAF0]">
                                            <Building className="w-2.5 h-2.5 text-[#9AA2B1]" />
                                            <span className="truncate max-w-[130px]">{deal.organization.name}</span>
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Quick Actions Menu Trigger */}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuDealId(isMenuOpen ? null : deal.id);
                                      }}
                                      className="p-1 rounded text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] transition-colors"
                                      title="Deal Options"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Dropdown Options */}
                                    {isMenuOpen && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[#E7EAF0] py-1 z-40 text-left animate-in fade-in-50 zoom-in-95 duration-100"
                                      >
                                        {canUpdate && (
                                          <>
                                            <button
                                              onClick={() => handleMarkStatus(deal.id, 'lost')}
                                              className="w-full flex items-center space-x-2 px-3 py-1.5 text-[12px] text-[#B91C1C] hover:bg-[#FEF2F2] font-medium transition-colors"
                                            >
                                              <XCircle className="w-3.5 h-3.5 text-[#B91C1C]" />
                                              <span>Mark as Lost</span>
                                            </button>

                                            <button
                                              onClick={() => handleMarkStatus(deal.id, 'inactive')}
                                              className="w-full flex items-center space-x-2 px-3 py-1.5 text-[12px] text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] font-medium transition-colors"
                                            >
                                              <PauseCircle className="w-3.5 h-3.5 text-[#697386]" />
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
                                            className="w-full flex items-center space-x-2 px-3 py-1.5 text-[12px] text-[#B91C1C] hover:bg-[#FEF2F2] font-medium transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Delete Deal</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-2.5 flex items-center justify-between text-xs">
                                  <span className="font-semibold text-[#171B26] bg-[#F7F8FA] px-1.5 py-0.5 rounded border border-[#E7EAF0] tabular-nums text-[12px]">
                                    ₹{Number(deal.value).toLocaleString('en-IN')}
                                  </span>
                                  {deal.expected_close_date && (
                                    <span className="text-[10px] text-[#697386] flex items-center font-medium tabular-nums">
                                      <Calendar className="w-3 h-3 mr-1 text-[#9AA2B1]" />
                                      {deal.expected_close_date}
                                    </span>
                                  )}
                                </div>

                                {/* Contact Info */}
                                {deal.contact && (
                                  <div className="mt-2 pt-2 border-t border-[#E7EAF0] text-[11px] text-[#697386] flex items-center space-x-1.5 truncate">
                                    <div className="w-4 h-4 rounded-full bg-[#F1F3F7] text-[9px] font-semibold flex items-center justify-center text-[#697386] flex-shrink-0 border border-[#E7EAF0]">
                                      {deal.contact.first_name?.[0] || 'C'}
                                    </div>
                                    <span className="truncate">
                                      {deal.contact.first_name} {deal.contact.last_name}
                                    </span>
                                  </div>
                                )}

                                {/* Status Pill & Stage Select */}
                                <div className="mt-2 pt-2 border-t border-[#E7EAF0] flex items-center justify-between">
                                  <span
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                                      isWon
                                        ? 'bg-[#ECFDF5] text-[#047857] border border-[#047857]/20'
                                        : 'bg-[#F0F4FE] text-[#3659C9] border border-[#3659C9]/20'
                                    }`}
                                  >
                                    {isWon ? 'Won' : 'Open'}
                                  </span>

                                  {/* Stage dropdown for accessibility/click fallback */}
                                  {canUpdate && (
                                    <select
                                      value={deal.stage_id}
                                      onChange={(e) => handleStageChange(deal.id, e.target.value)}
                                      className="text-[10px] bg-white hover:bg-[#F1F3F7] text-[#697386] border border-[#E7EAF0] rounded py-0.5 px-1 font-medium focus:outline-none transition-colors"
                                    >
                                      {activePipeline.stages.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          &rarr; {s.name}
                                        </option>
                                      ))}
                                    </select>
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
              <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden divide-y divide-[#E7EAF0]">
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
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase bg-[#FEF2F2] text-[#B91C1C] border border-[#B91C1C]/20">
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
                          <button
                            onClick={() => handleReactivateDeal(deal.id)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-white hover:bg-[#F1F3F7] text-[#171B26] text-[12px] font-medium border border-[#E7EAF0] transition-colors shadow-2xs"
                            title="Reactivate and return to Active Pipeline"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-[#3659C9]" />
                            <span>Reactivate</span>
                          </button>
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
              <div className="bg-white rounded-lg border border-[#E7EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden divide-y divide-[#E7EAF0]">
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
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase bg-[#F1F3F7] text-[#697386] border border-[#E7EAF0]">
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
            )}
          </div>
        )}

        {/* Modal: New Deal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[#171B26]/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E7EAF0] max-w-md w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-[#E7EAF0] flex items-center justify-between">
                <h3 className="font-semibold text-[#171B26] text-sm">New Deal</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#697386] hover:text-[#171B26] p-1 rounded-md hover:bg-[#F1F3F7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {isSuper && memberships.length > 0 && (
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

                <div>
                  <label className="block text-[12px] font-medium text-[#171B26] mb-1.5">Initial Stage</label>
                  <select
                    value={formData.stage_id}
                    onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                    className="w-full text-[13px] rounded-md border border-[#E7EAF0] bg-white px-3 py-2 text-[#171B26] focus:outline-none focus:border-[#3659C9] focus:ring-1 focus:ring-[#3659C9] transition-all"
                  >
                    {activePipeline?.stages?.map((stage) => (
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

                <div className="pt-3 border-t border-[#E7EAF0] flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 text-[13px] font-medium text-[#697386] hover:text-[#171B26] hover:bg-[#F1F3F7] rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-[13px] font-medium text-white bg-[#3659C9] hover:bg-[#2B47A1] rounded-md shadow-xs transition-colors"
                  >
                    Create Deal
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
