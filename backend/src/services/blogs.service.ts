import { getDbPool } from '../db/index.ts';
import { BlogRecord } from '../types/cms.ts';
import { CreateBlogInput, UpdateBlogInput } from '../validators/blogs.validator.ts';
import { NotFoundError, ConflictError, DatabaseNotConfiguredError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

export class BlogsService {
  /**
   * Retrieves all blogs ordered by creation date descending.
   * Safely joins with users table to include author_name without exposing any authentication or password details.
   */
  public static async getAll(): Promise<BlogRecord[]> {
    const pool = getDbPool();
    if (!pool) {
      logger.warn('Database pool not available when fetching blogs');
      return [];
    }

    const query = `
      SELECT b.id, b.title, b.slug, b.excerpt, b.content, b.featured_image_url,
             b.author_id, u.name AS author_name,
             b.published, b.published_at, b.created_at, b.updated_at
      FROM blogs b
      LEFT JOIN users u ON b.author_id = u.id
      ORDER BY b.created_at DESC;
    `;

    const result = await pool.query(query);
    return result.rows as BlogRecord[];
  }

  /**
   * Retrieves a single blog by ID.
   */
  public static async getById(id: string): Promise<BlogRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT b.id, b.title, b.slug, b.excerpt, b.content, b.featured_image_url,
             b.author_id, u.name AS author_name,
             b.published, b.published_at, b.created_at, b.updated_at
      FROM blogs b
      LEFT JOIN users u ON b.author_id = u.id
      WHERE b.id = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as BlogRecord;
  }

  /**
   * Retrieves a single blog by Slug.
   */
  public static async getBySlug(slug: string): Promise<BlogRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT b.id, b.title, b.slug, b.excerpt, b.content, b.featured_image_url,
             b.author_id, u.name AS author_name,
             b.published, b.published_at, b.created_at, b.updated_at
      FROM blogs b
      LEFT JOIN users u ON b.author_id = u.id
      WHERE b.slug = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [slug]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as BlogRecord;
  }

  /**
   * Creates a new blog post. Uses authenticated admin's ID as the author_id.
   * Enforces unique slug.
   */
  public static async create(data: CreateBlogInput, authenticatedUserId?: string): Promise<BlogRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const existing = await this.getBySlug(data.slug);
    if (existing) {
      throw new ConflictError(`A blog post with slug "${data.slug}" already exists.`);
    }

    const authorId = authenticatedUserId || data.author_id || null;
    const isPublished = data.published ?? false;
    let publishedAt: string | Date | null = data.published_at ?? null;

    if (isPublished && !publishedAt) {
      publishedAt = new Date().toISOString();
    }

    const query = `
      INSERT INTO blogs (
        title, slug, excerpt, content, featured_image_url,
        author_id, published, published_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, title, slug, excerpt, content, featured_image_url, author_id, published, published_at, created_at, updated_at;
    `;

    try {
      const result = await pool.query(query, [
        data.title,
        data.slug,
        data.excerpt,
        data.content,
        data.featured_image_url ?? null,
        authorId,
        isPublished,
        publishedAt,
      ]);

      logger.info(`Created blog post: ${data.title} (${data.slug})`);
      return result.rows[0] as BlogRecord;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictError(`A blog post with slug "${data.slug}" already exists.`);
      }
      throw err;
    }
  }

  /**
   * Updates an existing blog post.
   */
  public static async update(id: string, data: UpdateBlogInput): Promise<BlogRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Blog post with ID "${id}" was not found.`);
    }

    if (data.slug && data.slug !== current.slug) {
      const conflict = await this.getBySlug(data.slug);
      if (conflict && conflict.id !== id) {
        throw new ConflictError(`A blog post with slug "${data.slug}" already exists.`);
      }
    }

    const updatedTitle = data.title ?? current.title;
    const updatedSlug = data.slug ?? current.slug;
    const updatedExcerpt = data.excerpt ?? current.excerpt;
    const updatedContent = data.content ?? current.content;
    const updatedFeaturedImage = data.featured_image_url !== undefined ? data.featured_image_url : current.featured_image_url;
    const updatedPublished = data.published !== undefined ? data.published : current.published;

    let updatedPublishedAt = data.published_at !== undefined ? data.published_at : current.published_at;
    if (updatedPublished && !updatedPublishedAt) {
      updatedPublishedAt = new Date().toISOString();
    }

    const query = `
      UPDATE blogs
      SET title = $1,
          slug = $2,
          excerpt = $3,
          content = $4,
          featured_image_url = $5,
          published = $6,
          published_at = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING id, title, slug, excerpt, content, featured_image_url, author_id, published, published_at, created_at, updated_at;
    `;

    try {
      const result = await pool.query(query, [
        updatedTitle,
        updatedSlug,
        updatedExcerpt,
        updatedContent,
        updatedFeaturedImage,
        updatedPublished,
        updatedPublishedAt,
        id,
      ]);

      logger.info(`Updated blog post: ${updatedTitle} (${id})`);
      return result.rows[0] as BlogRecord;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictError(`A blog post with slug "${data.slug}" already exists.`);
      }
      throw err;
    }
  }

  /**
   * Deletes a blog post by ID.
   */
  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `DELETE FROM blogs WHERE id = $1 RETURNING id;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new NotFoundError(`Blog post with ID "${id}" was not found.`);
    }

    logger.info(`Deleted blog post with ID: ${id}`);
    return { id };
  }
}
