import Foundation
import UIKit
import CoreImage.CIFilterBuiltins

// MARK: - QRCodeGenerator
/// Generador de códigos QR para trazabilidad
class QRCodeGenerator {
    // MARK: - Singleton
    static let shared = QRCodeGenerator()

    private let context = CIContext()
    private let filter = CIFilter.qrCodeGenerator()

    private init() {}

    // MARK: - Public Methods

    /// Genera un código QR a partir de un string
    func generateQRCode(from string: String, size: CGSize = CGSize(width: 300, height: 300)) -> UIImage? {
        // Convertir string a Data
        guard let data = string.data(using: .utf8) else {
            print("❌ Error: No se pudo convertir el string a Data")
            return nil
        }

        // Configurar el filtro
        filter.message = data
        filter.correctionLevel = "H" // High error correction

        // Generar la imagen
        guard let outputImage = filter.outputImage else {
            print("❌ Error: No se pudo generar el código QR")
            return nil
        }

        // Escalar la imagen al tamaño deseado
        let scaleX = size.width / outputImage.extent.size.width
        let scaleY = size.height / outputImage.extent.size.height
        let transformedImage = outputImage.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))

        // Convertir a UIImage
        guard let cgImage = context.createCGImage(transformedImage, from: transformedImage.extent) else {
            print("❌ Error: No se pudo crear CGImage")
            return nil
        }

        return UIImage(cgImage: cgImage)
    }

    /// Genera un código QR para un bloque
    func generateQRCodeForBloque(_ bloque: Bloque, size: CGSize = CGSize(width: 300, height: 300)) -> UIImage? {
        let qrData = QRCodeBloqueData(
            id: bloque.id,
            nombre: bloque.nombre,
            estado: bloque.estado.rawValue,
            certificado: bloque.certificado,
            fechaCreacion: bloque.fechaCreacion.toISOString(),
            blockchainHash: bloque.metadata?.blockchainHash
        )

        guard let jsonData = try? JSONEncoder().encode(qrData),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            print("❌ Error: No se pudo codificar los datos del bloque")
            return nil
        }

        return generateQRCode(from: jsonString, size: size)
    }

    /// Genera un código QR simple con el ID del bloque
    func generateSimpleQRCodeForBloque(_ bloque: Bloque, size: CGSize = CGSize(width: 300, height: 300)) -> UIImage? {
        let urlString = "agrobridge://bloque/\(bloque.id)"
        return generateQRCode(from: urlString, size: size)
    }

    /// Genera un código QR para compartir información del bloque
    func generateShareableQRCode(_ bloque: Bloque, includeDetails: Bool = true, size: CGSize = CGSize(width: 300, height: 300)) -> UIImage? {
        if includeDetails {
            return generateQRCodeForBloque(bloque, size: size)
        } else {
            return generateSimpleQRCodeForBloque(bloque, size: size)
        }
    }
}

// MARK: - QRCodeBloqueData
/// Datos del bloque para codificar en QR
struct QRCodeBloqueData: Codable {
    let id: String
    let nombre: String
    let estado: String
    let certificado: Bool
    let fechaCreacion: String
    let blockchainHash: String?

    enum CodingKeys: String, CodingKey {
        case id
        case nombre
        case estado
        case certificado
        case fechaCreacion = "fecha_creacion"
        case blockchainHash = "blockchain_hash"
    }
}

// MARK: - Date Extension
extension Date {
    func toISOString() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: self)
    }
}
