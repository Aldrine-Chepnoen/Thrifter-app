import React, { useState } from 'react';
import { X, Flag, Check } from 'lucide-react';
import api from '../api';

// Reasons mirror the Terms' own categories (clause 6.10 Prohibited Items,
// clause 11 Acceptable Use) rather than free text, so reports stay
// triageable — see backend/schemas.py REPORT_REASONS, which this must match.
// Kept in sync with mobile/components/ReportModal.tsx (same flow, native UI).
const REASONS = [
  { key: 'counterfeit', label: 'Counterfeit or fake item' },
  { key: 'prohibited_item', label: 'Prohibited item' },
  { key: 'misleading', label: 'Misleading listing' },
  { key: 'harassment', label: 'Harassment or abuse' },
  { key: 'other', label: 'Something else' },
];

const ReportModal = ({ targetType, targetId, onClose }) => {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/reports', { target_type: targetType, target_id: targetId, reason, note: note.trim() || undefined });
      setDone(true);
    } catch {
      setError('Could not send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Report this {targetType === 'item' ? 'item' : 'vendor'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-semibold">Report sent</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Thanks &mdash; we&apos;ll take a look.</p>
            <button onClick={onClose} className="mt-5 px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 font-semibold text-sm">
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">What&apos;s the issue?</p>
            <div className="space-y-2 mb-3">
              {REASONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setReason(r.key)}
                  className={`w-full flex items-center justify-between text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                    reason === r.key
                      ? 'border-[#EAAD11] bg-[#EAAD11]/10 font-semibold'
                      : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {r.label}
                  {reason === r.key && <Check className="w-4 h-4 text-[#EAAD11]" />}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add details (optional)"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm outline-none focus:ring-1 focus:ring-[#EAAD11] resize-none mb-1"
            />
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <div className="flex gap-3 mt-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 font-semibold text-sm">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!reason || submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#EAAD11] text-black font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                {submitting ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
