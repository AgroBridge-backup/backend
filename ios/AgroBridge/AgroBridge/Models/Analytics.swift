import Foundation

// MARK: - AnalyticsData
/// Modelo de datos de analytics completo
struct AnalyticsData: Codable {
    let periodo: PeriodoAnalytics
    let resumen: ResumenAnalytics
    let produccion: ProduccionAnalytics
    let calidad: CalidadAnalytics
    let certificacion: CertificacionAnalytics
    let tendencias: TendenciasAnalytics
    let comparativas: ComparativasAnalytics?

    enum CodingKeys: String, CodingKey {
        case periodo
        case resumen
        case produccion
        case calidad
        case certificacion
        case tendencias
        case comparativas
    }
}

// MARK: - PeriodoAnalytics
/// Período de análisis
struct PeriodoAnalytics: Codable {
    let inicio: Date
    let fin: Date
    let tipo: TipoPeriodo

    enum CodingKeys: String, CodingKey {
        case inicio
        case fin
        case tipo
    }
}

enum TipoPeriodo: String, Codable {
    case semanal = "semanal"
    case mensual = "mensual"
    case trimestral = "trimestral"
    case anual = "anual"
    case personalizado = "personalizado"
}

// MARK: - ResumenAnalytics
/// Resumen general de analytics
struct ResumenAnalytics: Codable {
    let totalProductores: Int
    let productoresActivos: Int
    let totalLotes: Int
    let lotesActivos: Int
    let totalBloques: Int
    let bloquesCertificados: Int
    let produccionTotal: Double?
    let areaTotal: Double?

    enum CodingKeys: String, CodingKey {
        case totalProductores = "total_productores"
        case productoresActivos = "productores_activos"
        case totalLotes = "total_lotes"
        case lotesActivos = "lotes_activos"
        case totalBloques = "total_bloques"
        case bloquesCertificados = "bloques_certificados"
        case produccionTotal = "produccion_total"
        case areaTotal = "area_total"
    }
}

// MARK: - ProduccionAnalytics
/// Analytics de producción
struct ProduccionAnalytics: Codable {
    let totalKilos: Double
    let promedioPorLote: Double
    let topCultivos: [CultivoProduccion]
    let distribucionPorMes: [ProduccionMensual]

    enum CodingKeys: String, CodingKey {
        case totalKilos = "total_kilos"
        case promedioPorLote = "promedio_por_lote"
        case topCultivos = "top_cultivos"
        case distribucionPorMes = "distribucion_por_mes"
    }
}

struct CultivoProduccion: Codable, Identifiable {
    var id: String { tipoCultivo }
    let tipoCultivo: String
    let totalKilos: Double
    let porcentaje: Double
    let numeroLotes: Int

    enum CodingKeys: String, CodingKey {
        case tipoCultivo = "tipo_cultivo"
        case totalKilos = "total_kilos"
        case porcentaje
        case numeroLotes = "numero_lotes"
    }
}

struct ProduccionMensual: Codable, Identifiable {
    var id: String { mes }
    let mes: String
    let kilos: Double
    let fecha: Date?

    enum CodingKeys: String, CodingKey {
        case mes
        case kilos
        case fecha
    }
}

// MARK: - CalidadAnalytics
/// Analytics de calidad
struct CalidadAnalytics: Codable {
    let promedioGeneral: Double
    let distribucionCalidad: [RangoCalidad]
    let topLotes: [LoteCalidad]

    enum CodingKeys: String, CodingKey {
        case promedioGeneral = "promedio_general"
        case distribucionCalidad = "distribucion_calidad"
        case topLotes = "top_lotes"
    }
}

struct RangoCalidad: Codable, Identifiable {
    var id: String { rango }
    let rango: String
    let cantidad: Int
    let porcentaje: Double

    enum CodingKeys: String, CodingKey {
        case rango
        case cantidad
        case porcentaje
    }
}

struct LoteCalidad: Codable, Identifiable {
    let id: String
    let nombre: String
    let calidad: Double
    let tipoCultivo: String

    enum CodingKeys: String, CodingKey {
        case id
        case nombre
        case calidad
        case tipoCultivo = "tipo_cultivo"
    }
}

// MARK: - CertificacionAnalytics
/// Analytics de certificación
struct CertificacionAnalytics: Codable {
    let totalCertificados: Int
    let enProceso: Int
    let tasaCertificacion: Double
    let tiposCertificacion: [TipoCertificacion]

    enum CodingKeys: String, CodingKey {
        case totalCertificados = "total_certificados"
        case enProceso = "en_proceso"
        case tasaCertificacion = "tasa_certificacion"
        case tiposCertificacion = "tipos_certificacion"
    }
}

struct TipoCertificacion: Codable, Identifiable {
    var id: String { tipo }
    let tipo: String
    let cantidad: Int

    enum CodingKeys: String, CodingKey {
        case tipo
        case cantidad
    }
}

// MARK: - TendenciasAnalytics
/// Tendencias y proyecciones
struct TendenciasAnalytics: Codable {
    let crecimientoProductores: Double
    let crecimientoLotes: Double
    let crecimientoProduccion: Double
    let proyeccionMensual: [ProyeccionMes]

    enum CodingKeys: String, CodingKey {
        case crecimientoProductores = "crecimiento_productores"
        case crecimientoLotes = "crecimiento_lotes"
        case crecimientoProduccion = "crecimiento_produccion"
        case proyeccionMensual = "proyeccion_mensual"
    }
}

struct ProyeccionMes: Codable, Identifiable {
    var id: String { mes }
    let mes: String
    let proyeccion: Double

    enum CodingKeys: String, CodingKey {
        case mes
        case proyeccion
    }
}

// MARK: - ComparativasAnalytics
/// Análisis comparativos
struct ComparativasAnalytics: Codable {
    let periodoAnterior: ResumenComparativo
    let vsPromedio: ResumenComparativo

    enum CodingKeys: String, CodingKey {
        case periodoAnterior = "periodo_anterior"
        case vsPromedio = "vs_promedio"
    }
}

struct ResumenComparativo: Codable {
    let produccion: Double
    let calidad: Double
    let certificaciones: Double

    enum CodingKeys: String, CodingKey {
        case produccion
        case calidad
        case certificaciones
    }
}

// MARK: - AnalyticsResponse
/// Response del servidor para analytics
struct AnalyticsResponse: Codable {
    let analytics: AnalyticsData
    let generadoEn: Date

    enum CodingKeys: String, CodingKey {
        case analytics
        case generadoEn = "generado_en"
    }
}
