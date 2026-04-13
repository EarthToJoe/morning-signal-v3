import sgMail from '@sendgrid/mail';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { createCorrelatedLogger } from '../utils/logger';
import { query } from '../config/database';
import { SubscriberManagerService } from './subscriber-manager';
import { AssembledNewsletter, DeliveryReport } from 'shared';

export class EmailDeliveryService {
  private subscriberManager: SubscriberManagerService;
  constructor(subscriberManager: SubscriberManagerService) {
    sgMail.setApiKey(config.sendGridApiKey);
    this.subscriberManager = subscriberManager;
  }

  async deliver(newsletter: AssembledNewsletter, subjectLine: string, correlationId: string, profileId: string): Promise<DeliveryReport> {
    const log = createCorrelatedLogger(correlationId, 'email-delivery');
    const subscribers = await this.subscriberManager.getActiveSubscribers(profileId);
    log.info('Starting delivery', { subscriberCount: subscribers.length, subject: subjectLine });

    const failures: { email: string; error: string }[] = [];
    let sentCount = 0;
    for (const sub of subscribers) {
      try {
        await sgMail.send({
          to: sub.email, from: { email: config.sendGridFromEmail, name: config.sendGridFromName },
          subject: subjectLine, html: newsletter.html, text: newsletter.plainText,
          headers: { 'List-Unsubscribe': `<${config.unsubscribeUrl}>` },
        });
        sentCount++;
      } catch (err: any) {
        const errorMsg = err.response?.body?.errors?.[0]?.message || err.message || 'Unknown error';
        log.error('Delivery failed', { email: sub.email, error: errorMsg });
        failures.push({ email: sub.email, error: errorMsg });
      }
    }

    const editionResult = await query('SELECT id FROM editions WHERE correlation_id = $1', [correlationId]);
    const editionId = editionResult.rows[0]?.id;
    const deliveryId = uuidv4();
    if (editionId) {
      await query('INSERT INTO delivery_reports (id, edition_id, total_sent, failure_count) VALUES ($1, $2, $3, $4)', [deliveryId, editionId, sentCount, failures.length]);
      for (const f of failures) {
        const subResult = await query('SELECT id FROM subscribers WHERE email = $1', [f.email]);
        await query('INSERT INTO delivery_failures (delivery_report_id, subscriber_id, error_reason) VALUES ($1, $2, $3)', [deliveryId, subResult.rows[0]?.id || null, f.error]);
      }
    }
    log.info('Delivery completed', { totalSent: sentCount, failureCount: failures.length });
    return { deliveryId, totalSent: sentCount, failureCount: failures.length, failures, deliveredAt: new Date() };
  }
}
