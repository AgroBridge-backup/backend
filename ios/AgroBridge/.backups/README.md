<div align="center">

# 🌱 AgroBridge iOS

**AgTech Blockchain Traceability Platform for Agricultural Producers**

[![Swift](https://img.shields.io/badge/Swift-5.9+-orange.svg)](https://swift.org)
[![iOS](https://img.shields.io/badge/iOS-16.0+-blue.svg)](https://www.apple.com/ios)
[![SwiftUI](https://img.shields.io/badge/UI-SwiftUI-blue.svg)](https://developer.apple.com/xcode/swiftui/)
[![Architecture](https://img.shields.io/badge/Arch-MVVM+Clean-green.svg)](https://github.com/agrobridge/agrobridge-ios)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

**[English](README.md)** • **[Español](README.es.md)**

📖 **Reading time:** ~18 minutes

</div>

---

## 📋 Table of Contents

<details>
<summary>Click to expand</summary>

1. [Description](#-description)
2. [Features](#-features)
3. [Demo](#-demo)
4. [Tech Stack](#️-tech-stack)
5. [Architecture](#-architecture)
6. [Installation](#-installation)
7. [Configuration](#️-configuration)
8. [Project Structure](#-project-structure)
9. [UI/UX Design](#-uiux-design)
10. [API & Backend](#-api--backend)
11. [Development](#-development)
12. [Testing](#-testing)
13. [Contributing](#-contributing)
14. [Roadmap](#️-roadmap)
15. [Team](#-team)
16. [License](#-license)
17. [Contact](#-contact)
18. [Acknowledgments](#-acknowledgments)

</details>

---

## 📖 Description

### The Problem

The agrifood industry faces critical challenges:

- ❌ **Lack of transparency** in the supply chain
- ❌ **Inefficient traceability** of agricultural products
- ❌ **Manual certification** prone to fraud
- ❌ **Disconnection** between producers and buyers
- ❌ **Low technology adoption** in the field

### The Solution: AgroBridge

**AgroBridge iOS** is the native iOS mobile application that forms part of the AgroBridge ecosystem, an enterprise platform that connects **agricultural producers with buyers**, managing:

✅ **Complete traceability** of lots and production blocks
✅ **Blockchain certification** immutable and verifiable
✅ **Producer management** with detailed profiles
✅ **Real-time analytics** with interactive visualizations
✅ **Data export** (PDF, CSV) for reports
✅ **IoT integration** with 7 types of agricultural sensors
✅ **Regulatory compliance** (FDA, USDA, EU)

### Who Is It For?

| User | Benefits |
|------|----------|
| **🌾 Producers** | Manage lots, certify harvests, monitor IoT sensors |
| **🏢 Buyers** | Verify traceability, validate certificates, quality analysis |
| **🔍 Auditors** | Blockchain verification, compliance reports, audits |
| **📊 Administrators** | Complete dashboards, data export, analytics |

---

## ✨ Features

### 🔐 JWT Authentication
- Secure login with email and password
- JWT tokens with automatic refresh (1-hour validity)
- Secure persistence in **Keychain**
- Logout with complete session cleanup
- Real-time validations (email regex, minimum 6-character password)
- Robust error handling (401 → auto-logout)

### 📊 Smart Dashboard
- **4 StatCards** with key metrics:
  - Total Producers (with trend ↑↓)
  - Active Lots
  - Certified Blocks
  - Connection Status (real-time)
- **Skeleton loading** during initial load
- **Pull-to-refresh** to update data
- **Quick actions** with SF Symbols icons
- Interactive charts with **SwiftUI Charts**

### 🌿 Lot Management
- **Complete CRUD**: Create, Read, Update, Delete
- **Real-time search** by name/location
- **Advanced filters**:
  - By crop type (Avocado, Strawberry, Tomato, etc.)
  - By status (active, inactive, harvested)
  - By area range (hectares)
- **Sorting** by name, date, area
- **Complete detail** with GPS location map
- **Form validations** (required fields, data types)

### 👨‍🌾 Producer Management
- **Complete profiles** with photo, contact, address
- **Statistics** per producer:
  - Total managed lots
  - Accumulated production
  - Average quality (1-5 stars)
- **List with search** and filters
- **Complete CRUD** with validations

### 🔗 Blockchain & Certification
- **Block creation** with SHA256 hash
- **Chain integrity verification**
- **QR code generator** for traceability
- **Certificate PDF** with digital signature
- **Complete metadata**:
  - Harvest date
  - Weight (kg)
  - Quality (A, B, C)
  - Storage conditions
  - GPS location

### 📈 Analytics & Reports
- **Interactive charts** (SwiftUI Charts):
  - Lots by crop type (Pie Chart)
  - Monthly production (Bar Chart)
  - Certification trend (Line Chart)
  - Geographic distribution (Scatter Plot)
- **Period selector**: 7D, 30D, 90D, 365D, Custom
- **Data export**:
  - **PDF**: 3 types (summary, complete, certificate)
  - **CSV**: 5 functions (lots, producers, blocks, sensors, analytics)
- **Dynamic filters** by crop, region, producer

### 🌡️ IoT Monitoring
- **7 sensor types**:
  - 🌡️ Ambient temperature
  - 💧 Soil moisture
  - 🌬️ Wind speed
  - ☀️ Solar radiation
  - 📏 Soil pH
  - 🧪 Electrical conductivity (EC)
  - 🍃 Atmospheric pressure
- **Visual states**:
  - 🟢 Normal (green)
  - 🟡 Warning (yellow)
  - 🔴 Critical (red)
- **Push alerts** when sensors exceed thresholds
- **Reading history** with charts

### 🎨 Design System (Jony Ive Philosophy)
- **6 core principles**: Clarity, Depth, Deference, Feedback, Consistency, Humanity
- **Professional color palette** with Dark Mode support
- **SF Pro typography** (Apple's native system)
- **Consistent spacing** (4pt system)
- **Fluid animations** (spring, ease-in-out)
- **Haptic feedback** (7 types: light, medium, heavy, success, error, warning, selection)
- **Complete accessibility**:
  - VoiceOver labels and hints
  - Dynamic Type (up to .xxxLarge)
  - WCAG AAA contrast (7:1 ratio)
  - Reduce Motion support

### 🚀 Performance & UX
- **MVVM + Clean architecture** for separation of concerns
- **Async/await** (zero callbacks, readable code)
- **Robust error handling** with 10 NetworkError types
- **Loading states** in all async operations
- **Offline mode** (CoreData cache, auto sync)
- **Pull-to-refresh** in all lists
- **Empty states** with illustrations and CTAs
- **Infinite scroll** with pagination (20 items/page)

---

## 🎬 Demo

### Screenshots

<div align="center">

| Login | Dashboard | Lots | Analytics |
|:-----:|:---------:|:----:|:---------:|
| ![Login](docs/screenshots/login.png) | ![Dashboard](docs/screenshots/dashboard.png) | ![Lots](docs/screenshots/lotes.png) | ![Analytics](docs/screenshots/analytics.png) |
| JWT Authentication | Real-time metrics | Complete management | Interactive charts |

| Create Lot | Lot Detail | Producers | Profile |
|:----------:|:----------:|:---------:|:-------:|
| ![Create](docs/screenshots/create-lote.png) | ![Detail](docs/screenshots/lote-detail.png) | ![Producers](docs/screenshots/productores.png) | ![Profile](docs/screenshots/profile.png) |
| Validated form | Complete info | List with stats | Edit profile |

</div>

> 📸 **Note:** Screenshots are updated with each release. All images are from the real app running on iPhone 15 Pro (iOS 17).

---

## 🛠️ Tech Stack

### Frontend (iOS)

| Category | Technology | Version | Use |
|----------|-----------|---------|-----|
| **Language** | Swift | 5.9+ | Primary language |
| **UI Framework** | SwiftUI | iOS 16.0+ | Declarative interface |
| **Architecture** | MVVM + Clean | - | Separation of concerns |
| **Networking** | URLSession | Native | HTTP requests |
| **JSON** | Codable | Native | Encoding/Decoding |
| **Persistence** | Keychain | Native | Secure tokens |
| **Cache** | CoreData | Native | Offline mode |
| **Reactive** | Combine | Native | Reactive programming |
| **Async** | async/await | Swift 5.5+ | Modern concurrency |
| **Charts** | SwiftUI Charts | iOS 16+ | Visualizations |
| **Maps** | MapKit | Native | GPS locations |
| **PDF** | PDFKit | Native | PDF generation |
| **QR** | CoreImage | Native | QR codes |
| **Firebase** | Analytics + Crashlytics | 10.18.0 | Telemetry (optional) |

### Backend (Reference)

| Technology | Version | Use |
|-----------|---------|-----|
| **Runtime** | Node.js | 18.x | Server |
| **Framework** | Express.js | 4.18.x | REST API |
| **Language** | TypeScript | 5.x | Type safety |
| **Database** | PostgreSQL | 15.x | Structured data |
| **ORM** | Prisma | 5.x | Query builder |
| **Authentication** | JWT | - | Secure tokens |
| **Blockchain** | Custom | - | Certification |
| **Cloud** | AWS | - | EC2, RDS, S3 |

---

## 🏗 Architecture

### MVVM + Clean Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       VIEWS (SwiftUI)                           │
│  - Declarative, no business logic                               │
│  - Observe ViewModels with @StateObject                         │
│  - Auto re-rendering with @Published                            │
│                                                                 │
│  Examples: LoginView, DashboardView, LotesListView             │
└────────────────┬────────────────────────────────────────────────┘
                 │ @StateObject
                 │ @Published changes
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VIEW MODELS                                │
│  - @MainActor for thread safety                                │
│  - Presentation logic (validations, formatting)                 │
│  - Data transformation for UI                                   │
│  - Loading, error states                                        │
│                                                                 │
│  Examples: LoginViewModel, DashboardViewModel                  │
└────────────────┬────────────────────────────────────────────────┘
                 │ Calls
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICES                                 │
│  - Singleton pattern (.shared)                                 │
│  - Core business logic                                          │
│  - Orchestration of multiple APIClient calls                    │
│  - Global state management (e.g., authenticated user)           │
│                                                                 │
│  Examples: AuthService, LoteService, ProductorService          │
└────────────────┬────────────────────────────────────────────────┘
                 │ Uses
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API CLIENT                                │
│  - Generic networking with async/await                         │
│  - Automatic JWT interceptor                                    │
│  - Robust error handling (10 NetworkError types)                │
│  - JSON encoding/decoding with Codable                          │
│  - Extensive logging (DEBUG mode)                               │
│                                                                 │
│  APIClient.shared.request<T: Codable>(...)                     │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP/JSON
                 ▼
          ┌──────────────────┐
          │   BACKEND REST   │
          │   AgroBridge     │
          │ PostgreSQL + JWT │
          └──────────────────┘
```

---

## 🚀 Installation

### Prerequisites

| Requirement | Minimum Version | Verify |
|-------------|----------------|--------|
| **macOS** | Ventura (13.0+) | `sw_vers` |
| **Xcode** | 15.0+ | `xcodebuild -version` |
| **Swift** | 5.9+ | `swift --version` |
| **iOS** | 16.0+ (simulator or physical) | - |
| **Apple Developer** | Free or paid account | [appleid.apple.com](https://appleid.apple.com) |

### Step 1: Clone Repository

```bash
# Clone the repository (requires access to private repo)
git clone https://github.com/agrobridge-private/agrobridge-ios.git
cd agrobridge-ios/AgroBridge

# If you don't have access, request from: dev@agrobridge.io
```

### Step 2: Open in Xcode

```bash
open AgroBridge.xcodeproj
```

### Step 3: Configure Signing & Capabilities

1. Select **AgroBridge** target in project navigator
2. **Signing & Capabilities** tab
3. Configure:
   - **Team:** Select your development team
   - **Bundle Identifier:** Change to your domain (e.g., `com.yourcompany.agrobridge`)
   - **Signing Certificate:** Automatic (Xcode handles)

### Step 4: Build and Run

1. Select simulator: **iPhone 15 Pro** (recommended) or any iOS 16.0+
2. Press `⌘ + R` (or click ▶️ Play)
3. Wait for build (~30-60 seconds first time)
4. App opens in simulator

---

## ⚙️ Configuration

### Environments (Development, Staging, Production)

The project supports 3 environments configured in `Configuration/AppConfiguration.swift`:

```swift
enum Environment {
    case development
    case staging
    case production
}

static var baseURL: String {
    switch environment {
    case .development:
        return "https://dev-api.agrobridge.io/v1"
    case .staging:
        return "https://staging-api.agrobridge.io/v1"
    case .production:
        return "https://api.agrobridge.io/v1"
    }
}
```

### Firebase (Optional)

1. Create project at [Firebase Console](https://console.firebase.google.com)
2. Add iOS app with Bundle ID: `com.agrobridge.ios`
3. Download `GoogleService-Info.plist`
4. Drag file to Xcode (project root)
5. In `AppConfiguration.swift`:
   ```swift
   static let isFirebaseEnabled = true  // Change to true
   ```

---

## 📁 Project Structure

```
AgroBridge/
│
├── 🎯 App/
│   └── AgroBridgeApp.swift                  # Entry point, @main, main TabView
│
├── ⚙️ Configuration/
│   └── AppConfiguration.swift               # Environments, URLs, feature flags
│
├── 🔧 Core/
│   ├── Networking/
│   │   ├── APIClient.swift                  # Generic HTTP client (async/await)
│   │   ├── Endpoint.swift                   # 25+ endpoints definition
│   │   ├── HTTPMethod.swift                 # GET, POST, PUT, PATCH, DELETE
│   │   └── NetworkError.swift               # 10 error types
│   ├── Persistence/
│   │   └── KeychainManager.swift            # Save/load JWT securely
│   ├── Extensions/
│   │   ├── Color+Extensions.swift           # .agroGreen, .textPrimary, etc.
│   │   ├── Date+Extensions.swift            # .formatted(), .iso8601String
│   │   └── String+Extensions.swift          # .isValidEmail, .trimmed
│   └── Managers/
│       ├── PDFGenerator.swift               # Generate PDFs (3 types)
│       ├── CSVExporter.swift                # Export CSV (5 functions)
│       └── QRCodeGeneratorManager.swift     # Generate QR codes
│
├── 📦 Models/
│   ├── User.swift                           # User, LoginRequest, LoginResponse, UserRole
│   ├── Lote.swift                           # Lote, CreateLoteRequest, LoteEstado
│   ├── Productor.swift                      # Productor, ProductorEstado
│   ├── Bloque.swift                         # Bloque (blockchain), BloqueMetadata
│   ├── DashboardStats.swift                 # DashboardStats, TrendData
│   ├── Analytics.swift                      # Analytics, ChartData, Metric
│   ├── Sensor.swift                         # Sensor, SensorReading, SensorType (7 types)
│   └── Common.swift                         # Shared types (Pagination, etc.)
│
├── 🔌 Services/
│   ├── AuthService.swift                    # Login, logout, refresh, checkSession
│   ├── LoteService.swift                    # CRUD lots, search, filters
│   ├── ProductorService.swift               # CRUD producers
│   ├── BloqueService.swift                  # CRUD blocks, verify hash
│   ├── DashboardService.swift               # Fetch stats
│   └── SensorService.swift                  # Fetch readings, alerts
│
├── 🧠 ViewModels/
│   ├── Auth/
│   │   └── LoginViewModel.swift             # Validations, login logic
│   ├── Dashboard/
│   │   └── DashboardViewModel.swift         # Load stats, refresh
│   ├── Lote/
│   │   ├── LotesListViewModel.swift         # List, search, filters
│   │   ├── LoteDetailViewModel.swift        # Complete detail
│   │   ├── CreateLoteViewModel.swift        # Create with validations
│   │   └── EditLoteViewModel.swift          # Edit lot
│   └── ... (more ViewModels)
│
├── 🎨 Views/
│   ├── Auth/
│   │   └── LoginView.swift                  # Login screen
│   ├── Dashboard/
│   │   └── DashboardView.swift              # Main dashboard
│   ├── Lote/
│   │   ├── LotesListView.swift              # List with search
│   │   ├── LoteDetailView.swift             # Complete detail
│   │   ├── CreateLoteView.swift             # Create form
│   │   └── EditLoteView.swift               # Edit form
│   └── Components/                          # 14 reusable components
│       ├── StatCard.swift                   # Metric card with trend
│       ├── CustomButton.swift               # Custom button
│       ├── CustomTextField.swift            # TextField with icon
│       ├── LoadingView.swift                # Loading states
│       └── ... (more components)
│
├── 📝 docs/                                 # Complete documentation
│   ├── ARCHITECTURE.md                      # 1,234 lines: Diagrams, patterns
│   ├── DESIGN_SYSTEM.md                     # 1,456 lines: Colors, typography
│   ├── COMPONENTS.md                        # 1,086 lines: 14 components reference
│   ├── API_INTEGRATION.md                   # 1,093 lines: 25 endpoints
│   ├── DEVELOPMENT_GUIDE.md                 # 1,024 lines: Workflow, conventions
│   └── CHECKPOINT_SUMMARY.md                # 446 lines: Executive summary
│
└── 📝 README files
    ├── README.md                            # ← THIS FILE (English)
    ├── README.es.md                         # Spanish version
    └── CLAUDE.md                            # Complete technical documentation and context

**Totals:**
- **79 Swift files** (~13,300 lines)
- **19 ViewModels** (all @MainActor + ObservableObject)
- **6 Services** (all Singleton)
- **9 Models** (all Codable + Identifiable)
- **14 Reusable components**
- **7 .md documents** (29,200+ words)
```

---

## 🎨 UI/UX Design

### Design Philosophy (Jony Ive)

AgroBridge implements **Jony Ive's** design philosophy (ex-Chief Design Officer at Apple):

> *"Simplicity is the ultimate sophistication. Design is not just what it looks like, design is how it works."*

#### 6 Core Principles

1. **🎯 Clarity** - Every element has clear purpose, zero superfluous decoration
2. **📐 Depth** - Visual hierarchy with subtle shadows (never exaggerated)
3. **🙇 Deference** - Content is king, UI elegantly recedes
4. **⚡ Feedback** - Immediate response with haptics + animations (300ms ideal)
5. **🔗 Consistency** - Unified system throughout the app (Design System)
6. **❤️ Humanity** - Warm language, universal accessibility (WCAG AAA)

### Color Palette

All colors are defined in `AgroBridgeDesignSystem.swift` with Dark Mode support.

#### Brand Colors

| Color | Hex | Use |
|-------|-----|-----|
| **AgroGreen** | `#2D5016` | Primary (buttons, icons, headers) |
| **AgroGreenLight** | `#57A02B` | Accent (hover, active states) |
| **AgroGreenTint** | `#E8F5E3` | Subtle background (cards, inputs) |
| **AgroEarth** | `#8B6F47` | Secondary (earth, grounding) |
| **AgroSky** | `#4A90E2` | Tertiary (water, weather) |

See [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for complete documentation.

---

## 🔌 API & Backend

### Authentication (JWT)

All requests (except `/auth/login`) require JWT in header:

```http
Authorization: Bearer <JWT_TOKEN>
```

**Token Lifecycle:**
- **Access Token:** Valid for **1 hour** (60 min)
- **Refresh Token:** Valid for **7 days**
- **Auto refresh:** APIClient refreshes token 5 minutes before expiration

### Main Endpoints

#### 🔐 Authentication

##### POST `/auth/login`

```json
POST https://api.agrobridge.io/v1/auth/login
Content-Type: application/json

{
  "email": "producer@example.com",
  "password": "SecurePass123!"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-123",
      "email": "producer@example.com",
      "name": "John Doe",
      "role": "producer"
    },
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here...",
    "expiresIn": 3600
  }
}
```

See [API_INTEGRATION.md](docs/API_INTEGRATION.md) for complete documentation of all 25 endpoints.

---

## 💻 Development

### Development Workflow

#### 1. Create Branch

```bash
# Feature branch
git checkout -b feature/add-push-notifications

# Bugfix branch
git checkout -b fix/analytics-crash
```

#### 2. Commit with Descriptive Message

**Format:** `type(scope): message in imperative`

```bash
# Correct examples
git commit -m "feat(lots): Add harvest date filter"
git commit -m "fix(auth): Fix infinite token refresh loop"
git commit -m "docs(readme): Update installation section"
```

**Valid types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Refactoring (no functionality change)
- `docs` - Documentation changes
- `test` - Add or modify tests
- `chore` - Maintenance tasks

See [DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) for complete guide with 50+ best practices.

---

## 🧪 Testing

### Current Status

⚠️ **Testing suite pending implementation**

The project currently has **no tests** implemented, but the MVVM + Clean Architecture facilitates future testing.

### Testing Roadmap

#### Phase 1: Unit Tests (Q1 2026)

**ViewModels:**
- `LoginViewModel` - Login flow, validation, error handling
- `DashboardViewModel` - Stats loading, refresh logic
- `LotesListViewModel` - Search, filters, CRUD operations

**Target Coverage:** 70%+

---

## 🤝 Contributing

### How to Contribute

#### 1. Fork Repository

```bash
# Fork the private repository (requires team access)
git clone https://github.com/YOUR-USERNAME/agrobridge-ios.git
cd agrobridge-ios
git remote add upstream https://github.com/agrobridge-private/agrobridge-ios.git
```

#### 2. Create Feature Branch

```bash
git checkout -b feature/my-new-feature
```

#### 3. Implement Changes

- Follow **code conventions**
- Add **comments** where necessary
- Use **MARK:** to organize
- Add **logs** with emoji

#### 4. Open Pull Request

1. Push to your fork: `git push origin feature/my-new-feature`
2. Go to GitHub and open Pull Request
3. Fill PR template
4. Assign reviewers

---

## 🗓️ Roadmap

### ✅ Phase 1: MVP Core (COMPLETED - Nov 2025)

- [x] **JWT Authentication** - Login, refresh tokens, Keychain
- [x] **Main Dashboard** - 4 StatCards with trends + skeleton loading
- [x] **CRUD Lots** - List, create, edit, delete, search, filters
- [x] **CRUD Producers** - List, create, edit, profile with stats
- [x] **CRUD Blockchain Blocks** - SHA256 hash, verify integrity, QR code
- [x] **Analytics** - 4 charts SwiftUI Charts + period selector
- [x] **Export** - PDF (3 types) + CSV (5 functions)
- [x] **IoT Sensors** - 7 sensor types + visual states
- [x] **Design System** - Jony Ive philosophy
- [x] **Documentation** - 7 .md files, 29,200+ words

### 🚧 Phase 2: UX Improvements (Dec 2025 - Jan 2026)

- [ ] **Onboarding Flow** - 3 interactive screens
- [ ] **Push Notifications** - Firebase Cloud Messaging
- [ ] **Face ID / Touch ID** - Biometric login
- [ ] **Dark Mode** - Complete support
- [ ] **i18n Localization** - English + Spanish
- [ ] **iOS 17 Widget** - StatCards on home screen

### 🔮 Phase 3: Advanced Features (Feb - Mar 2026)

- [ ] **Offline Mode** - CoreData cache + sync
- [ ] **Maps Integration** - MapKit for lots
- [ ] **Weather API** - OpenWeather integration
- [ ] **Crop Predictions** - CoreML model
- [ ] **Photo Capture** - Camera + S3 upload
- [ ] **AR Visualizations** - RealityKit

---

## 👥 Team

### Core Team

| Role | Responsibility |
|------|---------------|
| **Founder & CEO** | Product vision, strategy |
| **Tech Lead iOS** | Architecture, code review, releases |
| **Backend Lead** | API design, database, DevOps |
| **UI/UX Designer** | Design system, user research |
| **QA Engineer** | Testing, CI/CD, quality assurance |

---

## 📄 License

**Proprietary & Confidential**

© 2025 AgroBridge. All rights reserved.

This software is **private property** of AgroBridge. Use, reproduction, distribution, or modification of the source code is **strictly prohibited** without written authorization.

### For Licensing Inquiries

- **Email:** licensing@agrobridge.io
- **Enterprise Sales:** sales@agrobridge.io

---

## 📞 Contact

### 📧 Email

- **General:** contact@agrobridge.io
- **Support:** support@agrobridge.io
- **Sales:** sales@agrobridge.io

### 🐛 Report Bugs

- **GitHub Issues:** [github.com/agrobridge/agrobridge-ios/issues](https://github.com/agrobridge/agrobridge-ios/issues)
- **Security Issues:** security@agrobridge.io

### 💬 Social Media

- **Twitter:** [@AgroBridge](https://twitter.com/agrobridge)
- **LinkedIn:** [AgroBridge](https://linkedin.com/company/agrobridge)

---

## 🙏 Acknowledgments

### Technology

- **Apple** - For the incredible iOS ecosystem, SwiftUI, and development tools
- **Firebase** - For analytics, crashlytics, and cloud messaging tools
- **PostgreSQL** - For the robust and reliable database
- **AWS** - For the scalable cloud infrastructure

### Inspiration

- **Jony Ive** - For the design philosophy guiding our UI/UX
- **iOS Community** - For sharing knowledge and best practices
- **Open Source** - For the resources that inspired this project

---

<div align="center">

**Made with ❤️ in Mexico 🇲🇽**

From farm to table, with technology 🌾 → 🔗 → 📦

---

**Developed by:** Alejandro Navarro Ayala - CEO & Senior Developer
**Last Updated:** November 28, 2024
**Version:** 1.0.0
**Status:** Production Ready

[⬆ Back to top](#-table-of-contents)

</div>
