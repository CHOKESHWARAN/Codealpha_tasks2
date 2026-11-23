/**
 * Authentication & Session Management for Robust
 */

const Auth = {
  currentUser: null,

  async init() {
    this.bindEvents();
    await this.loadDemoUsersWidget();

    const token = API.getToken();
    if (token) {
      try {
        const res = await API.auth.getMe();
        this.setCurrentUser(res.user);
        return;
      } catch (err) {
        console.warn('Session expired or invalid. Falling back to default demo user.', err);
        API.clearToken();
      }
    }

    // Auto-login with default demo user on first arrival so the user doesn't face an empty blank state
    await this.demoLogin('sarah_tech', false);
  },

  setCurrentUser(user) {
    this.currentUser = user;
    this.updateUserUI();

    // Trigger feeds / notification refresh
    if (window.App && typeof window.App.onAuthChange === 'function') {
      window.App.onAuthChange(user);
    }
  },

  updateUserUI() {
    const user = this.currentUser;

    const sidebarAvatar = document.getElementById('sidebar-user-avatar');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarHandle = document.getElementById('sidebar-user-handle');
    const composerAvatar = document.getElementById('composer-user-avatar');
    const mobileAvatar = document.getElementById('mobile-user-avatar');

    if (user) {
      const avatarUrl = user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`;
      if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
      if (composerAvatar) composerAvatar.src = avatarUrl;
      if (mobileAvatar) mobileAvatar.src = avatarUrl;

      if (sidebarName) sidebarName.textContent = user.name;
      if (sidebarHandle) sidebarHandle.textContent = `@${user.username}`;
    } else {
      const defaultAvatar = 'https://api.dicebear.com/7.x/identicon/svg?seed=guest';
      if (sidebarAvatar) sidebarAvatar.src = defaultAvatar;
      if (composerAvatar) composerAvatar.src = defaultAvatar;
      if (mobileAvatar) mobileAvatar.src = defaultAvatar;

      if (sidebarName) sidebarName.textContent = 'Guest';
      if (sidebarHandle) sidebarHandle.textContent = 'Log in / Sign up';
    }

    // Highlight current user in demo switcher
    document.querySelectorAll('.demo-user-pill').forEach(pill => {
      const uname = pill.getAttribute('data-demo-username');
      if (user && uname === user.username) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  },

  async login(login, password) {
    try {
      const res = await API.auth.login({ login, password });
      API.setToken(res.token);
      this.setCurrentUser(res.user);
      Utils.showToast(`Welcome back, ${res.user.name}!`, 'success');
      this.closeAuthModal();
      return true;
    } catch (err) {
      Utils.showToast(err.message || 'Login failed', 'error');
      return false;
    }
  },

  async register(name, username, email, password) {
    try {
      const res = await API.auth.register({ name, username, email, password });
      API.setToken(res.token);
      this.setCurrentUser(res.user);
      Utils.showToast(`Welcome to Robust, ${res.user.name}!`, 'success');
      this.closeAuthModal();
      return true;
    } catch (err) {
      Utils.showToast(err.message || 'Registration failed', 'error');
      return false;
    }
  },

  async demoLogin(username = 'sarah_tech', showToast = true) {
    try {
      const res = await API.auth.demoLogin(username);
      API.setToken(res.token);
      this.setCurrentUser(res.user);
      if (showToast) {
        Utils.showToast(`Switched account to @${res.user.username} (${res.user.name})`, 'info');
      }
      this.closeAuthModal();
      return true;
    } catch (err) {
      console.error('Demo login error:', err);
      if (showToast) Utils.showToast('Failed to switch to demo account', 'error');
      return false;
    }
  },

  logout() {
    API.clearToken();
    this.currentUser = null;
    this.updateUserUI();
    Utils.showToast('You have been logged out.', 'info');
    this.openAuthModal();
    if (window.App && typeof window.App.onAuthChange === 'function') {
      window.App.onAuthChange(null);
    }
  },

  async loadDemoUsersWidget() {
    try {
      const res = await API.auth.getDemoUsers();
      const container = document.getElementById('quick-demo-users-list');
      if (!container || !res.users) return;

      container.innerHTML = res.users.map(u => `
        <div class="demo-user-pill" data-demo-username="${Utils.escapeHTML(u.username)}">
          <img src="${Utils.escapeHTML(u.avatar || '')}" alt="${Utils.escapeHTML(u.name)}" class="avatar-xs">
          <div class="demo-user-pill-info">
            <span class="demo-user-pill-name">${Utils.escapeHTML(u.name)}</span>
            <span class="demo-user-pill-handle">@${Utils.escapeHTML(u.username)}</span>
          </div>
          <button class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:3px 8px;">Switch</button>
        </div>
      `).join('');

      container.querySelectorAll('.demo-user-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const uname = pill.getAttribute('data-demo-username');
          this.demoLogin(uname, true);
        });
      });
    } catch (err) {
      console.warn('Could not load demo accounts list widget:', err);
    }
  },

  openAuthModal(defaultTab = 'login') {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;
    modal.style.display = 'flex';
    this.switchAuthTab(defaultTab);
  },

  closeAuthModal() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.style.display = 'none';
  },

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'flex';
      formRegister.style.display = 'none';
    } else {
      tabLogin.classList.remove('active');
      tabRegister.classList.add('active');
      formLogin.style.display = 'none';
      formRegister.style.display = 'flex';
    }
  },

  bindEvents() {
    // Open auth modal / user card clicks
    const btnAuthAction = document.getElementById('btn-auth-action');
    if (btnAuthAction) {
      btnAuthAction.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentUser) {
          // If already logged in, offer to switch user or logout
          this.openAuthModal('login');
        } else {
          this.openAuthModal('login');
        }
      });
    }

    const mobileUserBtn = document.getElementById('mobile-user-btn');
    if (mobileUserBtn) {
      mobileUserBtn.addEventListener('click', () => this.openAuthModal('login'));
    }

    // Modal close & overlay
    const btnCloseAuthModal = document.getElementById('btn-close-auth-modal');
    if (btnCloseAuthModal) {
      btnCloseAuthModal.addEventListener('click', () => this.closeAuthModal());
    }

    const modalAuth = document.getElementById('modal-auth');
    if (modalAuth) {
      modalAuth.addEventListener('click', (e) => {
        if (e.target === modalAuth) this.closeAuthModal();
      });
    }

    // Modal tabs
    const tabLogin = document.getElementById('tab-auth-login');
    if (tabLogin) tabLogin.addEventListener('click', () => this.switchAuthTab('login'));

    const tabRegister = document.getElementById('tab-auth-register');
    if (tabRegister) tabRegister.addEventListener('click', () => this.switchAuthTab('register'));

    // Forms
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ident = document.getElementById('login-identifier').value.trim();
        const pass = document.getElementById('login-password').value;
        if (!ident || !pass) return;
        await this.login(ident, pass);
      });
    }

    const formRegister = document.getElementById('form-register');
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value.trim();
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;

        if (!name || !username || !email || !password) return;
        await this.register(name, username, email, password);
      });
    }

    // Quick demo buttons inside modal
    document.querySelectorAll('.btn-demo-quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const uname = btn.getAttribute('data-demo-user');
        this.demoLogin(uname, true);
      });
    });
  }
};
