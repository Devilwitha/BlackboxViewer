import { defineConfig } from 'vite';
// @ts-ignore – plain ESM module shared with the production server
import { leaderboardMiddleware } from './server/leaderboard.mjs';

export default defineConfig({
  plugins: [
    {
      name: 'leaderboard-api',
      configureServer(server) {
        server.middlewares.use(leaderboardMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(leaderboardMiddleware());
      },
    },
  ],
  worker: { format: 'es' },
});
