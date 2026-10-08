import { getDbPool, markDatabaseError } from '../db/index.ts';
import { TestimonialRecord } from '../types/cms.ts';
import { NotFoundError } from '../utils/errors.ts';
import { FallbackStore } from './fallbackStore.ts';

export class TestimonialsService {
  public static async getAll(): Promise<TestimonialRecord[]> {
    const pool = getDbPool();
    if (pool) {
      try {
        const result = await pool.query('SELECT id, name, role, company, content, profile_image_url, display_order, created_at, updated_at FROM testimonials ORDER BY display_order ASC;');
        return result.rows as TestimonialRecord[];
      } catch {
        markDatabaseError();
      }
    }
    const store = FallbackStore.readStore();
    return (store.testimonials || []).sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  public static async create(data: any): Promise<TestimonialRecord> {
    const newRecord: TestimonialRecord = {
      id: `test_${Date.now()}`,
      name: data.name,
      role: data.role,
      company: data.company,
      content: data.content,
      profile_image_url: data.profile_image_url ?? null,
      display_order: data.display_order ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pool = getDbPool();
    if (pool) {
      try {
        const res = await pool.query(
          'INSERT INTO testimonials (name, role, company, content, profile_image_url, display_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;',
          [data.name, data.role, data.company, data.content, data.profile_image_url ?? null, data.display_order ?? 0]
        );
        if (res.rows[0]) {
          const inserted = res.rows[0] as TestimonialRecord;
          const store = FallbackStore.readStore();
          store.testimonials.push(inserted);
          FallbackStore.writeStore(store);
          return inserted;
        }
      } catch {}
    }
    const store = FallbackStore.readStore();
    store.testimonials.push(newRecord);
    FallbackStore.writeStore(store);
    return newRecord;
  }

  public static async update(id: string, data: any): Promise<TestimonialRecord> {
    const pool = getDbPool();
    if (pool) {
      try {
        const res = await pool.query(
          'UPDATE testimonials SET name = $1, role = $2, company = $3, content = $4, profile_image_url = $5, display_order = $6, updated_at = NOW() WHERE id = $7 RETURNING *;',
          [data.name, data.role, data.company, data.content, data.profile_image_url ?? null, data.display_order ?? 0, id]
        );
        if (res.rows[0]) {
          const updated = res.rows[0] as TestimonialRecord;
          const store = FallbackStore.readStore();
          store.testimonials = store.testimonials.map((t: any) => (t.id === id ? updated : t));
          FallbackStore.writeStore(store);
          return updated;
        }
      } catch {}
    }
    const store = FallbackStore.readStore();
    let updated: any = null;
    store.testimonials = store.testimonials.map((t: any) => {
      if (t.id === id) {
        updated = { ...t, ...data, updated_at: new Date().toISOString() };
        return updated;
      }
      return t;
    });
    FallbackStore.writeStore(store);
    if (!updated) throw new NotFoundError('Testimonial not found');
    return updated;
  }

  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (pool) {
      try { await pool.query('DELETE FROM testimonials WHERE id = $1;', [id]); } catch {}
    }
    const store = FallbackStore.readStore();
    store.testimonials = store.testimonials.filter((t: any) => t.id !== id);
    FallbackStore.writeStore(store);
    return { id };
  }
}
