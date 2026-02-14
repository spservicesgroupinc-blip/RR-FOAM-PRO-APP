
import { GOOGLE_SCRIPT_URL } from '../constants';
import { CalculatorState, EstimateRecord, UserSession } from '../types';

interface ApiResponse {
  status: 'success' | 'error';
  data?: any;
  message?: string;
}

/**
 * Helper to check if API is configured
 */
const isApiConfigured = () => {
  return GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes('PLACEHOLDER');
};

/**
 * Helper for making robust fetch requests to GAS
 * Includes retry logic for cold starts
 */
const apiRequest = async (payload: any, retries = 2): Promise<ApiResponse> => {
  if (!isApiConfigured()) {
    return { status: 'error', message: 'API Config Missing' };
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        // strict text/plain to avoid CORS preflight (OPTIONS) which GAS fails on
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result: ApiResponse = await response.json();
    return result;
  } catch (error: any) {
    if (retries > 0) {
      console.warn(`API Request Failed, retrying... (${retries} left)`);
      await new Promise(res => setTimeout(res, 1000)); // Wait 1s before retry
      return apiRequest(payload, retries - 1);
    }
    console.error("API Request Failed:", error);
    return { status: 'error', message: error.message || "Network request failed" };
  }
};

/**
 * Fetches the full application state from Google Sheets
 * @deprecated Use Supabase services instead
 */
export const syncDown = async (spreadsheetId: string): Promise<Partial<CalculatorState> | null> => {
  console.warn('syncDown is deprecated. Use Supabase services instead.');
  return null;
};

/**
 * Pushes the full application state to the cloud
 * @deprecated Use Supabase services instead
 */
export const syncUp = async (appData: any, spreadsheetId: string): Promise<boolean> => {
  console.warn('syncUp is deprecated. Use Supabase services instead.');
  return false;
};

/**
 * Deletes an estimate from the cloud
 * @deprecated Use Supabase services instead
 */
export const deleteEstimate = async (id: string, spreadsheetId: string): Promise<{ success: boolean }> => {
  console.warn('deleteEstimate is deprecated. Use Supabase services instead.');
  return { success: true };
};

/**
 * Marks a job as paid and calculates P&L
 * @deprecated Use Supabase services instead
 */
export const markJobPaid = async (id: string, spreadsheetId: string): Promise<{ success: boolean; estimate?: EstimateRecord }> => {
  console.warn('markJobPaid is deprecated. Use Supabase services instead.');
  return { success: false };
};

/**
 * Creates a work order sheet for a given estimate record
 * @deprecated Use Supabase services instead
 */
export const createWorkOrderSheet = async (record: EstimateRecord, folderId?: string, spreadsheetId?: string): Promise<string | null> => {
  console.warn('createWorkOrderSheet is deprecated. Use Supabase services instead.');
  return null;
};

/**
 * Logs material usage for a job
 * @deprecated Use Supabase services instead
 */
export const logMaterialUsage = async (
  jobId: string,
  customerName: string,
  materials: any,
  loggedBy: string,
  spreadsheetId: string,
  logType?: string
): Promise<void> => {
  console.warn('logMaterialUsage is deprecated. Use Supabase services instead.');
};

/**
 * Uploads an image
 * @deprecated Use Supabase services instead
 */
export const uploadImage = async (file: File, spreadsheetId: string): Promise<string | null> => {
  console.warn('uploadImage is deprecated. Use Supabase services instead.');
  return null;
};

/**
 * Updates crew access PIN
 * @deprecated Use Supabase services instead
 */
export const updateCrewPin = async (newPin: string, spreadsheetId: string): Promise<boolean> => {
  console.warn('updateCrewPin is deprecated. Use Supabase services instead.');
  return false;
};

/**
 * Updates user password
 * @deprecated Use Supabase services instead
 */
export const updatePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
  console.warn('updatePassword is deprecated. Use Supabase services instead.');
  return false;
};

/**
 * Logs crew time for a job
 * @deprecated Use Supabase services instead
 */
export const logCrewTime = async (jobId: string, crewName: string, hours: number, spreadsheetId: string): Promise<boolean> => {
  console.warn('logCrewTime is deprecated. Use Supabase services instead.');
  return false;
};

/**
 * Completes a job
 * @deprecated Use Supabase services instead
 */
export const completeJob = async (jobId: string, actuals: any, spreadsheetId: string): Promise<boolean> => {
  console.warn('completeJob is deprecated. Use Supabase services instead.');
  return false;
};

/**
 * Starts a job
 * @deprecated Use Supabase services instead
 */
export const startJob = async (jobId: string, crewName: string, spreadsheetId: string): Promise<boolean> => {
  console.warn('startJob is deprecated. Use Supabase services instead.');
  return false;
};