import Foundation
import Combine

// MARK: - ProductoresListViewModel
/// ViewModel para la lista de productores con búsqueda y filtros
@MainActor
class ProductoresListViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var searchText = "" {
        didSet { applyFilters() }
    }

    @Published var selectedEstado: ProductorEstado? {
        didSet { applyFilters() }
    }

    @Published var sortOption: SortOption = .nombre {
        didSet { applyFilters() }
    }

    @Published private(set) var filteredProductores: [Productor] = []
    @Published private(set) var allProductores: [Productor] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false

    // MARK: - Private Properties
    private let productorService: ProductorService
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties
    var hasActiveFilters: Bool {
        return !searchText.isEmpty || selectedEstado != nil
    }

    var resultsCount: Int {
        return filteredProductores.count
    }

    var totalLotes: Int {
        return filteredProductores.compactMap { $0.totalLotes }.reduce(0, +)
    }

    // MARK: - Inicialización
    init(productorService: ProductorService = .shared) {
        self.productorService = productorService

        // Observar cambios en la lista de productores del servicio
        productorService.$productores
            .sink { [weak self] productores in
                self?.allProductores = productores
                self?.applyFilters()
            }
            .store(in: &cancellables)
    }

    // MARK: - Actions
    /// Carga los productores desde el servidor
    func loadProductores() async {
        guard !isLoading else { return }

        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            try await productorService.fetchProductores()
        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }

    /// Refresca la lista de productores
    func refresh() async {
        await loadProductores()
    }

    /// Aplica los filtros y ordenamiento
    private func applyFilters() {
        var filtered = allProductores

        // Aplicar búsqueda
        if !searchText.isEmpty {
            filtered = filtered.filter { productor in
                productor.nombre.localizedCaseInsensitiveContains(searchText) ||
                (productor.email?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (productor.ubicacion?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }

        // Aplicar filtro de estado
        if let estado = selectedEstado {
            filtered = filtered.filter { $0.estado == estado }
        }

        // Aplicar ordenamiento
        filtered = sortProductores(filtered, by: sortOption)

        filteredProductores = filtered
    }

    /// Ordena los productores según la opción seleccionada
    private func sortProductores(_ productores: [Productor], by option: SortOption) -> [Productor] {
        switch option {
        case .nombre:
            return productores.sorted { $0.nombre < $1.nombre }
        case .fecha:
            return productores.sorted { ($0.fechaRegistro ?? Date.distantPast) > ($1.fechaRegistro ?? Date.distantPast) }
        case .lotes:
            return productores.sorted { ($0.totalLotes ?? 0) > ($1.totalLotes ?? 0) }
        case .estado:
            return productores.sorted { $0.estado.rawValue < $1.estado.rawValue }
        }
    }

    /// Limpia todos los filtros
    func clearFilters() {
        searchText = ""
        selectedEstado = nil
        sortOption = .nombre
    }

    /// Elimina un productor (con índice de la lista filtrada)
    func deleteProductor(at indexSet: IndexSet) async {
        guard let index = indexSet.first else { return }
        let productor = filteredProductores[index]

        isLoading = true
        defer { isLoading = false }

        do {
            try await productorService.deleteProductor(id: productor.id)
        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }
}

// MARK: - SortOption
/// Opciones de ordenamiento para productores
enum SortOption: String, CaseIterable {
    case nombre = "Nombre"
    case fecha = "Fecha de Registro"
    case lotes = "Cantidad de Lotes"
    case estado = "Estado"

    var icon: String {
        switch self {
        case .nombre: return "textformat.abc"
        case .fecha: return "calendar"
        case .lotes: return "map"
        case .estado: return "checkmark.circle"
        }
    }
}
