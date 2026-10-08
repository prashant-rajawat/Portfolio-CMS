import { getDbPool, markDatabaseError } from '../db/index.ts';
import { ServiceRecord } from '../types/cms.ts';
import { NotFoundError } from '../utils/errors.ts';
import { FallbackStore } from './fallbackStore.ts';

export class ServicesService {
  public static async getAll(): Promise<ServiceRecord[]> {
    const pool = getDbPool();
    if (pool) {
      try {
        const result = await pool.query('SELECT id, title, description, icon_url, display_order, created_at, updated_at FROM services ORDER BY display_order ASC;');
        return result.rows as ServiceRecord[];
      } catch {
        markDatabaseError();
      }
    }
    const store = FallbackStore.readStore();
    return (store.services || []).sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  public static async create(data: any): Promise<ServiceRecord> {
    const newRecord: ServiceRecord = {
      id: `service_${Date.now()}`,
      title: data.title,
      description: data.description,
      icon_url: data.icon_url ?? null,
      display_order: data.display_order ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pool = getDbPool();
    if (pool) {
      try {
        const res = await pool.query(
          'INSERT INTO services (title, description, icon_url, display_order) VALUES ($1, $2, $3, $4) RETURNING *;',
          [data.title, data.description, data.icon_url ?? null, data.display_order ?? 0]
        );
        if (res.rows[0]) {
          const inserted = res.rows[0] as ServiceRecord;
          const store = FallbackStore.readStore();
          store.services.push(inserted);
          FallbackStore.writeStore(store);
          return inserted;
        }
      } catch {}
    }
    const store = FallbackStore.readStore();
    store.services.push(newRecord);
    FallbackStore.writeStore(store);
    return newRecord;
  }

  public static async update(id: string, data: any): Promise<ServiceRecord> {
    const pool = getDbPool();
    if (pool) {
      try {
        const res = await pool.query(
          'UPDATE services SET title = $1, description = $2, icon_url = $3, display_order = $4, updated_at = NOW() WHERE id = $5 RETURNING *;',
          [data.title, data.description, data.icon_url ?? null, data.display_order ?? 0, id]
        );
        if (res.rows[0]) {
          const updated = res.rows[0] as ServiceRecord;
          const store = FallbackStore.readStore();
          store.services = store.services.map((s: any) => (s.id === id ? updated : s));
          FallbackStore.writeStore(store);
          return updated;
        }
      } catch {}
    }
    const store = FallbackStore.readStore();
    let updated: any = null;
    store.services = store.services.map((s: any) => {
      if (s.id === id) {
        updated = { ...s, ...data, updated_at: new Date().toISOString() };
        return updated;
      }
      return s;
    });
    FallbackStore.writeStore(store);
    if (!updated) throw new NotFoundError('Service not found');
    return updated;
  }

  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (pool) {
      try { await pool.query('DELETE FROM services WHERE id = $1;', [id]); } catch {}
    }
    const store = FallbackStore.readStore();
    store.services = store.services.filter((s: any) => s.id !== id);
    FallbackStore.writeStore(store);
    return { id };
  }
}
