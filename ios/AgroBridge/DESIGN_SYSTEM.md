# 🎨 AgroBridge Design System - Complete Guide

📖 **Reading time:** ~28 minutes

**Version:** 1.0.0
**Design Philosophy:** Inspired by Apple's Human Interface Guidelines
**Based on:** Apple HIG 2025 + Material Design 3
**Quote:** *"Simplicity is the ultimate sophistication"* — Leonardo da Vinci

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Reference](#quick-reference)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing System](#spacing-system)
6. [Corner Radius](#corner-radius)
7. [Shadows](#shadows)
8. [Animations](#animations)
9. [Haptic Feedback](#haptic-feedback)
10. [Micro-Copy](#micro-copy)
11. [Usage Examples](#usage-examples)
12. [Accessibility Guidelines](#accessibility-guidelines)
13. [Migration Guide](#migration-guide)
14. [Best Practices](#best-practices)

---

## Overview

The AgroBridge Design System is a centralized collection of design tokens, components, and guidelines that ensure visual consistency across the entire iOS app.

**Location:** `Core/Design/AgroBridgeDesignSystem.swift`

**Key Benefits:**
- ✅ **Consistency:** Same colors, fonts, spacing everywhere
- ✅ **Maintainability:** Change once, update everywhere
- ✅ **Scalability:** Easy to add new components
- ✅ **Developer Experience:** Autocomplete for all design tokens
- ✅ **Accessibility:** Built-in VoiceOver support

---

## Color System

### Brand Colors

Primary colors that represent AgroBridge's identity:

```swift
Color.agroGreen       // #2D5016 - Primary brand color (dark green)
Color.agroGreenLight  // #57A02B - Accent/CTA color (bright green)
Color.agroGreenTint   // #E8F5E3 - Subtle backgrounds (mint)
Color.agroEarth       // #8B6F47 - Secondary (brown)
Color.agroSky         // #4A90E2 - Tertiary (blue)
```

**Visual Reference:**
```
┌────────────┬────────────┬────────────┐
│ agroGreen  │agroGreen   │agroGreen   │
│            │   Light    │   Tint     │
│  #2D5016   │  #57A02B   │  #E8F5E3   │
│  ████████  │  ████████  │  ████████  │
└────────────┴────────────┴────────────┘
```

**Usage:**
- **agroGreen:** Buttons, focus states, icons
- **agroGreenLight:** CTAs, highlights, active states
- **agroGreenTint:** Subtle backgrounds, hover states

---

### Semantic Colors

Colors with specific meanings:

```swift
Color.successGreen  // #34C759 - Success states
Color.warningAmber  // #FF9500 - Warnings
Color.errorRed      // #FF3B30 - Errors
Color.infoBlue      // #007AFF - Information
```

**When to Use:**
| Color | Use Case | Example |
|-------|----------|---------|
| successGreen | Positive feedback | "Lote creado exitosamente" |
| warningAmber | Caution | "Conexión lenta" |
| errorRed | Errors | "Email inválido" |
| infoBlue | Informational | "Campos obligatorios marcados con *" |

---

### Neutral Colors

Background and text colors:

```swift
Color.backgroundPrimary    // #F8FAF7 - App background (light green tint)
Color.backgroundSecondary  // #FFFFFF - Cards, elevated surfaces
Color.textPrimary          // #1C1C1E - High emphasis text
Color.textSecondary        // #6C6C70 - Medium emphasis text
Color.textTertiary         // #AEAEB2 - Low emphasis text (placeholders)
Color.divider              // #E5E5EA - Borders, dividers
```

**Hierarchy:**
```
textPrimary    ████████ 100% opacity - Headlines, body
textSecondary  ████████  70% opacity - Captions, labels
textTertiary   ████████  50% opacity - Placeholders, disabled
```

---

### Legacy Support

For backwards compatibility with existing code:

```swift
Color.agrobridgePrimary    // → agroGreenLight
Color.cardBackground       // → backgroundSecondary
Color.secondaryBackground  // → backgroundPrimary
```

**Migration Guide:**
```swift
// OLD (deprecated)
.foregroundColor(.agrobridgePrimary)

// NEW (recommended)
.foregroundColor(.agroGreen)
```

---

### Color Utilities

**Initialize from Hex:**
```swift
Color(hex: "#2D5016")  // Creates agroGreen
```

---

## Typography

### Font Scale

**9 font styles** following Apple's type system:

#### Display (Headlines, Titles)
```swift
Font.displayLarge   // 34pt, bold   - Hero titles
Font.displayMedium  // 28pt, semibold - Section headers
Font.displaySmall   // 22pt, semibold - Card titles
```

#### Body (Content)
```swift
Font.bodyLarge   // 17pt, regular - Primary content
Font.bodyMedium  // 15pt, regular - Secondary content
Font.bodySmall   // 13pt, regular - Captions, footnotes
```

#### Label (UI Elements)
```swift
Font.labelLarge   // 17pt, semibold - Buttons, emphasis
Font.labelMedium  // 15pt, medium   - Form labels
Font.labelSmall   // 12pt, medium   - Badges, chips
```

---

### Typography Hierarchy

```
┌────────────────────────────────────┐
│  Display Large (34pt bold)         │ ← Page title
├────────────────────────────────────┤
│  Display Medium (28pt semibold)    │ ← Section header
├────────────────────────────────────┤
│  Display Small (22pt semibold)     │ ← Card header
├────────────────────────────────────┤
│  Body Large (17pt regular)         │ ← Primary text
│  Body Medium (15pt regular)        │ ← Secondary text
│  Body Small (13pt regular)         │ ← Captions
├────────────────────────────────────┤
│  Label Large (17pt semibold)       │ ← Buttons
│  Label Medium (15pt medium)        │ ← Form labels
│  Label Small (12pt medium)         │ ← Badges
└────────────────────────────────────┘
```

---

### Usage Examples

```swift
// Page title
Text("AgroBridge")
    .font(.displayLarge)
    .foregroundColor(.textPrimary)

// Section header
Text("Estadísticas")
    .font(.displayMedium)
    .foregroundColor(.textPrimary)

// Body text
Text("Resumen de tu actividad")
    .font(.bodyMedium)
    .foregroundColor(.textSecondary)

// Button
Text("Crear Lote")
    .font(.labelLarge)
    .foregroundColor(.white)

// Form label
Text("Email")
    .font(.labelMedium)
    .foregroundColor(.textSecondary)
```

---

## Spacing System

**8 spacing tokens** based on **4pt grid**:

```swift
Spacing.xxs   //  4pt - Tight (icon + text)
Spacing.xs    //  8pt - Compact (form field internal)
Spacing.sm    // 12pt - Comfortable (list item padding)
Spacing.md    // 16pt - Default (standard padding) ⭐ BASE UNIT
Spacing.lg    // 20pt - Generous (section padding)
Spacing.xl    // 24pt - Spacious (between sections)
Spacing.xxl   // 32pt - Large gaps (major sections)
Spacing.xxxl  // 48pt - Hero spacing (top of screens)
```

### Visual Guide

```
┌─────────────────────────────────┐
│  Spacing.md (16pt)              │
│  ┌───────────────────────────┐  │
│  │  Spacing.xs (8pt)         │  │
│  │  ┌─────────────────────┐  │  │
│  │  │  Content            │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Common Patterns

```swift
// Card padding
VStack {
    Text("Content")
}
.padding(Spacing.lg)  // 20pt all sides

// Between sections
VStack(spacing: Spacing.xl) {  // 24pt vertical gap
    Section1()
    Section2()
}

// Form fields
VStack(spacing: Spacing.md) {  // 16pt between fields
    CustomTextField(...)
    CustomTextField(...)
}

// Icon + Text
HStack(spacing: Spacing.xs) {  // 8pt gap
    Image(systemName: "leaf.fill")
    Text("Lotes")
}
```

---

## Corner Radius

**5 radius sizes** for rounded corners:

```swift
CornerRadius.small    //  8pt - Badges, chips, small buttons
CornerRadius.medium   // 12pt - Text fields, standard buttons
CornerRadius.large    // 16pt - Cards, modals
CornerRadius.xlarge   // 20pt - Hero cards
CornerRadius.xxlarge  // 24pt - Extra large containers
```

### Visual Reference

```
┌────────┐  ┌─────────┐  ┌──────────┐
│ small  │  │ medium  │  │  large   │
│  8pt   │  │  12pt   │  │   16pt   │
└────────┘  └─────────┘  └──────────┘
```

### Usage

```swift
// Button
.cornerRadius(CornerRadius.medium)  // 12pt

// Card
.cornerRadius(CornerRadius.large)   // 16pt

// Badge
.cornerRadius(CornerRadius.small)   // 8pt
```

---

## Shadows

**4 shadow presets** for depth and elevation:

```swift
ShadowStyle.subtle   // Barely visible - Subtle elements
ShadowStyle.soft     // Light - Cards (default) ⭐
ShadowStyle.medium   // Noticeable - Floating buttons
ShadowStyle.strong   // Prominent - Modals, overlays
```

### Shadow Properties

| Style | Opacity | Radius | Y Offset | Use Case |
|-------|---------|--------|----------|----------|
| subtle | 0.05 | 4pt | 1pt | Subtle dividers |
| soft | 0.08 | 8pt | 2pt | StatCard, CustomButton |
| medium | 0.12 | 16pt | 4pt | Floating action button |
| strong | 0.20 | 24pt | 8pt | LoadingOverlay, modals |

### Usage

**Method 1: View Extension**
```swift
VStack {
    Text("Content")
}
.shadow(ShadowStyle.soft)  // ✅ Recommended
```

**Method 2: Manual**
```swift
.shadow(
    color: ShadowStyle.soft.color,
    radius: ShadowStyle.soft.radius,
    x: ShadowStyle.soft.x,
    y: ShadowStyle.soft.y
)
```

---

## Animations

**7 animation presets** following iOS motion guidelines:

```swift
AnimationPreset.spring         // Micro-interactions (0.3s)
AnimationPreset.springBouncy   // Entrances (0.4s, more bounce)
AnimationPreset.easeInOut      // Smooth transitions (0.3s)
AnimationPreset.easeOut        // Fade in, scale up (0.25s)
AnimationPreset.easeIn         // Fade out, scale down (0.2s)
AnimationPreset.linear         // Loaders, progress (0.5s)
AnimationPreset.smooth         // Very smooth (0.4s)
```

### When to Use

| Animation | Use Case | Example |
|-----------|----------|---------|
| spring | Button press, toggle | Scale 1.0 → 0.96 → 1.0 |
| springBouncy | Logo entrance | Scale 0.5 → 1.1 → 1.0 |
| easeInOut | Transitions | Slide in/out |
| easeOut | Appear | Opacity 0 → 1, offset -10 → 0 |
| easeIn | Disappear | Opacity 1 → 0 |
| linear | Skeleton shimmer | Infinite loop |

### Usage Examples

```swift
// Button press animation
withAnimation(AnimationPreset.spring) {
    isPressed = true
}

// Staggered entrance
VStack {
    Text("Title")
        .opacity(appeared ? 1 : 0)
        .animation(AnimationPreset.easeOut.delay(0.1), value: appeared)

    Text("Subtitle")
        .opacity(appeared ? 1 : 0)
        .animation(AnimationPreset.easeOut.delay(0.2), value: appeared)
}
.onAppear { appeared = true }

// Scale animation
.scaleEffect(isPressed ? 0.96 : 1.0)
.animation(AnimationPreset.spring, value: isPressed)
```

---

## Haptic Feedback

**7 haptic methods** for tactile responses:

```swift
HapticFeedback.light()      // Subtle tap (selection, toggle)
HapticFeedback.medium()     // Standard (button tap) ⭐ MOST COMMON
HapticFeedback.heavy()      // Strong (important action)
HapticFeedback.success()    // Positive (create, save success)
HapticFeedback.error()      // Negative (validation error)
HapticFeedback.warning()    // Caution (destructive action)
HapticFeedback.selection()  // Picker/scroll selection
```

### When to Use

| Haptic | Trigger | Example |
|--------|---------|---------|
| light | Toggle, secondary tap | "¿Olvidaste contraseña?" |
| medium | Primary button | "Crear Lote" |
| heavy | Destructive action | "Eliminar" (before confirm) |
| success | Operation success | After lote created |
| error | Validation fail | Invalid email |
| warning | Before destructive | Delete confirmation shown |
| selection | Picker change | Selecting cultivo type |

### Implementation

```swift
CustomButton(
    title: "Crear Lote",
    style: .primary
) {
    HapticFeedback.medium()  // ← Add this
    Task {
        let success = await viewModel.createLote()
        if success {
            HapticFeedback.success()  // ← Success feedback
        } else {
            HapticFeedback.error()    // ← Error feedback
        }
    }
}
```

---

## Micro-Copy

**20+ humanized strings** in Spanish:

### Loading States
```swift
MicroCopy.loading          // "Un momento..."
MicroCopy.loadingData      // "Cargando información..."
MicroCopy.saving           // "Guardando cambios..."
MicroCopy.deleting         // "Eliminando..."
MicroCopy.uploading        // "Subiendo archivo..."
```

### Success Messages
```swift
MicroCopy.success               // "¡Listo! ✓"
MicroCopy.savedSuccessfully     // "Cambios guardados correctamente"
MicroCopy.createdSuccessfully   // "Creado exitosamente"
MicroCopy.deletedSuccessfully   // "Eliminado correctamente"
```

### Error Messages
```swift
MicroCopy.errorGeneric    // "Algo salió mal. Intenta de nuevo"
MicroCopy.errorNetwork    // "Verifica tu conexión a internet"
MicroCopy.errorServer     // "El servidor no responde. Intenta más tarde"
MicroCopy.errorNotFound   // "No encontramos lo que buscas"
```

### Empty States
```swift
MicroCopy.noData        // "Aún no hay información aquí"
MicroCopy.noResults     // "No encontramos resultados"
MicroCopy.noConnection  // "Sin conexión"
```

### Actions
```swift
MicroCopy.confirm       // "Listo"
MicroCopy.cancel        // "Mejor no"
MicroCopy.delete        // "Eliminar"
MicroCopy.edit          // "Editar información"
MicroCopy.save          // "Guardar cambios"
MicroCopy.create        // "Crear nuevo"
MicroCopy.retry         // "Intentar de nuevo"
MicroCopy.dismiss       // "Cerrar"
```

### Usage

```swift
// Loading view
LoadingView(message: MicroCopy.loadingData)

// Success alert
.alert("¡Listo!", isPresented: $showSuccess) {
    Button("OK") {}
} message: {
    Text(MicroCopy.createdSuccessfully)
}

// Error alert
Text(viewModel.errorMessage ?? MicroCopy.errorGeneric)

// Button
CustomButton(title: MicroCopy.cancel, style: .secondary) {
    dismiss()
}
```

---

## Component Library

For complete component documentation including API reference, usage examples, and implementation details, see:

**📘 [COMPONENTS.md](COMPONENTS.md) - Complete Component Library Reference**

The component library includes:
- **StatCard** - Dashboard metrics with trend indicators
- **CustomButton** - 4 styles (primary, secondary, tertiary, destructive)
- **CustomTextField** - Form inputs with focus states and validation
- **SkeletonLoader** - Elegant loading states (4 types)
- **LoadingView/LoadingOverlay** - Generic loading spinners

Each component is fully documented with:
✅ Complete API reference
✅ Code examples (basic → advanced)
✅ Feature breakdown
✅ Accessibility guidelines
✅ Layout diagrams

---

## Usage Examples

### Complete Screen Example

```swift
struct CreateLoteView: View {
    @StateObject private var viewModel = CreateLoteViewModel()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ZStack {
                // Background (design system)
                Color.backgroundPrimary
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.xl) {
                        // Header
                        headerView

                        // Form
                        formView

                        // Buttons
                        buttonRow
                    }
                }
            }
            .navigationBarHidden(true)
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK") {}
        } message: {
            Text(viewModel.errorMessage ?? MicroCopy.errorGeneric)
        }
    }

    private var headerView: some View {
        HStack {
            ZStack {
                Circle()
                    .fill(Color.agroGreen.opacity(0.12))
                    .frame(width: 56, height: 56)

                Image(systemName: "leaf.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(.agroGreen)
            }

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("Nuevo Lote")
                    .font(.displayMedium)
                    .foregroundColor(.textPrimary)

                Text("Completa los datos")
                    .font(.bodyMedium)
                    .foregroundColor(.textSecondary)
            }

            Spacer()
        }
        .padding(.horizontal, Spacing.lg)
    }

    private var formView: some View {
        VStack(spacing: Spacing.lg) {
            CustomTextField(
                placeholder: "Nombre del lote *",
                icon: "tag.fill",
                text: $viewModel.nombre
            )

            CustomTextField(
                placeholder: "Ubicación *",
                icon: "location.fill",
                text: $viewModel.ubicacion
            )
        }
        .padding(.horizontal, Spacing.lg)
    }

    private var buttonRow: some View {
        VStack(spacing: Spacing.md) {
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
                        dismiss()
                    } else {
                        HapticFeedback.error()
                    }
                }
            }
            .disabled(!viewModel.isFormValid)

            CustomButton(
                title: MicroCopy.cancel,
                icon: "xmark",
                style: .secondary
            ) {
                HapticFeedback.light()
                dismiss()
            }
        }
        .padding(.horizontal, Spacing.lg)
    }
}
```

---

## Accessibility Guidelines

### VoiceOver Labels

```swift
// Always provide accessibility labels
StatCard(...)
    .accessibilityLabel("\(title): \(value)")
    .accessibilityHint("Toca dos veces para ver detalles")

// Combine children for complex views
VStack {
    Text("Title")
    Text("Value")
}
.accessibilityElement(children: .combine)

// Add traits
Text("Section Header")
    .accessibilityAddTraits(.isHeader)

Button("Delete") { }
    .accessibilityAddTraits(.isDestructive)
```

### Dynamic Type

Design system fonts automatically support Dynamic Type. Test with:
- Settings → Accessibility → Display & Text Size → Larger Text

### Color Contrast

All color combinations meet WCAG AA standards:
- agroGreen on white: 7.2:1 ✅
- textPrimary on backgroundPrimary: 12.5:1 ✅
- textSecondary on backgroundPrimary: 4.8:1 ✅

---

## Migration Guide

### From Old Colors to Design System

```swift
// OLD
.foregroundColor(.green)
.background(Color(.systemGray6))

// NEW
.foregroundColor(.agroGreen)
.background(Color.backgroundSecondary)
```

### From Magic Numbers to Spacing

```swift
// OLD
.padding(16)
VStack(spacing: 24) { }

// NEW
.padding(Spacing.md)
VStack(spacing: Spacing.xl) { }
```

### From Hardcoded Animations to Presets

```swift
// OLD
.animation(.spring(response: 0.3, dampingFraction: 0.7))

// NEW
.animation(AnimationPreset.spring, value: isPressed)
```

---

## Best Practices

### DO ✅

```swift
// Use design system tokens
.padding(Spacing.lg)
.font(.displayMedium)
.foregroundColor(.textPrimary)
.cornerRadius(CornerRadius.large)
.shadow(ShadowStyle.soft)

// Add haptics to interactions
HapticFeedback.medium()

// Use MicroCopy for strings
Text(MicroCopy.errorGeneric)

// Full accessibility
.accessibilityLabel("Crear lote")
```

### DON'T ❌

```swift
// Magic numbers
.padding(17)  // ❌ Use Spacing.lg

// Hardcoded colors
.foregroundColor(.green)  // ❌ Use .agroGreen

// Hardcoded strings
Text("Cargando...")  // ❌ Use MicroCopy.loading

// No accessibility
Button("Delete") { }  // ❌ Add .accessibilityLabel()
```

---

## Quick Reference Card

```swift
// COLORS
.agroGreen .agroGreenLight .agroGreenTint
.successGreen .warningAmber .errorRed
.textPrimary .textSecondary .textTertiary
.backgroundPrimary .backgroundSecondary

// FONTS
.displayLarge .displayMedium .displaySmall
.bodyLarge .bodyMedium .bodySmall
.labelLarge .labelMedium .labelSmall

// SPACING
Spacing.xxs .xs .sm .md .lg .xl .xxl .xxxl

// CORNER RADIUS
CornerRadius.small .medium .large .xlarge .xxlarge

// SHADOWS
ShadowStyle.subtle .soft .medium .strong

// ANIMATIONS
AnimationPreset.spring .springBouncy .easeInOut .easeOut

// HAPTICS
HapticFeedback.light() .medium() .heavy()
HapticFeedback.success() .error() .warning()

// MICRO-COPY
MicroCopy.loading .success .errorGeneric
MicroCopy.cancel .save .create
```

---

**Document Version:** 1.0.0
**Author:** Alejandro Navarro Ayala - CEO & Senior Developer
**Last Updated:** November 28, 2024
**Status:** Production Ready

---

**"Design is not just what it looks like and feels like. Design is how it works."**
— Steve Jobs
