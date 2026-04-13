import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import { profilesRouter } from './routes/profiles';
import { pipelineRouter } from './routes/pipeline';
import { editionsRouter } from './routes/editions';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'morning-signal-v3', timestamp: new Date().toISOString() });
});

// Protected routes
app.use('/api/profiles', authMiddleware, profilesRouter);
app.use('/api/pipeline', authMiddleware, pipelineRouter);
app.use('/api/editions', authMiddleware, editionsRouter);

// In production, serve React static files
if (config.nodeEnv === 'production') {
  app.use(express.static(join(__dirname, '../../client/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, '../../client/dist/index.html'));
  });
}

app.listen(config.port, () => {
  logger.info('Server started', { component: 'server', port: config.port, env: config.nodeEnv });
});
