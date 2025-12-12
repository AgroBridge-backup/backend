import Foundation

// MARK: - Productor Model
/// Modelo completo de Productor
struct Productor: Codable, Identifiable {
    let id: String
    let nombre: String
    let email: String?
    let telefono: String?
    let direccion: String?
    let ubicacion: String?
    let documentoIdentidad: String?
    let tipoDocumento: TipoDocumento?
    let totalLotes: Int?
    let estado: ProductorEstado
    let fechaRegistro: Date?
    let metadata: ProductorMetadata?

    enum CodingKeys: String, CodingKey {
        case id
        case nombre
        case email
        case telefono
        case direccion
        case ubicacion
        case documentoIdentidad = "documento_identidad"
        case tipoDocumento = "tipo_documento"
        case totalLotes = "total_lotes"
        case estado
        case fechaRegistro = "fecha_registro"
        case metadata
    }
}

// MARK: - ProductorEstado
/// Estados posibles de un productor
enum ProductorEstado: String, Codable, CaseIterable {
    case activo = "activo"
    case inactivo = "inactivo"
    case suspendido = "suspendido"

    var displayName: String {
        switch self {
        case .activo: return "Activo"
        case .inactivo: return "Inactivo"
        case .suspendido: return "Suspendido"
        }
    }

    var icon: String {
        switch self {
        case .activo: return "checkmark.circle.fill"
        case .inactivo: return "pause.circle.fill"
        case .suspendido: return "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - TipoDocumento
/// Tipos de documento de identidad
enum TipoDocumento: String, Codable, CaseIterable {
    case dni = "DNI"
    case pasaporte = "Pasaporte"
    case ruc = "RUC"
    case cedula = "Cedula"

    var displayName: String {
        return self.rawValue
    }
}

// MARK: - ProductorMetadata
/// Metadata adicional del productor
struct ProductorMetadata: Codable {
    let certificaciones: [String]?
    let experienciaAnos: Int?
    let especialidades: [String]?
    let notas: String?
    let avatar: String?  // URL de la foto

    enum CodingKeys: String, CodingKey {
        case certificaciones
        case experienciaAnos = "experiencia_anos"
        case especialidades
        case notas
        case avatar
    }
}

// MARK: - CreateProductorRequest
/// Request para crear un nuevo productor
struct CreateProductorRequest: Codable {
    let nombre: String
    let email: String?
    let telefono: String?
    let direccion: String?
    let ubicacion: String?
    let documentoIdentidad: String?
    let tipoDocumento: TipoDocumento?
    let metadata: ProductorMetadata?

    enum CodingKeys: String, CodingKey {
        case nombre
        case email
        case telefono
        case direccion
        case ubicacion
        case documentoIdentidad = "documento_identidad"
        case tipoDocumento = "tipo_documento"
        case metadata
    }
}

// MARK: - ProductorResponse
/// Response del servidor al crear/actualizar productor
struct ProductorResponse: Codable {
    let productor: Productor
    let message: String?
}

// MARK: - ProductoresListResponse
/// Response del servidor al listar productores
struct ProductoresListResponse: Codable {
    let productores: [Productor]
    let total: Int?
    let page: Int?
    let limit: Int?

    enum CodingKeys: String, CodingKey {
        case productores
        case total
        case page
        case limit
    }
}
