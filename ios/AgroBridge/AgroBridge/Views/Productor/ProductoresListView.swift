import SwiftUI

// MARK: - ProductoresListView
/// Vista de lista de productores con búsqueda y filtros
struct ProductoresListView: View {
    // MARK: - Properties
    @StateObject private var viewModel = ProductoresListViewModel()
    @State private var showingFilters = false
    @State private var showingCreateProductor = false
    @State private var selectedProductor: Productor?

    var body: some View {
        NavigationView {
            ZStack {
                Color.secondaryBackground
                    .ignoresSafeArea()

                if viewModel.isLoading && viewModel.allProductores.isEmpty {
                    // Loading inicial
                    LoadingView(message: "Cargando productores...")
                } else if viewModel.filteredProductores.isEmpty && !viewModel.hasActiveFilters {
                    // Empty state (sin productores)
                    EmptyStateView(
                        icon: "person.3",
                        title: "No hay productores",
                        message: "Aún no has registrado ningún productor. Comienza agregando tu primer productor.",
                        actionTitle: "Crear Primer Productor",
                        action: {
                            showingCreateProductor = true
                        }
                    )
                } else if viewModel.filteredProductores.isEmpty && viewModel.hasActiveFilters {
                    // Empty state (sin resultados)
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "Sin resultados",
                        message: "No se encontraron productores que coincidan con los filtros. Intenta con otros criterios.",
                        actionTitle: "Limpiar Filtros",
                        action: {
                            viewModel.clearFilters()
                        }
                    )
                } else {
                    // Lista de productores
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            // Header de filtros activos
                            if viewModel.hasActiveFilters {
                                ActiveProductoresFiltersHeader(
                                    resultsCount: viewModel.resultsCount,
                                    totalLotes: viewModel.totalLotes,
                                    onClear: {
                                        viewModel.clearFilters()
                                    }
                                )
                                .padding(.horizontal)
                            }

                            // Lista de productores
                            ForEach(viewModel.filteredProductores) { productor in
                                ProductorCard(productor: productor)
                                    .padding(.horizontal)
                                    .onTapGesture {
                                        selectedProductor = productor
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
            .navigationTitle("Productores")
            .navigationBarTitleDisplayMode(.large)
            .searchable(
                text: $viewModel.searchText,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Buscar productores..."
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

                        // Botón crear productor
                        Button(action: {
                            showingCreateProductor = true
                        }) {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(.agrobridgePrimary)
                        }
                    }
                }
            }
        }
        .task {
            await viewModel.loadProductores()
        }
        .sheet(isPresented: $showingFilters) {
            ProductorFilterSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showingCreateProductor) {
            CreateProductorView()
        }
        .sheet(item: $selectedProductor) { productor in
            NavigationView {
                ProductorDetailView(productor: productor)
            }
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
            Button("Reintentar") {
                Task {
                    await viewModel.loadProductores()
                }
            }
        } message: {
            Text(viewModel.errorMessage ?? "Ha ocurrido un error cargando los productores")
        }
    }
}

// MARK: - ActiveProductoresFiltersHeader
struct ActiveProductoresFiltersHeader: View {
    let resultsCount: Int
    let totalLotes: Int
    let onClear: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: "line.3.horizontal.decrease.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.agrobridgePrimary)

                    Text("\(resultsCount) productor\(resultsCount == 1 ? "" : "es")")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                }

                HStack(spacing: 6) {
                    Image(systemName: "map.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.green)

                    Text("\(totalLotes) lote\(totalLotes == 1 ? "" : "s") en total")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
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

// MARK: - ProductorFilterSheet
struct ProductorFilterSheet: View {
    @ObservedObject var viewModel: ProductoresListViewModel
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
                Section(header: Text("Estado del Productor")) {
                    ForEach([nil] + ProductorEstado.allCases.map { $0 as ProductorEstado? }, id: \.self) { estado in
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

    private func colorForEstado(_ estado: ProductorEstado) -> Color {
        switch estado {
        case .activo: return .green
        case .inactivo: return .gray
        case .suspendido: return .red
        }
    }
}

// MARK: - Preview
struct ProductoresListView_Previews: PreviewProvider {
    static var previews: some View {
        ProductoresListView()
    }
}
