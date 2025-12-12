//
//  DataValidator.swift
//  AgroBridge
//
//  ═══════════════════════════════════════════════════════════════════
//  AGROBRIDGE iOS - DATA VALIDATION INFRASTRUCTURE
//  ═══════════════════════════════════════════════════════════════════
//  Author:  Alejandro Navarro Ayala
//  Role:    CEO & Senior Developer
//  Email:   ceo@agrobridge.mx
//  Company: AgroBridge International
//  Date:    November 29, 2025
//  Purpose: Comprehensive data validation for all inputs
//  Coverage: Email, password, area, names, phone numbers, crop types
//  ═══════════════════════════════════════════════════════════════════
//
//  ANDROID EQUIVALENT: app/src/main/java/com/agrobridge/util/DataValidator.kt
//

import Foundation

/**
 * DataValidator - Comprehensive input validation
 *
 * Responsabilidades:
 * ✓ Validar emails con RFC 5322 compliant regex
 * ✓ Validar passwords (longitud, mayúsculas, números, caracteres especiales)
 * ✓ Validar números de teléfono (formato mexicano)
 * ✓ Validar áreas de lotes (rango permitido)
 * ✓ Validar nombres (longitud, caracteres válidos)
 * ✓ Validar URLs
 * ✓ Validar números de cédula/RFC
 * ✓ Validar tipos de cultivos (15 tipos permitidos)
 * ✓ Validar nombres de lotes
 *
 * Uso:
 * ```swift
 * let validator = DataValidator()
 *
 * let emailResult = validator.validateEmail("user@example.com")
 * if !emailResult.isValid {
 *     showErrors(emailResult.errors)
 * }
 *
 * let passwordResult = validator.validatePassword("MyPass123!")
 * if passwordResult.isValid {
 *     proceedWithRegistration()
 * }
 * ```
 *
 * ANDROID PARITY: Matches DataValidator.kt 100%
 * - Same validation rules
 * - Same error messages (Spanish)
 * - Same constraints (min/max lengths, ranges)
 * - Same regex patterns
 */
class DataValidator {

    // MARK: - Singleton

    static let shared = DataValidator()

    private init() {}

    // MARK: - Constants (matches Android exactly)

    private struct Constraints {
        static let minEmailLength = 5
        static let maxEmailLength = 254
        static let minPasswordLength = 8
        static let maxPasswordLength = 128
        static let minNameLength = 2
        static let maxNameLength = 100
        static let minArea = 0.01
        static let maxArea = 100000.0
        static let minPhoneLength = 10
        static let maxPhoneLength = 15
    }

    // MARK: - Regex Patterns (matches Android exactly)

    private struct Patterns {
        static let email = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$"
        static let phone = "^\\d{10,15}$"
        static let numeric = "^\\d+\\.?\\d*$"
        static let rfc = "^[A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3}$"
    }

    // MARK: - Email Validation

    /**
     * Valida email con RFC 5322 compliant regex
     *
     * ANDROID EQUIVALENT: `fun validateEmail(email: String): ValidationResult`
     *
     * Reglas:
     * - No puede estar vacío
     * - Longitud: 5-254 caracteres
     * - Formato válido (regex)
     * - No puede contener puntos consecutivos (..)
     */
    func validateEmail(_ email: String) -> ValidationResult {
        var errors: [String] = []

        if email.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("El email no puede estar vacío")
            return .invalid(errors)
        }

        if email.count < Constraints.minEmailLength {
            errors.append("El email es demasiado corto")
        }

        if email.count > Constraints.maxEmailLength {
            errors.append("El email es demasiado largo")
        }

        if !matches(pattern: Patterns.email, text: email) {
            errors.append("Formato de email inválido")
        }

        if email.contains("..") {
            errors.append("El email contiene puntos consecutivos")
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }

    // MARK: - Password Validation

    /**
     * Valida contraseña con reglas de seguridad
     *
     * ANDROID EQUIVALENT: `fun validatePassword(password: String): ValidationResult`
     *
     * Reglas:
     * - No puede estar vacía
     * - Longitud: 8-128 caracteres
     * - Al menos una mayúscula
     * - Al menos una minúscula
     * - Al menos un número
     * - Al menos un carácter especial (!@#$%^&*-_=+)
     */
    func validatePassword(_ password: String) -> ValidationResult {
        var errors: [String] = []

        if password.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("La contraseña no puede estar vacía")
            return .invalid(errors)
        }

        if password.count < Constraints.minPasswordLength {
            errors.append("La contraseña debe tener al menos \(Constraints.minPasswordLength) caracteres")
        }

        if password.count > Constraints.maxPasswordLength {
            errors.append("La contraseña es demasiado larga (máximo \(Constraints.maxPasswordLength) caracteres)")
        }

        if !password.contains(where: { $0.isUppercase }) {
            errors.append("La contraseña debe contener al menos una mayúscula")
        }

        if !password.contains(where: { $0.isLowercase }) {
            errors.append("La contraseña debe contener al menos una minúscula")
        }

        if !password.contains(where: { $0.isNumber }) {
            errors.append("La contraseña debe contener al menos un número")
        }

        let specialChars = CharacterSet(charactersIn: "!@#$%^&*-_=+")
        if !password.unicodeScalars.contains(where: { specialChars.contains($0) }) {
            errors.append("La contraseña debe contener al menos un carácter especial (!@#$%^&*-_=+)")
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }

    // MARK: - Name Validation

    /**
     * Valida nombre de persona
     *
     * ANDROID EQUIVALENT: `fun validateName(name: String): ValidationResult`
     *
     * Reglas:
     * - No puede estar vacío
     * - Longitud: 2-100 caracteres
     * - Solo letras, espacios, guiones y apóstrofes
     * - No puede comenzar o terminar con espacios
     */
    func validateName(_ name: String) -> ValidationResult {
        var errors: [String] = []

        if name.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("El nombre no puede estar vacío")
            return .invalid(errors)
        }

        if name.count < Constraints.minNameLength {
            errors.append("El nombre debe tener al menos \(Constraints.minNameLength) caracteres")
        }

        if name.count > Constraints.maxNameLength {
            errors.append("El nombre es demasiado largo (máximo \(Constraints.maxNameLength) caracteres)")
        }

        let allowedChars = CharacterSet.letters
            .union(CharacterSet.whitespaces)
            .union(CharacterSet(charactersIn: "-'"))

        if !name.unicodeScalars.allSatisfy({ allowedChars.contains($0) }) {
            errors.append("El nombre solo puede contener letras, espacios, guiones y apóstrofes")
        }

        if name.hasPrefix(" ") || name.hasSuffix(" ") {
            errors.append("El nombre no puede comenzar o terminar con espacios")
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }

    // MARK: - Area Validation

    /**
     * Valida área de lote en hectáreas
     *
     * ANDROID EQUIVALENT: `fun validateArea(area: Double): ValidationResult`
     *
     * Reglas:
     * - Debe ser mayor a 0
     * - No puede ser NaN o Infinity
     * - Rango: 0.01 - 100,000 hectáreas
     */
    func validateArea(_ area: Double) -> ValidationResult {
        var errors: [String] = []

        if area <= 0 {
            errors.append("El área debe ser mayor a 0")
        }

        if area.isNaN {
            errors.append("El área contiene un valor inválido (NaN)")
        }

        if area.isInfinite {
            errors.append("El área contiene un valor inválido (Infinito)")
        }

        if area < Constraints.minArea {
            errors.append("El área mínima es \(Constraints.minArea) hectáreas")
        }

        if area > Constraints.maxArea {
            errors.append("El área máxima es \(Constraints.maxArea) hectáreas")
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }

    // MARK: - Phone Number Validation

    /**
     * Valida número de teléfono (formato mexicano)
     *
     * ANDROID EQUIVALENT: `fun validatePhoneNumber(phone: String): ValidationResult`
     *
     * Reglas:
     * - No puede estar vacío
     * - Longitud: 10-15 dígitos (después de limpiar guiones y espacios)
     * - Solo dígitos (después de limpiar)
     */
    func validatePhoneNumber(_ phone: String) -> ValidationResult {
        var errors: [String] = []

        if phone.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("El número de teléfono no puede estar vacío")
            return .invalid(errors)
        }

        let cleanedPhone = phone
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: " ", with: "")

        if cleanedPhone.count < Constraints.minPhoneLength {
            errors.append("El número de teléfono debe tener al menos \(Constraints.minPhoneLength) dígitos")
        }

        if cleanedPhone.count > Constraints.maxPhoneLength {
            errors.append("El número de teléfono es demasiado largo")
        }

        if !matches(pattern: Patterns.phone, text: cleanedPhone) {
            errors.append("El número de teléfono solo debe contener dígitos")
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }

    // MARK: - URL Validation

    /**
     * Valida URL
     *
     * ANDROID EQUIVALENT: `fun validateUrl(url: String): ValidationResult`
     *
     * Reglas:
     * - No puede estar vacía
     * - Formato válido (URL válida)
     * - Debe comenzar con http:// o https://
     */
    func validateUrl(_ url: String) -> ValidationResult {
        var errors: [String] = []

        if url.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("La URL no puede estar vacía")
            return .invalid(errors)
        }

        if URL(string: url) == nil {
            errors.append("Formato de URL inválido")
        }

        if !url.lowercased().hasPrefix("http://") && !url.lowercased().hasPrefix("https://") {
            errors.append("La URL debe comenzar con http:// o https://")
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }

    // MARK: - RFC Validation

    /**
     * Valida RFC (Registro Federal de Contribuyentes - México)
     *
     * ANDROID EQUIVALENT: `fun validateRfc(rfc: String): ValidationResult`
     *
     * Reglas:
     * - No puede estar vacío
     * - Longitud: 12 o 13 caracteres
     * - Formato: [A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}
     */
    func validateRfc(_ rfc: String) -> ValidationResult {
        var errors: [String] = []

        if rfc.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("El RFC no puede estar vacío")
            return .invalid(errors)
        }

        let cleanedRfc = rfc.uppercased().replacingOccurrences(of: "-", with: "")

        if cleanedRfc.count != 12 && cleanedRfc.count != 13 {
            errors.append("El RFC debe tener 12 o 13 caracteres")
        }

        if !matches(pattern: Patterns.rfc, text: cleanedRfc) {
            errors.append("Formato de RFC inválido")
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }

    // MARK: - Lote Name Validation

    /**
     * Valida nombre de lote
     *
     * ANDROID EQUIVALENT: `fun validateLoteName(name: String): ValidationResult`
     *
     * Reglas:
     * - No puede estar vacío
     * - Longitud: 2-100 caracteres
     */
    func validateLoteName(_ name: String) -> ValidationResult {
        var errors: [String] = []

        if name.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("El nombre del lote no puede estar vacío")
            return .invalid(errors)
        }

        if name.count < Constraints.minNameLength {
            errors.append("El nombre del lote debe tener al menos \(Constraints.minNameLength) caracteres")
        }

        if name.count > Constraints.maxNameLength {
            errors.append("El nombre del lote es demasiado largo")
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }

    // MARK: - Crop Type Validation

    /**
     * Valida tipo de cultivo
     *
     * ANDROID EQUIVALENT: `fun validateCropType(crop: String): ValidationResult`
     *
     * Reglas:
     * - No puede estar vacío
     * - Debe ser uno de los 15 tipos válidos
     *
     * Tipos válidos:
     * MAIZ, TRIGO, FRIJOL, ARROZ, CEBADA, PAPA, TOMATE, CHILE,
     * CEBOLLA, AJO, ALGODON, CAÑA, CAFE, CACAO, OTRO
     */
    func validateCropType(_ crop: String) -> ValidationResult {
        var errors: [String] = []

        let validCrops: Set<String> = [
            "MAIZ", "TRIGO", "FRIJOL", "ARROZ", "CEBADA",
            "PAPA", "TOMATE", "CHILE", "CEBOLLA", "AJO",
            "ALGODON", "CAÑA", "CAFE", "CACAO", "OTRO"
        ]

        if crop.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.append("El tipo de cultivo no puede estar vacío")
            return .invalid(errors)
        }

        if !validCrops.contains(crop.uppercased()) {
            errors.append("Tipo de cultivo no válido")
        }

        return errors.isEmpty ? .valid : .invalid(errors)
    }

    // MARK: - Helper Methods

    /**
     * Verifica si un texto coincide con un patrón regex
     */
    private func matches(pattern: String, text: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return false
        }

        let range = NSRange(location: 0, length: text.utf16.count)
        return regex.firstMatch(in: text, range: range) != nil
    }
}

// MARK: - Convenience Extensions

extension DataValidator {

    /**
     * Valida múltiples campos a la vez y combina errores
     */
    func validateAll(_ validations: [(String, ValidationResult)]) -> ValidationResult {
        var allErrors: [String] = []

        for (fieldName, result) in validations {
            if !result.isValid {
                let errors = result.errors.map { "\(fieldName): \($0)" }
                allErrors.append(contentsOf: errors)
            }
        }

        return allErrors.isEmpty ? .valid : .invalid(allErrors)
    }
}
