import { GraphQLScalarType, Kind } from 'graphql';
export const DateTimeScalar = new GraphQLScalarType({
    name: 'DateTime',
    description: 'A date-time string in ISO 8601 format',
    serialize(value) {
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'string') {
            return new Date(value).toISOString();
        }
        throw new Error(`DateTime cannot serialize value: ${value}`);
    },
    parseValue(value) {
        if (typeof value === 'string') {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new Error(`DateTime cannot parse value: ${value}`);
            }
            return date;
        }
        if (typeof value === 'number') {
            return new Date(value);
        }
        throw new Error(`DateTime cannot parse value: ${value}`);
    },
    parseLiteral(ast) {
        if (ast.kind === Kind.STRING) {
            const date = new Date(ast.value);
            if (isNaN(date.getTime())) {
                throw new Error(`DateTime cannot parse literal: ${ast.value}`);
            }
            return date;
        }
        if (ast.kind === Kind.INT) {
            return new Date(parseInt(ast.value, 10));
        }
        throw new Error(`DateTime cannot parse literal of kind: ${ast.kind}`);
    },
});
export const JSONScalar = new GraphQLScalarType({
    name: 'JSON',
    description: 'Arbitrary JSON value',
    serialize(value) {
        return value;
    },
    parseValue(value) {
        return value;
    },
    parseLiteral(ast, variables) {
        switch (ast.kind) {
            case Kind.STRING:
                try {
                    return JSON.parse(ast.value);
                }
                catch {
                    return ast.value;
                }
            case Kind.INT:
                return parseInt(ast.value, 10);
            case Kind.FLOAT:
                return parseFloat(ast.value);
            case Kind.BOOLEAN:
                return ast.value;
            case Kind.NULL:
                return null;
            case Kind.LIST:
                return ast.values.map((v) => JSONScalar.parseLiteral(v, variables));
            case Kind.OBJECT:
                const obj = {};
                ast.fields.forEach((field) => {
                    obj[field.name.value] = JSONScalar.parseLiteral(field.value, variables);
                });
                return obj;
            case Kind.VARIABLE:
                return variables ? variables[ast.name.value] : undefined;
            default:
                return undefined;
        }
    },
});
export const DecimalScalar = new GraphQLScalarType({
    name: 'Decimal',
    description: 'A decimal number with arbitrary precision',
    serialize(value) {
        if (typeof value === 'number') {
            return value.toString();
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'object' && value !== null && 'toString' in value) {
            return value.toString();
        }
        throw new Error(`Decimal cannot serialize value: ${value}`);
    },
    parseValue(value) {
        if (typeof value === 'string') {
            const num = parseFloat(value);
            if (isNaN(num)) {
                throw new Error(`Decimal cannot parse value: ${value}`);
            }
            return num;
        }
        if (typeof value === 'number') {
            return value;
        }
        throw new Error(`Decimal cannot parse value: ${value}`);
    },
    parseLiteral(ast) {
        if (ast.kind === Kind.STRING || ast.kind === Kind.FLOAT || ast.kind === Kind.INT) {
            const num = parseFloat(ast.value);
            if (isNaN(num)) {
                throw new Error(`Decimal cannot parse literal: ${ast.value}`);
            }
            return num;
        }
        throw new Error(`Decimal cannot parse literal of kind: ${ast.kind}`);
    },
});
export const scalarResolvers = {
    DateTime: DateTimeScalar,
    JSON: JSONScalar,
    Decimal: DecimalScalar,
};
