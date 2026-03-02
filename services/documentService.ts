/**
 * Document Service
 *
 * Handles document storage tracking via Express API.
 * Note: File storage (upload/download) is not yet implemented on the backend.
 * These functions provide the interface that components expect, with graceful
 * fallbacks until a storage solution is added.
 */

import { api } from './apiClient';

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

/**
 * Map the PDF generator's type strings to our document_type enum.
 */
const mapDocType = (
  type: 'ESTIMATE' | 'INVOICE' | 'RECEIPT' | 'WORK_ORDER' | 'PURCHASE_ORDER',
): DocumentType => {
  const mapping: Record<string, DocumentType> = {
    ESTIMATE: 'estimate',
    INVOICE: 'invoice',
    RECEIPT: 'receipt',
    WORK_ORDER: 'work_order',
    PURCHASE_ORDER: 'purchase_order',
  };
  return mapping[type] || 'estimate';
};

// ─── SAVE DOCUMENT ──────────────────────────────────────────────────────────

/**
 * Save a PDF document reference. Currently stores metadata only.
 * File storage backend not yet implemented — returns null gracefully.
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
  // TODO: Implement file upload when storage backend is added
  console.warn('[DocumentService] File storage not yet implemented. PDF generated locally only.');
  return null;
};

// ─── FETCH DOCUMENTS ────────────────────────────────────────────────────────

/**
 * Fetch all documents for a specific customer.
 */
export const getCustomerDocuments = async (
  _orgId: string,
  _customerId: string,
): Promise<DocumentRecord[]> => {
  // TODO: Implement when document storage backend is added
  return [];
};

/**
 * Fetch all documents for a specific estimate.
 */
export const getEstimateDocuments = async (
  _orgId: string,
  _estimateId: string,
): Promise<DocumentRecord[]> => {
  // TODO: Implement when document storage backend is added
  return [];
};

/**
 * Fetch all documents for the organization.
 */
export const getOrgDocuments = async (_orgId: string): Promise<DocumentRecord[]> => {
  // TODO: Implement when document storage backend is added
  return [];
};

// ─── DELETE DOCUMENT ────────────────────────────────────────────────────────

/**
 * Delete a document record and its associated storage file.
 */
export const deleteDocument = async (
  _orgId: string,
  _documentId: string,
): Promise<boolean> => {
  // TODO: Implement when document storage backend is added
  console.warn('[DocumentService] Delete not yet implemented.');
  return false;
};
