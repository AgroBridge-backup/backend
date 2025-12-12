import Foundation

// MARK: - CSV Exporter
/// Utilidad para exportar datos a formato CSV
class CSVExporter {

    // MARK: - Singleton
    static let shared = CSVExporter()

    private init() {
        print("📊 CSVExporter inicializado")
    }

    // MARK: - Export Lotes
    /// Exporta una lista de lotes a formato CSV
    /// - Parameter lotes: Array de lotes a exportar
    /// - Returns: Data del CSV generado
    func exportLotes(_ lotes: [Lote]) -> Data {
        print("📊 Exportando \(lotes.count) lotes a CSV")

        // Header del CSV
        var csvString = "ID,Nombre,Ubicación,Tipo de Cultivo,Área (ha),Estado,Fecha Creación,Bloque ID,Bloque Nombre,Productor ID\n"

        // Filas de datos
        for lote in lotes {
            let row = [
                escapeCsvField(lote.id),
                escapeCsvField(lote.nombre),
                escapeCsvField(lote.ubicacion),
                escapeCsvField(lote.tipoCultivo),
                lote.areaHectareas != nil ? String(format: "%.2f", lote.areaHectareas!) : "",
                escapeCsvField(lote.estado.displayName),
                formatDateForCSV(lote.fechaCreacion),
                escapeCsvField(lote.bloqueId ?? ""),
                escapeCsvField(lote.bloqueNombre ?? ""),
                escapeCsvField(lote.productorId)
            ]
            csvString.append(row.joined(separator: ",") + "\n")
        }

        print("✅ CSV de lotes generado: \(csvString.count) caracteres")
        return csvString.data(using: .utf8) ?? Data()
    }

    // MARK: - Export Productores
    /// Exporta una lista de productores a formato CSV
    /// - Parameter productores: Array de productores a exportar
    /// - Returns: Data del CSV generado
    func exportProductores(_ productores: [Productor]) -> Data {
        print("📊 Exportando \(productores.count) productores a CSV")

        // Header del CSV
        var csvString = "ID,Nombre,Email,Teléfono,Dirección,Ubicación,Estado,Total Lotes,Documento,Tipo Documento,Fecha Registro\n"

        // Filas de datos
        for productor in productores {
            let row = [
                escapeCsvField(productor.id),
                escapeCsvField(productor.nombre),
                escapeCsvField(productor.email ?? ""),
                escapeCsvField(productor.telefono ?? ""),
                escapeCsvField(productor.direccion ?? ""),
                escapeCsvField(productor.ubicacion ?? ""),
                escapeCsvField(productor.estado.displayName),
                String(productor.totalLotes ?? 0),
                escapeCsvField(productor.documentoIdentidad ?? ""),
                escapeCsvField(productor.tipoDocumento?.displayName ?? ""),
                productor.fechaRegistro != nil ? formatDateForCSV(productor.fechaRegistro!) : ""
            ]
            csvString.append(row.joined(separator: ",") + "\n")
        }

        print("✅ CSV de productores generado: \(csvString.count) caracteres")
        return csvString.data(using: .utf8) ?? Data()
    }

    // MARK: - Export Bloques
    /// Exporta una lista de bloques a formato CSV
    /// - Parameter bloques: Array de bloques a exportar
    /// - Returns: Data del CSV generado
    func exportBloques(_ bloques: [Bloque]) -> Data {
        print("📊 Exportando \(bloques.count) bloques a CSV")

        // Header del CSV
        var csvString = "ID,Nombre,Descripción,Estado,Certificado,Fecha Creación,Fecha Certificación,Productor ID,Blockchain Hash\n"

        // Filas de datos
        for bloque in bloques {
            let row = [
                escapeCsvField(bloque.id),
                escapeCsvField(bloque.nombre),
                escapeCsvField(bloque.descripcion ?? ""),
                escapeCsvField(bloque.estado.displayName),
                bloque.certificado ? "Sí" : "No",
                formatDateForCSV(bloque.fechaCreacion),
                bloque.fechaCertificacion != nil ? formatDateForCSV(bloque.fechaCertificacion!) : "",
                escapeCsvField(bloque.productorId ?? ""),
                escapeCsvField(bloque.metadata?.blockchainHash ?? "")
            ]
            csvString.append(row.joined(separator: ",") + "\n")
        }

        print("✅ CSV de bloques generado: \(csvString.count) caracteres")
        return csvString.data(using: .utf8) ?? Data()
    }

    // MARK: - Export Dashboard Stats
    /// Exporta estadísticas del dashboard a formato CSV
    /// - Parameter stats: Estadísticas del dashboard
    /// - Returns: Data del CSV generado
    func exportDashboardStats(_ stats: DashboardStats) -> Data {
        print("📊 Exportando estadísticas del dashboard a CSV")

        // Header del CSV
        var csvString = "Métrica,Valor,Última Actualización\n"

        // Filas de datos
        let rows = [
            ["Total Productores", String(stats.totalProductores), formatDateForCSV(stats.ultimaSincronizacion)],
            ["Lotes Activos", String(stats.lotesActivos), formatDateForCSV(stats.ultimaSincronizacion)],
            ["Bloques Certificados", String(stats.bloquesCertificados), formatDateForCSV(stats.ultimaSincronizacion)],
            ["Estado Conexión", stats.estadoConexion == .conectado ? "Conectado" : "Desconectado", formatDateForCSV(Date())]
        ]

        for row in rows {
            csvString.append(row.map { escapeCsvField($0) }.joined(separator: ",") + "\n")
        }

        print("✅ CSV de dashboard generado: \(csvString.count) caracteres")
        return csvString.data(using: .utf8) ?? Data()
    }

    // MARK: - Export Analytics Data
    /// Exporta datos de analytics a formato CSV
    /// - Parameter analytics: Datos de analytics
    /// - Returns: Data del CSV generado
    func exportAnalyticsData(_ analytics: AnalyticsData) -> Data {
        print("📊 Exportando analytics a CSV")

        var csvString = ""

        // SECCIÓN 1: Resumen
        csvString += "=== RESUMEN GENERAL ===\n"
        csvString += "Métrica,Valor\n"
        csvString += "Total Productores,\(analytics.resumen.totalProductores)\n"
        csvString += "Productores Activos,\(analytics.resumen.productoresActivos)\n"
        csvString += "Total Lotes,\(analytics.resumen.totalLotes)\n"
        csvString += "Lotes Activos,\(analytics.resumen.lotesActivos)\n"
        csvString += "Total Bloques,\(analytics.resumen.totalBloques)\n"
        csvString += "Bloques Certificados,\(analytics.resumen.bloquesCertificados)\n"

        if let produccionTotal = analytics.resumen.produccionTotal {
            csvString += "Producción Total (kg),\(String(format: "%.2f", produccionTotal))\n"
        }

        if let areaTotal = analytics.resumen.areaTotal {
            csvString += "Área Total (ha),\(String(format: "%.2f", areaTotal))\n"
        }

        csvString += "\n"

        // SECCIÓN 2: Top Cultivos
        csvString += "=== TOP CULTIVOS ===\n"
        csvString += "Tipo Cultivo,Total Kilos,Porcentaje,Número de Lotes\n"

        for cultivo in analytics.produccion.topCultivos {
            csvString += "\(escapeCsvField(cultivo.tipoCultivo)),\(String(format: "%.2f", cultivo.totalKilos)),\(String(format: "%.1f", cultivo.porcentaje)),\(cultivo.numeroLotes)\n"
        }

        csvString += "\n"

        // SECCIÓN 3: Producción Mensual
        csvString += "=== PRODUCCIÓN MENSUAL ===\n"
        csvString += "Mes,Kilos\n"

        for mes in analytics.produccion.distribucionPorMes {
            csvString += "\(escapeCsvField(mes.mes)),\(String(format: "%.2f", mes.kilos))\n"
        }

        csvString += "\n"

        // SECCIÓN 4: Calidad
        csvString += "=== DISTRIBUCIÓN DE CALIDAD ===\n"
        csvString += "Rango,Cantidad,Porcentaje\n"

        for rango in analytics.calidad.distribucionCalidad {
            csvString += "\(escapeCsvField(rango.rango)),\(rango.cantidad),\(String(format: "%.1f", rango.porcentaje))\n"
        }

        csvString += "\n"

        // SECCIÓN 5: Tendencias
        csvString += "=== TENDENCIAS ===\n"
        csvString += "Indicador,Crecimiento (%)\n"
        csvString += "Productores,\(String(format: "%.2f", analytics.tendencias.crecimientoProductores))\n"
        csvString += "Lotes,\(String(format: "%.2f", analytics.tendencias.crecimientoLotes))\n"
        csvString += "Producción,\(String(format: "%.2f", analytics.tendencias.crecimientoProduccion))\n"

        csvString += "\n"

        print("✅ CSV de analytics generado: \(csvString.count) caracteres")
        return csvString.data(using: .utf8) ?? Data()
    }

    // MARK: - Helper: Escape CSV Field
    /// Escapa campos CSV que contienen comas, comillas o saltos de línea
    /// - Parameter field: Campo a escapar
    /// - Returns: Campo escapado según estándar CSV (RFC 4180)
    private func escapeCsvField(_ field: String) -> String {
        // Si el campo contiene comillas, comas o saltos de línea, debe encerrarse entre comillas
        // y las comillas internas deben duplicarse
        if field.contains(",") || field.contains("\"") || field.contains("\n") || field.contains("\r") {
            let escapedField = field.replacingOccurrences(of: "\"", with: "\"\"")
            return "\"\(escapedField)\""
        }
        return field
    }

    // MARK: - Helper: Format Date for CSV
    /// Formatea fecha para CSV en formato ISO 8601
    /// - Parameter date: Fecha a formatear
    /// - Returns: String con fecha formateada
    private func formatDateForCSV(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    // MARK: - Helper: Format Date Human Readable
    /// Formatea fecha para CSV en formato legible
    /// - Parameter date: Fecha a formatear
    /// - Returns: String con fecha formateada
    private func formatDateReadable(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return formatter.string(from: date)
    }

    // MARK: - Save to File
    /// Guarda el CSV en un archivo temporal y retorna la URL
    /// - Parameters:
    ///   - data: Data del CSV
    ///   - filename: Nombre del archivo (sin extensión)
    /// - Returns: URL del archivo temporal
    func saveCsvToFile(_ data: Data, filename: String) -> URL {
        let tempDirectory = FileManager.default.temporaryDirectory
        let fileURL = tempDirectory.appendingPathComponent("\(filename).csv")

        do {
            try data.write(to: fileURL)
            print("✅ CSV guardado en: \(fileURL.path)")
            return fileURL
        } catch {
            print("❌ Error guardando CSV: \(error.localizedDescription)")
            return fileURL
        }
    }

    // MARK: - Generate Filename
    /// Genera un nombre de archivo con timestamp
    /// - Parameter prefix: Prefijo del nombre
    /// - Returns: Nombre de archivo con timestamp
    func generateFilename(prefix: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd_HHmmss"
        let timestamp = formatter.string(from: Date())
        return "\(prefix)_\(timestamp)"
    }
}
