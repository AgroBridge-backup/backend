/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * iOS SwiftUI Implementation
 *
 * Features:
 * - View transit sessions for a batch
 * - Start/complete transit
 * - Real-time GPS location updates
 * - Map view with route and current position
 * - Route deviation alerts
 */

import SwiftUI
import MapKit
import CoreLocation

// MARK: - Models

enum TransitStatus: String, Codable {
    case SCHEDULED, IN_TRANSIT, PAUSED, DELAYED, COMPLETED, CANCELLED

    var displayName: String {
        switch self {
        case .SCHEDULED: return "Programado"
        case .IN_TRANSIT: return "En tránsito"
        case .PAUSED: return "Pausado"
        case .DELAYED: return "Retrasado"
        case .COMPLETED: return "Completado"
        case .CANCELLED: return "Cancelado"
        }
    }

    var color: Color {
        switch self {
        case .SCHEDULED: return .gray
        case .IN_TRANSIT: return .blue
        case .PAUSED: return .orange
        case .DELAYED: return .red
        case .COMPLETED: return .green
        case .CANCELLED: return .brown
        }
    }

    var icon: String {
        switch self {
        case .SCHEDULED: return "clock"
        case .IN_TRANSIT: return "truck.box"
        case .PAUSED: return "pause.circle"
        case .DELAYED: return "exclamationmark.triangle"
        case .COMPLETED: return "checkmark.circle"
        case .CANCELLED: return "xmark.circle"
        }
    }
}

struct TransitSession: Identifiable, Codable {
    let id: String
    let batchId: String
    let status: TransitStatus
    let driverId: String
    let vehicleId: String?
    let originName: String
    let originLat: Double
    let originLng: Double
    let destinationName: String
    let destinationLat: Double
    let destinationLng: Double
    let scheduledDeparture: Date?
    let actualDeparture: Date?
    let scheduledArrival: Date?
    let actualArrival: Date?
    let estimatedArrival: Date?
    let totalDistanceKm: Double?
    let distanceTraveledKm: Double?
    let progressPercent: Int?
    let lastLocation: TransitLocation?
}

struct TransitLocation: Identifiable, Codable {
    let id: String
    let sessionId: String
    let latitude: Double
    let longitude: Double
    let speed: Double?
    let heading: Double?
    let isOffRoute: Bool
    let deviationKm: Double?
    let timestamp: Date
}

// MARK: - ViewModel

@MainActor
class TransitTrackingViewModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var sessions: [TransitSession] = []
    @Published var activeSession: TransitSession?
    @Published var locations: [TransitLocation] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var isTracking = false

    private let locationManager = CLLocationManager()
    private let batchId: String
    private let authToken: String
    private let baseURL: String
    private var locationTimer: Timer?

    init(batchId: String, authToken: String) {
        self.batchId = batchId
        self.authToken = authToken
        self.baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "https://api.agrobridge.com"
        super.init()

        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func loadSessions() async {
        isLoading = true
        error = nil

        do {
            guard let url = URL(string: "\(baseURL)/api/v1/batches/\(batchId)/transit") else {
                throw URLError(.badURL)
            }

            var request = URLRequest(url: url)
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

            let (data, _) = try await URLSession.shared.data(for: request)

            struct Response: Codable {
                let success: Bool
                let data: DataWrapper
            }
            struct DataWrapper: Codable {
                let sessions: [TransitSession]
            }

            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let result = try decoder.decode(Response.self, from: data)
            sessions = result.data.sessions

            // Find active session
            activeSession = sessions.first {
                [.SCHEDULED, .IN_TRANSIT, .PAUSED, .DELAYED].contains($0.status)
            }
        } catch {
            self.error = "Error loading sessions: \(error.localizedDescription)"
        }

        isLoading = false
    }

    func startTransit() async {
        guard let session = activeSession else { return }

        do {
            guard let url = URL(string: "\(baseURL)/api/v1/transit/\(session.id)/start") else { return }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

            let (data, _) = try await URLSession.shared.data(for: request)

            struct Response: Codable {
                let data: TransitSession
            }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let result = try decoder.decode(Response.self, from: data)
            activeSession = result.data

            // Start location tracking
            startLocationTracking()
        } catch {
            self.error = "Error starting transit: \(error.localizedDescription)"
        }
    }

    func completeTransit() async {
        guard let session = activeSession else { return }

        do {
            guard let url = URL(string: "\(baseURL)/api/v1/transit/\(session.id)/complete") else { return }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

            let (data, _) = try await URLSession.shared.data(for: request)

            struct Response: Codable {
                let data: TransitSession
            }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let result = try decoder.decode(Response.self, from: data)
            activeSession = result.data

            stopLocationTracking()
        } catch {
            self.error = "Error completing transit: \(error.localizedDescription)"
        }
    }

    func startLocationTracking() {
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
        isTracking = true

        // Send location updates every 30 seconds
        locationTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.sendLocationUpdate()
        }
    }

    func stopLocationTracking() {
        locationManager.stopUpdatingLocation()
        locationTimer?.invalidate()
        locationTimer = nil
        isTracking = false
    }

    private func sendLocationUpdate() {
        guard let session = activeSession,
              let location = locationManager.location else { return }

        Task {
            do {
                guard let url = URL(string: "\(baseURL)/api/v1/transit/\(session.id)/location") else { return }

                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")

                let body: [String: Any] = [
                    "latitude": location.coordinate.latitude,
                    "longitude": location.coordinate.longitude,
                    "altitude": location.altitude,
                    "accuracy": location.horizontalAccuracy,
                    "speed": max(0, location.speed * 3.6), // Convert m/s to km/h
                    "heading": location.course
                ]
                request.httpBody = try JSONSerialization.data(withJSONObject: body)

                let (_, _) = try await URLSession.shared.data(for: request)
            } catch {
                print("Error sending location: \(error)")
            }
        }
    }

    // CLLocationManagerDelegate
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        // Location updates handled by timer
    }
}

// MARK: - Views

struct TransitTrackingScreen: View {
    @StateObject var viewModel: TransitTrackingViewModel
    @State private var showMap = false

    var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading && viewModel.sessions.isEmpty {
                    ProgressView("Cargando sesiones...")
                } else if let session = viewModel.activeSession {
                    ActiveTransitView(session: session, viewModel: viewModel)
                } else if viewModel.sessions.isEmpty {
                    EmptyTransitView()
                } else {
                    TransitHistoryList(sessions: viewModel.sessions)
                }
            }
            .navigationTitle("Tránsito")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if viewModel.activeSession != nil {
                        Button(action: { showMap = true }) {
                            Image(systemName: "map")
                        }
                    }
                }
            }
            .sheet(isPresented: $showMap) {
                if let session = viewModel.activeSession {
                    TransitMapView(session: session)
                }
            }
        }
        .task {
            await viewModel.loadSessions()
        }
    }
}

struct ActiveTransitView: View {
    let session: TransitSession
    @ObservedObject var viewModel: TransitTrackingViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Status Card
                TransitStatusCard(session: session)

                // Progress
                if let progress = session.progressPercent {
                    ProgressView(value: Double(progress) / 100) {
                        HStack {
                            Text("\(progress)% completado")
                            Spacer()
                            if let remaining = session.totalDistanceKm.map({ $0 - (session.distanceTraveledKm ?? 0) }) {
                                Text(String(format: "%.1f km restantes", remaining))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding()
                }

                // Route Info
                RouteInfoCard(session: session)

                // ETA
                if let eta = session.estimatedArrival {
                    HStack {
                        Image(systemName: "clock")
                            .foregroundColor(.blue)
                        Text("Llegada estimada:")
                        Spacer()
                        Text(eta, style: .time)
                            .fontWeight(.medium)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    .padding(.horizontal)
                }

                // Actions
                TransitActionButtons(session: session, viewModel: viewModel)
            }
            .padding(.vertical)
        }
    }
}

struct TransitStatusCard: View {
    let session: TransitSession

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(session.status.color.opacity(0.2))
                    .frame(width: 80, height: 80)

                Image(systemName: session.status.icon)
                    .font(.system(size: 36))
                    .foregroundColor(session.status.color)
            }

            Text(session.status.displayName)
                .font(.title2)
                .fontWeight(.bold)
        }
        .padding()
    }
}

struct RouteInfoCard: View {
    let session: TransitSession

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                Image(systemName: "circle.fill")
                    .foregroundColor(.green)
                    .font(.caption)
                VStack(alignment: .leading) {
                    Text("Origen")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(session.originName)
                        .fontWeight(.medium)
                }
                Spacer()
            }

            Rectangle()
                .fill(Color.gray.opacity(0.3))
                .frame(width: 2, height: 30)
                .padding(.leading, 4)

            HStack(alignment: .top) {
                Image(systemName: "mappin.circle.fill")
                    .foregroundColor(.red)
                    .font(.caption)
                VStack(alignment: .leading) {
                    Text("Destino")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(session.destinationName)
                        .fontWeight(.medium)
                }
                Spacer()
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }
}

struct TransitActionButtons: View {
    let session: TransitSession
    @ObservedObject var viewModel: TransitTrackingViewModel

    var body: some View {
        VStack(spacing: 12) {
            if session.status == .SCHEDULED {
                Button(action: {
                    Task { await viewModel.startTransit() }
                }) {
                    Label("Iniciar tránsito", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
            }

            if session.status == .IN_TRANSIT {
                Button(action: {
                    Task { await viewModel.completeTransit() }
                }) {
                    Label("Completar entrega", systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }

                if viewModel.isTracking {
                    HStack {
                        Image(systemName: "location.fill")
                            .foregroundColor(.blue)
                        Text("Rastreo GPS activo")
                            .foregroundColor(.secondary)
                    }
                    .font(.caption)
                }
            }
        }
        .padding(.horizontal)
    }
}

struct TransitMapView: View {
    let session: TransitSession
    @State private var region: MKCoordinateRegion

    init(session: TransitSession) {
        self.session = session
        let center = CLLocationCoordinate2D(
            latitude: (session.originLat + session.destinationLat) / 2,
            longitude: (session.originLng + session.destinationLng) / 2
        )
        _region = State(initialValue: MKCoordinateRegion(
            center: center,
            span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5)
        ))
    }

    var body: some View {
        Map(coordinateRegion: $region, annotationItems: annotations) { item in
            MapAnnotation(coordinate: item.coordinate) {
                Image(systemName: item.icon)
                    .foregroundColor(item.color)
                    .padding(8)
                    .background(Circle().fill(.white))
                    .shadow(radius: 2)
            }
        }
        .ignoresSafeArea()
    }

    var annotations: [MapPoint] {
        var points: [MapPoint] = [
            MapPoint(
                id: "origin",
                coordinate: CLLocationCoordinate2D(latitude: session.originLat, longitude: session.originLng),
                icon: "circle.fill",
                color: .green
            ),
            MapPoint(
                id: "destination",
                coordinate: CLLocationCoordinate2D(latitude: session.destinationLat, longitude: session.destinationLng),
                icon: "mappin.circle.fill",
                color: .red
            )
        ]

        if let location = session.lastLocation {
            points.append(MapPoint(
                id: "current",
                coordinate: CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude),
                icon: "truck.box.fill",
                color: .blue
            ))
        }

        return points
    }
}

struct MapPoint: Identifiable {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let icon: String
    let color: Color
}

struct EmptyTransitView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "truck.box")
                .font(.system(size: 60))
                .foregroundColor(.gray)
            Text("Sin sesiones de tránsito")
                .font(.title2)
            Text("Crea una sesión desde la app de administración")
                .foregroundColor(.secondary)
        }
    }
}

struct TransitHistoryList: View {
    let sessions: [TransitSession]

    var body: some View {
        List(sessions) { session in
            TransitSessionRow(session: session)
        }
        .listStyle(.insetGrouped)
    }
}

struct TransitSessionRow: View {
    let session: TransitSession

    var body: some View {
        HStack {
            Image(systemName: session.status.icon)
                .foregroundColor(session.status.color)
                .frame(width: 40)

            VStack(alignment: .leading) {
                Text("\(session.originName) → \(session.destinationName)")
                    .fontWeight(.medium)
                    .lineLimit(1)
                Text(session.status.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            if let distance = session.totalDistanceKm {
                Text(String(format: "%.0f km", distance))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
