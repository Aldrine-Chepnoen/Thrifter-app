import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('thrifter_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('thrifter_token');
    }
    return Promise.reject(error);
  }
);

export const fetchDemandEntries = () => api.get('/demand').then(r => r.data);
export const submitDemandEntry = (data) => api.post('/demand', data).then(r => r.data);
export const voteDemandEntry = (id, voteType) => api.post(`/demand/${id}/vote`, { vote_type: voteType }).then(r => r.data);
export const fetchPendingDemandEntries = () => api.get('/admin/demand/pending').then(r => r.data);
export const updateDemandEntryStatus = (id, status) => api.patch(`/admin/demand/${id}/status`, { status }).then(r => r.data);
export const editDemandEntry = (id, data) => api.patch(`/admin/demand/${id}`, data).then(r => r.data);
export const deleteDemandEntry = (id) => api.delete(`/admin/demand/${id}`).then(r => r.data);

export const createCheckout = (data) => api.post('/checkout', data).then(r => r.data);
export const getCheckout = (id) => api.get(`/checkout/${id}`).then(r => r.data);
export const payCheckout = (id, provider) => api.post(`/checkout/${id}/pay`, { provider }).then(r => r.data);
export const fetchMyOrders = () => api.get('/orders').then(r => r.data);
export const fetchVendorOrders = () => api.get('/vendor/orders').then(r => r.data);

export const fetchVendorSlotStatus = () => api.get('/vendor/me/subscription').then(r => r.data);

export const sendVendorPhoneVerification = () => api.post('/vendor/me/verify-sms').then(r => r.data);

export const searchVendors = (q) => api.get('/vendors/search', { params: { q } }).then(r => r.data);

export const fetchAdminOrders = () => api.get('/admin/orders').then(r => r.data);
export const updateAdminOrderStatus = (id, status) => api.patch(`/admin/orders/${id}/status`, { status }).then(r => r.data);

export const fetchVendorWallet = () => api.get('/vendor/me/wallet').then(r => r.data);
export const requestVendorWithdrawal = () => api.post('/vendor/me/wallet/withdraw').then(r => r.data);
export const fetchAdminWithdrawals = () => api.get('/admin/withdrawals').then(r => r.data);
export const approveWithdrawal = (id) => api.patch(`/admin/withdrawals/${id}/approve`).then(r => r.data);
export const rejectWithdrawal = (id) => api.patch(`/admin/withdrawals/${id}/reject`).then(r => r.data);
export const initiateVendorSubscriptionPayment = (provider) => api.post('/vendor/subscription/checkout', { provider }).then(r => r.data);

export default api;
