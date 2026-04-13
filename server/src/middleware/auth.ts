import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

/**
 * Auth middleware: validates JWT from Authorization header.
 * Attaches userId and userEmail to req for downstream handlers.
 * For development without Supabase Auth configured, falls back to a dev user.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Dev mode fallback: if no Supabase keys configured, use a dev user
  if (!config.supabaseUrl || config.supabaseUrl === '' || !config.supabaseServiceRoleKey || config.supabaseServiceRoleKey === 'REPLACE_ME') {
    req.userId = 'dev-user-id';
    req.userEmail = 'dev@localhost';
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
