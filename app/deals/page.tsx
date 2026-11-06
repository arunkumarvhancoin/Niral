'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { CRMService } from '../../lib/services/crm-service';
import { Deal, Pipeline, PipelineStage, Contact } from '../../lib/types/crm';
import { hasPermission } from '../../lib/permissions';
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
} from 'lucide-react';

export default function DealsPage() {
  const { currentOrg, currentRole, currentStatus, currentUser } = useWorkspace();
  const [pipelines, setPipelines] = useState<(Pipeline & { stages: PipelineStage[] })[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Drag and Drop States
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(() => ({
    title: '',
    value: 50000,
    pipeline_id: '',
    stage_id: '',
    contact_id: '',
    expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  }));

  const canCreate = hasPermission(currentRole, currentStatus, 'crm:deals:create');
  const canUpdate = hasPermission(currentRole, currentStatus, 'crm:deals:update');
  const canDelete = hasPermission(currentRole, currentStatus, 'crm:deals:delete');

  const loadPipelineData = useCallback(async () => {
    if (!currentOrg?.id) return;
    if (deals.length === 0) {
      setIsLoading(true);
    }
    try {
      const pipes = await CRMService.getPipelines(currentOrg.id);
      setPipelines(pipes);

      const dealList = await CRMService.getDeals(currentOrg.id);
      setDeals(dealList);

      const contactList = await CRMService.getContacts(currentOrg.id);
      setContacts(contactList);

      if (pipes.length > 0 && pipes[0].stages?.length > 0) {
        setFormData((prev) => ({
          ...prev,
          pipeline_id: pipes[0].id,
          stage_id: pipes[0].stages[0].id,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, deals.length]);

  useEffect(() => {
    if (currentOrg?.id) {
      loadPipelineData();
    }
  }, [currentOrg?.id, loadPipelineData]);

  const handleStageChange = async (dealId: string, newStageId: string) => {
    if (!currentOrg || !canUpdate) return;
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

      await CRMService.updateDeal(dealId, currentOrg.id, {
        stage_id: newStageId,
        status: nextStatus,
      });

      await loadPipelineData();
    } catch (err: any) {
      alert(err.message || 'Failed to update deal stage');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !currentUser) return;
    try {
      await CRMService.createDeal(currentOrg.id, formData, currentUser.id);
      setIsModalOpen(false);
      await loadPipelineData();
    } catch (err: any) {
      alert(err.message || 'Creation failed');
    }
  };

  const handleDelete = async (dealId: string) => {
    if (!currentOrg || !canDelete) return;
    if (!confirm('Delete this deal?')) return;
    try {
      await CRMService.deleteDeal(dealId, currentOrg.id);
      await loadPipelineData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const activePipeline = pipelines[0];

  const openDeals = deals.filter((d) => d.status === 'open');
  const wonDeals = deals.filter((d) => d.status === 'won');
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;
  const avgDealSize = deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + Number(d.value || 0), 0) / deals.length) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Deals & Opportunities</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Interactive pipeline stages and opportunity tracking for {currentOrg?.name}.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Deal</span>
            </button>
          )}
        </div>

        {/* Pipeline Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center ring-1 ring-amber-500/10 flex-shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Pipeline</p>
              <p className="text-lg font-bold text-slate-900">${totalPipelineValue.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{openDeals.length} active opportunities</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-500/10 flex-shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Won Revenue</p>
              <p className="text-lg font-bold text-emerald-600">${wonValue.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600/80 font-medium">{wonDeals.length} closed won</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-500/10 flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Win Rate</p>
              <p className="text-lg font-bold text-blue-600">{winRate}%</p>
              <p className="text-[10px] text-slate-400">across {deals.length} total deals</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center ring-1 ring-purple-500/10 flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Avg Deal Size</p>
              <p className="text-lg font-bold text-slate-900">${avgDealSize.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">opportunity value</p>
            </div>
          </div>
        </div>

        {/* Pipeline Board */}
        {isLoading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading pipeline board...</div>
        ) : !activePipeline || !activePipeline.stages || activePipeline.stages.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
            <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">No active pipeline stages configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start select-none">
            {activePipeline.stages.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage_id === stage.id);
              const stageTotalValue = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
              const isDragOver = dragOverStageId === stage.id;
              const stageColor = stage.color || '#3b82f6';

              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={() => setDragOverStageId(null)}
                  onDrop={(e) => handleDrop(e, stage.id)}
                  className={`rounded-xl border transition-all flex flex-col min-h-[560px] overflow-hidden ${
                    isDragOver
                      ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-400/30 shadow-md'
                      : 'bg-slate-100/70 border-slate-200/80'
                  }`}
                >
                  {/* Top Color Accent */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: stageColor }} />

                  {/* Column Header */}
                  <div className="p-3.5 pb-3 border-b border-slate-200/80 bg-white/70 backdrop-blur-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: stageColor }}
                        />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          {stage.name}
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                        ${stageTotalValue.toLocaleString()} &bull; {stageDeals.length} deals
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      {stage.probability}%
                    </span>
                  </div>

                  {/* Deals List */}
                  <div className="p-3 space-y-2.5 flex-1 overflow-y-auto">
                    {stageDeals.length === 0 ? (
                      <div
                        className={`py-14 text-center text-xs rounded-xl border border-dashed transition-all flex flex-col items-center justify-center ${
                          isDragOver
                            ? 'border-indigo-400 bg-indigo-100/40 text-indigo-700 font-semibold'
                            : 'border-slate-200/80 text-slate-400 bg-white/40'
                        }`}
                      >
                        <BarChart3 className="w-5 h-5 text-slate-300 mb-1" />
                        <span>{isDragOver ? 'Drop deal here' : 'Drop deals here'}</span>
                      </div>
                    ) : (
                      stageDeals.map((deal) => {
                        const isBeingDragged = draggedDealId === deal.id;
                        const isWon = deal.status === 'won';
                        const isLost = deal.status === 'lost';

                        return (
                          <div
                            key={deal.id}
                            draggable={canUpdate}
                            onDragStart={(e) => handleDragStart(e, deal.id)}
                            onDragEnd={handleDragEnd}
                            className={`bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group relative border-l-4 ${
                              canUpdate ? 'cursor-grab active:cursor-grabbing' : ''
                            } ${isBeingDragged ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''}`}
                            style={{
                              borderLeftColor: isWon ? '#10b981' : isLost ? '#f43f5e' : stageColor,
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-1.5 flex-1 pr-1">
                                {canUpdate && (
                                  <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 mt-0.5 flex-shrink-0" />
                                )}
                                <h5 className="font-semibold text-slate-900 text-xs leading-snug">
                                  {deal.title}
                                </h5>
                              </div>
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(deal.id)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 transition-opacity"
                                  title="Delete deal"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="mt-2.5 flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                                ${Number(deal.value).toLocaleString()}
                              </span>
                              {deal.expected_close_date && (
                                <span className="text-[10px] text-slate-500 flex items-center font-medium">
                                  <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                                  {deal.expected_close_date}
                                </span>
                              )}
                            </div>

                            {/* Contact Info */}
                            {deal.contact && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-center space-x-1.5 truncate">
                                <div className="w-4 h-4 rounded-full bg-slate-100 text-[9px] font-bold flex items-center justify-center text-slate-600 flex-shrink-0">
                                  {deal.contact.first_name?.[0] || 'C'}
                                </div>
                                <span className="truncate">
                                  {deal.contact.first_name} {deal.contact.last_name}
                                </span>
                              </div>
                            )}

                            {/* Status Pill & Stage Select */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                deal.status === 'won'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : deal.status === 'lost'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {deal.status}
                              </span>

                              {/* Stage dropdown for accessibility/click fallback */}
                              {canUpdate && (
                                <select
                                  value={deal.stage_id}
                                  onChange={(e) => handleStageChange(deal.id, e.target.value)}
                                  className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded py-0.5 px-1 font-medium focus:outline-none transition-colors"
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

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">New Deal</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Deal Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enterprise License Expansion"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Value ($) *</label>
                    <input
                      type="number"
                      required
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Target Close Date</label>
                    <input
                      type="date"
                      value={formData.expected_close_date}
                      onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Initial Stage</label>
                  <select
                    value={formData.stage_id}
                    onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  >
                    {activePipeline?.stages?.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name} ({stage.probability}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Related Contact / Client</label>
                  <select
                    value={formData.contact_id}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="">No Contact Selected</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({c.company_name || 'No company'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
                  >
                    Create Deal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
