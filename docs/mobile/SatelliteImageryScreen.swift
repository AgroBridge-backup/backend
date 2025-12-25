/**
 * Traceability 2.0 - Satellite Imagery Time-Lapse
 * iOS SwiftUI Implementation
 */

import SwiftUI
import Charts
import MapKit

// MARK: - Models

enum ImageryType: String, Codable, CaseIterable {
    case RGB = "RGB"
    case NDVI = "NDVI"
    case NDWI = "NDWI"
    case EVI = "EVI"
    case FALSE_COLOR = "FALSE_COLOR"

    var displayName: String {
        switch self {
        case .RGB: return "Color Real"
        case .NDVI: return "NDVI"
        case .NDWI: return "NDWI"
        case .EVI: return "EVI"
        case .FALSE_COLOR: return "Falso Color"
        }
    }
}

struct Field: Identifiable, Codable {
    let id: String
    let producerId: String
    let name: String
    let description: String?
    let cropType: String?
    let areaHectares: Double
    let centroidLatitude: Double
    let centroidLongitude: Double
}

struct FieldImagery: Identifiable, Codable {
    let id: String
    let fieldId: String
    let imageType: ImageryType
    let captureDate: Date
    let cloudCoverPercent: Double
    let imageUrl: String
    let thumbnailUrl: String?
    let ndviValue: Double?
    let healthScore: Int?
}

struct TimeLapse: Codable {
    let fieldId: String
    let startDate: Date
    let endDate: Date
    let imageType: ImageryType
    let frames: [TimeLapseFrame]
    let frameCount: Int
    let averageNdvi: Double?
    let ndviTrend: String
    let healthTrend: String
}

struct TimeLapseFrame: Identifiable, Codable {
    let date: Date
    let imageUrl: String
    let ndviValue: Double?
    let healthScore: Int?
    let cloudCoverPercent: Double

    var id: Date { date }
}

struct HealthAnalysis: Codable {
    let fieldId: String
    let analysisDate: Date
    let overallHealthScore: Int
    let ndviAverage: Double
    let ndviMin: Double
    let ndviMax: Double
    let healthDistribution: HealthDistribution
    let recommendations: [String]
}

struct HealthDistribution: Codable {
    let excellent: Double
    let good: Double
    let fair: Double
    let poor: Double
    let critical: Double
}

struct NdviDataPoint: Identifiable {
    let date: Date
    let ndviValue: Double

    var id: Date { date }
}

// MARK: - ViewModel

@MainActor
class SatelliteImageryViewModel: ObservableObject {
    @Published var fields: [Field] = []
    @Published var selectedField: Field?
    @Published var imagery: [FieldImagery] = []
    @Published var timeLapse: TimeLapse?
    @Published var healthAnalysis: HealthAnalysis?
    @Published var ndviSeries: [NdviDataPoint] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var currentFrameIndex = 0
    @Published var isPlayingTimeLapse = false

    private let apiClient: APIClient
    private var timeLapseTimer: Timer?

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func loadFields(producerId: String) async {
        isLoading = true
        error = nil

        do {
            fields = try await apiClient.get("/satellite/producers/\(producerId)/fields", type: [Field].self)
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func loadFieldData(fieldId: String) async {
        isLoading = true
        error = nil

        do {
            async let imageryTask = apiClient.get("/satellite/fields/\(fieldId)/imagery", type: [FieldImagery].self)
            async let healthTask = apiClient.get("/satellite/fields/\(fieldId)/health", type: HealthAnalysis.self)
            async let seriesTask = apiClient.get("/satellite/fields/\(fieldId)/ndvi-series?days=90", type: NdviSeriesResponse.self)

            let (imageryResult, healthResult, seriesResult) = try await (imageryTask, healthTask, seriesTask)

            self.imagery = imageryResult
            self.healthAnalysis = healthResult
            self.ndviSeries = seriesResult.series.compactMap { point in
                guard let value = point.ndviValue else { return nil }
                return NdviDataPoint(date: point.date, ndviValue: value)
            }
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func loadTimeLapse(fieldId: String, days: Int = 180) async {
        do {
            let endDate = Date()
            let startDate = Calendar.current.date(byAdding: .day, value: -days, to: endDate)!
            let formatter = ISO8601DateFormatter()

            let url = "/satellite/fields/\(fieldId)/time-lapse?startDate=\(formatter.string(from: startDate))&endDate=\(formatter.string(from: endDate))"
            let response = try await apiClient.get(url, type: TimeLapseResponse.self)
            self.timeLapse = response.timeLapse
            self.currentFrameIndex = 0
        } catch {
            self.error = error.localizedDescription
        }
    }

    func playTimeLapse() {
        guard let timeLapse = timeLapse, timeLapse.frames.count > 1 else { return }

        isPlayingTimeLapse = true
        timeLapseTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                self.currentFrameIndex = (self.currentFrameIndex + 1) % timeLapse.frames.count
                if self.currentFrameIndex == 0 {
                    self.stopTimeLapse()
                }
            }
        }
    }

    func stopTimeLapse() {
        isPlayingTimeLapse = false
        timeLapseTimer?.invalidate()
        timeLapseTimer = nil
    }
}

struct NdviSeriesResponse: Codable {
    let series: [NdviPoint]
}

struct NdviPoint: Codable {
    let date: Date
    let ndviValue: Double?
}

struct TimeLapseResponse: Codable {
    let timeLapse: TimeLapse
}

// MARK: - Main Screen

struct SatelliteImageryScreen: View {
    @StateObject private var viewModel = SatelliteImageryViewModel()
    let producerId: String

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if viewModel.isLoading && viewModel.fields.isEmpty {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 200)
                    } else if let error = viewModel.error {
                        ErrorView(message: error, retryAction: {
                            Task { await viewModel.loadFields(producerId: producerId) }
                        })
                    } else {
                        // Field Selector
                        FieldSelectorCard(
                            fields: viewModel.fields,
                            selectedField: $viewModel.selectedField
                        )

                        if let field = viewModel.selectedField {
                            // Health Overview
                            if let health = viewModel.healthAnalysis {
                                HealthOverviewCard(analysis: health)
                            }

                            // NDVI Chart
                            if !viewModel.ndviSeries.isEmpty {
                                NdviChartCard(series: viewModel.ndviSeries)
                            }

                            // Time-Lapse Player
                            if let timeLapse = viewModel.timeLapse, !timeLapse.frames.isEmpty {
                                TimeLapseCard(
                                    timeLapse: timeLapse,
                                    currentIndex: viewModel.currentFrameIndex,
                                    isPlaying: viewModel.isPlayingTimeLapse,
                                    onPlay: { viewModel.playTimeLapse() },
                                    onStop: { viewModel.stopTimeLapse() },
                                    onSeek: { viewModel.currentFrameIndex = $0 }
                                )
                            }

                            // Recent Imagery
                            if !viewModel.imagery.isEmpty {
                                RecentImageryCard(imagery: viewModel.imagery)
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Imágenes Satelitales")
            .task {
                await viewModel.loadFields(producerId: producerId)
            }
            .onChange(of: viewModel.selectedField) { _, newField in
                if let field = newField {
                    Task {
                        await viewModel.loadFieldData(fieldId: field.id)
                        await viewModel.loadTimeLapse(fieldId: field.id)
                    }
                }
            }
        }
    }
}

// MARK: - Field Selector Card

struct FieldSelectorCard: View {
    let fields: [Field]
    @Binding var selectedField: Field?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "map")
                    .foregroundStyle(.green)
                Text("Seleccionar Campo")
                    .font(.headline)
            }

            if fields.isEmpty {
                Text("No hay campos registrados")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(fields) { field in
                    Button(action: { selectedField = field }) {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(field.name)
                                    .fontWeight(.medium)
                                Text("\(String(format: "%.1f", field.areaHectares)) ha")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if selectedField?.id == field.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Health Overview Card

struct HealthOverviewCard: View {
    let analysis: HealthAnalysis

    private var scoreColor: Color {
        if analysis.overallHealthScore >= 80 { return .green }
        if analysis.overallHealthScore >= 60 { return .yellow }
        if analysis.overallHealthScore >= 40 { return .orange }
        return .red
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "leaf.fill")
                    .foregroundStyle(.green)
                Text("Salud del Cultivo")
                    .font(.headline)
            }

            HStack(spacing: 24) {
                // Score
                VStack {
                    Text("\(analysis.overallHealthScore)")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundStyle(scoreColor)
                    Text("Puntuación")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Divider()
                    .frame(height: 60)

                // NDVI Stats
                VStack(alignment: .leading, spacing: 4) {
                    StatRow(label: "NDVI Promedio", value: String(format: "%.3f", analysis.ndviAverage))
                    StatRow(label: "NDVI Mín", value: String(format: "%.3f", analysis.ndviMin))
                    StatRow(label: "NDVI Máx", value: String(format: "%.3f", analysis.ndviMax))
                }

                Spacer()
            }

            // Recommendations
            if !analysis.recommendations.isEmpty {
                Divider()
                ForEach(analysis.recommendations, id: \.self) { rec in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "lightbulb.fill")
                            .foregroundStyle(.yellow)
                            .font(.caption)
                        Text(rec)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct StatRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.caption.monospacedDigit())
                .fontWeight(.medium)
        }
    }
}

// MARK: - NDVI Chart Card

struct NdviChartCard: View {
    let series: [NdviDataPoint]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundStyle(.purple)
                Text("Evolución NDVI")
                    .font(.headline)
            }

            Chart(series) { point in
                LineMark(
                    x: .value("Fecha", point.date),
                    y: .value("NDVI", point.ndviValue)
                )
                .foregroundStyle(.green)

                AreaMark(
                    x: .value("Fecha", point.date),
                    y: .value("NDVI", point.ndviValue)
                )
                .foregroundStyle(.green.opacity(0.1))

                PointMark(
                    x: .value("Fecha", point.date),
                    y: .value("NDVI", point.ndviValue)
                )
                .foregroundStyle(.green)
            }
            .chartYScale(domain: 0...1)
            .chartYAxis {
                AxisMarks(position: .leading)
            }
            .frame(height: 200)
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Time-Lapse Card

struct TimeLapseCard: View {
    let timeLapse: TimeLapse
    let currentIndex: Int
    let isPlaying: Bool
    let onPlay: () -> Void
    let onStop: () -> Void
    let onSeek: (Int) -> Void

    private var currentFrame: TimeLapseFrame? {
        guard currentIndex < timeLapse.frames.count else { return nil }
        return timeLapse.frames[currentIndex]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "film")
                    .foregroundStyle(.blue)
                Text("Time-Lapse")
                    .font(.headline)
                Spacer()
                Text("\(timeLapse.frameCount) imágenes")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Image Display
            if let frame = currentFrame {
                AsyncImage(url: URL(string: frame.imageUrl)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(.gray.opacity(0.2))
                        .overlay(ProgressView())
                }
                .frame(height: 200)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    VStack {
                        Spacer()
                        HStack {
                            Text(frame.date, style: .date)
                                .font(.caption.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(.ultraThinMaterial, in: Capsule())
                            Spacer()
                            if let ndvi = frame.ndviValue {
                                Text("NDVI: \(String(format: "%.2f", ndvi))")
                                    .font(.caption.bold())
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(.ultraThinMaterial, in: Capsule())
                            }
                        }
                        .padding(8)
                    }
                )
            }

            // Controls
            HStack {
                Button(action: isPlaying ? onStop : onPlay) {
                    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                        .font(.title2)
                }
                .buttonStyle(.bordered)

                Slider(
                    value: Binding(
                        get: { Double(currentIndex) },
                        set: { onSeek(Int($0)) }
                    ),
                    in: 0...Double(max(0, timeLapse.frames.count - 1)),
                    step: 1
                )

                Text("\(currentIndex + 1)/\(timeLapse.frames.count)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }

            // Trend indicators
            HStack {
                Label(timeLapse.ndviTrend, systemImage: trendIcon(timeLapse.ndviTrend))
                    .font(.caption)
                    .foregroundStyle(trendColor(timeLapse.ndviTrend))
                Spacer()
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private func trendIcon(_ trend: String) -> String {
        switch trend {
        case "IMPROVING": return "arrow.up.right"
        case "DECLINING": return "arrow.down.right"
        case "STABLE": return "arrow.right"
        default: return "questionmark"
        }
    }

    private func trendColor(_ trend: String) -> Color {
        switch trend {
        case "IMPROVING": return .green
        case "DECLINING": return .red
        case "STABLE": return .blue
        default: return .gray
        }
    }
}

// MARK: - Recent Imagery Card

struct RecentImageryCard: View {
    let imagery: [FieldImagery]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "photo.stack")
                    .foregroundStyle(.orange)
                Text("Imágenes Recientes")
                    .font(.headline)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(imagery.prefix(10)) { img in
                        ImageryThumbnail(imagery: img)
                    }
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct ImageryThumbnail: View {
    let imagery: FieldImagery

    var body: some View {
        VStack(spacing: 4) {
            AsyncImage(url: URL(string: imagery.thumbnailUrl ?? imagery.imageUrl)) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Rectangle()
                    .fill(.gray.opacity(0.2))
            }
            .frame(width: 100, height: 100)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            Text(imagery.captureDate, style: .date)
                .font(.caption2)
                .foregroundStyle(.secondary)

            Text(imagery.imageType.displayName)
                .font(.caption2)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Error View

struct SatelliteErrorView: View {
    let message: String
    let retryAction: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "satellite")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
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
    SatelliteImageryScreen(producerId: "producer-123")
}
