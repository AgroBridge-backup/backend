/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * iOS SwiftUI Implementation with CoreNFC
 */

import SwiftUI
import CoreNFC

// MARK: - Models

enum NfcSealStatus: String, Codable, CaseIterable {
    case PROVISIONED = "PROVISIONED"
    case ATTACHED = "ATTACHED"
    case VERIFIED = "VERIFIED"
    case TAMPERED = "TAMPERED"
    case REMOVED = "REMOVED"
    case EXPIRED = "EXPIRED"

    var displayName: String {
        switch self {
        case .PROVISIONED: return "Provisionado"
        case .ATTACHED: return "Adjunto"
        case .VERIFIED: return "Verificado"
        case .TAMPERED: return "Alterado"
        case .REMOVED: return "Removido"
        case .EXPIRED: return "Expirado"
        }
    }

    var color: Color {
        switch self {
        case .PROVISIONED: return .gray
        case .ATTACHED: return .blue
        case .VERIFIED: return .green
        case .TAMPERED: return .red
        case .REMOVED: return .orange
        case .EXPIRED: return .brown
        }
    }

    var icon: String {
        switch self {
        case .PROVISIONED: return "shippingbox"
        case .ATTACHED: return "link"
        case .VERIFIED: return "checkmark.seal.fill"
        case .TAMPERED: return "exclamationmark.triangle.fill"
        case .REMOVED: return "link.badge.minus"
        case .EXPIRED: return "clock.badge.xmark"
        }
    }
}

enum TamperIndicator: String, Codable {
    case NONE = "NONE"
    case SIGNATURE_MISMATCH = "SIGNATURE_MISMATCH"
    case COUNTER_ANOMALY = "COUNTER_ANOMALY"
    case PHYSICAL_DAMAGE = "PHYSICAL_DAMAGE"
    case LOCATION_MISMATCH = "LOCATION_MISMATCH"
    case TIMING_ANOMALY = "TIMING_ANOMALY"

    var displayName: String {
        switch self {
        case .NONE: return "Sin alteración"
        case .SIGNATURE_MISMATCH: return "Firma inválida"
        case .COUNTER_ANOMALY: return "Anomalía de contador"
        case .PHYSICAL_DAMAGE: return "Daño físico"
        case .LOCATION_MISMATCH: return "Ubicación inesperada"
        case .TIMING_ANOMALY: return "Anomalía temporal"
        }
    }

    var severity: String {
        switch self {
        case .NONE: return "none"
        case .SIGNATURE_MISMATCH, .COUNTER_ANOMALY, .PHYSICAL_DAMAGE: return "critical"
        case .LOCATION_MISMATCH, .TIMING_ANOMALY: return "warning"
        }
    }
}

struct NfcSeal: Identifiable, Codable {
    let id: String
    let serialNumber: String
    let batchId: String?
    let status: NfcSealStatus
    let publicKey: String
    let challenge: String?
    let expectedReadCount: Int
    let actualReadCount: Int
    let attachedAt: Date?
    let attachedBy: String?
    let attachedLocation: String?
    let removedAt: Date?
    let tamperIndicator: TamperIndicator
    let tamperDetails: String?
    let expiresAt: Date?
}

struct NfcSealVerification: Identifiable, Codable {
    let id: String
    let sealId: String
    let verifiedBy: String
    let verifiedAt: Date
    let location: String?
    let readCounter: Int
    let isValid: Bool
    let tamperIndicator: TamperIndicator
    let tamperDetails: String?
}

struct VerificationResult: Codable {
    let seal: NfcSeal
    let verification: NfcSealVerification
    let isValid: Bool
    let tamperIndicator: TamperIndicator
    let integrityScore: Int
    let nextChallenge: String
}

struct SealIntegritySummary: Identifiable, Codable {
    let sealId: String
    let serialNumber: String
    let status: NfcSealStatus
    let integrityScore: Int
    let verificationCount: Int
    let lastVerification: Date?
    let tamperIndicator: TamperIndicator

    var id: String { sealId }
}

// MARK: - ViewModel

@MainActor
class NfcSealViewModel: NSObject, ObservableObject, NFCNDEFReaderSessionDelegate {
    @Published var seals: [NfcSeal] = []
    @Published var currentSeal: NfcSeal?
    @Published var verificationResult: VerificationResult?
    @Published var integritySummary: [SealIntegritySummary] = []
    @Published var isLoading = false
    @Published var isScanning = false
    @Published var error: String?
    @Published var showResult = false

    private var nfcSession: NFCNDEFReaderSession?
    private var pendingAction: NFCAction = .verify
    private var attachBatchId: String?
    private let apiClient: APIClient

    enum NFCAction {
        case verify
        case attach(batchId: String)
    }

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func loadBatchSeals(batchId: String) async {
        isLoading = true
        error = nil

        do {
            seals = try await apiClient.get("/nfc-seals/batches/\(batchId)/nfc-seals", type: [NfcSeal].self)
            integritySummary = try await apiClient.get("/nfc-seals/batches/\(batchId)/nfc-seals/integrity", type: [SealIntegritySummary].self)
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func startScan(action: NFCAction) {
        guard NFCNDEFReaderSession.readingAvailable else {
            error = "NFC no disponible en este dispositivo"
            return
        }

        pendingAction = action
        nfcSession = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: true)
        nfcSession?.alertMessage = "Acerque el sello NFC al dispositivo"
        nfcSession?.begin()
        isScanning = true
    }

    func verifySeal(serialNumber: String, signature: String, readCounter: Int) async {
        do {
            let body: [String: Any] = [
                "serialNumber": serialNumber,
                "signature": signature,
                "readCounter": readCounter,
                "deviceInfo": UIDevice.current.model
            ]

            verificationResult = try await apiClient.post("/nfc-seals/verify", body: body, type: VerificationResult.self)
            showResult = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    func attachSeal(sealId: String, batchId: String) async {
        do {
            let body: [String: Any] = ["batchId": batchId]
            _ = try await apiClient.post("/nfc-seals/\(sealId)/attach", body: body, type: NfcSeal.self)
            await loadBatchSeals(batchId: batchId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func reportDamage(sealId: String, description: String) async {
        do {
            let body = ["description": description]
            _ = try await apiClient.post("/nfc-seals/\(sealId)/report-damage", body: body, type: NfcSeal.self)
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - NFCNDEFReaderSessionDelegate

    nonisolated func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        Task { @MainActor in
            self.isScanning = false
            if (error as NSError).code != 200 { // User canceled
                self.error = error.localizedDescription
            }
        }
    }

    nonisolated func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        // Process NFC data
        guard let message = messages.first,
              let record = message.records.first else {
            return
        }

        let payload = String(data: record.payload, encoding: .utf8) ?? ""

        Task { @MainActor in
            self.isScanning = false
            // Parse NFC payload and call verification
            // Format expected: serialNumber:signature:readCounter
            let parts = payload.components(separatedBy: ":")
            if parts.count >= 3 {
                await verifySeal(
                    serialNumber: parts[0],
                    signature: parts[1],
                    readCounter: Int(parts[2]) ?? 0
                )
            }
        }
    }
}

// MARK: - Main Screen

struct NfcSealScreen: View {
    @StateObject private var viewModel = NfcSealViewModel()
    let batchId: String

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if viewModel.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 200)
                    } else if let error = viewModel.error {
                        ErrorView(message: error, retryAction: {
                            Task { await viewModel.loadBatchSeals(batchId: batchId) }
                        })
                    } else {
                        // Scan Button
                        ScanButtonCard(
                            onScan: { viewModel.startScan(action: .verify) },
                            isScanning: viewModel.isScanning
                        )

                        // Integrity Summary
                        if !viewModel.integritySummary.isEmpty {
                            IntegritySummaryCard(summaries: viewModel.integritySummary)
                        }

                        // Seals List
                        if !viewModel.seals.isEmpty {
                            SealsListCard(seals: viewModel.seals)
                        } else {
                            EmptySealsView()
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Sellos NFC")
            .sheet(isPresented: $viewModel.showResult) {
                if let result = viewModel.verificationResult {
                    VerificationResultSheet(result: result)
                }
            }
            .task {
                await viewModel.loadBatchSeals(batchId: batchId)
            }
        }
    }
}

// MARK: - Scan Button Card

struct ScanButtonCard: View {
    let onScan: () -> Void
    let isScanning: Bool

    var body: some View {
        Button(action: onScan) {
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(.blue.opacity(0.1))
                        .frame(width: 60, height: 60)

                    if isScanning {
                        ProgressView()
                    } else {
                        Image(systemName: "wave.3.right")
                            .font(.title)
                            .foregroundStyle(.blue)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(isScanning ? "Escaneando..." : "Escanear Sello NFC")
                        .font(.headline)
                    Text("Acerque el dispositivo al sello para verificar")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .disabled(isScanning)
    }
}

// MARK: - Integrity Summary Card

struct IntegritySummaryCard: View {
    let summaries: [SealIntegritySummary]

    private var overallScore: Int {
        guard !summaries.isEmpty else { return 100 }
        return summaries.reduce(0) { $0 + $1.integrityScore } / summaries.count
    }

    private var scoreColor: Color {
        if overallScore >= 90 { return .green }
        if overallScore >= 70 { return .yellow }
        return .red
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "shield.checkered")
                    .foregroundStyle(.purple)
                Text("Integridad de Sellos")
                    .font(.headline)
                Spacer()
            }

            HStack(spacing: 24) {
                // Overall Score
                VStack {
                    Text("\(overallScore)%")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(scoreColor)
                    Text("Puntuación")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Divider()
                    .frame(height: 50)

                // Stats
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Circle().fill(.green).frame(width: 8, height: 8)
                        Text("\(summaries.filter { $0.status == .VERIFIED }.count) verificados")
                            .font(.caption)
                    }
                    HStack {
                        Circle().fill(.blue).frame(width: 8, height: 8)
                        Text("\(summaries.filter { $0.status == .ATTACHED }.count) adjuntos")
                            .font(.caption)
                    }
                    if summaries.contains(where: { $0.status == .TAMPERED }) {
                        HStack {
                            Circle().fill(.red).frame(width: 8, height: 8)
                            Text("\(summaries.filter { $0.status == .TAMPERED }.count) alterados")
                                .font(.caption)
                        }
                    }
                }

                Spacer()
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Seals List Card

struct SealsListCard: View {
    let seals: [NfcSeal]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "tag.fill")
                    .foregroundStyle(.orange)
                Text("Sellos (\(seals.count))")
                    .font(.headline)
            }

            ForEach(seals) { seal in
                SealRow(seal: seal)
                if seal.id != seals.last?.id {
                    Divider()
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct SealRow: View {
    let seal: NfcSeal

    var body: some View {
        HStack {
            Image(systemName: seal.status.icon)
                .foregroundStyle(seal.status.color)
                .font(.title2)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(seal.serialNumber)
                    .font(.subheadline.monospaced())
                Text(seal.status.displayName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if seal.tamperIndicator != .NONE {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
            }
        }
    }
}

// MARK: - Verification Result Sheet

struct VerificationResultSheet: View {
    let result: VerificationResult
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Result Icon
                    ZStack {
                        Circle()
                            .fill(result.isValid ? .green.opacity(0.1) : .red.opacity(0.1))
                            .frame(width: 120, height: 120)

                        Image(systemName: result.isValid ? "checkmark.seal.fill" : "xmark.seal.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(result.isValid ? .green : .red)
                    }

                    // Status Text
                    VStack(spacing: 8) {
                        Text(result.isValid ? "Sello Válido" : "Sello Inválido")
                            .font(.title.bold())

                        Text(result.isValid
                            ? "La integridad del sello ha sido verificada"
                            : "Se detectó una posible manipulación")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }

                    // Integrity Score
                    VStack(spacing: 8) {
                        Text("Puntuación de Integridad")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        Text("\(result.integrityScore)%")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundStyle(result.integrityScore >= 80 ? .green : .red)
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))

                    // Details
                    VStack(alignment: .leading, spacing: 12) {
                        DetailRow(label: "Serial", value: result.seal.serialNumber)
                        DetailRow(label: "Estado", value: result.seal.status.displayName)
                        DetailRow(label: "Contador", value: "\(result.verification.readCounter)")
                        if result.tamperIndicator != .NONE {
                            DetailRow(
                                label: "Indicador",
                                value: result.tamperIndicator.displayName,
                                valueColor: .red
                            )
                        }
                    }
                    .padding()
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
                .padding()
            }
            .navigationTitle("Resultado")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
    }
}

struct DetailRow: View {
    let label: String
    let value: String
    var valueColor: Color = .primary

    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
                .foregroundStyle(valueColor)
        }
    }
}

// MARK: - Empty State

struct EmptySealsView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "tag.slash")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Sin sellos NFC")
                .font(.headline)

            Text("No hay sellos adjuntos a este lote")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(32)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Error View

struct NfcErrorView: View {
    let message: String
    let retryAction: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.red)
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Reintentar", action: retryAction)
                .buttonStyle(.bordered)
        }
        .padding()
    }
}

// MARK: - Preview

#Preview {
    NfcSealScreen(batchId: "batch-123")
}
