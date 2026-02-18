import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Settings,
  Activity,
  Fuel,
  RotateCcw,
  Save,
  Loader2,
  RefreshCw,
  Zap,
  Edit3,
  X,
} from 'lucide-react';
import { CalculatorState, MaintenanceEquipment, MaintenanceServiceItem, MaintenanceServiceLog, MaintenanceJobUsage } from '../types';
import {
  fetchMaintenanceData,
  MaintenanceData,
  upsertMaintenanceEquipment,
  deleteMaintenanceEquipment,
  upsertServiceItem,
  deleteServiceItem,
  logService,
  addJobUsage,
  applyPendingUsage,
  syncJobsToMaintenance,
} from '../services/maintenanceService';
import { FeedbackButton } from './FeedbackButton';

interface EquipmentMaintenanceProps {
  state: CalculatorState;
  organizationId: string;
  onBack: () => void;
  onNotify: (notification: { type: 'success' | 'error'; message: string }) => void;
}

// ─── CATEGORY OPTIONS ───────────────────────────────────────────────────────

const EQUIPMENT_CATEGORIES = [
  { value: 'proportioner', label: 'Proportioner / Pump' },
  { value: 'compressor', label: 'Air Compressor' },
  { value: 'generator', label: 'Generator' },
  { value: 'hose', label: 'Heated Hose' },
  { value: 'gun', label: 'Spray Gun' },
  { value: 'rig', label: 'Spray Rig / Trailer' },
  { value: 'transfer_pump', label: 'Transfer Pump' },
  { value: 'safety', label: 'Safety Equipment' },
  { value: 'general', label: 'General / Other' },
];

// ─── HELPER: Progress bar percentage ────────────────────────────────────────

const getServiceProgress = (current: number, interval: number): number => {
  if (interval <= 0) return 0;
  return Math.min((current / interval) * 100, 100);
};

const getServiceStatus = (current: number, interval: number): 'ok' | 'warning' | 'overdue' => {
  if (interval <= 0) return 'ok';
  const pct = (current / interval) * 100;
  if (pct >= 100) return 'overdue';
  if (pct >= 80) return 'warning';
  return 'ok';
};

const statusColors = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  overdue: 'bg-red-500',
};

const statusBgColors = {
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  overdue: 'bg-red-50 border-red-200 text-red-700',
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export const EquipmentMaintenance: React.FC<EquipmentMaintenanceProps> = ({
  state,
  organizationId,
  onBack,
  onNotify,
}) => {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedEquipment, setExpandedEquipment] = useState<Set<string>>(new Set());
  
  // Modal states
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<MaintenanceEquipment | null>(null);
  const [showAddServiceItem, setShowAddServiceItem] = useState<string | null>(null); // equipmentId
  const [editingServiceItem, setEditingServiceItem] = useState<MaintenanceServiceItem | null>(null);
  const [showLogService, setShowLogService] = useState<{ equipmentId: string; serviceItemId?: string } | null>(null);
  const [showAddUsage, setShowAddUsage] = useState(false);
  const [activeTab, setActiveTab] = useState<'equipment' | 'usage' | 'logs'>('equipment');

  // ─── DATA LOADING ───────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await fetchMaintenanceData(organizationId);
    if (result) setData(result);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── SYNC SOLD JOBS ──────────────────────────────────────────────────────

  const handleSyncJobs = useCallback(async () => {
    setSyncing(true);
    try {
      const added = await syncJobsToMaintenance(organizationId, state.savedEstimates);
      if (added > 0) {
        await applyPendingUsage(organizationId);
        onNotify({ type: 'success', message: `Synced ${added} job${added > 1 ? 's' : ''} to maintenance tracker` });
      } else {
        // Still apply any pending
        await applyPendingUsage(organizationId);
        onNotify({ type: 'success', message: 'All jobs already synced' });
      }
      await loadData();
    } catch (err) {
      onNotify({ type: 'error', message: 'Failed to sync jobs' });
    }
    setSyncing(false);
  }, [organizationId, state.savedEstimates, loadData, onNotify]);

  // ─── COMPUTED VALUES ──────────────────────────────────────────────────────

  const totalSetsFromJobs = useMemo(() => {
    if (!data) return 0;
    return data.jobUsage.reduce((sum, j) => sum + j.totalSets, 0);
  }, [data]);

  const overdueCount = useMemo(() => {
    if (!data) return 0;
    return data.serviceItems.filter(si => {
      const setsStatus = si.intervalSets > 0 ? getServiceStatus(si.setsSinceLastService, si.intervalSets) : 'ok';
      const hoursStatus = si.intervalHours > 0 ? getServiceStatus(si.hoursSinceLastService, si.intervalHours) : 'ok';
      return setsStatus === 'overdue' || hoursStatus === 'overdue';
    }).length;
  }, [data]);

  const warningCount = useMemo(() => {
    if (!data) return 0;
    return data.serviceItems.filter(si => {
      const setsStatus = si.intervalSets > 0 ? getServiceStatus(si.setsSinceLastService, si.intervalSets) : 'ok';
      const hoursStatus = si.intervalHours > 0 ? getServiceStatus(si.hoursSinceLastService, si.intervalHours) : 'ok';
      return (setsStatus === 'warning' || hoursStatus === 'warning') && setsStatus !== 'overdue' && hoursStatus !== 'overdue';
    }).length;
  }, [data]);

  // ─── TOGGLE EXPAND ────────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpandedEquipment(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── LOADING STATE ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Equipment Maintenance</h1>
          <p className="text-slate-500 text-sm font-medium">Track service intervals based on material sprayed</p>
        </div>
        <FeedbackButton area="Equipment Maintenance" />
        <button
          onClick={handleSyncJobs}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-brand transition-colors disabled:opacity-50"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync Jobs
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Sets Sprayed"
          value={totalSetsFromJobs.toFixed(1)}
          icon={<Fuel className="w-5 h-5" />}
          color="bg-sky-50 text-sky-600 border-sky-200"
        />
        <StatCard
          label="Equipment Tracked"
          value={data?.equipment.length || 0}
          icon={<Wrench className="w-5 h-5" />}
          color="bg-slate-50 text-slate-600 border-slate-200"
        />
        <StatCard
          label="Services Due Soon"
          value={warningCount}
          icon={<Clock className="w-5 h-5" />}
          color="bg-amber-50 text-amber-600 border-amber-200"
        />
        <StatCard
          label="Overdue Services"
          value={overdueCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={overdueCount > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white rounded-2xl border border-slate-200 p-1">
        {(['equipment', 'usage', 'logs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all capitalize ${
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-lg'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab === 'equipment' ? 'Equipment & Service' : tab === 'usage' ? 'Job Usage Log' : 'Service History'}
          </button>
        ))}
      </div>

      {/* ─── EQUIPMENT TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'equipment' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingEquipment(null); setShowAddEquipment(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
            >
              <Plus className="w-4 h-4" /> Add Equipment
            </button>
          </div>

          {(!data?.equipment || data.equipment.length === 0) ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
              <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No equipment added yet.</p>
              <p className="text-slate-400 text-sm mt-1">Add your spray rig equipment to start tracking maintenance.</p>
            </div>
          ) : (
            data.equipment.map(equip => (
              <EquipmentCard
                key={equip.id}
                equipment={equip}
                isExpanded={expandedEquipment.has(equip.id)}
                onToggle={() => toggleExpand(equip.id)}
                onEdit={() => { setEditingEquipment(equip); setShowAddEquipment(true); }}
                onDelete={async () => {
                  if (confirm(`Delete "${equip.name}" and all its service items?`)) {
                    await deleteMaintenanceEquipment(equip.id);
                    onNotify({ type: 'success', message: `${equip.name} deleted` });
                    loadData();
                  }
                }}
                onAddServiceItem={() => setShowAddServiceItem(equip.id)}
                onEditServiceItem={(item) => { setEditingServiceItem(item); setShowAddServiceItem(equip.id); }}
                onDeleteServiceItem={async (itemId) => {
                  await deleteServiceItem(itemId);
                  loadData();
                }}
                onLogService={(serviceItemId?) => setShowLogService({ equipmentId: equip.id, serviceItemId })}
              />
            ))
          )}
        </div>
      )}

      {/* ─── USAGE TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'usage' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">Material sprayed from completed jobs. Auto-syncs from sold estimates.</p>
            <button
              onClick={() => setShowAddUsage(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-brand transition-colors"
            >
              <Plus className="w-4 h-4" /> Manual Entry
            </button>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Job Usage History</h3>
              <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full">
                {data?.jobUsage.length || 0} entries
              </span>
            </div>
            {(!data?.jobUsage || data.jobUsage.length === 0) ? (
              <div className="p-8 text-center text-slate-400 italic">
                No job usage recorded. Click "Sync Jobs" to import from sold estimates.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {data.jobUsage.map(usage => (
                  <div key={usage.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{usage.customerName || 'Unknown Job'}</span>
                        <span className="text-xs ml-2 text-slate-400">
                          {new Date(usage.jobDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">{usage.totalSets.toFixed(2)} sets</div>
                          <div className="text-[10px] text-slate-400">
                            OC: {usage.openCellSets.toFixed(2)} | CC: {usage.closedCellSets.toFixed(2)}
                          </div>
                        </div>
                        {usage.applied ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Applied</span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Pending</span>
                        )}
                      </div>
                    </div>
                    {usage.operatingHours > 0 && (
                      <div className="text-xs text-slate-400 mt-1">
                        {usage.operatingHours}h operating time
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── LOGS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Service History</h3>
          </div>
          {(!data?.serviceLogs || data.serviceLogs.length === 0) ? (
            <div className="p-8 text-center text-slate-400 italic">
              No service history yet. Log a service from the Equipment tab.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {data.serviceLogs.map(log => {
                const equip = data.equipment.find(e => e.id === log.equipmentId);
                const item = data.serviceItems.find(si => si.id === log.serviceItemId);
                return (
                  <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{equip?.name || 'Unknown'}</span>
                        {item && <span className="text-sm text-slate-500 ml-2">— {item.name}</span>}
                      </div>
                      <span className="text-xs text-slate-400">{new Date(log.serviceDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      {log.performedBy && <span>By: {log.performedBy}</span>}
                      <span>@ {log.setsAtService.toFixed(1)} sets</span>
                      {log.hoursAtService > 0 && <span>/ {log.hoursAtService}h</span>}
                    </div>
                    {log.notes && <p className="text-xs text-slate-400 mt-1 italic">{log.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MODALS ──────────────────────────────────────────────────────── */}

      {showAddEquipment && (
        <EquipmentModal
          equipment={editingEquipment}
          orgId={organizationId}
          onClose={() => { setShowAddEquipment(false); setEditingEquipment(null); }}
          onSaved={() => { setShowAddEquipment(false); setEditingEquipment(null); loadData(); onNotify({ type: 'success', message: 'Equipment saved' }); }}
        />
      )}

      {showAddServiceItem && (
        <ServiceItemModal
          equipmentId={showAddServiceItem}
          serviceItem={editingServiceItem}
          orgId={organizationId}
          onClose={() => { setShowAddServiceItem(null); setEditingServiceItem(null); }}
          onSaved={() => { setShowAddServiceItem(null); setEditingServiceItem(null); loadData(); onNotify({ type: 'success', message: 'Service item saved' }); }}
        />
      )}

      {showLogService && (
        <LogServiceModal
          equipmentId={showLogService.equipmentId}
          serviceItemId={showLogService.serviceItemId}
          equipment={data?.equipment || []}
          orgId={organizationId}
          onClose={() => setShowLogService(null)}
          onSaved={() => { setShowLogService(null); loadData(); onNotify({ type: 'success', message: 'Service logged — counters reset' }); }}
        />
      )}

      {showAddUsage && (
        <ManualUsageModal
          orgId={organizationId}
          onClose={() => setShowAddUsage(false)}
          onSaved={async () => {
            setShowAddUsage(false);
            await applyPendingUsage(organizationId);
            loadData();
            onNotify({ type: 'success', message: 'Manual usage added' });
          }}
        />
      )}
    </div>
  );
};

// ─── STAT CARD ──────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className={`rounded-2xl border p-4 ${color}`}>
    <div className="flex items-center gap-2 mb-2">{icon}<span className="text-[10px] font-black uppercase tracking-widest">{label}</span></div>
    <div className="text-2xl font-black">{value}</div>
  </div>
);

// ─── EQUIPMENT CARD ─────────────────────────────────────────────────────────

const EquipmentCard: React.FC<{
  equipment: MaintenanceEquipment;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddServiceItem: () => void;
  onEditServiceItem: (item: MaintenanceServiceItem) => void;
  onDeleteServiceItem: (id: string) => void;
  onLogService: (serviceItemId?: string) => void;
}> = ({ equipment, isExpanded, onToggle, onEdit, onDelete, onAddServiceItem, onEditServiceItem, onDeleteServiceItem, onLogService }) => {
  const worstStatus = useMemo(() => {
    let worst: 'ok' | 'warning' | 'overdue' = 'ok';
    for (const si of equipment.serviceItems) {
      if (si.intervalSets > 0) {
        const s = getServiceStatus(si.setsSinceLastService, si.intervalSets);
        if (s === 'overdue') return 'overdue';
        if (s === 'warning') worst = 'warning';
      }
      if (si.intervalHours > 0) {
        const s = getServiceStatus(si.hoursSinceLastService, si.intervalHours);
        if (s === 'overdue') return 'overdue';
        if (s === 'warning') worst = 'warning';
      }
    }
    return worst;
  }, [equipment.serviceItems]);

  const categoryLabel = EQUIPMENT_CATEGORIES.find(c => c.value === equipment.category)?.label || equipment.category;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="p-5 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          worstStatus === 'overdue' ? 'bg-red-100 text-red-600' :
          worstStatus === 'warning' ? 'bg-amber-100 text-amber-600' :
          'bg-emerald-100 text-emerald-600'
        }`}>
          <Wrench className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-lg truncate">{equipment.name}</h3>
            {worstStatus === 'overdue' && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full animate-pulse">
                SERVICE OVERDUE
              </span>
            )}
            {worstStatus === 'warning' && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                DUE SOON
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
            <span className="font-medium">{categoryLabel}</span>
            <span>•</span>
            <span>{equipment.lifetimeSets.toFixed(1)} lifetime sets</span>
            {equipment.lifetimeHours > 0 && <><span>•</span><span>{equipment.lifetimeHours.toFixed(0)}h total</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </div>

      {/* Expanded Content: Service Items */}
      {isExpanded && (
        <div className="border-t border-slate-100">
          <div className="p-4 bg-slate-50 flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Service Items</h4>
            <button
              onClick={onAddServiceItem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Service Item
            </button>
          </div>

          {equipment.serviceItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400 italic">
              No service items configured. Add oil changes, filter replacements, etc.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {equipment.serviceItems.map(si => {
                const setsStatus = si.intervalSets > 0 ? getServiceStatus(si.setsSinceLastService, si.intervalSets) : 'ok';
                const setsProgress = si.intervalSets > 0 ? getServiceProgress(si.setsSinceLastService, si.intervalSets) : 0;
                const hoursStatus = si.intervalHours > 0 ? getServiceStatus(si.hoursSinceLastService, si.intervalHours) : 'ok';
                const hoursProgress = si.intervalHours > 0 ? getServiceProgress(si.hoursSinceLastService, si.intervalHours) : 0;

                return (
                  <div key={si.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{si.name}</span>
                          {(setsStatus === 'overdue' || hoursStatus === 'overdue') && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        {si.description && <p className="text-xs text-slate-400 mt-0.5">{si.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onLogService(si.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Service Done
                        </button>
                        <button onClick={() => onEditServiceItem(si)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm('Delete this service item?')) onDeleteServiceItem(si.id); }} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="space-y-2">
                      {si.intervalSets > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-bold text-slate-500">Sets: {si.setsSinceLastService.toFixed(1)} / {si.intervalSets}</span>
                            <span className={`font-bold ${setsStatus === 'overdue' ? 'text-red-600' : setsStatus === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {setsProgress.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${statusColors[setsStatus]}`} style={{ width: `${Math.min(setsProgress, 100)}%` }} />
                          </div>
                        </div>
                      )}
                      {si.intervalHours > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-bold text-slate-500">Hours: {si.hoursSinceLastService.toFixed(0)} / {si.intervalHours}</span>
                            <span className={`font-bold ${hoursStatus === 'overdue' ? 'text-red-600' : hoursStatus === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {hoursProgress.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${statusColors[hoursStatus]}`} style={{ width: `${Math.min(hoursProgress, 100)}%` }} />
                          </div>
                        </div>
                      )}
                      {si.intervalSets === 0 && si.intervalHours === 0 && (
                        <p className="text-[10px] text-slate-400 italic">No service interval configured</p>
                      )}
                    </div>

                    {si.lastServicedAt && (
                      <div className="mt-2 text-[10px] text-slate-400">
                        Last serviced: {new Date(si.lastServicedAt).toLocaleDateString()}
                        {si.lastServicedBy && ` by ${si.lastServicedBy}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── EQUIPMENT MODAL ────────────────────────────────────────────────────────

const EquipmentModal: React.FC<{
  equipment: MaintenanceEquipment | null;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ equipment, orgId, onClose, onSaved }) => {
  const [name, setName] = useState(equipment?.name || '');
  const [description, setDescription] = useState(equipment?.description || '');
  const [category, setCategory] = useState(equipment?.category || 'general');
  const [status, setStatus] = useState(equipment?.status || 'active');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const result = await upsertMaintenanceEquipment({
      ...(equipment || {}),
      name: name.trim(),
      description: description.trim(),
      category,
      status: status as any,
    }, orgId);
    setSaving(false);
    if (result) onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 className="text-lg font-black text-slate-900 mb-4">{equipment ? 'Edit Equipment' : 'Add Equipment'}</h3>
      <div className="space-y-4">
        <InputField label="Equipment Name" value={name} onChange={setName} placeholder="e.g. Graco E-30 Proportioner" />
        <InputField label="Description (optional)" value={description} onChange={setDescription} placeholder="Notes about this equipment" />
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1 block">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-white">
            {EQUIPMENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        {equipment && (
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-white">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="retired">Retired</option>
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 py-3 px-4 bg-brand text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {equipment ? 'Update' : 'Add Equipment'}
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── SERVICE ITEM MODAL ─────────────────────────────────────────────────────

const ServiceItemModal: React.FC<{
  equipmentId: string;
  serviceItem: MaintenanceServiceItem | null;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ equipmentId, serviceItem, orgId, onClose, onSaved }) => {
  const [name, setName] = useState(serviceItem?.name || '');
  const [description, setDescription] = useState(serviceItem?.description || '');
  const [intervalSets, setIntervalSets] = useState(serviceItem?.intervalSets?.toString() || '');
  const [intervalHours, setIntervalHours] = useState(serviceItem?.intervalHours?.toString() || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const result = await upsertServiceItem({
      ...(serviceItem || {}),
      equipmentId,
      name: name.trim(),
      description: description.trim(),
      intervalSets: Number(intervalSets) || 0,
      intervalHours: Number(intervalHours) || 0,
    }, orgId);
    setSaving(false);
    if (result) onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 className="text-lg font-black text-slate-900 mb-4">{serviceItem ? 'Edit Service Item' : 'Add Service Item'}</h3>
      <div className="space-y-4">
        <InputField label="Service Name" value={name} onChange={setName} placeholder="e.g. Oil Change, Filter Replacement" />
        <InputField label="Description (optional)" value={description} onChange={setDescription} placeholder="What needs to be done" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Every N Sets</label>
            <input
              type="number"
              value={intervalSets}
              onChange={e => setIntervalSets(e.target.value)}
              placeholder="0 = not tracked"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium"
              min="0"
              step="0.5"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Sets of material sprayed</p>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Every N Hours</label>
            <input
              type="number"
              value={intervalHours}
              onChange={e => setIntervalHours(e.target.value)}
              placeholder="0 = not tracked"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium"
              min="0"
              step="1"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Operating hours</p>
          </div>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-700">
          <strong>Tip:</strong> Service triggers on whichever comes first — sets sprayed or operating hours. Leave at 0 to disable that trigger.
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 py-3 px-4 bg-brand text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {serviceItem ? 'Update' : 'Add Service Item'}
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── LOG SERVICE MODAL ──────────────────────────────────────────────────────

const LogServiceModal: React.FC<{
  equipmentId: string;
  serviceItemId?: string;
  equipment: MaintenanceEquipment[];
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ equipmentId, serviceItemId, equipment, orgId, onClose, onSaved }) => {
  const equip = equipment.find(e => e.id === equipmentId);
  const [performedBy, setPerformedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const result = await logService({
      equipmentId,
      serviceItemId: serviceItemId || null,
      performedBy: performedBy.trim(),
      notes: notes.trim(),
      setsAtService: equip?.lifetimeSets || 0,
      hoursAtService: equip?.lifetimeHours || 0,
    }, orgId);
    setSaving(false);
    if (result) onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 className="text-lg font-black text-slate-900 mb-1">Log Service Completed</h3>
      <p className="text-sm text-slate-500 mb-4">{equip?.name}</p>
      <div className="space-y-4">
        <InputField label="Performed By" value={performedBy} onChange={setPerformedBy} placeholder="Technician name" />
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Parts used, issues found, etc."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium resize-none h-20"
          />
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
          This will reset the service counter and log the current equipment totals as a snapshot.
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Confirm Service
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── MANUAL USAGE MODAL ─────────────────────────────────────────────────────

const ManualUsageModal: React.FC<{
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ orgId, onClose, onSaved }) => {
  const [customerName, setCustomerName] = useState('');
  const [openCellSets, setOpenCellSets] = useState('');
  const [closedCellSets, setClosedCellSets] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const oc = Number(openCellSets) || 0;
    const cc = Number(closedCellSets) || 0;
    if (oc === 0 && cc === 0) return;
    setSaving(true);
    const result = await addJobUsage({
      openCellSets: oc,
      closedCellSets: cc,
      operatingHours: Number(operatingHours) || 0,
      customerName: customerName.trim(),
      notes: notes.trim(),
    }, orgId);
    setSaving(false);
    if (result) onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 className="text-lg font-black text-slate-900 mb-4">Manual Usage Entry</h3>
      <div className="space-y-4">
        <InputField label="Customer / Job Name" value={customerName} onChange={setCustomerName} placeholder="Optional label" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Open Cell Sets</label>
            <input type="number" value={openCellSets} onChange={e => setOpenCellSets(e.target.value)} placeholder="0" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" min="0" step="0.1" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Closed Cell Sets</label>
            <input type="number" value={closedCellSets} onChange={e => setClosedCellSets(e.target.value)} placeholder="0" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" min="0" step="0.1" />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1 block">Operating Hours (optional)</label>
          <input type="number" value={operatingHours} onChange={e => setOperatingHours(e.target.value)} placeholder="0" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" min="0" step="0.5" />
        </div>
        <InputField label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Any additional notes" />
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 px-4 bg-brand text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Usage
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── SHARED UI COMPONENTS ───────────────────────────────────────────────────

const ModalOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
    <div className="bg-white md:rounded-3xl rounded-t-3xl p-6 w-full md:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="md:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
      {children}
      <div className="md:hidden h-[env(safe-area-inset-bottom)]" />
    </div>
  </div>
);

const InputField: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="text-xs font-bold text-slate-600 mb-1 block">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
    />
  </div>
);
