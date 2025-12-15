import ExcelJS from 'exceljs';
import logger from '../../../shared/utils/logger.js';
export class ExcelGenerator {
    workbook;
    colors = {
        primary: '2E7D32',
        primaryLight: 'E8F5E9',
        secondary: '1976D2',
        header: '2E7D32',
        headerText: 'FFFFFF',
        alternateRow: 'F5F5F5',
        border: 'E0E0E0',
        success: '4CAF50',
        warning: 'FF9800',
        error: 'F44336',
    };
    constructor() {
        this.workbook = new ExcelJS.Workbook();
    }
    async generate(options) {
        this.workbook.creator = options.author || 'AgroBridge Platform';
        this.workbook.company = options.company || 'AgroBridge';
        this.workbook.created = new Date();
        this.workbook.modified = new Date();
        this.workbook.title = options.title;
        for (const sheetOptions of options.sheets) {
            this.createSheet(sheetOptions);
        }
        const buffer = await this.workbook.xlsx.writeBuffer();
        logger.info('[ExcelGenerator] Excel generated', {
            title: options.title,
            sheets: options.sheets.length,
            size: buffer.byteLength,
        });
        return Buffer.from(buffer);
    }
    async generateBatchReport(data) {
        const summaryData = [
            { metric: 'Total Lotes', value: data.summary.totalBatches },
            { metric: 'Peso Total (kg)', value: data.summary.totalWeight },
            ...Object.entries(data.summary.byVariety).map(([k, v]) => ({
                metric: `Lotes ${k}`,
                value: v,
            })),
            ...Object.entries(data.summary.byStatus).map(([k, v]) => ({
                metric: `Estado: ${k}`,
                value: v,
            })),
        ];
        const batchColumns = [
            { header: 'ID', key: 'id', width: 15 },
            { header: 'Variedad', key: 'variety', width: 12 },
            { header: 'Origen', key: 'origin', width: 20 },
            { header: 'Peso (kg)', key: 'weightKg', width: 12, style: { numFmt: '#,##0.00' } },
            { header: 'Fecha Cosecha', key: 'harvestDate', width: 14, style: { numFmt: 'yyyy-mm-dd' } },
            { header: 'Estado', key: 'status', width: 12 },
            { header: 'Productor', key: 'producerName', width: 25 },
            { header: 'Eventos', key: 'eventCount', width: 10 },
            { header: 'Creado', key: 'createdAt', width: 18, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
        ];
        return this.generate({
            title: 'Reporte de Lotes - AgroBridge',
            sheets: [
                {
                    name: 'Resumen',
                    columns: [
                        { header: 'Metrica', key: 'metric', width: 25 },
                        { header: 'Valor', key: 'value', width: 15 },
                    ],
                    data: summaryData,
                    freezeHeader: true,
                },
                {
                    name: 'Lotes',
                    columns: batchColumns,
                    data: data.batches,
                    freezeHeader: true,
                    autoFilter: true,
                    showTotals: true,
                    totalsColumns: ['weightKg'],
                },
            ],
        });
    }
    async generateEventsReport(data) {
        const eventColumns = [
            { header: 'ID', key: 'id', width: 15 },
            { header: 'Lote', key: 'batchId', width: 15 },
            { header: 'Tipo', key: 'eventType', width: 18 },
            { header: 'Fecha/Hora', key: 'timestamp', width: 18, style: { numFmt: 'yyyy-mm-dd hh:mm:ss' } },
            { header: 'Ubicacion', key: 'locationName', width: 25 },
            { header: 'Temperatura', key: 'temperature', width: 12, style: { numFmt: '0.0"°C"' } },
            { header: 'Humedad', key: 'humidity', width: 12, style: { numFmt: '0.0"%"' } },
            { header: 'Verificado', key: 'isVerified', width: 12, format: (v) => v ? 'Si' : 'No' },
            { header: 'Notas', key: 'notes', width: 40 },
        ];
        const statsData = [
            { metric: 'Total Eventos', value: data.stats.totalEvents },
            { metric: 'Eventos Verificados', value: data.stats.verifiedCount },
            { metric: 'Tasa Verificacion', value: `${((data.stats.verifiedCount / data.stats.totalEvents) * 100).toFixed(1)}%` },
            ...Object.entries(data.stats.byType).map(([k, v]) => ({
                metric: `Tipo: ${k}`,
                value: v,
            })),
        ];
        return this.generate({
            title: 'Reporte de Eventos - AgroBridge',
            sheets: [
                {
                    name: 'Estadisticas',
                    columns: [
                        { header: 'Metrica', key: 'metric', width: 25 },
                        { header: 'Valor', key: 'value', width: 15 },
                    ],
                    data: statsData,
                    freezeHeader: true,
                },
                {
                    name: 'Eventos',
                    columns: eventColumns,
                    data: data.events,
                    freezeHeader: true,
                    autoFilter: true,
                },
            ],
        });
    }
    async generateAuditReport(data) {
        const auditColumns = [
            { header: 'ID', key: 'id', width: 15 },
            { header: 'Fecha/Hora', key: 'timestamp', width: 18, style: { numFmt: 'yyyy-mm-dd hh:mm:ss' } },
            { header: 'Usuario', key: 'userId', width: 15 },
            { header: 'Accion', key: 'action', width: 20 },
            { header: 'Recurso', key: 'resource', width: 15 },
            { header: 'ID Recurso', key: 'resourceId', width: 15 },
            { header: 'Exito', key: 'success', width: 10, format: (v) => v ? 'Si' : 'No' },
            { header: 'IP', key: 'ipAddress', width: 15 },
            { header: 'Duracion (ms)', key: 'durationMs', width: 14 },
        ];
        const summaryData = [
            { metric: 'Total Acciones', value: data.summary.totalActions },
            { metric: 'Usuarios Unicos', value: data.summary.uniqueUsers },
            { metric: 'Acciones Exitosas', value: data.summary.successCount },
            { metric: 'Acciones Fallidas', value: data.summary.failureCount },
            { metric: 'Tasa de Exito', value: `${((data.summary.successCount / data.summary.totalActions) * 100).toFixed(1)}%` },
            ...Object.entries(data.summary.byAction).map(([k, v]) => ({
                metric: k,
                value: v,
            })),
        ];
        return this.generate({
            title: 'Reporte de Auditoria - AgroBridge',
            sheets: [
                {
                    name: 'Resumen',
                    columns: [
                        { header: 'Metrica', key: 'metric', width: 25 },
                        { header: 'Valor', key: 'value', width: 15 },
                    ],
                    data: summaryData,
                    freezeHeader: true,
                },
                {
                    name: 'Registros',
                    columns: auditColumns,
                    data: data.logs,
                    freezeHeader: true,
                    autoFilter: true,
                },
            ],
        });
    }
    async generateAnalyticsReport(data) {
        const metricsData = [
            { metric: 'Periodo', value: `${this.formatDate(data.period.start)} - ${this.formatDate(data.period.end)}` },
            { metric: 'Total Lotes', value: data.metrics.totalBatches },
            { metric: 'Peso Total (kg)', value: data.metrics.totalWeight.toLocaleString() },
            { metric: 'Total Eventos', value: data.metrics.totalEvents },
            { metric: 'Productores Activos', value: data.metrics.totalProducers },
        ];
        const dailyColumns = [
            { header: 'Fecha', key: 'date', width: 14, style: { numFmt: 'yyyy-mm-dd' } },
            { header: 'Lotes', key: 'batches', width: 10 },
            { header: 'Eventos', key: 'events', width: 10 },
            { header: 'Peso (kg)', key: 'weight', width: 12, style: { numFmt: '#,##0.00' } },
        ];
        const producerColumns = [
            { header: 'Productor', key: 'name', width: 30 },
            { header: 'Lotes', key: 'batches', width: 10 },
            { header: 'Peso (kg)', key: 'weight', width: 15, style: { numFmt: '#,##0.00' } },
        ];
        return this.generate({
            title: 'Reporte de Analiticas - AgroBridge',
            sheets: [
                {
                    name: 'Metricas',
                    columns: [
                        { header: 'Metrica', key: 'metric', width: 25 },
                        { header: 'Valor', key: 'value', width: 30 },
                    ],
                    data: metricsData,
                    freezeHeader: true,
                },
                {
                    name: 'Datos Diarios',
                    columns: dailyColumns,
                    data: data.dailyStats,
                    freezeHeader: true,
                    showTotals: true,
                    totalsColumns: ['batches', 'events', 'weight'],
                },
                {
                    name: 'Top Productores',
                    columns: producerColumns,
                    data: data.topProducers,
                    freezeHeader: true,
                },
            ],
        });
    }
    createSheet(options) {
        const sheet = this.workbook.addWorksheet(options.name, {
            views: options.freezeHeader ? [{ state: 'frozen', ySplit: 1 }] : undefined,
        });
        sheet.columns = options.columns.map((col) => ({
            header: col.header,
            key: col.key,
            width: col.width || 15,
            style: col.style,
        }));
        const headerRow = sheet.getRow(1);
        headerRow.font = {
            bold: true,
            color: { argb: this.colors.headerText },
        };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: this.colors.header },
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;
        options.data.forEach((item, index) => {
            const rowData = {};
            options.columns.forEach((col) => {
                let value = item[col.key];
                if (col.format && value !== undefined) {
                    value = col.format(value);
                }
                rowData[col.key] = value;
            });
            const row = sheet.addRow(rowData);
            if (index % 2 === 1) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: this.colors.alternateRow },
                };
            }
            row.alignment = { vertical: 'middle' };
        });
        if (options.autoFilter && options.data.length > 0) {
            sheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: options.data.length + 1, column: options.columns.length },
            };
        }
        if (options.showTotals && options.totalsColumns && options.data.length > 0) {
            const totalsRow = sheet.addRow({});
            totalsRow.font = { bold: true };
            totalsRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: this.colors.primaryLight },
            };
            totalsRow.getCell(1).value = 'TOTAL';
            options.totalsColumns.forEach((colKey) => {
                const colIndex = options.columns.findIndex((c) => c.key === colKey);
                if (colIndex >= 0) {
                    const colLetter = this.getColumnLetter(colIndex + 1);
                    const lastDataRow = options.data.length + 1;
                    totalsRow.getCell(colIndex + 1).value = {
                        formula: `SUM(${colLetter}2:${colLetter}${lastDataRow})`,
                    };
                }
            });
        }
        const lastRow = sheet.rowCount;
        const lastCol = options.columns.length;
        for (let row = 1; row <= lastRow; row++) {
            for (let col = 1; col <= lastCol; col++) {
                const cell = sheet.getCell(row, col);
                cell.border = {
                    top: { style: 'thin', color: { argb: this.colors.border } },
                    left: { style: 'thin', color: { argb: this.colors.border } },
                    bottom: { style: 'thin', color: { argb: this.colors.border } },
                    right: { style: 'thin', color: { argb: this.colors.border } },
                };
            }
        }
    }
    getColumnLetter(col) {
        let letter = '';
        let temp = col;
        while (temp > 0) {
            const mod = (temp - 1) % 26;
            letter = String.fromCharCode(65 + mod) + letter;
            temp = Math.floor((temp - mod) / 26);
        }
        return letter;
    }
    formatDate(date) {
        return new Date(date).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }
}
export function createExcelGenerator() {
    return new ExcelGenerator();
}
