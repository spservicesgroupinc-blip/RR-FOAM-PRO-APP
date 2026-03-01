/**
 * Document Service
 * 
 * Handles uploading generated PDFs to InsForge Storage and tracking
 * them in the `documents` table for per-customer / per-estimate access.
 */

import { insforge } from '../src/lib/insforge';

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type DocumentType = 'estimate' | 'invoice' | 'receipt' | 'work_order' | 'purchase_order';

export interface DocumentRecord {
  id: string;
  organizationId: string;
  customerId: string | null;
  estimateId: string | null;
  documentType: DocumentType;
  filename: string;
  storagePath: string;
  publicUrl: string;
  fileSize: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const dbDocToRecord = (row: any): DocumentRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  customerId: row.customer_id || null,
  estimateId: row.estimate_id || null,
  documentType: row.document_type,
  filename: row.filename,
  storagePath: row.storage_path,
  publicUrl: row.public_url || '',
  fileSize: row.file_size || 0,
  metadata: row.metadata || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Map the PDF generator's type strings to our document_type enum.
 */
const mapDocType = (type: 'ESTIMATE' | 'INVOICE' | 'RECEIPT' | 'WORK_ORDER' | 'PURCHASE_ORDER'): DocumentType => {
  const mapping: Record<string, DocumentType> = {
    ESTIMATE: 'estimate',
    INVOICE: 'invoice',
    RECEIPT: 'receipt',
    WORK_ORDER: 'work_order',
    PURCHASE_ORDER: 'purchase_order',
  };
  return mapping[type] || 'estimate';
};

// ─── UPLOAD & SAVE ──────────────────────────────────────────────────────────

/**
 * Upload a PDF blob to InsForge Storage and record it in the `documents` table.
 * 
 * Storage path: `{orgId}/{customerId}/{docType}_{timestamp}.pdf`
 * Falls back to `{orgId}/general/` if no customer.
 * 
 * @returns The saved DocumentRecord, or null on failure.
 */
export const saveDocument = async (options: {
  pdfBlob: Blob;
  filename: string;
  orgId: string;
  customerId?: string | null;
  estimateId?: string | null;
  documentType: 'ESTIMATE' | 'INVOICE' | 'RECEIPT' | 'WORK_ORDER' | 'PURCHASE_ORDER';
  metadata?: Record<string, any>;
}): Promise<DocumentRecord | null> => {
  const { pdfBlob, filename, orgId, customerId, estimateId, documentType, metadata } = options;

  try {
    const docType = mapDocType(documentType);
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Build storage path: org/customer/type_timestamp.pdf
    const customerFolder = customerId || 'general';
    const storagePath = `${orgId}/${customerFolder}/${docType}_${timestamp}_${sanitizedFilename}`;

    // 1. Upload to InsForge Storage
    const { data: uploadData, error: uploadError } = await insforge.storage
      .from('documents')
      .upload(storagePath, pdfBlob);

    if (uploadError) {
      console.error('[DocumentService] Storage upload error:', uploadError);
      return null;
    }

    // 2. Get public URL from upload response
    const publicUrl = uploadData?.url || '';

    // 3. Insert record into documents table
    const { data, error: insertError } = await (insforge.database
      .from('documents') as any)
      .insert({
        organization_id: orgId,
        customer_id: customerId || null,
        estimate_id: estimateId || null,
        document_type: docType,
        filename: sanitizedFilename,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size: pdfBlob.size,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      console.error('[DocumentService] DB insert error:', insertError);
      // File was uploaded but DB record failed — still usable via storage
      return null;
    }

    console.log(`[DocumentService] Saved ${docType} document: ${storagePath}`);
    return dbDocToRecord(data);
  } catch (err) {
    console.error('[DocumentService] saveDocument exception:', err);
    return null;
  }
};

// ─── FETCH DOCUMENTS ────────────────────────────────────────────────────────

/**
 * Fetch all documents for a specific customer.
 */
export const getCustomerDocuments = async (
  orgId: string,
  customerId: string
): Promise<DocumentRecord[]> => {
  try {
    // Try RPC first (bypasses RLS for crew)
    const { data: rpcData, error: rpcError } = await (insforge.database as any)
      .rpc('get_customer_documents', { p_org_id: orgId, p_customer_id: customerId });

    if (!rpcError && rpcData) {
      return (rpcData as any[]).map(dbDocToRecord);
    }

    // Fallback: direct query
    const { data, error } = await (insforge.database
      .from('documents') as any)
      .select('*')
      .eq('organization_id', orgId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DocumentService] getCustomerDocuments error:', error);
      return [];
    }

    return (data || []).map(dbDocToRecord);
  } catch (err) {
    console.error('[DocumentService] getCustomerDocuments exception:', err);
    return [];
  }
};

/**
 * Fetch all documents for a specific estimate.
 */
export const getEstimateDocuments = async (
  orgId: string,
  estimateId: string
): Promise<DocumentRecord[]> => {
  try {
    const { data: rpcData, error: rpcError } = await (insforge.database as any)
      .rpc('get_estimate_documents', { p_org_id: orgId, p_estimate_id: estimateId });

    if (!rpcError && rpcData) {
      return (rpcData as any[]).map(dbDocToRecord);
    }

    // Fallback
    const { data, error } = await (insforge.database
      .from('documents') as any)
      .select('*')
      .eq('organization_id', orgId)
      .eq('estimate_id', estimateId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DocumentService] getEstimateDocuments error:', error);
      return [];
    }

    return (data || []).map(dbDocToRecord);
  } catch (err) {
    console.error('[DocumentService] getEstimateDocuments exception:', err);
    return [];
  }
};

/**
 * Fetch all documents for the entire organization.
 */
export const getOrgDocuments = async (
  orgId: string,
  filters?: { documentType?: DocumentType; limit?: number }
): Promise<DocumentRecord[]> => {
  try {
    let query = (insforge.database
      .from('documents') as any)
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (filters?.documentType) {
      query = query.eq('document_type', filters.documentType);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[DocumentService] getOrgDocuments error:', error);
      return [];
    }

    return (data || []).map(dbDocToRecord);
  } catch (err) {
    console.error('[DocumentService] getOrgDocuments exception:', err);
    return [];
  }
};

/**
 * Delete a document from both storage and the database.
 */
export const deleteDocument = async (documentId: string, storagePath: string): Promise<boolean> => {
  try {
    // Remove from storage
    const { error: storageError } = await insforge.storage
      .from('documents')
      .remove(storagePath);

    if (storageError) {
      console.warn('[DocumentService] Storage delete warning:', storageError);
    }

    // Remove from DB
    const { error: dbError } = await (insforge.database
      .from('documents') as any)
      .delete()
      .eq('id', documentId);

    if (dbError) {
      console.error('[DocumentService] DB delete error:', dbError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[DocumentService] deleteDocument exception:', err);
    return false;
  }
};
