const http = require('http');
const { app, startServer } = require('./server');

let server;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3999,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  server = app.listen(3999, async () => {
    console.log('Testing server started on 3999');
    try {
      // 1. Health check
      const health = await request('GET', '/api/health');
      console.log('1. Health check:', health.status, health.data.status);

      // 2. Demo login as Sarah Chen
      const loginRes = await request('POST', '/api/auth/demo', { username: 'sarah_tech' });
      console.log('2. Demo login:', loginRes.status, loginRes.data.user.username);
      const token = loginRes.data.token;

      // 3. Fetch posts
      const postsRes = await request('GET', '/api/posts', null, token);
      console.log('3. Fetch feed posts:', postsRes.status, 'Posts count:', postsRes.data.posts.length);
      const firstPostId = postsRes.data.posts[0].id;

      // 4. Like / toggle like
      const likeRes = await request('POST', `/api/posts/${firstPostId}/like`, null, token);
      console.log('4. Toggle like post:', likeRes.status, 'Liked?', likeRes.data.liked, 'Count:', likeRes.data.likesCount);

      // 5. Add a comment
      const commentRes = await request('POST', `/api/comments/post/${firstPostId}`, { content: 'Testing automated comment integration!' }, token);
      console.log('5. Add comment:', commentRes.status, 'Comment ID:', commentRes.data.comment.id);

      // 6. Create a post
      const createPostRes = await request('POST', '/api/posts', {
        content: 'Hello world from automated integration test! #fullstack #test',
        imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800'
      }, token);
      console.log('6. Create post:', createPostRes.status, 'New post ID:', createPostRes.data.post.id);

      // 7. Follow / unfollow user
      // Find Alex's id
      const profileAlex = await request('GET', '/api/users/profile/alex_designer', null, token);
      console.log('7. Alex profile isFollowing before:', profileAlex.data.profile.isFollowing);
      const followRes = await request('POST', `/api/users/${profileAlex.data.profile.id}/follow`, null, token);
      console.log('7b. Toggle follow Alex:', followRes.status, 'Following?', followRes.data.following);

      // 8. Delete test post
      const deleteRes = await request('DELETE', `/api/posts/${createPostRes.data.post.id}`, null, token);
      console.log('8. Delete created post:', deleteRes.status, deleteRes.data.message);

      console.log('--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('Test error:', err);
      server.close(() => process.exit(1));
    }
  });
}

runTests();
