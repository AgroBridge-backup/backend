import logger from '../../shared/utils/logger.js';
const SEARCH_FIELDS = {
    Batch: ['id', 'productName', 'description', 'variety', 'origin'],
    Producer: ['businessName', 'email', 'location', 'rfc'],
    Event: ['locationName', 'notes'],
    User: ['email', 'name'],
    Report: ['name'],
};
const ALLOWED_FILTER_FIELDS = {
    Batch: ['id', 'status', 'producerId', 'productName', 'variety', 'origin', 'weightKg', 'harvestDate', 'createdAt', 'updatedAt', 'isVerified'],
    Producer: ['id', 'businessName', 'email', 'isWhitelisted', 'userId', 'createdAt'],
    Event: ['id', 'batchId', 'eventType', 'timestamp', 'isVerified', 'createdAt'],
    User: ['id', 'email', 'role', 'isActive', 'createdAt'],
    Report: ['id', 'type', 'format', 'status', 'userId', 'createdAt'],
};
const ALLOWED_SORT_FIELDS = {
    Batch: ['id', 'productName', 'variety', 'weightKg', 'harvestDate', 'status', 'createdAt', 'updatedAt'],
    Producer: ['id', 'businessName', 'email', 'createdAt'],
    Event: ['id', 'eventType', 'timestamp', 'createdAt'],
    User: ['id', 'email', 'name', 'role', 'createdAt'],
    Report: ['id', 'name', 'type', 'status', 'createdAt'],
};
const ALLOWED_INCLUDES = {
    Batch: ['producer', 'events', 'createdByUser'],
    Producer: ['user', 'batches'],
    Event: ['batch', 'createdByUser'],
    User: ['producer', 'batches', 'subscription'],
    Report: ['user'],
};
export class QueryBuilder {
    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 20;
    static MAX_LIMIT = 100;
    static MIN_LIMIT = 1;
    static parse(queryString) {
        const options = {
            page: this.DEFAULT_PAGE,
            limit: this.DEFAULT_LIMIT,
        };
        if (queryString.fields && typeof queryString.fields === 'string') {
            options.fields = this.parseFields(queryString.fields);
        }
        if (queryString.filter && typeof queryString.filter === 'object') {
            options.filter = this.parseFilters(queryString.filter);
        }
        if (queryString.sort && typeof queryString.sort === 'string') {
            options.sort = this.parseSort(queryString.sort);
        }
        if (queryString.page) {
            const page = parseInt(String(queryString.page), 10);
            options.page = isNaN(page) || page < 1 ? this.DEFAULT_PAGE : page;
        }
        if (queryString.limit) {
            const limit = parseInt(String(queryString.limit), 10);
            options.limit = isNaN(limit) ? this.DEFAULT_LIMIT :
                Math.min(Math.max(limit, this.MIN_LIMIT), this.MAX_LIMIT);
        }
        if (queryString.search && typeof queryString.search === 'string') {
            options.search = queryString.search.trim();
        }
        if (queryString.include && typeof queryString.include === 'string') {
            options.include = this.parseIncludes(queryString.include);
        }
        return options;
    }
    static parseFields(fieldsString) {
        return fieldsString
            .split(',')
            .map((f) => f.trim())
            .filter((f) => f.length > 0);
    }
    static parseFilters(filterObj) {
        const filters = {};
        Object.entries(filterObj).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                filters[key] = value;
            }
            else if (Array.isArray(value)) {
                filters[key] = { in: value };
            }
            else {
                filters[key] = { eq: value };
            }
        });
        return filters;
    }
    static parseSort(sortString) {
        return sortString
            .split(',')
            .map((field) => {
            const trimmed = field.trim();
            if (!trimmed)
                return null;
            if (trimmed.startsWith('-')) {
                return { field: trimmed.substring(1), order: 'desc' };
            }
            return { field: trimmed, order: 'asc' };
        })
            .filter((s) => s !== null);
    }
    static parseIncludes(includesString) {
        return includesString
            .split(',')
            .map((i) => i.trim())
            .filter((i) => i.length > 0);
    }
    static applyToPrismaQuery(model, options) {
        const prismaQuery = {};
        if (options.fields && options.fields.length > 0) {
            prismaQuery.select = this.buildSelectObject(options.fields);
        }
        if (options.filter) {
            prismaQuery.where = this.buildWhereClause(model, options.filter);
        }
        if (options.search) {
            const searchClause = this.buildSearchClause(model, options.search);
            if (searchClause) {
                prismaQuery.where = {
                    ...prismaQuery.where,
                    ...searchClause,
                };
            }
        }
        if (options.sort && options.sort.length > 0) {
            prismaQuery.orderBy = this.buildOrderByClause(model, options.sort);
        }
        prismaQuery.skip = (options.page - 1) * options.limit;
        prismaQuery.take = options.limit;
        if (options.include && options.include.length > 0) {
            prismaQuery.include = this.buildIncludeObject(model, options.include);
        }
        return prismaQuery;
    }
    static buildSelectObject(fields) {
        const select = {};
        fields.forEach((field) => {
            const parts = field.split('.');
            if (parts.length === 1) {
                select[parts[0]] = true;
            }
            else {
                const [relation, ...rest] = parts;
                const nestedField = rest.join('.');
                if (!select[relation] || select[relation] === true) {
                    select[relation] = { select: {} };
                }
                const relationSelect = select[relation];
                if (rest.length === 1) {
                    relationSelect.select[rest[0]] = true;
                }
                else {
                    relationSelect.select[nestedField] = true;
                }
            }
        });
        return select;
    }
    static buildWhereClause(model, filters) {
        const where = {};
        const allowedFields = ALLOWED_FILTER_FIELDS[model] || [];
        Object.entries(filters).forEach(([key, value]) => {
            if (!allowedFields.includes(key)) {
                logger.warn(`[QueryBuilder] Blocked filter on non-allowed field: ${key} for model ${model}`);
                return;
            }
            if (this.isFilterOperator(value)) {
                const conditions = {};
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
                if (value.like !== undefined)
                    conditions.contains = value.like;
                if (value.ilike !== undefined) {
                    conditions.contains = value.ilike;
                    conditions.mode = 'insensitive';
                }
                if (value.isNull !== undefined) {
                    where[key] = value.isNull ? null : { not: null };
                    return;
                }
                where[key] = conditions;
            }
            else {
                where[key] = this.parseFilterValue(value);
            }
        });
        return where;
    }
    static isFilterOperator(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const operatorKeys = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'like', 'ilike', 'isNull'];
        return Object.keys(value).some((key) => operatorKeys.includes(key));
    }
    static parseFilterValue(value) {
        if (typeof value !== 'string')
            return value;
        const num = Number(value);
        if (!isNaN(num))
            return num;
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        const date = new Date(value);
        if (!isNaN(date.getTime()) && value.match(/^\d{4}-\d{2}-\d{2}/)) {
            return date;
        }
        return value;
    }
    static buildSearchClause(model, searchTerm) {
        const fields = SEARCH_FIELDS[model];
        if (!fields || fields.length === 0)
            return null;
        return {
            OR: fields.map((field) => ({
                [field]: {
                    contains: searchTerm,
                    mode: 'insensitive',
                },
            })),
        };
    }
    static buildOrderByClause(model, sortOptions) {
        const allowedFields = ALLOWED_SORT_FIELDS[model] || [];
        return sortOptions
            .filter((s) => {
            if (!allowedFields.includes(s.field)) {
                logger.warn(`[QueryBuilder] Blocked sort on non-allowed field: ${s.field} for model ${model}`);
                return false;
            }
            return true;
        })
            .map((s) => ({
            [s.field]: s.order,
        }));
    }
    static buildIncludeObject(model, includes) {
        const allowedIncludes = ALLOWED_INCLUDES[model] || [];
        const include = {};
        includes.forEach((rel) => {
            if (!allowedIncludes.includes(rel)) {
                logger.warn(`[QueryBuilder] Blocked include on non-allowed relation: ${rel} for model ${model}`);
                return;
            }
            include[rel] = true;
        });
        return include;
    }
    static validate(options, model) {
        const errors = [];
        if (options.fields) {
            const invalidFields = options.fields.filter((f) => {
                const basefield = f.split('.')[0];
                return !ALLOWED_FILTER_FIELDS[model]?.includes(basefield) &&
                    !ALLOWED_INCLUDES[model]?.includes(basefield);
            });
            if (invalidFields.length > 0) {
                errors.push(`Invalid fields: ${invalidFields.join(', ')}`);
            }
        }
        if (options.page < 1) {
            errors.push('Page must be >= 1');
        }
        if (options.limit < 1 || options.limit > this.MAX_LIMIT) {
            errors.push(`Limit must be between 1 and ${this.MAX_LIMIT}`);
        }
        return errors;
    }
    static getSummary(options) {
        const parts = [];
        if (options.fields)
            parts.push(`fields=${options.fields.length}`);
        if (options.filter)
            parts.push(`filters=${Object.keys(options.filter).length}`);
        if (options.sort)
            parts.push(`sort=${options.sort.length}`);
        if (options.search)
            parts.push(`search="${options.search}"`);
        if (options.include)
            parts.push(`includes=${options.include.length}`);
        parts.push(`page=${options.page}`);
        parts.push(`limit=${options.limit}`);
        return parts.join(', ');
    }
}
export default QueryBuilder;
