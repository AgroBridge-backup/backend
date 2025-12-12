import Foundation
import CoreLocation
import MapKit
import SwiftUI

// MARK: - Lote Model
/// Modelo que representa un lote de producción agrícola
struct Lote: Codable, Identifiable {
    let id: String
    let nombre: String
    let ubicacion: String
    let tipoCultivo: String
    let areaHectareas: Double?
    let fechaCreacion: Date
    let estado: LoteEstado
    let productorId: String
    let bloqueId: String? // ID del bloque asociado
    let bloqueNombre: String? // Nombre del bloque asociado
    let metadata: LoteMetadata?

    // MARK: - Geolocalización (MapKit)
    /// Coordenadas del polígono que representa el campo
    let coordenadas: [Coordenada]?
    /// Centro del campo para mostrar pin en el mapa
    let centroCampo: Coordenada?

    // MARK: - Computed Properties para MapKit
    /// Región del mapa centrada en este lote
    var region: MKCoordinateRegion? {
        guard let centro = centroCampo else { return nil }
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: centro.latitud,
                longitude: centro.longitud
            ),
            span: MKCoordinateSpan(
                latitudeDelta: 0.01,
                longitudeDelta: 0.01
            )
        )
    }

    /// Polígono de MapKit para dibujar el campo
    var polygon: MKPolygon? {
        guard let coords = coordenadas, !coords.isEmpty else { return nil }
        let locations = coords.map { coord in
            CLLocationCoordinate2D(
                latitude: coord.latitud,
                longitude: coord.longitud
            )
        }
        return MKPolygon(coordinates: locations, count: locations.count)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case nombre
        case ubicacion
        case tipoCultivo = "tipo_cultivo"
        case areaHectareas = "area_hectareas"
        case fechaCreacion = "fecha_creacion"
        case estado
        case productorId = "productor_id"
        case bloqueId = "bloque_id"
        case bloqueNombre = "bloque_nombre"
        case metadata
        case coordenadas
        case centroCampo = "centro_campo"
    }
}

// MARK: - LoteEstado
enum LoteEstado: String, Codable, CaseIterable {
    case activo = "activo"
    case inactivo = "inactivo"
    case enCosecha = "en_cosecha"
    case cosechado = "cosechado"
    case enPreparacion = "en_preparacion"

    var displayName: String {
        switch self {
        case .activo: return "Activo"
        case .inactivo: return "Inactivo"
        case .enCosecha: return "En Cosecha"
        case .cosechado: return "Cosechado"
        case .enPreparacion: return "En Preparación"
        }
    }

    var color: String {
        switch self {
        case .activo: return "green"
        case .inactivo: return "gray"
        case .enCosecha: return "orange"
        case .cosechado: return "blue"
        case .enPreparacion: return "yellow"
        }
    }
}

// MARK: - LoteEstado Extensions para MapKit
extension LoteEstado {
    /// Color para mostrar en el mapa
    var mapColor: Color {
        switch self {
        case .activo:
            return Color.green
        case .enCosecha:
            return Color.orange
        case .cosechado:
            return Color.blue
        case .enPreparacion:
            return Color.yellow
        case .inactivo:
            return Color.gray
        }
    }
}

// MARK: - LoteMetadata
struct LoteMetadata: Codable {
    let coordenadasGPS: CoordenadaGPS?
    let fotos: [String]? // URLs de fotos
    let notas: String?

    enum CodingKeys: String, CodingKey {
        case coordenadasGPS = "coordenadas_gps"
        case fotos
        case notas
    }
}

// MARK: - CoordenadaGPS
struct CoordenadaGPS: Codable {
    let latitud: Double
    let longitud: Double
    let altitud: Double?

    enum CodingKeys: String, CodingKey {
        case latitud
        case longitud
        case altitud
    }
}

// MARK: - CreateLoteRequest
/// Request para endpoint POST /lotes
struct CreateLoteRequest: Codable {
    let nombre: String
    let ubicacion: String
    let tipoCultivo: String
    let areaHectareas: Double?
    let productorId: String?
    let metadata: LoteMetadata?

    enum CodingKeys: String, CodingKey {
        case nombre
        case ubicacion
        case tipoCultivo = "tipo_cultivo"
        case areaHectareas = "area_hectareas"
        case productorId = "productor_id"
        case metadata
    }
}

// MARK: - LotesResponse
/// Response del endpoint GET /lotes
struct LotesResponse: Codable {
    let lotes: [Lote]
    let total: Int
    let pagina: Int?
    let totalPaginas: Int?

    enum CodingKeys: String, CodingKey {
        case lotes
        case total
        case pagina
        case totalPaginas = "total_paginas"
    }
}

// MARK: - String Extension para Emojis de Cultivos
extension String {
    /// Emoji representativo del cultivo
    var cultivoEmoji: String {
        switch self.lowercased() {
        case "aguacate": return "🥑"
        case "tomate": return "🍅"
        case "maíz", "maiz": return "🌽"
        case "fresa": return "🍓"
        case "café", "cafe": return "☕"
        case "cacao": return "🍫"
        case "papa", "patata": return "🥔"
        case "banana", "plátano", "platano": return "🍌"
        case "naranja": return "🍊"
        case "manzana": return "🍎"
        default: return "🌱"
        }
    }
}

// MARK: - Mock Data
extension Lote {
    static var mockLotes: [Lote] {
        [
            Lote(
                id: "lote-001",
                nombre: "Campo Norte",
                ubicacion: "Valle Central, México",
                tipoCultivo: "Aguacate",
                areaHectareas: 12.5,
                fechaCreacion: Date().addingTimeInterval(-86400 * 30), // Hace 30 días
                estado: .activo,
                productorId: "prod-001",
                bloqueId: "blk-001",
                bloqueNombre: "Bloque A",
                metadata: nil,
                coordenadas: [
                    Coordenada(latitud: 19.432608, longitud: -99.133209),
                    Coordenada(latitud: 19.433608, longitud: -99.133209),
                    Coordenada(latitud: 19.433608, longitud: -99.134209),
                    Coordenada(latitud: 19.432608, longitud: -99.134209)
                ],
                centroCampo: Coordenada(latitud: 19.433108, longitud: -99.133709)
            ),
            Lote(
                id: "lote-002",
                nombre: "Campo Sur",
                ubicacion: "Valle Central, México",
                tipoCultivo: "Tomate",
                areaHectareas: 8.3,
                fechaCreacion: Date().addingTimeInterval(-86400 * 60), // Hace 60 días
                estado: .enCosecha,
                productorId: "prod-001",
                bloqueId: "blk-002",
                bloqueNombre: "Bloque B",
                metadata: nil,
                coordenadas: [
                    Coordenada(latitud: 19.431608, longitud: -99.133209),
                    Coordenada(latitud: 19.432608, longitud: -99.133209),
                    Coordenada(latitud: 19.432608, longitud: -99.134209),
                    Coordenada(latitud: 19.431608, longitud: -99.134209)
                ],
                centroCampo: Coordenada(latitud: 19.432108, longitud: -99.133709)
            ),
            Lote(
                id: "lote-003",
                nombre: "Campo Este",
                ubicacion: "Valle Central, México",
                tipoCultivo: "Maíz",
                areaHectareas: 15.7,
                fechaCreacion: Date().addingTimeInterval(-86400 * 15), // Hace 15 días
                estado: .enPreparacion,
                productorId: "prod-002",
                bloqueId: "blk-003",
                bloqueNombre: "Bloque C",
                metadata: nil,
                coordenadas: [
                    Coordenada(latitud: 19.430608, longitud: -99.133209),
                    Coordenada(latitud: 19.431608, longitud: -99.133209),
                    Coordenada(latitud: 19.431608, longitud: -99.134209),
                    Coordenada(latitud: 19.430608, longitud: -99.134209)
                ],
                centroCampo: Coordenada(latitud: 19.431108, longitud: -99.133709)
            )
        ]
    }
}
