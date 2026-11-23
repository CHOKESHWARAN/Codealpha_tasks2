/**
 * Profile Management & User Relationships for Robust
 */

const Profile = {
  activeProfileUsername: null,
  activeProfileData: null,
  activeTab: 'posts', // 'posts' or 'likes'

  init() {
    this.bindEvents();
  },

  async loadProfile(username) {
    if (!username) {
      if (Auth.currentUser) {
        username = Auth.currentUser.username;
      } else {
        username = 'sarah_tech';
      }
    }

    this.activeProfileUsername = username;
    const container = document.getElementById('profile-posts-container');
    if (container) {
      container.innerHTML = `
        <div class="loading-spinner-wrapper">
          <div class="spinner"></div>
          <p>Loading profile...</p>
        </div>
      `;
    }

    try {
      const res = await API.users.getProfile(username);
      this.activeProfileData = res.profile;
      this.renderProfileHeader(this.activeProfileData);
      await this.loadProfilePosts();
    } catch (err) {
      console.error('Failed to load profile:', err);
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <h3>User not found</h3>
            <p>The profile @${Utils.escapeHTML(username)} could not be located.</p>
          </div>
        `;
      }
    }
  },

  renderProfileHeader(profile) {
    const bannerImg = document.getElementById('profile-banner-img');
    const avatarImg = document.getElementById('profile-avatar-img');
    const nameEl = document.getElementById('profile-name');
    const handleEl = document.getElementById('profile-handle');
    const bioEl = document.getElementById('profile-bio');
    const locationEl = document.getElementById('profile-location');
    const websiteEl = document.getElementById('profile-website');
    const joinedEl = document.getElementById('profile-joined');
    const statFollowing = document.getElementById('stat-following-count');
    const statFollowers = document.getElementById('stat-followers-count');
    const statPosts = document.getElementById('stat-posts-count');
    const statLikes = document.getElementById('stat-likes-count');
    const actionContainer = document.getElementById('profile-action-buttons');

    if (bannerImg) {
      bannerImg.src = profile.banner || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&h=400&fit=crop';
    }

    if (avatarImg) {
      avatarImg.src = profile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.username}`;
    }

    if (nameEl) nameEl.textContent = profile.name;
    if (handleEl) handleEl.textContent = `@${profile.username}`;
    if (bioEl) bioEl.textContent = profile.bio || 'No bio yet.';

    // Location
    const locItem = document.getElementById('meta-location-item');
    if (locItem && locationEl) {
      if (profile.location) {
        locItem.style.display = 'flex';
        locationEl.textContent = profile.location;
      } else {
        locItem.style.display = 'none';
      }
    }

    // Website
    const webItem = document.getElementById('meta-website-item');
    if (webItem && websiteEl) {
      if (profile.website) {
        webItem.style.display = 'flex';
        websiteEl.href = profile.website.startsWith('http') ? profile.website : `https://${profile.website}`;
        websiteEl.textContent = profile.website.replace(/^https?:\/\//, '');
      } else {
        webItem.style.display = 'none';
      }
    }

    // Joined date
    if (joinedEl) {
      const d = new Date(profile.created_at);
      joinedEl.textContent = `Joined ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }

    // Stats
    if (statFollowing) statFollowing.textContent = profile.followingCount || 0;
    if (statFollowers) statFollowers.textContent = profile.followersCount || 0;
    if (statPosts) statPosts.textContent = profile.postsCount || 0;
    if (statLikes) statLikes.textContent = profile.likesCount || 0;

    // Actions button: Edit Profile vs Follow/Unfollow
    if (actionContainer) {
      if (profile.isSelf) {
        actionContainer.innerHTML = `
          <button class="btn btn-secondary" id="btn-trigger-edit-profile">Edit Profile</button>
        `;
        document.getElementById('btn-trigger-edit-profile')?.addEventListener('click', () => {
          this.openEditProfileModal();
        });
      } else {
        const isFollowing = profile.isFollowing;
        actionContainer.innerHTML = `
          <button class="btn-follow ${isFollowing ? 'following' : ''}" id="btn-profile-follow" data-user-id="${profile.id}">
            ${isFollowing ? 'Following' : 'Follow'}
          </button>
        `;
        document.getElementById('btn-profile-follow')?.addEventListener('click', async (e) => {
          if (!Auth.currentUser) {
            Auth.openAuthModal('login');
            return;
          }
          const btn = e.currentTarget;
          try {
            const res = await API.users.toggleFollow(profile.id);
            if (res.following) {
              btn.classList.add('following');
              btn.textContent = 'Following';
            } else {
              btn.classList.remove('following');
              btn.textContent = 'Follow';
            }
            if (statFollowers) statFollowers.textContent = res.followersCount;
            // Also refresh suggested list
            if (window.App) window.App.loadSuggestedUsers();
          } catch (err) {
            Utils.showToast(err.message || 'Follow action failed', 'error');
          }
        });
      }
    }
  },

  async loadProfilePosts() {
    const container = document.getElementById('profile-posts-container');
    if (!container || !this.activeProfileUsername) return;

    container.innerHTML = `
      <div class="loading-spinner-wrapper">
        <div class="spinner"></div>
        <p>Loading posts...</p>
      </div>
    `;

    try {
      let posts = [];
      if (this.activeTab === 'posts') {
        const res = await API.posts.getPosts({ username: this.activeProfileUsername });
        posts = res.posts || [];
      } else {
        const res = await API.posts.getLikedPosts(this.activeProfileUsername);
        posts = res.posts || [];
      }

      if (posts.length === 0) {
        const tabName = this.activeTab === 'posts' ? 'posts' : 'liked posts';
        container.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <h3>No ${tabName} yet</h3>
            <p>@${Utils.escapeHTML(this.activeProfileUsername)} hasn't shared or liked any posts yet.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = posts.map(p => Feed.createPostCardHTML(p)).join('');
      Feed.attachPostListeners(container);
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Failed to load</h3>
          <p>${Utils.escapeHTML(err.message || 'Error fetching user posts.')}</p>
        </div>
      `;
    }
  },

  openEditProfileModal() {
    if (!Auth.currentUser) return;
    const modal = document.getElementById('modal-edit-profile');
    if (!modal) return;

    const u = Auth.currentUser;
    document.getElementById('edit-name').value = u.name || '';
    document.getElementById('edit-bio').value = u.bio || '';
    document.getElementById('edit-location').value = u.location || '';
    document.getElementById('edit-website').value = u.website || '';
    document.getElementById('edit-avatar').value = u.avatar || '';
    document.getElementById('edit-banner').value = u.banner || '';

    modal.style.display = 'flex';
  },

  closeEditProfileModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.style.display = 'none';
  },

  async saveEditProfile(formData) {
    try {
      const res = await API.users.updateProfile(formData);
      Auth.currentUser = res.user;
      Auth.updateUserUI();
      Utils.showToast('Profile updated!', 'success');
      this.closeEditProfileModal();
      await this.loadProfile(res.user.username);
    } catch (err) {
      Utils.showToast(err.message || 'Failed to update profile', 'error');
    }
  },

  async openUsersModal(type = 'followers') {
    const username = this.activeProfileUsername || Auth.currentUser?.username;
    if (!username) return;

    const modal = document.getElementById('modal-users-list');
    const title = document.getElementById('users-modal-title');
    const tabFollowers = document.getElementById('modal-tab-followers');
    const tabFollowing = document.getElementById('modal-tab-following');
    const body = document.getElementById('users-modal-body');

    if (!modal || !body) return;

    modal.style.display = 'flex';
    title.textContent = type === 'followers' ? 'Followers' : 'Following';

    if (type === 'followers') {
      tabFollowers.classList.add('active');
      tabFollowing.classList.remove('active');
    } else {
      tabFollowers.classList.remove('active');
      tabFollowing.classList.add('active');
    }

    body.innerHTML = `
      <div class="loading-spinner-wrapper">
        <div class="spinner"></div>
      </div>
    `;

    try {
      let users = [];
      if (type === 'followers') {
        const res = await API.users.getFollowers(username);
        users = res.followers || [];
      } else {
        const res = await API.users.getFollowing(username);
        users = res.following || [];
      }

      if (users.length === 0) {
        body.innerHTML = `
          <div class="empty-state" style="padding: 24px;">
            <p>No ${type} found.</p>
          </div>
        `;
        return;
      }

      body.innerHTML = users.map(u => `
        <div class="suggested-user-row">
          <div class="suggested-user-info btn-nav-profile-modal" data-username="${Utils.escapeHTML(u.username)}">
            <img src="${Utils.escapeHTML(u.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + u.username)}" alt="" class="avatar-sm">
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 700; font-size: 0.92rem;">${Utils.escapeHTML(u.name)}</span>
              <span style="font-size: 0.8rem; color: var(--text-dim);">@${Utils.escapeHTML(u.username)}</span>
            </div>
          </div>
          ${!u.isSelf ? `
            <button class="btn-follow btn-modal-follow ${u.isFollowing ? 'following' : ''}" data-user-id="${u.id}">
              ${u.isFollowing ? 'Following' : 'Follow'}
            </button>
          ` : ''}
        </div>
      `).join('');

      // Nav to profile from modal
      body.querySelectorAll('.btn-nav-profile-modal').forEach(el => {
        el.addEventListener('click', () => {
          modal.style.display = 'none';
          const uname = el.getAttribute('data-username');
          if (window.App) window.App.showProfile(uname);
        });
      });

      // Follow toggle inside modal
      body.querySelectorAll('.btn-modal-follow').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!Auth.currentUser) {
            modal.style.display = 'none';
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
            Utils.showToast(err.message || 'Action failed', 'error');
          }
        });
      });
    } catch (err) {
      body.innerHTML = `<div class="empty-state"><p>Error loading ${type}.</p></div>`;
    }
  },

  bindEvents() {
    // Profile sub-tabs: Posts vs Likes
    const ptabPosts = document.getElementById('ptab-posts');
    const ptabLikes = document.getElementById('ptab-likes');

    if (ptabPosts) {
      ptabPosts.addEventListener('click', () => {
        this.activeTab = 'posts';
        ptabPosts.classList.add('active');
        ptabLikes?.classList.remove('active');
        this.loadProfilePosts();
      });
    }

    if (ptabLikes) {
      ptabLikes.addEventListener('click', () => {
        this.activeTab = 'likes';
        ptabLikes.classList.add('active');
        ptabPosts?.classList.remove('active');
        this.loadProfilePosts();
      });
    }

    // Followers & Following stats modal triggers
    const btnShowFollowers = document.getElementById('btn-show-followers');
    if (btnShowFollowers) {
      btnShowFollowers.addEventListener('click', () => this.openUsersModal('followers'));
    }

    const btnShowFollowing = document.getElementById('btn-show-following');
    if (btnShowFollowing) {
      btnShowFollowing.addEventListener('click', () => this.openUsersModal('following'));
    }

    // Modal tabs inside Users list modal
    const tabFollowers = document.getElementById('modal-tab-followers');
    const tabFollowing = document.getElementById('modal-tab-following');
    if (tabFollowers) {
      tabFollowers.addEventListener('click', () => this.openUsersModal('followers'));
    }
    if (tabFollowing) {
      tabFollowing.addEventListener('click', () => this.openUsersModal('following'));
    }

    // Close users modal
    const btnCloseUsersModal = document.getElementById('btn-close-users-modal');
    const modalUsers = document.getElementById('modal-users-list');
    if (btnCloseUsersModal) {
      btnCloseUsersModal.addEventListener('click', () => {
        if (modalUsers) modalUsers.style.display = 'none';
      });
    }
    if (modalUsers) {
      modalUsers.addEventListener('click', (e) => {
        if (e.target === modalUsers) modalUsers.style.display = 'none';
      });
    }

    // Edit profile modal close & cancel
    const btnCloseEdit = document.getElementById('btn-close-edit-profile');
    const btnCancelEdit = document.getElementById('btn-cancel-edit-profile');
    const modalEdit = document.getElementById('modal-edit-profile');

    if (btnCloseEdit) btnCloseEdit.addEventListener('click', () => this.closeEditProfileModal());
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => this.closeEditProfileModal());
    if (modalEdit) {
      modalEdit.addEventListener('click', (e) => {
        if (e.target === modalEdit) this.closeEditProfileModal();
      });
    }

    // Edit profile form submit
    const formEdit = document.getElementById('form-edit-profile');
    if (formEdit) {
      formEdit.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          name: document.getElementById('edit-name').value.trim(),
          bio: document.getElementById('edit-bio').value.trim(),
          location: document.getElementById('edit-location').value.trim(),
          website: document.getElementById('edit-website').value.trim(),
          avatar: document.getElementById('edit-avatar').value.trim(),
          banner: document.getElementById('edit-banner').value.trim()
        };
        this.saveEditProfile(data);
      });
    }

    // Upload local avatar & banner in edit profile
    const uploadAvatarFile = document.getElementById('upload-avatar-file');
    if (uploadAvatarFile) {
      uploadAvatarFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          Utils.showToast('Uploading avatar...', 'info');
          const res = await API.upload.uploadImage(file);
          document.getElementById('edit-avatar').value = res.url;
          Utils.showToast('Avatar uploaded!', 'success');
        } catch (err) {
          Utils.showToast(err.message || 'Avatar upload failed', 'error');
        }
      });
    }

    const uploadBannerFile = document.getElementById('upload-banner-file');
    if (uploadBannerFile) {
      uploadBannerFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          Utils.showToast('Uploading banner...', 'info');
          const res = await API.upload.uploadImage(file);
          document.getElementById('edit-banner').value = res.url;
          Utils.showToast('Banner uploaded!', 'success');
        } catch (err) {
          Utils.showToast(err.message || 'Banner upload failed', 'error');
        }
      });
    }
  }
};
