import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const VENDOR_FORM = 'https://forms.gle/A9sBwkycNXAWnKzK6';
const USER_FORM   = 'https://forms.gle/e84a9ma7Ksfqz7bv5';

const DURATION = 15;

const SurveyPopup = ({ user, onDismiss }) => {
  const [countdown, setCountdown] = useState(DURATION);
  const formUrl = user?.is_vendor ? VENDOR_FORM : USER_FORM;

  useEffect(() => {
    if (countdown <= 0) { onDismiss(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleOpen = () => {
    if (user?.id) localStorage.setItem(`survey_seen_${user.id}`, 'true');
    window.open(formUrl, '_blank', 'noopener,noreferrer');
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">

        {/* Countdown bar — drains left to right */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-[#EAAD11] transition-[width] duration-1000 ease-linear"
            style={{ width: `${(countdown / DURATION) * 100}%` }}
          />
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-serif font-bold text-gray-900 dark:text-white">
                Quick survey
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Closes in {countdown}s</p>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Help us improve Thrifter by sharing your experience. It only takes a minute.
          </p>

          <button
            onClick={handleOpen}
            className="w-full bg-[#EAAD11] text-black font-bold py-2.5 rounded-xl hover:opacity-90 transition-all input-shadow text-sm"
          >
            Fill in survey
          </button>
        </div>

      </div>
    </div>
  );
};

export default SurveyPopup;
