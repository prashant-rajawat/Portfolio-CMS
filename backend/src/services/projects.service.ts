import { getDbPool } from '../db/index.ts';
import { ProjectRecord } from '../types/cms.ts';
import { CreateProjectInput, UpdateProjectInput } from '../validators/projects.validator.ts';
import { NotFoundError, ConflictError, DatabaseNotConfiguredError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

export class ProjectsService {
  /**
   * Retrieves all projects ordered by display_order ascending, then creation date descending.
   */
  public static async getAll(): Promise<ProjectRecord[]> {
    const pool = getDbPool();
    if (!pool) {
      logger.warn('Database pool not available when fetching projects');
      return [];
    }

    const query = `
      SELECT id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at
      FROM projects
      ORDER BY display_order ASC, created_at DESC;
    `;

    const result = await pool.query(query);
    return result.rows as ProjectRecord[];
  }

  /**
   * Retrieves a single project by ID.
   */
  public static async getById(id: string): Promise<ProjectRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at
      FROM projects
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as ProjectRecord;
  }

  /**
   * Retrieves a single project by Slug.
   */
  public static async getBySlug(slug: string): Promise<ProjectRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at
      FROM projects
      WHERE slug = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [slug]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as ProjectRecord;
  }

  /**
   * Creates a new project. Enforces unique slug validation.
   */
  public static async create(data: CreateProjectInput): Promise<ProjectRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    // Explicit unique check before insert
    const existing = await this.getBySlug(data.slug);
    if (existing) {
      throw new ConflictError(`A project with slug "${data.slug}" already exists.`);
    }

    const query = `
      INSERT INTO projects (
        title, slug, short_description, full_description,
        image_url, technologies, live_url, github_url, display_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at;
    `;

    try {
      const result = await pool.query(query, [
        data.title,
        data.slug,
        data.short_description,
        data.full_description,
        data.image_url ?? null,
        data.technologies ?? [],
        data.live_url ?? null,
        data.github_url ?? null,
        data.display_order ?? 0,
      ]);

      logger.info(`Created new project: ${data.title} (${data.slug})`);
      return result.rows[0] as ProjectRecord;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictError(`A project with slug "${data.slug}" already exists.`);
      }
      throw err;
    }
  }

  /**
   * Updates an existing project. Checks unique slug conflict if modified.
   */
  public static async update(id: string, data: UpdateProjectInput): Promise<ProjectRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Project with ID "${id}" was not found.`);
    }

    if (data.slug && data.slug !== current.slug) {
      const conflict = await this.getBySlug(data.slug);
      if (conflict && conflict.id !== id) {
        throw new ConflictError(`A project with slug "${data.slug}" already exists.`);
      }
    }

    const updatedTitle = data.title ?? current.title;
    const updatedSlug = data.slug ?? current.slug;
    const updatedShortDesc = data.short_description ?? current.short_description;
    const updatedFullDesc = data.full_description ?? current.full_description;
    const updatedImageUrl = data.image_url !== undefined ? data.image_url : current.image_url;
    const updatedTech = data.technologies ?? current.technologies;
    const updatedLiveUrl = data.live_url !== undefined ? data.live_url : current.live_url;
    const updatedGithubUrl = data.github_url !== undefined ? data.github_url : current.github_url;
    const updatedDisplayOrder = data.display_order !== undefined ? data.display_order : current.display_order;

    const query = `
      UPDATE projects
      SET title = $1,
          slug = $2,
          short_description = $3,
          full_description = $4,
          image_url = $5,
          technologies = $6,
          live_url = $7,
          github_url = $8,
          display_order = $9,
          updated_at = NOW()
      WHERE id = $10
      RETURNING id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at;
    `;

    try {
      const result = await pool.query(query, [
        updatedTitle,
        updatedSlug,
        updatedShortDesc,
        updatedFullDesc,
        updatedImageUrl,
        updatedTech,
        updatedLiveUrl,
        updatedGithubUrl,
        updatedDisplayOrder,
        id,
      ]);

      logger.info(`Updated project: ${updatedTitle} (${id})`);
      return result.rows[0] as ProjectRecord;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictError(`A project with slug "${data.slug}" already exists.`);
      }
      throw err;
    }
  }

  /**
   * Deletes a project by ID.
   */
  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `DELETE FROM projects WHERE id = $1 RETURNING id;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new NotFoundError(`Project with ID "${id}" was not found.`);
    }

    logger.info(`Deleted project with ID: ${id}`);
    return { id };
  }
}
