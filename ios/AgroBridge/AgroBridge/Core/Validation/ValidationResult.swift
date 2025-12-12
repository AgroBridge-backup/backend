//
//  ValidationResult.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: DataValidator.kt (ValidationResult sealed class)
//

import Foundation

/**
 * ValidationResult - Resultado de validación de datos
 *
 * ANDROID EQUIVALENT: sealed class ValidationResult
 *
 * Encapsula el resultado de una validación:
 * - .valid: Validación exitosa
 * - .invalid([errors]): Validación fallida con lista de errores
 */
enum ValidationResult: Equatable {
    case valid
    case invalid([String])

    /// Indica si la validación fue exitosa
    var isValid: Bool {
        if case .valid = self {
            return true
        }
        return false
    }

    /// Lista de errores (vacía si es válido)
    var errors: [String] {
        if case .invalid(let errorList) = self {
            return errorList
        }
        return []
    }

    /// Primer error (conveniente para mostrar en UI)
    var firstError: String? {
        return errors.first
    }
}
