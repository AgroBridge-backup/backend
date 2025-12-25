/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * iOS SwiftUI Implementation
 *
 * Features:
 * - List certificates for a batch
 * - View certificate details with verification status
 * - Issue new certificates (CERTIFIER role only)
 * - Verify certificate authenticity via public API
 * - Share certificate (QR code / PDF)
 */

import SwiftUI
import Foundation

// MARK: - Models

enum CertificateGrade: String, Codable, CaseIterable {
    case STANDARD
    case PREMIUM
    case EXPORT
    case ORGANIC

    var displayName: String {
        switch self {
        case .STANDARD: return "Estándar"
        case .PREMIUM: return "Premium"
        case .EXPORT: return "Exportación"
        case .ORGANIC: return "Orgánico"
        }
    }

    var description: String {
        switch self {
        case .STANDARD: return "Certificado básico de calidad"
        case .PREMIUM: return "Calidad superior verificada"
        case .EXPORT: return "Apto para mercados internacionales"
        case .ORGANIC: return "Certificación orgánica verificada"
        }
    }

    var color: Color {
        switch self {
        case .STANDARD: return .gray
        case .PREMIUM: return .yellow
        case .EXPORT: return .blue
        case .ORGANIC: return .green
        }
    }

    var icon: String {
        switch self {
        case .STANDARD: return "checkmark.seal"
        case .PREMIUM: return "star.seal"
        case .EXPORT: return "airplane"
        case .ORGANIC: return "leaf"
        }
    }
}

struct QualityCertificate: Identifiable, Codable {
    let id: String
    let batchId: String
    let grade: CertificateGrade
    let certifyingBody: String
    let validFrom: Date
    let validTo: Date
    let hashOnChain: String?
    let pdfUrl: String?
    let issuedAt: Date
    let issuedBy: String
    let createdAt: Date
    let updatedAt: Date

    var isValid: Bool {
        let now = Date()
        return validFrom <= now && validTo >= now
    }

    var daysUntilExpiry: Int {
        Calendar.current.dateComponents([.day], from: Date(), to: validTo).day ?? 0
    }
}

struct CertificateEligibility: Codable {
    let canIssue: Bool
    let missingStages: [String]
    let message: String
}

struct CertificateVerification: Codable {
    let isValid: Bool
    let isExpired: Bool
    let message: String
    let certificate: CertificateBasicInfo?
    let verification: HashVerification?
}

struct CertificateBasicInfo: Codable {
    let id: String
    let batchId: String
    let grade: CertificateGrade
    let certifyingBody: String
    let validFrom: Date
    let validTo: Date
    let issuedAt: Date
}

struct HashVerification: Codable {
    let computedHash: String?
    let storedHash: String?
    let hashMatch: Bool
}

struct IssueCertificateRequest: Codable {
    let grade: CertificateGrade
    let certifyingBody: String
    let validityDays: Int?
}

// MARK: - Service

class CertificatesService: ObservableObject {
    private let baseURL: String
    private let authToken: String

    init(baseURL: String = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "https://api.agrobridge.com",
         authToken: String) {
        self.baseURL = baseURL
        self.authToken = authToken
    }

    private var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    private var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    func fetchCertificates(batchId: String, validOnly: Bool = false) async throws -> [QualityCertificate] {
        var urlString = "\(baseURL)/api/v1/batches/\(batchId)/certificates"
        if validOnly {
            urlString += "?validOnly=true"
        }

        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        struct Response: Codable {
            let success: Bool
            let data: DataWrapper
        }
        struct DataWrapper: Codable {
            let certificates: [QualityCertificate]
            let count: Int
        }

        let result = try decoder.decode(Response.self, from: data)
        return result.data.certificates
    }

    func getCertificate(certificateId: String) async throws -> QualityCertificate {
        guard let url = URL(string: "\(baseURL)/api/v1/certificates/\(certificateId)") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        struct Response: Codable {
            let success: Bool
            let data: QualityCertificate
        }

        let result = try decoder.decode(Response.self, from: data)
        return result.data
    }

    func checkEligibility(batchId: String, grade: CertificateGrade) async throws -> CertificateEligibility {
        guard let url = URL(string: "\(baseURL)/api/v1/batches/\(batchId)/certificates/eligibility?grade=\(grade.rawValue)") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        struct Response: Codable {
            let success: Bool
            let data: CertificateEligibility
        }

        let result = try decoder.decode(Response.self, from: data)
        return result.data
    }

    func issueCertificate(batchId: String, request: IssueCertificateRequest) async throws -> QualityCertificate {
        guard let url = URL(string: "\(baseURL)/api/v1/batches/\(batchId)/certificates") else {
            throw URLError(.badURL)
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try encoder.encode(request)

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 201 else {
            throw URLError(.badServerResponse)
        }

        struct Response: Codable {
            let success: Bool
            let data: DataWrapper
        }
        struct DataWrapper: Codable {
            let certificate: QualityCertificate
            let hash: String
            let blockchainTxId: String?
        }

        let result = try decoder.decode(Response.self, from: data)
        return result.data.certificate
    }

    func verifyCertificate(certificateId: String) async throws -> CertificateVerification {
        guard let url = URL(string: "\(baseURL)/api/v1/certificates/\(certificateId)/verify") else {
            throw URLError(.badURL)
        }

        // Public endpoint - no auth required
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        struct Response: Codable {
            let success: Bool
            let data: CertificateVerification
        }

        let result = try decoder.decode(Response.self, from: data)
        return result.data
    }
}

// MARK: - ViewModel

@MainActor
class CertificatesViewModel: ObservableObject {
    @Published var certificates: [QualityCertificate] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var selectedCertificate: QualityCertificate?
    @Published var verification: CertificateVerification?
    @Published var eligibility: [CertificateGrade: CertificateEligibility] = [:]
    @Published var showValidOnly = false

    private let service: CertificatesService
    let batchId: String
    let userRole: String

    var canIssueCertificates: Bool {
        userRole == "CERTIFIER" || userRole == "ADMIN"
    }

    init(batchId: String, userRole: String, authToken: String) {
        self.batchId = batchId
        self.userRole = userRole
        self.service = CertificatesService(authToken: authToken)
    }

    func loadCertificates() async {
        isLoading = true
        error = nil

        do {
            certificates = try await service.fetchCertificates(batchId: batchId, validOnly: showValidOnly)
        } catch {
            self.error = "Error loading certificates: \(error.localizedDescription)"
        }

        isLoading = false
    }

    func checkAllEligibility() async {
        for grade in CertificateGrade.allCases {
            do {
                eligibility[grade] = try await service.checkEligibility(batchId: batchId, grade: grade)
            } catch {
                print("Error checking eligibility for \(grade): \(error)")
            }
        }
    }

    func issueCertificate(grade: CertificateGrade, certifyingBody: String, validityDays: Int = 365) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = IssueCertificateRequest(
                grade: grade,
                certifyingBody: certifyingBody,
                validityDays: validityDays
            )
            let certificate = try await service.issueCertificate(batchId: batchId, request: request)
            certificates.insert(certificate, at: 0)
            isLoading = false
            return true
        } catch {
            self.error = "Error issuing certificate: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    func verifyCertificate(_ certificate: QualityCertificate) async {
        do {
            verification = try await service.verifyCertificate(certificateId: certificate.id)
        } catch {
            self.error = "Error verifying certificate: \(error.localizedDescription)"
        }
    }
}

// MARK: - Views

struct CertificatesScreen: View {
    @StateObject var viewModel: CertificatesViewModel
    @State private var showIssueCertificateSheet = false
    @State private var showVerificationSheet = false

    var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading && viewModel.certificates.isEmpty {
                    ProgressView("Cargando certificados...")
                } else if let error = viewModel.error, viewModel.certificates.isEmpty {
                    ErrorView(message: error) {
                        Task { await viewModel.loadCertificates() }
                    }
                } else if viewModel.certificates.isEmpty {
                    EmptyCertificatesView(canIssue: viewModel.canIssueCertificates) {
                        showIssueCertificateSheet = true
                    }
                } else {
                    CertificateListView(
                        certificates: viewModel.certificates,
                        onSelect: { cert in
                            viewModel.selectedCertificate = cert
                            showVerificationSheet = true
                            Task { await viewModel.verifyCertificate(cert) }
                        }
                    )
                }
            }
            .navigationTitle("Certificados")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Toggle("Solo válidos", isOn: $viewModel.showValidOnly)
                        if viewModel.canIssueCertificates {
                            Button(action: { showIssueCertificateSheet = true }) {
                                Label("Emitir certificado", systemImage: "plus.seal")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .refreshable {
                await viewModel.loadCertificates()
            }
            .onChange(of: viewModel.showValidOnly) { _ in
                Task { await viewModel.loadCertificates() }
            }
            .sheet(isPresented: $showIssueCertificateSheet) {
                IssueCertificateSheet(viewModel: viewModel, isPresented: $showIssueCertificateSheet)
            }
            .sheet(isPresented: $showVerificationSheet) {
                if let certificate = viewModel.selectedCertificate {
                    CertificateDetailSheet(
                        certificate: certificate,
                        verification: viewModel.verification,
                        isPresented: $showVerificationSheet
                    )
                }
            }
        }
        .task {
            await viewModel.loadCertificates()
            if viewModel.canIssueCertificates {
                await viewModel.checkAllEligibility()
            }
        }
    }
}

struct CertificateListView: View {
    let certificates: [QualityCertificate]
    let onSelect: (QualityCertificate) -> Void

    var body: some View {
        List(certificates) { certificate in
            CertificateRow(certificate: certificate)
                .onTapGesture { onSelect(certificate) }
        }
        .listStyle(.insetGrouped)
    }
}

struct CertificateRow: View {
    let certificate: QualityCertificate

    var body: some View {
        HStack(spacing: 16) {
            // Grade icon
            ZStack {
                Circle()
                    .fill(certificate.grade.color.opacity(0.2))
                    .frame(width: 50, height: 50)

                Image(systemName: certificate.grade.icon)
                    .font(.title2)
                    .foregroundColor(certificate.grade.color)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(certificate.grade.displayName)
                        .font(.headline)

                    if certificate.hashOnChain != nil {
                        Image(systemName: "link")
                            .font(.caption)
                            .foregroundColor(.blue)
                }
                }

                Text(certificate.certifyingBody)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                HStack {
                    if certificate.isValid {
                        Label("\(certificate.daysUntilExpiry) días restantes", systemImage: "clock")
                            .font(.caption)
                            .foregroundColor(.green)
                    } else {
                        Label("Expirado", systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }
}

struct EmptyCertificatesView: View {
    let canIssue: Bool
    let onIssueTap: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "seal")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text("Sin certificados")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Este lote aún no tiene certificados de calidad emitidos.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            if canIssue {
                Button(action: onIssueTap) {
                    Label("Emitir certificado", systemImage: "plus.seal")
                        .font(.headline)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .padding(.top, 10)
            }
        }
    }
}

struct IssueCertificateSheet: View {
    @ObservedObject var viewModel: CertificatesViewModel
    @Binding var isPresented: Bool

    @State private var selectedGrade: CertificateGrade = .STANDARD
    @State private var certifyingBody = ""
    @State private var validityDays = "365"
    @State private var isIssuing = false

    var selectedEligibility: CertificateEligibility? {
        viewModel.eligibility[selectedGrade]
    }

    var canIssue: Bool {
        selectedEligibility?.canIssue == true && !certifyingBody.isEmpty
    }

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Grado del certificado")) {
                    Picker("Grado", selection: $selectedGrade) {
                        ForEach(CertificateGrade.allCases, id: \.self) { grade in
                            HStack {
                                Image(systemName: grade.icon)
                                    .foregroundColor(grade.color)
                                Text(grade.displayName)
                            }
                            .tag(grade)
                        }
                    }
                    .pickerStyle(.menu)

                    if let eligibility = selectedEligibility {
                        if eligibility.canIssue {
                            Label("Todos los requisitos cumplidos", systemImage: "checkmark.circle.fill")
                                .foregroundColor(.green)
                        } else {
                            VStack(alignment: .leading, spacing: 8) {
                                Label("Requisitos pendientes", systemImage: "exclamationmark.triangle.fill")
                                    .foregroundColor(.orange)

                                ForEach(eligibility.missingStages, id: \.self) { stage in
                                    Text("• \(stage)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }

                Section(header: Text("Información del certificado")) {
                    TextField("Organismo certificador", text: $certifyingBody)

                    HStack {
                        Text("Vigencia (días)")
                        Spacer()
                        TextField("365", text: $validityDays)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 80)
                    }
                }

                Section(header: Text("Descripción")) {
                    Text(selectedGrade.description)
                        .font(.body)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Emitir certificado")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Emitir") {
                        Task {
                            isIssuing = true
                            let days = Int(validityDays) ?? 365
                            let success = await viewModel.issueCertificate(
                                grade: selectedGrade,
                                certifyingBody: certifyingBody,
                                validityDays: days
                            )
                            isIssuing = false
                            if success { isPresented = false }
                        }
                    }
                    .disabled(!canIssue || isIssuing)
                }
            }
        }
    }
}

struct CertificateDetailSheet: View {
    let certificate: QualityCertificate
    let verification: CertificateVerification?
    @Binding var isPresented: Bool

    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .long
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Grade badge
                    VStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(certificate.grade.color.opacity(0.2))
                                .frame(width: 100, height: 100)

                            Image(systemName: certificate.grade.icon)
                                .font(.system(size: 40))
                                .foregroundColor(certificate.grade.color)
                        }

                        Text(certificate.grade.displayName)
                            .font(.title)
                            .fontWeight(.bold)

                        Text(certificate.grade.description)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 20)

                    // Verification status
                    if let verification = verification {
                        VerificationStatusCard(verification: verification)
                    } else {
                        ProgressView("Verificando autenticidad...")
                            .padding()
                    }

                    // Certificate details
                    GroupBox(label: Label("Detalles", systemImage: "doc.text")) {
                        VStack(alignment: .leading, spacing: 12) {
                            DetailRow(label: "Organismo", value: certificate.certifyingBody)
                            Divider()
                            DetailRow(label: "Válido desde", value: dateFormatter.string(from: certificate.validFrom))
                            Divider()
                            DetailRow(label: "Válido hasta", value: dateFormatter.string(from: certificate.validTo))
                            Divider()
                            DetailRow(label: "Emitido", value: dateFormatter.string(from: certificate.issuedAt))
                        }
                        .padding(.vertical, 8)
                    }

                    // Blockchain info
                    if let hash = certificate.hashOnChain {
                        GroupBox(label: Label("Blockchain", systemImage: "link")) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Hash en cadena:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)

                                Text(hash)
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundColor(.blue)
                                    .lineLimit(2)
                                    .truncationMode(.middle)
                            }
                            .padding(.vertical, 8)
                        }
                    }

                    // Actions
                    HStack(spacing: 16) {
                        Button(action: shareCertificate) {
                            Label("Compartir", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)

                        if certificate.pdfUrl != nil {
                            Button(action: downloadPDF) {
                                Label("Descargar PDF", systemImage: "arrow.down.doc")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                    .padding(.top, 8)
                }
                .padding()
            }
            .navigationTitle("Certificado")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cerrar") { isPresented = false }
                }
            }
        }
    }

    private func shareCertificate() {
        // Implementation for sharing certificate
    }

    private func downloadPDF() {
        // Implementation for downloading PDF
    }
}

struct VerificationStatusCard: View {
    let verification: CertificateVerification

    var body: some View {
        GroupBox {
            VStack(spacing: 12) {
                HStack {
                    Image(systemName: verification.isValid ? "checkmark.seal.fill" : "xmark.seal.fill")
                        .font(.title)
                        .foregroundColor(verification.isValid ? .green : .red)

                    VStack(alignment: .leading) {
                        Text(verification.isValid ? "Certificado válido" : "Certificado inválido")
                            .font(.headline)

                        Text(verification.message)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()
                }

                if let hashVerification = verification.verification {
                    Divider()

                    HStack {
                        Image(systemName: hashVerification.hashMatch ? "lock.fill" : "lock.open.fill")
                            .foregroundColor(hashVerification.hashMatch ? .green : .orange)

                        Text(hashVerification.hashMatch ? "Integridad verificada" : "Hash no coincide")
                            .font(.subheadline)

                        Spacer()
                    }
                }

                if verification.isExpired {
                    Divider()

                    HStack {
                        Image(systemName: "calendar.badge.exclamationmark")
                            .foregroundColor(.orange)

                        Text("El certificado ha expirado")
                            .font(.subheadline)

                        Spacer()
                    }
                }
            }
            .padding(.vertical, 8)
        }
    }
}

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

struct ErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 50))
                .foregroundColor(.orange)

            Text("Error")
                .font(.title2)
                .fontWeight(.semibold)

            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button("Reintentar", action: onRetry)
                .buttonStyle(.borderedProminent)
        }
    }
}

// MARK: - Preview

struct CertificatesScreen_Previews: PreviewProvider {
    static var previews: some View {
        CertificatesScreen(
            viewModel: CertificatesViewModel(
                batchId: "test-batch",
                userRole: "CERTIFIER",
                authToken: "test-token"
            )
        )
    }
}
