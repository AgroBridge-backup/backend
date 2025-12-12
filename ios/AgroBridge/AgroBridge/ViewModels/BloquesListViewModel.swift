import Foundation
import Combine

// MARK: - BloquesListViewModel
/// ViewModel para la lista de bloques con búsqueda y filtros
@MainActor
class BloquesListViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var searchText = "" {
        didSet { applyFilters() }
    }

    @Published var selectedEstado: BloqueEstado? {
        didSet { applyFilters() }
    }

    @Published var showOnlyCertificados = false {
        didSet { applyFilters() }
    }

    @Published var sortOption: BloqueSortOption = .nombre {
        didSet { applyFilters() }
    }

    @Published private(set) var filteredBloques: [Bloque] = []
    @Published private(set) var allBloques: [Bloque] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var showError = false

    // MARK: - Private Properties
    private let bloqueService: BloqueService
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties
    var hasActiveFilters: Bool {
        return !searchText.isEmpty || selectedEstado != nil || showOnlyCertificados
    }

    var resultsCount: Int {
        return filteredBloques.count
    }

    var certificadosCount: Int {
        return filteredBloques.filter { $0.certificado }.count
    }

    // MARK: - Inicialización
    init(bloqueService: BloqueService = .shared) {
        self.bloqueService = bloqueService

        // Observar cambios en la lista de bloques del servicio
        bloqueService.$bloques
            .sink { [weak self] bloques in
                self?.allBloques = bloques
                self?.applyFilters()
            }
            .store(in: &cancellables)
    }

    // MARK: - Actions
    /// Carga los bloques desde el servidor
    func loadBloques() async {
        guard !isLoading else { return }

        isLoading = true
        errorMessage = nil
        showError = false

        defer { isLoading = false }

        do {
            try await bloqueService.fetchBloques()
        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }

    /// Refresca la lista de bloques
    func refresh() async {
        await loadBloques()
    }

    /// Aplica los filtros y ordenamiento
    private func applyFilters() {
        var filtered = allBloques

        // Aplicar búsqueda
        if !searchText.isEmpty {
            filtered = filtered.filter { bloque in
                bloque.nombre.localizedCaseInsensitiveContains(searchText) ||
                (bloque.descripcion?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }

        // Aplicar filtro de estado
        if let estado = selectedEstado {
            filtered = filtered.filter { $0.estado == estado }
        }

        // Aplicar filtro de certificados
        if showOnlyCertificados {
            filtered = filtered.filter { $0.certificado }
        }

        // Aplicar ordenamiento
        filtered = sortBloques(filtered, by: sortOption)

        filteredBloques = filtered
    }

    /// Ordena los bloques según la opción seleccionada
    private func sortBloques(_ bloques: [Bloque], by option: BloqueSortOption) -> [Bloque] {
        switch option {
        case .nombre:
            return bloques.sorted { $0.nombre < $1.nombre }
        case .fecha:
            return bloques.sorted { $0.fechaCreacion > $1.fechaCreacion }
        case .estado:
            return bloques.sorted { $0.estado.rawValue < $1.estado.rawValue }
        case .certificacion:
            return bloques.sorted { ($0.certificado ? 1 : 0) > ($1.certificado ? 1 : 0) }
        }
    }

    /// Limpia todos los filtros
    func clearFilters() {
        searchText = ""
        selectedEstado = nil
        showOnlyCertificados = false
        sortOption = .nombre
    }

    /// Elimina un bloque (con índice de la lista filtrada)
    func deleteBloque(at indexSet: IndexSet) async {
        guard let index = indexSet.first else { return }
        let bloque = filteredBloques[index]

        isLoading = true
        defer { isLoading = false }

        do {
            try await bloqueService.deleteBloque(id: bloque.id)
        } catch {
            errorMessage = (error as? NetworkError)?.errorDescription ?? error.localizedDescription
            showError = true
        }
    }
}

// MARK: - BloqueSortOption
/// Opciones de ordenamiento para bloques
enum BloqueSortOption: String, CaseIterable {
    case nombre = "Nombre"
    case fecha = "Fecha de Creación"
    case estado = "Estado"
    case certificacion = "Certificación"

    var icon: String {
        switch self {
        case .nombre: return "textformat.abc"
        case .fecha: return "calendar"
        case .estado: return "flag.fill"
        case .certificacion: return "checkmark.seal.fill"
        }
    }
}
