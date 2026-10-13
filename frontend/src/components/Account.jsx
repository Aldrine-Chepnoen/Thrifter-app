import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

// Deleting an account here (rather than only in the mobile app) is what
// satisfies Google Play's account-deletion policy requirement for a
// web-reachable deletion path alongside the in-app one — both call the same
// DELETE /auth/me, so this page doubles as that requirement's web resource.
const Account = ({ user, onAccountDeleted }) => {
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('This permanently deletes your Thrifter account. This cannot be undone. Continue?')) return;
    setDeleting(true);
    try {
      await api.delete('/auth/me');
      onAccountDeleted();
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Could not delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-3xl font-serif font-bold mb-8">Account</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-6">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Signed in as</p>
        <p className="font-medium">{user.email}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-100 dark:border-red-900/40 p-5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-600 dark:text-red-400">Delete account</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Permanently deletes your account. This cannot be undone. If you're a vendor, any wallet
              balance, in-progress withdrawal, or order still in progress must be resolved first.
            </p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm font-bold px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
        >
          {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </div>
  );
};

export default Account;
