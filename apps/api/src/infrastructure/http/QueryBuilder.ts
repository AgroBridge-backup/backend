/**
 * @file Query Builder
 * @description Parse and apply query parameters for field selection, filtering, sorting, pagination
 *
 * Supports:
 * - Field selection: ?fields=id,name,producer.businessName
 * - Filtering: ?filter[status]=active&filter[quantity][gte]=100
 * - Sorting: ?sort=-createdAt,name (- prefix = desc)
 * - Pagination: ?page=1&limit=20
 * - Search: ?search=keyword
 * - Includes: ?include=producer,events
 *
 * @author AgroBridge Engineering Team
 */

import logger from "../../shared/utils/logger.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parsed query options
 */
export interface QueryOptions {
  fields?: string[];
  filter?: FilterConditions;
  sort?: SortOption[];
  page: number;
  limit: number;
  search?: string;
  include?: string[];
}

/**
 * Filter conditions with operators
 */
export interface FilterConditions {
  [key: string]: FilterValue | FilterOperator;
}

/**
 * Simple filter value
 */
export type FilterValue = string | number | boolean | null;

/**
 * Filter operators for advanced queries
 */
export interface FilterOperator {
  eq?: FilterValue;
  ne?: FilterValue;
  gt?: number | string;
  gte?: number | string;
  lt?: number | string;
  lte?: number | string;
  in?: FilterValue[];
  nin?: FilterValue[];
  like?: string;
  ilike?: string;
  isNull?: boolean;
}

/**
 * Sort option
 */
export interface SortOption {
  field: string;
  order: "asc" | "desc";
}

/**
 * Prisma query result
 */
export interface PrismaQueryOptions {
  select?: Record<string, boolean | { select: Record<string, boolean> }>;
  where?: Record<string, unknown>;
  orderBy?: Array<Record<string, "asc" | "desc">>;
  skip?: number;
  take?: number;
  include?: Record<string, boolean>;
}

/**
 * Model search field configuration
 */
const SEARCH_FIELDS: Record<string, string[]> = {
  Batch: ["id", "productName", "description", "variety", "origin"],
  Producer: ["businessName", "email", "location", "rfc"],
  Event: ["locationName", "notes"],
  User: ["email", "name"],
  Report: ["name"],
};

/**
 * Allowed filter fields per model (security)
 */
const ALLOWED_FILTER_FIELDS: Record<string, string[]> = {
  Batch: [
    "id",
    "status",
    "producerId",
    "productName",
    "variety",
    "origin",
    "weightKg",
    "harvestDate",
    "createdAt",
    "updatedAt",
    "isVerified",
  ],
  Producer: [
    "id",
    "businessName",
    "email",
    "isWhitelisted",
    "userId",
    "createdAt",
  ],
  Event: ["id", "batchId", "eventType", "timestamp", "isVerified", "createdAt"],
  User: ["id", "email", "role", "isActive", "createdAt"],
  Report: ["id", "type", "format", "status", "userId", "createdAt"],
};

/**
 * Allowed sort fields per model (security)
 */
const ALLOWED_SORT_FIELDS: Record<string, string[]> = {
  Batch: [
    "id",
    "productName",
    "variety",
    "weightKg",
    "harvestDate",
    "status",
    "createdAt",
    "updatedAt",
  ],
  Producer: ["id", "businessName", "email", "createdAt"],
  Event: ["id", "eventType", "timestamp", "createdAt"],
  User: ["id", "email", "name", "role", "createdAt"],
  Report: ["id", "name", "type", "status", "createdAt"],
};

/**
 * Allowed include relations per model (security)
 */
const ALLOWED_INCLUDES: Record<string, string[]> = {
  Batch: ["producer", "events", "createdByUser"],
  Producer: ["user", "batches"],
  Event: ["batch", "createdByUser"],
  User: ["producer", "batches", "subscription"],
  Report: ["user"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY BUILDER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Query Builder
 *
 * Parses REST query parameters and transforms them to Prisma queries.
 * Includes validation and security checks.
 */
export class QueryBuilder {
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;
  private static readonly MIN_LIMIT = 1;

  /**
   * Parse query string into structured QueryOptions
   *
   * @example
   * // Input: ?fields=id,name&filter[status]=active&sort=-createdAt&page=1&limit=20
   * // Output: { fields: ['id', 'name'], filter: { status: { eq: 'active' } }, sort: [{ field: 'createdAt', order: 'desc' }], page: 1, limit: 20 }
   */
  static parse(queryString: Record<string, unknown>): QueryOptions {
    const options: QueryOptions = {
      page: this.DEFAULT_PAGE,
      limit: this.DEFAULT_LIMIT,
    };

    // Parse fields: ?fields=id,name,producer.businessName
    if (queryString.fields && typeof queryString.fields === "string") {
      options.fields = this.parseFields(queryString.fields);
    }

    // Parse filters: ?filter[status]=active&filter[quantity][gte]=100
    if (queryString.filter && typeof queryString.filter === "object") {
      options.filter = this.parseFilters(
        queryString.filter as Record<string, unknown>,
      );
    }

    // Parse sort: ?sort=-createdAt,name (- prefix means desc)
    if (queryString.sort && typeof queryString.sort === "string") {
      options.sort = this.parseSort(queryString.sort);
    }

    // Parse pagination
    if (queryString.page) {
      const page = parseInt(String(queryString.page), 10);
      options.page = isNaN(page) || page < 1 ? this.DEFAULT_PAGE : page;
    }

    if (queryString.limit) {
      const limit = parseInt(String(queryString.limit), 10);
      options.limit = isNaN(limit)
        ? this.DEFAULT_LIMIT
        : Math.min(Math.max(limit, this.MIN_LIMIT), this.MAX_LIMIT);
    }

    // Parse search: ?search=keyword
    if (queryString.search && typeof queryString.search === "string") {
      options.search = queryString.search.trim();
    }

    // Parse includes: ?include=producer,events
    if (queryString.include && typeof queryString.include === "string") {
      options.include = this.parseIncludes(queryString.include);
    }

    return options;
  }

  /**
   * Parse fields string into array
   */
  private static parseFields(fieldsString: string): string[] {
    return fieldsString
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  /**
   * Parse filter object into FilterConditions
   */
  private static parseFilters(
    filterObj: Record<string, unknown>,
  ): FilterConditions {
    const filters: FilterConditions = {};

    Object.entries(filterObj).forEach(([key, value]) => {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Operator filter: { quantity: { gte: 100, lte: 500 } }
        filters[key] = value as FilterOperator;
      } else if (Array.isArray(value)) {
        // Array filter: { status: ['active', 'pending'] }
        filters[key] = { in: value };
      } else {
        // Simple equality: { status: 'active' }
        filters[key] = { eq: value as FilterValue };
      }
    });

    return filters;
  }

  /**
   * Parse sort string into SortOption array
   */
  private static parseSort(sortString: string): SortOption[] {
    return sortString
      .split(",")
      .map((field) => {
        const trimmed = field.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("-")) {
          return { field: trimmed.substring(1), order: "desc" as const };
        }
        return { field: trimmed, order: "asc" as const };
      })
      .filter((s): s is SortOption => s !== null);
  }

  /**
   * Parse includes string into array
   */
  private static parseIncludes(includesString: string): string[] {
    return includesString
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i.length > 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRISMA QUERY BUILDING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Apply query options to Prisma query
   *
   * @param model - Prisma model name (e.g., 'Batch', 'Producer')
   * @param options - Parsed query options
   * @returns Prisma query options
   */
  static applyToPrismaQuery(
    model: string,
    options: QueryOptions,
  ): PrismaQueryOptions {
    const prismaQuery: PrismaQueryOptions = {};

    // Apply field selection (select)
    if (options.fields && options.fields.length > 0) {
      prismaQuery.select = this.buildSelectObject(options.fields);
    }

    // Apply filters (where)
    if (options.filter) {
      prismaQuery.where = this.buildWhereClause(model, options.filter);
    }

    // Apply search
    if (options.search) {
      const searchClause = this.buildSearchClause(model, options.search);
      if (searchClause) {
        prismaQuery.where = {
          ...prismaQuery.where,
          ...searchClause,
        };
      }
    }

    // Apply sorting (orderBy)
    if (options.sort && options.sort.length > 0) {
      prismaQuery.orderBy = this.buildOrderByClause(model, options.sort);
    }

    // Apply pagination (skip, take)
    prismaQuery.skip = (options.page - 1) * options.limit;
    prismaQuery.take = options.limit;

    // Apply includes
    if (options.include && options.include.length > 0) {
      prismaQuery.include = this.buildIncludeObject(model, options.include);
    }

    return prismaQuery;
  }

  /**
   * Build Prisma select object from field list
   *
   * @example
   * // Input: ['id', 'name', 'producer.businessName']
   * // Output: { id: true, name: true, producer: { select: { businessName: true } } }
   */
  private static buildSelectObject(
    fields: string[],
  ): Record<string, boolean | { select: Record<string, boolean> }> {
    const select: Record<
      string,
      boolean | { select: Record<string, boolean> }
    > = {};

    fields.forEach((field) => {
      const parts = field.split(".");

      if (parts.length === 1) {
        // Simple field
        select[parts[0]] = true;
      } else {
        // Nested relation
        const [relation, ...rest] = parts;
        const nestedField = rest.join(".");

        if (!select[relation] || select[relation] === true) {
          select[relation] = { select: {} };
        }

        const relationSelect = select[relation] as {
          select: Record<string, boolean>;
        };

        if (rest.length === 1) {
          relationSelect.select[rest[0]] = true;
        } else {
          // Deep nesting - flatten for now
          relationSelect.select[nestedField] = true;
        }
      }
    });

    return select;
  }

  /**
   * Build Prisma where clause from filters
   */
  private static buildWhereClause(
    model: string,
    filters: FilterConditions,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    const allowedFields = ALLOWED_FILTER_FIELDS[model] || [];

    Object.entries(filters).forEach(([key, value]) => {
      // Security: only allow whitelisted fields
      if (!allowedFields.includes(key)) {
        logger.warn(
          `[QueryBuilder] Blocked filter on non-allowed field: ${key} for model ${model}`,
        );
        return;
      }

      if (this.isFilterOperator(value)) {
        // Operator filter
        const conditions: Record<string, unknown> = {};

        if (value.eq !== undefined)
          conditions.equals = this.parseFilterValue(value.eq);
        if (value.ne !== undefined)
          conditions.not = this.parseFilterValue(value.ne);
        if (value.gt !== undefined)
          conditions.gt = this.parseFilterValue(value.gt);
        if (value.gte !== undefined)
          conditions.gte = this.parseFilterValue(value.gte);
        if (value.lt !== undefined)
          conditions.lt = this.parseFilterValue(value.lt);
        if (value.lte !== undefined)
          conditions.lte = this.parseFilterValue(value.lte);
        if (value.in !== undefined)
          conditions.in = value.in.map(this.parseFilterValue);
        if (value.nin !== undefined)
          conditions.notIn = value.nin.map(this.parseFilterValue);
        if (value.like !== undefined) conditions.contains = value.like;
        if (value.ilike !== undefined) {
          conditions.contains = value.ilike;
          conditions.mode = "insensitive";
        }
        if (value.isNull !== undefined) {
          where[key] = value.isNull ? null : { not: null };
          return;
        }

        where[key] = conditions;
      } else {
        // Simple equality
        where[key] = this.parseFilterValue(value);
      }
    });

    return where;
  }

  /**
   * Check if value is a FilterOperator
   */
  private static isFilterOperator(value: unknown): value is FilterOperator {
    if (typeof value !== "object" || value === null) return false;
    const operatorKeys = [
      "eq",
      "ne",
      "gt",
      "gte",
      "lt",
      "lte",
      "in",
      "nin",
      "like",
      "ilike",
      "isNull",
    ];
    return Object.keys(value).some((key) => operatorKeys.includes(key));
  }

  /**
   * Parse filter value to correct type
   */
  private static parseFilterValue(value: unknown): unknown {
    if (typeof value !== "string") return value;

    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num)) return num;

    // Try to parse as boolean
    if (value === "true") return true;
    if (value === "false") return false;

    // Try to parse as date
    const date = new Date(value);
    if (!isNaN(date.getTime()) && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return date;
    }

    // Return as string
    return value;
  }

  /**
   * Build search clause (OR across multiple fields)
   */
  private static buildSearchClause(
    model: string,
    searchTerm: string,
  ): Record<string, unknown> | null {
    const fields = SEARCH_FIELDS[model];
    if (!fields || fields.length === 0) return null;

    return {
      OR: fields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    };
  }

  /**
   * Build orderBy clause
   */
  private static buildOrderByClause(
    model: string,
    sortOptions: SortOption[],
  ): Array<Record<string, "asc" | "desc">> {
    const allowedFields = ALLOWED_SORT_FIELDS[model] || [];

    return sortOptions
      .filter((s) => {
        if (!allowedFields.includes(s.field)) {
          logger.warn(
            `[QueryBuilder] Blocked sort on non-allowed field: ${s.field} for model ${model}`,
          );
          return false;
        }
        return true;
      })
      .map((s) => ({
        [s.field]: s.order,
      }));
  }

  /**
   * Build include object
   */
  private static buildIncludeObject(
    model: string,
    includes: string[],
  ): Record<string, boolean> {
    const allowedIncludes = ALLOWED_INCLUDES[model] || [];
    const include: Record<string, boolean> = {};

    includes.forEach((rel) => {
      if (!allowedIncludes.includes(rel)) {
        logger.warn(
          `[QueryBuilder] Blocked include on non-allowed relation: ${rel} for model ${model}`,
        );
        return;
      }
      include[rel] = true;
    });

    return include;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Validate query options
   */
  static validate(options: QueryOptions, model: string): string[] {
    const errors: string[] = [];

    // Validate fields
    if (options.fields) {
      const invalidFields = options.fields.filter((f) => {
        const basefield = f.split(".")[0];
        return (
          !ALLOWED_FILTER_FIELDS[model]?.includes(basefield) &&
          !ALLOWED_INCLUDES[model]?.includes(basefield)
        );
      });
      if (invalidFields.length > 0) {
        errors.push(`Invalid fields: ${invalidFields.join(", ")}`);
      }
    }

    // Validate pagination
    if (options.page < 1) {
      errors.push("Page must be >= 1");
    }
    if (options.limit < 1 || options.limit > this.MAX_LIMIT) {
      errors.push(`Limit must be between 1 and ${this.MAX_LIMIT}`);
    }

    return errors;
  }

  /**
   * Get query options summary for logging
   */
  static getSummary(options: QueryOptions): string {
    const parts: string[] = [];

    if (options.fields) parts.push(`fields=${options.fields.length}`);
    if (options.filter)
      parts.push(`filters=${Object.keys(options.filter).length}`);
    if (options.sort) parts.push(`sort=${options.sort.length}`);
    if (options.search) parts.push(`search="${options.search}"`);
    if (options.include) parts.push(`includes=${options.include.length}`);
    parts.push(`page=${options.page}`);
    parts.push(`limit=${options.limit}`);

    return parts.join(", ");
  }
}

export default QueryBuilder;
