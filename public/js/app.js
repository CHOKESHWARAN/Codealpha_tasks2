/**
 * Main Application Orchestrator for Robust
 */

const App = {
  currentView: 'feed',

  async init() {
    this.initTheme();
    this.bindNavigation();
    this.bindSearch();
    this.bindComposeModal();
    this.bindLightbox();

    // Initialize submodules
    Feed.init();
    Profile.init();
    Notifications.init();
    await Auth.init();

    // Load sidebar widgets
    await this.loadSuggestedUsers();
    await this.loadTrending();

    // Initial view based on hash or default feed
    this.handleInitialRoute();

    window.addEventListener('hashchange', () => this.handleHashRoute());
  },

  onAuthChange(user) {
    if (this.currentView === 'feed') {
      Feed.loadFeed();
    } else if (this.currentView === 'profile') {
      Profile.loadProfile(user ? user.username : null);
    } else if (this.currentView === 'notifications') {
      Notifications.loadNotifications();
    }
    this.loadSuggestedUsers();
    Notifications.fetchUnreadCount();
  },

  /* ------------------------------------------------------------------------
     Routing & View Switching
     ------------------------------------------------------------------------ */
  handleInitialRoute() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#user-')) {
      const uname = hash.replace('#user-', '');
      this.showProfile(uname);
    } else if (hash === '#explore') {
      this.switchView('explore');
    } else if (hash === '#notifications') {
      this.switchView('notifications');
    } else if (hash === '#profile') {
      this.showProfile(Auth.currentUser?.username);
    } else {
      this.switchView('feed');
    }
  },

  handleHashRoute() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#user-')) {
      const uname = hash.replace('#user-', '');
      this.showProfile(uname);
    }
  },

  switchView(viewName) {
    this.currentView = viewName;

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));

    // Deactivate nav items
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.mob-nav-btn').forEach(btn => btn.classList.remove('active'));

    const pageTitle = document.getElementById('page-title');
    const feedTabs = document.getElementById('feed-tabs-container');

    const targetSec = document.getElementById(`view-${viewName}`);
    if (targetSec) targetSec.classList.add('active');

    // Activate corresponding nav button
    const deskBtn = document.getElementById(`nav-${viewName}`);
    if (deskBtn) deskBtn.classList.add('active');
    const mobBtn = document.getElementById(`mob-nav-${viewName}`);
    if (mobBtn) mobBtn.classList.add('active');

    // Header updates
    if (viewName === 'feed') {
      if (pageTitle) pageTitle.textContent = 'Home';
      if (feedTabs) feedTabs.style.display = 'flex';
      Feed.loadFeed();
      window.location.hash = 'feed';
    } else {
      if (feedTabs) feedTabs.style.display = 'none';

      if (viewName === 'explore') {
        if (pageTitle) pageTitle.textContent = 'Explore';
        this.loadExploreView();
        window.location.hash = 'explore';
      } else if (viewName === 'notifications') {
        if (pageTitle) pageTitle.textContent = 'Notifications';
        Notifications.loadNotifications();
        window.location.hash = 'notifications';
      } else if (viewName === 'profile') {
        if (pageTitle) pageTitle.textContent = 'Profile';
        Profile.loadProfile(Auth.currentUser?.username);
        window.location.hash = 'profile';
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  showProfile(username) {
    this.currentView = 'profile';

    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.mob-nav-btn').forEach(btn => btn.classList.remove('active'));

    const targetSec = document.getElementById('view-profile');
    if (targetSec) targetSec.classList.add('active');

    const pageTitle = document.getElementById('page-title');
    const feedTabs = document.getElementById('feed-tabs-container');
    if (feedTabs) feedTabs.style.display = 'none';
    if (pageTitle) pageTitle.textContent = 'Profile';

    const deskBtn = document.getElementById('nav-profile');
    if (deskBtn) deskBtn.classList.add('active');
    const mobBtn = document.getElementById('mob-nav-profile');
    if (mobBtn) mobBtn.classList.add('active');

    window.location.hash = `user-${username}`;
    Profile.loadProfile(username);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /* ------------------------------------------------------------------------
     Widgets & Explore
     ------------------------------------------------------------------------ */
  async loadSuggestedUsers() {
    try {
      const res = await API.users.getSuggested();
      const sidebarList = document.getElementById('suggested-users-list');
      if (!sidebarList) return;

      const users = res.users || [];
      if (users.length === 0) {
        sidebarList.innerHTML = `<p style="font-size:0.85rem; color:var(--text-dim);">No suggestions available</p>`;
        return;
      }

      sidebarList.innerHTML = users.map(u => `
        <div class="suggested-user-row">
          <div class="suggested-user-info" data-username="${Utils.escapeHTML(u.username)}">
            <img src="${Utils.escapeHTML(u.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + u.username)}" alt="" class="avatar-sm">
            <div style="display:flex; flex-direction:column; overflow:hidden;">
              <span style="font-weight:700; font-size:0.9rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${Utils.escapeHTML(u.name)}</span>
              <span style="font-size:0.8rem; color:var(--text-dim);">@${Utils.escapeHTML(u.username)}</span>
            </div>
          </div>
          <button class="btn-follow btn-sidebar-follow" data-user-id="${u.id}">Follow</button>
        </div>
      `).join('');

      sidebarList.querySelectorAll('.suggested-user-info').forEach(el => {
        el.addEventListener('click', () => {
          const uname = el.getAttribute('data-username');
          App.showProfile(uname);
        });
      });

      sidebarList.querySelectorAll('.btn-sidebar-follow').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!Auth.currentUser) {
            Auth.openAuthModal('login');
            return;
          }
          const uid = btn.getAttribute('data-user-id');
          try {
            const res = await API.users.toggleFollow(uid);
            if (res.following) {
              btn.classList.add('following');
              btn.textContent = 'Following';
            } else {
              btn.classList.remove('following');
              btn.textContent = 'Follow';
            }
          } catch (err) {
            Utils.showToast(err.message || 'Follow failed', 'error');
          }
        });
      });
    } catch (err) {
      console.warn('Could not load suggested users:', err);
    }
  },

  async loadTrending() {
    try {
      const res = await API.posts.getTrending();
      const sidebarList = document.getElementById('sidebar-trending-list');
      const exploreList = document.getElementById('explore-trending-list');
      const trending = res.trending || [];

      const html = trending.length > 0 ? trending.map(t => `
        <div class="trending-item" data-tag="${Utils.escapeHTML(t.tag)}">
          <span class="trending-tag">#${Utils.escapeHTML(t.tag)}</span>
          <span class="trending-count">${t.count} post${t.count > 1 ? 's' : ''}</span>
        </div>
      `).join('') : `<p style="font-size:0.85rem; color:var(--text-dim);">No trending tags yet</p>`;

      if (sidebarList) sidebarList.innerHTML = html;
      if (exploreList) exploreList.innerHTML = html;

      document.querySelectorAll('.trending-item').forEach(item => {
        item.addEventListener('click', () => {
          const tag = item.getAttribute('data-tag');
          Feed.filterByTag(tag);
        });
      });
    } catch (err) {
      console.warn('Could not load trending tags:', err);
    }
  },

  async loadExploreView() {
    await this.loadTrending();
    try {
      const res = await API.users.getSuggested();
      const container = document.getElementById('explore-users-list');
      if (!container) return;

      const users = res.users || [];
      container.innerHTML = users.map(u => `
        <div class="suggested-user-row">
          <div class="suggested-user-info" data-username="${Utils.escapeHTML(u.username)}">
            <img src="${Utils.escapeHTML(u.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + u.username)}" alt="" class="avatar-md">
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:700; font-size:0.95rem;">${Utils.escapeHTML(u.name)}</span>
              <span style="font-size:0.85rem; color:var(--text-dim);">@${Utils.escapeHTML(u.username)}</span>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">${Utils.escapeHTML(u.bio || '')}</p>
            </div>
          </div>
          <button class="btn-follow btn-explore-follow" data-user-id="${u.id}">Follow</button>
        </div>
      `).join('');

      container.querySelectorAll('.suggested-user-info').forEach(el => {
        el.addEventListener('click', () => {
          const uname = el.getAttribute('data-username');
          App.showProfile(uname);
        });
      });

      container.querySelectorAll('.btn-explore-follow').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!Auth.currentUser) {
            Auth.openAuthModal('login');
            return;
          }
          const uid = btn.getAttribute('data-user-id');
          try {
            const res = await API.users.toggleFollow(uid);
            if (res.following) {
              btn.classList.add('following');
              btn.textContent = 'Following';
            } else {
              btn.classList.remove('following');
              btn.textContent = 'Follow';
            }
          } catch (err) {
            Utils.showToast(err.message || 'Follow failed', 'error');
          }
        });
      });
    } catch (err) {
      console.warn('Explore load error:', err);
    }
  },

  /* ------------------------------------------------------------------------
     Search (Dropdown + Explore Page)
     ------------------------------------------------------------------------ */
  bindSearch() {
    const rightSearch = document.getElementById('right-search-input');
    const dropdown = document.getElementById('search-results-dropdown');
    let debounceTimer;

    if (rightSearch && dropdown) {
      rightSearch.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (!query) {
          dropdown.style.display = 'none';
          dropdown.innerHTML = '';
          return;
        }

        debounceTimer = setTimeout(async () => {
          try {
            const res = await API.users.search(query);
            const users = res.users || [];

            if (users.length === 0) {
              dropdown.innerHTML = `<div style="padding:10px; font-size:0.88rem; color:var(--text-dim);">No users found for "${Utils.escapeHTML(query)}"</div>`;
              dropdown.style.display = 'block';
              return;
            }

            dropdown.innerHTML = users.map(u => `
              <div class="search-user-result" data-username="${Utils.escapeHTML(u.username)}">
                <img src="${Utils.escapeHTML(u.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + u.username)}" alt="" class="avatar-xs">
                <div style="display:flex; flex-direction:column;">
                  <span style="font-weight:700; font-size:0.88rem;">${Utils.escapeHTML(u.name)}</span>
                  <span style="font-size:0.78rem; color:var(--text-dim);">@${Utils.escapeHTML(u.username)}</span>
                </div>
              </div>
            `).join('');
            dropdown.style.display = 'block';

            dropdown.querySelectorAll('.search-user-result').forEach(row => {
              row.addEventListener('click', () => {
                dropdown.style.display = 'none';
                rightSearch.value = '';
                const uname = row.getAttribute('data-username');
                App.showProfile(uname);
              });
            });
          } catch (err) {
            dropdown.style.display = 'none';
          }
        }, 300);
      });

      // Close search dropdown on click outside
      document.addEventListener('click', (e) => {
        if (!rightSearch.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    }

    // Large Explore search input
    const exploreSearch = document.getElementById('explore-search-input');
    if (exploreSearch) {
      exploreSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = exploreSearch.value.trim();
          if (q) {
            Feed.currentSearch = q;
            App.switchView('feed');
          }
        }
      });
    }
  },

  /* ------------------------------------------------------------------------
     Compose Modal
     ------------------------------------------------------------------------ */
  bindComposeModal() {
    const btnOpenCompose = document.getElementById('btn-open-compose');
    const fabCompose = document.getElementById('mobile-fab-compose');
    const modalCompose = document.getElementById('modal-compose');
    const btnCloseCompose = document.getElementById('btn-close-compose-modal');
    const btnSubmit = document.getElementById('btn-modal-submit-post');
    const fileInput = document.getElementById('modal-file-input');
    const urlInput = document.getElementById('modal-image-url-input');
    const textInput = document.getElementById('modal-composer-text');
    const previewBox = document.getElementById('modal-image-preview-box');
    const previewImg = document.getElementById('modal-image-preview-img');
    const btnRemoveImg = document.getElementById('btn-modal-remove-preview');

    let modalAttachedUrl = '';

    const openModal = () => {
      if (!Auth.currentUser) {
        Auth.openAuthModal('login');
        return;
      }
      modalAttachedUrl = '';
      if (textInput) textInput.value = '';
      if (urlInput) urlInput.value = '';
      if (previewBox) previewBox.style.display = 'none';
      if (modalCompose) modalCompose.style.display = 'flex';
      if (textInput) textInput.focus();
    };

    const closeModal = () => {
      if (modalCompose) modalCompose.style.display = 'none';
    };

    if (btnOpenCompose) btnOpenCompose.addEventListener('click', openModal);
    if (fabCompose) fabCompose.addEventListener('click', openModal);
    if (btnCloseCompose) btnCloseCompose.addEventListener('click', closeModal);
    if (modalCompose) {
      modalCompose.addEventListener('click', (e) => {
        if (e.target === modalCompose) closeModal();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          Utils.showToast('Uploading image...', 'info');
          const res = await API.upload.uploadImage(file);
          modalAttachedUrl = res.url;
          if (previewImg) previewImg.src = res.url;
          if (previewBox) previewBox.style.display = 'block';
          Utils.showToast('Image attached!', 'success');
        } catch (err) {
          Utils.showToast(err.message || 'Image upload failed', 'error');
        }
      });
    }

    if (urlInput) {
      urlInput.addEventListener('change', () => {
        const val = urlInput.value.trim();
        if (val) {
          modalAttachedUrl = val;
          if (previewImg) previewImg.src = val;
          if (previewBox) previewBox.style.display = 'block';
        }
      });
    }

    if (btnRemoveImg) {
      btnRemoveImg.addEventListener('click', () => {
        modalAttachedUrl = '';
        if (previewBox) previewBox.style.display = 'none';
        if (urlInput) urlInput.value = '';
      });
    }

    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        const text = textInput ? textInput.value.trim() : '';
        if (!text) {
          Utils.showToast('Post cannot be empty', 'warning');
          return;
        }

        const img = modalAttachedUrl || (urlInput ? urlInput.value.trim() : '');
        try {
          await API.posts.createPost({ content: text, imageUrl: img });
          Utils.showToast('Post created!', 'success');
          closeModal();
          App.switchView('feed');
          App.loadTrending();
        } catch (err) {
          Utils.showToast(err.message || 'Failed to create post', 'error');
        }
      });
    }
  },

  /* ------------------------------------------------------------------------
     Lightbox
     ------------------------------------------------------------------------ */
  bindLightbox() {
    const modal = document.getElementById('modal-lightbox');
    const closeBtn = document.getElementById('btn-close-lightbox');
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
  },

  openLightbox(imageUrl) {
    const modal = document.getElementById('modal-lightbox');
    const img = document.getElementById('lightbox-img');
    if (modal && img) {
      img.src = imageUrl;
      modal.style.display = 'flex';
    }
  },

  /* ------------------------------------------------------------------------
     Theme Management (Dark / Light)
     ------------------------------------------------------------------------ */
  initTheme() {
    const savedTheme = localStorage.getItem('robust_theme') || localStorage.getItem('pulse_theme') || 'dark';
    this.setTheme(savedTheme);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
      });
    }
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('robust_theme', theme);

    const iconDark = document.getElementById('theme-icon-dark');
    const iconLight = document.getElementById('theme-icon-light');
    const label = document.getElementById('theme-label');

    if (theme === 'dark') {
      if (iconDark) iconDark.style.display = 'block';
      if (iconLight) iconLight.style.display = 'none';
      if (label) label.textContent = 'Dark';
    } else {
      if (iconDark) iconDark.style.display = 'none';
      if (iconLight) iconLight.style.display = 'block';
      if (label) label.textContent = 'Light';
    }
  },

  /* ------------------------------------------------------------------------
     Navigation Bindings
     ------------------------------------------------------------------------ */
  bindNavigation() {
    // Brand logo returns to feed
    const brand = document.getElementById('brand-logo');
    if (brand) {
      brand.addEventListener('click', () => {
        Feed.clearFilter();
        this.switchView('feed');
      });
    }

    // Sidebar left nav items
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Mobile bottom nav buttons
    document.querySelectorAll('.mob-nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // User profile card click in left sidebar
    const profileCard = document.getElementById('btn-profile-card');
    if (profileCard) {
      profileCard.addEventListener('click', () => {
        if (Auth.currentUser) {
          this.showProfile(Auth.currentUser.username);
        } else {
          Auth.openAuthModal('login');
        }
      });
    }
  }
};

// Boot the application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
