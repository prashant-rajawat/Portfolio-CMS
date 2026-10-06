import { getDbPool } from '../db/index.ts';
import { MessageRecord } from '../types/cms.ts';
import { CreateContactDTO } from '../validators/contact.validator.ts';
import { NotFoundError, DatabaseNotConfiguredError } from '../utils/errors.ts';
import { EmailService } from './email.service.ts';
import { logger } from '../utils/logger.ts';

export interface MessagesListResult {
  messages: MessageRecord[];
  unreadCount: number;
}

export class ContactService {
  /**
   * Saves a new contact inquiry from the public portfolio form and triggers email notification.
   */
  public static async submitContact(data: CreateContactDTO): Promise<MessageRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `
      INSERT INTO messages (name, email, subject, message, is_read)
      VALUES ($1, $2, $3, $4, false)
      RETURNING id, name, email, subject, message, is_read, created_at, updated_at;
    `;

    const result = await pool.query(query, [
      data.name.trim(),
      data.email.trim(),
      data.subject.trim(),
      data.message.trim(),
    ]);

    const savedRecord = result.rows[0] as MessageRecord;
    logger.info(`Contact message recorded from "${savedRecord.email}" with ID: ${savedRecord.id}`);

    // Asynchronously dispatch email notification (non-blocking)
    EmailService.sendContactNotification(savedRecord).catch((err) => {
      logger.error('Background email dispatch encountered error:', err);
    });

    return savedRecord;
  }

  /**
   * Retrieves all contact messages ordered chronologically (newest first) along with unread count.
   */
  public static async getAll(): Promise<MessagesListResult> {
    const pool = getDbPool();
    if (!pool) {
      return { messages: [], unreadCount: 0 };
    }

    const messagesQuery = `
      SELECT id, name, email, subject, message, is_read, created_at, updated_at
      FROM messages
      ORDER BY created_at DESC;
    `;

    const unreadQuery = `
      SELECT COUNT(*)::int as unread_count
      FROM messages
      WHERE is_read = false;
    `;

    try {
      const [messagesRes, unreadRes] = await Promise.all([
        pool.query(messagesQuery),
        pool.query(unreadQuery),
      ]);

      const messages = messagesRes.rows as MessageRecord[];
      const unreadCount = unreadRes.rows[0]?.unread_count ?? 0;

      return { messages, unreadCount };
    } catch {
      return { messages: [], unreadCount: 0 };
    }
  }

  /**
   * Retrieves a single message by ID.
   */
  public static async getById(id: string): Promise<MessageRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT id, name, email, subject, message, is_read, created_at, updated_at
      FROM messages
      WHERE id = $1
      LIMIT 1;
    `;

    try {
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) return null;
      return result.rows[0] as MessageRecord;
    } catch {
      return null;
    }
  }

  /**
   * Updates the read status of a message.
   */
  public static async markAsRead(id: string, isRead: boolean = true): Promise<MessageRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `
      UPDATE messages
      SET is_read = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, email, subject, message, is_read, created_at, updated_at;
    `;

    const result = await pool.query(query, [isRead, id]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Message with ID "${id}" was not found.`);
    }

    const updated = result.rows[0] as MessageRecord;
    logger.info(`Message ${id} read status updated to: ${isRead}`);
    return updated;
  }

  /**
   * Deletes a contact message by ID.
   */
  public static async delete(id: string): Promise<MessageRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `
      DELETE FROM messages
      WHERE id = $1
      RETURNING id, name, email, subject, message, is_read, created_at, updated_at;
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Message with ID "${id}" was not found.`);
    }

    const deleted = result.rows[0] as MessageRecord;
    logger.info(`Message ${id} deleted successfully.`);
    return deleted;
  }

  /**
   * Gets the total unread message count.
   */
  public static async getUnreadCount(): Promise<number> {
    const pool = getDbPool();
    if (!pool) return 0;

    const query = `
      SELECT COUNT(*)::int as count
      FROM messages
      WHERE is_read = false;
    `;

    try {
      const result = await pool.query(query);
      return result.rows[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }
}
