import React, { useState, useEffect } from 'react';
import { Plus, X, Pencil, Trash2, RefreshCw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import DemandSubmitModal from './DemandSubmitModal';
import ThrifterLoader from './ThrifterLoader';

const DemandBoard = ({ user, onAuthRequired }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [votingIds, setVotingIds] = useState(new Set());

  // Admin action state
  const [adminEntry, setAdminEntry] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editFields, setEditFields] = useState({ item_name: '', price: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const res = await api.get('/demand');
      setEntries(res.data);
    } catch (e) {
      console.error('Failed to load demand entries', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/demand');
      setEntries(res.data);
    } catch (e) {
      console.error('Failed to refresh demand entries', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleVote = async (entry, voteType) => {
    if (!user) { onAuthRequired(); return; }
    if (votingIds.has(entry.id)) return;

    setEntries(prev => prev.map(e => {
      if (e.id !== entry.id) return e;
      let upvotes = e.upvotes;
      let downvotes = e.downvotes;
      let user_vote = e.user_vote;
      if (e.user_vote === voteType) {
        if (voteType === 'up') upvotes--; else downvotes--;
        user_vote = null;
      } else {
        if (e.user_vote === 'up') upvotes--;
        if (e.user_vote === 'down') downvotes--;
        if (voteType === 'up') upvotes++; else downvotes++;
        user_vote = voteType;
      }
      return { ...e, upvotes, downvotes, score: upvotes - downvotes, user_vote };
    }).sort((a, b) => b.score - a.score));

    setVotingIds(prev => new Set([...prev, entry.id]));
    try {
      await api.post(`/demand/${entry.id}/vote`, { vote_type: voteType });
    } catch {
      loadEntries();
    } finally {
      setVotingIds(prev => { const s = new Set(prev); s.delete(entry.id); return s; });
    }
  };

  const openAdminPanel = (entry) => {
    setAdminEntry(entry);
    setEditFields({ item_name: entry.item_name, price: entry.price, description: entry.description || '' });
    setEditMode(false);
    setConfirmDelete(false);
  };

  const closeAdminPanel = () => {
    setAdminEntry(null);
    setEditMode(false);
    setConfirmDelete(false);
    setSaving(false);
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/demand/${adminEntry.id}`, {
        item_name: editFields.item_name.trim(),
        price: editFields.price.trim(),
        description: editFields.description.trim() || null,
      });
      setEntries(prev => prev.map(e =>
        e.id === adminEntry.id
          ? { ...e, item_name: editFields.item_name.trim(), price: editFields.price.trim(), description: editFields.description.trim() || null }
          : e
      ));
      closeAdminPanel();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/admin/demand/${adminEntry.id}`);
      setEntries(prev => prev.filter(e => e.id !== adminEntry.id));
      closeAdminPanel();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to delete entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Demand Board</h1>
            <button
              onClick={() => setInfoOpen(true)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mt-0.5"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Refresh rankings"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => user ? setSubmitOpen(true) : onAuthRequired()}
              className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Request
            </button>
          </div>
        </div>

        {loading ? (
          <ThrifterLoader />
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">No requests yet</p>
            <p className="text-sm mt-1">Be the first to request an item</p>
          </div>
        ) : (
          <motion.div layout className="space-y-3">
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                layout
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={`bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-start gap-4 ${user?.is_admin ? 'cursor-pointer hover:border-gray-300 dark:hover:border-gray-500 transition-colors' : ''}`}
                onClick={() => user?.is_admin && openAdminPanel(entry)}
              >
                <span className="text-xs font-bold text-gray-300 dark:text-gray-600 pt-1 w-5 shrink-0 text-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{entry.item_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{entry.price}</p>
                  {entry.description && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{entry.description}</p>
                  )}
                </div>
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleVote(entry, 'up')}
                    disabled={votingIds.has(entry.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                      entry.user_vote === 'up'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="text-sm font-bold leading-none">▲</span>
                    {entry.upvotes}
                  </button>
                  <button
                    onClick={() => handleVote(entry, 'down')}
                    disabled={votingIds.has(entry.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                      entry.user_vote === 'down'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="text-sm font-bold leading-none">▼</span>
                    {entry.downvotes}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <DemandSubmitModal isOpen={submitOpen} onClose={() => setSubmitOpen(false)} />

      {/* Info modal */}
      <AnimatePresence>
        {infoOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setInfoOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">About the Demand Board</h2>
                <button onClick={() => setInfoOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">What is this?</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">A board where you can request clothing items you'd like to see stocked by vendors on Thrifter.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">What does voting do?</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upvotes push a request up the rankings, signalling high demand to vendors. Downvotes push it down. Vendors use this board to decide what to source and upload.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">What happens after I submit?</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your request goes to our team for a quick review before appearing on the board. This keeps the list relevant and spam-free.</p>
                </div>
              </div>
              <button
                onClick={() => setInfoOpen(false)}
                className="mt-6 w-full py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin action panel */}
      <AnimatePresence>
        {adminEntry && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={closeAdminPanel}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {editMode ? 'Edit Entry' : confirmDelete ? 'Delete Entry' : 'Manage Entry'}
                </h2>
                <button onClick={closeAdminPanel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {confirmDelete ? (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Are you sure you want to delete this entry?
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-5">
                    "{adminEntry.item_name}"
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
                    >
                      {saving ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : editMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Item Name</label>
                    <input
                      value={editFields.item_name}
                      onChange={e => setEditFields(f => ({ ...f, item_name: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Price</label>
                    <input
                      value={editFields.price}
                      onChange={e => setEditFields(f => ({ ...f, price: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Description</label>
                    <textarea
                      value={editFields.description}
                      onChange={e => setEditFields(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditMode(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleEdit}
                      disabled={saving || !editFields.item_name.trim() || !editFields.price.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-5">
                    <p className="font-semibold text-gray-900 dark:text-white">{adminEntry.item_name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{adminEntry.price}</p>
                    {adminEntry.description && (
                      <p className="text-sm text-gray-400 mt-1">{adminEntry.description}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium hover:opacity-80 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DemandBoard;
