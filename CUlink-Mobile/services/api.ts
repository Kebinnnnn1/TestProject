import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants';

// ── Axios instance ─────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT access token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh JWT on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = await AsyncStorage.getItem('refresh_token');
        if (!refresh) throw new Error('No refresh token');
        const resp = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
        const newAccess = resp.data.access;
        await AsyncStorage.setItem('access_token', newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        // Refresh failed — clear tokens so the app redirects to login
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        await AsyncStorage.removeItem('user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Typed API helpers ──────────────────────────────────────────────────────

// AUTH
export const authAPI = {
  register: (data: { username: string; email: string; password: string; password2: string }) =>
    api.post('/auth/register/', data),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login/', data),
  refreshToken: (refresh: string) =>
    api.post('/auth/refresh/', { refresh }),
  verifyEmail: (token: string) =>
    api.post('/auth/verify-email/', { token }),
  resendVerification: (email: string) =>
    api.post('/auth/resend-verification/', { email }),
};

// PROFILE
export const profileAPI = {
  getProfile: () => api.get('/profile/'),
  updateProfile: (data: FormData) =>
    api.patch('/profile/update/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  changePassword: (data: { old_password: string; new_password: string; confirm_password: string }) =>
    api.post('/profile/change-password/', data),
  getPublicProfile: (username: string) => api.get(`/users/${username}/`),
  searchUsers: (q: string) => api.get(`/users/search/?q=${encodeURIComponent(q)}`),
};

// WALL
export const wallAPI = {
  getPosts: (params?: { offset?: number; tag?: string; university?: string }) =>
    api.get('/wall/', { params }),
  createPost: (data: FormData) =>
    api.post('/wall/create/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  likePost: (pk: number) => api.post(`/wall/${pk}/like/`),
  addComment: (pk: number, content: string) =>
    api.post(`/wall/${pk}/comment/`, { content }),
  deletePost: (pk: number) => api.delete(`/wall/${pk}/delete/`),
  deleteComment: (pk: number) => api.delete(`/wall/comment/${pk}/delete/`),
};

// CHAT
export const chatAPI = {
  getInbox: () => api.get('/chat/inbox/'),
  getMessages: (username: string) => api.get(`/chat/${username}/messages/`),
  sendMessage: (username: string, content: string) =>
    api.post(`/chat/${username}/send/`, { content }),
  getUsers: () => api.get('/users/'),
};

// WORKSPACE
export const workspaceAPI = {
  getDocs: () => api.get('/workspace/'),
  createDoc: (data: { type: string; title: string; color: string }) =>
    api.post('/workspace/doc/create/', data),
  getDoc: (pk: number) => api.get(`/workspace/doc/${pk}/`),
  updateDoc: (pk: number, data: Partial<{ title: string; color: string }>) =>
    api.patch(`/workspace/doc/${pk}/update/`, data),
  deleteDoc: (pk: number) => api.delete(`/workspace/doc/${pk}/delete/`),
  createItem: (docPk: number, data: Record<string, unknown>) =>
    api.post(`/workspace/doc/${docPk}/item/`, data),
  updateItem: (pk: number, data: Record<string, unknown>) =>
    api.patch(`/workspace/item/${pk}/update/`, data),
  deleteItem: (pk: number) => api.delete(`/workspace/item/${pk}/delete/`),
};
