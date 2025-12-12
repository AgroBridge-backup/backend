import SwiftUI

// MARK: - SearchBar
/// Barra de búsqueda personalizada para AgroBridge
struct SearchBar: View {
    @Binding var text: String
    var placeholder: String = "Buscar..."
    var onClear: (() -> Void)? = nil

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: 12) {
            // Icono de búsqueda
            Image(systemName: "magnifyingglass")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.secondary)

            // TextField
            TextField(placeholder, text: $text)
                .focused($isFocused)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)

            // Botón limpiar
            if !text.isEmpty {
                Button(action: {
                    text = ""
                    onClear?()
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isFocused ? Color.agrobridgePrimary : Color.clear, lineWidth: 2)
        )
    }
}

// MARK: - Preview
struct SearchBar_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            SearchBar(text: .constant(""))
            SearchBar(text: .constant("Aguacate"))
        }
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
