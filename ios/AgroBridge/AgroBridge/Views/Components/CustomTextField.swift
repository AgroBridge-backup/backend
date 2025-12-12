import SwiftUI

// MARK: - CustomTextField (Jony Ive Edition)
/// TextField premium con focus states, haptics y design coherente
/// "Simplicity is not the absence of clutter, that's a consequence of simplicity" - Jony Ive
struct CustomTextField: View {
    // MARK: - Properties
    let placeholder: String
    let icon: String?
    @Binding var text: String

    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .sentences

    @State private var isSecureVisible = false
    @FocusState private var isFocused: Bool

    // MARK: - Body
    var body: some View {
        HStack(spacing: Spacing.md) {
            // Icono opcional
            if let icon = icon {
                Image(systemName: icon)
                    .font(.bodyMedium)
                    .foregroundColor(isFocused ? .agroGreen : .textSecondary)
                    .frame(width: 24)
                    .animation(AnimationPreset.easeOut, value: isFocused)
            }

            // Campo de texto
            if isSecure && !isSecureVisible {
                SecureField(placeholder, text: $text)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.bodyLarge)
                    .foregroundColor(.textPrimary)
                    .focused($isFocused)
            } else {
                TextField(placeholder, text: $text)
                    .keyboardType(keyboardType)
                    .textInputAutocapitalization(autocapitalization)
                    .autocorrectionDisabled()
                    .font(.bodyLarge)
                    .foregroundColor(.textPrimary)
                    .focused($isFocused)
            }

            // Botón mostrar/ocultar para password
            if isSecure {
                Button(action: {
                    HapticFeedback.light()
                    withAnimation(AnimationPreset.spring) {
                        isSecureVisible.toggle()
                    }
                }) {
                    Image(systemName: isSecureVisible ? "eye.slash.fill" : "eye.fill")
                        .font(.labelMedium)
                        .foregroundColor(.textSecondary)
                }
            }
        }
        .padding(Spacing.md)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.medium)
        .overlay(
            RoundedRectangle(cornerRadius: CornerRadius.medium)
                .stroke(isFocused ? Color.agroGreen : Color.divider, lineWidth: isFocused ? 2 : 1)
                .animation(AnimationPreset.easeOut, value: isFocused)
        )
        .shadow(
            color: isFocused ? Color.agroGreen.opacity(0.1) : Color.clear,
            radius: isFocused ? 8 : 0,
            x: 0,
            y: isFocused ? 2 : 0
        )
        .animation(AnimationPreset.easeOut, value: isFocused)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(placeholder)
        .accessibilityHint(isSecure ? "Campo de contraseña segura" : "Campo de texto")
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: Spacing.lg) {
        Text("Custom TextFields")
            .font(.displayMedium)
            .foregroundColor(.textPrimary)

        CustomTextField(
            placeholder: "Email",
            icon: "envelope.fill",
            text: .constant(""),
            keyboardType: .emailAddress,
            autocapitalization: .never
        )

        CustomTextField(
            placeholder: "Contraseña",
            icon: "lock.fill",
            text: .constant(""),
            isSecure: true
        )

        CustomTextField(
            placeholder: "Nombre del lote",
            icon: "leaf.fill",
            text: .constant("")
        )

        CustomTextField(
            placeholder: "Sin icono",
            icon: nil,
            text: .constant("")
        )
    }
    .padding()
    .background(Color.backgroundPrimary)
}
