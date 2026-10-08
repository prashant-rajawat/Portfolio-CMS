import { getDbPool, markDatabaseError } from '../db/index.ts';
import { SkillRecord } from '../types/cms.ts';
import { CreateSkillInput, UpdateSkillInput } from '../validators/skills.validator.ts';
import { NotFoundError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { FallbackStore } from './fallbackStore.ts';

export class SkillsService {
  public static async getAll(): Promise<SkillRecord[]> {
    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          SELECT id, name, category, proficiency, icon_url, display_order, created_at, updated_at
          FROM skills
          ORDER BY display_order ASC, created_at ASC;
        `;
        const result = await pool.query(query);
        return result.rows as SkillRecord[];
      } catch (err) {
        markDatabaseError();
        logger.debug('PostgreSQL skill query unavailable, using local store');
      }
    }

    const store = FallbackStore.readStore();
    return (store.skills || []).sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  public static async getById(id: string): Promise<SkillRecord | null> {
    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          SELECT id, name, category, proficiency, icon_url, display_order, created_at, updated_at
          FROM skills
          WHERE id = $1
          LIMIT 1;
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length > 0) return result.rows[0] as SkillRecord;
      } catch {}
    }

    const store = FallbackStore.readStore();
    return store.skills.find((s: any) => s.id === id) || null;
  }

  public static async create(data: CreateSkillInput): Promise<SkillRecord> {
    const newRecord: SkillRecord = {
      id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: data.name,
      category: data.category,
      proficiency: data.proficiency ?? null,
      icon_url: data.icon_url ?? null,
      display_order: data.display_order ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          INSERT INTO skills (name, category, proficiency, icon_url, display_order)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, name, category, proficiency, icon_url, display_order, created_at, updated_at;
        `;
        const result = await pool.query(query, [
          data.name,
          data.category,
          data.proficiency ?? null,
          data.icon_url ?? null,
          data.display_order ?? 0,
        ]);
        if (result.rows[0]) {
          const inserted = result.rows[0] as SkillRecord;
          // Also sync to fallback store
          const store = FallbackStore.readStore();
          store.skills.push(inserted);
          FallbackStore.writeStore(store);
          logger.info(`Created new skill in DB: ${data.name}`);
          return inserted;
        }
      } catch (err) {
        markDatabaseError();
        logger.debug('PostgreSQL skill create unavailable, using local store');
      }
    }

    const store = FallbackStore.readStore();
    store.skills.push(newRecord);
    FallbackStore.writeStore(store);
    logger.info(`Created new skill in fallback store: ${data.name}`);
    return newRecord;
  }

  public static async update(id: string, data: UpdateSkillInput): Promise<SkillRecord> {
    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Skill with ID "${id}" was not found.`);
    }

    const updatedName = data.name ?? current.name;
    const updatedCategory = data.category ?? current.category;
    const updatedProficiency = data.proficiency !== undefined ? data.proficiency : current.proficiency;
    const updatedIconUrl = data.icon_url !== undefined ? data.icon_url : current.icon_url;
    const updatedDisplayOrder = data.display_order !== undefined ? data.display_order : current.display_order;

    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          UPDATE skills
          SET name = $1, category = $2, proficiency = $3, icon_url = $4, display_order = $5, updated_at = NOW()
          WHERE id = $6
          RETURNING id, name, category, proficiency, icon_url, display_order, created_at, updated_at;
        `;
        const result = await pool.query(query, [updatedName, updatedCategory, updatedProficiency, updatedIconUrl, updatedDisplayOrder, id]);
        if (result.rows[0]) {
          const updated = result.rows[0] as SkillRecord;
          const store = FallbackStore.readStore();
          store.skills = store.skills.map((s: any) => (s.id === id ? updated : s));
          FallbackStore.writeStore(store);
          return updated;
        }
      } catch {}
    }

    const store = FallbackStore.readStore();
    let updated: any = null;
    store.skills = store.skills.map((s: any) => {
      if (s.id === id) {
        updated = {
          ...s,
          name: updatedName,
          category: updatedCategory,
          proficiency: updatedProficiency,
          icon_url: updatedIconUrl,
          display_order: updatedDisplayOrder,
          updated_at: new Date().toISOString(),
        };
        return updated;
      }
      return s;
    });
    FallbackStore.writeStore(store);
    if (!updated) {
      throw new NotFoundError(`Skill with ID "${id}" was not found.`);
    }
    return updated;
  }

  public static async delete(id: string): Promise<{ id: string }> {
    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Skill with ID "${id}" was not found.`);
    }

    const pool = getDbPool();
    if (pool) {
      try {
        await pool.query(`DELETE FROM skills WHERE id = $1;`, [id]);
      } catch {}
    }

    const store = FallbackStore.readStore();
    store.skills = store.skills.filter((s: any) => s.id !== id);
    FallbackStore.writeStore(store);
    return { id };
  }
}
