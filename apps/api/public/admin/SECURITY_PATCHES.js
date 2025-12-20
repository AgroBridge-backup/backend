/**
 * CRITICAL SECURITY PATCHES for AgroBridge Admin Dashboard
 * Apply these fixes to app.js IMMEDIATELY
 *
 * Priority: HIGH
 * Impact: Prevents XSS, improves security posture
 */

// ==========================================================================
// PATCH 1: HTML Escaping Function (Prevents XSS)
// ==========================================================================

/**
 * Escapes HTML to prevent XSS attacks
 * USE THIS for all user-generated content before innerHTML
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';

    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
}

// Alternative using regex (faster but less secure):
function escapeHtmlFast(unsafe) {
    if (typeof unsafe !== 'string') return '';

    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// EXAMPLE USAGE:
/*
// BEFORE (VULNERABLE):
tbody.innerHTML = `<td>${advance.producerName}</td>`;

// AFTER (SECURE):
tbody.innerHTML = `<td>${escapeHtml(advance.producerName)}</td>`;
*/

// ==========================================================================
// PATCH 2: Input Sanitization
// ==========================================================================

/**
 * Sanitizes user input to prevent injection attacks
 */
function sanitizeInput(input, maxLength = 1000) {
    if (typeof input !== 'string') return '';

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .slice(0, maxLength);
}

// ==========================================================================
// PATCH 3: Rate Limiting for Login
// ==========================================================================

const LoginRateLimiter = {
    attempts: new Map(),
    maxAttempts: 5,
    lockoutDuration: 900000, // 15 minutes

    canAttempt(email) {
        const data = this.attempts.get(email);

        if (!data) return true;

        if (data.count >= this.maxAttempts) {
            const now = Date.now();
            if (now - data.lastAttempt < this.lockoutDuration) {
                const remainingMs = this.lockoutDuration - (now - data.lastAttempt);
                const remainingMin = Math.ceil(remainingMs / 60000);
                return {
                    allowed: false,
                    remainingMinutes: remainingMin
                };
            }
            // Reset after lockout period
            this.attempts.delete(email);
            return true;
        }

        return true;
    },

    recordAttempt(email, successful) {
        if (successful) {
            this.attempts.delete(email);
            return;
        }

        const data = this.attempts.get(email) || { count: 0, lastAttempt: 0 };
        data.count++;
        data.lastAttempt = Date.now();
        this.attempts.set(email, data);
    }
};

// APPLY TO handleLogin function:
/*
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;

    // Check rate limit
    const canAttempt = LoginRateLimiter.canAttempt(email);
    if (canAttempt.allowed === false) {
        showError(`Demasiados intentos. Intenta en ${canAttempt.remainingMinutes} minutos.`);
        return;
    }

    try {
        const response = await API.auth.login(email, password);
        LoginRateLimiter.recordAttempt(email, true);
        // ... success logic
    } catch (error) {
        LoginRateLimiter.recordAttempt(email, false);
        // ... error logic
    }
}
*/

// ==========================================================================
// PATCH 4: Request Timeout & Abort
// ==========================================================================

class SecureAPI {
    constructor(baseURL, defaultTimeout = 10000) {
        this.baseURL = baseURL;
        this.defaultTimeout = defaultTimeout;
    }

    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            options.timeout || this.defaultTimeout
        );

        try {
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            if (AppState.token) {
                headers['Authorization'] = `Bearer ${AppState.token}`;
            }

            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal
            });

            clearTimeout(timeout);

            // Check for token expiration
            if (response.status === 401) {
                AppState.clear();
                showScreen('login');
                throw new Error('Session expired. Please login again.');
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            clearTimeout(timeout);

            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please check your connection.');
            }

            // Don't log sensitive data in production
            if (process.env.NODE_ENV === 'development') {
                console.error('API Error:', error);
            }

            throw error;
        }
    }
}

// ==========================================================================
// PATCH 5: Memory Leak Prevention - Chart Cleanup
// ==========================================================================

function renderVolumeChart() {
    const ctx = document.getElementById('volumeChart');
    if (!ctx) return;

    // CRITICAL: Destroy existing chart before creating new one
    if (AppState.charts.volumeChart) {
        AppState.charts.volumeChart.destroy();
        AppState.charts.volumeChart = null;
    }

    // ... chart creation code
    AppState.charts.volumeChart = new Chart(ctx, config);
}

function renderStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    // CRITICAL: Destroy existing chart
    if (AppState.charts.statusChart) {
        AppState.charts.statusChart.destroy();
        AppState.charts.statusChart = null;
    }

    // ... chart creation code
    AppState.charts.statusChart = new Chart(ctx, config);
}

// ==========================================================================
// PATCH 6: Race Condition Prevention
// ==========================================================================

const AsyncLock = {
    locks: new Map(),

    async acquire(key, fn) {
        if (this.locks.get(key)) {
            console.warn(`Lock "${key}" already acquired, skipping`);
            return;
        }

        this.locks.set(key, true);
        try {
            await fn();
        } finally {
            this.locks.delete(key);
        }
    }
};

// APPLY TO loadDashboardData:
/*
async function loadDashboardData() {
    await AsyncLock.acquire('loadDashboardData', async () => {
        try {
            const advancesData = await API.advances.list();
            AppState.advances = advancesData.data || advancesData || [];

            // ... rest of loading logic
        } catch (error) {
            console.error('Error loading data:', error);
            Components.showToast('Error', 'Failed to load data', 'error');
        }
    });
}
*/

// ==========================================================================
// PATCH 7: Visibility-Based Auto-Refresh
// ==========================================================================

function startAutoRefresh() {
    if (AppState.autoRefreshInterval) {
        clearInterval(AppState.autoRefreshInterval);
    }

    let lastRefresh = Date.now();

    AppState.autoRefreshInterval = setInterval(() => {
        // Only refresh if tab is visible
        if (document.visibilityState === 'visible') {
            const now = Date.now();
            // Ensure at least 30s between refreshes
            if (now - lastRefresh >= 30000) {
                refreshData();
                lastRefresh = now;
            }
        }
    }, 30000);
}

// ==========================================================================
// PATCH 8: Global Error Handlers
// ==========================================================================

// Add these to DOMContentLoaded:
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);

    // Don't show error toast for script loading errors
    if (event.filename) {
        Components.showToast(
            'Error',
            'Something went wrong. Please refresh the page.',
            'error'
        );
    }

    // TODO: Send to error tracking service (Sentry, etc.)
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    Components.showToast(
        'Error',
        'An unexpected error occurred.',
        'error'
    );

    // Prevent default to avoid console error
    event.preventDefault();
});

// ==========================================================================
// PATCH 9: Secure Event Listener Attachment
// ==========================================================================

/**
 * Replace all inline onclick with proper event listeners
 * Add this to DOMContentLoaded section
 */
function attachEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Language toggles
    const langBtnLogin = document.getElementById('langBtnLogin');
    const langToggle = document.getElementById('langToggle');
    if (langBtnLogin) langBtnLogin.addEventListener('click', toggleLanguage);
    if (langToggle) langToggle.addEventListener('click', toggleLanguage);

    // Password toggle
    const passwordToggle = document.getElementById('passwordToggle');
    if (passwordToggle) passwordToggle.addEventListener('click', togglePassword);

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    // User menu
    const userMenuBtn = document.getElementById('userMenuBtn');
    if (userMenuBtn) userMenuBtn.addEventListener('click', toggleUserMenu);

    // Settings and logout
    const settingsLink = document.getElementById('settingsLink');
    const logoutLink = document.getElementById('logoutLink');
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSettings();
        });
    }
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Quick action buttons
    const approveAllBtn = document.getElementById('approveAllBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const requestTestimonialsBtn = document.getElementById('requestTestimonialsBtn');

    if (approveAllBtn) approveAllBtn.addEventListener('click', approveAllPending);
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);
    if (generateReportBtn) generateReportBtn.addEventListener('click', generateReport);
    if (requestTestimonialsBtn) requestTestimonialsBtn.addEventListener('click', requestTestimonials);

    // Other buttons
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshActivityBtn = document.getElementById('refreshActivityBtn');
    const approveSelectedBtn = document.getElementById('approveSelectedBtn');
    const disburseSelectedBtn = document.getElementById('disburseSelectedBtn');
    const addFarmerBtn = document.getElementById('addFarmerBtn');
    const exportPDFBtn = document.getElementById('exportPDFBtn');
    const exportExcelReportBtn = document.getElementById('exportExcelReportBtn');

    if (refreshBtn) refreshBtn.addEventListener('click', refreshData);
    if (refreshActivityBtn) refreshActivityBtn.addEventListener('click', refreshActivity);
    if (approveSelectedBtn) approveSelectedBtn.addEventListener('click', approveSelected);
    if (disburseSelectedBtn) disburseSelectedBtn.addEventListener('click', disburseSelected);
    if (addFarmerBtn) addFarmerBtn.addEventListener('click', addFarmer);
    if (exportPDFBtn) exportPDFBtn.addEventListener('click', exportDashboardPDF);
    if (exportExcelReportBtn) exportExcelReportBtn.addEventListener('click', exportExcelReport);

    // Search inputs with debounce
    const pendingSearch = document.getElementById('pendingSearch');
    const farmerSearch = document.getElementById('farmerSearch');

    if (pendingSearch) {
        pendingSearch.addEventListener('input', Utils.debounce(filterPending, 300));
    }
    if (farmerSearch) {
        farmerSearch.addEventListener('input', Utils.debounce(filterFarmers, 300));
    }

    // Filters and sorts
    const pendingFilter = document.getElementById('pendingFilter');
    const pendingSort = document.getElementById('pendingSort');
    const farmerSort = document.getElementById('farmerSort');
    const autoRefresh = document.getElementById('autoRefresh');

    if (pendingFilter) pendingFilter.addEventListener('change', filterPending);
    if (pendingSort) pendingSort.addEventListener('change', filterPending);
    if (farmerSort) farmerSort.addEventListener('change', filterFarmers);
    if (autoRefresh) autoRefresh.addEventListener('change', toggleAutoRefresh);

    // Checkboxes
    const selectAll = document.getElementById('selectAll');
    const selectAllApproved = document.getElementById('selectAllApproved');

    if (selectAll) selectAll.addEventListener('change', toggleSelectAll);
    if (selectAllApproved) selectAllApproved.addEventListener('change', toggleSelectAllApproved);

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Modal overlay
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeModal);
    }

    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });
}

// ==========================================================================
// PATCH 10: Modal Focus Trap
// ==========================================================================

function showModal(modalId) {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById(modalId);

    overlay.classList.add('show');
    modal.classList.add('show');

    // Focus management
    const focusableElements = modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Trap focus
    const handleTabKey = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
    };

    modal.addEventListener('keydown', handleTabKey);

    // Store handler for cleanup
    modal._focusTrapHandler = handleTabKey;

    // Set initial focus
    setTimeout(() => firstElement?.focus(), 100);
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    const modals = document.querySelectorAll('.modal');

    overlay.classList.remove('show');
    modals.forEach(modal => {
        modal.classList.remove('show');

        // Remove focus trap
        if (modal._focusTrapHandler) {
            modal.removeEventListener('keydown', modal._focusTrapHandler);
            delete modal._focusTrapHandler;
        }
    });
}

// ==========================================================================
// PATCH 11: Chart Resize Handler
// ==========================================================================

// Add this after chart creation
window.addEventListener('resize', Utils.debounce(() => {
    if (AppState.charts.volumeChart) {
        AppState.charts.volumeChart.resize();
    }
    if (AppState.charts.statusChart) {
        AppState.charts.statusChart.resize();
    }
}, 250));

// ==========================================================================
// PATCH 12: Constants for Magic Numbers
// ==========================================================================

const CONFIG = {
    TOAST_DURATION_MS: 5000,
    AUTO_REFRESH_INTERVAL_MS: 30000,
    REQUEST_TIMEOUT_MS: 10000,
    SEARCH_DEBOUNCE_MS: 300,
    RESIZE_DEBOUNCE_MS: 250,
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_LOCKOUT_DURATION_MS: 900000, // 15 minutes
    MAX_INPUT_LENGTH: 1000
};

// Use throughout the code:
// setTimeout(() => toast.remove(), CONFIG.TOAST_DURATION_MS);

// ==========================================================================
// APPLICATION INSTRUCTIONS
// ==========================================================================

/*
TO APPLY THESE PATCHES:

1. IMMEDIATE (Critical Security):
   - Add escapeHtml() function to app.js
   - Replace all innerHTML with escaped values
   - Add attachEventListeners() to DOMContentLoaded
   - Implement LoginRateLimiter in handleLogin()

2. HIGH PRIORITY (This Week):
   - Replace API class with SecureAPI
   - Add chart cleanup in render functions
   - Add AsyncLock to loadDashboardData
   - Implement visibility-based auto-refresh

3. MEDIUM PRIORITY (Next Week):
   - Add global error handlers
   - Implement modal focus trap
   - Add chart resize handler
   - Replace magic numbers with CONFIG constants

4. TESTING:
   - Test login with rate limiting
   - Test XSS with malicious input
   - Test modal keyboard navigation
   - Test auto-refresh with tab switching
   - Test error scenarios

5. DEPLOYMENT:
   - Remove console.logs (search for console.)
   - Minify JavaScript
   - Enable CSP headers (backend)
   - Configure HTTPS redirects
   - Set up error monitoring

ESTIMATED TIME: 4-6 hours for all patches
PRIORITY: HIGH - Do within 24 hours
*/

// ==========================================================================
// END OF SECURITY PATCHES
// ==========================================================================

console.info('Security patches loaded. Apply according to instructions above.');
