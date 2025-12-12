import Foundation
import Combine

// MARK: - LotesListViewModel
/// ViewModel para la lista de lotes con búsqueda y filtros
@MainActor
class LotesListViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published private(set) var allLotes: [Lote] = []
    @Published private(set) var filteredLotes: [Lote] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false

    // MARK: - Search & Filter Properties
    @Published var searchText = "" {
        didSet {
            applyFilters()
        }
    }

    @Published var selectedEstado: LoteEstado? {
        didSet {
            applyFilters()
        }
    }

    @Published var selectedTipoCultivo: String? {
        didSet {
            applyFilters()
        }
    }

    @Published var sortOption: SortOption = .nombre {
        didSet {
            applyFilters()
        }
    }

    // MARK: - Dependencies
    private let loteService: LoteService

    // MARK: - Computed Properties
    /// Lista de tipos de cultivo únicos (para filtro)
    var availableTiposCultivo: [String] {
        let tipos = Set(allLotes.map { $0.tipoCultivo })
        return Array(tipos).sorted()
    }

    /// Indica si hay filtros activos
    var hasActiveFilters: Bool {
        return selectedEstado != nil || selectedTipoCultivo != nil || !searchText.isEmpty
    }

    /// Cuenta de resultados
    var resultsCount: Int {
        return filteredLotes.count
    }

    // MARK: - Inicialización
    init(loteService: LoteService = .shared) {
        self.loteService = loteService
    }

    // MARK: - Actions
    /// Carga todos los lotes
    func loadLotes() async {
        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            try await loteService.fetchLotes()
            allLotes = loteService.lotes
            applyFilters()

        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }

    /// Refresca la lista
    func refresh() async {
        await loadLotes()
    }

    /// Limpia todos los filtros
    func clearFilters() {
        searchText = ""
        selectedEstado = nil
        selectedTipoCultivo = nil
        sortOption = .nombre
    }

    /// Aplica filtros y ordenamiento
    private func applyFilters() {
        var filtered = allLotes

        // Filtro por búsqueda de texto
        if !searchText.isEmpty {
            filtered = filtered.filter { lote in
                lote.nombre.localizedCaseInsensitiveContains(searchText) ||
                lote.ubicacion.localizedCaseInsensitiveContains(searchText) ||
                lote.tipoCultivo.localizedCaseInsensitiveContains(searchText)
            }
        }

        // Filtro por estado
        if let estado = selectedEstado {
            filtered = filtered.filter { $0.estado == estado }
        }

        // Filtro por tipo de cultivo
        if let tipo = selectedTipoCultivo {
            filtered = filtered.filter { $0.tipoCultivo == tipo }
        }

        // Ordenamiento
        filtered = sortLotes(filtered, by: sortOption)

        filteredLotes = filtered
    }

    /// Ordena los lotes según la opción seleccionada
    private func sortLotes(_ lotes: [Lote], by option: SortOption) -> [Lote] {
        switch option {
        case .nombre:
            return lotes.sorted { $0.nombre < $1.nombre }
        case .fechaCreacion:
            return lotes.sorted { $0.fechaCreacion > $1.fechaCreacion }
        case .area:
            return lotes.sorted {
                ($0.areaHectareas ?? 0) > ($1.areaHectareas ?? 0)
            }
        case .ubicacion:
            return lotes.sorted { $0.ubicacion < $1.ubicacion }
        }
    }
}

// MARK: - SortOption
/// Opciones de ordenamiento para la lista de lotes
enum SortOption: String, CaseIterable {
    case nombre = "Nombre"
    case fechaCreacion = "Fecha"
    case area = "Área"
    case ubicacion = "Ubicación"

    var icon: String {
        switch self {
        case .nombre: return "textformat"
        case .fechaCreacion: return "calendar"
        case .area: return "ruler"
        case .ubicacion: return "location"
        }
    }
}
