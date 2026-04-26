import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AuthModal = ({ isOpen, onClose, onAuthed }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorWhatsapp, setVendorWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('email', email);
      form.append('password', password);
      const res = await api.post('/auth/login', form);
      localStorage.setItem('thrifter_token', res.data.access_token);
      const me = await api.get('/auth/me');
      onAuthed && onAuthed(me.data);
      onClose();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Login failed';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (password.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    
    setLoading(true);
    try {
      const body = {
        email,
        password,
        is_vendor: isVendor,
        vendor_name: isVendor ? vendorName : null,
        vendor_whatsapp: isVendor ? vendorWhatsapp : null,
      };
      await api.post('/auth/register', body);
      await handleLogin();
    } catch (e) {
      let msg = 'Registration failed';
      if (e?.response?.status === 422) {
        msg = 'Invalid data provided. Please check your email and ensure your password is at least 8 characters.';
      } else {
        msg = e?.response?.data?.detail || e?.message || msg;
      }
      alert(msg);
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal Content */}
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        >
          {/* Handle for mobile pull-down visual */}
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden" />
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          <div className="flex gap-4 mb-8 border-b border-gray-100">
            <button
              onClick={() => setMode('login')}
              className={`pb-3 text-lg font-bold transition-all ${mode === 'login' ? 'text-black border-b-2 border-black' : 'text-gray-400'}`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`pb-3 text-lg font-bold transition-all ${mode === 'register' ? 'text-black border-b-2 border-black' : 'text-gray-400'}`}
            >
              Sign up
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-black outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-black outline-none pr-12 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-5"
              >
                <div className="flex items-center gap-3 py-2">
                  <input
                    id="isVendor"
                    type="checkbox"
                    checked={isVendor}
                    onChange={(e) => setIsVendor(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                  />
                  <label htmlFor="isVendor" className="text-sm font-medium text-gray-700 cursor-pointer">I am a Business/Brand</label>
                </div>

                {isVendor && (
                  <div className="grid grid-cols-1 gap-4 pt-1">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business/brand name</label>
                      <input
                        type="text"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                        className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-black outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Vendor WhatsApp</label>
                      <input
                        type="text"
                        value={vendorWhatsapp}
                        onChange={(e) => setVendorWhatsapp(e.target.value)}
                        placeholder="+256..."
                        className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-black outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <button
              disabled={loading}
              onClick={mode === 'login' ? handleLogin : handleRegister}
              className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all disabled:bg-gray-400 mt-4 shadow-lg shadow-black/10"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-b-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                mode === 'login' ? 'Login' : 'Create Account'
              )}
            </button>
            
            <p className="text-center text-xs text-gray-500 mt-4 px-4">
              By continuing, you agree to discover and support local thrift brands.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AuthModal;
