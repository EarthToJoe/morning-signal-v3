import { query } from '../config/database';
import { logger } from '../utils/logger';
import { Subscriber } from 'shared';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export class SubscriberManagerService {
  isValidEmail(email: string): boolean { return EMAIL_REGEX.test(email) && email.length <= 512; }

  async addSubscriber(email: string, profileId: string): Promise<Subscriber> {
    const normalized = email.trim().toLowerCase();
    if (!this.isValidEmail(normalized)) throw new Error(`Invalid email format: ${email}`);
    const existing = await query('SELECT * FROM subscribers WHERE email = $1 AND profile_id = $2', [normalized, profileId]);
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.status === 'unsubscribed') {
        await query('UPDATE subscribers SET status = $1, unsubscribed_at = NULL WHERE id = $2', ['active', row.id]);
        return { ...this.mapRow(row), status: 'active', unsubscribedAt: undefined };
      }
      return this.mapRow(row);
    }
    const result = await query('INSERT INTO subscribers (email, status, profile_id) VALUES ($1, $2, $3) RETURNING *', [normalized, 'active', profileId]);
    logger.info('Subscriber added', { component: 'subscriber-manager', email: normalized, profileId });
    return this.mapRow(result.rows[0]);
  }

  async unsubscribe(id: string): Promise<void> {
    await query('UPDATE subscribers SET status = $1, unsubscribed_at = NOW() WHERE id = $2', ['unsubscribed', id]);
  }

  async getActiveSubscribers(profileId: string): Promise<Subscriber[]> {
    const result = await query("SELECT * FROM subscribers WHERE status = 'active' AND profile_id = $1 ORDER BY subscribed_at", [profileId]);
    return result.rows.map(this.mapRow);
  }

  async getAllSubscribers(profileId: string): Promise<Subscriber[]> {
    const result = await query('SELECT * FROM subscribers WHERE profile_id = $1 ORDER BY subscribed_at', [profileId]);
    return result.rows.map(this.mapRow);
  }

  private mapRow(row: any): Subscriber {
    return { id: row.id, email: row.email, status: row.status, profileId: row.profile_id, subscribedAt: new Date(row.subscribed_at), unsubscribedAt: row.unsubscribed_at ? new Date(row.unsubscribed_at) : undefined };
  }
}
