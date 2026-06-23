import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mock-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/github') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              repo: 'ValMtp3/Juste-Recrute-Moi',
              stars: 483, 
              pullRequests: 19,
              openIssues: 10,
              forks: 92,
              url: 'https://github.com/ValMtp3/Juste-Recrute-Moi'
            }));
            return;
          }
          if (req.url === '/api/views') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ total: 1250, configured: true }));
            return;
          }
          next();
        });
      }
    }
  ],
  server: { 
    host: '127.0.0.1',
    port: 5175
  }
});
