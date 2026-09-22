import { Request, Response, NextFunction } from 'express';
import { ContactService } from '../services/contact.service.ts';
import { NotFoundError } from '../utils/errors.ts';

export class ContactController {
  /**
   * Public endpoint to submit a contact inquiry.
   * POST /api/contact
   */
  public static async submitContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const message = await ContactService.submitContact(req.body);
      res.status(201).json({
        success: true,
        message: 'Your message has been sent successfully.',
        data: message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin endpoint to list all contact inquiries.
   * GET /api/messages
   */
  public static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ContactService.getAll();
      res.status(200).json({
        success: true,
        data: result.messages,
        unread_count: result.unreadCount,
        unreadCount: result.unreadCount,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin endpoint to retrieve a single contact inquiry by ID.
   * GET /api/messages/:id
   */
  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const message = await ContactService.getById(req.params.id);
      if (!message) {
        throw new NotFoundError(`Message with ID "${req.params.id}" was not found.`);
      }
      res.status(200).json({
        success: true,
        data: message,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin endpoint to update read/unread status of a message.
   * PUT /api/messages/:id/read
   */
  public static async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isRead = req.body?.is_read !== undefined ? Boolean(req.body.is_read) : true;
      const updated = await ContactService.markAsRead(req.params.id, isRead);
      const unreadCount = await ContactService.getUnreadCount();

      res.status(200).json({
        success: true,
        message: `Message marked as ${isRead ? 'read' : 'unread'}.`,
        data: updated,
        unread_count: unreadCount,
        unreadCount: unreadCount,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin endpoint to delete a contact message.
   * DELETE /api/messages/:id
   */
  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await ContactService.delete(req.params.id);
      const unreadCount = await ContactService.getUnreadCount();

      res.status(200).json({
        success: true,
        message: 'Message deleted successfully.',
        data: { id: deleted.id },
        unread_count: unreadCount,
        unreadCount: unreadCount,
      });
    } catch (err) {
      next(err);
    }
  }
}
