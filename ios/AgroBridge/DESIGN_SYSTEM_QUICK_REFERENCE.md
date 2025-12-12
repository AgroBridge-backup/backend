# 🎨 AgroBridge Design System - Quick Reference Card

📖 **Reading time:** ~3 minutes | **Print-friendly format**

**Version:** 1.0.0
**Last Updated:** November 28, 2024

---

## 🎨 Colors

### Brand Colors
```swift
.agroGreen       // #2D5016 - Primary
.agroGreenLight  // #57A02B - Accent/CTA
.agroGreenTint   // #E8F5E3 - Subtle backgrounds
.agroEarth       // #8B6F47 - Secondary
.agroSky         // #4A90E2 - Tertiary
```

### Semantic Colors
```swift
.successGreen    // #34C759 - Success states
.warningAmber    // #FF9500 - Warnings
.errorRed        // #FF3B30 - Errors
.infoBlue        // #007AFF - Information
```

### Text & Backgrounds
```swift
.textPrimary          // #1C1C1E - Headlines, body
.textSecondary        // #6C6C70 - Captions, labels
.textTertiary         // #AEAEB2 - Placeholders
.backgroundPrimary    // #F8FAF7 - App background
.backgroundSecondary  // #FFFFFF - Cards
.divider              // #E5E5EA - Borders
```

---

## 📝 Typography

### Display (Headlines)
```swift
.displayLarge   // 34pt, bold   - Hero titles
.displayMedium  // 28pt, semibold - Section headers
.displaySmall   // 22pt, semibold - Card titles
```

### Body (Content)
```swift
.bodyLarge   // 17pt, regular - Primary content
.bodyMedium  // 15pt, regular - Secondary content
.bodySmall   // 13pt, regular - Captions, footnotes
```

### Label (UI Elements)
```swift
.labelLarge   // 17pt, semibold - Buttons, emphasis
.labelMedium  // 15pt, medium   - Form labels
.labelSmall   // 12pt, medium   - Badges, chips
```

---

## 📐 Spacing (4pt Grid)

```swift
Spacing.xxs    //  4pt  - Tight (icon + text)
Spacing.xs     //  8pt  - Compact (form field internal)
Spacing.sm     // 12pt  - Comfortable (list item padding)
Spacing.md     // 16pt  - Default (standard padding) ⭐
Spacing.lg     // 20pt  - Generous (section padding)
Spacing.xl     // 24pt  - Spacious (between sections)
Spacing.xxl    // 32pt  - Large gaps (major sections)
Spacing.xxxl   // 48pt  - Hero spacing (top of screens)
```

---

## 📐 Corner Radius

```swift
CornerRadius.small    //  8pt - Badges, chips, small buttons
CornerRadius.medium   // 12pt - Text fields, buttons
CornerRadius.large    // 16pt - Cards, modals
CornerRadius.xlarge   // 20pt - Hero cards
CornerRadius.xxlarge  // 24pt - Extra large containers
```

---

## 🌑 Shadows (Elevation)

```swift
ShadowStyle.subtle   // Barely visible - Subtle elements
ShadowStyle.soft     // Light - Cards (default) ⭐
ShadowStyle.medium   // Noticeable - Floating buttons
ShadowStyle.strong   // Prominent - Modals, overlays
```

**Usage:**
```swift
.shadow(ShadowStyle.soft)
```

---

## ⚡ Animations

```swift
AnimationPreset.spring         // 0.3s  - Micro-interactions ⭐
AnimationPreset.springBouncy   // 0.4s  - Entrances (more bounce)
AnimationPreset.easeInOut      // 0.3s  - Smooth transitions
AnimationPreset.easeOut        // 0.25s - Fade in, scale up
AnimationPreset.easeIn         // 0.2s  - Fade out, scale down
AnimationPreset.linear         // 0.5s  - Loaders, progress
AnimationPreset.smooth         // 0.4s  - Very smooth
```

**Usage:**
```swift
withAnimation(AnimationPreset.spring) {
    isPressed = true
}
```

---

## 📳 Haptic Feedback

```swift
HapticFeedback.light()      // Subtle tap (toggle, secondary)
HapticFeedback.medium()     // Standard (button tap) ⭐
HapticFeedback.heavy()      // Strong (important action)
HapticFeedback.success()    // Positive (create success)
HapticFeedback.error()      // Negative (validation error)
HapticFeedback.warning()    // Caution (destructive action)
HapticFeedback.selection()  // Picker/scroll selection
```

---

## 💬 Micro-Copy (Spanish)

### Loading
```swift
MicroCopy.loading          // "Un momento..."
MicroCopy.loadingData      // "Cargando información..."
MicroCopy.saving           // "Guardando cambios..."
```

### Success
```swift
MicroCopy.success               // "¡Listo! ✓"
MicroCopy.savedSuccessfully     // "Cambios guardados correctamente"
MicroCopy.createdSuccessfully   // "Creado exitosamente"
```

### Errors
```swift
MicroCopy.errorGeneric    // "Algo salió mal. Intenta de nuevo"
MicroCopy.errorNetwork    // "Verifica tu conexión a internet"
MicroCopy.errorServer     // "El servidor no responde..."
```

### Actions
```swift
MicroCopy.confirm       // "Listo"
MicroCopy.cancel        // "Mejor no"
MicroCopy.delete        // "Eliminar"
MicroCopy.save          // "Guardar cambios"
MicroCopy.create        // "Crear nuevo"
MicroCopy.retry         // "Intentar de nuevo"
```

---

## 📦 Components

### StatCard
```swift
StatCard(
    title: "Productores",
    value: "248",
    icon: "person.3.fill",
    trend: .up("+12%"),
    color: .agroGreen
)
```

### CustomButton
```swift
CustomButton(
    title: "Crear Lote",
    icon: "plus.circle.fill",
    style: .primary,
    isLoading: false
) { /* action */ }
```

**Styles:** `.primary`, `.secondary`, `.tertiary`, `.destructive`

### CustomTextField
```swift
CustomTextField(
    placeholder: "Email",
    icon: "envelope.fill",
    text: $viewModel.email,
    keyboardType: .emailAddress
)
```

---

## ✅ Common Patterns

### Card Layout
```swift
VStack(spacing: Spacing.md) {
    Text("Title")
        .font(.displaySmall)
        .foregroundColor(.textPrimary)

    Text("Content")
        .font(.bodyMedium)
        .foregroundColor(.textSecondary)
}
.padding(Spacing.lg)
.background(Color.backgroundSecondary)
.cornerRadius(CornerRadius.large)
.shadow(ShadowStyle.soft)
```

### Button Press Animation
```swift
@State private var isPressed = false

Button("Action") {
    HapticFeedback.medium()
    withAnimation(AnimationPreset.spring) {
        isPressed = true
    }
}
.scaleEffect(isPressed ? 0.96 : 1.0)
.animation(AnimationPreset.spring, value: isPressed)
```

### Form Field
```swift
VStack(alignment: .leading, spacing: Spacing.xs) {
    Text("Email")
        .font(.labelMedium)
        .foregroundColor(.textSecondary)

    CustomTextField(
        placeholder: "tu@email.com",
        icon: "envelope.fill",
        text: $email
    )
}
```

---

## 🎯 Quick Tips

### DO ✅
- Use design system tokens (never hardcode values)
- Add haptic feedback to all interactions
- Provide VoiceOver labels
- Follow spacing system (4pt grid)
- Use semantic colors (`.successGreen` not `.green`)

### DON'T ❌
- Hardcode colors: `.foregroundColor(.green)` → Use `.successGreen`
- Magic numbers: `.padding(17)` → Use `Spacing.md`
- Hardcoded strings: `"Cargando..."` → Use `MicroCopy.loading`
- Skip accessibility: Add `.accessibilityLabel()` always

---

## 📚 Full Documentation

For complete details, see:
- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** - Complete design system guide
- **[COMPONENTS.md](COMPONENTS.md)** - Component library reference
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Architecture patterns

---

**Author:** Alejandro Navarro Ayala - CEO & Senior Developer
**For:** AgroBridge iOS Team
**Print this card for quick desk reference!** 🖨️
