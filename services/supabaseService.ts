/**
 * Supabase Service — Direct database and storage operations.
 *
 * All writes are scoped to the caller's organization_id, which is passed
 * explicitly because the SECURITY DEFINER RPC functions and RLS policies
 * both rely on it to enforce tenant isolation.
 */

import { supabase } from '../src/lib/supabase';
import { WarehouseItem, EquipmentItem, CustomerProfile, CompanyProfile } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRealUUID(id: string): boolean {
  return UUID_PATTERN.test(id);
}

// ─── Storage ─────────────────────────────────────────────────────────────────

/**
 * Upload an image file to the `logos` Supabase Storage bucket and return
 * the public URL.  Returns null on failure so callers can show a fallback.
 */
export async function uploadImage(
  file: File,
  organizationId: string,
): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${organizationId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error('[uploadImage]', uploadError);
    return null;
  }

  const { data } = supabase.storage.from('logos').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

// ─── Company Profile ─────────────────────────────────────────────────────────

/**
 * Upsert the company profile record for an organization.
 */
export async function updateCompanyProfile(
  profile: CompanyProfile,
  organizationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('company_profiles')
    .upsert(
      {
        organization_id: organizationId,
        company_name: profile.companyName,
        address_line1: profile.addressLine1,
        address_line2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        zip: profile.zip,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        logo_url: profile.logoUrl,
        crew_access_pin: profile.crewAccessPin,
      },
      { onConflict: 'organization_id' },
    );

  if (error) console.error('[updateCompanyProfile]', error);
}

// ─── Crew PIN ─────────────────────────────────────────────────────────────────

/**
 * Update the crew access PIN stored in the company_profiles table.
 */
export async function updateCrewPinDb(
  organizationId: string,
  pin: string,
): Promise<void> {
  const { error } = await supabase
    .from('company_profiles')
    .update({ crew_access_pin: pin })
    .eq('organization_id', organizationId);

  if (error) throw new Error(error.message);
}

// ─── Password ────────────────────────────────────────────────────────────────

/**
 * Update the authenticated admin user's password via Supabase Auth.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

// ─── Warehouse / Inventory ───────────────────────────────────────────────────

/**
 * Insert or update a warehouse item.  Returns the saved item (with its
 * server-assigned UUID) so the caller can swap out any temporary local ID.
 */
export async function upsertInventoryItem(
  item: WarehouseItem,
  organizationId: string,
): Promise<WarehouseItem | null> {
  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unit_cost: item.unitCost ?? 0,
  };

  // Only include id when it looks like a real UUID so Supabase can match rows
  const isUUID = isRealUUID(item.id);
  if (isUUID) payload.id = item.id;

  const { data, error } = await supabase
    .from('warehouse_items')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[upsertInventoryItem]', error);
    return null;
  }

  return {
    id: (data as any).id,
    name: (data as any).name,
    quantity: (data as any).quantity,
    unit: (data as any).unit,
    unitCost: (data as any).unit_cost ?? 0,
  };
}

/**
 * Delete a warehouse item by its UUID.
 */
export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('warehouse_items')
    .delete()
    .eq('id', id);

  if (error) console.error('[deleteInventoryItem]', error);
}

// ─── Equipment ───────────────────────────────────────────────────────────────

/**
 * Insert or update an equipment record.  Returns the saved record so the
 * caller can replace any temporary local ID with the server-assigned UUID.
 */
export async function upsertEquipment(
  item: EquipmentItem,
  organizationId: string,
): Promise<EquipmentItem | null> {
  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    name: item.name,
    status: item.status,
    last_seen: item.lastSeen ?? null,
  };

  const isUUID = isRealUUID(item.id);
  if (isUUID) payload.id = item.id;

  const { data, error } = await supabase
    .from('equipment')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[upsertEquipment]', error);
    return null;
  }

  return {
    id: (data as any).id,
    name: (data as any).name,
    status: (data as any).status,
    lastSeen: (data as any).last_seen ?? undefined,
  };
}

/**
 * Delete an equipment record by its UUID.
 */
export async function deleteEquipmentItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('equipment')
    .delete()
    .eq('id', id);

  if (error) console.error('[deleteEquipmentItem]', error);
}

// ─── Customers ───────────────────────────────────────────────────────────────

/**
 * Insert or update a customer record.  Returns the saved record.
 */
export async function upsertCustomer(
  customer: CustomerProfile,
  organizationId: string,
): Promise<CustomerProfile | null> {
  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    name: customer.name,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    zip: customer.zip,
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
    status: customer.status ?? 'Active',
  };

  const isUUID = isRealUUID(customer.id);
  if (isUUID) payload.id = customer.id;

  const { data, error } = await supabase
    .from('customers')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[upsertCustomer]', error);
    return null;
  }

  return {
    id: (data as any).id,
    name: (data as any).name,
    address: (data as any).address,
    city: (data as any).city,
    state: (data as any).state,
    zip: (data as any).zip,
    phone: (data as any).phone,
    email: (data as any).email,
    notes: (data as any).notes,
    status: (data as any).status,
  } as CustomerProfile;
}

// ─── Crew Job Update ─────────────────────────────────────────────────────────

/**
 * Call the `crew_update_job` Supabase RPC to record job completion by crew.
 * All parameters are passed through to the database function unchanged.
 */
export async function crewUpdateJob(params: {
  p_estimate_id: string;
  p_organization_id: string;
  p_crew_name: string;
  p_status: string;
  p_notes?: string;
  p_inventory_used?: unknown[];
  p_equipment_used?: unknown[];
}): Promise<void> {
  const { error } = await supabase.rpc('crew_update_job', params);
  if (error) throw new Error(error.message);
}
