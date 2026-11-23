/**
 * API Client & Utility Functions for Robust
 */

const API_BASE = '/api';
const TOKEN_KEY = 'robust_auth_token';

const API = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('pulse_auth_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('pulse_auth_token');
    }
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('pulse_auth_token');
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = this.getToken();

    const headers = {
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers
    };

    try {
      const res = await fetch(url, config);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  auth: {
    register: (data) => API.request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => API.request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    demoLogin: (username) => API.request('/auth/demo', { method: 'POST', body: JSON.stringify({ username }) }),
    getMe: () => API.request('/auth/me'),
    getDemoUsers: () => API.request('/auth/demo-users')
  },

  // Users Endpoints
  users: {
    getProfile: (username) => API.request(`/users/profile/${encodeURIComponent(username)}`),
    updateProfile: (data) => API.request('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
    toggleFollow: (userId) => API.request(`/users/${userId}/follow`, { method: 'POST' }),
    getFollowers: (username) => API.request(`/users/${encodeURIComponent(username)}/followers`),
    getFollowing: (username) => API.request(`/users/${encodeURIComponent(username)}/following`),
    getSuggested: () => API.request('/users/suggested'),
    search: (q) => API.request(`/users/search?q=${encodeURIComponent(q)}`)
  },

  // Posts Endpoints
  posts: {
    getPosts: (params = {}) => {
      const searchParams = new URLSearchParams(params);
      return API.request(`/posts?${searchParams.toString()}`);
    },
    getLikedPosts: (username) => API.request(`/posts/user/${encodeURIComponent(username)}/likes`),
    getPost: (id) => API.request(`/posts/${id}`),
    createPost: (data) => API.request('/posts', { method: 'POST', body: JSON.stringify(data) }),
    deletePost: (id) => API.request(`/posts/${id}`, { method: 'DELETE' }),
    toggleLike: (id) => API.request(`/posts/${id}/like`, { method: 'POST' }),
    getTrending: () => API.request('/posts/meta/trending')
  },

  // Comments Endpoints
  comments: {
    getComments: (postId) => API.request(`/comments/post/${postId}`),
    addComment: (postId, content) => API.request(`/comments/post/${postId}`, {
      method: 'POST',
      body: JSON.stringify({ content })
    }),
    deleteComment: (id) => API.request(`/comments/${id}`, { method: 'DELETE' })
  },

  // Notifications Endpoints
  notifications: {
    get: () => API.request('/notifications'),
    markAllRead: () => API.request('/notifications/read', { method: 'PUT' })
  },

  // Upload Endpoint
  upload: {
    uploadImage: async (file) => {
      const formData = new FormData();
      formData.append('image', file);
      return API.request('/upload', {
        method: 'POST',
        body: formData
      });
    }
  }
};

// Utilities
const Utils = {
  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  formatTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  formatPostContent(text) {
    if (!text) return '';
    let escaped = this.escapeHTML(text);

    // Format hashtags: #tag
    escaped = escaped.replace(/#([a-zA-Z0-9_]+)/g, '<span class="hashtag" data-tag="$1">#$1</span>');

    // Format URLs: http/https
    escaped = escaped.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return escaped;
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${this.escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};
