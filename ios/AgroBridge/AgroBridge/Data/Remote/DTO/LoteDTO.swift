//
//  LoteDTO.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: data/dto/LoteDto.kt
//

import Foundation

/**
 * LoteDTO - Data Transfer Object para comunicación con API
 *
 * ANDROID EQUIVALENT: data class LoteDto
 *
 * Separado del modelo de dominio (Lote) y de persistencia (LoteEntity)
 * para mantener desacoplamiento entre capas según Clean Architecture
 *
 * Esta capa:
 * - Se mapea directamente desde/hacia JSON del API
 * - Usa snake_case para CodingKeys (matching API)
 * - Contiene solo datos primitivos + nested DTOs
 * - No contiene lógica de negocio
 */
struct LoteDTO: Codable {
    let id: String
    let nombre: String
    let cultivo: String
    let area: Double
    let estado: String  // String en API, se convierte a enum en Domain
    let productorId: String
    let productor: ProductorDTO?  // Nested DTO (opcional)
    let fechaCreacion: Int64  // Timestamp Unix
    let fechaActualizacion: Int64?
    let coordenadas: [CoordenadaDTO]?
    let centroCampo: CoordenadaDTO?
    let ubicacion: String?
    let bloqueId: String?
    let bloqueNombre: String?
    let metadata: [String: Any]?  // JSON genérico

    enum CodingKeys: String, CodingKey {
        case id
        case nombre
        case cultivo
        case area
        case estado
        case productorId = "productor_id"
        case productor
        case fechaCreacion = "fecha_creacion"
        case fechaActualizacion = "fecha_actualizacion"
        case coordenadas
        case centroCampo = "centro_campo"
        case ubicacion
        case bloqueId = "bloque_id"
        case bloqueNombre = "bloque_nombre"
        case metadata
    }

    // MARK: - Custom Decoding para metadata (Dictionary<String, Any>)

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        nombre = try container.decode(String.self, forKey: .nombre)
        cultivo = try container.decode(String.self, forKey: .cultivo)
        area = try container.decode(Double.self, forKey: .area)
        estado = try container.decode(String.self, forKey: .estado)
        productorId = try container.decode(String.self, forKey: .productorId)
        productor = try container.decodeIfPresent(ProductorDTO.self, forKey: .productor)
        fechaCreacion = try container.decode(Int64.self, forKey: .fechaCreacion)
        fechaActualizacion = try container.decodeIfPresent(Int64.self, forKey: .fechaActualizacion)
        coordenadas = try container.decodeIfPresent([CoordenadaDTO].self, forKey: .coordenadas)
        centroCampo = try container.decodeIfPresent(CoordenadaDTO.self, forKey: .centroCampo)
        ubicacion = try container.decodeIfPresent(String.self, forKey: .ubicacion)
        bloqueId = try container.decodeIfPresent(String.self, forKey: .bloqueId)
        bloqueNombre = try container.decodeIfPresent(String.self, forKey: .bloqueNombre)

        // Decodificar metadata como Dictionary<String, Any>
        if let metadataContainer = try? container.nestedContainer(keyedBy: JSONCodingKeys.self, forKey: .metadata) {
            metadata = try metadataContainer.decode([String: Any].self)
        } else {
            metadata = nil
        }
    }

    // MARK: - Custom Encoding para metadata (Dictionary<String, Any>)

    /**
     * Custom encoder para manejar metadata [String: Any]
     *
     * FIXED: BUG-006 - Added custom encoder to properly encode metadata field
     */
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        try container.encode(id, forKey: .id)
        try container.encode(nombre, forKey: .nombre)
        try container.encode(cultivo, forKey: .cultivo)
        try container.encode(area, forKey: .area)
        try container.encode(estado, forKey: .estado)
        try container.encode(productorId, forKey: .productorId)
        try container.encodeIfPresent(productor, forKey: .productor)
        try container.encode(fechaCreacion, forKey: .fechaCreacion)
        try container.encodeIfPresent(fechaActualizacion, forKey: .fechaActualizacion)
        try container.encodeIfPresent(coordenadas, forKey: .coordenadas)
        try container.encodeIfPresent(centroCampo, forKey: .centroCampo)
        try container.encodeIfPresent(ubicacion, forKey: .ubicacion)
        try container.encodeIfPresent(bloqueId, forKey: .bloqueId)
        try container.encodeIfPresent(bloqueNombre, forKey: .bloqueNombre)

        // Encode metadata as Dictionary<String, Any>
        if let metadata = metadata, !metadata.isEmpty {
            var metadataContainer = container.nestedContainer(keyedBy: JSONCodingKeys.self, forKey: .metadata)
            try metadataContainer.encode(metadata)
        }
    }

    // MARK: - Validation

    /**
     * Valida que el DTO tiene datos mínimos requeridos
     *
     * ANDROID EQUIVALENT: `fun isValid(): Boolean`
     */
    func isValid() -> Bool {
        return !id.trimmingCharacters(in: .whitespaces).isEmpty &&
               !nombre.trimmingCharacters(in: .whitespaces).isEmpty &&
               !cultivo.trimmingCharacters(in: .whitespaces).isEmpty &&
               area > 0 &&
               !estado.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /**
     * Valida coordenadas GPS
     *
     * ANDROID EQUIVALENT: `fun hasValidGPS(): Boolean`
     */
    func hasValidGPS() -> Bool {
        guard let coords = coordenadas, !coords.isEmpty else {
            return false
        }

        return coords.count >= 3 && coords.allSatisfy { $0.isValid() }
    }
}

// MARK: - CoordenadaDTO

/**
 * DTO de Coordenada
 *
 * ANDROID EQUIVALENT: data class CoordenadaDto
 */
struct CoordenadaDTO: Codable {
    let latitud: Double
    let longitud: Double

    /**
     * Valida coordenadas (rango válido)
     *
     * ANDROID EQUIVALENT: `fun isValid(): Boolean`
     */
    func isValid() -> Bool {
        return latitud >= -90.0 && latitud <= 90.0 &&
               longitud >= -180.0 && longitud <= 180.0
    }
}

// MARK: - ProductorDTO

/**
 * DTO de Productor
 *
 * ANDROID EQUIVALENT: data class ProductorDto
 */
struct ProductorDTO: Codable {
    let id: String
    let nombre: String
    let apellido: String?
    let email: String?
    let telefono: String?
    let direccion: String?
    let ciudad: String?
    let estado: String?
    let codigoPostal: String?
    let pais: String?
    let certificaciones: [String]?
    let activo: Bool
    let fechaRegistro: Int64?

    enum CodingKeys: String, CodingKey {
        case id
        case nombre
        case apellido
        case email
        case telefono
        case direccion
        case ciudad
        case estado
        case codigoPostal = "codigo_postal"
        case pais
        case certificaciones
        case activo
        case fechaRegistro = "fecha_registro"
    }

    /**
     * Valida datos mínimos
     *
     * ANDROID EQUIVALENT: `fun isValid(): Boolean`
     */
    func isValid() -> Bool {
        return !id.trimmingCharacters(in: .whitespaces).isEmpty &&
               !nombre.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /**
     * Valida email si existe
     *
     * ANDROID EQUIVALENT: `fun hasValidEmail(): Boolean`
     */
    func hasValidEmail() -> Bool {
        guard let email = email else { return true }

        let emailRegex = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: email)
    }
}

// MARK: - CreateLoteRequest

/**
 * Request para crear/actualizar lote
 *
 * ANDROID EQUIVALENT: data class CreateLoteRequest
 */
struct CreateLoteRequest: Codable {
    let nombre: String
    let cultivo: String
    let area: Double
    let productorId: String
    let coordenadas: [CoordenadaDTO]?
    let ubicacion: String?
    let bloqueId: String?

    enum CodingKeys: String, CodingKey {
        case nombre
        case cultivo
        case area
        case productorId = "productor_id"
        case coordenadas
        case ubicacion
        case bloqueId = "bloque_id"
    }

    /**
     * Valida request
     *
     * ANDROID EQUIVALENT: `fun validate(): ValidationResult`
     */
    func validate() -> ValidationResult {
        var errors: [String] = []

        if nombre.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("Nombre es requerido")
        }

        if cultivo.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("Cultivo es requerido")
        }

        if area <= 0 {
            errors.append("Área debe ser mayor a 0")
        }

        if productorId.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("Productor ID es requerido")
        }

        if let coords = coordenadas {
            if coords.count < 3 {
                errors.append("Se requieren al menos 3 coordenadas para formar un polígono")
            }

            for (index, coord) in coords.enumerated() {
                if !coord.isValid() {
                    errors.append("Coordenada \(index) es inválida")
                }
            }
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }
}

// MARK: - LotesResponse

/**
 * Response del endpoint GET /lotes
 *
 * ANDROID EQUIVALENT: data class LotesResponse
 */
struct LotesResponse: Codable {
    let lotes: [LoteDTO]
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

// MARK: - Helper for decoding [String: Any]

/**
 * Helper para decodificar Dictionary<String, Any> desde JSON
 */
private struct JSONCodingKeys: CodingKey {
    var stringValue: String
    var intValue: Int?

    init?(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }

    init?(intValue: Int) {
        self.stringValue = "\(intValue)"
        self.intValue = intValue
    }
}

extension KeyedDecodingContainer where K == JSONCodingKeys {
    func decode(_ type: [String: Any].Type) throws -> [String: Any] {
        var dictionary = [String: Any]()

        for key in allKeys {
            if let boolValue = try? decode(Bool.self, forKey: key) {
                dictionary[key.stringValue] = boolValue
            } else if let stringValue = try? decode(String.self, forKey: key) {
                dictionary[key.stringValue] = stringValue
            } else if let intValue = try? decode(Int.self, forKey: key) {
                dictionary[key.stringValue] = intValue
            } else if let doubleValue = try? decode(Double.self, forKey: key) {
                dictionary[key.stringValue] = doubleValue
            } else if let nestedDictionary = try? decode([String: Any].self, forKey: key) {
                dictionary[key.stringValue] = nestedDictionary
            } else if let nestedArray = try? decode([Any].self, forKey: key) {
                dictionary[key.stringValue] = nestedArray
            }
        }

        return dictionary
    }

    func decode(_ type: [Any].Type, forKey key: K) throws -> [Any] {
        var container = try nestedUnkeyedContainer(forKey: key)
        return try container.decode([Any].self)
    }
}

extension UnkeyedDecodingContainer {
    mutating func decode(_ type: [Any].Type) throws -> [Any] {
        var array: [Any] = []

        while !isAtEnd {
            if let value = try? decode(Bool.self) {
                array.append(value)
            } else if let value = try? decode(String.self) {
                array.append(value)
            } else if let value = try? decode(Int.self) {
                array.append(value)
            } else if let value = try? decode(Double.self) {
                array.append(value)
            } else if let nestedDictionary = try? decode([String: Any].self) {
                array.append(nestedDictionary)
            } else if let nestedArray = try? decode([Any].self) {
                array.append(nestedArray)
            }
        }

        return array
    }

    mutating func decode(_ type: [String: Any].Type) throws -> [String: Any] {
        let container = try nestedContainer(keyedBy: JSONCodingKeys.self)
        return try container.decode([String: Any].self)
    }
}

// MARK: - Helper for encoding [String: Any]

/**
 * FIXED: BUG-006 - Added encoding helpers for Dictionary<String, Any>
 */
extension KeyedEncodingContainer where K == JSONCodingKeys {
    mutating func encode(_ dictionary: [String: Any]) throws {
        for (key, value) in dictionary {
            let codingKey = JSONCodingKeys(stringValue: key)!

            switch value {
            case let boolValue as Bool:
                try encode(boolValue, forKey: codingKey)
            case let stringValue as String:
                try encode(stringValue, forKey: codingKey)
            case let intValue as Int:
                try encode(intValue, forKey: codingKey)
            case let doubleValue as Double:
                try encode(doubleValue, forKey: codingKey)
            case let nestedDict as [String: Any]:
                var nestedContainer = nestedContainer(keyedBy: JSONCodingKeys.self, forKey: codingKey)
                try nestedContainer.encode(nestedDict)
            case let nestedArray as [Any]:
                var nestedContainer = nestedUnkeyedContainer(forKey: codingKey)
                try nestedContainer.encode(nestedArray)
            default:
                // Skip unsupported types
                continue
            }
        }
    }
}

extension UnkeyedEncodingContainer {
    mutating func encode(_ array: [Any]) throws {
        for value in array {
            switch value {
            case let boolValue as Bool:
                try encode(boolValue)
            case let stringValue as String:
                try encode(stringValue)
            case let intValue as Int:
                try encode(intValue)
            case let doubleValue as Double:
                try encode(doubleValue)
            case let nestedDict as [String: Any]:
                var nestedContainer = nestedContainer(keyedBy: JSONCodingKeys.self)
                try nestedContainer.encode(nestedDict)
            case let nestedArray as [Any]:
                var nestedContainer = nestedUnkeyedContainer()
                try nestedContainer.encode(nestedArray)
            default:
                // Skip unsupported types
                continue
            }
        }
    }
}
