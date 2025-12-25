/**
 * Farmer Storytelling & Consumer-Facing Traceability
 * iOS SwiftUI Implementation
 *
 * Features:
 * - Generate QR code for batch sharing
 * - Preview public traceability page
 * - Share via native share sheet
 * - View scan analytics
 * - Deep link to public web pages
 */

import SwiftUI
import Foundation
import CoreImage.CIFilterBuiltins

// MARK: - Models

struct PublicLink: Identifiable, Codable {
    let id: String
    let publicUrl: String
    let shortCode: String
    let qrImageUrl: String?
    let viewCount: Int
    let createdAt: Date

    var shareUrl: URL? {
        URL(string: publicUrl)
    }
}

struct ScanAnalytics: Codable {
    let shortCode: String
    let batchId: String
    let totalScans: Int
    let uniqueCountries: Int
    let scansByCountry: [CountryScan]
    let scansByDevice: [DeviceScan]
    let scansByDay: [DailyScan]
    let last30DaysScans: Int
    let lastScanAt: Date?
}

struct CountryScan: Codable, Identifiable {
    let country: String
    let count: Int

    var id: String { country }
}

struct DeviceScan: Codable, Identifiable {
    let device: String
    let count: Int

    var id: String { device }
}

struct DailyScan: Codable, Identifiable {
    let date: String
    let count: Int

    var id: String { date }
}

struct BatchPreview: Codable {
    let id: String
    let product: String
    let variety: String?
    let farmerName: String
    let region: String
    let harvestDate: Date
    let status: String
}

// MARK: - Service

class PublicTraceabilityService: ObservableObject {
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

    func generatePublicLink(batchId: String) async throws -> PublicLink {
        guard let url = URL(string: "\(baseURL)/api/v1/batches/\(batchId)/public-link") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 || httpResponse.statusCode == 201 else {
            throw URLError(.badServerResponse)
        }

        struct Response: Codable {
            let success: Bool
            let data: PublicLinkData
        }
        struct PublicLinkData: Codable {
            let publicUrl: String
            let shortCode: String
            let qrImageUrl: String?
            let viewCount: Int
            let createdAt: Date
        }

        let result = try decoder.decode(Response.self, from: data)
        return PublicLink(
            id: result.data.shortCode,
            publicUrl: result.data.publicUrl,
            shortCode: result.data.shortCode,
            qrImageUrl: result.data.qrImageUrl,
            viewCount: result.data.viewCount,
            createdAt: result.data.createdAt
        )
    }

    func getScanAnalytics(batchId: String) async throws -> ScanAnalytics {
        guard let url = URL(string: "\(baseURL)/api/v1/batches/\(batchId)/public-stats") else {
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
            let data: ScanAnalytics
        }

        let result = try decoder.decode(Response.self, from: data)
        return result.data
    }
}

// MARK: - QR Code Generator

struct QRCodeGenerator {
    static func generate(from string: String, size: CGFloat = 200) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()

        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"

        guard let outputImage = filter.outputImage else { return nil }

        let scale = size / outputImage.extent.size.width
        let scaledImage = outputImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}

// MARK: - ViewModel

@MainActor
class PublicTraceabilityViewModel: ObservableObject {
    @Published var publicLink: PublicLink?
    @Published var analytics: ScanAnalytics?
    @Published var qrImage: UIImage?
    @Published var isLoading = false
    @Published var error: String?
    @Published var showShareSheet = false

    private let service: PublicTraceabilityService
    let batch: BatchPreview

    init(batch: BatchPreview, authToken: String) {
        self.batch = batch
        self.service = PublicTraceabilityService(authToken: authToken)
    }

    func loadOrGenerateLink() async {
        isLoading = true
        error = nil

        do {
            publicLink = try await service.generatePublicLink(batchId: batch.id)

            if let url = publicLink?.publicUrl {
                qrImage = QRCodeGenerator.generate(from: url, size: 300)
            }

            // Load analytics if link exists
            if publicLink != nil {
                analytics = try await service.getScanAnalytics(batchId: batch.id)
            }
        } catch {
            self.error = "Error al generar enlace: \(error.localizedDescription)"
        }

        isLoading = false
    }

    func refreshAnalytics() async {
        do {
            analytics = try await service.getScanAnalytics(batchId: batch.id)
        } catch {
            // Silently fail analytics refresh
            print("Failed to refresh analytics: \(error)")
        }
    }

    var shareItems: [Any] {
        var items: [Any] = []

        if let url = publicLink?.shareUrl {
            let text = "Conoce el origen de este \(batch.product) de \(batch.farmerName): \(url.absoluteString)"
            items.append(text)
        }

        if let qr = qrImage {
            items.append(qr)
        }

        return items
    }
}

// MARK: - Views

struct PublicTraceabilityShareView: View {
    @StateObject var viewModel: PublicTraceabilityViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if viewModel.isLoading && viewModel.publicLink == nil {
                    LoadingView()
                } else if let error = viewModel.error, viewModel.publicLink == nil {
                    ErrorView(message: error) {
                        Task { await viewModel.loadOrGenerateLink() }
                    }
                } else if let link = viewModel.publicLink {
                    QRCodeCard(
                        link: link,
                        qrImage: viewModel.qrImage,
                        batch: viewModel.batch,
                        onShare: { viewModel.showShareSheet = true }
                    )

                    if let analytics = viewModel.analytics {
                        AnalyticsCard(analytics: analytics)
                    }

                    ActionButtons(
                        publicUrl: link.publicUrl,
                        onShare: { viewModel.showShareSheet = true }
                    )
                }
            }
            .padding()
        }
        .navigationTitle("Compartir trazabilidad")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadOrGenerateLink()
        }
        .refreshable {
            await viewModel.refreshAnalytics()
        }
        .sheet(isPresented: $viewModel.showShareSheet) {
            ActivityViewController(items: viewModel.shareItems)
        }
    }
}

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)

            Text("Generando enlace público...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 300)
    }
}

struct QRCodeCard: View {
    let link: PublicLink
    let qrImage: UIImage?
    let batch: BatchPreview
    let onShare: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            // Product header
            VStack(spacing: 8) {
                Text(batch.product)
                    .font(.title2)
                    .fontWeight(.bold)

                HStack {
                    Image(systemName: "person.fill")
                        .foregroundColor(.green)
                    Text(batch.farmerName)

                    Text("•")
                        .foregroundColor(.secondary)

                    Image(systemName: "mappin")
                        .foregroundColor(.green)
                    Text(batch.region)
                }
                .font(.subheadline)
                .foregroundColor(.secondary)
            }

            // QR Code
            if let qrImage = qrImage {
                Image(uiImage: qrImage)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 220, height: 220)
                    .padding()
                    .background(Color.white)
                    .cornerRadius(16)
                    .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
            } else {
                Rectangle()
                    .fill(Color.gray.opacity(0.1))
                    .frame(width: 220, height: 220)
                    .cornerRadius(16)
                    .overlay(
                        ProgressView()
                    )
            }

            // Short code
            VStack(spacing: 4) {
                Text("Código: \(link.shortCode)")
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(.primary)

                Text("Escanea el código QR para ver la trazabilidad completa")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            // View count
            HStack {
                Image(systemName: "eye.fill")
                    .foregroundColor(.blue)
                Text("\(link.viewCount) visitas")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.blue.opacity(0.1))
            .cornerRadius(20)
        }
        .padding(24)
        .background(Color(.systemBackground))
        .cornerRadius(20)
        .shadow(color: .black.opacity(0.05), radius: 15, x: 0, y: 5)
    }
}

struct AnalyticsCard: View {
    let analytics: ScanAnalytics

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .foregroundColor(.blue)
                Text("Estadísticas de escaneo")
                    .font(.headline)
            }

            // Stats grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: 16) {
                StatBox(
                    value: "\(analytics.totalScans)",
                    label: "Total escaneos",
                    icon: "qrcode.viewfinder",
                    color: .blue
                )

                StatBox(
                    value: "\(analytics.last30DaysScans)",
                    label: "Últimos 30 días",
                    icon: "calendar",
                    color: .green
                )

                StatBox(
                    value: "\(analytics.uniqueCountries)",
                    label: "Países",
                    icon: "globe",
                    color: .purple
                )

                if let lastScan = analytics.lastScanAt {
                    StatBox(
                        value: timeAgo(from: lastScan),
                        label: "Último escaneo",
                        icon: "clock.fill",
                        color: .orange
                    )
                }
            }

            // Top countries
            if !analytics.scansByCountry.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Países principales")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    ForEach(analytics.scansByCountry.prefix(3)) { scan in
                        HStack {
                            Text(countryFlag(for: scan.country))
                            Text(scan.country)
                            Spacer()
                            Text("\(scan.count)")
                                .fontWeight(.medium)
                        }
                        .font(.subheadline)
                    }
                }
                .padding(.top, 8)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 3)
    }

    private func timeAgo(from date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func countryFlag(for code: String) -> String {
        // Convert country code to flag emoji
        let base: UInt32 = 127397
        var flag = ""
        for scalar in code.uppercased().unicodeScalars {
            if let unicode = UnicodeScalar(base + scalar.value) {
                flag.append(Character(unicode))
            }
        }
        return flag.isEmpty ? "🌍" : flag
    }
}

struct StatBox: View {
    let value: String
    let label: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.title3)
                .fontWeight(.bold)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(12)
    }
}

struct ActionButtons: View {
    let publicUrl: String
    let onShare: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            // Share button
            Button(action: onShare) {
                HStack {
                    Image(systemName: "square.and.arrow.up")
                    Text("Compartir")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.green)
                .foregroundColor(.white)
                .cornerRadius(12)
            }

            // Copy link button
            Button(action: { copyToClipboard(publicUrl) }) {
                HStack {
                    Image(systemName: "doc.on.doc")
                    Text("Copiar enlace")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.systemGray5))
                .foregroundColor(.primary)
                .cornerRadius(12)
            }

            // Open in browser
            if let url = URL(string: publicUrl) {
                Link(destination: url) {
                    HStack {
                        Image(systemName: "safari")
                        Text("Ver página pública")
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.systemGray5))
                    .foregroundColor(.primary)
                    .cornerRadius(12)
                }
            }
        }
    }

    private func copyToClipboard(_ text: String) {
        UIPasteboard.general.string = text
        // Haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }
}

// MARK: - Activity View Controller

struct ActivityViewController: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(
            activityItems: items,
            applicationActivities: nil
        )
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Error View

struct PublicTraceabilityErrorView: View {
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
        .frame(maxWidth: .infinity, minHeight: 300)
    }
}

// MARK: - Preview

struct PublicTraceabilityShareView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            PublicTraceabilityShareView(
                viewModel: PublicTraceabilityViewModel(
                    batch: BatchPreview(
                        id: "test-batch",
                        product: "Aguacate Hass",
                        variety: "Hass Premium",
                        farmerName: "María García",
                        region: "Michoacán, México",
                        harvestDate: Date(),
                        status: "HARVESTED"
                    ),
                    authToken: "test-token"
                )
            )
        }
    }
}
