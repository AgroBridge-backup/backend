import SwiftUI

// MARK: - Stat Pill Component
struct StatPill: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 2, y: 1)
    }
}

#Preview {
    HStack {
        StatPill(label: "Total", value: "12", color: .blue)
        StatPill(label: "Activos", value: "8", color: .green)
        StatPill(label: "Área", value: "45.2 ha", color: .purple)
    }
    .padding()
}
