plugins { id("com.android.application") }

android {
    namespace = "com.archiekuo.drunkwalk"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.archiekuo.drunkwalk"   // 給人裝過就不要再改
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            // 不在雲端簽章：產出未簽章 APK，再用自己保管的正式金鑰簽
        }
    }
    sourceSets["main"].assets.srcDirs("../../web")
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
