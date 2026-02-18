import React, { useState } from 'react';
import { MessageSquarePlus, Send, X, Loader2, CheckCircle2 } from 'lucide-react';
import { submitFeedback } from '../services/feedbackService';

interface FeedbackButtonProps {
  /** Which app area this button lives in (e.g. "Dashboard", "Calculator") */
  area: string;
  /** Optional user email for attribution */
  email?: string;
  /** Optional company name */
  companyName?: string;
  /** Optional role (admin / crew) */
  role?: string;
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({ area, email, companyName, role }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setStatus('sending');
    const result = await submitFeedback({
      area,
      feedback: text.trim(),
      email,
      companyName,
      role,
    });
    if (result.status === 'success') {
      setStatus('sent');
      setTimeout(() => {
        setIsOpen(false);
        setText('');
        setStatus('idle');
      }, 1800);
    } else {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setText('');
    setStatus('idle');
  };

  return (
    <>
      {/* Trigger button — compact pill */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 hover:bg-slate-200 hover:text-slate-600 border border-slate-200 transition-all active:scale-95 select-none"
        title={`Submit feedback about ${area}`}
      >
        <MessageSquarePlus className="w-3.5 h-3.5" />
        Feedback
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4" onClick={handleClose}>
          <div
            className="bg-white md:rounded-3xl rounded-t-3xl p-6 w-full md:max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="md:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Submit Feedback</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Area: <span className="text-slate-600 font-bold">{area}</span>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 active:scale-90 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Text input */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tell us what you think, report a bug, or suggest an improvement…"
              className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:border-brand focus:ring-0 outline-none resize-none transition-colors"
              rows={4}
              maxLength={2000}
              autoFocus
              disabled={status === 'sending' || status === 'sent'}
            />
            <div className="flex items-center justify-between mt-1 mb-4">
              <span className="text-[10px] text-slate-300 font-medium">{text.length}/2000</span>
            </div>

            {/* Submit / Status */}
            {status === 'sent' ? (
              <div className="flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" /> Thank you for your feedback!
              </div>
            ) : status === 'error' ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-red-500 text-sm font-bold text-center">Failed to send. Please try again.</div>
                <button
                  onClick={handleSubmit}
                  className="w-full p-4 bg-brand text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-hover shadow-lg shadow-red-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Retry
                </button>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || status === 'sending'}
                className="w-full p-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'sending' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="w-4 h-4" /> Send Feedback</>
                )}
              </button>
            )}

            {/* Safe area pad for iOS */}
            <div className="md:hidden h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      )}
    </>
  );
};
