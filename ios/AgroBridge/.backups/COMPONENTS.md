# 🧩 AgroBridge Components - Complete Reference

📖 **Reading time:** ~32 minutes

**Version:** 1.0.0
**UI Framework:** SwiftUI
**Design System:** AgroBridge Design System 1.0

---

## Table of Contents

1. [Component Overview](#component-overview)
2. [StatCard](#statcard)
3. [CustomButton](#custombutton)
4. [CustomTextField](#customtextfield)
5. [SkeletonLoader](#skeletonloader)
6. [LoadingView & LoadingOverlay](#loadingview--loadingoverlay)
7. [Component Best Practices](#component-best-practices)
8. [Creating New Components](#creating-new-components)

---

## Component Overview

All components in AgroBridge follow these principles:

✅ **Reusable** - Can be used in multiple contexts
✅ **Configurable** - Accept parameters for customization
✅ **Accessible** - Full VoiceOver support
✅ **Design System Compliant** - Use design tokens
✅ **Animated** - Micro-interactions for delight
✅ **Documented** - Clear purpose and examples

**Component Location:** `Views/Components/`

---

## StatCard

### Purpose
Display key metrics with optional trends, used primarily in Dashboard.

### File
`Views/Components/StatCard.swift` (204 lines)

### API

```swift
StatCard(
    title: String,           // Metric name
    value: String,           // Metric value (formatted)
    icon: String,            // SF Symbol name
    trend: Trend? = nil,     // Optional trend indicator
    color: Color             // Primary color (icon, trend)
)
```

### Trend Enum

```swift
enum Trend {
    case up(String)      // Positive trend: .up("+12%")
    case down(String)    // Negative trend: .down("-5%")
    case neutral         // No change: .neutral
}
```

**Trend Colors:**
- `.up` → `Color.successGreen` (green)
- `.down` → `Color.errorRed` (red)
- `.neutral` → `Color.textSecondary` (gray)

---

### Examples

#### Basic Usage (No Trend)

```swift
StatCard(
    title: "Total Productores",
    value: "248",
    icon: "person.3.fill",
    color: .agroGreen
)
```

#### With Trend

```swift
StatCard(
    title: "Lotes Activos",
    value: "1,456",
    icon: "leaf.fill",
    trend: .up("+12%"),
    color: .successGreen
)
```

#### All Trend Types

```swift
// Positive trend
StatCard(
    title: "Ventas",
    value: "$125K",
    icon: "chart.line.uptrend.xyaxis",
    trend: .up("+18%"),
    color: .successGreen
)

// Negative trend
StatCard(
    title: "Pendientes",
    value: "24",
    icon: "clock.fill",
    trend: .down("-8%"),
    color: .warningAmber
)

// Neutral (no change)
StatCard(
    title: "Certificados",
    value: "89",
    icon: "checkmark.seal.fill",
    trend: .neutral,
    color: .agroSky
)
```

---

### Features

#### 1. Staggered Entrance Animation
When the card appears, elements animate in sequence:
- Icon scales from 0.8 → 1.0 (delay 0.1s)
- Trend badge fades in (delay 0.2s)
- Value slides up + fades in (delay 0.15s)
- Title fades in (delay 0.2s)

```swift
@State private var appeared = false

.onAppear {
    appeared = true
}
```

#### 2. Haptic Feedback
Tap on card triggers medium haptic:

```swift
.onTapGesture {
    HapticFeedback.medium()
    // Visual feedback animation
}
```

#### 3. Press Animation
Card scales down slightly when pressed:

```swift
@State private var isPressed = false

.scaleEffect(isPressed ? 0.97 : 1.0)
.animation(AnimationPreset.spring, value: isPressed)
```

#### 4. Dynamic Shadow
Shadow reduces when pressed for depth effect:

```swift
.shadow(
    color: ShadowStyle.soft.color,
    radius: isPressed ? ShadowStyle.soft.radius * 0.5 : ShadowStyle.soft.radius,
    y: isPressed ? ShadowStyle.soft.y * 0.5 : ShadowStyle.soft.y
)
```

#### 5. Accessibility

```swift
.accessibilityElement(children: .combine)
.accessibilityLabel("\(title): \(value). Tendencia: \(trend?.text ?? "")")
```

VoiceOver reads: "Productores: 248. Tendencia: +12%"

---

### Layout Structure

```
┌─────────────────────────────────────┐
│  ┌───┐                  ┌────────┐  │
│  │ 🍃│                  │ +12% ↗ │  │  ← Icon + Trend Badge
│  └───┘                  └────────┘  │
│                                      │
│  248                                 │  ← Value (displayMedium)
│                                      │
│  Productores                         │  ← Title (bodyMedium)
└─────────────────────────────────────┘
```

---

### Backwards Compatibility

Component supports legacy initializer without trend:

```swift
// Old code (still works)
StatCard(
    title: "Total",
    value: "100",
    icon: "star.fill",
    color: .agroGreen
)

// New code (with trend)
StatCard(
    title: "Total",
    value: "100",
    icon: "star.fill",
    trend: .up("+5%"),
    color: .agroGreen
)
```

---

## CustomButton

### Purpose
Primary interaction component with 4 visual styles and states.

### File
`Views/Components/CustomButton.swift` (265 lines)

### API

```swift
CustomButton(
    title: String,                    // Button text
    icon: String? = nil,              // Optional SF Symbol
    style: ButtonStyle = .primary,    // Visual style
    isLoading: Bool = false,          // Show spinner
    isDisabled: Bool = false,         // Disable interaction
    action: @escaping () -> Void      // Tap handler
)
```

### Button Styles

#### 1. Primary (Main CTAs)
```swift
CustomButton(
    title: "Crear Lote",
    icon: "plus.circle.fill",
    style: .primary
) {
    // Create action
}
```

**Appearance:**
- Background: `Color.agroGreen`
- Foreground: `Color.white`
- Shadow: `ShadowStyle.soft`
- Border: None

---

#### 2. Secondary (Alternative Actions)
```swift
CustomButton(
    title: "Cancelar",
    icon: "xmark",
    style: .secondary
) {
    dismiss()
}
```

**Appearance:**
- Background: `Color.backgroundSecondary`
- Foreground: `Color.agroGreen`
- Shadow: None
- Border: `Color.agroGreen.opacity(0.3)`

---

#### 3. Tertiary (Subtle Actions)
```swift
CustomButton(
    title: "Más opciones",
    icon: "ellipsis",
    style: .tertiary
) {
    showOptions = true
}
```

**Appearance:**
- Background: `Color.clear`
- Foreground: `Color.agroGreen`
- Shadow: None
- Border: `Color.agroGreen.opacity(0.2)`

---

#### 4. Destructive (Delete Actions)
```swift
CustomButton(
    title: "Eliminar",
    icon: "trash.fill",
    style: .destructive
) {
    deleteLote()
}
```

**Appearance:**
- Background: `Color.errorRed`
- Foreground: `Color.white`
- Shadow: `ShadowStyle.soft`
- Border: None

---

### States

#### Loading State

```swift
CustomButton(
    title: "Guardando...",
    style: .primary,
    isLoading: true  // ← Shows spinner, disables tap
) {
    // Won't be called while loading
}
```

**Visual Changes:**
- Title replaced with `ProgressView()`
- Button disabled
- Opacity: 0.6

#### Disabled State

```swift
CustomButton(
    title: "Continuar",
    style: .primary,
    isDisabled: !viewModel.isFormValid  // ← Disable until valid
) {
    // Action
}
```

**Visual Changes:**
- Button grayed out
- Opacity: 0.6
- Tap blocked

---

### Features

#### 1. Haptic Feedback

```swift
Button(action: {
    guard !isLoading && !isDisabled else { return }

    HapticFeedback.medium()  // ← Always on tap

    // Visual feedback
    withAnimation(AnimationPreset.spring) {
        isPressed = true
    }

    // Execute action after animation
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
        withAnimation(AnimationPreset.spring) {
            isPressed = false
        }
        action()
    }
})
```

#### 2. Press Animation

```swift
.scaleEffect(isPressed ? 0.96 : 1.0)
.animation(AnimationPreset.spring, value: isPressed)
```

Button scales down to 96% when pressed.

#### 3. Conditional Shadow

```swift
.if(style.shadowStyle != nil) { view in
    view.shadow(style.shadowStyle!)
}
```

Only primary and destructive have shadows.

#### 4. Accessibility

```swift
.accessibilityLabel(title)
.accessibilityHint(isLoading ? "Procesando" : "Toca dos veces para activar")
.accessibilityAddTraits(.isButton)
```

---

### Complete Example

```swift
CustomButton(
    title: "Crear Lote",
    icon: "checkmark.circle.fill",
    style: .primary,
    isLoading: viewModel.isLoading
) {
    HapticFeedback.medium()
    Task {
        let success = await viewModel.createLote()
        if success {
            HapticFeedback.success()
        } else {
            HapticFeedback.error()
        }
    }
}
.disabled(!viewModel.isFormValid || viewModel.isLoading)
```

---

### Legacy Support

Old code using `ButtonStyleType` enum still works:

```swift
// Old (deprecated)
CustomButton(
    title: "Login",
    style: .primary  // ButtonStyleType
) { }

// New (recommended)
CustomButton(
    title: "Login",
    style: .primary  // CustomButton.ButtonStyle
) { }
```

---

## CustomTextField

### Purpose
Form input with focus states, icon, and show/hide password.

### File
`Views/Components/CustomTextField.swift` (121 lines)

### API

```swift
CustomTextField(
    placeholder: String,                             // Placeholder text
    icon: String? = nil,                             // Optional SF Symbol
    text: Binding<String>,                           // Two-way binding
    isSecure: Bool = false,                          // Password field
    keyboardType: UIKeyboardType = .default,         // Keyboard type
    autocapitalization: TextInputAutocapitalization = .sentences
)
```

---

### Examples

#### Email Field

```swift
CustomTextField(
    placeholder: "Email",
    icon: "envelope.fill",
    text: $viewModel.email,
    keyboardType: .emailAddress,
    autocapitalization: .never
)
```

#### Password Field

```swift
CustomTextField(
    placeholder: "Contraseña",
    icon: "lock.fill",
    text: $viewModel.password,
    isSecure: true
)
```

**Features:**
- Shows SecureField by default
- Eye icon to toggle visibility
- Haptic feedback on toggle

#### Text Field (No Icon)

```swift
CustomTextField(
    placeholder: "Nombre del lote",
    icon: nil,
    text: $viewModel.nombre
)
```

#### Number Field

```swift
CustomTextField(
    placeholder: "Área (hectáreas)",
    icon: "ruler",
    text: $viewModel.area,
    keyboardType: .decimalPad
)
```

---

### Focus States

#### Visual Changes When Focused

```swift
@FocusState private var isFocused: Bool
```

**Changes:**
1. **Icon Color:** `textSecondary` → `agroGreen`
2. **Border:** 1pt divider → 2pt agroGreen
3. **Shadow:** None → Green glow (radius 8)

**Animation:**
```swift
.animation(AnimationPreset.easeOut, value: isFocused)
```

---

### Show/Hide Password

```swift
@State private var isSecureVisible = false

if isSecure && !isSecureVisible {
    SecureField(...)  // Hidden password
} else {
    TextField(...)    // Visible password
}

// Toggle button
Button(action: {
    HapticFeedback.light()
    withAnimation(AnimationPreset.spring) {
        isSecureVisible.toggle()
    }
}) {
    Image(systemName: isSecureVisible ? "eye.slash.fill" : "eye.fill")
}
```

---

### Layout

```
┌─────────────────────────────────────────┐
│  📧  user@example.com              👁  │
│  ↑   ↑                              ↑   │
│  │   │                              │   │
│ Icon TextField                   Toggle │
└─────────────────────────────────────────┘
```

With focus:
```
┌─────────────────────────────────────────┐ ← Green border (2pt)
│  📧  user@example.com |            👁  │ ← Green icon
└─────────────────────────────────────────┘ ← Green glow shadow
```

---

### Accessibility

```swift
.accessibilityElement(children: .combine)
.accessibilityLabel(placeholder)
.accessibilityHint(isSecure ? "Campo de contraseña segura" : "Campo de texto")
```

---

## SkeletonLoader

### Purpose
Elegant loading states with shimmer effect.

### File
`Views/Components/SkeletonLoader.swift` (322 lines)

---

### Base Component

```swift
SkeletonLoader(
    width: CGFloat? = nil,        // Optional fixed width
    height: CGFloat,              // Required height
    cornerRadius: CGFloat = CornerRadius.small
)
```

**Example:**
```swift
SkeletonLoader(width: 200, height: 20, cornerRadius: CornerRadius.small)
```

**Creates:** A 200x20pt gray rectangle with shimmer animation.

---

### Preset Components

#### 1. SkeletonCard
Mimics StatCard structure:

```swift
SkeletonCard()
```

**Layout:**
```
┌─────────────────────────────────┐
│  ⚪  Spacer  ▬▬▬▬               │  ← Icon + Badge placeholder
│                                  │
│  ▬▬▬▬▬▬                         │  ← Value placeholder
│  ▬▬▬▬▬▬▬▬▬▬▬▬                  │  ← Title placeholder
└─────────────────────────────────┘
```

---

#### 2. SkeletonListItem
For lists (LoteCard, ProductorCard):

```swift
SkeletonListItem()
```

**Layout:**
```
┌─────────────────────────────────────────┐
│  ▢  ▬▬▬▬▬▬▬▬▬▬▬            ▸         │
│     ▬▬▬▬▬▬▬▬                          │
│     ▬▬▬▬▬                             │
└─────────────────────────────────────────┘
  ↑   ↑                           ↑
 Icon Title/Subtitle            Chevron
```

---

#### 3. SkeletonText
Paragraph with multiple lines:

```swift
SkeletonText(lines: 3, lastLineWidth: 200)
```

**Output:**
```
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
```

---

#### 4. SkeletonImage
Square or circular image placeholder:

```swift
// Square
SkeletonImage(size: 120, isCircle: false)

// Circle (avatar)
SkeletonImage(size: 120, isCircle: true)
```

---

#### 5. SkeletonFormField
Form field placeholder:

```swift
SkeletonFormField()
```

**Layout:**
```
▬▬▬▬▬▬           ← Label
┌─────────────┐
│             │  ← Field
└─────────────┘
```

---

### SkeletonLoadingView (Complete Screens)

#### Types

```swift
enum SkeletonType {
    case dashboard  // 4 SkeletonCards in grid + section + list items
    case list       // 8 SkeletonListItems
    case detail     // Hero image + title + stats + description
    case form       // Title + 5 SkeletonFormFields + button
}
```

#### Usage

```swift
// In View
if viewModel.isLoading && viewModel.data == nil {
    SkeletonLoadingView(type: .dashboard)
} else {
    // Actual content
}
```

---

### Shimmer Animation

**How it Works:**

```swift
@State private var isAnimating = false

Rectangle()
    .fill(
        LinearGradient(
            colors: [
                Color.gray.opacity(0.15),  // ← Light
                Color.gray.opacity(0.25),  // ← Dark
                Color.gray.opacity(0.15)   // ← Light
            ],
            startPoint: isAnimating ? .leading : .trailing,
            endPoint: isAnimating ? .trailing : .leading
        )
    )
    .onAppear {
        withAnimation(
            Animation.linear(duration: 1.5).repeatForever(autoreverses: false)
        ) {
            isAnimating.toggle()
        }
    }
```

**Result:** Infinite left-to-right shimmer effect.

---

### Complete Example

```swift
struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        ZStack {
            Color.backgroundPrimary.ignoresSafeArea()

            if viewModel.isLoading && viewModel.stats == nil {
                // Show skeleton on initial load
                SkeletonLoadingView(type: .dashboard)
            } else {
                // Show actual content
                ScrollView {
                    VStack {
                        if let stats = viewModel.stats {
                            DashboardStatsGrid(stats: stats)
                        }
                    }
                }
                .refreshable {
                    await viewModel.refresh()  // Pull-to-refresh (no skeleton)
                }
            }
        }
        .task {
            await viewModel.loadStats()
        }
    }
}
```

---

## LoadingView & LoadingOverlay

### Purpose
Generic loading spinners (use SkeletonLoader for better UX).

### File
`Views/Components/LoadingView.swift` (86 lines)

---

### LoadingView (Fullscreen)

```swift
LoadingView(message: String = MicroCopy.loading)
```

**Example:**
```swift
if viewModel.isLoading {
    LoadingView(message: MicroCopy.loadingData)
}
```

**Appearance:**
```
┌─────────────────────────────────┐
│                                  │
│            ⏳                    │
│      Un momento...               │
│                                  │
└─────────────────────────────────┘
```

---

### LoadingOverlay (Modal)

```swift
LoadingOverlay(message: String = MicroCopy.loading)
```

**Example:**
```swift
ZStack {
    ContentView()

    if isProcessing {
        LoadingOverlay(message: MicroCopy.saving)
    }
}
```

**Appearance:**
```
┌─────────────────────────────────┐
│  ████████████████████████████  │ ← Semi-transparent overlay
│  ████████████████████████████  │
│  ████████┌──────────┐█████████  │
│  ████████│   ⏳    │█████████  │ ← Green glassmorphism card
│  ████████│ Saving...│█████████  │
│  ████████└──────────┘█████████  │
│  ████████████████████████████  │
└─────────────────────────────────┘
```

**Features:**
- Background: `Color.black.opacity(0.4)`
- Card: `Color.agroGreen` with blur effect
- Shadow: `ShadowStyle.strong`

---

## Component Best Practices

### 1. Always Use Design System Tokens

✅ **DO:**
```swift
.padding(Spacing.lg)
.font(.displayMedium)
.foregroundColor(.textPrimary)
.cornerRadius(CornerRadius.large)
```

❌ **DON'T:**
```swift
.padding(20)
.font(.system(size: 28, weight: .semibold))
.foregroundColor(.black)
.cornerRadius(16)
```

---

### 2. Add Haptic Feedback

✅ **DO:**
```swift
Button("Delete") {
    HapticFeedback.medium()
    delete()
}
```

❌ **DON'T:**
```swift
Button("Delete") {
    delete()  // No feedback
}
```

---

### 3. Provide Accessibility

✅ **DO:**
```swift
Image(systemName: "trash.fill")
    .accessibilityLabel("Eliminar")
    .accessibilityHint("Toca dos veces para eliminar el lote")
```

❌ **DON'T:**
```swift
Image(systemName: "trash.fill")
// No accessibility
```

---

### 4. Use Skeleton Over Spinner

✅ **DO:**
```swift
if viewModel.isLoading && viewModel.data == nil {
    SkeletonLoadingView(type: .list)
}
```

❌ **DON'T:**
```swift
if viewModel.isLoading {
    ProgressView()  // Generic spinner
}
```

---

### 5. Animate State Changes

✅ **DO:**
```swift
.opacity(appeared ? 1.0 : 0.0)
.animation(AnimationPreset.easeOut.delay(0.1), value: appeared)
```

❌ **DON'T:**
```swift
.opacity(appeared ? 1.0 : 0.0)
// No animation
```

---

## Creating New Components

### Template

```swift
import SwiftUI

// MARK: - ComponentName
/// Brief description of component purpose
/// "Design quote" - Jony Ive (optional)
struct ComponentName: View {
    // MARK: - Properties
    let title: String
    @Binding var value: String
    var style: ComponentStyle = .default

    @State private var isPressed = false
    @State private var appeared = false

    // MARK: - Enums/Nested Types
    enum ComponentStyle {
        case primary
        case secondary
    }

    // MARK: - Initializer
    init(
        title: String,
        value: Binding<String>,
        style: ComponentStyle = .default
    ) {
        self.title = title
        self._value = value
        self.style = style
    }

    // MARK: - Body
    var body: some View {
        VStack(spacing: Spacing.md) {
            Text(title)
                .font(.labelMedium)
                .foregroundColor(.textSecondary)

            Text(value)
                .font(.displayMedium)
                .foregroundColor(.textPrimary)
        }
        .padding(Spacing.lg)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadius.large)
        .shadow(ShadowStyle.soft)
        .scaleEffect(isPressed ? 0.96 : 1.0)
        .animation(AnimationPreset.spring, value: isPressed)
        .opacity(appeared ? 1.0 : 0.0)
        .onAppear {
            withAnimation(AnimationPreset.easeOut) {
                appeared = true
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value)")
    }
}

// MARK: - Preview
#Preview {
    ComponentName(
        title: "Example",
        value: .constant("Value")
    )
    .padding()
    .background(Color.backgroundPrimary)
}
```

### Checklist for New Components

- [ ] Uses design system tokens (colors, fonts, spacing)
- [ ] Animates state changes
- [ ] Adds haptic feedback (if interactive)
- [ ] Full accessibility (labels, hints, traits)
- [ ] Includes `// MARK:` comments
- [ ] Has Preview for testing
- [ ] Documented with /// comments
- [ ] Supports both light/dark mode
- [ ] Follows naming convention (PascalCase)

---

**Document Version:** 1.0.0
**Author:** Alejandro Navarro Ayala - CEO & Senior Developer
**Last Updated:** November 28, 2024
**Status:** Production Ready

---

**"Design is not just what it looks like and feels like. Design is how it works."**
— Steve Jobs
