plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("kotlin-kapt")
    id("com.google.devtools.ksp") version "1.9.22-1.0.17"
    id("com.google.android.libraries.mapsplatform.secrets-gradle-plugin")
    id("com.google.dagger.hilt.android")
    kotlin("plugin.serialization") version "1.9.22"
}

// ============================================================================
// SECURITY: Load API keys from local.properties (not committed to git)
// ============================================================================
val localProperties = java.util.Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(localPropertiesFile.inputStream())
}

val openWeatherApiKey = localProperties.getProperty("OPENWEATHER_API_KEY")
    ?: System.getenv("OPENWEATHER_API_KEY")
    ?: "MISSING_OPENWEATHER_API_KEY"

val mapsApiKey = localProperties.getProperty("MAPS_API_KEY")
    ?: System.getenv("MAPS_API_KEY")
    ?: "MISSING_MAPS_API_KEY"

android {
    namespace = "com.agrobridge"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.agrobridge"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        // API Keys y Build Config (loaded from local.properties)
        buildConfigField("String", "OPENWEATHER_API_KEY", "\"$openWeatherApiKey\"")
        buildConfigField("String", "MAPS_API_KEY", "\"$mapsApiKey\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isDebuggable = true
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-DEBUG"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=kotlin.RequiresOptIn",
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=com.google.android.gms.maps.MapsExperimentalFeature"
        )
    }

    // FIXED: MEDIUM-3 - Configure Room schema export for migration support
    // Schemas will be exported to app/schemas/ directory
    ksp {
        arg("room.schemaLocation", "$projectDir/schemas")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // ============================================================================
    // ANDROID CORE
    // ============================================================================
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")

    // ============================================================================
    // DEPENDENCY INJECTION (Hilt)
    // ============================================================================
    implementation("com.google.dagger:hilt-android:2.48")
    kapt("com.google.dagger:hilt-compiler:2.48")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")
    implementation("androidx.hilt:hilt-work:1.2.0")
    kapt("androidx.hilt:hilt-compiler:1.2.0")

    // ============================================================================
    // JETPACK COMPOSE
    // ============================================================================
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3:1.2.0")
    implementation("androidx.compose.material:material-icons-extended")

    // ============================================================================
    // NAVIGATION & SERIALIZATION (MAD 2025 - Type-Safe Navigation)
    // ============================================================================
    implementation("androidx.navigation:navigation-compose:2.7.6")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
    implementation("org.jetbrains.kotlinx:kotlinx-collections-immutable:0.3.7")

    // ============================================================================
    // VIEWMODEL & LIFECYCLE
    // ============================================================================
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")

    // ============================================================================
    // COROUTINES
    // ============================================================================
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.0")

    // ============================================================================
    // GOOGLE MAPS & LOCATION
    // ============================================================================
    implementation("com.google.maps.android:maps-compose:4.3.3")
    implementation("com.google.android.gms:play-services-maps:18.2.0")
    implementation("com.google.android.gms:play-services-location:21.1.0")
    implementation("com.google.maps.android:android-maps-utils:3.8.2")

    // ============================================================================
    // NETWORKING (Retrofit + OkHttp)
    // ============================================================================
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // ============================================================================
    // LOCAL PERSISTENCE (Room Database)
    // ============================================================================
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // ============================================================================
    // JSON PARSING
    // ============================================================================
    implementation("com.google.code.gson:gson:2.10.1")

    // ============================================================================
    // CAMERAX (para AI Crop Scanner)
    // ============================================================================
    val cameraxVersion = "1.3.1"
    implementation("androidx.camera:camera-core:$cameraxVersion")
    implementation("androidx.camera:camera-camera2:$cameraxVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraxVersion")
    implementation("androidx.camera:camera-view:$cameraxVersion")
    implementation("androidx.camera:camera-extensions:$cameraxVersion")

    // ============================================================================
    // TENSORFLOW LITE (para ML)
    // ============================================================================
    implementation("org.tensorflow:tensorflow-lite:2.14.0")
    implementation("org.tensorflow:tensorflow-lite-support:0.4.4")
    implementation("org.tensorflow:tensorflow-lite-metadata:0.4.4")
    implementation("org.tensorflow:tensorflow-lite-gpu:2.14.0")

    // ============================================================================
    // ML KIT (Google ML)
    // ============================================================================
    implementation("com.google.mlkit:image-labeling:17.0.8")
    implementation("com.google.mlkit:image-labeling-custom:17.0.2")

    // ============================================================================
    // COIL (Image Loading)
    // ============================================================================
    implementation("io.coil-kt:coil-compose:2.5.0")

    // ============================================================================
    // ACCOMPANIST (Compose utilities)
    // ============================================================================
    implementation("com.google.accompanist:accompanist-permissions:0.34.0")
    implementation("com.google.accompanist:accompanist-systemuicontroller:0.34.0")

    // ============================================================================
    // SECURITY (Encrypted SharedPreferences)
    // ============================================================================
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // ============================================================================
    // DATASTORE (Preferences)
    // ============================================================================
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // ============================================================================
    // WORK MANAGER (Background tasks)
    // ============================================================================
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // ============================================================================
    // TIMBER (Logging)
    // ============================================================================
    implementation("com.jakewharton.timber:timber:5.0.1")

    // ============================================================================
    // TESTING (Unit Tests)
    // ============================================================================
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.8")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("app.cash.turbine:turbine:1.0.0")
    testImplementation("androidx.arch.core:core-testing:2.2.0")

    // ============================================================================
    // TESTING (Android Integration Tests)
    // ============================================================================
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.02.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")

    // ============================================================================
    // DEBUG TOOLS
    // ============================================================================
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
