// This is the Auth component for the Thrifter frontend application. It provides a user interface for logging in and registering new accounts. The component uses React hooks to manage state and handles form submissions to authenticate users with the backend API. Depending on the mode (login or register), it displays different form fields and buttons, and it also includes error handling to display appropriate messages if authentication fails.
import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

const Auth = ({ onAuthed }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorWhatsapp, setVendorWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);

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
      navigate('/');
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
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-3xl font-serif font-bold mb-6">{mode === 'login' ? 'Login' : 'Create Account'}</h2>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('login')}
          className={`px-4 py-2 rounded-full border ${mode === 'login' ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-200'}`}
        >
          Login
        </button>
        <button
          onClick={() => setMode('register')}
          className={`px-4 py-2 rounded-full border ${mode === 'register' ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-200'}`}
        >
          Sign up
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mode === 'register' && (
          <>
            <div className="flex items-center gap-2">
              <input
                id="isVendor"
                type="checkbox"
                checked={isVendor}
                onChange={(e) => setIsVendor(e.target.checked)}
              />
              <label htmlFor="isVendor" className="text-sm">I am a Business/Brand</label>
            </div>
            {isVendor && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Business/brand name</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vendor WhatsApp</label>
                  <input
                    type="text"
                    value={vendorWhatsapp}
                    onChange={(e) => setVendorWhatsapp(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                  />
                </div>
              </div>
            )}
          </>
        )}
        <button
          disabled={loading}
          onClick={mode === 'login' ? handleLogin : handleRegister}
          className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign up'}
        </button>
      </div>
    </div>
  );
};

export default Auth;
