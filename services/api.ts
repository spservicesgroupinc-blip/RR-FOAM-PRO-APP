
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
 */
export const syncDown = async (spreadsheetId: string): Promise<Partial<CalculatorState> | null> => {
  // All Google Apps Script logic removed. Use Supabase services instead.
  // (Stub file for legacy imports)
  if (result.status === 'success') {

    return result.data;
