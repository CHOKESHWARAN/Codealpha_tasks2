/**
 * Notifications Management for Robust
 */

const Notifications = {
  notifications: [],

  init() {
    this.bindEvents();
    this.fetchUnreadCount();
  },

  async loadNotifications() {
    if (!Auth.currentUser) {
      Auth.openAuthModal('login');
      return;
    }

    const container = document.getElementById('notifications-list');
    if (!container) return;

    container.innerHTML = `
      <div class="loading-spinner-wrapper">
        <div class="spinner"></div>
        <p>Loading activity...</p>
      </div>
    `;

    try {
      const res = await API.notifications.get();
      this.notifications = res.notifications || [];
      this.renderNotifications(container, this.notifications);
      this.updateBadges(0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      container.innerHTML = `
        <div class="empty-state">
          <h3>Activity unavailable</h3>
          <p>${Utils.escapeHTML(err.message || 'Error fetching activity.')}</p>
        </div>
      `;
    }
  },

  renderNotifications(container, items) {
    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          </svg>
          <h3>All caught up!</h3>
          <p>No new notifications at the moment.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(n => {
      let iconClass = 'notif-icon-like';
      let iconSvg = '';
      let actionText = '';

      if (n.type === 'like') {
        iconClass = 'notif-icon-like';
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
        actionText = 'liked your post';
      } else if (n.type === 'comment') {
        iconClass = 'notif-icon-comment';
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
        actionText = 'commented on your post';
      } else if (n.type === 'follow') {
        iconClass = 'notif-icon-follow';
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`;
        actionText = 'started following you';
      }

      const unreadClass = !n.isRead ? 'unread' : '';

      return `
        <div class="notification-item ${unreadClass}" data-actor-username="${Utils.escapeHTML(n.actor.username)}">
          <div class="notif-icon-col ${iconClass}">
            ${iconSvg}
          </div>
          <img src="${Utils.escapeHTML(n.actor.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + n.actor.username)}" alt="" class="avatar-sm">
          <div class="notif-content-col">
            <div class="notif-text">
              <span class="notif-actor">${Utils.escapeHTML(n.actor.name)}</span>
              ${actionText}
            </div>
            ${n.postSnippet ? `<div class="notif-snippet">"${Utils.escapeHTML(n.postSnippet)}"</div>` : ''}
            <div class="notif-time">${Utils.formatTimeAgo(n.createdAt)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Clicking notification visits actor's profile
    container.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const username = item.getAttribute('data-actor-username');
        if (username && window.App) {
          window.App.showProfile(username);
        }
      });
    });
  },

  async fetchUnreadCount() {
    if (!Auth.currentUser) return;
    try {
      const res = await API.auth.getMe();
      const count = res.user?.unreadNotificationsCount || 0;
      this.updateBadges(count);
    } catch (err) {
      // Ignore
    }
  },

  updateBadges(count) {
    const navBadge = document.getElementById('nav-notif-badge');
    const mobBadge = document.getElementById('mob-notif-badge');

    if (count > 0) {
      if (navBadge) {
        navBadge.textContent = count;
        navBadge.style.display = 'flex';
      }
      if (mobBadge) {
        mobBadge.textContent = count;
        mobBadge.style.display = 'flex';
      }
    } else {
      if (navBadge) navBadge.style.display = 'none';
      if (mobBadge) mobBadge.style.display = 'none';
    }
  },

  async markAllAsRead() {
    try {
      await API.notifications.markAllRead();
      this.updateBadges(0);
      document.querySelectorAll('.notification-item.unread').forEach(el => {
        el.classList.remove('unread');
      });
      Utils.showToast('All notifications marked as read', 'info');
    } catch (err) {
      Utils.showToast(err.message || 'Failed to mark read', 'error');
    }
  },

  bindEvents() {
    const btnMarkAll = document.getElementById('btn-mark-all-read');
    if (btnMarkAll) {
      btnMarkAll.addEventListener('click', () => this.markAllAsRead());
    }
  }
};
