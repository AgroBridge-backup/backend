import SwiftUI

// MARK: - BloquesListView
/// Vista de lista de bloques con búsqueda y filtros
struct BloquesListView: View {
    // MARK: - Properties
    @StateObject private var viewModel = BloquesListViewModel()
    @State private var showingFilters = false
    @State private var showingCreateBloque = false
    @State private var selectedBloque: Bloque?

    var body: some View {
        NavigationView {
            ZStack {
                Color.secondaryBackground
                    .ignoresSafeArea()

                if viewModel.isLoading && viewModel.allBloques.isEmpty {
                    // Loading inicial
                    LoadingView(message: "Cargando bloques...")
                } else if viewModel.filteredBloques.isEmpty && !viewModel.hasActiveFilters {
                    // Empty state (sin bloques)
                    EmptyStateView(
                        icon: "cube.box",
                        title: "No hay bloques",
                        message: "Aún no has creado ningún bloque de trazabilidad. Comienza agregando tu primer bloque.",
                        actionTitle: "Crear Primer Bloque",
                        action: {
                            showingCreateBloque = true
                        }
                    )
                } else if viewModel.filteredBloques.isEmpty && viewModel.hasActiveFilters {
                    // Empty state (sin resultados)
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "Sin resultados",
                        message: "No se encontraron bloques que coincidan con los filtros. Intenta con otros criterios.",
                        actionTitle: "Limpiar Filtros",
                        action: {
                            viewModel.clearFilters()
                        }
                    )
                } else {
                    // Lista de bloques
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            // Header de filtros activos
                            if viewModel.hasActiveFilters {
                                ActiveBloquesFiltersHeader(
                                    resultsCount: viewModel.resultsCount,
                                    certificadosCount: viewModel.certificadosCount,
                                    onClear: {
                                        viewModel.clearFilters()
                                    }
                                )
                                .padding(.horizontal)
                            }

                            // Lista de bloques
                            ForEach(viewModel.filteredBloques) { bloque in
                                BloqueCard(bloque: bloque)
                                    .padding(.horizontal)
                                    .onTapGesture {
                                        selectedBloque = bloque
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
            .navigationTitle("Bloques")
            .navigationBarTitleDisplayMode(.large)
            .searchable(
                text: $viewModel.searchText,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Buscar bloques..."
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

                        // Botón crear bloque
                        Button(action: {
                            showingCreateBloque = true
                        }) {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(.agrobridgePrimary)
                        }
                    }
                }
            }
        }
        .task {
            await viewModel.loadBloques()
        }
        .sheet(isPresented: $showingFilters) {
            BloqueFilterSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showingCreateBloque) {
            CreateBloqueView()
        }
        .sheet(item: $selectedBloque) { bloque in
            NavigationView {
                BloqueDetailView(bloque: bloque)
            }
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
            Button("Reintentar") {
                Task {
                    await viewModel.loadBloques()
                }
            }
        } message: {
            Text(viewModel.errorMessage ?? "Ha ocurrido un error cargando los bloques")
        }
    }
}

// MARK: - ActiveBloquesFiltersHeader
struct ActiveBloquesFiltersHeader: View {
    let resultsCount: Int
    let certificadosCount: Int
    let onClear: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: "line.3.horizontal.decrease.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.agrobridgePrimary)

                    Text("\(resultsCount) bloque\(resultsCount == 1 ? "" : "s")")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                }

                if certificadosCount > 0 {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.green)

                        Text("\(certificadosCount) certificado\(certificadosCount == 1 ? "" : "s")")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }
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

// MARK: - BloqueFilterSheet
struct BloqueFilterSheet: View {
    @ObservedObject var viewModel: BloquesListViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            Form {
                // Ordenar por
                Section(header: Text("Ordenar Por")) {
                    ForEach(BloqueSortOption.allCases, id: \.self) { option in
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
                Section(header: Text("Estado del Bloque")) {
                    ForEach([nil] + BloqueEstado.allCases.map { $0 as BloqueEstado? }, id: \.self) { estado in
                        Button(action: {
                            viewModel.selectedEstado = estado
                        }) {
                            HStack {
                                if let estado = estado {
                                    Image(systemName: estado.icon)
                                        .foregroundColor(colorForEstado(estado))
                                        .frame(width: 24)

                                    Text(estado.displayName)
                                        .foregroundColor(.primary)
                                } else {
                                    Text("Todos")
                                        .foregroundColor(.primary)
                                        .padding(.leading, 32)
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

                // Filtro de certificación
                Section(header: Text("Certificación")) {
                    Toggle(isOn: $viewModel.showOnlyCertificados) {
                        HStack {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundColor(.green)
                                .frame(width: 24)

                            Text("Solo Certificados")
                                .foregroundColor(.primary)
                        }
                    }
                    .tint(.agrobridgePrimary)
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

    private func colorForEstado(_ estado: BloqueEstado) -> Color {
        switch estado {
        case .enPreparacion: return .gray
        case .activo: return .blue
        case .enCertificacion: return .orange
        case .certificado: return .green
        case .finalizado: return .purple
        case .rechazado: return .red
        }
    }
}

// MARK: - Preview
struct BloquesListView_Previews: PreviewProvider {
    static var previews: some View {
        BloquesListView()
    }
}
