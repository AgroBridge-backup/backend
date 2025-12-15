import { stringify } from 'csv-stringify';
import logger from '../../../shared/utils/logger.js';
export class CSVGenerator {
    options;
    constructor(options = {}) {
        this.options = {
            delimiter: ',',
            includeHeaders: true,
            includeBOM: true,
            nullValue: '',
            dateFormat: 'iso',
            customDateFormat: (date) => date.toISOString(),
            ...options,
        };
    }
    async generate(data, columns) {
        return new Promise((resolve, reject) => {
            const rows = [];
            if (this.options.includeHeaders) {
                rows.push(columns.map((col) => col.header));
            }
            for (const item of data) {
                const row = columns.map((col) => {
                    const value = this.getNestedValue(item, col.key);
                    if (col.format) {
                        return col.format(value, item);
                    }
                    return this.formatValue(value);
                });
                rows.push(row);
            }
            stringify(rows, {
                delimiter: this.options.delimiter,
            }, (err, output) => {
                if (err) {
                    logger.error('[CSVGenerator] Failed to generate CSV', { error: err.message });
                    reject(err);
                    return;
                }
                let buffer;
                if (this.options.includeBOM) {
                    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
                    buffer = Buffer.concat([bom, Buffer.from(output, 'utf8')]);
                }
                else {
                    buffer = Buffer.from(output, 'utf8');
                }
                logger.info('[CSVGenerator] CSV generated', {
                    rows: data.length,
                    columns: columns.length,
                    size: buffer.length,
                });
                resolve(buffer);
            });
        });
    }
    async generateBatchExport(data) {
        const columns = [
            { header: 'ID', key: 'id' },
            { header: 'Variedad', key: 'variety' },
            { header: 'Origen', key: 'origin' },
            { header: 'Peso (kg)', key: 'weightKg' },
            { header: 'Fecha Cosecha', key: 'harvestDate', format: (v) => this.formatDate(v) },
            { header: 'Estado', key: 'status' },
            { header: 'Productor', key: 'producerName' },
            { header: 'RFC Productor', key: 'producerRfc' },
            { header: 'Hash Blockchain', key: 'blockchainHash' },
            { header: 'Eventos', key: 'eventCount' },
            { header: 'Creado', key: 'createdAt', format: (v) => this.formatDateTime(v) },
        ];
        return this.generate(data, columns);
    }
    async generateEventExport(data) {
        const columns = [
            { header: 'ID', key: 'id' },
            { header: 'ID Lote', key: 'batchId' },
            { header: 'Tipo Evento', key: 'eventType' },
            { header: 'Fecha/Hora', key: 'timestamp', format: (v) => this.formatDateTime(v) },
            { header: 'Ubicacion', key: 'locationName' },
            { header: 'Latitud', key: 'latitude' },
            { header: 'Longitud', key: 'longitude' },
            { header: 'Temperatura', key: 'temperature', format: (v) => v ? `${v}` : '' },
            { header: 'Humedad', key: 'humidity', format: (v) => v ? `${v}%` : '' },
            { header: 'Notas', key: 'notes' },
            { header: 'Verificado', key: 'isVerified', format: (v) => v ? 'Si' : 'No' },
            { header: 'Creado Por', key: 'createdById' },
        ];
        return this.generate(data, columns);
    }
    async generateAuditExport(data) {
        const columns = [
            { header: 'ID', key: 'id' },
            { header: 'Fecha/Hora', key: 'timestamp', format: (v) => this.formatDateTime(v) },
            { header: 'Usuario', key: 'userId' },
            { header: 'Accion', key: 'action' },
            { header: 'Recurso', key: 'resource' },
            { header: 'ID Recurso', key: 'resourceId' },
            { header: 'Exito', key: 'success', format: (v) => v ? 'Si' : 'No' },
            { header: 'IP', key: 'ipAddress' },
            { header: 'User Agent', key: 'userAgent' },
            { header: 'Duracion (ms)', key: 'durationMs' },
        ];
        return this.generate(data, columns);
    }
    async generateInventoryExport(data) {
        const columns = [
            { header: 'Variedad', key: 'variety' },
            { header: 'Total Lotes', key: 'totalBatches' },
            { header: 'Peso Total (kg)', key: 'totalWeightKg', format: (v) => v.toLocaleString() },
            { header: 'Peso Promedio (kg)', key: 'avgWeightKg', format: (v) => v.toFixed(2) },
            { header: 'En Transito', key: 'inTransit' },
            { header: 'Entregados', key: 'delivered' },
            { header: 'Productores', key: 'producers' },
        ];
        return this.generate(data, columns);
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && typeof current === 'object' ? current[key] : undefined;
        }, obj);
    }
    formatValue(value) {
        if (value === null || value === undefined) {
            return this.options.nullValue;
        }
        if (value instanceof Date) {
            return this.formatDate(value);
        }
        if (typeof value === 'boolean') {
            return value ? 'Si' : 'No';
        }
        if (typeof value === 'number') {
            return value.toString();
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }
    formatDate(date) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            return this.options.nullValue;
        }
        switch (this.options.dateFormat) {
            case 'iso':
                return date.toISOString().split('T')[0];
            case 'locale':
                return date.toLocaleDateString('es-MX');
            case 'custom':
                return this.options.customDateFormat(date);
            default:
                return date.toISOString().split('T')[0];
        }
    }
    formatDateTime(date) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            return this.options.nullValue;
        }
        switch (this.options.dateFormat) {
            case 'iso':
                return date.toISOString();
            case 'locale':
                return date.toLocaleString('es-MX');
            case 'custom':
                return this.options.customDateFormat(date);
            default:
                return date.toISOString();
        }
    }
}
export function createCSVGenerator(options) {
    return new CSVGenerator(options);
}
