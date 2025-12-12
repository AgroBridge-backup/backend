import Foundation
import UIKit
import Vision
import CoreML

@MainActor
class CropHealthService: ObservableObject {
    static let shared = CropHealthService()

    private init() {}

    // MARK: - Analyze Image
    /// Analiza una imagen para detectar enfermedades en cultivos
    /// Nota: Requiere modelo CoreML PlantDisease.mlmodel en el proyecto
    func analyzeImage(_ image: UIImage) async throws -> DiagnosticResult {
        guard let ciImage = CIImage(image: image) else {
            throw DiagnosticError.invalidImage
        }

        // TODO: Cargar modelo CoreML cuando esté disponible
        // guard let model = try? VNCoreMLModel(for: PlantDisease().model) else {
        //     throw DiagnosticError.modelLoadFailed
        // }

        // Por ahora, retornar resultado simulado para testing
        return DiagnosticResult.mockResult(for: image)
    }
}

// MARK: - Diagnostic Result
struct DiagnosticResult: Identifiable {
    let id = UUID()
    let disease: String
    let confidence: Double
    let allPredictions: [Prediction]
    let image: UIImage
    let timestamp: Date

    var isHealthy: Bool {
        disease.lowercased().contains("healthy") || disease.lowercased().contains("sano")
    }

    var severity: Severity {
        if isHealthy {
            return .none
        } else if confidence > 0.8 {
            return .high
        } else if confidence > 0.5 {
            return .medium
        } else {
            return .low
        }
    }

    enum Severity: String {
        case none = "Sano"
        case low = "Bajo"
        case medium = "Medio"
        case high = "Alto"

        var color: Color {
            switch self {
            case .none: return .agroGreen
            case .low: return .yellow
            case .medium: return .orange
            case .high: return .red
            }
        }
    }

    // Tratamiento sugerido según la enfermedad detectada
    var treatment: String {
        switch disease.lowercased() {
        case let d where d.contains("early blight") || d.contains("tizón temprano"):
            return "Aplicar fungicida a base de cobre cada 7-10 días. Remover hojas infectadas."
        case let d where d.contains("late blight") || d.contains("tizón tardío"):
            return "Fungicida sistémico urgente. Mejorar drenaje del suelo."
        case let d where d.contains("bacterial") || d.contains("bacteria"):
            return "Aplicar bactericida con cobre. Evitar riego por aspersión."
        case let d where d.contains("virus") || d.contains("mosaico"):
            return "No hay cura. Remover plantas infectadas. Controlar insectos vectores."
        case let d where d.contains("healthy") || d.contains("sano"):
            return "Continuar con manejo preventivo actual. ¡Excelente trabajo!"
        default:
            return "Consultar con agrónomo para tratamiento específico."
        }
    }

    // MARK: - Mock Data para testing
    static func mockResult(for image: UIImage) -> DiagnosticResult {
        let diseases = [
            "Healthy Tomato", "Tomate Early Blight", "Bacterial Spot",
            "Late Blight", "Septoria Leaf Spot", "Mosaic Virus"
        ]

        let selectedDisease = diseases.randomElement() ?? "Healthy Tomato"
        let confidence = Double.random(in: 0.65...0.95)

        return DiagnosticResult(
            disease: selectedDisease,
            confidence: confidence,
            allPredictions: [
                Prediction(label: selectedDisease, confidence: confidence),
                Prediction(label: "Healthy", confidence: 1.0 - confidence),
                Prediction(label: "Other Disease", confidence: 0.05)
            ],
            image: image,
            timestamp: Date()
        )
    }
}

// MARK: - Prediction
struct Prediction: Identifiable {
    let id = UUID()
    let label: String
    let confidence: Double
}

// MARK: - Diagnostic Error
enum DiagnosticError: Error, LocalizedError {
    case invalidImage
    case modelLoadFailed
    case noResults

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "La imagen no es válida"
        case .modelLoadFailed:
            return "Error cargando modelo de IA. Asegúrate de tener PlantDisease.mlmodel en el proyecto."
        case .noResults:
            return "No se detectaron enfermedades"
        }
    }
}

// MARK: - Color Extension
import SwiftUI
extension DiagnosticResult.Severity {
    var color: Color {
        switch self {
        case .none: return .agroGreen
        case .low: return .yellow
        case .medium: return .orange
        case .high: return .red
        }
    }
}
