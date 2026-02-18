import { FEEDBACK_SCRIPT_URL } from '../constants';

export interface FeedbackPayload {
  area: string;
  feedback: string;
  email?: string;
  companyName?: string;
  role?: string;
  device?: string;
}

/**
 * Submit user feedback to the Google Apps Script endpoint.
 * Returns { status: 'success' | 'error', message: string }
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<{ status: string; message: string }> {
  if (!FEEDBACK_SCRIPT_URL) {
    console.warn('FEEDBACK_SCRIPT_URL is not configured in constants.ts');
    return { status: 'error', message: 'Feedback endpoint not configured.' };
  }

  // Enrich with device info
  const enriched: FeedbackPayload = {
    ...payload,
    device: payload.device || `${navigator.userAgent.slice(0, 120)}`,
  };

  try {
    const response = await fetch(FEEDBACK_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(enriched),
      mode: 'no-cors', // Google Apps Script redirects; no-cors avoids CORS errors
    });

    // With no-cors the response is opaque — we can't read the body.
    // If we get here without throwing, treat it as success.
    return { status: 'success', message: 'Feedback submitted — thank you!' };
  } catch (err: any) {
    console.error('Feedback submission failed:', err);
    return { status: 'error', message: err?.message || 'Network error. Please try again.' };
  }
}
