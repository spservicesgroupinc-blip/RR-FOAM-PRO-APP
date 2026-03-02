/**
 * Maintenance Service
 *
 * CRUD operations for equipment maintenance tracking.
 * Uses Express API via apiClient (replaces InsForge SDK).
 */

import { api } from './apiClient';
import {
  MaintenanceEquipment,
  MaintenanceServiceItem,
  MaintenanceServiceLog,
  MaintenanceJobUsage,
} from '../types';

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface MaintenanceData {
  equipment: MaintenanceEquipment[];
  serviceItems: MaintenanceServiceItem[];
  serviceLogs: MaintenanceServiceLog[];
  jobUsage: MaintenanceJobUsage[];
  totalSetsSprayed: number;
}

// ─── FETCH ALL MAINTENANCE DATA ─────────────────────────────────────────────

export const fetchMaintenanceData = async (_orgId: string): Promise<MaintenanceData | null> => {
  try {
    const { data, error } = await api.get<MaintenanceData>('/api/maintenance');
    if (error || !data) {
      console.error('fetchMaintenanceData error:', error);
      return null;
    }

    // Nest service items under their equipment
    for (const equip of data.equipment) {
      equip.serviceItems = (data.serviceItems || []).filter(
        (si) => si.equipmentId === equip.id,
      );
    }

    // Calculate total sets
    data.totalSetsSprayed = (data.jobUsage || []).reduce(
      (sum, j) => sum + (j.totalSets || 0),
      0,
    );

    return data;
  } catch (err) {
    console.error('fetchMaintenanceData exception:', err);
    return null;
  }
};

// ─── EQUIPMENT CRUD ─────────────────────────────────────────────────────────

export const upsertMaintenanceEquipment = async (
  equip: Partial<MaintenanceEquipment>,
  _orgId: string,
): Promise<MaintenanceEquipment | null> => {
  try {
    const { data, error } = await api.post<MaintenanceEquipment>(
      '/api/maintenance/equipment',
      equip,
    );
    if (error) {
      console.error('upsertMaintenanceEquipment error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('upsertMaintenanceEquipment exception:', err);
    return null;
  }
};

export const deleteMaintenanceEquipment = async (
  equipId: string,
  _orgId: string,
): Promise<boolean> => {
  try {
    const { error } = await api.delete(`/api/maintenance/equipment/${equipId}`);
    if (error) {
      console.error('deleteMaintenanceEquipment error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('deleteMaintenanceEquipment exception:', err);
    return false;
  }
};

// ─── SERVICE ITEMS ──────────────────────────────────────────────────────────

export const upsertServiceItem = async (
  item: Partial<MaintenanceServiceItem>,
  _orgId: string,
): Promise<MaintenanceServiceItem | null> => {
  try {
    const { data, error } = await api.post<MaintenanceServiceItem>(
      '/api/maintenance/service-items',
      item,
    );
    if (error) {
      console.error('upsertServiceItem error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('upsertServiceItem exception:', err);
    return null;
  }
};

export const deleteServiceItem = async (
  itemId: string,
  _orgId: string,
): Promise<boolean> => {
  try {
    const { error } = await api.delete(`/api/maintenance/service-items/${itemId}`);
    if (error) {
      console.error('deleteServiceItem error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('deleteServiceItem exception:', err);
    return false;
  }
};

// ─── SERVICE LOGGING ────────────────────────────────────────────────────────

export const logService = async (
  logData: Partial<MaintenanceServiceLog>,
  _orgId: string,
): Promise<MaintenanceServiceLog | null> => {
  try {
    const { data, error } = await api.post<MaintenanceServiceLog>(
      '/api/maintenance/service-logs',
      logData,
    );
    if (error) {
      console.error('logService error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('logService exception:', err);
    return null;
  }
};

// ─── JOB USAGE ──────────────────────────────────────────────────────────────

export const recordJobUsage = async (
  usage: Partial<MaintenanceJobUsage>,
  _orgId: string,
): Promise<MaintenanceJobUsage | null> => {
  try {
    const { data, error } = await api.post<MaintenanceJobUsage>(
      '/api/maintenance/job-usage',
      usage,
    );
    if (error) {
      console.error('recordJobUsage error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('recordJobUsage exception:', err);
    return null;
  }
};

export const applyJobUsage = async (
  usage: Partial<MaintenanceJobUsage>,
  _orgId: string,
): Promise<boolean> => {
  try {
    const { error } = await api.post('/api/maintenance/apply-usage', usage);
    if (error) {
      console.error('applyJobUsage error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('applyJobUsage exception:', err);
    return false;
  }
};
