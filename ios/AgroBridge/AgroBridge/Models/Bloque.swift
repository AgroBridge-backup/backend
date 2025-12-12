import Foundation

// MARK: - Bloque Model
/// Modelo completo de Bloque (agrupación de lotes para trazabilidad)
struct Bloque: Codable, Identifiable {
    let id: String
    let nombre: String
    let descripcion: String?
    let productorId: String?
    let loteIds: [String]?
    let estado: BloqueEstado
    let certificado: Bool
    let fechaCreacion: Date
    let fechaActualizacion: Date?
    let fechaCertificacion: Date?
    let metadata: BloqueMetadata?

    enum CodingKeys: String, CodingKey {
        case id
        case nombre
        case descripcion
        case productorId = "productor_id"
        case loteIds = "lote_ids"
        case estado
        case certificado
        case fechaCreacion = "fecha_creacion"
        case fechaActualizacion = "fecha_actualizacion"
        case fechaCertificacion = "fecha_certificacion"
        case metadata
    }
}

// MARK: - BloqueEstado
/// Estados posibles de un bloque
enum BloqueEstado: String, Codable, CaseIterable {
    case enPreparacion = "en_preparacion"
    case activo = "activo"
    case enCertificacion = "en_certificacion"
    case certificado = "certificado"
    case finalizado = "finalizado"
    case rechazado = "rechazado"

    var displayName: String {
        switch self {
        case .enPreparacion: return "En Preparación"
        case .activo: return "Activo"
        case .enCertificacion: return "En Certificación"
        case .certificado: return "Certificado"
        case .finalizado: return "Finalizado"
        case .rechazado: return "Rechazado"
        }
    }

    var icon: String {
        switch self {
        case .enPreparacion: return "doc.text.fill"
        case .activo: return "checkmark.circle.fill"
        case .enCertificacion: return "hourglass"
        case .certificado: return "checkmark.seal.fill"
        case .finalizado: return "flag.checkered"
        case .rechazado: return "xmark.circle.fill"
        }
    }

    var color: String {
        switch self {
        case .enPreparacion: return "gray"
        case .activo: return "blue"
        case .enCertificacion: return "orange"
        case .certificado: return "green"
        case .finalizado: return "purple"
        case .rechazado: return "red"
        }
    }
}

// MARK: - BloqueMetadata
/// Metadata adicional del bloque
struct BloqueMetadata: Codable {
    let blockchainHash: String?
    let certificaciones: [CertificacionInfo]?
    let auditorias: [AuditoriaInfo]?
    let calidadPromedio: Double?
    let totalKilosProducidos: Double?
    let documentos: [DocumentoInfo]?
    let notas: String?

    enum CodingKeys: String, CodingKey {
        case blockchainHash = "blockchain_hash"
        case certificaciones
        case auditorias
        case calidadPromedio = "calidad_promedio"
        case totalKilosProducidos = "total_kilos_producidos"
        case documentos
        case notas
    }
}

// MARK: - CertificacionInfo
/// Información de certificación del bloque
struct CertificacionInfo: Codable {
    let tipo: String
    let entidadCertificadora: String
    let numeroRegistro: String?
    let fechaEmision: Date?
    let fechaVencimiento: Date?
    let estado: String

    enum CodingKeys: String, CodingKey {
        case tipo
        case entidadCertificadora = "entidad_certificadora"
        case numeroRegistro = "numero_registro"
        case fechaEmision = "fecha_emision"
        case fechaVencimiento = "fecha_vencimiento"
        case estado
    }
}

// MARK: - AuditoriaInfo
/// Información de auditoría del bloque
struct AuditoriaInfo: Codable {
    let id: String
    let fecha: Date
    let auditor: String
    let resultado: String
    let observaciones: String?

    enum CodingKeys: String, CodingKey {
        case id
        case fecha
        case auditor
        case resultado
        case observaciones
    }
}

// MARK: - DocumentoInfo
/// Información de documentos asociados al bloque
struct DocumentoInfo: Codable {
    let id: String
    let nombre: String
    let tipo: String
    let url: String
    let fechaSubida: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case nombre
        case tipo
        case url
        case fechaSubida = "fecha_subida"
    }
}

// MARK: - CreateBloqueRequest
/// Request para crear un nuevo bloque
struct CreateBloqueRequest: Codable {
    let nombre: String
    let descripcion: String?
    let productorId: String?
    let loteIds: [String]?
    let metadata: BloqueMetadata?

    enum CodingKeys: String, CodingKey {
        case nombre
        case descripcion
        case productorId = "productor_id"
        case loteIds = "lote_ids"
        case metadata
    }
}

// MARK: - BloqueResponse
/// Response del servidor al crear/actualizar bloque
struct BloqueResponse: Codable {
    let bloque: Bloque
    let message: String?
}

// MARK: - BloquesListResponse
/// Response del servidor al listar bloques
struct BloquesListResponse: Codable {
    let bloques: [Bloque]
    let total: Int?
    let page: Int?
    let limit: Int?

    enum CodingKeys: String, CodingKey {
        case bloques
        case total
        case page
        case limit
    }
}

// MARK: - BloqueStats
/// Estadísticas de un bloque
struct BloqueStats: Codable {
    let totalLotes: Int
    let totalKilos: Double?
    let calidadPromedio: Double?
    let lotesActivos: Int
    let lotesCertificados: Int

    enum CodingKeys: String, CodingKey {
        case totalLotes = "total_lotes"
        case totalKilos = "total_kilos"
        case calidadPromedio = "calidad_promedio"
        case lotesActivos = "lotes_activos"
        case lotesCertificados = "lotes_certificados"
    }
}
