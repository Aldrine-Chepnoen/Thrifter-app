import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { fetchNotifications, markNotificationsRead } from '../api';

const POLL_INTERVAL_MS = 60000;

const NotificationBell = ({ user }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const ref = useRef(null);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  useEffect(() => {
    if (!user) return;
    const load = () => fetchNotifications().then(setNotifications).catch(() => {});
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleOpen = () => {
    setOpen(prev => !prev);
    if (!open && unreadCount > 0) {
      markNotificationsRead()
        .then(() => setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))))
        .catch(() => {});
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative group flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-800 dark:text-gray-200 group-hover:text-[#EAAD11] transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto">
          <p className="px-4 pt-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Notifications
          </p>
          {notifications.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-gray-500 dark:text-gray-400">No notifications yet.</p>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-700 dark:text-gray-300"
              >
                {n.message}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
