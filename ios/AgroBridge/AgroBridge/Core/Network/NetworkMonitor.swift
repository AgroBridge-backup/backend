//
//  NetworkMonitor.swift
//  AgroBridge
//
//  Created by Alejandro Navarro Ayala - CEO & Senior Developer
//  Copyright © 2025 AgroBridge International. All rights reserved.
//
//  ANDROID EQUIVALENT: ConnectivityManager wrapper
//

import Foundation
import Network
import Combine

/**
 * NetworkMonitor - Monitor de conectividad de red
 *
 * Responsabilidades:
 * ✓ Detectar cambios en conectividad (online/offline)
 * ✓ Publicar estado de conexión reactivamente
 * ✓ Detectar tipo de conexión (WiFi, Cellular, Wired)
 * ✓ Trigger sync cuando se recupera conexión
 *
 * Uso:
 * ```swift
 * let monitor = NetworkMonitor.shared
 * monitor.start()
 *
 * // Observar cambios
 * monitor.$isConnected
 *     .sink { isConnected in
 *         if isConnected {
 *             // Trigger sync
 *         }
 *     }
 * ```
 *
 * ANDROID PARITY: Matches ConnectivityManager functionality
 * - Detects network availability
 * - Publishes connection status changes
 * - Supports WiFi/Cellular detection
 */
@MainActor
class NetworkMonitor: ObservableObject {

    // MARK: - Singleton

    static let shared = NetworkMonitor()

    // MARK: - Published Properties

    /// Indica si hay conexión a internet
    @Published private(set) var isConnected = false

    /// Tipo de conexión actual
    @Published private(set) var connectionType: ConnectionType = .none

    /// Indica si es conexión costosa (cellular)
    @Published private(set) var isExpensive = false

    // MARK: - Connection Type

    enum ConnectionType: String {
        case wifi = "WiFi"
        case cellular = "Cellular"
        case wired = "Wired"
        case none = "No Connection"
    }

    // MARK: - Private Properties

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.agrobridge.networkmonitor")
    private var isMonitoring = false

    // MARK: - Initialization

    private init() {
        setupMonitor()
    }

    deinit {
        stop()
    }

    // MARK: - Public Methods

    /**
     * Inicia el monitoreo de red
     */
    func start() {
        guard !isMonitoring else { return }

        monitor.start(queue: queue)
        isMonitoring = true

        print("🌐 NetworkMonitor: Started monitoring")
    }

    /**
     * Detiene el monitoreo de red
     */
    func stop() {
        guard isMonitoring else { return }

        monitor.cancel()
        isMonitoring = false

        print("🌐 NetworkMonitor: Stopped monitoring")
    }

    // MARK: - Private Methods

    private func setupMonitor() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }

            Task { @MainActor in
                self.updateConnectionStatus(path)
            }
        }
    }

    private func updateConnectionStatus(_ path: NWPath) {
        // Update connection status
        let wasConnected = isConnected
        isConnected = path.status == .satisfied

        // Update connection type
        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .wired
        } else {
            connectionType = .none
        }

        // Update expensive status
        isExpensive = path.isExpensive

        // Log connection changes
        if wasConnected != isConnected {
            if isConnected {
                print("🌐 NetworkMonitor: Connected via \(connectionType.rawValue)")
            } else {
                print("🌐 NetworkMonitor: Disconnected")
            }
        }
    }
}

// MARK: - Convenience Properties

extension NetworkMonitor {

    /// Indica si la conexión es WiFi
    var isWiFi: Bool {
        return connectionType == .wifi
    }

    /// Indica si la conexión es celular
    var isCellular: Bool {
        return connectionType == .cellular
    }

    /// Indica si se debe evitar descargas grandes (cellular + expensive)
    var shouldAvoidHeavyDownloads: Bool {
        return isCellular && isExpensive
    }
}
