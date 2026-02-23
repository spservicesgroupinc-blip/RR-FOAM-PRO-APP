
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Archive, Phone, Mail, MapPin, ArrowLeft, FileText, Download, Trash2, ExternalLink, Loader2, Receipt, HardHat, ClipboardList } from 'lucide-react';
import { CalculatorState, CustomerProfile, EstimateRecord } from '../types';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from './PaginationControls';
import { getCustomerDocuments, deleteDocument, DocumentRecord } from '../services/documentService';
import { FeedbackButton } from './FeedbackButton';

interface CustomersProps {
  state: CalculatorState;
  orgId?: string;
  viewingCustomerId: string | null;
  onSelectCustomer: (id: string | null) => void;
  onSaveCustomer: (customer: CustomerProfile) => void;
  onArchiveCustomer: (id: string) => void;
  onStartEstimate: (customer: CustomerProfile) => void;
  onLoadEstimate: (est: EstimateRecord) => void;
  onOpenEstimateStage?: (est: EstimateRecord) => void;
  onOpenWorkOrderStage?: (est: EstimateRecord) => void;
  onOpenInvoiceStage?: (est: EstimateRecord) => void;
  autoOpen?: boolean;
  onAutoOpenComplete?: () => void;
}

export const Customers: React.FC<CustomersProps> = ({
  state,
  orgId,
  viewingCustomerId,
  onSelectCustomer,
  onSaveCustomer,
  onArchiveCustomer,
  onStartEstimate,
  onLoadEstimate,
  onOpenEstimateStage,
  onOpenWorkOrderStage,
  onOpenInvoiceStage,
  autoOpen,
  onAutoOpenComplete
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CustomerProfile>({
    id: '', name: '', address: '', city: '', state: '', zip: '', email: '', phone: '', notes: '', status: 'Active'
  });
  const [customerDocs, setCustomerDocs] = useState<DocumentRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Intelligent Workflow: Auto-open modal if requested via Quick Actions
  useEffect(() => {
    if (autoOpen) {
      handleOpenModal();
      if (onAutoOpenComplete) onAutoOpenComplete();
    }
  }, [autoOpen]);

  // Fetch documents when viewing a customer
  useEffect(() => {
    if (viewingCustomerId && orgId) {
      setLoadingDocs(true);
      getCustomerDocuments(orgId, viewingCustomerId)
        .then(docs => setCustomerDocs(docs))
        .catch(() => setCustomerDocs([]))
        .finally(() => setLoadingDocs(false));
    } else {
      setCustomerDocs([]);
    }
  }, [viewingCustomerId, orgId]);

  const handleDeleteDoc = async (doc: DocumentRecord) => {
    if (!confirm(`Delete "${doc.filename}"?`)) return;
    setDeletingDocId(doc.id);
    const ok = await deleteDocument(doc.id, doc.storagePath);
    if (ok) {
      setCustomerDocs(prev => prev.filter(d => d.id !== doc.id));
    }
    setDeletingDocId(null);
  };

  const docTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      estimate: 'Estimate',
      invoice: 'Invoice',
      receipt: 'Receipt',
      work_order: 'Work Order',
      purchase_order: 'Purchase Order',
    };
    return labels[type] || type;
  };

  const docTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      estimate: 'bg-blue-100 text-blue-700',
      invoice: 'bg-amber-100 text-amber-700',
      receipt: 'bg-green-100 text-green-700',
      work_order: 'bg-purple-100 text-purple-700',
      purchase_order: 'bg-slate-100 text-slate-700',
    };
    return colors[type] || 'bg-slate-100 text-slate-600';
  };

  const handleOpenModal = (customer?: CustomerProfile) => {
    if (customer) {
      setFormData(customer);
    } else {
      setFormData({ 
        id: Math.random().toString(36).substr(2, 9), 
        name: '', address: '', city: '', state: '', zip: '', email: '', phone: '', notes: '', status: 'Active' 
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) return alert('Name is required');
    onSaveCustomer(formData);
    setIsModalOpen(false);
  };

  // Filter and paginate active customers
  const activeCustomers = useMemo(
    () => state.customers.filter(c => c.status !== 'Archived'),
    [state.customers]
  );
  const customersPagination = usePagination(activeCustomers, 10);

  // Detail View
  if (viewingCustomerId) {
    const customer = state.customers.find(c => c.id === viewingCustomerId);
    if (!customer) return <div>Customer not found.</div>;
    const customerEstimates = state.savedEstimates.filter(e => e.customerId === customer.id || e.customer?.id === customer.id);

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-200">
             <button onClick={() => onSelectCustomer(null)} className="text-slate-400 hover:text-slate-900 flex items-center gap-2 mb-4 text-[10px] font-black uppercase tracking-widest transition-colors"> <ArrowLeft className="w-4 h-4" /> Back to Lead List </button>
             
            <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start gap-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{customer.name}</h2>
                    <div className="text-slate-400 flex flex-wrap gap-4 mt-4 font-bold text-sm">
                        {customer.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-brand"/> {customer.phone}</span>}
                        {customer.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-brand"/> {customer.email}</span>}
                        {customer.address && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand"/> {customer.address}</span>}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => handleOpenModal(customer)} className="px-6 py-3 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Edit Lead</button>
                    <button onClick={() => onStartEstimate(customer)} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-200">Start Estimate</button>
                </div>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 font-black uppercase text-[10px] tracking-widest text-slate-400">Job History &amp; Saved Documents</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-300 uppercase tracking-widest border-b"><tr><th className="px-6 py-5">Date</th><th className="px-6 py-5">Status</th><th className="px-6 py-5">Quote</th><th className="px-6 py-5">Saved Documents</th><th className="px-6 py-5 text-right">Action</th></tr></thead>
                    <tbody>
                        {customerEstimates.map(est => {
                            const hasEstimate = !!est.estimateLines && est.estimateLines.length > 0;
                            const hasWorkOrder = est.status === 'Work Order' || est.status === 'Invoiced' || est.status === 'Paid' || (!!est.workOrderLines && est.workOrderLines.length > 0);
                            const hasInvoice = est.status === 'Invoiced' || est.status === 'Paid' || (!!est.invoiceLines && est.invoiceLines.length > 0);
                            return (
                            <tr key={est.id} className="hover:bg-slate-50 border-b last:border-0 transition-colors">
                                <td className="px-6 py-5 font-bold text-slate-800">{new Date(est.date).toLocaleDateString()}</td>
                                <td className="px-6 py-5"> 
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                        est.status === 'Draft' ? 'bg-slate-100 text-slate-600' :
                                        est.status === 'Work Order' ? 'bg-amber-100 text-amber-700' :
                                        est.status === 'Invoiced' ? 'bg-sky-100 text-sky-700' :
                                        est.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>{est.status}</span>
                                </td>
                                <td className="px-6 py-5 font-mono font-black text-slate-900">${est.totalValue?.toLocaleString() || 0}</td>
                                <td className="px-6 py-5">
                                    <div className="flex flex-wrap gap-2">
                                        {/* Estimate Link */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onOpenEstimateStage ? onOpenEstimateStage(est) : onLoadEstimate(est); }}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                                                hasEstimate 
                                                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' 
                                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200'
                                            }`}
                                            title={hasEstimate ? 'Open saved estimate' : 'Create estimate'}
                                        >
                                            <ClipboardList className="w-3 h-3" />
                                            Estimate
                                        </button>

                                        {/* Work Order Link */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onOpenWorkOrderStage ? onOpenWorkOrderStage(est) : onLoadEstimate(est); }}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                                                hasWorkOrder 
                                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' 
                                                    : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed opacity-50'
                                            }`}
                                            disabled={!hasWorkOrder}
                                            title={hasWorkOrder ? 'Open saved work order' : 'Work order not yet created'}
                                        >
                                            <HardHat className="w-3 h-3" />
                                            Work Order
                                        </button>

                                        {/* Invoice Link */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onOpenInvoiceStage ? onOpenInvoiceStage(est) : onLoadEstimate(est); }}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                                                hasInvoice 
                                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' 
                                                    : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed opacity-50'
                                            }`}
                                            disabled={!hasInvoice}
                                            title={hasInvoice ? 'Open saved invoice' : 'Invoice not yet created'}
                                        >
                                            <Receipt className="w-3 h-3" />
                                            Invoice
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <button 
                                        onClick={() => onLoadEstimate(est)}
                                        className="text-brand font-black uppercase text-[10px] tracking-widest hover:underline"
                                    >
                                        Open Job
                                    </button>
                                </td>
                            </tr>
                            );
                        })}
                        {customerEstimates.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-slate-300 italic">No project history found for this lead.</td></tr>}
                    </tbody>
                    </table>
                </div>
            </div>

            {/* Customer Documents */}
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
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${docTypeBadgeColor(doc.documentType)}`}>
                                                {docTypeLabel(doc.documentType)}
                                            </span>
                                            <span className="text-[10px] text-slate-400">{new Date(doc.createdAt).toLocaleDateString()}</span>
                                            {doc.fileSize > 0 && <span className="text-[10px] text-slate-300">{(doc.fileSize / 1024).toFixed(0)} KB</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {doc.publicUrl && (
                                        <a
                                            href={doc.publicUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-slate-300 hover:text-brand hover:bg-red-50 rounded-lg transition-colors"
                                            title="Open PDF"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                    {doc.publicUrl && (
                                        <a
                                            href={doc.publicUrl}
                                            download={doc.filename}
                                            className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleDeleteDoc(doc)}
                                        disabled={deletingDocId === doc.id}
                                        className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        title="Delete"
                                    >
                                        {deletingDocId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Edit Profile</h3>
                        <div className="space-y-5">
                            <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Full Name</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus /> </div>
                            <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Address</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /> </div>
                            <div className="grid grid-cols-2 gap-4">
                            <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Phone</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /> </div>
                            <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Email</label> <input type="email" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /> </div>
                            </div>
                            <div className="flex gap-3 pt-6">
                                <button onClick={() => setIsModalOpen(false)} className="flex-1 p-4 border-2 border-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
                                <button onClick={handleSave} className="flex-1 p-4 bg-brand text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-hover shadow-lg shadow-red-200 transition-all">Save Profile</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  }

  // List View
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-end">
            <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Customer Database</h2>
                <p className="text-slate-500 font-medium text-sm">CRM & History Management</p>
            </div>
            <div className="flex items-center gap-3">
                <FeedbackButton area="Customers" />
                <button onClick={() => handleOpenModal()} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"> <Plus className="w-4 h-4" /> Add Lead </button>
            </div>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-6 py-5">Client Name</th><th className="px-6 py-5">Contact</th><th className="px-6 py-5">Job History</th><th className="px-6 py-5 text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {activeCustomers.length === 0 ? (<tr><td colSpan={4} className="p-12 text-center text-slate-300 italic">No customers active.</td></tr>) : (
                        customersPagination.currentItems.map(c => {
                            const jobCount = state.savedEstimates.filter(e => e.customerId === c.id || e.customer?.id === c.id).length;
                            return (
                                <tr 
                                    key={c.id} 
                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                    onClick={() => onSelectCustomer(c.id)}
                                >
                                    <td className="px-6 py-5 font-bold text-slate-800 group-hover:text-brand transition-colors">{c.name}</td>
                                    <td className="px-6 py-5 text-xs text-slate-500">{c.phone || c.email || 'No contact info'}</td>
                                    <td className="px-6 py-5"> <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-600 uppercase tracking-tighter">{jobCount} Projects</span> </td>
                                    <td className="px-6 py-5 text-right flex justify-end gap-2">
                                        <button className="text-xs font-black text-brand uppercase tracking-widest p-2 hover:bg-red-50 rounded-lg">Details</button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onArchiveCustomer(c.id); }} 
                                            className="p-2 text-slate-200 hover:text-slate-400 z-10"
                                        >
                                            <Archive className="w-4 h-4"/>
                                        </button>
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
        {isModalOpen && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Customer Profile</h3>
                    <div className="space-y-5">
                        <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Full Name</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus /> </div>
                        <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Address</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /> </div>
                        <div className="grid grid-cols-2 gap-4">
                        <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Phone</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /> </div>
                        <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Email</label> <input type="email" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /> </div>
                        </div>
                        <div className="flex gap-3 pt-6">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 p-4 border-2 border-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={handleSave} className="flex-1 p-4 bg-brand text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-hover shadow-lg shadow-red-200 transition-all">Save Profile</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
