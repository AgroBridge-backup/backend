import Foundation
import MapKit
import SwiftUI

@MainActor
class FieldMapViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var lotes: [Lote]
    @Published var cameraPosition: MapCameraPosition
    @Published var selectedLoteId: String?
    @Published var activeFilters: Set<LoteEstado> = []

    // MARK: - Computed Properties
    var filteredLotes: [Lote] {
        guard !activeFilters.isEmpty else { return lotes }
        return lotes.filter { activeFilters.contains($0.estado) }
    }

    var stats: [(label: String, value: String, color: Color)] {
        let filtered = filteredLotes
        let total = filtered.count
        let activos = filtered.filter { $0.estado == .activo }.count
        let cosecha = filtered.filter { $0.estado == .enCosecha }.count
        let areaTotal = filtered.reduce(0.0) { $0 + ($1.areaHectareas ?? 0) }

        return [
            ("Total", "\(total)", .blue),
            ("Activos", "\(activos)", .agroGreen),
            ("Cosecha", "\(cosecha)", .orange),
            ("Área", String(format: "%.1f ha", areaTotal), .purple)
        ]
    }

    // MARK: - Initialization
    init(lotes: [Lote]) {
        self.lotes = lotes

        // Calcular región inicial
        if let firstLote = lotes.first, let region = firstLote.region {
            self.cameraPosition = .region(region)
        } else {
            // Fallback: México centro
            self.cameraPosition = .region(
                MKCoordinateRegion(
                    center: CLLocationCoordinate2D(
                        latitude: 19.4326,
                        longitude: -99.1332
                    ),
                    span: MKCoordinateSpan(
                        latitudeDelta: 0.5,
                        longitudeDelta: 0.5
                    )
                )
            )
        }
    }

    // MARK: - Public Methods
    func toggleFilter(_ estado: LoteEstado) {
        if activeFilters.contains(estado) {
            activeFilters.remove(estado)
        } else {
            activeFilters.insert(estado)
        }
        applyFilters()
    }

    func clearFilters() {
        activeFilters.removeAll()
        calculateOptimalRegion()
    }

    // MARK: - Private Methods
    private func applyFilters() {
        let filtered = filteredLotes

        guard !filtered.isEmpty else {
            calculateOptimalRegion()
            return
        }

        // Calcular región que muestre todos los lotes filtrados
        let coordinates = filtered.compactMap { $0.centroCampo }

        guard !coordinates.isEmpty else { return }

        let minLat = coordinates.map { $0.latitud }.min() ?? 0
        let maxLat = coordinates.map { $0.latitud }.max() ?? 0
        let minLon = coordinates.map { $0.longitud }.min() ?? 0
        let maxLon = coordinates.map { $0.longitud }.max() ?? 0

        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLon + maxLon) / 2
        )

        let span = MKCoordinateSpan(
            latitudeDelta: max(maxLat - minLat, 0.01) * 1.5,
            longitudeDelta: max(maxLon - minLon, 0.01) * 1.5
        )

        withAnimation {
            cameraPosition = .region(MKCoordinateRegion(center: center, span: span))
        }
    }

    private func calculateOptimalRegion() {
        let coordinates = lotes.compactMap { $0.centroCampo }

        guard !coordinates.isEmpty else { return }

        let minLat = coordinates.map { $0.latitud }.min() ?? 0
        let maxLat = coordinates.map { $0.latitud }.max() ?? 0
        let minLon = coordinates.map { $0.longitud }.min() ?? 0
        let maxLon = coordinates.map { $0.longitud }.max() ?? 0

        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLon + maxLon) / 2
        )

        let span = MKCoordinateSpan(
            latitudeDelta: max(maxLat - minLat, 0.01) * 1.5,
            longitudeDelta: max(maxLon - minLon, 0.01) * 1.5
        )

        cameraPosition = .region(MKCoordinateRegion(center: center, span: span))
    }
}
