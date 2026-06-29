import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

const DemandSubmitModal = ({ isOpen, onClose }) => {
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setItemName('');
    setPrice('');
    setDescription('');
    setSubmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!itemName.trim() || !price.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/demand', {
        item_name: itemName.trim(),
        price: price.trim(),
        description: description.trim() || null,
      });
      setSubmitted(true);
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 z-10"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {submitted ? 'Request Submitted' : 'Request an Item'}
              </h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-6">
                <p className="text-5xl mb-4">✓</p>
                <p className="text-gray-700 dark:text-gray-300 font-medium">Your request has been submitted</p>
                <p className="text-sm text-gray-400 mt-1">It will appear on the board once approved</p>
                <button
                  onClick={handleClose}
                  className="mt-5 w-full py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-medium"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Item Name *</label>
                  <input
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    placeholder="e.g. Vintage denim jacket"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Price *</label>
                  <input
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="e.g. Around 50k, under 30,000 UGX"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                    Description <span className="text-gray-300 dark:text-gray-600 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. Size M, navy blue, slim fit — any extra details"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !itemName.trim() || !price.trim()}
                  className="w-full py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DemandSubmitModal;
