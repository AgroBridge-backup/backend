import Foundation
import CoreLocation

// MARK: - Coordenada
/// Modelo simple de coordenadas para MapKit
struct Coordenada: Codable, Hashable {
    let latitud: Double
    let longitud: Double

    init(latitud: Double, longitud: Double) {
        self.latitud = latitud
        self.longitud = longitud
    }

    // Inicializador desde CLLocationCoordinate2D
    init(from coordinate: CLLocationCoordinate2D) {
        self.latitud = coordinate.latitude
        self.longitud = coordinate.longitude
    }
}
