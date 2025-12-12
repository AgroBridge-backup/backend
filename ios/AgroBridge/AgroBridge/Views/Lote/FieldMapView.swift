import SwiftUI
import MapKit

struct FieldMapView: View {
    @StateObject private var viewModel: FieldMapViewModel
    @State private var selectedLote: Lote?
    @State private var showLoteDetail = false
    @State private var showFilterSheet = false

    init(lotes: [Lote]) {
        _viewModel = StateObject(wrappedValue: FieldMapViewModel(lotes: lotes))
    }

    var body: some View {
        ZStack(alignment: .top) {
            mapView
            headerOverlay
        }
        .ignoresSafeArea(edges: .top)
        .sheet(item: $selectedLote) { lote in
            loteDetailSheet(lote)
        }
        .sheet(isPresented: $showFilterSheet) {
            FilterSheetView(viewModel: viewModel)
        }
        .onChange(of: viewModel.selectedLoteId) { _, newValue in
            handleLoteSelection(newValue)
        }
    }

    // MARK: - Map View
    private var mapView: some View {
        Map(
            position: $viewModel.cameraPosition,
            selection: $viewModel.selectedLoteId
        ) {
            ForEach(viewModel.filteredLotes) { lote in
                if let polygon = lote.polygon {
                    MapPolygon(polygon)
                        .foregroundStyle(lote.estado.mapColor.opacity(0.3))
                        .stroke(lote.estado.mapColor, lineWidth: 2)
                        .tag(lote.id)
                }

                if let centro = lote.centroCampo {
                    Annotation(
                        lote.nombre,
                        coordinate: CLLocationCoordinate2D(
                            latitude: centro.latitud,
                            longitude: centro.longitud
                        )
                    ) {
                        LoteAnnotationView(lote: lote)
                            .onTapGesture {
                                withAnimation(.spring()) {
                                    selectedLote = lote
                                }
                            }
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
    }

    // MARK: - Header Overlay
    private var headerOverlay: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Mapa de Campos")
                    .font(.title2)
                    .fontWeight(.bold)

                Spacer()

                Button {
                    showFilterSheet = true
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                        .font(.title2)
                        .foregroundColor(.agroGreen)
                }
            }
            .padding()
            .background(.ultraThinMaterial)

            // Stats bar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(viewModel.stats, id: \.label) { stat in
                        StatPill(
                            label: stat.label,
                            value: stat.value,
                            color: stat.color
                        )
                    }
                }
                .padding(.horizontal)
            }
            .frame(height: 50)
            .background(.ultraThinMaterial)
        }
    }

    // MARK: - Helper Methods
    private func handleLoteSelection(_ loteId: String?) {
        guard let id = loteId,
              let lote = viewModel.lotes.first(where: { $0.id == id }) else {
            return
        }
        selectedLote = lote
        showLoteDetail = true
    }

    private func loteDetailSheet(_ lote: Lote) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(lote.cultivoEmoji)
                        .font(.system(size: 60))

                    Text(lote.nombre)
                        .font(.title)
                        .fontWeight(.bold)

                    VStack(alignment: .leading, spacing: 8) {
                        DetailRow(label: "Cultivo", value: lote.tipoCultivo)
                        DetailRow(label: "Ubicación", value: lote.ubicacion)
                        if let area = lote.areaHectareas {
                            DetailRow(label: "Área", value: "\(String(format: "%.1f", area)) ha")
                        }
                        DetailRow(label: "Estado", value: lote.estado.displayName)
                    }
                }
                .padding()
            }
            .navigationTitle("Detalle del Lote")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cerrar") {
                        selectedLote = nil
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

// MARK: - Lote Annotation View
struct LoteAnnotationView: View {
    let lote: Lote

    var body: some View {
        VStack(spacing: 4) {
            Text(lote.tipoCultivo.cultivoEmoji)
                .font(.title2)
                .padding(8)
                .background(
                    Circle()
                        .fill(lote.estado.mapColor)
                        .shadow(radius: 2)
                )

            Text(lote.nombre)
                .font(.caption2)
                .fontWeight(.semibold)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.ultraThinMaterial)
                .cornerRadius(8)
        }
    }
}

// MARK: - Filter Sheet
struct FilterSheetView: View {
    @ObservedObject var viewModel: FieldMapViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Filtrar por Estado") {
                    ForEach(LoteEstado.allCases, id: \.self) { estado in
                        Button {
                            viewModel.toggleFilter(estado)
                        } label: {
                            HStack {
                                Circle()
                                    .fill(estado.mapColor)
                                    .frame(width: 12, height: 12)

                                Text(estado.displayName)

                                Spacer()

                                if viewModel.activeFilters.contains(estado) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.agroGreen)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Filtros")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Listo") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Detail Row
struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

#Preview {
    FieldMapView(lotes: Lote.mockLotes)
}
