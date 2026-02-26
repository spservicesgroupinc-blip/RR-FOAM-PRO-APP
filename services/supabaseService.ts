/**
 * Supabase Data Service - Overhauled
 *
 * Complete Supabase backend integration following Supabase Postgres Best Practices:
 *   - Batch operations to eliminate N+1 query patterns
 *   - Proper retry logic with server-side fallback queue
 *   - Clean separation between admin (authenticated) and crew (anon/RPC) paths
 *   - Optimistic local updates with cloud persistence
 *   - Connection-efficient: single RPC calls replace multi-query waterfalls
 */

import { supabase } from '../src/lib/supabase';
import {
  CalculatorState,
  EstimateRecord,
  CustomerProfile,
  WarehouseItem,
  EquipmentItem,
  PurchaseOrder,
  MaterialUsageLogEntry,
  CompanyProfile,
} from '../types';

// --- TYPES ---

interface OrgData {
  organization: any;
  customers: any[];
  estimates: any[];
  inventory_items: any[];
  equipment: any[];
  warehouse_stock: any;
  material_logs: any[];
  purchase_orders: any[];
}

// --- MODULE STATE ---

let _currentOrgId: string | null = null;
export const setCurrentOrgId = (orgId: string) => { _currentOrgId = orgId; };

// --- RETRY INFRASTRUCTURE ---

const isRetryableError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  const status = Number(error.status || error.statusCode || 0);

  if (status >= 500 || status === 408 || status === 429) return true;
  if (['PGRST000', 'PGRST003', '57014', '40001'].includes(code)) return true;
  if (message.includes('network') || message.includes('fetch') ||
      message.includes('timeout') || message.includes('temporar') ||
      message.includes('failed to fetch') || message.includes('load failed')) return true;
  return false;
};

const isAuthError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  const status = Number(error.status || error.statusCode || 0);
  return status === 401 || status === 403 || code === 'PGRST301' || code === '42501';
};

const enqueueFailedWrite = async (
  orgId: string,
  tableName: string,
  operation: string,
  payload: Record<string, any>,
  conflictKey: string = 'id',
  errorMsg?: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('enqueue_failed_write', {
      p_org_id: orgId,
      p_table_name: tableName,
      p_operation: operation,
      p_payload: payload,
      p_conflict_key: conflictKey,
      p_error_msg: errorMsg || null,
    });
    if (error) {
      console.error('[RetryQueue] enqueue RPC failed:', error.message);
      return null;
    }
    console.log('[RetryQueue] Enqueued failed ' + operation + ' on ' + tableName + ' id=' + data);
    return data as string;
  } catch (err: any) {
    console.error('[RetryQueue] enqueue exception:', err?.message || err);
    return null;
  }
};

interface RetryWriteOptions {
  table?: string;
  operation?: string;
  payload?: Record<string, any>;
  conflictKey?: string;
}

const retryWrite = async <T>(
  fn: () => PromiseLike<{ data: T; error: any }>,
  label: string,
  maxRetries = 3,
  queueOpts?: RetryWriteOptions
): Promise<{ data: T; error: any }> => {
  let lastResult: { data: T; error: any } = { data: null as any, error: null };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (!result.error) return result;
      lastResult = result;
      if (isAuthError(result.error) || !isRetryableError(result.error) || attempt === maxRetries) break;
    } catch (err) {
      lastResult = { data: null as any, error: err };
      if (!isRetryableError(err) || attempt === maxRetries) break;
    }
    const delay = Math.min(400 * Math.pow(2, attempt), 4000);
    console.warn('[' + label + '] attempt ' + (attempt + 1) + ' failed, retrying in ' + delay + 'ms...');
    await new Promise(r => setTimeout(r, delay));
  }

  if (lastResult.error && isRetryableError(lastResult.error) && queueOpts?.table && queueOpts?.payload) {
    const orgId = queueOpts.payload.organization_id || _currentOrgId;
    if (orgId) {
      enqueueFailedWrite(
        orgId,
        queueOpts.table,
        queueOpts.operation || 'upsert',
        queueOpts.payload,
        queueOpts.conflictKey || 'id',
        String(lastResult.error?.message || lastResult.error)
      );
    }
  }

  return lastResult;
};

const retryRPC = async <T>(
  fn: () => Promise<{ data: T; error: any }>,
  maxRetries = 3,
  label = 'RPC'
): Promise<{ data: T; error: any }> => {
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (!result.error) return result;
      lastError = result.error;
      if (isAuthError(result.error)) return result;
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      console.warn('[' + label + '] Attempt ' + (attempt + 1) + ' failed, retrying in ' + delay + 'ms...');
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return { data: null as any, error: lastError };
};


// --- DATA MAPPERS ---

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (id?: string): boolean => !!id && UUID_RE.test(id);

const dbEstimateToRecord = (row: any, customers: CustomerProfile[]): EstimateRecord => {
  const customer = customers.find(c => c.id === row.customer_id) || {
    id: row.customer_id || '',
    name: 'Unknown',
    address: '', city: '', state: '', zip: '', email: '', phone: '', notes: '', status: 'Active' as const,
  };

  return {
    id: row.id,
    customerId: row.customer_id,
    date: row.date || row.created_at,
    customer,
    status: row.status || 'Draft',
    executionStatus: row.execution_status || 'Not Started',
    inputs: row.inputs || {},
    results: row.results || {},
    materials: row.materials || {
      openCellSets: 0, closedCellSets: 0,
      openCellStrokes: 0, closedCellStrokes: 0,
      ocStrokesPerSet: 6600, ccStrokesPerSet: 6600,
      inventory: [], equipment: [],
    },
    totalValue: Number(row.total_value) || 0,
    wallSettings: row.wall_settings || {},
    roofSettings: row.roof_settings || {},
    expenses: row.expenses || { manHours: 0, tripCharge: 0, fuelSurcharge: 0, other: { description: 'Misc', amount: 0 } },
    notes: row.notes || '',
    pricingMode: row.pricing_mode || 'level_pricing',
    sqFtRates: row.sq_ft_rates || { wall: 0, roof: 0 },
    scheduledDate: row.scheduled_date || '',
    invoiceDate: row.invoice_date || '',
    invoiceNumber: row.invoice_number || '',
    paymentTerms: row.payment_terms || 'Due on Receipt',
    estimateLines: row.estimate_lines,
    invoiceLines: row.invoice_lines,
    workOrderLines: row.work_order_lines,
    actuals: row.actuals || undefined,
    financials: row.financials || undefined,
    workOrderSheetUrl: row.work_order_sheet_url || undefined,
    pdfLink: row.pdf_link || undefined,
    sitePhotos: row.site_photos || [],
    inventoryProcessed: row.inventory_processed || false,
    lastModified: row.last_modified || row.updated_at,
  };
};

const recordToDbEstimate = (record: EstimateRecord, orgId: string) => ({
  id: record.id,
  organization_id: orgId,
  customer_id: record.customerId,
  status: record.status,
  execution_status: record.executionStatus || 'Not Started',
  date: record.date,
  total_value: record.totalValue || 0,
  notes: record.notes || null,
  pricing_mode: record.pricingMode || 'level_pricing',
  scheduled_date: record.scheduledDate || null,
  invoice_date: record.invoiceDate || null,
  invoice_number: record.invoiceNumber || null,
  payment_terms: record.paymentTerms || 'Due on Receipt',
  inputs: (record.inputs || {}) as any,
  results: (record.results || {}) as any,
  materials: record.materials as any,
  financials: (record.financials || null) as any,
  settings_snapshot: {
    wallSettings: record.wallSettings,
    roofSettings: record.roofSettings,
  } as any,
  wall_settings: record.wallSettings as any,
  roof_settings: record.roofSettings as any,
  expenses: record.expenses as any,
  actuals: (record.actuals || null) as any,
  sq_ft_rates: (record.sqFtRates || { wall: 0, roof: 0 }) as any,
  estimate_lines: (record.estimateLines || null) as any,
  invoice_lines: (record.invoiceLines || null) as any,
  work_order_lines: (record.workOrderLines || null) as any,
  work_order_sheet_url: record.workOrderSheetUrl || null,
  pdf_link: record.pdfLink || null,
  site_photos: (record.sitePhotos || []) as any,
  inventory_processed: record.inventoryProcessed || false,
  last_modified: new Date().toISOString(),
});

const dbCustomerToProfile = (row: any): CustomerProfile => ({
  id: row.id,
  name: row.name || '',
  address: row.address || '',
  city: row.city || '',
  state: row.state || '',
  zip: row.zip || '',
  email: row.email || '',
  phone: row.phone || '',
  notes: row.notes || '',
  status: row.status || 'Active',
});

const dbEquipmentToItem = (row: any): EquipmentItem => ({
  id: row.id,
  name: row.name || '',
  status: row.status || 'Available',
  lastSeen: row.last_seen || undefined,
});

const dbInventoryToWarehouseItem = (row: any): WarehouseItem => ({
  id: row.id,
  name: row.name || '',
  quantity: Number(row.quantity) || 0,
  unit: row.unit || '',
  unitCost: Number(row.unit_cost) || 0,
});

const dbLogToEntry = (row: any): MaterialUsageLogEntry => ({
  id: row.id,
  date: row.date,
  jobId: row.job_id || undefined,
  customerName: row.customer_name || '',
  materialName: row.material_name,
  quantity: Number(row.quantity) || 0,
  unit: row.unit || '',
  loggedBy: row.logged_by || '',
  logType: row.log_type || 'estimated',
});

const dbPurchaseOrder = (row: any): PurchaseOrder => ({
  id: row.id,
  date: row.date,
  vendorName: row.vendor_name,
  status: row.status || 'Draft',
  items: row.items || [],
  totalCost: Number(row.total_cost) || 0,
  notes: row.notes || undefined,
});


// --- COMPANY PROFILE BUILDER ---

const buildCompanyProfile = (org: any): CompanyProfile => {
  const addr = (typeof org.address === 'string' ? JSON.parse(org.address) : org.address) || {};
  const settings = (typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings) || {};

  return {
    companyName: org.name || '',
    addressLine1: addr.line1 || settings.addressLine1 || '',
    addressLine2: addr.line2 || settings.addressLine2 || '',
    city: addr.city || settings.city || '',
    state: addr.state || settings.state || '',
    zip: addr.zip || settings.zip || '',
    phone: org.phone || settings.phone || '',
    email: org.email || settings.email || '',
    website: settings.website || '',
    logoUrl: org.logo_url || settings.logoUrl || '',
    crewAccessPin: org.crew_pin || '',
  };
};
