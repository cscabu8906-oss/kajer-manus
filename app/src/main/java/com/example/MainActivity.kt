package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.auth.SessionManager
import com.example.data.AuthSession
import com.example.data.KajerManushRepository
import com.example.i18n.AppLanguage
import com.example.i18n.BilingualConfig
import com.example.i18n.I18nCatalog
import com.example.i18n.LanguagePreferencesStore
import com.example.i18n.LocalBilingualConfig
import com.example.ui.AuthenticatedApp
import com.example.ui.screens.OnboardingAuthScreen
import com.example.ui.screens.SignUpScreen
import com.example.ui.theme.KajerManushTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val i18nCatalog = I18nCatalog.loadFromAssets(applicationContext)
        val prefsStore = LanguagePreferencesStore(applicationContext)
        val sessionManager = SessionManager(applicationContext)
        val repository = KajerManushRepository(sessionManager)

        setContent {
            val currentLanguage by prefsStore.languageFlow.collectAsStateWithLifecycle(initialValue = AppLanguage.BN)
            val bengaliNumerals by prefsStore.bengaliNumeralsFlow.collectAsStateWithLifecycle(initialValue = true)
            val session by sessionManager.sessionFlow.collectAsStateWithLifecycle(initialValue = AuthSession())
            val scope = rememberCoroutineScope()

            val bilingualConfig = remember(currentLanguage, bengaliNumerals, i18nCatalog) {
                BilingualConfig(
                    language = currentLanguage,
                    bengaliNumerals = bengaliNumerals,
                    catalog = i18nCatalog
                )
            }

            var showSignUpPage by rememberSaveable { mutableStateOf(false) }

            CompositionLocalProvider(LocalBilingualConfig provides bilingualConfig) {
                KajerManushTheme(isBengali = currentLanguage == AppLanguage.BN) {
                    val user = session.user
                    if (!session.isAuthenticated || user == null) {
                        if (showSignUpPage) {
                            SignUpScreen(
                                repository = repository,
                                currentLanguage = currentLanguage,
                                bengaliNumerals = bengaliNumerals,
                                onSelectLanguage = { lang ->
                                    scope.launch { prefsStore.saveLanguage(lang) }
                                },
                                onBackToSignIn = { showSignUpPage = false },
                                onAuthSuccess = {
                                    showSignUpPage = false
                                }
                            )
                        } else {
                            OnboardingAuthScreen(
                                repository = repository,
                                currentLanguage = currentLanguage,
                                onSelectLanguage = { lang ->
                                    scope.launch { prefsStore.saveLanguage(lang) }
                                },
                                onNavigateToSignUp = { showSignUpPage = true },
                                onAuthSuccess = {
                                    showSignUpPage = false
                                }
                            )
                        }
                    } else {
                        key(user.userId) {
                            AuthenticatedApp(
                                repository = repository,
                                initialUser = user,
                                currentLanguage = currentLanguage,
                                bengaliNumerals = bengaliNumerals,
                                prefsStore = prefsStore
                            )
                        }
                    }
                }
            }
        }
    }
}
