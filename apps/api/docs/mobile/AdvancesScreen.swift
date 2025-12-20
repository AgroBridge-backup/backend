/**
 * AgroBridge iOS - My Advances Screen
 * SwiftUI Implementation
 *
 * Features:
 * - List of active advances with status
 * - Balance summary
 * - Payment actions
 * - Pull to refresh
 * - Offline caching
 */

import SwiftUI

// MARK: - Models

struct Advance: Identifiable, Codable {
    let id: String
    let contractNumber: String
    let amount: Double
    let remaining: Double
    let dueDate: Date
    let status: AdvanceStatus
    let daysUntilDue: Int

    enum AdvanceStatus: String, Codable {
        case active = "ACTIVE"
        case overdue = "OVERDUE"
        case paid = "COMPLETED"
        case pending = "PENDING_APPROVAL"
    }
}

struct AdvancesSummary: Codable {
    let advances: [Advance]
    let totalOutstanding: Double
}

// MARK: - ViewModel

@MainActor
class AdvancesViewModel: ObservableObject {
    @Published var advances: [Advance] = []
    @Published var totalOutstanding: Double = 0
    @Published var isLoading = false
    @Published var error: String?

    private let service = AdvancesService()

    func loadAdvances() async {
        isLoading = true
        error = nil

        do {
            let summary = try await service.fetchAdvances()
            advances = summary.advances
            totalOutstanding = summary.totalOutstanding
        } catch {
            self.error = error.localizedDescription
            // Try loading cached data
            if let cached = service.getCachedAdvances() {
                advances = cached.advances
                totalOutstanding = cached.totalOutstanding
            }
        }

        isLoading = false
    }
}

// MARK: - Network Service

class AdvancesService {
    private let baseURL = "https://api.agrobridge.io/api/v1"
    private let cacheKey = "cached_advances"

    func fetchAdvances() async throws -> AdvancesSummary {
        guard let url = URL(string: "\(baseURL)/user/advances") else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(AuthManager.shared.token ?? "")", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        let summary = try JSONDecoder().decode(AdvancesSummary.self, from: data)

        // Cache for offline use
        UserDefaults.standard.set(data, forKey: cacheKey)

        return summary
    }

    func getCachedAdvances() -> AdvancesSummary? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else {
            return nil
        }
        return try? JSONDecoder().decode(AdvancesSummary.self, from: data)
    }
}

// MARK: - Main View

struct AdvancesListView: View {
    @StateObject private var viewModel = AdvancesViewModel()
    @State private var showNewAdvanceSheet = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header Summary
                headerSection

                // Advances List
                if viewModel.isLoading && viewModel.advances.isEmpty {
                    loadingView
                } else if viewModel.advances.isEmpty {
                    emptyStateView
                } else {
                    advancesList
                }
            }
            .navigationTitle(LocalizedString.myAdvances)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: { showNewAdvanceSheet = true }) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.green)
                    }
                }
            }
            .refreshable {
                await viewModel.loadAdvances()
            }
            .task {
                await viewModel.loadAdvances()
            }
            .sheet(isPresented: $showNewAdvanceSheet) {
                NewAdvanceView()
            }
            .alert("Error", isPresented: .constant(viewModel.error != nil)) {
                Button("OK") { viewModel.error = nil }
            } message: {
                Text(viewModel.error ?? "")
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(spacing: 16) {
            // Total Outstanding
            VStack(spacing: 4) {
                Text(LocalizedString.totalOutstanding)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Text(viewModel.totalOutstanding.asCurrency)
                    .font(.system(size: 36, weight: .bold))
                    .foregroundColor(.primary)
            }

            // Active Advances Count
            HStack {
                Label("\(viewModel.advances.filter { $0.status == .active }.count)",
                      systemImage: "clock.fill")
                    .foregroundColor(.orange)

                Text(LocalizedString.activeAdvances)
                    .foregroundColor(.secondary)
            }
            .font(.subheadline)

            // Request New Advance Button
            Button(action: { showNewAdvanceSheet = true }) {
                Label(LocalizedString.requestNewAdvance, systemImage: "plus")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }
            .padding(.horizontal)
        }
        .padding()
        .background(Color(.systemBackground))
    }

    // MARK: - Advances List

    private var advancesList: some View {
        List {
            ForEach(viewModel.advances) { advance in
                NavigationLink(destination: AdvanceDetailView(advance: advance)) {
                    AdvanceCardView(advance: advance)
                }
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "banknote")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text(LocalizedString.noActiveAdvances)
                .font(.headline)

            Text(LocalizedString.requestFirstAdvance)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: { showNewAdvanceSheet = true }) {
                Text(LocalizedString.requestNewAdvance)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
        }
        .padding()
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack {
            ProgressView()
            Text(LocalizedString.loading)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Advance Card

struct AdvanceCardView: View {
    let advance: Advance

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header Row
            HStack {
                Text("#\(advance.contractNumber)")
                    .font(.headline)

                Spacer()

                StatusBadge(status: advance.status)
            }

            // Amount Row
            HStack {
                VStack(alignment: .leading) {
                    Text(LocalizedString.borrowed)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(advance.amount.asCurrency)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }

                Spacer()

                VStack(alignment: .trailing) {
                    Text(LocalizedString.remaining)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(advance.remaining.asCurrency)
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(advance.remaining > 0 ? .primary : .green)
                }
            }

            // Due Date Row
            HStack {
                Image(systemName: "calendar")
                    .foregroundColor(.secondary)

                if advance.daysUntilDue > 0 {
                    Text("\(advance.daysUntilDue) \(LocalizedString.daysLeft)")
                        .foregroundColor(.secondary)
                } else if advance.daysUntilDue == 0 {
                    Text(LocalizedString.dueToday)
                        .foregroundColor(.orange)
                        .fontWeight(.medium)
                } else {
                    Text("\(abs(advance.daysUntilDue)) \(LocalizedString.daysOverdue)")
                        .foregroundColor(.red)
                        .fontWeight(.medium)
                }

                Spacer()

                Text(advance.dueDate.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .font(.subheadline)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: Advance.AdvanceStatus

    var body: some View {
        Text(statusText)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .cornerRadius(4)
    }

    private var statusText: String {
        switch status {
        case .active: return LocalizedString.active
        case .overdue: return LocalizedString.overdue
        case .paid: return LocalizedString.paid
        case .pending: return LocalizedString.pending
        }
    }

    private var backgroundColor: Color {
        switch status {
        case .active: return .blue.opacity(0.2)
        case .overdue: return .red.opacity(0.2)
        case .paid: return .green.opacity(0.2)
        case .pending: return .orange.opacity(0.2)
        }
    }

    private var foregroundColor: Color {
        switch status {
        case .active: return .blue
        case .overdue: return .red
        case .paid: return .green
        case .pending: return .orange
        }
    }
}

// MARK: - Detail View

struct AdvanceDetailView: View {
    let advance: Advance
    @State private var showPaymentSheet = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Balance Card
                VStack(spacing: 8) {
                    Text(LocalizedString.totalDue)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Text(advance.remaining.asCurrency)
                        .font(.system(size: 44, weight: .bold))

                    StatusBadge(status: advance.status)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(16)

                // Breakdown Section
                VStack(alignment: .leading, spacing: 12) {
                    Text(LocalizedString.breakdown)
                        .font(.headline)

                    BreakdownRow(label: LocalizedString.principal, value: advance.amount)
                    BreakdownRow(label: LocalizedString.interest, value: advance.amount * 0.025)
                    BreakdownRow(label: LocalizedString.lateFees, value: 0)

                    Divider()

                    BreakdownRow(label: LocalizedString.totalDue, value: advance.remaining, isTotal: true)
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(16)

                // Due Date Section
                VStack(alignment: .leading, spacing: 8) {
                    Text(LocalizedString.dueDate)
                        .font(.headline)

                    HStack {
                        Image(systemName: "calendar")
                        Text(advance.dueDate.formatted(date: .long, time: .omitted))
                        Spacer()
                        Text(dueStatusText)
                            .foregroundColor(dueStatusColor)
                    }
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(16)

                // Payment Button
                Button(action: { showPaymentSheet = true }) {
                    Label(LocalizedString.makePayment, systemImage: "creditcard.fill")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }

                // Report Payment Button
                Button(action: { /* Show report payment flow */ }) {
                    Label(LocalizedString.reportPayment, systemImage: "doc.text")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.tertiarySystemBackground))
                        .foregroundColor(.primary)
                        .cornerRadius(12)
                }
            }
            .padding()
        }
        .navigationTitle("#\(advance.contractNumber)")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPaymentSheet) {
            PaymentView(advance: advance)
        }
    }

    private var dueStatusText: String {
        if advance.daysUntilDue > 0 {
            return "\(advance.daysUntilDue) \(LocalizedString.daysLeft)"
        } else if advance.daysUntilDue == 0 {
            return LocalizedString.dueToday
        } else {
            return "\(abs(advance.daysUntilDue)) \(LocalizedString.daysOverdue)"
        }
    }

    private var dueStatusColor: Color {
        if advance.daysUntilDue > 3 {
            return .green
        } else if advance.daysUntilDue >= 0 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - Helper Views

struct BreakdownRow: View {
    let label: String
    let value: Double
    var isTotal: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .fontWeight(isTotal ? .bold : .regular)
            Spacer()
            Text(value.asCurrency)
                .fontWeight(isTotal ? .bold : .regular)
        }
    }
}

// MARK: - Placeholder Views

struct NewAdvanceView: View {
    var body: some View {
        Text("New Advance Request Flow")
    }
}

struct PaymentView: View {
    let advance: Advance
    var body: some View {
        Text("Payment Flow for \(advance.contractNumber)")
    }
}

// MARK: - Extensions

extension Double {
    var asCurrency: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "MXN"
        formatter.locale = Locale(identifier: "es_MX")
        return formatter.string(from: NSNumber(value: self)) ?? "$\(self)"
    }
}

// MARK: - Localization

enum LocalizedString {
    static let myAdvances = NSLocalizedString("my_advances", value: "Mis Anticipos", comment: "")
    static let totalOutstanding = NSLocalizedString("total_outstanding", value: "Saldo Pendiente", comment: "")
    static let activeAdvances = NSLocalizedString("active_advances", value: "Anticipos activos", comment: "")
    static let requestNewAdvance = NSLocalizedString("request_new_advance", value: "Solicitar Anticipo", comment: "")
    static let noActiveAdvances = NSLocalizedString("no_active_advances", value: "No tienes anticipos activos", comment: "")
    static let requestFirstAdvance = NSLocalizedString("request_first_advance", value: "¡Solicita tu primer anticipo!", comment: "")
    static let loading = NSLocalizedString("loading", value: "Cargando...", comment: "")
    static let borrowed = NSLocalizedString("borrowed", value: "Prestado", comment: "")
    static let remaining = NSLocalizedString("remaining", value: "Restante", comment: "")
    static let daysLeft = NSLocalizedString("days_left", value: "días restantes", comment: "")
    static let daysOverdue = NSLocalizedString("days_overdue", value: "días vencido", comment: "")
    static let dueToday = NSLocalizedString("due_today", value: "Vence hoy", comment: "")
    static let active = NSLocalizedString("active", value: "Activo", comment: "")
    static let overdue = NSLocalizedString("overdue", value: "Vencido", comment: "")
    static let paid = NSLocalizedString("paid", value: "Pagado", comment: "")
    static let pending = NSLocalizedString("pending", value: "Pendiente", comment: "")
    static let totalDue = NSLocalizedString("total_due", value: "Total a Pagar", comment: "")
    static let breakdown = NSLocalizedString("breakdown", value: "Desglose", comment: "")
    static let principal = NSLocalizedString("principal", value: "Capital", comment: "")
    static let interest = NSLocalizedString("interest", value: "Interés", comment: "")
    static let lateFees = NSLocalizedString("late_fees", value: "Cargos por mora", comment: "")
    static let dueDate = NSLocalizedString("due_date", value: "Fecha de Vencimiento", comment: "")
    static let makePayment = NSLocalizedString("make_payment", value: "Realizar Pago", comment: "")
    static let reportPayment = NSLocalizedString("report_payment", value: "Reportar Pago", comment: "")
}

// MARK: - Auth Manager Placeholder

class AuthManager {
    static let shared = AuthManager()
    var token: String?
}

// MARK: - Preview

#Preview {
    AdvancesListView()
}
