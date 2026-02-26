/**
 * Supabase Data Service
 * 
 * Complete replacement for the deprecated Google Apps Script API.
 * All business data CRUD operations go through Supabase.
 * 
 * Pattern: Each function is optimistic-first with error propagation.
 * The hooks/components handle UI state; this layer handles DB only.
 */

import { supabase } from '../src/lib/supabase';
import {
  CalculatorState,
  EstimateRecord,
  CustomerProfile,
  InventoryItem,
  WarehouseItem,
  EquipmentItem,
  PurchaseOrder,
  MaterialUsageLogEntry,
  CompanyProfile,
} from '../types';

// ─── TYPES ──────────────────────────────────────────────────────────────────

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

const isRetryableWriteError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  const status = Number(error.status || error.statusCode || 0);

  if (status >= 500 || status === 408 || status === 429) return true;
  if (['PGRST000', 'PGRST003', '57014'].includes(code)) return true;
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('temporar')) return true;
  return false;
};

const retryWrite = async <T>(
  fn: () => PromiseLike<{ data: T; error: any }>,
  label: string,
  maxRetries = 3
): Promise<{ data: T; error: any }> => {
  let lastResult: { data: T; error: any } = { data: null as any, error: null };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (!result.error) return result;

      lastResult = result;
      if (!isRetryableWriteError(result.error) || attempt === maxRetries) {
        return result;
      }
    } catch (err) {
      lastResult = { data: null as any, error: err };
      if (!isRetryableWriteError(err) || attempt === maxRetries) {
        return lastResult;
      }
    }

    const delay = Math.min(400 * Math.pow(2, attempt), 4000);
    console.warn(`[${label}] write attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
    await new Promise(r => setTimeout(r, delay));
  }

  return lastResult;
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Convert a DB estimate row into the app's EstimateRecord shape.
 * DB stores nested data as JSONB; the app expects fully typed objects.
 */
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
    materials: row.materials || { openCellSets: 0, closedCellSets: 0, openCellStrokes: 0, closedCellStrokes: 0, ocStrokesPerSet: 6600, ccStrokesPerSet: 6600, inventory: [], equipment: [] },
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

/**
 * Convert app EstimateRecord to DB row shape for upsert
 */
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

// ─── FETCH ALL ORG DATA (single RPC call) ───────────────────────────────────

/**
 * Fetches all organization data in a single RPC call.
 * Returns a partial CalculatorState that can be merged via LOAD_DATA dispatch.
 */
export const fetchOrgData = async (orgId: string): Promise<Partial<CalculatorState> | null> => {
  try {
    const { data, error } = await supabase.rpc('get_org_data', { org_id: orgId });

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

    // Build CompanyProfile from org + settings
    const addr = (typeof org.address === 'string' ? JSON.parse(org.address) : org.address) || {};
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
      warehouse: {
        openCellSets: Number(whStock.open_cell_sets) || 0,
        closedCellSets: Number(whStock.closed_cell_sets) || 0,
        items: warehouseItems,
      },
      equipment: equipmentItems,
      materialLogs,
      purchaseOrders,
      // Restore org-level settings
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

// ─── CUSTOMERS ──────────────────────────────────────────────────────────────

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

  // If ID looks like a UUID, include it for upsert; otherwise let DB generate
  if (customer.id && customer.id.includes('-') && customer.id.length > 20) {
    payload.id = customer.id;
  }

  const { data, error } = await retryWrite(
    () => supabase
      .from('customers')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single(),
    'upsertCustomer'
  );

  if (error) {
    console.error('upsertCustomer error:', error);
    return null;
  }

  return dbCustomerToProfile(data);
};

export const deleteCustomer = async (customerId: string): Promise<boolean> => {
  const { error } = await retryWrite(
    () => supabase.from('customers').delete().eq('id', customerId),
    'deleteCustomer'
  );
  if (error) {
    console.error('deleteCustomer error:', error);
    return false;
  }
  return true;
};

// ─── ESTIMATES ──────────────────────────────────────────────────────────────

export const upsertEstimate = async (record: EstimateRecord, orgId: string): Promise<EstimateRecord | null> => {
  // Ensure customer exists first
  if (record.customer?.name) {
    const savedCustomer = await upsertCustomer(record.customer, orgId);
    if (savedCustomer) {
      record.customerId = savedCustomer.id;
      record.customer = savedCustomer;
    }
  }

  const dbRow = recordToDbEstimate(record, orgId);

  // If ID looks like a UUID use it; otherwise let DB generate
  if (!record.id || record.id.length < 20 || !record.id.includes('-')) {
    delete (dbRow as any).id;
  }

  // Sanitize customer_id: if it's not a valid UUID, set to null to prevent
  // the entire estimate upsert from failing with a UUID type cast error.
  // This can happen when upsertCustomer fails and customerId is still a
  // temp local ID (e.g. "a1b2c3d4e").
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ((dbRow as any).customer_id && !UUID_RE.test((dbRow as any).customer_id)) {
    console.warn('[upsertEstimate] customer_id is not a valid UUID, setting to null:', (dbRow as any).customer_id);
    (dbRow as any).customer_id = null;
  }

  const { data, error } = await retryWrite(
    () => supabase
      .from('estimates')
      .upsert(dbRow, { onConflict: 'id' })
      .select()
      .single(),
    'upsertEstimate'
  );

  if (error) {
    console.error('upsertEstimate error:', error);
    // Throw so callers' .catch() handlers fire and can display error notifications.
    // Previously returned null which silently swallowed the error on iOS auth failures.
    throw new Error(error.message || 'Failed to save estimate to cloud');
  }

  return dbEstimateToRecord(data, [record.customer]);
};

export const deleteEstimateDb = async (estimateId: string): Promise<boolean> => {
  const { error } = await retryWrite(
    () => supabase.from('estimates').delete().eq('id', estimateId),
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
    () => supabase
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
    () => supabase
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
    () => supabase
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

/**
 * Mark an estimate's inventory as processed (client-side safety net fallback).
 * The crew_update_job SQL function now does this atomically, but this
 * covers cases where the SQL hasn't been redeployed or the client reconciles.
 */
export const markEstimateInventoryProcessed = async (
  estimateId: string
): Promise<boolean> => {
  const { error } = await retryWrite(
    () => supabase
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

// ─── WAREHOUSE / INVENTORY ──────────────────────────────────────────────────

export const updateWarehouseStock = async (
  orgId: string,
  openCellSets: number,
  closedCellSets: number
): Promise<boolean> => {
  const { error } = await retryWrite(
    () => supabase
      .from('warehouse_stock')
      .upsert({
        organization_id: orgId,
        open_cell_sets: openCellSets,
        closed_cell_sets: closedCellSets,
      }, { onConflict: 'organization_id' }),
    'updateWarehouseStock'
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

  // Only set ID if it looks like a valid Supabase UUID.
  // Short local IDs (from `Math.random().toString(36)`) are intentionally
  // omitted so Supabase generates a proper UUID on INSERT.
  const isUuid = item.id && item.id.includes('-') && item.id.length > 20;
  if (isUuid) {
    payload.id = item.id;
  }

  // For items with a UUID → upsert (update-or-insert by id).
  // For items without a UUID → try to match by org + name first to avoid
  // creating duplicates when the local ID hasn't been synced yet.
  if (!isUuid && item.name) {
    // Check if an item with this name already exists for this org
    const { data: existing } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('name', item.name)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      // Update the existing row instead of creating a duplicate
      payload.id = existing.id;
    }
  }

  const { data, error } = await retryWrite(
    () => supabase
      .from('inventory_items')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single(),
    'upsertInventoryItem'
  );

  if (error) {
    console.error('upsertInventoryItem error:', error);
    return null;
  }
  return dbInventoryToWarehouseItem(data);
};

export const deleteInventoryItem = async (itemId: string): Promise<boolean> => {
  const { error } = await retryWrite(
    () => supabase.from('inventory_items').delete().eq('id', itemId),
    'deleteInventoryItem'
  );
  if (error) {
    console.error('deleteInventoryItem error:', error);
    return false;
  }
  return true;
};

// ─── EQUIPMENT ──────────────────────────────────────────────────────────────

export const upsertEquipment = async (item: EquipmentItem, orgId: string): Promise<EquipmentItem | null> => {
  const payload: any = {
    organization_id: orgId,
    name: item.name,
    status: item.status || 'Available',
    last_seen: item.lastSeen || null,
  };

  if (item.id && item.id.includes('-') && item.id.length > 20) {
    payload.id = item.id;
  }

  const { data, error } = await retryWrite(
    () => supabase
      .from('equipment')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single(),
    'upsertEquipment'
  );

  if (error) {
    console.error('upsertEquipment error:', error);
    return null;
  }
  return dbEquipmentToItem(data);
};

export const deleteEquipmentItem = async (itemId: string): Promise<boolean> => {
  const { error } = await retryWrite(
    () => supabase.from('equipment').delete().eq('id', itemId),
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
    () => supabase.from('equipment').update(payload).eq('id', itemId),
    'updateEquipmentStatus'
  );
  if (error) {
    console.error('updateEquipmentStatus error:', error);
    return false;
  }
  return true;
};

// ─── MATERIAL LOGS ──────────────────────────────────────────────────────────

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
    () => supabase.from('material_logs').insert(rows),
    'insertMaterialLogs'
  );
  if (error) {
    console.error('insertMaterialLogs error:', error);
    return false;
  }
  return true;
};

// ─── PURCHASE ORDERS ────────────────────────────────────────────────────────

export const insertPurchaseOrder = async (po: PurchaseOrder, orgId: string): Promise<PurchaseOrder | null> => {
  const { data, error } = await retryWrite(
    () => supabase
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

// ─── ORGANIZATION SETTINGS ──────────────────────────────────────────────────

export const updateOrgSettings = async (
  orgId: string,
  settings: Record<string, any>
): Promise<boolean> => {
  // Merge with existing settings
  const { data: org, error: fetchErr } = await supabase
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
    () => supabase
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
  // NOTE: Do NOT include `settings` here — settings (yields, costs, pricingMode,
  // sqFtRates, lifetimeUsage, website) are managed exclusively by updateOrgSettings.
  // Overwriting `settings` here would destroy all those values on every sync.
  const { error } = await retryWrite(
    () => supabase
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
    () => supabase
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

// ─── BULK SYNC (save full app state to Supabase) ───────────────────────────

/**
 * Persists the critical parts of CalculatorState to Supabase.
 * This replaces the old syncUp → Google Apps Script pattern.
 * 
 * Strategy: Save org settings, warehouse stock, and any dirty estimates.
 * Individual CRUD ops are preferred, but this handles batch persist on manual sync.
 */
export const syncAppDataToSupabase = async (
  appData: CalculatorState,
  orgId: string
): Promise<boolean> => {
  try {
    let hasErrors = false;

    // 1. Org-level settings (yields, costs, pricingMode, etc.)
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

    // 4. Warehouse items (inventory)
    for (const item of appData.warehouse.items) {
      const saved = await upsertInventoryItem(item, orgId);
      if (!saved) {
        hasErrors = true;
        console.warn(`[syncAppData] Failed to sync inventory item ${item.id || item.name}`);
      }
    }

    // 5. Equipment
    for (const item of appData.equipment) {
      const saved = await upsertEquipment(item, orgId);
      if (!saved) {
        hasErrors = true;
        console.warn(`[syncAppData] Failed to sync equipment item ${item.id || item.name}`);
      }
    }

    // 6. Customers
    for (const customer of appData.customers) {
      const saved = await upsertCustomer(customer, orgId);
      if (!saved) {
        hasErrors = true;
        console.warn(`[syncAppData] Failed to sync customer ${customer.id || customer.name}`);
      }
    }

    // 7. Estimates (batch upsert) — continue on individual failures so one
    //    bad estimate doesn't block the entire sync from completing.
    let estimateErrors = 0;
    for (const estimate of appData.savedEstimates) {
      try {
        await upsertEstimate(estimate, orgId);
      } catch (estErr: any) {
        estimateErrors++;
        // Log but continue — subscription limit errors, transient network
        // issues, or bad data on a single estimate shouldn't abort sync.
        console.warn(`[syncAppData] Estimate ${estimate.id} failed:`, estErr?.message || estErr);
      }
    }

    if (estimateErrors > 0) {
      console.warn(`[syncAppData] ${estimateErrors}/${appData.savedEstimates.length} estimate(s) failed to sync`);
    }

    return !hasErrors && estimateErrors === 0;
  } catch (err) {
    console.error('syncAppDataToSupabase error:', err);
    return false;
  }
};

// ─── CREW-SPECIFIC FUNCTIONS (bypass RLS via SECURITY DEFINER RPCs) ─────────

/**
 * Helper: Build crew result from raw org/customers/estimates data.
 */
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
    // Include org-level settings so crew gets admin's strokes-per-set config
    yields: settings.yields || undefined,
    costs: settings.costs || undefined,
  };
};

/**
 * Fetch work orders for crew dashboard.
 * 
 * Strategy:
 *   1. Try the SECURITY DEFINER RPC (preferred — bypasses RLS)
 *   2. Fallback: direct table queries (works if RLS has anon/crew policies)
 * 
 * Crew has no auth.uid() — uses org_id from PIN login session.
 */
export const fetchCrewWorkOrders = async (orgId: string): Promise<Partial<CalculatorState> | null> => {
  // ── Attempt 1: RPC call (preferred) ──
  try {
    const { data, error } = await supabase.rpc('get_crew_work_orders', { p_org_id: orgId });

    if (!error && data) {
      const result = data as any;
      console.log('[Crew Sync] RPC success — estimates:', (result.estimates || []).length);
      return buildCrewResult(
        result.organization || {},
        result.customers || [],
        result.estimates || []
      );
    }

    // RPC failed — log detail and fall through to fallback
    console.warn('[Crew Sync] RPC get_crew_work_orders failed:', error?.message || 'No data returned');
    console.warn('[Crew Sync] Hint: Run supabase_functions.sql in the Supabase SQL Editor to create missing RPCs.');
  } catch (err) {
    console.warn('[Crew Sync] RPC exception:', err);
  }

  // ── Attempt 2: Direct queries as fallback ──
  // NOTE: Crew users have no auth.uid() (PIN-based login), so direct queries
  // are typically blocked by RLS. This fallback only works if anon/crew
  // policies exist on the tables. If RLS blocks everything, we return null
  // so the UI shows a clear error to run supabase_functions.sql.
  console.log('[Crew Sync] Trying direct query fallback...');
  try {
    const [orgRes, custRes, estRes] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', orgId).single(),
      supabase.from('customers').select('*').eq('organization_id', orgId),
      supabase.from('estimates').select('*').eq('organization_id', orgId).eq('status', 'Work Order'),
    ]);

    if (orgRes.error) console.error('[Crew Sync] Fallback org query error:', orgRes.error.message);
    if (custRes.error) console.error('[Crew Sync] Fallback customers query error:', custRes.error.message);
    if (estRes.error) console.error('[Crew Sync] Fallback estimates query error:', estRes.error.message);

    // Even if some queries fail (RLS), return whatever we got
    const org = orgRes.data || {} as any;
    const rawCustomers = custRes.data || [];
    const rawEstimates = estRes.data || [];

    console.log(`[Crew Sync] Fallback results — org: ${org.name || 'N/A'}, customers: ${rawCustomers.length}, estimates: ${rawEstimates.length}`);

    // Detect RLS-blocked fallback: if the org itself couldn't be read, RLS
    // is blocking crew access and the fallback is useless. Return null so
    // the UI shows the "run supabase_functions.sql" error message.
    if (!orgRes.data || orgRes.error) {
      console.error(
        '[Crew Sync] CRITICAL: Cannot read organization data. ' +
        'Crew users have no auth.uid(), so direct queries are blocked by RLS. ' +
        'The get_crew_work_orders RPC function is required. ' +
        'Run supabase_functions.sql in the Supabase SQL Editor to fix this.'
      );
      return null;
    }

    if (rawEstimates.length === 0 && estRes.error) {
      // Both RPC and direct query failed — likely RLS blocking everything
      console.error(
        '[Crew Sync] CRITICAL: Both RPC and direct queries returned 0 estimates. ' +
        'This usually means the get_crew_work_orders RPC function is missing in Supabase. ' +
        'Run supabase_functions.sql in the Supabase SQL Editor to fix this.'
      );
      return null;
    }

    return buildCrewResult(org, rawCustomers, rawEstimates);
  } catch (err) {
    console.error('[Crew Sync] Direct query fallback exception:', err);
    return null;
  }
};

// ─── iOS RETRY / OFFLINE QUEUE HELPERS ──────────────────────────────────────

/**
 * Retry a Supabase RPC call with exponential backoff.
 * iOS drops network connections when the app is backgrounded; this ensures
 * critical writes (job start, timer save, completion) are not silently lost.
 */
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
      // Don't retry on auth/permission errors — only transient network issues
      if (result.error?.code === 'PGRST301' || result.error?.code === '42501') {
        console.error(`[${label}] Auth/permission error — not retrying:`, result.error);
        return result;
      }
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      console.warn(`[${label}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return { data: null as any, error: lastError };
};

/**
 * Local offline queue has been removed to avoid on-device business-data persistence.
 * Crew updates are written directly to Supabase only.
 */
export const flushOfflineCrewQueue = async (): Promise<number> => {
  return 0;
};

/**
 * Crew updates job actuals + execution status via RPC (no auth.uid() needed).
 * Includes retry logic for transient network drops.
 */
export const crewUpdateJob = async (
  orgId: string,
  estimateId: string,
  actuals: any,
  executionStatus: string
): Promise<boolean> => {
  const { data, error } = await retryRPC(
    () => supabase.rpc('crew_update_job', {
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
    return false;
  }

  return data === true;
};

// ─── LIGHTWEIGHT WAREHOUSE FETCH ────────────────────────────────────────────

/**
 * Fetch ONLY warehouse data (stock + inventory items) for an organization.
 * Used for targeted refreshes after auto-sync to catch crew_update_job adjustments
 * without the overhead of a full fetchOrgData call.
 */
export const fetchWarehouseState = async (
  orgId: string
): Promise<{ openCellSets: number; closedCellSets: number; items: WarehouseItem[] } | null> => {
  try {
    const [stockRes, itemsRes] = await Promise.all([
      supabase.from('warehouse_stock').select('*').eq('organization_id', orgId).single(),
      supabase.from('inventory_items').select('*').eq('organization_id', orgId),
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

// ─── REALTIME SUBSCRIPTIONS ─────────────────────────────────────────────────

/**
 * Subscribe to real-time changes for an organization.
 * Returns an unsubscribe function.
 */
export const subscribeToOrgChanges = (
  orgId: string,
  onEstimateChange: (payload: any) => void,
  onCustomerChange: (payload: any) => void,
  onInventoryChange: (payload: any) => void
) => {
  const channel = supabase
    .channel(`org-${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'estimates',
        filter: `organization_id=eq.${orgId}`,
      },
      onEstimateChange
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'customers',
        filter: `organization_id=eq.${orgId}`,
      },
      onCustomerChange
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory_items',
        filter: `organization_id=eq.${orgId}`,
      },
      onInventoryChange
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'warehouse_stock',
        filter: `organization_id=eq.${orgId}`,
      },
      onInventoryChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ─── IMAGE UPLOAD ───────────────────────────────────────────────────────────

export const uploadImage = async (file: File, orgId: string): Promise<string | null> => {
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${orgId}/${Date.now()}.${ext}`;

  const { error } = await retryWrite(
    () => supabase.storage
      .from('uploads')
      .upload(fileName, file, { cacheControl: '3600', upsert: false }),
    'uploadImage'
  );

  if (error) {
    console.error('uploadImage error:', error);
    return null;
  }

  const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
  return data?.publicUrl || null;
};

// ─── PASSWORD UPDATE ────────────────────────────────────────────────────────

export const updatePassword = async (newPassword: string): Promise<boolean> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error('updatePassword error:', error);
    return false;
  }
  return true;
};

// ─── CREW REALTIME BROADCAST ────────────────────────────────────────────────

/**
 * Broadcast a work-order-update event to all crew members for this org.
 * Uses Supabase Realtime Broadcast which works without Supabase auth,
 * making it suitable for PIN-based crew sessions.
 */
export const broadcastWorkOrderUpdate = (orgId: string): void => {
  const channelName = `crew-updates-${orgId}`;
  const BROADCAST_CLEANUP_DELAY_MS = 2000;
  const channel = supabase.channel(channelName);

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({
        type: 'broadcast',
        event: 'work_order_update',
        payload: { orgId, timestamp: Date.now() },
      }).catch((err) => console.warn(`[Broadcast] send error for org ${orgId}:`, err));
      // Clean up after a short delay (enough for the message to be delivered)
      setTimeout(() => supabase.removeChannel(channel), BROADCAST_CLEANUP_DELAY_MS);
    }
  });
};

/**
 * Subscribe to work-order-update broadcast events for a given org.
 * Intended for crew dashboard — requires no Supabase auth.
 * Returns an unsubscribe function.
 */
export const subscribeToWorkOrderUpdates = (
  orgId: string,
  onUpdate: () => void
): (() => void) => {
  const channelName = `crew-updates-${orgId}`;
  const channel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'work_order_update' }, () => {
      onUpdate();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
