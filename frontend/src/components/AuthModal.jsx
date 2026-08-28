import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, X, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';

const AuthModal = ({ isOpen, onClose, onAuthed }) => {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState('form'); // 'form' | 'google-confirm-signup' | 'google-vendor'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorWhatsapp, setVendorWhatsapp] = useState('');
  const [vendorLocation, setVendorLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState(null);
  const [pendingGoogleEmail, setPendingGoogleEmail] = useState('');

  if (!isOpen) return null;

  const resetAndClose = () => {
    setStep('form');
    setIsVendor(false);
    setVendorName('');
    setVendorWhatsapp('');
    setVendorLocation('');
    setPendingGoogleCredential(null);
    setPendingGoogleEmail('');
    onClose();
  };

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
      resetAndClose();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Login failed';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (credential, confirmSignup = false) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/google', { credential, confirm_signup: confirmSignup });
      if (res.data.needs_confirmation) {
        setPendingGoogleCredential(credential);
        setPendingGoogleEmail(res.data.email);
        setStep('google-confirm-signup');
        return;
      }
      localStorage.setItem('thrifter_token', res.data.access_token);
      const me = await api.get('/auth/me');
      onAuthed && onAuthed(me.data);
      if (res.data.is_new_user) {
        setStep('google-vendor');
      } else {
        resetAndClose();
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Google sign-in failed';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser. Please type your pickup location instead.');
      return;
    }
    if (!window.confirm('Are you sure you want to use your current location as your pickup location?')) {
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.post('/geocode/reverse', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setVendorLocation(res.data.address);
        } catch (e) {
          alert(e?.response?.data?.detail || 'Could not determine your address. Please type your pickup location instead.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        alert('Could not get your location. Please type your pickup location instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleVendorUpgrade = async () => {
    if (!vendorName.trim() || !vendorWhatsapp.trim() || !vendorLocation.trim()) {
      alert('Please provide your business name, WhatsApp number, and pickup location.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/vendor-upgrade', {
        vendor_name: vendorName,
        vendor_whatsapp: vendorWhatsapp,
        vendor_location: vendorLocation.trim(),
      });
      onAuthed && onAuthed(res.data);
      resetAndClose();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Could not save vendor details';
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
    if (isVendor && !vendorLocation.trim()) {
      alert('Please provide a pickup location for your business.');
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
        vendor_location: isVendor ? vendorLocation.trim() : null,
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
          onClick={resetAndClose}
        />
        
        {/* Modal Content */}
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        >
          {/* Handle for mobile pull-down visual */}
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />
          
          <button
            onClick={resetAndClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {step === 'google-confirm-signup' ? (
            <div className="space-y-5 pt-2">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">No account found</h3>
                <p className="text-sm text-gray-500">
                  There's no Thrifter account for <span className="font-semibold text-gray-700 dark:text-gray-300">{pendingGoogleEmail}</span>. Would you like to create one?
                </p>
              </div>

              <button
                disabled={loading}
                onClick={() => handleGoogleAuth(pendingGoogleCredential, true)}
                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all disabled:bg-gray-400 shadow-lg shadow-black/10"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-b-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Create account'
                )}
              </button>
              <button
                disabled={loading}
                onClick={() => { setPendingGoogleCredential(null); setPendingGoogleEmail(''); setStep('form'); }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1"
              >
                Cancel
              </button>
            </div>
          ) : step === 'google-vendor' ? (
            <div className="space-y-5 pt-2">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">One more thing</h3>
                <p className="text-sm text-gray-500">Are you a business or brand selling on Thrifter?</p>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  id="isVendorGoogle"
                  type="checkbox"
                  checked={isVendor}
                  onChange={(e) => setIsVendor(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                />
                <label htmlFor="isVendorGoogle" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">I am a Business/Brand</label>
              </div>

              {isVendor && (
                <div className="grid grid-cols-1 gap-4 pt-1">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Business/brand name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none transition-all"
                      required
                      minLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Vendor WhatsApp <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={vendorWhatsapp}
                      onChange={(e) => setVendorWhatsapp(e.target.value)}
                      placeholder="+256..."
                      className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Pickup Location <span className="text-red-500">*</span></label>
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        disabled={locating}
                        className="flex items-center gap-1 text-xs font-semibold text-black dark:text-white hover:underline disabled:opacity-50"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        {locating ? 'Locating…' : 'Use my location'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={vendorLocation}
                      onChange={(e) => setVendorLocation(e.target.value)}
                      className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none transition-all"
                      required
                      minLength={2}
                    />
                  </div>
                </div>
              )}

              <button
                disabled={loading || (isVendor && (!vendorName.trim() || !vendorWhatsapp.trim() || !vendorLocation.trim()))}
                onClick={isVendor ? handleVendorUpgrade : resetAndClose}
                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all disabled:bg-gray-400 mt-4 shadow-lg shadow-black/10"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-b-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  isVendor ? 'Finish' : 'Skip for now'
                )}
              </button>
            </div>
          ) : (
          <>
          <div className="flex gap-4 mb-8 border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setMode('login')}
              className={`pb-3 text-lg font-bold transition-all ${mode === 'login' ? 'text-black dark:text-white border-b-2 border-black dark:border-white' : 'text-gray-400'}`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`pb-3 text-lg font-bold transition-all ${mode === 'register' ? 'text-black dark:text-white border-b-2 border-black dark:border-white' : 'text-gray-400'}`}
            >
              Sign up
            </button>
          </div>

          <div className="space-y-5">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={(cred) => handleGoogleAuth(cred.credential)}
                onError={() => alert('Google sign-in failed')}
                useOneTap={false}
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              <span>or continue with email</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none pr-12 transition-all"
                  required
                  minLength={mode === 'register' ? 8 : undefined}
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
                  <label htmlFor="isVendor" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">I am a Business/Brand</label>
                </div>

                {isVendor && (
                  <div className="grid grid-cols-1 gap-4 pt-1">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Business/brand name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                        className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none transition-all"
                        required
                        minLength={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Vendor WhatsApp <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={vendorWhatsapp}
                        onChange={(e) => setVendorWhatsapp(e.target.value)}
                        placeholder="+256..."
                        className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none transition-all"
                        required
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Pickup Location <span className="text-red-500">*</span></label>
                        <button
                          type="button"
                          onClick={handleUseMyLocation}
                          disabled={locating}
                          className="flex items-center gap-1 text-xs font-semibold text-black dark:text-white hover:underline disabled:opacity-50"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          {locating ? 'Locating…' : 'Use my location'}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={vendorLocation}
                        onChange={(e) => setVendorLocation(e.target.value)}
                        placeholder="e.g. Kampala, Uganda"
                        className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-gray-500 outline-none transition-all"
                        required
                        minLength={2}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <button
              disabled={loading || !email.trim() || !password || (mode === 'register' && password.length < 8) || (mode === 'register' && isVendor && (!vendorName.trim() || !vendorWhatsapp.trim() || !vendorLocation.trim()))}
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
              By continuing, you agree to discover and support local thrift brands, and to our{' '}
              <a
                href="/thrifter-terms-and-conditions.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-700 dark:hover:text-gray-300"
              >
                Terms & Conditions
              </a>.
            </p>
          </div>
          </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AuthModal;
