import { DatabaseManager } from '@quantnexus/desktop/database/db-manager';

/**
 * Factor entity - matches factors table schema
 *
 * See: plugins/factor-library/database/schema/001_initial.sql
 */
export interface Factor {
  id: number;
  factor_id: string;
  name: string;
  description: string | null;
  source: 'library' | 'mined' | 'custom';
  category: string;
  formula: string | null;
  code: string | null;
  params: string | null; // JSON
  ic: number | null;
  icir: number | null;
  rank_ic: number | null;
  rank_icir: number | null;
  sharpe: number | null;
  max_drawdown: number | null;
  symbols_validated: string | null; // JSON array
  symbol_results: string | null; // JSON
  status: 'active' | 'inactive' | 'testing';
  user_id: string | null;
  mining_task_id: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Input for creating new factor
 */
export interface CreateFactorInput {
  factor_id: string;
  name: string;
  description?: string;
  source?: 'library' | 'mined' | 'custom';
  category: string;
  formula?: string;
  code?: string;
  params?: object | string;
  ic?: number;
  icir?: number;
  rank_ic?: number;
  rank_icir?: number;
  sharpe?: number;
  max_drawdown?: number;
  symbols_validated?: string[] | string;
  symbol_results?: object | string;
  status?: 'active' | 'inactive' | 'testing';
  user_id?: string;
  mining_task_id?: string;
  file_path?: string;
}

/**
 * Input for updating factor
 */
export type UpdateFactorInput = Partial<Omit<CreateFactorInput, 'factor_id'>>;

/**
 * FactorsRepository - Plugin-owned repository for factor data
 *
 * This repository operates on the factor-library plugin's isolated database.
 *
 * See: TICKET_110_PLUGIN_DATABASE_INFRASTRUCTURE.md
 */
export class FactorsRepository {
  constructor(private db: DatabaseManager) {}

  /**
   * Find factor by ID
   */
  findById(id: number): Factor | null {
    const stmt = this.db.prepare<[number]>('SELECT * FROM factors WHERE id = ?');
    const result = stmt.get(id) as Factor | undefined;
    return result || null;
  }

  /**
   * Find factor by factor_id (unique identifier)
   */
  findByFactorId(factorId: string): Factor | null {
    const stmt = this.db.prepare<[string]>('SELECT * FROM factors WHERE factor_id = ?');
    const result = stmt.get(factorId) as Factor | undefined;
    return result || null;
  }

  /**
   * Find factors by source
   */
  findBySource(source: 'library' | 'mined' | 'custom', userId?: string): Factor[] {
    let sql = 'SELECT * FROM factors WHERE source = ?';
    const params: unknown[] = [source];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as Factor[];
  }

  /**
   * Find factors by category
   */
  findByCategory(category: string, userId?: string): Factor[] {
    let sql = 'SELECT * FROM factors WHERE category = ?';
    const params: unknown[] = [category];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY ic DESC';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as Factor[];
  }

  /**
   * Find factors for a user
   */
  findByUserId(userId: string): Factor[] {
    const stmt = this.db.prepare<[string]>(
      'SELECT * FROM factors WHERE user_id = ? ORDER BY created_at DESC'
    );
    return stmt.all(userId) as Factor[];
  }

  /**
   * Find top factors by IC
   */
  findTopByIC(limit: number = 10, userId?: string): Factor[] {
    let sql = 'SELECT * FROM factors WHERE ic IS NOT NULL';
    const params: unknown[] = [];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ` ORDER BY ic DESC LIMIT ${limit}`;

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as Factor[];
  }

  /**
   * Find factors validated for a specific symbol
   */
  findBySymbol(symbol: string): Factor[] {
    const stmt = this.db.prepare(`
      SELECT * FROM factors
      WHERE symbols_validated LIKE ?
      ORDER BY ic DESC
    `);
    return stmt.all(`%"${symbol}"%`) as Factor[];
  }

  /**
   * Create new factor
   */
  create(input: CreateFactorInput): Factor {
    const stmt = this.db.prepare(`
      INSERT INTO factors (
        factor_id, name, description, source, category,
        formula, code, params,
        ic, icir, rank_ic, rank_icir, sharpe, max_drawdown,
        symbols_validated, symbol_results,
        status, user_id, mining_task_id, file_path
      ) VALUES (
        @factor_id, @name, @description, @source, @category,
        @formula, @code, @params,
        @ic, @icir, @rank_ic, @rank_icir, @sharpe, @max_drawdown,
        @symbols_validated, @symbol_results,
        @status, @user_id, @mining_task_id, @file_path
      )
    `);

    const params = {
      factor_id: input.factor_id,
      name: input.name,
      description: input.description || null,
      source: input.source || 'custom',
      category: input.category,
      formula: input.formula || null,
      code: input.code || null,
      params: this.serializeJson(input.params),
      ic: input.ic ?? null,
      icir: input.icir ?? null,
      rank_ic: input.rank_ic ?? null,
      rank_icir: input.rank_icir ?? null,
      sharpe: input.sharpe ?? null,
      max_drawdown: input.max_drawdown ?? null,
      symbols_validated: this.serializeJson(input.symbols_validated),
      symbol_results: this.serializeJson(input.symbol_results),
      status: input.status || 'active',
      user_id: input.user_id || null,
      mining_task_id: input.mining_task_id || null,
      file_path: input.file_path || null,
    };

    const result = stmt.run(params);
    const id = result.lastInsertRowid as number;

    const created = this.findById(id);
    if (!created) {
      throw new Error(`Failed to retrieve created factor with ID ${id}`);
    }

    return created;
  }

  /**
   * Update existing factor
   */
  update(id: number, input: UpdateFactorInput): Factor | null {
    const updates: string[] = [];
    const params: Record<string, unknown> = { id };

    if (input.name !== undefined) {
      updates.push('name = @name');
      params.name = input.name;
    }
    if (input.description !== undefined) {
      updates.push('description = @description');
      params.description = input.description;
    }
    if (input.source !== undefined) {
      updates.push('source = @source');
      params.source = input.source;
    }
    if (input.category !== undefined) {
      updates.push('category = @category');
      params.category = input.category;
    }
    if (input.formula !== undefined) {
      updates.push('formula = @formula');
      params.formula = input.formula;
    }
    if (input.code !== undefined) {
      updates.push('code = @code');
      params.code = input.code;
    }
    if (input.params !== undefined) {
      updates.push('params = @params');
      params.params = this.serializeJson(input.params);
    }
    if (input.ic !== undefined) {
      updates.push('ic = @ic');
      params.ic = input.ic;
    }
    if (input.icir !== undefined) {
      updates.push('icir = @icir');
      params.icir = input.icir;
    }
    if (input.rank_ic !== undefined) {
      updates.push('rank_ic = @rank_ic');
      params.rank_ic = input.rank_ic;
    }
    if (input.rank_icir !== undefined) {
      updates.push('rank_icir = @rank_icir');
      params.rank_icir = input.rank_icir;
    }
    if (input.sharpe !== undefined) {
      updates.push('sharpe = @sharpe');
      params.sharpe = input.sharpe;
    }
    if (input.max_drawdown !== undefined) {
      updates.push('max_drawdown = @max_drawdown');
      params.max_drawdown = input.max_drawdown;
    }
    if (input.symbols_validated !== undefined) {
      updates.push('symbols_validated = @symbols_validated');
      params.symbols_validated = this.serializeJson(input.symbols_validated);
    }
    if (input.symbol_results !== undefined) {
      updates.push('symbol_results = @symbol_results');
      params.symbol_results = this.serializeJson(input.symbol_results);
    }
    if (input.status !== undefined) {
      updates.push('status = @status');
      params.status = input.status;
    }
    if (input.file_path !== undefined) {
      updates.push('file_path = @file_path');
      params.file_path = input.file_path;
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    const stmt = this.db.prepare(`
      UPDATE factors
      SET ${updates.join(', ')}
      WHERE id = @id
    `);

    stmt.run(params);
    return this.findById(id);
  }

  /**
   * Delete factor by ID
   */
  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM factors WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Search factors by name or description
   */
  search(query: string, userId?: string): Factor[] {
    let sql = `
      SELECT * FROM factors
      WHERE (name LIKE ? OR description LIKE ?)
    `;
    const likeQuery = `%${query}%`;
    const params: unknown[] = [likeQuery, likeQuery];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY ic DESC';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as Factor[];
  }

  /**
   * Count factors
   */
  count(userId?: string): number {
    let sql = 'SELECT COUNT(*) as count FROM factors';
    const params: unknown[] = [];

    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params) as { count: number } | undefined;
    return result?.count || 0;
  }

  /**
   * Get all factors (with optional limit)
   */
  findAll(limit?: number, offset?: number): Factor[] {
    let sql = 'SELECT * FROM factors ORDER BY created_at DESC';

    if (limit !== undefined) {
      sql += ` LIMIT ${limit}`;
      if (offset !== undefined) {
        sql += ` OFFSET ${offset}`;
      }
    }

    const stmt = this.db.prepare(sql);
    return stmt.all() as Factor[];
  }

  /**
   * Helper: Serialize object/array to JSON string
   */
  private serializeJson(value: object | string[] | string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }
}
