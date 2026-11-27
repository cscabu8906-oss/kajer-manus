package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material.icons.rounded.Phone
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import com.example.auth.onGoogleSignInClicked
import com.example.data.PendingSignUpDraft
import com.example.i18n.AppLanguage
import com.example.i18n.t
import com.example.ui.components.LanguageTogglePill
import com.example.ui.components.LegalInfoDialog

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignUpScreen(
    currentLanguage: AppLanguage,
    onSelectLanguage: (AppLanguage) -> Unit,
    onBackToSignIn: () -> Unit,
    onSubmitDraftBeforeGoogleAuth: (PendingSignUpDraft) -> Unit,
    onAuthSuccess: () -> Unit
) {
    BackHandler { onBackToSignIn() }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember(context) { CredentialManager.create(context) }

    var fullName by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var mobile by rememberSaveable { mutableStateOf("") }
    var address by rememberSaveable { mutableStateOf("") }
    var accountRole by rememberSaveable { mutableStateOf("customer") }
    var agreedToTerms by rememberSaveable { mutableStateOf(false) }

    var isLoading by rememberSaveable { mutableStateOf(false) }
    var validationErrorKey by rememberSaveable { mutableStateOf<String?>(null) }
    var authError by rememberSaveable { mutableStateOf<String?>(null) }

    var showPrivacy by rememberSaveable { mutableStateOf(false) }
    var showTerms by rememberSaveable { mutableStateOf(false) }

    val cancelledMsg = t("auth.err_cancelled")

    Scaffold(
        contentWindowInsets = WindowInsets.safeDrawing,
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(
                        onClick = onBackToSignIn,
                        modifier = Modifier.testTag("signup_back_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = t("auth.sign_in_tab")
                        )
                    }
                },
                title = {
                    Text(
                        text = t("auth.sign_up_tab"),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                },
                actions = {
                    LanguageTogglePill(
                        currentLanguage = currentLanguage,
                        onSelectLanguage = onSelectLanguage,
                        modifier = Modifier.padding(end = 10.dp)
                    )
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f),
                            MaterialTheme.colorScheme.background
                        )
                    )
                )
                .padding(innerPadding),
            contentAlignment = Alignment.TopCenter
        ) {
            Column(
                modifier = Modifier
                    .widthIn(max = 600.dp)
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = t("auth.sign_up_title"),
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onBackground,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = t("auth.sign_up_subtitle"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.large,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = fullName,
                            onValueChange = { fullName = it; validationErrorKey = null; authError = null },
                            label = { Text(t("auth.full_name")) },
                            leadingIcon = { Icon(Icons.Rounded.Person, contentDescription = null) },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("signup_full_name_input")
                        )

                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it; validationErrorKey = null; authError = null },
                            label = { Text(t("auth.email")) },
                            leadingIcon = { Icon(Icons.Rounded.Email, contentDescription = null) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("signup_email_input")
                        )

                        OutlinedTextField(
                            value = mobile,
                            onValueChange = {
                                mobile = it.filter { ch -> ch.isDigit() || ch == '+' }.take(14)
                                validationErrorKey = null
                                authError = null
                            },
                            label = { Text(t("auth.mobile")) },
                            leadingIcon = { Icon(Icons.Rounded.Phone, contentDescription = null) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("signup_mobile_input")
                        )

                        OutlinedTextField(
                            value = address,
                            onValueChange = { address = it; validationErrorKey = null; authError = null },
                            label = { Text(t("auth.address")) },
                            leadingIcon = { Icon(Icons.Rounded.Home, contentDescription = null) },
                            minLines = 2,
                            maxLines = 4,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("signup_address_input")
                        )

                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Badge,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = t("auth.role_label"),
                                    style = MaterialTheme.typography.titleSmall
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                FilterChip(
                                    selected = accountRole == "customer",
                                    onClick = { accountRole = "customer" },
                                    label = { Text(t("auth.role_customer")) },
                                    modifier = Modifier
                                        .weight(1f)
                                        .testTag("signup_role_customer")
                                )
                                FilterChip(
                                    selected = accountRole == "provider",
                                    onClick = { accountRole = "provider" },
                                    label = { Text(t("auth.role_provider")) },
                                    modifier = Modifier
                                        .weight(1f)
                                        .testTag("signup_role_provider")
                                )
                            }
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    agreedToTerms = !agreedToTerms
                                    validationErrorKey = null
                                },
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = agreedToTerms,
                                onCheckedChange = {
                                    agreedToTerms = it
                                    validationErrorKey = null
                                },
                                modifier = Modifier.testTag("signup_terms_checkbox")
                            )
                            Text(
                                text = t("auth.agree_terms_prefix"),
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            TextButton(onClick = { showTerms = true }) {
                                Text(t("nav.terms"), style = MaterialTheme.typography.labelMedium)
                            }
                            TextButton(onClick = { showPrivacy = true }) {
                                Text(t("nav.privacy"), style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                }

                validationErrorKey?.let { key ->
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = t(key),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                authError?.let { err ->
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = err,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                Button(
                    onClick = {
                        val trimmedEmail = email.trim()
                        val validEmail = trimmedEmail.contains("@") && trimmedEmail.contains(".")
                        when {
                            fullName.trim().isEmpty() -> validationErrorKey = "auth.err_name_required"
                            !validEmail -> validationErrorKey = "auth.err_email_invalid"
                            mobile.filter { it.isDigit() }.length < 10 -> validationErrorKey = "auth.err_mobile_invalid"
                            address.trim().length < 4 -> validationErrorKey = "auth.err_address_required"
                            !agreedToTerms -> validationErrorKey = "auth.err_terms_required"
                            else -> {
                                validationErrorKey = null
                                authError = null
                                isLoading = true
                                onSubmitDraftBeforeGoogleAuth(
                                    PendingSignUpDraft(
                                        fullName = fullName.trim(),
                                        email = trimmedEmail,
                                        mobileNumber = mobile.trim(),
                                        fullAddress = address.trim(),
                                        accountRole = accountRole
                                    )
                                )
                                onGoogleSignInClicked(
                                    context = context,
                                    credentialManager = credentialManager,
                                    onAuthSuccess = {
                                        isLoading = false
                                        onAuthSuccess()
                                    },
                                    onAuthError = { msg ->
                                        isLoading = false
                                        authError = msg
                                    },
                                    scope = scope,
                                    onAuthCancelled = {
                                        isLoading = false
                                        authError = cancelledMsg
                                    }
                                )
                            }
                        }
                    },
                    enabled = !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                        .testTag("signup_submit_button"),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(t("auth.signing_in"), style = MaterialTheme.typography.labelLarge)
                    } else {
                        Icon(
                            imageVector = Icons.Rounded.PersonAdd,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(t("auth.sign_up_google"), style = MaterialTheme.typography.labelLarge)
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.VerifiedUser,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = t("auth.google_auth_security_note"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    TextButton(
                        onClick = onBackToSignIn,
                        modifier = Modifier.testTag("already_have_account_button")
                    ) {
                        Text(
                            text = t("auth.already_have_account"),
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }

    if (showPrivacy) {
        LegalInfoDialog(
            title = t("settings.privacy_title"),
            body = t("settings.privacy_body"),
            onDismiss = { showPrivacy = false }
        )
    }
    if (showTerms) {
        LegalInfoDialog(
            title = t("settings.terms_title"),
            body = t("settings.terms_body"),
            onDismiss = { showTerms = false }
        )
    }
}
