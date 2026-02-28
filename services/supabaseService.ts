/**
 * Data Service - InsForge
 *
 * Complete InsForge backend integration following Postgres Best Practices:
 *   - Batch operations to eliminate N+1 query patterns
 *   - Proper retry logic with server-side fallback queue
 *   - Clean separation between admin (authenticated) and crew (anon/RPC) paths
 *   - Optimistic local updates with cloud persistence
 *   - Connection-efficient: single RPC calls replace multi-query waterfalls
 */

import { insforge } from '../src/lib/insforge';
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
    const { data, error } = await insforge.database.rpc('enqueue_failed_write', {
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
  fn: () => PromiseLike<{ data: T; error: any }>,
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


// ==========================================
// FETCH ALL ORG DATA (single RPC call)
// ==========================================

export const fetchOrgData = async (orgId: string): Promise<Partial<CalculatorState> | null> => {
  if (!orgId) {
    console.error('fetchOrgData: orgId is required');
    return null;
  }

  try {
    _currentOrgId = orgId;
    const { data, error } = await retryRPC(
      () => insforge.database.rpc('get_org_data', { org_id: orgId }),
      2,
      'fetchOrgData'
    );

    if (error) {
      console.error('fetchOrgData RPC error:', error);
      return null;
    }

    const orgData = data as unknown as OrgData;
    if (!orgData) return null;

    const org = orgData.organization || {};
    const settings = (typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings) || {};
    const customers = (orgData.customers || []).map(dbCustomerToProfile);
    const estimates = (orgData.estimates || []).map((e: any) => dbEstimateToRecord(e, customers));
    const warehouseItems = (orgData.inventory_items || []).map(dbInventoryToWarehouseItem);
    const equipmentItems = (orgData.equipment || []).map(dbEquipmentToItem);
    const materialLogs = (orgData.material_logs || []).map(dbLogToEntry);
    const purchaseOrders = (orgData.purchase_orders || []).map(dbPurchaseOrder);
    const whStock = orgData.warehouse_stock || {};

    return {
      companyProfile: buildCompanyProfile(org),
      customers,
      savedEstimates: estimates,
      warehouse: {
        openCellSets: Number(whStock.open_cell_sets) || 0,
        closedCellSets: Number(whStock.closed_cell_sets) || 0,
        items: warehouseItems,
      },
      equipment: equipmentItems,
      materialLogs,
      purchaseOrders,
      yields: settings.yields || undefined,
      costs: settings.costs || undefined,
      pricingMode: settings.pricingMode || undefined,
      sqFtRates: settings.sqFtRates || undefined,
      lifetimeUsage: settings.lifetimeUsage || undefined,
    };
  } catch (err) {
    console.error('fetchOrgData exception:', err);
    return null;
  }
};


// ==========================================
// CUSTOMERS
// ==========================================

export const upsertCustomer = async (customer: CustomerProfile, orgId: string): Promise<CustomerProfile | null> => {
  const payload: any = {
    organization_id: orgId,
    name: customer.name,
    address: customer.address || null,
    city: customer.city || null,
    state: customer.state || null,
    zip: customer.zip || null,
    email: customer.email || null,
    phone: customer.phone || null,
    status: customer.status || 'Active',
    notes: customer.notes || null,
  };

  if (isValidUuid(customer.id)) {
    payload.id = customer.id;
  }

  if (!payload.id && customer.name) {
    const { data: existing } = await insforge.database
      .from('customers')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('name', customer.name)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      payload.id = existing.id;
    }
  }

  const { data, error } = await retryWrite(
    () => insforge.database
      .from('customers')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single(),
    'upsertCustomer',
    3,
    { table: 'customers', operation: 'upsert', payload, conflictKey: 'id' }
  );

  if (error) {
    console.error('upsertCustomer error:', error);
    return null;
  }

  return dbCustomerToProfile(data);
};

export const batchUpsertCustomers = async (
  customers: CustomerProfile[],
  orgId: string
): Promise<CustomerProfile[]> => {
  if (!customers.length) return [];

  const payload = customers.map(c => ({
    id: isValidUuid(c.id) ? c.id : undefined,
    name: c.name,
    address: c.address || null,
    city: c.city || null,
    state: c.state || null,
    zip: c.zip || null,
    email: c.email || null,
    phone: c.phone || null,
    status: c.status || 'Active',
    notes: c.notes || null,
  }));

  try {
    const { data, error } = await retryRPC(
      () => insforge.database.rpc('batch_upsert_customers', {
        p_org_id: orgId,
        p_customers: payload,
      }),
      2,
      'batchUpsertCustomers'
    );

    if (error) {
      console.warn('[batchUpsertCustomers] RPC failed, falling back to individual upserts:', error.message);
      const results: CustomerProfile[] = [];
      for (const c of customers) {
        const saved = await upsertCustomer(c, orgId);
        if (saved) results.push(saved);
      }
      return results;
    }

    return ((data as any[]) || []).map(dbCustomerToProfile);
  } catch (err) {
    console.error('batchUpsertCustomers exception:', err);
    return [];
  }
};

export const deleteCustomer = async (customerId: string): Promise<boolean> => {
  const { error } = await retryWrite(
    () => insforge.database.from('customers').delete().eq('id', customerId),
    'deleteCustomer'
  );
  if (error) {
    console.error('deleteCustomer error:', error);
    return false;
  }
  return true;
};


// ==========================================
// ESTIMATES
// ==========================================

export const upsertEstimate = async (record: EstimateRecord, orgId: string): Promise<EstimateRecord | null> => {
  if (record.customer?.name) {
    const savedCustomer = await upsertCustomer(record.customer, orgId);
    if (savedCustomer) {
      record.customerId = savedCustomer.id;
      record.customer = savedCustomer;
    }
  }

  const dbRow = recordToDbEstimate(record, orgId);

  if (!isValidUuid(record.id)) {
    delete (dbRow as any).id;
  }

  if ((dbRow as any).customer_id && !isValidUuid((dbRow as any).customer_id)) {
    console.warn('[upsertEstimate] customer_id is not a valid UUID, setting to null:', (dbRow as any).customer_id);
    (dbRow as any).customer_id = null;
  }

  const { data, error } = await retryWrite(
    () => insforge.database
      .from('estimates')
      .upsert(dbRow, { onConflict: 'id' })
      .select()
      .single(),
    'upsertEstimate',
    3,
    { table: 'estimates', operation: 'upsert', payload: dbRow as Record<string, any>, conflictKey: 'id' }
  );

  if (error) {
    console.error('upsertEstimate error:', error);
    throw new Error(error.message || 'Failed to save estimate to cloud');
  }

  return dbEstimateToRecord(data, [record.customer]);
};

export const deleteEstimateDb = async (estimateId: string): Promise<boolean> => {
  const { error } = await retryWrite(
    () => insforge.database.from('estimates').delete().eq('id', estimateId),
    'deleteEstimate'
  );
  if (error) {
    console.error('deleteEstimate error:', error);
    return false;
  }
  return true;
};

export const updateEstimateStatus = async (
  estimateId: string,
  status: string,
  extraFields?: Record<string, any>
): Promise<boolean> => {
  const payload: any = { status, last_modified: new Date().toISOString() };
  if (extraFields) Object.assign(payload, extraFields);

  const { error } = await retryWrite(
    () => insforge.database
      .from('estimates')
      .update(payload)
      .eq('id', estimateId),
    'updateEstimateStatus'
  );

  if (error) {
    console.error('updateEstimateStatus error:', error);
    return false;
  }
  return true;
};

export const updateEstimateActuals = async (
  estimateId: string,
  actuals: any,
  executionStatus: string
): Promise<boolean> => {
  const { error } = await retryWrite(
    () => insforge.database
      .from('estimates')
      .update({
        actuals,
        execution_status: executionStatus,
        last_modified: new Date().toISOString(),
      })
      .eq('id', estimateId),
    'updateEstimateActuals'
  );

  if (error) {
    console.error('updateEstimateActuals error:', error);
    return false;
  }
  return true;
};

export const markEstimatePaid = async (
  estimateId: string,
  financials: any
): Promise<boolean> => {
  const { error } = await retryWrite(
    () => insforge.database
      .from('estimates')
      .update({
        status: 'Paid',
        financials,
        last_modified: new Date().toISOString(),
      })
      .eq('id', estimateId),
    'markEstimatePaid'
  );

  if (error) {
    console.error('markEstimatePaid error:', error);
    return false;
  }
  return true;
};

export const markEstimateInventoryProcessed = async (
  estimateId: string
): Promise<boolean> => {
  const { error } = await retryWrite(
    () => insforge.database
      .from('estimates')
      .update({
        inventory_processed: true,
        last_modified: new Date().toISOString(),
      })
      .eq('id', estimateId),
    'markEstimateInventoryProcessed'
  );

  if (error) {
    console.error('markEstimateInventoryProcessed error:', error);
    return false;
  }
  return true;
};


// ==========================================
// WAREHOUSE / INVENTORY
// ==========================================

export const updateWarehouseStock = async (
  orgId: string,
  openCellSets: number,
  closedCellSets: number
): Promise<boolean> => {
  const wsPayload = {
    organization_id: orgId,
    open_cell_sets: openCellSets,
    closed_cell_sets: closedCellSets,
  };
  const { error } = await retryWrite(
    () => insforge.database
      .from('warehouse_stock')
      .upsert(wsPayload, { onConflict: 'organization_id' }),
    'updateWarehouseStock',
    3,
    { table: 'warehouse_stock', operation: 'upsert', payload: wsPayload, conflictKey: 'organization_id' }
  );

  if (error) {
    console.error('updateWarehouseStock error:', error);
    return false;
  }
  return true;
};

export const upsertInventoryItem = async (item: WarehouseItem, orgId: string): Promise<WarehouseItem | null> => {
  const payload: any = {
    organization_id: orgId,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unit_cost: item.unitCost || 0,
    category: 'material',
  };

  if (isValidUuid(item.id)) {
    payload.id = item.id;
  }

  if (!payload.id && item.name) {
    const { data: existing } = await insforge.database
      .from('inventory_items')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('name', item.name)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      payload.id = existing.id;
    }
  }

  const { data, error } = await retryWrite(
    () => insforge.database
      .from('inventory_items')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single(),
    'upsertInventoryItem',
    3,
    { table: 'inventory_items', operation: 'upsert', payload, conflictKey: 'id' }
  );

  if (error) {
    console.error('upsertInventoryItem error:', error);
    return null;
  }
  return dbInventoryToWarehouseItem(data);
};

export const batchUpsertInventoryItems = async (
  items: WarehouseItem[],
  orgId: string
): Promise<WarehouseItem[]> => {
  if (!items.length) return [];

  const payload = items.map(item => ({
    id: isValidUuid(item.id) ? item.id : undefined,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unit_cost: item.unitCost || 0,
    category: 'material',
  }));

  try {
    const { data, error } = await retryRPC(
      () => insforge.database.rpc('batch_upsert_inventory', {
        p_org_id: orgId,
        p_items: payload,
      }),
      2,
      'batchUpsertInventory'
    );

    if (error) {
      console.warn('[batchUpsertInventory] RPC failed, falling back to individual upserts:', error.message);
      const results: WarehouseItem[] = [];
      for (const item of items) {
        const saved = await upsertInventoryItem(item, orgId);
        if (saved) results.push(saved);
      }
      return results;
    }

    return ((data as any[]) || []).map(dbInventoryToWarehouseItem);
  } catch (err) {
    console.error('batchUpsertInventory exception:', err);
    return [];
  }
};

export const deleteInventoryItem = async (itemId: string): Promise<boolean> => {
  const { error } = await retryWrite(
    () => insforge.database.from('inventory_items').delete().eq('id', itemId),
    'deleteInventoryItem'
  );
  if (error) {
    console.error('deleteInventoryItem error:', error);
    return false;
  }
  return true;
};


// ==========================================
// EQUIPMENT
// ==========================================

export const upsertEquipment = async (item: EquipmentItem, orgId: string): Promise<EquipmentItem | null> => {
  const payload: any = {
    organization_id: orgId,
    name: item.name,
    status: item.status || 'Available',
    last_seen: item.lastSeen || null,
  };

  if (isValidUuid(item.id)) {
    payload.id = item.id;
  }

  const { data, error } = await retryWrite(
    () => insforge.database
      .from('equipment')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single(),
    'upsertEquipment',
    3,
    { table: 'equipment', operation: 'upsert', payload, conflictKey: 'id' }
  );

  if (error) {
    console.error('upsertEquipment error:', error);
    return null;
  }
  return dbEquipmentToItem(data);
};

export const deleteEquipmentItem = async (itemId: string): Promise<boolean> => {
  const { error } = await retryWrite(
    () => insforge.database.from('equipment').delete().eq('id', itemId),
    'deleteEquipment'
  );
  if (error) {
    console.error('deleteEquipment error:', error);
    return false;
  }
  return true;
};

export const updateEquipmentStatus = async (
  itemId: string,
  status: string,
  lastSeen?: any
): Promise<boolean> => {
  const payload: any = { status };
  if (lastSeen) payload.last_seen = lastSeen;

  const { error } = await retryWrite(
    () => insforge.database.from('equipment').update(payload).eq('id', itemId),
    'updateEquipmentStatus'
  );
  if (error) {
    console.error('updateEquipmentStatus error:', error);
    return false;
  }
  return true;
};


// ==========================================
// MATERIAL LOGS (batch insert)
// ==========================================

export const insertMaterialLogs = async (
  logs: MaterialUsageLogEntry[],
  orgId: string
): Promise<boolean> => {
  if (!logs.length) return true;

  const rows = logs.map(log => ({
    organization_id: orgId,
    date: log.date,
    job_id: log.jobId || null,
    customer_name: log.customerName || null,
    material_name: log.materialName,
    quantity: log.quantity || 0,
    unit: log.unit || '',
    logged_by: log.loggedBy || '',
    log_type: log.logType || 'estimated',
  }));

  const { error } = await retryWrite(
    () => insforge.database.from('material_logs').insert(rows),
    'insertMaterialLogs',
    3,
    rows.length === 1
      ? { table: 'material_logs', operation: 'insert', payload: rows[0] as Record<string, any> }
      : undefined
  );

  if (error && isRetryableError(error) && rows.length > 1 && _currentOrgId) {
    for (const row of rows) {
      enqueueFailedWrite(_currentOrgId, 'material_logs', 'insert', row as Record<string, any>, 'id', String(error.message || error));
    }
  }
  if (error) {
    console.error('insertMaterialLogs error:', error);
    return false;
  }
  return true;
};


// ==========================================
// PURCHASE ORDERS
// ==========================================

export const insertPurchaseOrder = async (po: PurchaseOrder, orgId: string): Promise<PurchaseOrder | null> => {
  const { data, error } = await retryWrite(
    () => insforge.database
      .from('purchase_orders')
      .insert({
        organization_id: orgId,
        date: po.date,
        vendor_name: po.vendorName,
        status: po.status || 'Draft',
        items: po.items as any,
        total_cost: po.totalCost || 0,
        notes: po.notes || null,
      })
      .select()
      .single(),
    'insertPurchaseOrder'
  );

  if (error) {
    console.error('insertPurchaseOrder error:', error);
    return null;
  }
  return dbPurchaseOrder(data);
};


// ==========================================
// ORG SETTINGS & COMPANY PROFILE
// ==========================================

export const updateOrgSettings = async (
  orgId: string,
  settings: Record<string, any>
): Promise<boolean> => {
  const { data: org, error: fetchErr } = await insforge.database
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();

  if (fetchErr || !org) {
    console.error('fetchOrgSettings error:', fetchErr);
    return false;
  }

  const existing = (typeof org.settings === 'string' ? JSON.parse(org.settings as string) : org.settings) || {};
  const merged = { ...existing, ...settings };

  const { error } = await retryWrite(
    () => insforge.database
      .from('organizations')
      .update({ settings: merged })
      .eq('id', orgId),
    'updateOrgSettings'
  );

  if (error) {
    console.error('updateOrgSettings error:', error);
    return false;
  }
  return true;
};

export const updateCompanyProfile = async (
  orgId: string,
  profile: CompanyProfile
): Promise<boolean> => {
  const { error } = await retryWrite(
    () => insforge.database
      .from('organizations')
      .update({
        name: profile.companyName,
        phone: profile.phone || null,
        email: profile.email || null,
        logo_url: profile.logoUrl || null,
        crew_pin: profile.crewAccessPin || null,
        address: {
          line1: profile.addressLine1 || '',
          line2: profile.addressLine2 || '',
          city: profile.city || '',
          state: profile.state || '',
          zip: profile.zip || '',
        },
      })
      .eq('id', orgId),
    'updateCompanyProfile'
  );

  if (error) {
    console.error('updateCompanyProfile error:', error);
    return false;
  }
  return true;
};

export const updateCrewPinDb = async (orgId: string, newPin: string): Promise<boolean> => {
  const { error } = await retryWrite(
    () => insforge.database
      .from('organizations')
      .update({ crew_pin: newPin })
      .eq('id', orgId),
    'updateCrewPin'
  );

  if (error) {
    console.error('updateCrewPin error:', error);
    return false;
  }
  return true;
};


// ==========================================
// BULK SYNC (save full app state to insforge.database)
// ==========================================

export const syncAppDataToSupabase = async (
  appData: CalculatorState,
  orgId: string
): Promise<boolean> => {
  try {
    let hasErrors = false;

    // 1. Org-level settings
    const settingsOk = await updateOrgSettings(orgId, {
      yields: appData.yields,
      costs: appData.costs,
      pricingMode: appData.pricingMode,
      sqFtRates: appData.sqFtRates,
      lifetimeUsage: appData.lifetimeUsage,
    });
    if (!settingsOk) {
      hasErrors = true;
      console.warn('[syncAppData] Failed to update organization settings');
    }

    // 2. Company profile
    const companyOk = await updateCompanyProfile(orgId, appData.companyProfile);
    if (!companyOk) {
      hasErrors = true;
      console.warn('[syncAppData] Failed to update company profile');
    }

    // 3. Warehouse stock
    const warehouseStockOk = await updateWarehouseStock(
      orgId,
      appData.warehouse.openCellSets,
      appData.warehouse.closedCellSets
    );
    if (!warehouseStockOk) {
      hasErrors = true;
      console.warn('[syncAppData] Failed to update warehouse stock');
    }

    // 4. Batch inventory items
    if (appData.warehouse.items.length > 0) {
      const saved = await batchUpsertInventoryItems(appData.warehouse.items, orgId);
      if (saved.length < appData.warehouse.items.length) {
        hasErrors = true;
        console.warn(`[syncAppData] Only ${saved.length}/${appData.warehouse.items.length} inventory items synced`);
      }
    }

    // 5. Equipment
    for (const item of appData.equipment) {
      const saved = await upsertEquipment(item, orgId);
      if (!saved) {
        hasErrors = true;
        console.warn(`[syncAppData] Failed to sync equipment ${item.id || item.name}`);
      }
    }

    // 6. Batch customers
    if (appData.customers.length > 0) {
      const saved = await batchUpsertCustomers(appData.customers, orgId);
      if (saved.length < appData.customers.length) {
        hasErrors = true;
        console.warn(`[syncAppData] Only ${saved.length}/${appData.customers.length} customers synced`);
      }
    }

    // 7. Estimates � continue on individual failures
    let estimateErrors = 0;
    for (const estimate of appData.savedEstimates) {
      try {
        await upsertEstimate(estimate, orgId);
      } catch (estErr: any) {
        estimateErrors++;
        console.warn(`[syncAppData] Estimate ${estimate.id} failed:`, estErr?.message || estErr);
      }
    }

    if (estimateErrors > 0) {
      console.warn(`[syncAppData] ${estimateErrors}/${appData.savedEstimates.length} estimate(s) failed`);
    }

    return !hasErrors && estimateErrors === 0;
  } catch (err) {
    console.error('syncAppDataToSupabase error:', err);
    return false;
  }
};


// ==========================================
// CREW FUNCTIONS (PIN-based, no auth.uid())
// ==========================================

const buildCrewResult = (
  org: any,
  rawCustomers: any[],
  rawEstimates: any[]
): Partial<CalculatorState> => {
  const customers = rawCustomers.map(dbCustomerToProfile);
  const estimates = rawEstimates.map((e: any) => dbEstimateToRecord(e, customers));

  const addr = (typeof org.address === 'string' ? JSON.parse(org.address) : org.address) || {};
  const settings = (typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings) || {};

  const companyProfile: CompanyProfile = {
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

  return {
    companyProfile,
    customers,
    savedEstimates: estimates,
    yields: settings.yields || undefined,
    costs: settings.costs || undefined,
  };
};

export const fetchCrewWorkOrders = async (orgId: string): Promise<Partial<CalculatorState> | null> => {
  _currentOrgId = orgId;

  if (!orgId) {
    console.error('[Crew Sync] CRITICAL: orgId is empty/undefined. Cannot fetch work orders.');
    return null;
  }

  // Attempt 1: RPC (SECURITY DEFINER � bypasses RLS for crew)
  try {
    console.log('[Crew Sync] Calling get_crew_work_orders RPC for org:', orgId);
    const { data, error } = await insforge.database.rpc('get_crew_work_orders', { p_org_id: orgId });

    if (!error && data) {
      const result = data as any;
      const estCount = (result.estimates || []).length;
      const custCount = (result.customers || []).length;
      const hasOrg = !!result.organization;
      console.log(`[Crew Sync] RPC success � org: ${hasOrg}, customers: ${custCount}, estimates: ${estCount}`);

      if (!hasOrg) {
        console.warn('[Crew Sync] RPC returned null organization � orgId may be invalid:', orgId);
      }

      return buildCrewResult(
        result.organization || {},
        result.customers || [],
        result.estimates || []
      );
    }

    console.warn('[Crew Sync] RPC get_crew_work_orders failed:', error?.message || 'No data returned');
    console.warn('[Crew Sync] Error code:', error?.code, '| Hint:', error?.hint || 'none');
    console.warn('[Crew Sync] FIX: Run supabase_functions.sql in the insforge.database SQL Editor.');
  } catch (err: any) {
    console.warn('[Crew Sync] RPC exception:', err?.message || err);
  }

  // Attempt 2: Direct queries (only works with anon/crew RLS policies)
  console.log('[Crew Sync] Trying direct query fallback...');
  try {
    const [orgRes, custRes, estRes] = await Promise.all([
      insforge.database.from('organizations').select('*').eq('id', orgId).single(),
      insforge.database.from('customers').select('*').eq('organization_id', orgId),
      insforge.database.from('estimates').select('*').eq('organization_id', orgId).eq('status', 'Work Order'),
    ]);

    if (!orgRes.data || orgRes.error) {
      console.error(
        '[Crew Sync] CRITICAL: Cannot read organization data. ' +
        'Crew users have no auth.uid() � the get_crew_work_orders RPC is required. ' +
        'Run supabase_functions.sql in the insforge.database SQL Editor to fix.',
        '\n  orgRes error:', orgRes.error?.message || 'none',
        '\n  custRes error:', custRes.error?.message || 'none',
        '\n  estRes error:', estRes.error?.message || 'none'
      );
      return null;
    }

    const rawCustomers = custRes.data || [];
    const rawEstimates = estRes.data || [];

    console.log(`[Crew Sync] Direct query fallback � customers: ${rawCustomers.length}, estimates: ${rawEstimates.length}`);

    if (rawEstimates.length === 0 && estRes.error) {
      console.error(
        '[Crew Sync] CRITICAL: Both RPC and direct queries returned 0 estimates. ' +
        'Run supabase_functions.sql in the insforge.database SQL Editor to fix.',
        '\n  estRes error:', estRes.error?.message
      );
      // Return empty result instead of null so crew sees an empty dashboard
      // rather than an error state. New work orders will appear on next poll.
      return buildCrewResult(orgRes.data, rawCustomers, []);
    }

    return buildCrewResult(orgRes.data, rawCustomers, rawEstimates);
  } catch (err: any) {
    console.error('[Crew Sync] Direct query fallback exception:', err?.message || err);
    return null;
  }
};

export const flushOfflineCrewQueue = async (): Promise<number> => {
  return 0;
};

export const crewUpdateJob = async (
  orgId: string,
  estimateId: string,
  actuals: any,
  executionStatus: string
): Promise<boolean> => {
  const { data, error } = await retryRPC(
    () => insforge.database.rpc('crew_update_job', {
      p_org_id: orgId,
      p_estimate_id: estimateId,
      p_actuals: actuals,
      p_execution_status: executionStatus,
    }),
    3,
    'crewUpdateJob'
  );

  if (error) {
    console.error('crewUpdateJob failed after retries:', error);
    if (isRetryableError(error)) {
      enqueueFailedWrite(
        orgId,
        'estimates',
        'update',
        {
          id: estimateId,
          organization_id: orgId,
          actuals,
          execution_status: executionStatus,
        },
        'id',
        String(error.message || error)
      );
    }
    return false;
  }

  return data === true;
};


// ==========================================
// WAREHOUSE FETCH (lightweight)
// ==========================================

export const fetchWarehouseState = async (
  orgId: string
): Promise<{ openCellSets: number; closedCellSets: number; items: WarehouseItem[] } | null> => {
  try {
    const [stockRes, itemsRes] = await Promise.all([
      insforge.database.from('warehouse_stock').select('*').eq('organization_id', orgId).single(),
      insforge.database.from('inventory_items').select('*').eq('organization_id', orgId),
    ]);

    const stock = (stockRes.data || {}) as any;
    const items = (itemsRes.data || []).map(dbInventoryToWarehouseItem);

    return {
      openCellSets: Number(stock.open_cell_sets) || 0,
      closedCellSets: Number(stock.closed_cell_sets) || 0,
      items,
    };
  } catch (err) {
    console.error('fetchWarehouseState error:', err);
    return null;
  }
};


// ==========================================
// REALTIME SUBSCRIPTIONS
// ==========================================

let _realtimeConnected = false;

const ensureRealtimeConnected = async () => {
  if (!_realtimeConnected) {
    try {
      await insforge.realtime.connect();
      _realtimeConnected = true;
    } catch (err) {
      console.warn('[Realtime] Connection failed:', err);
    }
  }
};

export const subscribeToOrgChanges = (
  orgId: string,
  onEstimateChange: (payload: any) => void,
  onCustomerChange: (payload: any) => void,
  onInventoryChange: (payload: any) => void
) => {
  const channelName = `org:${orgId}`;

  (async () => {
    await ensureRealtimeConnected();
    await insforge.realtime.subscribe(channelName);

    insforge.realtime.on('estimate_change', (payload: any) => {
      if (payload?.organization_id === orgId || payload?.meta?.channel === channelName) {
        onEstimateChange(payload);
      }
    });

    insforge.realtime.on('customer_change', (payload: any) => {
      if (payload?.organization_id === orgId || payload?.meta?.channel === channelName) {
        onCustomerChange(payload);
      }
    });

    insforge.realtime.on('inventory_change', (payload: any) => {
      if (payload?.organization_id === orgId || payload?.meta?.channel === channelName) {
        onInventoryChange(payload);
      }
    });
  })();

  return () => {
    insforge.realtime.unsubscribe(channelName);
  };
};


// ==========================================
// IMAGE UPLOAD
// ==========================================

export const uploadImage = async (file: File, orgId: string): Promise<string | null> => {
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${orgId}/${Date.now()}.${ext}`;

  try {
    const { data, error } = await insforge.storage
      .from('documents')
      .upload(fileName, file);

    if (error) {
      console.error('uploadImage error:', error);
      return null;
    }

    return data?.url || insforge.storage.from('documents').getPublicUrl(fileName);
  } catch (err) {
    console.error('uploadImage exception:', err);
    return null;
  }
};


// ==========================================
// AUTH HELPERS
// ==========================================

export const updatePassword = async (newPassword: string): Promise<boolean> => {
  // InsForge doesn't support updateUser directly like insforge.database.
  // Password changes should go through the reset password flow.
  // For now, use setProfile or a custom RPC if available.
  try {
    const { data, error } = await insforge.database.rpc('update_user_password', {
      p_new_password: newPassword,
    });
    if (error) {
      console.error('updatePassword error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('updatePassword exception:', err);
    return false;
  }
};


// ==========================================
// CREW REALTIME BROADCAST
// ==========================================

export const broadcastWorkOrderUpdate = (orgId: string): void => {
  const channelName = `crew-updates:${orgId}`;

  (async () => {
    try {
      await ensureRealtimeConnected();
      await insforge.realtime.subscribe(channelName);

      // Retry the send up to 3 times
      let sent = false;
      for (let attempt = 1; attempt <= 3 && !sent; attempt++) {
        try {
          await insforge.realtime.publish(channelName, 'work_order_update', {
            orgId,
            timestamp: Date.now(),
          });
          sent = true;
          console.log(`[Broadcast] Work order update sent to crew (attempt ${attempt})`);
        } catch (err) {
          console.warn(`[Broadcast] send error on attempt ${attempt}:`, err);
          await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }
      if (!sent) {
        console.error(`[Broadcast] Failed to send work order update after 3 attempts for org ${orgId}`);
      }
    } catch (err) {
      console.error('[Broadcast] Connection error:', err);
    }
  })();
};

export const subscribeToWorkOrderUpdates = (
  orgId: string,
  onUpdate: (source: 'broadcast' | 'postgres') => void
): (() => void) => {
  // -- Deduplication guard ------------------------------------------------
  let lastUpdateTs = 0;
  const DEDUP_WINDOW_MS = 2000;

  const dedupedUpdate = (source: 'broadcast' | 'postgres') => {
    const now = Date.now();
    if (now - lastUpdateTs < DEDUP_WINDOW_MS) {
      console.log(`[Crew Realtime] Skipping duplicate ${source} event (within ${DEDUP_WINDOW_MS}ms window)`);
      return;
    }
    lastUpdateTs = now;
    onUpdate(source);
  };

  const channelName = `crew-updates:${orgId}`;

  const workOrderHandler = (payload: any) => {
    console.log('[Crew Realtime] Broadcast received');
    dedupedUpdate('broadcast');
  };

  (async () => {
    try {
      await ensureRealtimeConnected();
      await insforge.realtime.subscribe(channelName);
      insforge.realtime.on('work_order_update', workOrderHandler);
      console.log('[Crew Realtime] Subscribed to work order updates');
    } catch (err) {
      console.error('[Crew Realtime] Subscription failed — will rely on polling fallback:', err);
    }
  })();

  return () => {
    insforge.realtime.off('work_order_update', workOrderHandler);
    insforge.realtime.unsubscribe(channelName);
  };
};
