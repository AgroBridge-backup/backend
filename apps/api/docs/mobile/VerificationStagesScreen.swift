/**
 * AgroBridge iOS - Verification Stages Timeline
 * Traceability 2.0 - Feature 1: Multi-Stage Verification
 * SwiftUI Implementation
 *
 * Features:
 * - Visual timeline of batch stages (Harvest → Packing → Cold Chain → Export → Delivery)
 * - Stage status indicators (pending/approved/rejected/flagged)
 * - Actions to create and approve stages
 * - Evidence upload integration
 * - Offline caching with sync
 */

import SwiftUI

// MARK: - Models

enum StageType: String, Codable, CaseIterable {
    case harvest = "HARVEST"
    case packing = "PACKING"
    case coldChain = "COLD_CHAIN"
    case export = "EXPORT"
    case delivery = "DELIVERY"

    var displayName: String {
        switch self {
        case .harvest: return "Cosecha"
        case .packing: return "Empaque"
        case .coldChain: return "Cadena de Frío"
        case .export: return "Exportación"
        case .delivery: return "Entrega"
        }
    }

    var icon: String {
        switch self {
        case .harvest: return "leaf.fill"
        case .packing: return "shippingbox.fill"
        case .coldChain: return "snowflake"
        case .export: return "airplane"
        case .delivery: return "checkmark.circle.fill"
        }
    }

    var order: Int {
        switch self {
        case .harvest: return 0
        case .packing: return 1
        case .coldChain: return 2
        case .export: return 3
        case .delivery: return 4
        }
    }
}

enum StageStatus: String, Codable {
    case pending = "PENDING"
    case approved = "APPROVED"
    case rejected = "REJECTED"
    case flagged = "FLAGGED"

    var displayName: String {
        switch self {
        case .pending: return "Pendiente"
        case .approved: return "Aprobado"
        case .rejected: return "Rechazado"
        case .flagged: return "Marcado"
        }
    }

    var color: Color {
        switch self {
        case .pending: return .orange
        case .approved: return .green
        case .rejected: return .red
        case .flagged: return .yellow
        }
    }
}

struct VerificationStage: Identifiable, Codable {
    let id: String
    let batchId: String
    let stageType: StageType
    let status: StageStatus
    let actorId: String
    let timestamp: Date
    let location: String?
    let latitude: Double?
    let longitude: Double?
    let notes: String?
    let evidenceUrl: String?
    let createdAt: Date
    let updatedAt: Date
}

struct BatchStagesResponse: Codable {
    let stages: [VerificationStage]
    let currentStage: StageType?
    let nextStage: StageType?
    let isComplete: Bool
    let progress: Int
}

struct CreateStageRequest: Codable {
    var stageType: StageType?
    var location: String?
    var latitude: Double?
    var longitude: Double?
    var notes: String?
    var evidenceUrl: String?
}

struct UpdateStageRequest: Codable {
    var status: StageStatus?
    var notes: String?
    var location: String?
    var latitude: Double?
    var longitude: Double?
    var evidenceUrl: String?
}

// MARK: - ViewModel

@MainActor
class VerificationStagesViewModel: ObservableObject {
    @Published var stages: [VerificationStage] = []
    @Published var currentStage: StageType?
    @Published var nextStage: StageType?
    @Published var isComplete: Bool = false
    @Published var progress: Int = 0
    @Published var isLoading = false
    @Published var error: String?
    @Published var isCreatingStage = false
    @Published var isUpdatingStage = false

    let batchId: String
    private let service = VerificationStagesService()

    init(batchId: String) {
        self.batchId = batchId
    }

    func loadStages() async {
        isLoading = true
        error = nil

        do {
            let response = try await service.fetchStages(batchId: batchId)
            stages = response.stages
            currentStage = response.currentStage
            nextStage = response.nextStage
            isComplete = response.isComplete
            progress = response.progress
        } catch {
            self.error = error.localizedDescription
            // Try loading cached data
            if let cached = service.getCachedStages(batchId: batchId) {
                stages = cached.stages
                currentStage = cached.currentStage
                nextStage = cached.nextStage
                isComplete = cached.isComplete
                progress = cached.progress
            }
        }

        isLoading = false
    }

    func createNextStage(location: String?, notes: String?, evidenceUrl: String?) async -> Bool {
        isCreatingStage = true
        error = nil

        do {
            let request = CreateStageRequest(
                location: location,
                notes: notes,
                evidenceUrl: evidenceUrl
            )
            _ = try await service.createStage(batchId: batchId, request: request)
            await loadStages()
            isCreatingStage = false
            return true
        } catch {
            self.error = error.localizedDescription
            isCreatingStage = false
            return false
        }
    }

    func updateStage(stageId: String, status: StageStatus?, notes: String?) async -> Bool {
        isUpdatingStage = true
        error = nil

        do {
            let request = UpdateStageRequest(status: status, notes: notes)
            _ = try await service.updateStage(batchId: batchId, stageId: stageId, request: request)
            await loadStages()
            isUpdatingStage = false
            return true
        } catch {
            self.error = error.localizedDescription
            isUpdatingStage = false
            return false
        }
    }

    func approveStage(stageId: String, notes: String? = nil) async -> Bool {
        return await updateStage(stageId: stageId, status: .approved, notes: notes)
    }

    func rejectStage(stageId: String, notes: String) async -> Bool {
        return await updateStage(stageId: stageId, status: .rejected, notes: notes)
    }

    func flagStage(stageId: String, notes: String) async -> Bool {
        return await updateStage(stageId: stageId, status: .flagged, notes: notes)
    }
}

// MARK: - Network Service

class VerificationStagesService {
    private let baseURL = "https://api.agrobridge.io/api/v1"

    func fetchStages(batchId: String) async throws -> BatchStagesResponse {
        guard let url = URL(string: "\(baseURL)/batches/\(batchId)/stages") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(AuthManager.shared.token ?? "")", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        struct APIResponse: Codable {
            let success: Bool
            let data: BatchStagesResponse
        }

        let apiResponse = try decoder.decode(APIResponse.self, from: data)

        // Cache for offline use
        let cacheKey = "cached_stages_\(batchId)"
        UserDefaults.standard.set(data, forKey: cacheKey)

        return apiResponse.data
    }

    func createStage(batchId: String, request: CreateStageRequest) async throws -> VerificationStage {
        guard let url = URL(string: "\(baseURL)/batches/\(batchId)/stages") else {
            throw URLError(.badURL)
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("Bearer \(AuthManager.shared.token ?? "")", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let encoder = JSONEncoder()
        urlRequest.httpBody = try encoder.encode(request)

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 201 else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        struct CreateResponse: Codable {
            let success: Bool
            let data: StageData

            struct StageData: Codable {
                let stage: VerificationStage
                let isComplete: Bool
            }
        }

        let createResponse = try decoder.decode(CreateResponse.self, from: data)
        return createResponse.data.stage
    }

    func updateStage(batchId: String, stageId: String, request: UpdateStageRequest) async throws -> VerificationStage {
        guard let url = URL(string: "\(baseURL)/batches/\(batchId)/stages/\(stageId)") else {
            throw URLError(.badURL)
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PATCH"
        urlRequest.setValue("Bearer \(AuthManager.shared.token ?? "")", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let encoder = JSONEncoder()
        urlRequest.httpBody = try encoder.encode(request)

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        struct UpdateResponse: Codable {
            let success: Bool
            let data: StageData

            struct StageData: Codable {
                let stage: VerificationStage
            }
        }

        let updateResponse = try decoder.decode(UpdateResponse.self, from: data)
        return updateResponse.data.stage
    }

    func getCachedStages(batchId: String) -> BatchStagesResponse? {
        let cacheKey = "cached_stages_\(batchId)"
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else {
            return nil
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        struct APIResponse: Codable {
            let success: Bool
            let data: BatchStagesResponse
        }

        return try? decoder.decode(APIResponse.self, from: data).data
    }
}

// MARK: - Main View

struct VerificationStagesView: View {
    @StateObject private var viewModel: VerificationStagesViewModel
    @State private var showCreateStageSheet = false
    @State private var selectedStage: VerificationStage?
    @State private var showApprovalSheet = false

    init(batchId: String) {
        _viewModel = StateObject(wrappedValue: VerificationStagesViewModel(batchId: batchId))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Progress Header
            progressHeader

            // Timeline
            if viewModel.isLoading && viewModel.stages.isEmpty {
                loadingView
            } else {
                timelineView
            }
        }
        .navigationTitle(StagesLocalizedString.stagesTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if viewModel.nextStage != nil {
                    Button(action: { showCreateStageSheet = true }) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.green)
                    }
                    .disabled(viewModel.isCreatingStage)
                }
            }
        }
        .refreshable {
            await viewModel.loadStages()
        }
        .task {
            await viewModel.loadStages()
        }
        .sheet(isPresented: $showCreateStageSheet) {
            CreateStageSheet(
                viewModel: viewModel,
                stageType: viewModel.nextStage ?? .harvest
            )
        }
        .sheet(item: $selectedStage) { stage in
            StageApprovalSheet(viewModel: viewModel, stage: stage)
        }
        .alert("Error", isPresented: .constant(viewModel.error != nil)) {
            Button("OK") { viewModel.error = nil }
        } message: {
            Text(viewModel.error ?? "")
        }
    }

    // MARK: - Progress Header

    private var progressHeader: some View {
        VStack(spacing: 12) {
            // Progress Bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 8)
                        .cornerRadius(4)

                    Rectangle()
                        .fill(viewModel.isComplete ? Color.green : Color.blue)
                        .frame(width: geometry.size.width * CGFloat(viewModel.progress) / 100, height: 8)
                        .cornerRadius(4)
                        .animation(.easeInOut, value: viewModel.progress)
                }
            }
            .frame(height: 8)

            // Progress Text
            HStack {
                Text("\(viewModel.progress)% \(StagesLocalizedString.complete)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()

                if viewModel.isComplete {
                    Label(StagesLocalizedString.allStagesComplete, systemImage: "checkmark.seal.fill")
                        .font(.subheadline)
                        .foregroundColor(.green)
                } else if let next = viewModel.nextStage {
                    Text("\(StagesLocalizedString.next): \(next.displayName)")
                        .font(.subheadline)
                        .foregroundColor(.blue)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
    }

    // MARK: - Timeline View

    private var timelineView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(StageType.allCases, id: \.self) { stageType in
                    let stage = viewModel.stages.first { $0.stageType == stageType }
                    StageTimelineRow(
                        stageType: stageType,
                        stage: stage,
                        isNext: stageType == viewModel.nextStage,
                        isLast: stageType == .delivery,
                        onApprove: {
                            if let stage = stage {
                                selectedStage = stage
                            }
                        }
                    )
                }
            }
            .padding()
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack {
            ProgressView()
            Text(StagesLocalizedString.loading)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Stage Timeline Row

struct StageTimelineRow: View {
    let stageType: StageType
    let stage: VerificationStage?
    let isNext: Bool
    let isLast: Bool
    let onApprove: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Timeline indicator
            VStack(spacing: 0) {
                Circle()
                    .fill(circleColor)
                    .frame(width: 40, height: 40)
                    .overlay(
                        Image(systemName: stageType.icon)
                            .foregroundColor(.white)
                            .font(.system(size: 18))
                    )

                if !isLast {
                    Rectangle()
                        .fill(lineColor)
                        .frame(width: 2, height: 60)
                }
            }

            // Content
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(stageType.displayName)
                        .font(.headline)

                    Spacer()

                    if let stage = stage {
                        StageStatusBadge(status: stage.status)
                    } else if isNext {
                        Text(StagesLocalizedString.nextUp)
                            .font(.caption)
                            .foregroundColor(.blue)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(4)
                    }
                }

                if let stage = stage {
                    // Timestamp
                    HStack {
                        Image(systemName: "clock")
                            .font(.caption)
                        Text(stage.timestamp.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption)
                    }
                    .foregroundColor(.secondary)

                    // Location if available
                    if let location = stage.location {
                        HStack {
                            Image(systemName: "location")
                                .font(.caption)
                            Text(location)
                                .font(.caption)
                        }
                        .foregroundColor(.secondary)
                    }

                    // Notes if available
                    if let notes = stage.notes {
                        Text(notes)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }

                    // Action button for pending stages
                    if stage.status == .pending {
                        Button(action: onApprove) {
                            Label(StagesLocalizedString.reviewAndApprove, systemImage: "checkmark.circle")
                                .font(.subheadline)
                                .foregroundColor(.green)
                        }
                        .padding(.top, 4)
                    }
                }
            }
            .padding(.bottom, isLast ? 0 : 16)
        }
    }

    private var circleColor: Color {
        if let stage = stage {
            return stage.status.color
        } else if isNext {
            return .blue
        } else {
            return .gray.opacity(0.3)
        }
    }

    private var lineColor: Color {
        if stage?.status == .approved {
            return .green
        } else {
            return .gray.opacity(0.3)
        }
    }
}

// MARK: - Stage Status Badge

struct StageStatusBadge: View {
    let status: StageStatus

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: statusIcon)
                .font(.caption)
            Text(status.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(status.color.opacity(0.2))
        .foregroundColor(status.color)
        .cornerRadius(4)
    }

    private var statusIcon: String {
        switch status {
        case .pending: return "clock"
        case .approved: return "checkmark.circle.fill"
        case .rejected: return "xmark.circle.fill"
        case .flagged: return "flag.fill"
        }
    }
}

// MARK: - Create Stage Sheet

struct CreateStageSheet: View {
    @ObservedObject var viewModel: VerificationStagesViewModel
    let stageType: StageType
    @Environment(\.dismiss) private var dismiss

    @State private var location: String = ""
    @State private var notes: String = ""
    @State private var showImagePicker = false
    @State private var evidenceUrl: String?

    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text(StagesLocalizedString.stageInfo)) {
                    HStack {
                        Image(systemName: stageType.icon)
                            .foregroundColor(.blue)
                        Text(stageType.displayName)
                            .fontWeight(.semibold)
                    }
                }

                Section(header: Text(StagesLocalizedString.location)) {
                    TextField(StagesLocalizedString.locationPlaceholder, text: $location)

                    Button(action: getCurrentLocation) {
                        Label(StagesLocalizedString.useCurrentLocation, systemImage: "location.fill")
                    }
                }

                Section(header: Text(StagesLocalizedString.notes)) {
                    TextEditor(text: $notes)
                        .frame(minHeight: 100)
                }

                Section(header: Text(StagesLocalizedString.evidence)) {
                    Button(action: { showImagePicker = true }) {
                        Label(StagesLocalizedString.uploadPhoto, systemImage: "camera.fill")
                    }

                    if evidenceUrl != nil {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text(StagesLocalizedString.photoUploaded)
                        }
                    }
                }
            }
            .navigationTitle(StagesLocalizedString.createStage)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(StagesLocalizedString.cancel) {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(StagesLocalizedString.create) {
                        Task {
                            let success = await viewModel.createNextStage(
                                location: location.isEmpty ? nil : location,
                                notes: notes.isEmpty ? nil : notes,
                                evidenceUrl: evidenceUrl
                            )
                            if success {
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.isCreatingStage)
                }
            }
        }
    }

    private func getCurrentLocation() {
        // TODO: Implement location manager
        location = "Ubicación actual"
    }
}

// MARK: - Stage Approval Sheet

struct StageApprovalSheet: View {
    @ObservedObject var viewModel: VerificationStagesViewModel
    let stage: VerificationStage
    @Environment(\.dismiss) private var dismiss

    @State private var notes: String = ""
    @State private var selectedAction: ApprovalAction = .approve

    enum ApprovalAction {
        case approve, reject, flag
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text(StagesLocalizedString.stageDetails)) {
                    HStack {
                        Image(systemName: stage.stageType.icon)
                            .foregroundColor(.blue)
                        Text(stage.stageType.displayName)
                            .fontWeight(.semibold)
                    }

                    if let location = stage.location {
                        HStack {
                            Image(systemName: "location")
                            Text(location)
                        }
                    }

                    HStack {
                        Image(systemName: "clock")
                        Text(stage.timestamp.formatted(date: .long, time: .shortened))
                    }
                }

                Section(header: Text(StagesLocalizedString.action)) {
                    Picker(StagesLocalizedString.action, selection: $selectedAction) {
                        Text(StagesLocalizedString.approve).tag(ApprovalAction.approve)
                        Text(StagesLocalizedString.reject).tag(ApprovalAction.reject)
                        Text(StagesLocalizedString.flag).tag(ApprovalAction.flag)
                    }
                    .pickerStyle(.segmented)
                }

                Section(header: Text(StagesLocalizedString.notes)) {
                    TextEditor(text: $notes)
                        .frame(minHeight: 100)

                    if selectedAction == .reject || selectedAction == .flag {
                        Text(StagesLocalizedString.notesRequired)
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                }
            }
            .navigationTitle(StagesLocalizedString.reviewStage)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(StagesLocalizedString.cancel) {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(actionButtonTitle) {
                        Task {
                            let success: Bool
                            switch selectedAction {
                            case .approve:
                                success = await viewModel.approveStage(stageId: stage.id, notes: notes.isEmpty ? nil : notes)
                            case .reject:
                                success = await viewModel.rejectStage(stageId: stage.id, notes: notes)
                            case .flag:
                                success = await viewModel.flagStage(stageId: stage.id, notes: notes)
                            }
                            if success {
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.isUpdatingStage || (selectedAction != .approve && notes.isEmpty))
                }
            }
        }
    }

    private var actionButtonTitle: String {
        switch selectedAction {
        case .approve: return StagesLocalizedString.approve
        case .reject: return StagesLocalizedString.reject
        case .flag: return StagesLocalizedString.flag
        }
    }
}

// MARK: - Localization

enum StagesLocalizedString {
    static let stagesTitle = NSLocalizedString("stages_title", value: "Etapas de Verificación", comment: "")
    static let complete = NSLocalizedString("complete", value: "completado", comment: "")
    static let allStagesComplete = NSLocalizedString("all_stages_complete", value: "Todas las etapas completas", comment: "")
    static let next = NSLocalizedString("next", value: "Siguiente", comment: "")
    static let nextUp = NSLocalizedString("next_up", value: "Próximo", comment: "")
    static let loading = NSLocalizedString("loading", value: "Cargando...", comment: "")
    static let reviewAndApprove = NSLocalizedString("review_approve", value: "Revisar y Aprobar", comment: "")
    static let stageInfo = NSLocalizedString("stage_info", value: "Información de Etapa", comment: "")
    static let location = NSLocalizedString("location", value: "Ubicación", comment: "")
    static let locationPlaceholder = NSLocalizedString("location_placeholder", value: "Ingrese ubicación...", comment: "")
    static let useCurrentLocation = NSLocalizedString("use_current_location", value: "Usar ubicación actual", comment: "")
    static let notes = NSLocalizedString("notes", value: "Notas", comment: "")
    static let evidence = NSLocalizedString("evidence", value: "Evidencia", comment: "")
    static let uploadPhoto = NSLocalizedString("upload_photo", value: "Subir foto", comment: "")
    static let photoUploaded = NSLocalizedString("photo_uploaded", value: "Foto subida", comment: "")
    static let createStage = NSLocalizedString("create_stage", value: "Crear Etapa", comment: "")
    static let cancel = NSLocalizedString("cancel", value: "Cancelar", comment: "")
    static let create = NSLocalizedString("create", value: "Crear", comment: "")
    static let stageDetails = NSLocalizedString("stage_details", value: "Detalles de Etapa", comment: "")
    static let action = NSLocalizedString("action", value: "Acción", comment: "")
    static let approve = NSLocalizedString("approve", value: "Aprobar", comment: "")
    static let reject = NSLocalizedString("reject", value: "Rechazar", comment: "")
    static let flag = NSLocalizedString("flag", value: "Marcar", comment: "")
    static let notesRequired = NSLocalizedString("notes_required", value: "Las notas son requeridas para esta acción", comment: "")
    static let reviewStage = NSLocalizedString("review_stage", value: "Revisar Etapa", comment: "")
}

// MARK: - Preview

#Preview {
    NavigationStack {
        VerificationStagesView(batchId: "sample-batch-id")
    }
}
