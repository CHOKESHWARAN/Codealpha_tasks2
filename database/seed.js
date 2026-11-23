const bcrypt = require('bcryptjs');
const { query, initSchema } = require('./db');

async function seed() {
  await initSchema();

  const userCount = await query.get('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count > 0) {
    console.log('Database already has users. Skipping seed.');
    return;
  }

  console.log('Seeding initial data...');
  const defaultPassword = await bcrypt.hash('password123', 10);

  // 1. Create Users
  const users = [
    {
      username: 'sarah_tech',
      name: 'Sarah Chen',
      email: 'sarah@example.com',
      bio: 'Full-stack engineer & AI enthusiast. Building modern web apps. Coffee fanatic ☕ | Open source contributor 🚀',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
      banner: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&h=400&fit=crop',
      location: 'San Francisco, CA',
      website: 'https://sarahchen.dev'
    },
    {
      username: 'alex_designer',
      name: 'Alex Rivera',
      email: 'alex@example.com',
      bio: 'Product Designer @ StudioLab. Exploring typography, minimalist UI, and digital art. Sharing daily design thoughts 🎨',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
      banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=400&fit=crop',
      location: 'Brooklyn, NY',
      website: 'https://alexrivera.design'
    },
    {
      username: 'elena_nature',
      name: 'Elena Rostova',
      email: 'elena@example.com',
      bio: 'Landscape & wildlife photographer 🌲 Capturing Earth one frame at a time. National Geographic contributor.',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
      banner: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&h=400&fit=crop',
      location: 'Vancouver, BC',
      website: 'https://elenarostova.photos'
    },
    {
      username: 'marcus_code',
      name: 'Marcus Brody',
      email: 'marcus@example.com',
      bio: 'Backend architect, distributed systems geek, Go & Node.js lover. Always optimizing queries & caching layers ⚡',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
      banner: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=400&fit=crop',
      location: 'Austin, TX',
      website: 'https://github.com/marcusbrody'
    }
  ];

  const userIds = [];
  for (const u of users) {
    const res = await query.run(
      `INSERT INTO users (username, name, email, password_hash, bio, avatar, banner, location, website)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.username, u.name, u.email, defaultPassword, u.bio, u.avatar, u.banner, u.location, u.website]
    );
    userIds.push(res.lastID);
  }

  // 2. Establish Follow relationships
  // sarah follows alex, elena, marcus
  // alex follows sarah, marcus
  // elena follows sarah
  // marcus follows sarah, alex
  const followPairs = [
    [userIds[0], userIds[1]],
    [userIds[0], userIds[2]],
    [userIds[0], userIds[3]],
    [userIds[1], userIds[0]],
    [userIds[1], userIds[3]],
    [userIds[2], userIds[0]],
    [userIds[3], userIds[0]],
    [userIds[3], userIds[1]]
  ];

  for (const [follower, following] of followPairs) {
    await query.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [follower, following]);
  }

  // 3. Create Posts
  const posts = [
    {
      userId: userIds[0], // Sarah
      content: 'Just launched my new full-stack project built with Express.js and clean vanilla JS! Really enjoying how lightweight and fast a purely decoupled architecture feels without unnecessary framework overhead. What stack are you loving lately? 🚀💻 #webdev #javascript #coding',
      image_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=900&h=500&fit=crop',
      tags: 'webdev,javascript,coding',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      userId: userIds[1], // Alex
      content: 'Design system tip: Never overlook micro-interactions. A subtle 150ms spring animation on like buttons and tabs makes a web app feel 10x more alive and responsive to human touch. Clean typography + consistent spacing = pure delight. ✨🎨 #design #ux #ui',
      image_url: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=900&h=500&fit=crop',
      tags: 'design,ux,ui',
      created_at: new Date(Date.now() - 3600000 * 9).toISOString()
    },
    {
      userId: userIds[2], // Elena
      content: 'Early morning hike in Banff National Park. The sunrise reflection over Moraine Lake was completely breathless today. Nature always resets the mind. 🏔️🌲✨ #photography #nature #banff #travel',
      image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=900&h=550&fit=crop',
      tags: 'photography,nature,banff,travel',
      created_at: new Date(Date.now() - 3600000 * 14).toISOString()
    },
    {
      userId: userIds[3], // Marcus
      content: 'Friendly reminder: Index your foreign keys and filter columns in SQLite and Postgres! Adding a single composite index turned a 240ms feed query into 3ms flat. Small wins feel incredible. ⚡📈 #database #sqlite #backend #performance',
      image_url: '',
      tags: 'database,sqlite,backend,performance',
      created_at: new Date(Date.now() - 3600000 * 20).toISOString()
    },
    {
      userId: userIds[0], // Sarah
      content: 'Coffee brewed, terminal open, playlist on. Ready for another productive coding sprint. Have a wonderful and creative week everyone! ☕🎧 #mondaymotivation #developer',
      image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=900&h=500&fit=crop',
      tags: 'mondaymotivation,developer',
      created_at: new Date(Date.now() - 3600000 * 28).toISOString()
    }
  ];

  const postIds = [];
  for (const p of posts) {
    const res = await query.run(
      'INSERT INTO posts (user_id, content, image_url, tags, created_at) VALUES (?, ?, ?, ?, ?)',
      [p.userId, p.content, p.image_url, p.tags, p.created_at]
    );
    postIds.push(res.lastID);
  }

  // 4. Create Likes
  const likes = [
    [userIds[1], postIds[0]], // Alex liked Sarah's post
    [userIds[2], postIds[0]], // Elena liked Sarah's post
    [userIds[3], postIds[0]], // Marcus liked Sarah's post
    [userIds[0], postIds[1]], // Sarah liked Alex's design post
    [userIds[2], postIds[1]], // Elena liked Alex's design post
    [userIds[0], postIds[2]], // Sarah liked Elena's Banff post
    [userIds[1], postIds[2]], // Alex liked Elena's Banff post
    [userIds[3], postIds[2]], // Marcus liked Elena's Banff post
    [userIds[0], postIds[3]], // Sarah liked Marcus's DB post
    [userIds[1], postIds[4]]  // Alex liked Sarah's coffee post
  ];

  for (const [uId, pId] of likes) {
    await query.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [uId, pId]);
  }

  // 5. Create Comments
  const comments = [
    {
      postId: postIds[0],
      userId: userIds[1],
      content: 'Looks awesome Sarah! Really clean UI feel too.',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      postId: postIds[0],
      userId: userIds[3],
      content: '100% agree on Express + vanilla JS. So fast and easy to maintain.',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      postId: postIds[1],
      userId: userIds[0],
      content: 'The animation timing really makes a huge difference. Great takeaway!',
      created_at: new Date(Date.now() - 3600000 * 8).toISOString()
    },
    {
      postId: postIds[2],
      userId: userIds[0],
      content: 'Stunning colors Elena! The water clarity is unreal.',
      created_at: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
      postId: postIds[3],
      userId: userIds[0],
      content: 'Indexes are pure magic when done right! Good reminder.',
      created_at: new Date(Date.now() - 3600000 * 18).toISOString()
    }
  ];

  for (const c of comments) {
    await query.run(
      'INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)',
      [c.postId, c.userId, c.content, c.created_at]
    );
  }

  // 6. Create Notifications
  const notifications = [
    {
      userId: userIds[0], // To Sarah
      actorId: userIds[1], // From Alex
      type: 'like',
      postId: postIds[0]
    },
    {
      userId: userIds[0], // To Sarah
      actorId: userIds[3], // From Marcus
      type: 'comment',
      postId: postIds[0]
    },
    {
      userId: userIds[0], // To Sarah
      actorId: userIds[2], // From Elena
      type: 'follow',
      postId: null
    }
  ];

  for (const n of notifications) {
    await query.run(
      'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
      [n.userId, n.actorId, n.type, n.postId]
    );
  }

  console.log('Seeding complete! 4 users, 5 posts, comments, likes, and follows created.');
}

module.exports = { seed };

if (require.main === module) {
  seed().then(() => {
    console.log('Seed execution finished.');
    process.exit(0);
  }).catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
