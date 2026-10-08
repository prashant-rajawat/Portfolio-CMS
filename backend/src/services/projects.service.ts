import { getDbPool, markDatabaseError } from '../db/index.ts';
import { ProjectRecord } from '../types/cms.ts';
import { CreateProjectInput, UpdateProjectInput } from '../validators/projects.validator.ts';
import { NotFoundError, ConflictError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { FallbackStore } from './fallbackStore.ts';

export class ProjectsService {
  public static async getAll(): Promise<ProjectRecord[]> {
    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          SELECT id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at
          FROM projects
          ORDER BY display_order ASC, created_at DESC;
        `;
        const result = await pool.query(query);
        return result.rows as ProjectRecord[];
      } catch (err) {
        markDatabaseError();
        logger.debug('PostgreSQL projects query unavailable, using local store');
      }
    }

    const store = FallbackStore.readStore();
    return (store.projects || []).sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  public static async getById(id: string): Promise<ProjectRecord | null> {
    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          SELECT id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at
          FROM projects
          WHERE id = $1
          LIMIT 1;
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length > 0) return result.rows[0] as ProjectRecord;
      } catch {}
    }

    const store = FallbackStore.readStore();
    return store.projects.find((p: any) => p.id === id) || null;
  }

  public static async getBySlug(slug: string): Promise<ProjectRecord | null> {
    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          SELECT id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at
          FROM projects
          WHERE slug = $1
          LIMIT 1;
        `;
        const result = await pool.query(query, [slug]);
        if (result.rows.length > 0) return result.rows[0] as ProjectRecord;
      } catch {}
    }

    const store = FallbackStore.readStore();
    return store.projects.find((p: any) => p.slug === slug) || null;
  }

  public static async create(data: CreateProjectInput): Promise<ProjectRecord> {
    const existing = await this.getBySlug(data.slug);
    if (existing) {
      throw new ConflictError(`A project with slug "${data.slug}" already exists.`);
    }

    const newRecord: ProjectRecord = {
      id: `project_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: data.title,
      slug: data.slug,
      short_description: data.short_description,
      full_description: data.full_description,
      image_url: data.image_url ?? null,
      technologies: data.technologies ?? [],
      live_url: data.live_url ?? null,
      github_url: data.github_url ?? null,
      display_order: data.display_order ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          INSERT INTO projects (title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at;
        `;
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
        if (result.rows[0]) {
          const inserted = result.rows[0] as ProjectRecord;
          const store = FallbackStore.readStore();
          store.projects.push(inserted);
          FallbackStore.writeStore(store);
          return inserted;
        }
      } catch {}
    }

    const store = FallbackStore.readStore();
    store.projects.push(newRecord);
    FallbackStore.writeStore(store);
    return newRecord;
  }

  public static async update(id: string, data: UpdateProjectInput): Promise<ProjectRecord> {
    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Project with ID "${id}" was not found.`);
    }

    if (data.slug && data.slug !== current.slug) {
      const existing = await this.getBySlug(data.slug);
      if (existing) {
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

    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          UPDATE projects
          SET title = $1, slug = $2, short_description = $3, full_description = $4, image_url = $5, technologies = $6, live_url = $7, github_url = $8, display_order = $9, updated_at = NOW()
          WHERE id = $10
          RETURNING id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at;
        `;
        const result = await pool.query(query, [
          updatedTitle, updatedSlug, updatedShortDesc, updatedFullDesc, updatedImageUrl, updatedTech, updatedLiveUrl, updatedGithubUrl, updatedDisplayOrder, id
        ]);
        if (result.rows[0]) {
          const updated = result.rows[0] as ProjectRecord;
          const store = FallbackStore.readStore();
          store.projects = store.projects.map((p: any) => (p.id === id ? updated : p));
          FallbackStore.writeStore(store);
          return updated;
        }
      } catch {}
    }

    const store = FallbackStore.readStore();
    let updated: any = null;
    store.projects = store.projects.map((p: any) => {
      if (p.id === id) {
        updated = {
          ...p,
          title: updatedTitle,
          slug: updatedSlug,
          short_description: updatedShortDesc,
          full_description: updatedFullDesc,
          image_url: updatedImageUrl,
          technologies: updatedTech,
          live_url: updatedLiveUrl,
          github_url: updatedGithubUrl,
          display_order: updatedDisplayOrder,
          updated_at: new Date().toISOString(),
        };
        return updated;
      }
      return p;
    });
    FallbackStore.writeStore(store);
    if (!updated) {
      throw new NotFoundError(`Project with ID "${id}" was not found.`);
    }
    return updated;
  }

  public static async delete(id: string): Promise<{ id: string }> {
    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Project with ID "${id}" was not found.`);
    }

    const pool = getDbPool();
    if (pool) {
      try {
        await pool.query(`DELETE FROM projects WHERE id = $1;`, [id]);
      } catch {}
    }

    const store = FallbackStore.readStore();
    store.projects = store.projects.filter((p: any) => p.id !== id);
    FallbackStore.writeStore(store);
    return { id };
  }
}
