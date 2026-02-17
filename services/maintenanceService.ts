/**
 * Equipment Maintenance Service
 * 
 * CRUD operations for equipment maintenance tracking.
 * All maintenance is driven by total chemical sprayed (sets).
 * Each "set" = 1 proportioner cycle of open cell OR closed cell foam.
 * Every set represents pump, compressor, generator, and all spray equipment operation.
 * 
 * NOTE: The maintenance_* tables are not yet in the generated Supabase types.
 * We use `(supabase as any).from(...)` until types are regenerated.
 */

import { supabase } from '../src/lib/supabase';
import {
  MaintenanceEquipment,
  MaintenanceServiceItem,
  MaintenanceServiceLog,
  MaintenanceJobUsage,
} from '../types';

// Typed helper — new tables aren't in the generated Database type yet
const db = supabase as any;

// ─── DB → APP CONVERTERS ────────────────────────────────────────────────────

const dbToEquipment = (row: any): MaintenanceEquipment => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name || '',
  description: row.description || '',
  category: row.category || 'general',
  totalSetsSprayed: Number(row.total_sets_sprayed) || 0,
  totalHoursOperated: Number(row.total_hours_operated) || 0,
  lifetimeSets: Number(row.lifetime_sets) || 0,
  lifetimeHours: Number(row.lifetime_hours) || 0,
  status: row.status || 'active',
  lastServiceDate: row.last_service_date || null,
  serviceItems: [], // populated separately
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const dbToServiceItem = (row: any): MaintenanceServiceItem => ({
  id: row.id,
  equipmentId: row.equipment_id,
  organizationId: row.organization_id,
  name: row.name || '',
  description: row.description || '',
  intervalSets: Number(row.interval_sets) || 0,
  intervalHours: Number(row.interval_hours) || 0,
  setsSinceLastService: Number(row.sets_since_last_service) || 0,
  hoursSinceLastService: Number(row.hours_since_last_service) || 0,
  lastServicedAt: row.last_serviced_at || null,
  lastServicedBy: row.last_serviced_by || '',
  isActive: row.is_active !== false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const dbToServiceLog = (row: any): MaintenanceServiceLog => ({
  id: row.id,
  organizationId: row.organization_id,
  equipmentId: row.equipment_id,
  serviceItemId: row.service_item_id || null,
  serviceDate: row.service_date,
  performedBy: row.performed_by || '',
  notes: row.notes || '',
  setsAtService: Number(row.sets_at_service) || 0,
  hoursAtService: Number(row.hours_at_service) || 0,
  createdAt: row.created_at,
});

const dbToJobUsage = (row: any): MaintenanceJobUsage => ({
  id: row.id,
  organizationId: row.organization_id,
  estimateId: row.estimate_id || null,
  openCellSets: Number(row.open_cell_sets) || 0,
  closedCellSets: Number(row.closed_cell_sets) || 0,
  totalSets: Number(row.total_sets) || 0,
  operatingHours: Number(row.operating_hours) || 0,
  jobDate: row.job_date,
  customerName: row.customer_name || '',
  notes: row.notes || '',
  applied: row.applied || false,
  createdAt: row.created_at,
});

// ─── FETCH ALL MAINTENANCE DATA ─────────────────────────────────────────────

export interface MaintenanceData {
  equipment: MaintenanceEquipment[];
  serviceItems: MaintenanceServiceItem[];
  serviceLogs: MaintenanceServiceLog[];
  jobUsage: MaintenanceJobUsage[];
  totalSetsSprayed: number;
}

export const fetchMaintenanceData = async (orgId: string): Promise<MaintenanceData | null> => {
  try {
    // Fetch all tables in parallel
    const [equipRes, itemsRes, logsRes, usageRes] = await Promise.all([
      db
        .from('maintenance_equipment')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),
      db
        .from('maintenance_service_items')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),
      db
        .from('maintenance_service_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('service_date', { ascending: false })
        .limit(200),
      db
        .from('maintenance_job_usage')
        .select('*')
        .eq('organization_id', orgId)
        .order('job_date', { ascending: false }),
    ]);

    if (equipRes.error) throw equipRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (logsRes.error) throw logsRes.error;
    if (usageRes.error) throw usageRes.error;

    const equipment = (equipRes.data || []).map(dbToEquipment);
    const serviceItems = (itemsRes.data || []).map(dbToServiceItem);
    const serviceLogs = (logsRes.data || []).map(dbToServiceLog);
    const jobUsage = (usageRes.data || []).map(dbToJobUsage);

    // Nest service items under their equipment
    for (const equip of equipment) {
      equip.serviceItems = serviceItems.filter(si => si.equipmentId === equip.id);
    }

    // Calculate total sets across all jobs
    const totalSetsSprayed = jobUsage.reduce((sum, j) => sum + j.totalSets, 0);

    return { equipment, serviceItems, serviceLogs, jobUsage, totalSetsSprayed };
  } catch (err) {
    console.error('fetchMaintenanceData error:', err);
    return null;
  }
};

// ─── EQUIPMENT CRUD ─────────────────────────────────────────────────────────

export const upsertMaintenanceEquipment = async (
  equip: Partial<MaintenanceEquipment>,
  orgId: string
): Promise<MaintenanceEquipment | null> => {
  const payload: any = {
    organization_id: orgId,
    name: equip.name,
    description: equip.description || null,
    category: equip.category || 'general',
    status: equip.status || 'active',
    total_sets_sprayed: equip.totalSetsSprayed || 0,
    total_hours_operated: equip.totalHoursOperated || 0,
    lifetime_sets: equip.lifetimeSets || 0,
    lifetime_hours: equip.lifetimeHours || 0,
    updated_at: new Date().toISOString(),
  };

  if (equip.id) payload.id = equip.id;

  const { data, error } = await db
    .from('maintenance_equipment')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('upsertMaintenanceEquipment error:', error);
    return null;
  }
  return dbToEquipment(data);
};

export const deleteMaintenanceEquipment = async (id: string): Promise<boolean> => {
  const { error } = await db.from('maintenance_equipment').delete().eq('id', id);
  if (error) {
    console.error('deleteMaintenanceEquipment error:', error);
    return false;
  }
  return true;
};

// ─── SERVICE ITEMS CRUD ─────────────────────────────────────────────────────

export const upsertServiceItem = async (
  item: Partial<MaintenanceServiceItem>,
  orgId: string
): Promise<MaintenanceServiceItem | null> => {
  const payload: any = {
    organization_id: orgId,
    equipment_id: item.equipmentId,
    name: item.name,
    description: item.description || null,
    interval_sets: item.intervalSets || 0,
    interval_hours: item.intervalHours || 0,
    sets_since_last_service: item.setsSinceLastService || 0,
    hours_since_last_service: item.hoursSinceLastService || 0,
    is_active: item.isActive !== false,
    updated_at: new Date().toISOString(),
  };

  if (item.id) payload.id = item.id;
  if (item.lastServicedAt) payload.last_serviced_at = item.lastServicedAt;
  if (item.lastServicedBy) payload.last_serviced_by = item.lastServicedBy;

  const { data, error } = await db
    .from('maintenance_service_items')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('upsertServiceItem error:', error);
    return null;
  }
  return dbToServiceItem(data);
};

export const deleteServiceItem = async (id: string): Promise<boolean> => {
  const { error } = await db.from('maintenance_service_items').delete().eq('id', id);
  if (error) {
    console.error('deleteServiceItem error:', error);
    return false;
  }
  return true;
};

// ─── SERVICE LOG ────────────────────────────────────────────────────────────

export const logService = async (
  log: Partial<MaintenanceServiceLog>,
  orgId: string
): Promise<MaintenanceServiceLog | null> => {
  const payload: any = {
    organization_id: orgId,
    equipment_id: log.equipmentId,
    service_item_id: log.serviceItemId || null,
    service_date: log.serviceDate || new Date().toISOString(),
    performed_by: log.performedBy || '',
    notes: log.notes || '',
    sets_at_service: log.setsAtService || 0,
    hours_at_service: log.hoursAtService || 0,
  };

  const { data, error } = await db
    .from('maintenance_service_logs')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('logService error:', error);
    return null;
  }

  // Reset the service item's counter
  if (log.serviceItemId) {
    await db
      .from('maintenance_service_items')
      .update({
        sets_since_last_service: 0,
        hours_since_last_service: 0,
        last_serviced_at: new Date().toISOString(),
        last_serviced_by: log.performedBy || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', log.serviceItemId);
  }

  // Update equipment's last_service_date
  if (log.equipmentId) {
    await db
      .from('maintenance_equipment')
      .update({
        last_service_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', log.equipmentId);
  }

  return dbToServiceLog(data);
};

// ─── JOB USAGE ──────────────────────────────────────────────────────────────

export const addJobUsage = async (
  usage: Partial<MaintenanceJobUsage>,
  orgId: string
): Promise<MaintenanceJobUsage | null> => {
  const payload: any = {
    organization_id: orgId,
    estimate_id: usage.estimateId || null,
    open_cell_sets: usage.openCellSets || 0,
    closed_cell_sets: usage.closedCellSets || 0,
    operating_hours: usage.operatingHours || 0,
    job_date: usage.jobDate || new Date().toISOString(),
    customer_name: usage.customerName || '',
    notes: usage.notes || '',
    applied: false,
  };

  const { data, error } = await db
    .from('maintenance_job_usage')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('addJobUsage error:', error);
    return null;
  }
  return dbToJobUsage(data);
};

/**
 * Apply unapplied job usage to all active equipment and their service items.
 * This increments sets_since_last_service on each service item by the total new sets.
 */
export const applyPendingUsage = async (orgId: string): Promise<boolean> => {
  try {
    // Get unapplied usage
    const { data: pending, error: fetchErr } = await db
      .from('maintenance_job_usage')
      .select('*')
      .eq('organization_id', orgId)
      .eq('applied', false);

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) return true;

    const totalNewSets = pending.reduce((sum: number, row: any) => sum + Number(row.total_sets || 0), 0);
    const totalNewHours = pending.reduce((sum: number, row: any) => sum + Number(row.operating_hours || 0), 0);

    if (totalNewSets === 0 && totalNewHours === 0) return true;

    // Get all active equipment
    const { data: equipList, error: equipErr } = await db
      .from('maintenance_equipment')
      .select('id, total_sets_sprayed, total_hours_operated, lifetime_sets, lifetime_hours')
      .eq('organization_id', orgId)
      .eq('status', 'active');

    if (equipErr) throw equipErr;

    // Update each equipment's counters
    for (const eq of (equipList || [])) {
      await db
        .from('maintenance_equipment')
        .update({
          total_sets_sprayed: Number(eq.total_sets_sprayed || 0) + totalNewSets,
          total_hours_operated: Number(eq.total_hours_operated || 0) + totalNewHours,
          lifetime_sets: Number(eq.lifetime_sets || 0) + totalNewSets,
          lifetime_hours: Number(eq.lifetime_hours || 0) + totalNewHours,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eq.id);
    }

    // Update each active service item's counters
    const { data: itemList, error: itemErr } = await db
      .from('maintenance_service_items')
      .select('id, sets_since_last_service, hours_since_last_service')
      .eq('organization_id', orgId)
      .eq('is_active', true);

    if (itemErr) throw itemErr;

    for (const si of (itemList || [])) {
      await db
        .from('maintenance_service_items')
        .update({
          sets_since_last_service: Number(si.sets_since_last_service || 0) + totalNewSets,
          hours_since_last_service: Number(si.hours_since_last_service || 0) + totalNewHours,
          updated_at: new Date().toISOString(),
        })
        .eq('id', si.id);
    }

    // Mark usage as applied
    const pendingIds = pending.map((p: any) => p.id);
    await db
      .from('maintenance_job_usage')
      .update({ applied: true })
      .in('id', pendingIds);

    return true;
  } catch (err) {
    console.error('applyPendingUsage error:', err);
    return false;
  }
};

/**
 * Sync sold jobs (Work Order or later) that don't have maintenance_job_usage entries yet.
 * This auto-creates usage records from estimates that have actuals.
 */
export const syncJobsToMaintenance = async (
  orgId: string, 
  estimates: Array<{ id: string; status: string; actuals?: any; customer?: { name?: string }; date?: string }>
): Promise<number> => {
  try {
    // Get existing usage estimate IDs
    const { data: existing, error: existErr } = await db
      .from('maintenance_job_usage')
      .select('estimate_id')
      .eq('organization_id', orgId);

    if (existErr) throw existErr;
    const existingIds = new Set((existing || []).map((e: any) => e.estimate_id));

    // Filter to completed/sold jobs with actuals that aren't tracked yet
    const soldJobs = estimates.filter(e => 
      ['Work Order', 'Invoiced', 'Paid'].includes(e.status) &&
      e.actuals &&
      !existingIds.has(e.id)
    );

    let added = 0;
    for (const job of soldJobs) {
      const openSets = Number(job.actuals?.openCellSets) || 0;
      const closedSets = Number(job.actuals?.closedCellSets) || 0;
      if (openSets === 0 && closedSets === 0) continue;

      await addJobUsage({
        estimateId: job.id,
        openCellSets: openSets,
        closedCellSets: closedSets,
        operatingHours: Number(job.actuals?.laborHours) || 0,
        customerName: job.customer?.name || '',
        jobDate: job.date || new Date().toISOString(),
      }, orgId);
      added++;
    }

    return added;
  } catch (err) {
    console.error('syncJobsToMaintenance error:', err);
    return 0;
  }
};
