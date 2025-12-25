/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * iOS SwiftUI Implementation
 */

import SwiftUI
import Charts

// MARK: - Models

enum TemperatureSource: String, Codable, CaseIterable {
    case IOT_SENSOR = "IOT_SENSOR"
    case MANUAL = "MANUAL"
    case DRIVER_APP = "DRIVER_APP"

    var displayName: String {
        switch self {
        case .IOT_SENSOR: return "Sensor IoT"
        case .MANUAL: return "Manual"
        case .DRIVER_APP: return "App Conductor"
        }
    }

    var icon: String {
        switch self {
        case .IOT_SENSOR: return "sensor.fill"
        case .MANUAL: return "pencil"
        case .DRIVER_APP: return "iphone"
        }
    }
}

struct TemperatureReading: Identifiable, Codable {
    let id: String
    let batchId: String
    let value: Double
    let humidity: Double?
    let source: TemperatureSource
    let minThreshold: Double
    let maxThreshold: Double
    let isOutOfRange: Bool
    let sensorId: String?
    let deviceId: String?
    let latitude: Double?
    let longitude: Double?
    let recordedBy: String?
    let timestamp: Date
}

struct TemperatureSummary: Codable {
    let batchId: String
    let count: Int
    let minValue: Double
    let maxValue: Double
    let avgValue: Double
    let outOfRangeCount: Int
    let outOfRangePercent: Int
    let firstReading: Date?
    let lastReading: Date?
    let isCompliant: Bool
}

struct TemperatureChartData: Codable {
    let labels: [String]
    let values: [Double]
    let thresholdMin: Double
    let thresholdMax: Double
    let outOfRangeIndices: [Int]
}

struct ComplianceResult: Codable {
    let isCompliant: Bool
    let complianceScore: Int
    let recommendations: [String]
}

// MARK: - ViewModel

@MainActor
class TemperatureMonitoringViewModel: ObservableObject {
    @Published var readings: [TemperatureReading] = []
    @Published var summary: TemperatureSummary?
    @Published var chartData: TemperatureChartData?
    @Published var compliance: ComplianceResult?
    @Published var latestReading: TemperatureReading?
    @Published var isLoading = false
    @Published var error: String?
    @Published var showManualEntry = false

    private let batchId: String
    private let apiClient: APIClient

    init(batchId: String, apiClient: APIClient = .shared) {
        self.batchId = batchId
        self.apiClient = apiClient
    }

    func loadData() async {
        isLoading = true
        error = nil

        do {
            async let summaryTask = apiClient.get("/temperature/\(batchId)/summary", type: TemperatureSummary.self)
            async let readingsTask = apiClient.get("/temperature/\(batchId)/readings?limit=50", type: ReadingsResponse.self)
            async let chartTask = apiClient.get("/temperature/\(batchId)/chart?hours=24", type: TemperatureChartData.self)
            async let latestTask = apiClient.get("/temperature/\(batchId)/latest", type: TemperatureReading?.self)

            let (summaryResult, readingsResult, chartResult, latestResult) = try await (summaryTask, readingsTask, chartTask, latestTask)

            self.summary = summaryResult
            self.readings = readingsResult.readings
            self.chartData = chartResult
            self.latestReading = latestResult
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func loadCompliance() async {
        do {
            compliance = try await apiClient.get("/temperature/\(batchId)/compliance", type: ComplianceResult.self)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func recordTemperature(value: Double, humidity: Double?) async {
        do {
            let body: [String: Any] = [
                "batchId": batchId,
                "value": value,
                "humidity": humidity as Any,
                "source": TemperatureSource.DRIVER_APP.rawValue
            ]

            _ = try await apiClient.post("/temperature", body: body, type: RecordTemperatureResponse.self)
            await loadData()
            showManualEntry = false
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct ReadingsResponse: Codable {
    let readings: [TemperatureReading]
}

struct RecordTemperatureResponse: Codable {
    let reading: TemperatureReading
    let isOutOfRange: Bool
}

// MARK: - Main Screen

struct TemperatureMonitoringScreen: View {
    @StateObject private var viewModel: TemperatureMonitoringViewModel

    init(batchId: String) {
        _viewModel = StateObject(wrappedValue: TemperatureMonitoringViewModel(batchId: batchId))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if viewModel.isLoading && viewModel.summary == nil {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 200)
                    } else if let error = viewModel.error {
                        ErrorView(message: error, retryAction: {
                            Task { await viewModel.loadData() }
                        })
                    } else {
                        // Current Temperature Card
                        if let latest = viewModel.latestReading {
                            CurrentTemperatureCard(reading: latest)
                        }

                        // Summary Card
                        if let summary = viewModel.summary {
                            SummaryCard(summary: summary)
                        }

                        // Temperature Chart
                        if let chartData = viewModel.chartData, !chartData.values.isEmpty {
                            TemperatureChartCard(data: chartData)
                        }

                        // Compliance Card
                        if let compliance = viewModel.compliance {
                            ComplianceCard(compliance: compliance)
                        }

                        // Recent Readings
                        if !viewModel.readings.isEmpty {
                            RecentReadingsCard(readings: viewModel.readings)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Temperatura")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: { viewModel.showManualEntry = true }) {
                        Image(systemName: "plus.circle.fill")
                    }
                }
                ToolbarItem(placement: .secondaryAction) {
                    Button(action: { Task { await viewModel.loadCompliance() } }) {
                        Image(systemName: "checkmark.shield")
                    }
                }
            }
            .refreshable {
                await viewModel.loadData()
            }
            .sheet(isPresented: $viewModel.showManualEntry) {
                ManualTemperatureEntrySheet(viewModel: viewModel)
            }
            .task {
                await viewModel.loadData()
            }
        }
    }
}

// MARK: - Current Temperature Card

struct CurrentTemperatureCard: View {
    let reading: TemperatureReading

    private var temperatureColor: Color {
        if reading.isOutOfRange {
            return reading.value < reading.minThreshold ? .blue : .red
        }
        return .green
    }

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Image(systemName: "thermometer.medium")
                    .font(.title2)
                Text("Temperatura Actual")
                    .font(.headline)
                Spacer()
                Text(reading.timestamp, style: .time)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(alignment: .top, spacing: 8) {
                Text(String(format: "%.1f", reading.value))
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .foregroundStyle(temperatureColor)
                Text("°C")
                    .font(.title)
                    .foregroundStyle(.secondary)
            }

            if reading.isOutOfRange {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                    Text("Fuera de rango (\(Int(reading.minThreshold))°C - \(Int(reading.maxThreshold))°C)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            if let humidity = reading.humidity {
                HStack {
                    Image(systemName: "humidity.fill")
                        .foregroundStyle(.cyan)
                    Text("Humedad: \(Int(humidity))%")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            HStack {
                Label(reading.source.displayName, systemImage: reading.source.icon)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                if let sensorId = reading.sensorId {
                    Text("Sensor: \(sensorId)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Summary Card

struct SummaryCard: View {
    let summary: TemperatureSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .foregroundStyle(.blue)
                Text("Resumen")
                    .font(.headline)
                Spacer()
                StatusBadge(isCompliant: summary.isCompliant)
            }

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: 16) {
                StatItem(title: "Mínima", value: "\(String(format: "%.1f", summary.minValue))°C", color: .blue)
                StatItem(title: "Promedio", value: "\(String(format: "%.1f", summary.avgValue))°C", color: .green)
                StatItem(title: "Máxima", value: "\(String(format: "%.1f", summary.maxValue))°C", color: .red)
            }

            Divider()

            HStack {
                VStack(alignment: .leading) {
                    Text("\(summary.count)")
                        .font(.title2.bold())
                    Text("Lecturas")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text("\(summary.outOfRangeCount)")
                        .font(.title2.bold())
                        .foregroundStyle(summary.outOfRangeCount > 0 ? .red : .green)
                    Text("Fuera de rango (\(summary.outOfRangePercent)%)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct StatItem: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.headline)
                .foregroundStyle(color)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

struct StatusBadge: View {
    let isCompliant: Bool

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: isCompliant ? "checkmark.circle.fill" : "xmark.circle.fill")
            Text(isCompliant ? "Conforme" : "No Conforme")
        }
        .font(.caption.bold())
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(isCompliant ? .green : .red, in: Capsule())
    }
}

// MARK: - Temperature Chart Card

struct TemperatureChartCard: View {
    let data: TemperatureChartData

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundStyle(.purple)
                Text("Últimas 24 horas")
                    .font(.headline)
            }

            Chart {
                // Threshold range area
                RectangleMark(
                    xStart: .value("Start", 0),
                    xEnd: .value("End", data.values.count - 1),
                    yStart: .value("Min", data.thresholdMin),
                    yEnd: .value("Max", data.thresholdMax)
                )
                .foregroundStyle(.green.opacity(0.1))

                // Temperature line
                ForEach(Array(data.values.enumerated()), id: \.offset) { index, value in
                    LineMark(
                        x: .value("Index", index),
                        y: .value("Temperature", value)
                    )
                    .foregroundStyle(data.outOfRangeIndices.contains(index) ? .red : .blue)

                    PointMark(
                        x: .value("Index", index),
                        y: .value("Temperature", value)
                    )
                    .foregroundStyle(data.outOfRangeIndices.contains(index) ? .red : .blue)
                    .symbolSize(data.outOfRangeIndices.contains(index) ? 50 : 20)
                }

                // Threshold lines
                RuleMark(y: .value("Min Threshold", data.thresholdMin))
                    .foregroundStyle(.blue.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))

                RuleMark(y: .value("Max Threshold", data.thresholdMax))
                    .foregroundStyle(.red.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
            }
            .chartYAxis {
                AxisMarks(position: .leading)
            }
            .chartXAxis(.hidden)
            .frame(height: 200)

            HStack {
                Circle().fill(.blue).frame(width: 8, height: 8)
                Text("Normal")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Circle().fill(.red).frame(width: 8, height: 8)
                Text("Fuera de rango")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Rectangle().fill(.green.opacity(0.3)).frame(width: 20, height: 8)
                Text("Rango aceptable")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Compliance Card

struct ComplianceCard: View {
    let compliance: ComplianceResult

    private var scoreColor: Color {
        if compliance.complianceScore >= 90 { return .green }
        if compliance.complianceScore >= 70 { return .yellow }
        return .red
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "checkmark.shield.fill")
                    .foregroundStyle(.purple)
                Text("Cumplimiento Cadena de Frío")
                    .font(.headline)
            }

            HStack {
                CircularProgressView(progress: Double(compliance.complianceScore) / 100, color: scoreColor)
                    .frame(width: 80, height: 80)

                VStack(alignment: .leading, spacing: 4) {
                    Text("\(compliance.complianceScore)%")
                        .font(.title.bold())
                        .foregroundStyle(scoreColor)
                    Text(compliance.isCompliant ? "Cadena de frío intacta" : "Se detectaron problemas")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.leading)

                Spacer()
            }

            if !compliance.recommendations.isEmpty {
                Divider()

                VStack(alignment: .leading, spacing: 8) {
                    Text("Recomendaciones")
                        .font(.subheadline.bold())

                    ForEach(compliance.recommendations, id: \.self) { recommendation in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "lightbulb.fill")
                                .foregroundStyle(.yellow)
                                .font(.caption)
                            Text(recommendation)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct CircularProgressView: View {
    let progress: Double
    let color: Color

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.2), lineWidth: 8)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int(progress * 100))")
                .font(.headline.bold())
        }
    }
}

// MARK: - Recent Readings Card

struct RecentReadingsCard: View {
    let readings: [TemperatureReading]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "list.bullet")
                    .foregroundStyle(.orange)
                Text("Lecturas Recientes")
                    .font(.headline)
                Spacer()
                Text("\(readings.count) registros")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            ForEach(readings.prefix(10)) { reading in
                ReadingRow(reading: reading)
                if reading.id != readings.prefix(10).last?.id {
                    Divider()
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}

struct ReadingRow: View {
    let reading: TemperatureReading

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(reading.timestamp, style: .date)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(reading.timestamp, style: .time)
                    .font(.subheadline)
            }

            Spacer()

            HStack(spacing: 8) {
                if let humidity = reading.humidity {
                    HStack(spacing: 2) {
                        Image(systemName: "humidity.fill")
                            .font(.caption)
                            .foregroundStyle(.cyan)
                        Text("\(Int(humidity))%")
                            .font(.caption)
                    }
                }

                Text("\(String(format: "%.1f", reading.value))°C")
                    .font(.headline)
                    .foregroundStyle(reading.isOutOfRange ? .red : .primary)

                if reading.isOutOfRange {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                        .font(.caption)
                }
            }
        }
    }
}

// MARK: - Manual Entry Sheet

struct ManualTemperatureEntrySheet: View {
    @ObservedObject var viewModel: TemperatureMonitoringViewModel
    @State private var temperature: String = ""
    @State private var humidity: String = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Temperatura") {
                    HStack {
                        TextField("Valor", text: $temperature)
                            .keyboardType(.decimalPad)
                        Text("°C")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Humedad (Opcional)") {
                    HStack {
                        TextField("Valor", text: $humidity)
                            .keyboardType(.decimalPad)
                        Text("%")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Registrar Temperatura")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        if let temp = Double(temperature) {
                            Task {
                                await viewModel.recordTemperature(
                                    value: temp,
                                    humidity: Double(humidity)
                                )
                            }
                        }
                    }
                    .disabled(Double(temperature) == nil)
                }
            }
        }
    }
}

// MARK: - Error View

struct ErrorView: View {
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
    TemperatureMonitoringScreen(batchId: "batch-123")
}
