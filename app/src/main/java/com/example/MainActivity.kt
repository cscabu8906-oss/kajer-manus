package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.PendingSignUpDraft
import com.example.i18n.AppLanguage
import com.example.i18n.BilingualConfig
import com.example.i18n.I18nCatalog
import com.example.i18n.LanguagePreferencesStore
import com.example.i18n.LocalBilingualConfig
import com.example.ui.AuthenticatedApp
import com.example.ui.screens.OnboardingAuthScreen
import com.example.ui.screens.SignUpScreen
import com.example.ui.theme.KajerManushTheme
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val i18nCatalog = I18nCatalog.loadFromAssets(applicationContext)
        val prefsStore = LanguagePreferencesStore(applicationContext)

        setContent {
            val currentLanguage by prefsStore.languageFlow.collectAsStateWithLifecycle(initialValue = AppLanguage.BN)
            val bengaliNumerals by prefsStore.bengaliNumeralsFlow.collectAsStateWithLifecycle(initialValue = true)
            val scope = rememberCoroutineScope()

            val bilingualConfig = remember(currentLanguage, bengaliNumerals, i18nCatalog) {
                BilingualConfig(
                    language = currentLanguage,
                    bengaliNumerals = bengaliNumerals,
                    catalog = i18nCatalog
                )
            }

            var showSignUpPage by rememberSaveable { mutableStateOf(false) }
            var pendingSignUpDraft by remember { mutableStateOf<PendingSignUpDraft?>(null) }

            var currentUser by remember { mutableStateOf(Firebase.auth.currentUser) }
            DisposableEffect(Unit) {
                val listener = FirebaseAuth.AuthStateListener { auth ->
                    currentUser = auth.currentUser
                }
                Firebase.auth.addAuthStateListener(listener)
                onDispose { Firebase.auth.removeAuthStateListener(listener) }
            }

            CompositionLocalProvider(LocalBilingualConfig provides bilingualConfig) {
                KajerManushTheme(isBengali = currentLanguage == AppLanguage.BN) {
                    val user = currentUser
                    if (user == null) {
                        if (showSignUpPage) {
                            SignUpScreen(
                                currentLanguage = currentLanguage,
                                onSelectLanguage = { lang ->
                                    scope.launch { prefsStore.saveLanguage(lang) }
                                },
                                onBackToSignIn = { showSignUpPage = false },
                                onSubmitDraftBeforeGoogleAuth = { draft ->
                                    pendingSignUpDraft = draft
                                },
                                onAuthSuccess = {
                                    showSignUpPage = false
                                    currentUser = Firebase.auth.currentUser
                                }
                            )
                        } else {
                            OnboardingAuthScreen(
                                currentLanguage = currentLanguage,
                                onSelectLanguage = { lang ->
                                    scope.launch { prefsStore.saveLanguage(lang) }
                                },
                                onNavigateToSignUp = { showSignUpPage = true },
                                onAuthSuccess = {
                                    currentUser = Firebase.auth.currentUser
                                }
                            )
                        }
                    } else {
                        val uid = user.uid
                        key(uid) {
                            AuthenticatedApp(
                                currentUserId = uid,
                                initialDisplayName = user.displayName ?: "",
                                initialEmail = user.email ?: "",
                                currentLanguage = currentLanguage,
                                bengaliNumerals = bengaliNumerals,
                                prefsStore = prefsStore,
                                pendingSignUpDraft = pendingSignUpDraft,
                                onSignUpDraftConsumed = { pendingSignUpDraft = null }
                            )
                        }
                    }
                }
            }
        }
    }
}
