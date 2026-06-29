import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '/api'),
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

export default api;
