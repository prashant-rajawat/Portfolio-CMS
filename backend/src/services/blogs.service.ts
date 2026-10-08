import { getDbPool, markDatabaseError } from '../db/index.ts';
import { BlogRecord } from '../types/cms.ts';
import { CreateBlogInput, UpdateBlogInput } from '../validators/blogs.validator.ts';
import { NotFoundError, ConflictError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { FallbackStore } from './fallbackStore.ts';

export class BlogsService {
  public static async getAll(): Promise<BlogRecord[]> {
    const pool = getDbPool();
    if (pool) {
      try {
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
      } catch (err) {
        markDatabaseError();
        logger.debug('PostgreSQL blogs query unavailable, using local store');
      }
    }

    const store = FallbackStore.readStore();
    return (store.blogs || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public static async getById(id: string): Promise<BlogRecord | null> {
    const pool = getDbPool();
    if (pool) {
      try {
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
        if (result.rows.length > 0) return result.rows[0] as BlogRecord;
      } catch {}
    }

    const store = FallbackStore.readStore();
    return store.blogs.find((b: any) => b.id === id) || null;
  }

  public static async getBySlug(slug: string): Promise<BlogRecord | null> {
    const pool = getDbPool();
    if (pool) {
      try {
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
        if (result.rows.length > 0) return result.rows[0] as BlogRecord;
      } catch {}
    }

    const store = FallbackStore.readStore();
    return store.blogs.find((b: any) => b.slug === slug) || null;
  }

  public static async create(data: CreateBlogInput, authenticatedUserId?: string): Promise<BlogRecord> {
    const existing = await this.getBySlug(data.slug);
    if (existing) {
      throw new ConflictError(`A blog post with slug "${data.slug}" already exists.`);
    }

    const authorId = authenticatedUserId || data.author_id || 'user-admin';
    const isPublished = data.published ?? true; // Default to true so admin posts show up immediately
    const publishedAt = isPublished ? (data.published_at ?? new Date().toISOString()) : null;

    const newRecord: BlogRecord = {
      id: `blog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      featured_image_url: data.featured_image_url ?? null,
      author_id: authorId,
      author_name: 'Administrator',
      published: isPublished,
      published_at: publishedAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          INSERT INTO blogs (title, slug, excerpt, content, featured_image_url, author_id, published, published_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, title, slug, excerpt, content, featured_image_url, author_id, published, published_at, created_at, updated_at;
        `;
        const result = await pool.query(query, [
          data.title, data.slug, data.excerpt, data.content, data.featured_image_url ?? null, authorId, isPublished, publishedAt
        ]);
        if (result.rows[0]) {
          const inserted = result.rows[0] as BlogRecord;
          const store = FallbackStore.readStore();
          store.blogs.unshift(inserted);
          FallbackStore.writeStore(store);
          return inserted;
        }
      } catch {}
    }

    const store = FallbackStore.readStore();
    store.blogs.unshift(newRecord);
    FallbackStore.writeStore(store);
    return newRecord;
  }

  public static async update(id: string, data: UpdateBlogInput): Promise<BlogRecord> {
    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Blog post with ID "${id}" was not found.`);
    }

    if (data.slug && data.slug !== current.slug) {
      const existing = await this.getBySlug(data.slug);
      if (existing) {
        throw new ConflictError(`A blog post with slug "${data.slug}" already exists.`);
      }
    }

    const updatedTitle = data.title ?? current.title;
    const updatedSlug = data.slug ?? current.slug;
    const updatedExcerpt = data.excerpt ?? current.excerpt;
    const updatedContent = data.content ?? current.content;
    const updatedFeaturedImg = data.featured_image_url !== undefined ? data.featured_image_url : current.featured_image_url;
    const updatedPublished = data.published !== undefined ? data.published : current.published;
    const updatedPublishedAt = updatedPublished && !current.published_at ? new Date().toISOString() : current.published_at;

    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          UPDATE blogs
          SET title = $1, slug = $2, excerpt = $3, content = $4, featured_image_url = $5, published = $6, published_at = $7, updated_at = NOW()
          WHERE id = $8
          RETURNING id, title, slug, excerpt, content, featured_image_url, author_id, published, published_at, created_at, updated_at;
        `;
        const result = await pool.query(query, [
          updatedTitle, updatedSlug, updatedExcerpt, updatedContent, updatedFeaturedImg, updatedPublished, updatedPublishedAt, id
        ]);
        if (result.rows[0]) {
          const updated = result.rows[0] as BlogRecord;
          const store = FallbackStore.readStore();
          store.blogs = store.blogs.map((b: any) => (b.id === id ? updated : b));
          FallbackStore.writeStore(store);
          return updated;
        }
      } catch {}
    }

    const store = FallbackStore.readStore();
    let updated: any = null;
    store.blogs = store.blogs.map((b: any) => {
      if (b.id === id) {
        updated = {
          ...b,
          title: updatedTitle,
          slug: updatedSlug,
          excerpt: updatedExcerpt,
          content: updatedContent,
          featured_image_url: updatedFeaturedImg,
          published: updatedPublished,
          published_at: updatedPublishedAt,
          updated_at: new Date().toISOString(),
        };
        return updated;
      }
      return b;
    });
    FallbackStore.writeStore(store);
    if (!updated) {
      throw new NotFoundError(`Blog post with ID "${id}" was not found.`);
    }
    return updated;
  }

  public static async delete(id: string): Promise<{ id: string }> {
    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Blog post with ID "${id}" was not found.`);
    }

    const pool = getDbPool();
    if (pool) {
      try {
        await pool.query(`DELETE FROM blogs WHERE id = $1;`, [id]);
      } catch {}
    }

    const store = FallbackStore.readStore();
    store.blogs = store.blogs.filter((b: any) => b.id !== id);
    FallbackStore.writeStore(store);
    return { id };
  }
}
