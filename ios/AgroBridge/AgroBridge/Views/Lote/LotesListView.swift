import SwiftUI

// MARK: - LotesListView
/// Vista de lista de lotes con búsqueda y filtros
struct LotesListView: View {
    // MARK: - Properties
    @StateObject private var viewModel = LotesListViewModel()
    @State private var showingFilters = false
    @State private var showingCreateLote = false
    @State private var selectedLote: Lote?
    @State private var showingShareSheet = false
    @State private var csvURL: URL?

    var body: some View {
        NavigationView {
            ZStack {
                Color.secondaryBackground
                    .ignoresSafeArea()

                if viewModel.isLoading && viewModel.allLotes.isEmpty {
                    // Loading inicial
                    LoadingView(message: "Cargando lotes...")
                } else if viewModel.filteredLotes.isEmpty && !viewModel.hasActiveFilters {
                    // Empty state (sin lotes)
                    EmptyStateView(
                        icon: "map",
                        title: "No hay lotes",
                        message: "Aún no has creado ningún lote. Comienza agregando tu primer lote de producción.",
                        actionTitle: "Crear Primer Lote",
                        action: {
                            showingCreateLote = true
                        }
                    )
                } else if viewModel.filteredLotes.isEmpty && viewModel.hasActiveFilters {
                    // Empty state (sin resultados)
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "Sin resultados",
                        message: "No se encontraron lotes que coincidan con los filtros. Intenta con otros criterios.",
                        actionTitle: "Limpiar Filtros",
                        action: {
                            viewModel.clearFilters()
                        }
                    )
                } else {
                    // Lista de lotes
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            // Header de filtros activos
                            if viewModel.hasActiveFilters {
                                ActiveFiltersHeader(
                                    resultsCount: viewModel.resultsCount,
                                    onClear: {
                                        viewModel.clearFilters()
                                    }
                                )
                                .padding(.horizontal)
                            }

                            // Lista de lotes
                            ForEach(viewModel.filteredLotes) { lote in
                                LoteCard(lote: lote)
                                    .padding(.horizontal)
                                    .onTapGesture {
                                        selectedLote = lote
                                    }
                            }
                        }
                        .padding(.vertical)
                    }
                    .refreshable {
                        await viewModel.refresh()
                    }
                }
            }
            .navigationTitle("Lotes")
            .navigationBarTitleDisplayMode(.large)
            .searchable(
                text: $viewModel.searchText,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Buscar lotes..."
            )
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 16) {
                        // Botón de filtros
                        Button(action: {
                            showingFilters = true
                        }) {
                            Image(systemName: viewModel.hasActiveFilters ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                                .foregroundColor(.agrobridgePrimary)
                        }

                        // Menú de opciones
                        Menu {
                            // Exportar CSV
                            Button(action: {
                                exportLotesCSV()
                            }) {
                                Label("Exportar CSV", systemImage: "tablecells")
                            }

                            // Crear lote
                            Button(action: {
                                showingCreateLote = true
                            }) {
                                Label("Crear Lote", systemImage: "plus")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle.fill")
                                .foregroundColor(.agrobridgePrimary)
                        }
                    }
                }
            }
        }
        .task {
            await viewModel.loadLotes()
        }
        .sheet(isPresented: $showingFilters) {
            FilterSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showingCreateLote) {
            CreateLoteView()
        }
        .sheet(item: $selectedLote) { lote in
            NavigationView {
                LoteDetailView(lote: lote)
            }
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
            Button("Reintentar") {
                Task {
                    await viewModel.loadLotes()
                }
            }
        } message: {
            Text(viewModel.errorMessage ?? "Ha ocurrido un error cargando los lotes")
        }
        .sheet(isPresented: $showingShareSheet) {
            if let url = csvURL {
                ShareSheet(items: [url])
            }
        }
    }

    // MARK: - Export Functions
    /// Exporta los lotes actuales a CSV y muestra el share sheet
    private func exportLotesCSV() {
        print("📊 Iniciando exportación de lotes a CSV")

        let lotesToExport = viewModel.hasActiveFilters ? viewModel.filteredLotes : viewModel.allLotes

        guard !lotesToExport.isEmpty else {
            print("⚠️ No hay lotes para exportar")
            return
        }

        // Generar CSV
        let csvData = CSVExporter.shared.exportLotes(lotesToExport)

        // Guardar en archivo temporal
        let filename = CSVExporter.shared.generateFilename(prefix: "lotes_agrobridge")
        csvURL = CSVExporter.shared.saveCsvToFile(csvData, filename: filename)

        // Mostrar share sheet
        showingShareSheet = true
    }
}

// MARK: - Share Sheet
/// Componente para compartir archivos usando UIActivityViewController
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {
        // No updates needed
    }
}

// MARK: - ActiveFiltersHeader
struct ActiveFiltersHeader: View {
    let resultsCount: Int
    let onClear: () -> Void

    var body: some View {
        HStack {
            HStack(spacing: 6) {
                Image(systemName: "line.3.horizontal.decrease.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.agrobridgePrimary)

                Text("\(resultsCount) resultado\(resultsCount == 1 ? "" : "s")")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: onClear) {
                Text("Limpiar")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.agrobridgePrimary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.agrobridgePrimary.opacity(0.1))
        .cornerRadius(10)
    }
}

// MARK: - FilterSheet
struct FilterSheet: View {
    @ObservedObject var viewModel: LotesListViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            Form {
                // Ordenar por
                Section(header: Text("Ordenar Por")) {
                    ForEach(SortOption.allCases, id: \.self) { option in
                        Button(action: {
                            viewModel.sortOption = option
                        }) {
                            HStack {
                                Image(systemName: option.icon)
                                    .foregroundColor(.agrobridgePrimary)
                                    .frame(width: 24)

                                Text(option.rawValue)
                                    .foregroundColor(.primary)

                                Spacer()

                                if viewModel.sortOption == option {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.agrobridgePrimary)
                                }
                            }
                        }
                    }
                }

                // Filtrar por Estado
                Section(header: Text("Estado del Lote")) {
                    ForEach([nil] + LoteEstado.allCases.map { $0 as LoteEstado? }, id: \.self) { estado in
                        Button(action: {
                            viewModel.selectedEstado = estado
                        }) {
                            HStack {
                                if let estado = estado {
                                    Circle()
                                        .fill(colorForEstado(estado))
                                        .frame(width: 12, height: 12)

                                    Text(estado.displayName)
                                        .foregroundColor(.primary)
                                } else {
                                    Text("Todos")
                                        .foregroundColor(.primary)
                                }

                                Spacer()

                                if viewModel.selectedEstado == estado {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.agrobridgePrimary)
                                }
                            }
                        }
                    }
                }

                // Filtrar por Tipo de Cultivo
                if !viewModel.availableTiposCultivo.isEmpty {
                    Section(header: Text("Tipo de Cultivo")) {
                        Button(action: {
                            viewModel.selectedTipoCultivo = nil
                        }) {
                            HStack {
                                Text("Todos")
                                    .foregroundColor(.primary)

                                Spacer()

                                if viewModel.selectedTipoCultivo == nil {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.agrobridgePrimary)
                                }
                            }
                        }

                        ForEach(viewModel.availableTiposCultivo, id: \.self) { tipo in
                            Button(action: {
                                viewModel.selectedTipoCultivo = tipo
                            }) {
                                HStack {
                                    Text(tipo)
                                        .foregroundColor(.primary)

                                    Spacer()

                                    if viewModel.selectedTipoCultivo == tipo {
                                        Image(systemName: "checkmark")
                                            .foregroundColor(.agrobridgePrimary)
                                    }
                                }
                            }
                        }
                    }
                }

                // Botones de acción
                Section {
                    Button(action: {
                        viewModel.clearFilters()
                        dismiss()
                    }) {
                        HStack {
                            Spacer()
                            Text("Limpiar Filtros")
                                .foregroundColor(.red)
                            Spacer()
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

    private func colorForEstado(_ estado: LoteEstado) -> Color {
        switch estado {
        case .activo: return .green
        case .inactivo: return .gray
        case .enCosecha: return .orange
        case .cosechado: return .blue
        }
    }
}

// MARK: - Preview
struct LotesListView_Previews: PreviewProvider {
    static var previews: some View {
        LotesListView()
    }
}
