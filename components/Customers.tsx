
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Archive, Phone, Mail, MapPin, ArrowLeft, FileText, Download, Trash2, ExternalLink, Loader2,
  MessageSquare, Calendar, Clock, Search, Filter, DollarSign, ChevronRight, User, Building2,
  PhoneCall, PhoneOutgoing, MapPinned, StickyNote, CheckCircle2, AlertCircle, X, Edit3
} from 'lucide-react';
import { CalculatorState, CustomerProfile, CustomerActivity, ActivityType, LeadStage, CustomerSource, CustomerTag, EstimateRecord } from '../types';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from './PaginationControls';
import { getCustomerDocuments, deleteDocument, DocumentRecord } from '../services/documentService';
import { fetchCustomerActivities, createActivity, completeFollowUp, deleteActivity } from '../services/supabaseService';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const LEAD_STAGES: { value: LeadStage; label: string; color: string; icon: string }[] = [
  { value: 'new_lead', label: 'New Lead', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '●' },
  { value: 'contacted', label: 'Contacted', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: '●' },
  { value: 'site_visit', label: 'Site Visit', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: '●' },
  { value: 'quoted', label: 'Quoted', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '●' },
  { value: 'negotiating', label: 'Negotiating', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '●' },
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-700 border-green-200', icon: '✓' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700 border-red-200', icon: '✗' },
];

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'call', label: 'Phone Call', icon: <PhoneCall className="w-4 h-4"/>, color: 'text-green-600 bg-green-50' },
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4"/>, color: 'text-blue-600 bg-blue-50' },
  { value: 'text', label: 'Text/SMS', icon: <MessageSquare className="w-4 h-4"/>, color: 'text-violet-600 bg-violet-50' },
  { value: 'site_visit', label: 'Site Visit', icon: <MapPinned className="w-4 h-4"/>, color: 'text-amber-600 bg-amber-50' },
  { value: 'meeting', label: 'Meeting', icon: <User className="w-4 h-4"/>, color: 'text-indigo-600 bg-indigo-50' },
  { value: 'note', label: 'Note', icon: <StickyNote className="w-4 h-4"/>, color: 'text-slate-600 bg-slate-50' },
  { value: 'follow_up', label: 'Follow-Up', icon: <Calendar className="w-4 h-4"/>, color: 'text-orange-600 bg-orange-50' },
  { value: 'estimate_sent', label: 'Estimate Sent', icon: <FileText className="w-4 h-4"/>, color: 'text-cyan-600 bg-cyan-50' },
];

const SOURCE_OPTIONS: { value: CustomerSource; label: string }[] = [
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'google', label: 'Google/Search' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'repeat', label: 'Repeat Customer' },
  { value: 'walk_in', label: 'Walk-In' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'other', label: 'Other' },
];

const TAG_OPTIONS: { value: CustomerTag; label: string; color: string }[] = [
  { value: 'residential', label: 'Residential', color: 'bg-sky-100 text-sky-700' },
  { value: 'commercial', label: 'Commercial', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'industrial', label: 'Industrial', color: 'bg-slate-200 text-slate-700' },
  { value: 'new_construction', label: 'New Construction', color: 'bg-amber-100 text-amber-700' },
  { value: 'retrofit', label: 'Retrofit', color: 'bg-violet-100 text-violet-700' },
  { value: 'vip', label: 'VIP', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'builder', label: 'Builder', color: 'bg-orange-100 text-orange-700' },
  { value: 'contractor', label: 'Contractor', color: 'bg-teal-100 text-teal-700' },
  { value: 'property_manager', label: 'Property Mgr', color: 'bg-pink-100 text-pink-700' },
];

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface CustomersProps {
  state: CalculatorState;
  orgId?: string;
  viewingCustomerId: string | null;
  onSelectCustomer: (id: string | null) => void;
  onSaveCustomer: (customer: CustomerProfile) => void;
  onArchiveCustomer: (id: string) => void;
  onStartEstimate: (customer: CustomerProfile) => void;
  onLoadEstimate: (est: EstimateRecord) => void;
  autoOpen?: boolean;
  onAutoOpenComplete?: () => void;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return phone;
};

const getLeadStageInfo = (stage?: LeadStage) => {
  return LEAD_STAGES.find(s => s.value === stage) || LEAD_STAGES[0];
};

const getActivityTypeInfo = (type: ActivityType) => {
  return ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[5];
};

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export const Customers: React.FC<CustomersProps> = ({
  state,
  orgId,
  viewingCustomerId,
  onSelectCustomer,
  onSaveCustomer,
  onArchiveCustomer,
  onStartEstimate,
  onLoadEstimate,
  autoOpen,
  onAutoOpenComplete
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [formData, setFormData] = useState<CustomerProfile>({
    id: '', name: '', address: '', city: '', state: '', zip: '', email: '', phone: '', notes: '', status: 'Active',
    leadStage: 'new_lead', tags: [], companyName: '', alternatePhone: '', source: undefined, estimatedValue: 0,
  });
  const [customerDocs, setCustomerDocs] = useState<DocumentRecord[]>([]);
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<LeadStage | 'all'>('all');
  const [filterTag, setFilterTag] = useState<CustomerTag | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'activity' | 'history' | 'documents'>('activity');
  
  const [activityForm, setActivityForm] = useState({
    type: 'call' as ActivityType,
    subject: '',
    description: '',
    outcome: '',
    duration: 0,
    followUpDate: '',
  });
  const [savingActivity, setSavingActivity] = useState(false);

  useEffect(() => {
    if (autoOpen) {
      handleOpenModal();
      if (onAutoOpenComplete) onAutoOpenComplete();
    }
  }, [autoOpen]);

  useEffect(() => {
    if (viewingCustomerId && orgId) {
      setLoadingDocs(true);
      setLoadingActivities(true);
      getCustomerDocuments(orgId, viewingCustomerId)
        .then(docs => setCustomerDocs(docs))
        .catch(() => setCustomerDocs([]))
        .finally(() => setLoadingDocs(false));
      fetchCustomerActivities(orgId, viewingCustomerId)
        .then(acts => setActivities(acts))
        .catch(() => setActivities([]))
        .finally(() => setLoadingActivities(false));
    } else {
      setCustomerDocs([]);
      setActivities([]);
    }
  }, [viewingCustomerId, orgId]);

  const handleDeleteDoc = async (doc: DocumentRecord) => {
    if (!confirm(`Delete "${doc.filename}"?`)) return;
    setDeletingDocId(doc.id);
    const ok = await deleteDocument(doc.id, doc.storagePath);
    if (ok) setCustomerDocs(prev => prev.filter(d => d.id !== doc.id));
    setDeletingDocId(null);
  };

  const handleOpenModal = (customer?: CustomerProfile) => {
    if (customer) {
      setFormData({ ...customer, tags: customer.tags || [], leadStage: customer.leadStage || 'new_lead' });
    } else {
      setFormData({ 
        id: Math.random().toString(36).substr(2, 9), 
        name: '', address: '', city: '', state: '', zip: '', email: '', phone: '', notes: '', status: 'Active',
        leadStage: 'new_lead', tags: [], companyName: '', alternatePhone: '', source: undefined, estimatedValue: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) return alert('Name is required');
    onSaveCustomer(formData);
    setIsModalOpen(false);
  };

  const handleLogActivity = async () => {
    if (!activityForm.subject || !viewingCustomerId || !orgId) return;
    setSavingActivity(true);

    const newActivity = await createActivity({
      customerId: viewingCustomerId,
      type: activityForm.type,
      subject: activityForm.subject,
      description: activityForm.description,
      outcome: activityForm.outcome,
      duration: activityForm.duration || undefined,
      loggedBy: 'Admin',
      followUpDate: activityForm.followUpDate || undefined,
      followUpCompleted: false,
    }, orgId);

    if (newActivity) {
      setActivities(prev => [newActivity, ...prev]);
      const customer = state.customers.find(c => c.id === viewingCustomerId);
      if (customer) {
        onSaveCustomer({ 
          ...customer, 
          lastContactDate: new Date().toISOString(),
          nextFollowUp: activityForm.followUpDate || customer.nextFollowUp,
        });
      }
    }

    setActivityForm({ type: 'call', subject: '', description: '', outcome: '', duration: 0, followUpDate: '' });
    setIsActivityModalOpen(false);
    setSavingActivity(false);
  };

  const handleCompleteFollowUp = async (activityId: string) => {
    const ok = await completeFollowUp(activityId);
    if (ok) setActivities(prev => prev.map(a => a.id === activityId ? { ...a, followUpCompleted: true } : a));
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('Delete this activity?')) return;
    const ok = await deleteActivity(activityId);
    if (ok) setActivities(prev => prev.filter(a => a.id !== activityId));
  };

  const toggleTag = (tag: CustomerTag) => {
    const current = formData.tags || [];
    if (current.includes(tag)) {
      setFormData({ ...formData, tags: current.filter(t => t !== tag) });
    } else {
      setFormData({ ...formData, tags: [...current, tag] });
    }
  };

  const activeCustomers = useMemo(() => {
    let filtered = state.customers.filter(c => c.status !== 'Archived');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
      );
    }
    if (filterStage !== 'all') {
      filtered = filtered.filter(c => (c.leadStage || 'new_lead') === filterStage);
    }
    if (filterTag !== 'all') {
      filtered = filtered.filter(c => c.tags?.includes(filterTag));
    }
    return filtered;
  }, [state.customers, searchQuery, filterStage, filterTag]);

  const customersPagination = usePagination(activeCustomers, 10);

  const getCustomerRevenue = useCallback((customerId: string): number => {
    return state.savedEstimates
      .filter(e => (e.customerId === customerId || e.customer?.id === customerId) && (e.status === 'Paid' || e.status === 'Invoiced'))
      .reduce((sum, e) => sum + (e.totalValue || 0), 0);
  }, [state.savedEstimates]);

  const getCustomerJobCount = useCallback((customerId: string): number => {
    return state.savedEstimates.filter(e => e.customerId === customerId || e.customer?.id === customerId).length;
  }, [state.savedEstimates]);

  const pendingFollowUps = useMemo(() => {
    return activities.filter(a => a.followUpDate && !a.followUpCompleted);
  }, [activities]);

  const docTypeLabel = (type: string) => {
    const labels: Record<string, string> = { estimate: 'Estimate', invoice: 'Invoice', receipt: 'Receipt', work_order: 'Work Order', purchase_order: 'Purchase Order' };
    return labels[type] || type;
  };
  const docTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = { estimate: 'bg-blue-100 text-blue-700', invoice: 'bg-amber-100 text-amber-700', receipt: 'bg-green-100 text-green-700', work_order: 'bg-purple-100 text-purple-700', purchase_order: 'bg-slate-100 text-slate-700' };
    return colors[type] || 'bg-slate-100 text-slate-600';
  };

  // ══════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (viewingCustomerId) {
    const customer = state.customers.find(c => c.id === viewingCustomerId);
    if (!customer) return <div className="p-8 text-center text-slate-400">Customer not found.</div>;
    const customerEstimates = state.savedEstimates.filter(e => e.customerId === customer.id || e.customer?.id === customer.id);
    const totalRevenue = customerEstimates.filter(e => e.status === 'Paid' || e.status === 'Invoiced').reduce((s, e) => s + (e.totalValue || 0), 0);
    const stageInfo = getLeadStageInfo(customer.leadStage);

    return (
      <div className="space-y-6 animate-in fade-in zoom-in duration-200">
        <button onClick={() => onSelectCustomer(null)} className="text-slate-400 hover:text-slate-900 flex items-center gap-2 mb-2 text-[10px] font-black uppercase tracking-widest transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Customer List
        </button>

        {/* Customer Header Card */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{customer.name}</h2>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${stageInfo.color}`}>
                  {stageInfo.icon} {stageInfo.label}
                </span>
              </div>
              {customer.companyName && (
                <div className="flex items-center gap-1.5 mt-1.5 text-slate-500 text-sm font-medium">
                  <Building2 className="w-3.5 h-3.5" /> {customer.companyName}
                </div>
              )}
              {customer.tags && customer.tags.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {customer.tags.map(tag => {
                    const tagInfo = TAG_OPTIONS.find(t => t.value === tag);
                    return (
                      <span key={tag} className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${tagInfo?.color || 'bg-slate-100 text-slate-600'}`}>
                        {tagInfo?.label || tag}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="text-slate-400 flex flex-wrap gap-4 mt-4 font-bold text-sm">
                {customer.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-brand" /> {formatPhone(customer.phone)}</span>}
                {customer.alternatePhone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-300" /> {formatPhone(customer.alternatePhone)}</span>}
                {customer.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-brand" /> {customer.email}</span>}
                {customer.address && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand" /> {customer.address}{customer.city ? `, ${customer.city}` : ''}{customer.state ? `, ${customer.state}` : ''} {customer.zip || ''}</span>}
              </div>
              <div className="flex gap-4 mt-3 text-[11px] text-slate-300 font-semibold">
                {customer.source && <span>Source: <span className="text-slate-500">{SOURCE_OPTIONS.find(s => s.value === customer.source)?.label || customer.source}</span></span>}
                {customer.lastContactDate && <span>Last Contact: <span className="text-slate-500">{timeAgo(customer.lastContactDate)}</span></span>}
                {customer.nextFollowUp && (
                  <span className={new Date(customer.nextFollowUp) < new Date() ? 'text-red-400' : ''}>
                    Follow-Up: <span className="text-slate-500">{new Date(customer.nextFollowUp).toLocaleDateString()}</span>
                    {new Date(customer.nextFollowUp) < new Date() && <AlertCircle className="w-3 h-3 inline ml-1 text-red-400" />}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3 shrink-0">
              <div className="flex gap-2">
                {customer.phone && (
                  <a href={`tel:${customer.phone.replace(/\D/g, '')}`} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors" title="Call">
                    <PhoneOutgoing className="w-4 h-4" /> Call
                  </a>
                )}
                {customer.phone && (
                  <a href={`sms:${customer.phone.replace(/\D/g, '')}`} className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors" title="Text">
                    <MessageSquare className="w-4 h-4" /> Text
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors" title="Email">
                    <Mail className="w-4 h-4" /> Email
                  </a>
                )}
                {customer.address && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(`${customer.address} ${customer.city || ''} ${customer.state || ''} ${customer.zip || ''}`.trim())}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors" title="Directions">
                    <MapPinned className="w-4 h-4" /> Map
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsActivityModalOpen(true)} className="px-5 py-3 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-1.5 transition-all">
                  <Plus className="w-4 h-4" /> Log Activity
                </button>
                <button onClick={() => handleOpenModal(customer)} className="px-5 py-3 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => onStartEstimate(customer)} className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-200 flex items-center gap-1.5 transition-all">
                  <FileText className="w-3.5 h-3.5" /> Estimate
                </button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="text-center">
              <div className="text-2xl font-black text-slate-900">{customerEstimates.length}</div>
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Total Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-green-600">${totalRevenue.toLocaleString()}</div>
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-slate-900">{activities.length}</div>
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Interactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-slate-900">{pendingFollowUps.length}</div>
              <div className="text-[10px] font-black text-orange-300 uppercase tracking-widest mt-1">Pending Follow-Ups</div>
            </div>
          </div>
        </div>

        {/* Follow-Up Alerts */}
        {pendingFollowUps.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> Pending Follow-Ups
            </div>
            <div className="space-y-2">
              {pendingFollowUps.map(fu => (
                <div key={fu.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-orange-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{fu.subject}</p>
                      <p className="text-[11px] text-slate-400">
                        {fu.followUpDate ? new Date(fu.followUpDate).toLocaleDateString() : ''} 
                        {fu.followUpDate && new Date(fu.followUpDate) < new Date() && <span className="text-red-500 font-bold ml-1">OVERDUE</span>}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleCompleteFollowUp(fu.id)} className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-[10px] font-black uppercase transition-colors flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Done
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
          {(['activity', 'history', 'documents'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveDetailTab(tab)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeDetailTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {tab === 'activity' ? `Activity (${activities.length})` : tab === 'history' ? `Jobs (${customerEstimates.length})` : `Docs (${customerDocs.length})`}
            </button>
          ))}
        </div>

        {/* Activity Tab */}
        {activeDetailTab === 'activity' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand" />
                <span className="font-black uppercase text-[10px] tracking-widest text-slate-400">Activity Timeline</span>
              </div>
              <button onClick={() => setIsActivityModalOpen(true)} className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 flex items-center gap-1.5 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Log Activity
              </button>
            </div>
            {loadingActivities ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                <span className="ml-2 text-slate-400 text-sm">Loading activities...</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="p-12 text-center">
                <PhoneCall className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">No activities logged yet.</p>
                <p className="text-slate-300 text-xs mt-1">Log calls, emails, site visits, and notes to track your interactions.</p>
                <button onClick={() => setIsActivityModalOpen(true)} className="mt-4 px-6 py-2.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-colors">
                  Log First Activity
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {activities.map(activity => {
                  const typeInfo = getActivityTypeInfo(activity.type);
                  return (
                    <div key={activity.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl shrink-0 ${typeInfo.color}`}>{typeInfo.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800">{activity.subject}</span>
                            <span className="text-[10px] font-semibold text-slate-300 uppercase">{typeInfo.label}</span>
                          </div>
                          {activity.description && <p className="text-sm text-slate-500 mt-1">{activity.description}</p>}
                          {activity.outcome && <p className="text-sm text-slate-400 mt-1 italic">Outcome: {activity.outcome}</p>}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-300 font-semibold">
                            <span>{timeAgo(activity.createdAt)}</span>
                            {activity.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {activity.duration} min</span>}
                            {activity.loggedBy && <span>by {activity.loggedBy}</span>}
                            {activity.followUpDate && !activity.followUpCompleted && (
                              <span className={`text-orange-500 flex items-center gap-1 ${new Date(activity.followUpDate) < new Date() ? 'text-red-500 font-bold' : ''}`}>
                                <Calendar className="w-3 h-3" /> Follow-up: {new Date(activity.followUpDate).toLocaleDateString()}
                              </span>
                            )}
                            {activity.followUpCompleted && (
                              <span className="text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Follow-up complete</span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          {activity.followUpDate && !activity.followUpCompleted && (
                            <button onClick={() => handleCompleteFollowUp(activity.id)} className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Complete follow-up">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteActivity(activity.id)} className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeDetailTab === 'history' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 font-black uppercase text-[10px] tracking-widest text-slate-400">Job History</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-300 uppercase tracking-widest border-b">
                  <tr><th className="px-6 py-5">Date</th><th className="px-6 py-5">Status</th><th className="px-6 py-5">Quote</th><th className="px-6 py-5 text-right">Action</th></tr>
                </thead>
                <tbody>
                  {customerEstimates.map(est => (
                    <tr key={est.id} className="hover:bg-slate-50 border-b last:border-0 cursor-pointer transition-colors" onClick={() => onLoadEstimate(est)}>
                      <td className="px-6 py-5 font-bold text-slate-800">{new Date(est.date).toLocaleDateString()}</td>
                      <td className="px-6 py-5"><span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-600 uppercase tracking-tighter">{est.status}</span></td>
                      <td className="px-6 py-5 font-mono font-black text-slate-900">${est.totalValue?.toLocaleString() || 0}</td>
                      <td className="px-6 py-5 text-right text-brand font-black uppercase text-[10px] tracking-widest">Open Quote</td>
                    </tr>
                  ))}
                  {customerEstimates.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-slate-300 italic">No project history found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeDetailTab === 'documents' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand" />
                <span className="font-black uppercase text-[10px] tracking-widest text-slate-400">Documents</span>
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{customerDocs.length} Files</span>
            </div>
            {loadingDocs ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                <span className="ml-2 text-slate-400 text-sm">Loading documents...</span>
              </div>
            ) : customerDocs.length === 0 ? (
              <div className="p-12 text-center text-slate-300 italic text-sm">
                No documents yet. Documents are automatically saved when you generate estimates, invoices, work orders, or receipts.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {customerDocs.map(doc => (
                  <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="bg-slate-100 p-2.5 rounded-xl group-hover:bg-brand/10 transition-colors">
                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-brand transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-slate-800 truncate">{doc.filename}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${docTypeBadgeColor(doc.documentType)}`}>{docTypeLabel(doc.documentType)}</span>
                          <span className="text-[10px] text-slate-400">{new Date(doc.createdAt).toLocaleDateString()}</span>
                          {doc.fileSize > 0 && <span className="text-[10px] text-slate-300">{(doc.fileSize / 1024).toFixed(0)} KB</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {doc.publicUrl && <a href={doc.publicUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-300 hover:text-brand hover:bg-red-50 rounded-lg transition-colors" title="Open PDF"><ExternalLink className="w-4 h-4" /></a>}
                      {doc.publicUrl && <a href={doc.publicUrl} download={doc.filename} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Download"><Download className="w-4 h-4" /></a>}
                      <button onClick={() => handleDeleteDoc(doc)} disabled={deletingDocId === doc.id} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Delete">
                        {deletingDocId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {customer.notes && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Notes
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}

        {/* Log Activity Modal */}
        {isActivityModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsActivityModalOpen(false)}>
            <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Log Activity</h3>
                <button onClick={() => setIsActivityModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {ACTIVITY_TYPES.filter(t => t.value !== 'estimate_sent' && t.value !== 'status_change').map(t => (
                  <button key={t.value} onClick={() => setActivityForm({ ...activityForm, type: t.value })}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-[9px] font-black uppercase tracking-wider ${activityForm.type === t.value ? 'border-brand bg-red-50 text-brand' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                    {t.icon}<span>{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Subject *</label>
                  <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none transition-colors" 
                    value={activityForm.subject} onChange={e => setActivityForm({ ...activityForm, subject: e.target.value })} 
                    placeholder={activityForm.type === 'call' ? 'e.g. Discussed spray foam quote' : 'Brief description'} autoFocus />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Details</label>
                  <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold resize-none focus:border-brand focus:outline-none transition-colors" rows={3}
                    value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })} placeholder="Additional notes about this interaction..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Outcome</label>
                    <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-white focus:border-brand focus:outline-none" 
                      value={activityForm.outcome} onChange={e => setActivityForm({ ...activityForm, outcome: e.target.value })}>
                      <option value="">Select outcome...</option>
                      <option value="interested">Interested</option>
                      <option value="follow_up_needed">Follow-Up Needed</option>
                      <option value="left_voicemail">Left Voicemail</option>
                      <option value="no_answer">No Answer</option>
                      <option value="scheduled_visit">Scheduled Visit</option>
                      <option value="sent_estimate">Sent Estimate</option>
                      <option value="closed_won">Closed - Won</option>
                      <option value="closed_lost">Closed - Lost</option>
                      <option value="not_interested">Not Interested</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Duration (min)</label>
                    <input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" 
                      value={activityForm.duration || ''} onChange={e => setActivityForm({ ...activityForm, duration: parseInt(e.target.value) || 0 })} placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Schedule Follow-Up</label>
                  <input type="date" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" 
                    value={activityForm.followUpDate} onChange={e => setActivityForm({ ...activityForm, followUpDate: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-6 mt-2">
                <button onClick={() => setIsActivityModalOpen(false)} className="flex-1 p-4 border-2 border-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleLogActivity} disabled={!activityForm.subject || savingActivity} className="flex-1 p-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-green-700 shadow-lg shadow-green-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingActivity ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save Activity
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Customer Modal */}
        {isModalOpen && renderEditModal()}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EDIT MODAL
  // ══════════════════════════════════════════════════════════════════════════

  function renderEditModal() {
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
        <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{formData.name ? 'Edit Customer' : 'New Customer'}</h3>
            <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Full Name *</label>
                <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Company</label>
                <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" value={formData.companyName || ''} onChange={e => setFormData({...formData, companyName: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Address</label>
              <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">City</label>
                <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">State</label>
                <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Zip</label>
                <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Phone</label>
                <input type="tel" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Alt. Phone</label>
                <input type="tel" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" value={formData.alternatePhone || ''} onChange={e => setFormData({...formData, alternatePhone: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Email</label>
              <input type="email" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold focus:border-brand focus:outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Lead Stage</label>
                <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-white focus:border-brand focus:outline-none" value={formData.leadStage || 'new_lead'} onChange={e => setFormData({...formData, leadStage: e.target.value as LeadStage})}>
                  {LEAD_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Source</label>
                <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-white focus:border-brand focus:outline-none" value={formData.source || ''} onChange={e => setFormData({...formData, source: (e.target.value || undefined) as CustomerSource | undefined})}>
                  <option value="">Select source...</option>
                  {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Estimated Job Value</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 pl-10 font-bold focus:border-brand focus:outline-none" value={formData.estimatedValue || ''} onChange={e => setFormData({...formData, estimatedValue: parseFloat(e.target.value) || 0})} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Tags</label>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map(tag => (
                  <button key={tag.value} onClick={() => toggleTag(tag.value)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border-2 transition-all ${formData.tags?.includes(tag.value) ? `${tag.color} border-current` : 'bg-white text-slate-300 border-slate-100 hover:border-slate-200'}`}>
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Notes</label>
              <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold resize-none focus:border-brand focus:outline-none" rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Additional notes..." />
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 p-4 border-2 border-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSave} className="flex-1 p-4 bg-brand text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-hover shadow-lg shadow-red-200 transition-all">Save Customer</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Customer Database</h2>
          <p className="text-slate-500 font-medium text-sm">CRM & Pipeline Management</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input type="text" placeholder="Search by name, phone, email, company, or address..."
              className="w-full border-2 border-slate-100 rounded-xl py-3 pl-11 pr-4 font-bold text-sm focus:border-brand focus:outline-none transition-colors"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"><X className="w-4 h-4" /></button>
            )}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-3 rounded-xl border-2 transition-colors ${showFilters ? 'border-brand bg-red-50 text-brand' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            <Filter className="w-4 h-4" />
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Lead Stage</label>
              <select className="border-2 border-slate-100 rounded-lg px-3 py-2 text-xs font-bold bg-white focus:border-brand focus:outline-none" value={filterStage} onChange={e => setFilterStage(e.target.value as any)}>
                <option value="all">All Stages</option>
                {LEAD_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Tag</label>
              <select className="border-2 border-slate-100 rounded-lg px-3 py-2 text-xs font-bold bg-white focus:border-brand focus:outline-none" value={filterTag} onChange={e => setFilterTag(e.target.value as any)}>
                <option value="all">All Tags</option>
                {TAG_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {(filterStage !== 'all' || filterTag !== 'all') && (
              <button onClick={() => { setFilterStage('all'); setFilterTag('all'); }} className="text-[10px] font-black text-brand uppercase tracking-widest self-end pb-2 hover:underline">Clear Filters</button>
            )}
          </div>
        )}
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {LEAD_STAGES.map(stage => {
          const count = state.customers.filter(c => c.status !== 'Archived' && (c.leadStage || 'new_lead') === stage.value).length;
          return (
            <button key={stage.value} onClick={() => setFilterStage(filterStage === stage.value ? 'all' : stage.value)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${filterStage === stage.value ? `${stage.color} border-current` : 'bg-white border-slate-100 hover:border-slate-200'}`}>
              <div className="text-xl font-black">{count}</div>
              <div className="text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-70">{stage.label}</div>
            </button>
          );
        })}
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-6 py-5">Customer</th>
              <th className="px-6 py-5 hidden md:table-cell">Stage</th>
              <th className="px-6 py-5 hidden md:table-cell">Contact</th>
              <th className="px-6 py-5">Jobs</th>
              <th className="px-6 py-5 hidden lg:table-cell">Revenue</th>
              <th className="px-6 py-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeCustomers.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-slate-300 italic">
                {searchQuery || filterStage !== 'all' || filterTag !== 'all' ? 'No customers match your filters.' : 'No customers yet. Add your first customer to get started.'}
              </td></tr>
            ) : (
              customersPagination.currentItems.map(c => {
                const jobCount = getCustomerJobCount(c.id);
                const revenue = getCustomerRevenue(c.id);
                const stageInfo = getLeadStageInfo(c.leadStage);
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => onSelectCustomer(c.id)}>
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-800 group-hover:text-brand transition-colors">{c.name}</div>
                      {c.companyName && <div className="text-[11px] text-slate-400 mt-0.5">{c.companyName}</div>}
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {c.tags.slice(0, 2).map(tag => {
                            const tagInfo = TAG_OPTIONS.find(t => t.value === tag);
                            return <span key={tag} className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${tagInfo?.color || 'bg-slate-100 text-slate-500'}`}>{tagInfo?.label || tag}</span>;
                          })}
                          {c.tags.length > 2 && <span className="text-[8px] text-slate-300 font-bold self-center">+{c.tags.length - 2}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 hidden md:table-cell">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${stageInfo.color}`}>{stageInfo.label}</span>
                    </td>
                    <td className="px-6 py-5 hidden md:table-cell">
                      <div className="text-xs text-slate-500">{c.phone ? formatPhone(c.phone) : ''}</div>
                      <div className="text-xs text-slate-400">{c.email || ''}</div>
                      {!c.phone && !c.email && <span className="text-xs text-slate-300 italic">No contact info</span>}
                    </td>
                    <td className="px-6 py-5">
                      <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-600 uppercase tracking-tighter">{jobCount} Projects</span>
                    </td>
                    <td className="px-6 py-5 hidden lg:table-cell">
                      <span className={`font-mono font-black text-sm ${revenue > 0 ? 'text-green-600' : 'text-slate-300'}`}>${revenue.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2 items-center">
                        {c.phone && (
                          <a href={`tel:${c.phone.replace(/\D/g, '')}`} onClick={e => e.stopPropagation()} className="p-2 text-green-300 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Call">
                            <PhoneOutgoing className="w-4 h-4" />
                          </a>
                        )}
                        <button className="text-xs font-black text-brand uppercase tracking-widest p-2 hover:bg-red-50 rounded-lg flex items-center gap-1">
                          Details <ChevronRight className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onArchiveCustomer(c.id); }} className="p-2 text-slate-200 hover:text-slate-400 z-10">
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <PaginationControls
          currentPage={customersPagination.currentPage}
          totalPages={customersPagination.totalPages}
          totalItems={customersPagination.totalItems}
          pageSize={customersPagination.pageSize}
          hasNextPage={customersPagination.hasNextPage}
          hasPreviousPage={customersPagination.hasPreviousPage}
          onNextPage={customersPagination.nextPage}
          onPreviousPage={customersPagination.previousPage}
          onGoToPage={customersPagination.goToPage}
          onPageSizeChange={customersPagination.setPageSize}
        />
      </div>

      {isModalOpen && renderEditModal()}
    </div>
  );
};
