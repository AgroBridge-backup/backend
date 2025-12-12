import Foundation
import SwiftUI

// MARK: - Alert Model
struct Alert: Identifiable, Codable {
    let id: String
    let type: AlertType
    let loteId: String
    let loteName: String
    let title: String
    let message: String
    let actionable: Bool
    let priority: Priority
    let timestamp: Date

    enum AlertType: String, Codable {
        case weather = "Clima"
        case pest = "Plaga"
        case harvest = "Cosecha"
        case irrigation = "Riego"
        case certification = "Certificación"

        var icon: String {
            switch self {
            case .weather: return "cloud.rain.fill"
            case .pest: return "ant.fill"
            case .harvest: return "basket.fill"
            case .irrigation: return "drop.fill"
            case .certification: return "checkmark.seal.fill"
            }
        }

        var color: Color {
            switch self {
            case .weather: return .blue
            case .pest: return .red
            case .harvest: return .agroGreen
            case .irrigation: return .cyan
            case .certification: return .purple
            }
        }
    }

    enum Priority: Int, Codable, Comparable {
        case low = 1
        case medium = 2
        case high = 3
        case urgent = 4

        static func < (lhs: Priority, rhs: Priority) -> Bool {
            lhs.rawValue < rhs.rawValue
        }

        var displayName: String {
            switch self {
            case .low: return "Baja"
            case .medium: return "Media"
            case .high: return "Alta"
            case .urgent: return "Urgente"
            }
        }
    }
}

// MARK: - Alert Generator
extension Alert {
    static func generateAlerts(
        for lotes: [Lote],
        weather: WeatherData?
    ) -> [Alert] {
        var alerts: [Alert] = []

        for lote in lotes {
            // Alert de riego basado en clima
            if let weather = weather, weather.humedad < 30 {
                alerts.append(Alert(
                    id: UUID().uuidString,
                    type: .irrigation,
                    loteId: lote.id,
                    loteName: lote.nombre,
                    title: "Riego Necesario",
                    message: "Humedad baja detectada (\(weather.humedad)%). Programar riego para \(lote.nombre)",
                    actionable: true,
                    priority: .urgent,
                    timestamp: Date()
                ))
            }

            // Alert de preparación para lotes inactivos
            if lote.estado == .enPreparacion {
                alerts.append(Alert(
                    id: UUID().uuidString,
                    type: .harvest,
                    loteId: lote.id,
                    loteName: lote.nombre,
                    title: "Lote en Preparación",
                    message: "\(lote.nombre) está siendo preparado. Revisar progreso.",
                    actionable: true,
                    priority: .medium,
                    timestamp: Date()
                ))
            }

            // Alert de cosecha para lotes activos con clima favorable
            if lote.estado == .enCosecha {
                alerts.append(Alert(
                    id: UUID().uuidString,
                    type: .harvest,
                    loteId: lote.id,
                    loteName: lote.nombre,
                    title: "Lote Listo para Cosecha",
                    message: "\(lote.nombre) está en estado de cosecha. Coordinar con equipo.",
                    actionable: true,
                    priority: .high,
                    timestamp: Date()
                ))
            }
        }

        return alerts.sorted { $0.priority > $1.priority }
    }

    // MARK: - Mock Alerts
    static var mockAlerts: [Alert] {
        [
            Alert(
                id: UUID().uuidString,
                type: .irrigation,
                loteId: "lote-001",
                loteName: "Campo Norte",
                title: "Riego Urgente",
                message: "Humedad del suelo baja (22%). Programar riego inmediato.",
                actionable: true,
                priority: .urgent,
                timestamp: Date()
            ),
            Alert(
                id: UUID().uuidString,
                type: .pest,
                loteId: "lote-002",
                loteName: "Campo Sur",
                title: "Posible Plaga Detectada",
                message: "Se detectaron síntomas de tizón temprano. Revisar plantas.",
                actionable: true,
                priority: .high,
                timestamp: Date().addingTimeInterval(-3600)
            ),
            Alert(
                id: UUID().uuidString,
                type: .harvest,
                loteId: "lote-003",
                loteName: "Campo Este",
                title: "Cosecha Programada",
                message: "Lote listo para cosecha en 3 días. Coordinar equipo.",
                actionable: true,
                priority: .medium,
                timestamp: Date().addingTimeInterval(-7200)
            )
        ]
    }
}
