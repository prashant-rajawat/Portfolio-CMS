import { getDbPool, markDatabaseError } from '../db/index.ts';
import { ExperienceRecord } from '../types/cms.ts';
import { NotFoundError } from '../utils/errors.ts';
import { FallbackStore } from './fallbackStore.ts';

export class ExperienceService {
  public static async getAll(): Promise<ExperienceRecord[]> {
    const pool = getDbPool();
    if (pool) {
      try {
        const result = await pool.query('SELECT id, company, position, description, start_date, end_date, is_current, display_order, created_at, updated_at FROM experience ORDER BY start_date DESC, display_order ASC;');
        return result.rows as ExperienceRecord[];
      } catch {
        markDatabaseError();
      }
    }
    const store = FallbackStore.readStore();
    return (store.experience || []).sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  public static async create(data: any): Promise<ExperienceRecord> {
    const newRecord: ExperienceRecord = {
      id: `exp_${Date.now()}`,
      company: data.company,
      position: data.position,
      description: data.description,
      start_date: data.start_date,
      end_date: data.end_date ?? null,
      is_current: data.is_current ?? false,
      display_order: data.display_order ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pool = getDbPool();
    if (pool) {
      try {
        const res = await pool.query(
          'INSERT INTO experience (company, position, description, start_date, end_date, is_current, display_order) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
          [data.company, data.position, data.description, data.start_date, data.end_date ?? null, data.is_current ?? false, data.display_order ?? 0]
        );
        if (res.rows[0]) {
          const inserted = res.rows[0] as ExperienceRecord;
          const store = FallbackStore.readStore();
          store.experience.push(inserted);
          FallbackStore.writeStore(store);
          return inserted;
        }
      } catch {}
    }
    const store = FallbackStore.readStore();
    store.experience.push(newRecord);
    FallbackStore.writeStore(store);
    return newRecord;
  }

  public static async update(id: string, data: any): Promise<ExperienceRecord> {
    const pool = getDbPool();
    if (pool) {
      try {
        const res = await pool.query(
          'UPDATE experience SET company = $1, position = $2, description = $3, start_date = $4, end_date = $5, is_current = $6, display_order = $7, updated_at = NOW() WHERE id = $8 RETURNING *;',
          [data.company, data.position, data.description, data.start_date, data.end_date ?? null, data.is_current ?? false, data.display_order ?? 0, id]
        );
        if (res.rows[0]) {
          const updated = res.rows[0] as ExperienceRecord;
          const store = FallbackStore.readStore();
          store.experience = store.experience.map((e: any) => (e.id === id ? updated : e));
          FallbackStore.writeStore(store);
          return updated;
        }
      } catch {}
    }
    const store = FallbackStore.readStore();
    let updated: any = null;
    store.experience = store.experience.map((e: any) => {
      if (e.id === id) {
        updated = { ...e, ...data, updated_at: new Date().toISOString() };
        return updated;
      }
      return e;
    });
    FallbackStore.writeStore(store);
    if (!updated) throw new NotFoundError('Experience not found');
    return updated;
  }

  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (pool) {
      try { await pool.query('DELETE FROM experience WHERE id = $1;', [id]); } catch {}
    }
    const store = FallbackStore.readStore();
    store.experience = store.experience.filter((e: any) => e.id !== id);
    FallbackStore.writeStore(store);
    return { id };
  }
}
