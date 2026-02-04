import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const Auth = ({ onAuthed }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const msg = e?.response?.data?.detail || e?.message || 'Registration failed';
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
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
          />
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
              <label htmlFor="isVendor" className="text-sm">I am a vendor</label>
            </div>
            {isVendor && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Vendor name</label>
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
