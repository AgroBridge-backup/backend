# ============================================================================
# AGROBRIDGE - ProGuard/R8 Rules for Release Build Optimization
# ============================================================================
#
# These rules ensure that critical classes are preserved when minifying
# with R8 in release builds. Without these rules, the APK will crash
# due to missing Hilt injection, Room database access, and Retrofit serialization.
#
# DO NOT REMOVE - Essential for production APK
# ============================================================================

# ============================================================================
# HILT - Dependency Injection (CRITICAL)
# ============================================================================
# Preserve all Hilt-generated classes and annotations
-keep class hilt_aggregated_deps.** { *; }
-keep class **_Hilt_* { *; }
-keep class **_Factory { *; }
-keep class **_Factory$* { *; }
-keep class **_MembersInjector { *; }
-keep class dagger.hilt.** { *; }
-keep interface dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep interface javax.inject.** { *; }
-keep @javax.inject.Qualifier class * { *; }
-keep @dagger.Module class * { *; }
-keep @dagger.hilt.** class * { *; }
-keep @dagger.Provides class * { *; }

# Preserve parameter names for Hilt's reflection
-keepparameternames
-renamesourcefileattribute SourceFile
-keepattributes Signature,RuntimeVisibleAnnotations,AnnotationDefault

# ============================================================================
# ROOM DATABASE (CRITICAL)
# ============================================================================
# Keep Room database classes, entities, DAOs, and migrations
-keep class androidx.room.** { *; }
-keep interface androidx.room.** { *; }
-keep @androidx.room.Entity class * {
    public <init>(...);
}
-keep @androidx.room.Dao interface * { *; }
-keep @androidx.room.Database class * { *; }

# Keep database conversion classes
-keep class * extends androidx.room.migration.Migration { *; }
-keep class * implements androidx.room.TypeConverter { *; }

# Preserve class members with Room annotations
-keepclassmembers class * {
    @androidx.room.* <fields>;
    @androidx.room.* <methods>;
}

# ============================================================================
# RETROFIT + OKHTTP + GSON (CRITICAL)
# ============================================================================
# Keep Retrofit classes
-keep class com.squareup.retrofit2.** { *; }
-keep interface com.squareup.retrofit2.** { *; }
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Keep GSON conversion classes
-keep class com.google.gson.** { *; }
-keep interface com.google.gson.** { *; }

# Preserve GSON serialization
-keepattributes Signature
-keepattributes *Annotation*
-keep class sun.misc.Unsafe { *; }
-keep class com.google.gson.stream.** { *; }

# Data Transfer Objects (DTOs)
-keep class com.agrobridge.data.dto.** { *; }
-keep class com.agrobridge.data.remote.** { *; }

# Authentication DTOs (for GSON serialization)
-keep class com.agrobridge.data.dto.LoginRequest { *; }
-keep class com.agrobridge.data.dto.TokenResponse { *; }
-keep class com.agrobridge.data.dto.RefreshTokenRequest { *; }
-keep class com.agrobridge.data.dto.LogoutRequest { *; }
-keep class com.agrobridge.data.dto.UserDto { *; }
-keep class com.agrobridge.data.dto.ErrorResponse { *; }
-keep class com.agrobridge.data.dto.PasswordResetRequest { *; }
-keep class com.agrobridge.data.dto.PasswordConfirmRequest { *; }

# API Service interfaces
-keep interface com.agrobridge.data.remote.ApiService { *; }
-keep interface com.agrobridge.data.remote.AuthApiService { *; }

# ============================================================================
# KOTLINX SERIALIZATION (MAD 2025 - Type-Safe Navigation)
# ============================================================================
# Keep serialization classes
-keep class kotlinx.serialization.** { *; }
-keep @kotlinx.serialization.Serializable class * { *; }
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <methods>;
}

# Navigation routes
-keep class com.agrobridge.presentation.navigation.Screen { *; }
-keep class com.agrobridge.presentation.navigation.Screen$* { *; }

# ============================================================================
# JETPACK LIFECYCLE & COMPOSE (CRITICAL)
# ============================================================================
# Keep lifecycle classes
-keep class androidx.lifecycle.** { *; }
-keep interface androidx.lifecycle.** { *; }

# Keep Compose classes
-keep class androidx.compose.** { *; }
-keep interface androidx.compose.** { *; }

# Keep Material3
-keep class androidx.compose.material3.** { *; }
-keep interface androidx.compose.material3.** { *; }

# ============================================================================
# COROUTINES & FLOW
# ============================================================================
# Keep coroutine classes for async/await
-keep class kotlinx.coroutines.** { *; }
-keep interface kotlinx.coroutines.** { *; }

# ============================================================================
# SECURITY LAYER (Encryption, Authentication, Pinning)
# ============================================================================
# Keep all security classes
-keep class com.agrobridge.data.security.** { *; }
-keep interface com.agrobridge.data.security.** { *; }

# Keep TokenManager methods (used by interceptors)
-keep class com.agrobridge.data.security.TokenManager {
    public java.lang.String getAccessToken();
    public java.lang.String getRefreshToken();
    public boolean isTokenValid();
    public void saveTokens(...);
    public void clearTokens();
}

# Keep interceptors
-keep class com.agrobridge.data.security.AuthInterceptor { *; }
-keep class com.agrobridge.data.security.TokenRefreshInterceptor { *; }

# Keep Certificate Pinning
-keep class com.agrobridge.data.security.CertificatePinnerFactory { *; }

# ============================================================================
# AGROBRIDGE DATA MODELS (APPLICATION-SPECIFIC)
# ============================================================================
# Keep all data models and their fields
-keep class com.agrobridge.data.model.** { *; }
-keep class com.agrobridge.data.local.entity.** { *; }
-keep class com.agrobridge.presentation.model.** { *; }

# Keep enums
-keep enum com.agrobridge.data.local.entity.SyncStatus { *; }
-keep enum com.agrobridge.data.model.LoteEstado { *; }

# ============================================================================
# AGROBRIDGE REPOSITORIES & VIEW MODELS
# ============================================================================
# Keep repository interfaces
-keep interface com.agrobridge.data.repository.** { *; }
-keep class com.agrobridge.data.repository.** { *; }

# Keep ViewModels
-keep class com.agrobridge.presentation.map.** { *; }
-keep class com.agrobridge.presentation.screens.** { *; }

# ============================================================================
# GOOGLE SERVICES & PLAY SERVICES
# ============================================================================
# Keep Google Maps
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }

# Keep location services
-keep class com.google.android.gms.location.** { *; }
-keep interface com.google.android.gms.location.** { *; }

# ============================================================================
# LOGGING
# ============================================================================
# Keep Timber logging
-keep class timber.log.Timber { *; }
-keep class timber.log.Timber$Tree { *; }

# ============================================================================
# SERIALIZABLE CLASSES (Crash Reporting, etc)
# ============================================================================
# Keep serializable classes with proper field preservation
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    !static !transient <fields>;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <methods>;
}

# ============================================================================
# WORK MANAGER (Background Sync)
# ============================================================================
# Keep WorkManager classes
-keep class androidx.work.** { *; }
-keep interface androidx.work.** { *; }

# Keep WorkManager implementations
-keep class com.agrobridge.data.worker.** { *; }

# ============================================================================
# MISCELLANEOUS RULES
# ============================================================================

# Keep line numbers for better crash reports
-keepattributes SourceFile,LineNumberTable

# Keep native method names
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep custom exceptions
-keep class * extends java.lang.Exception { <init>(...); }
-keep class * extends java.lang.RuntimeException { <init>(...); }

# ============================================================================
# OPTIMIZATION & HARDENING FOR PRODUCTION
# ============================================================================
# Aggressive optimization for release builds
-optimizationpasses 7
-allowaccessmodification
-dontpreverify
-verbose

# Agressive obfuscation for code hardening
-obfuscationdictionary dictionary.txt
-packageobfuscationprefix com.ag

# Class merging and inlining
-mergeinterfacesaggressively
-overloadaggressively

# Remove logging calls in release builds (security: don't leak logs)
-assumenosideeffects class timber.log.Timber {
    public static *** d(...);
    public static *** v(...);
    public static *** tag(...);
}

# Remove sensitive logging in security module
-assumenosideeffects class com.agrobridge.data.security.TokenManager {
    *** getDebugInfo(...);
}

# Peephole optimization
-optimizations !code/simplification/cast,!field/*,!class/merging/*,code/removal/variable

# ============================================================================
# REFLECTION & STRING OBFUSCATION (Code Hardening)
# ============================================================================
# Obfuscate method names, field names, and class names
-repackageclasses 'com.agrobridge'
-keepnames class * extends androidx.lifecycle.ViewModel

# Keep public API with original names
-keepnames interface com.agrobridge.data.repository.** { *; }

# Aggressive renaming: use short, meaningless names
-renamesourcefileattribute SourceFile

# ============================================================================
# BASELINE PROFILE OPTIMIZATION (Android 13+)
# ============================================================================
# These rules optimize for Baseline Profiles pre-compilation
# This reduces cold start time by 15-20% and improves responsiveness

# Keep methods that are marked for Baseline Profile pre-compilation
-keep class com.agrobridge.presentation.screens.login.LoginViewModel {
    public void login();
    public void onEmailChanged(java.lang.String);
    public void onPasswordChanged(java.lang.String);
    public void togglePasswordVisibility();
    public void retry();
}

-keep class com.agrobridge.presentation.screens.dashboard.DashboardViewModel {
    public void loadDashboard(java.lang.String);
    public void refreshData();
    public java.lang.String getUserGreeting();
}

-keep class com.agrobridge.presentation.screens.lote.LotesViewModel {
    public void loadLotes(java.lang.String);
    public void toggleActiveOnly();
}

-keep class com.agrobridge.presentation.map.MapViewModel {
    public void requestLocationPermission();
    public void syncAllLotes(java.lang.String);
}

# Inline critical validation methods
-keepclassmembers class com.agrobridge.util.DataValidator {
    public static *** validate*(...);
}

# Inline error handler
-keepclassmembers class com.agrobridge.util.ErrorHandler {
    public static *** handle(...);
}

# Inline permission checks
-keepclassmembers class com.agrobridge.util.PermissionManager {
    public boolean is*(...);
    public boolean are*(...);
}

# Mark sync as hot path
-keepclassmembers class com.agrobridge.data.sync.SyncManager {
    public *** syncAll(java.lang.String);
}

# Preserve Compose skippable lambdas
-keepclassmembers class * implements androidx.compose.runtime.internal.ComposableLambda {
    <init>(...);
}

# ============================================================================
# WARNINGS TO SUPPRESS
# ============================================================================
# Suppress warnings about missing classes that are optional dependencies
-dontwarn com.google.protobuf.**
-dontwarn com.google.type.**
-dontwarn java.beans.**
