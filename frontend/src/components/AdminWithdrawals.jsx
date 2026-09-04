import React, { useEffect, useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { fetchAdminWithdrawals, approveWithdrawal, rejectWithdrawal, checkPaymentProviderStatus } from '../api';
import { Link } from 'react-router-dom';
import ThrifterLoader from './ThrifterLoader';
import { useToast } from '../context/ToastContext';

const formatUGX = (n) => {
  try { return `UGX ${Number(n).toLocaleString('en-UG')}`; } catch { return `UGX ${n}`; }
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_STYLES = {
  pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_LABELS = { pending_approval: 'Pending approval', paid: 'Paid', rejected: 'Rejected', failed: 'Failed' };

const AdminWithdrawals = () => {
  const { showToast } = useToast();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const load = ({ silent } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    return fetchAdminWithdrawals()
      .then(setWithdrawals)
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (w) => {
    if (!window.confirm(`Approve and pay out ${formatUGX(w.amount)} to ${w.vendor_name || 'this vendor'} at ${w.destination_phone}? This sends real money and can't be undone.`)) return;
    setActingId(w.id);
    try {
      const updated = await approveWithdrawal(w.id);
      setWithdrawals((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Could not approve withdrawal.');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (w) => {
    if (!window.confirm(`Reject this withdrawal request for ${formatUGX(w.amount)}? The amount will be restored to the vendor's wallet.`)) return;
    setActingId(w.id);
    try {
      const updated = await rejectWithdrawal(w.id);
      setWithdrawals((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Could not reject withdrawal.');
    } finally {
      setActingId(null);
    }
  };

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await checkPaymentProviderStatus();
      showToast(res.message, res.healthy ? 'success' : 'error');
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Could not check Nylon Pay status.');
    } finally {
      setCheckingStatus(false);
    }
  };

  if (loading) return <ThrifterLoader />;

  const pending = withdrawals.filter((w) => w.status === 'pending_approval');
  const resolved = withdrawals.filter((w) => w.status !== 'pending_approval');

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-6">
        <button
          onClick={handleCheckStatus}
          disabled={checkingStatus}
          title="Checks whether Nylon Pay's API is reachable, without sending a real payout. Doesn't confirm payouts specifically are enabled — Nylon Pay can pause just that feature on its own."
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <Activity className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-pulse' : ''}`} />
          {checkingStatus ? 'Checking…' : 'Check Nylon Pay reachability'}
        </button>
        <button
          onClick={() => load({ silent: true })}
          disabled={refreshing}
          title="Refresh"
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Pending approval</h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Destination phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Requested</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {pending.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      {w.vendor_name ? (
                        <Link to={`/vendor/${encodeURIComponent(w.vendor_name)}`} className="hover:underline font-medium">
                          {w.vendor_name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{w.destination_phone}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{formatUGX(w.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(w.requested_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(w)}
                          disabled={actingId === w.id}
                          className="text-xs bg-[#EAAD11] text-black font-bold px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                        >
                          {actingId === w.id ? 'Working…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(w)}
                          disabled={actingId === w.id}
                          className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 whitespace-nowrap"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pending.length === 0 && (
              <p className="text-center py-12 text-gray-400 text-sm">No withdrawals awaiting approval.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">History</h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Destination phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Requested</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Reviewed</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {resolved.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      {w.vendor_name ? (
                        <Link to={`/vendor/${encodeURIComponent(w.vendor_name)}`} className="hover:underline font-medium">
                          {w.vendor_name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{w.destination_phone}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{formatUGX(w.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(w.requested_at)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{w.reviewed_at ? formatDate(w.reviewed_at) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[w.status] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                        {STATUS_LABELS[w.status] || w.status}
                      </span>
                      {w.failure_reason && (
                        <p className="text-xs text-red-500 mt-1 max-w-[240px]" title={w.failure_reason}>{w.failure_reason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {resolved.length === 0 && (
              <p className="text-center py-12 text-gray-400 text-sm">No resolved withdrawals yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWithdrawals;
