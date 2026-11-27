package com.example.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ContactSupport
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Dns
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Policy
import androidx.compose.material.icons.rounded.PrivacyTip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.BuildConfig
import com.example.data.UserProfile
import com.example.i18n.AppLanguage
import com.example.i18n.t
import com.example.ui.components.ContactSupportDialog
import com.example.ui.components.LanguageSelectorCard
import com.example.ui.components.LegalInfoDialog

@Composable
fun ProfileSettingsScreen(
    profile: UserProfile?,
    currentLanguage: AppLanguage,
    bengaliNumerals: Boolean,
    isMutating: Boolean,
    onSelectLanguage: (AppLanguage) -> Unit,
    onToggleBengaliNumerals: (Boolean) -> Unit,
    onUpdateNotificationPrefs: (push: Boolean, email: Boolean) -> Unit,
    onSaveProfile: (name: String, mobile: String, address: String) -> Unit,
    onSubmitSupportTicket: (subject: String, message: String, onDone: () -> Unit) -> Unit,
    onSignOut: () -> Unit
) {
    var fullName by rememberSaveable(profile?.userId, profile?.fullName) { mutableStateOf(profile?.fullName.orEmpty()) }
    var mobile by rememberSaveable(profile?.userId, profile?.mobileNumber) { mutableStateOf(profile?.mobileNumber.orEmpty()) }
    var address by rememberSaveable(profile?.userId, profile?.fullAddress) { mutableStateOf(profile?.fullAddress.orEmpty()) }

    var showPrivacy by rememberSaveable { mutableStateOf(false) }
    var showTerms by rememberSaveable { mutableStateOf(false) }
    var showCancellation by rememberSaveable { mutableStateOf(false) }
    var showContact by rememberSaveable { mutableStateOf(false) }

    val notifPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 720.dp)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = t("settings.title"),
                style = MaterialTheme.typography.headlineSmall
            )

            LanguageSelectorCard(
                currentLanguage = currentLanguage,
                onSelectLanguage = onSelectLanguage,
                showSyncedNote = true
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(t("language.bengali_numerals"), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text(t("language.bengali_numerals_desc"), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Switch(
                        checked = bengaliNumerals,
                        onCheckedChange = onToggleBengaliNumerals,
                        modifier = Modifier.testTag("bengali_numerals_switch")
                    )
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(t("settings.account_section"), style = MaterialTheme.typography.titleMedium)
                        Surface(
                            color = MaterialTheme.colorScheme.primaryContainer,
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(Icons.Rounded.Badge, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                                Text(
                                    text = if (profile?.accountRole == "provider") t("auth.role_provider")
                                    else if (profile?.accountRole == "admin") t("nav.admin")
                                    else t("auth.role_customer"),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = { Text(t("auth.full_name")) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = profile?.email.orEmpty(),
                        onValueChange = {},
                        readOnly = true,
                        enabled = false,
                        label = { Text(t("auth.email")) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = mobile,
                        onValueChange = { mobile = it.filter { ch -> ch.isDigit() || ch == '+' }.take(14) },
                        label = { Text(t("auth.mobile")) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = address,
                        onValueChange = { address = it },
                        label = { Text(t("auth.address")) },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = { onSaveProfile(fullName, mobile, address) },
                        enabled = !isMutating && fullName.isNotBlank() && mobile.length >= 10 && address.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(t("settings.edit_profile"))
                    }
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(t("settings.notifications_section"), style = MaterialTheme.typography.titleMedium)
                    val pushEnabled = profile?.pushNotificationsEnabled ?: true
                    val emailEnabled = profile?.emailNotificationsEnabled ?: true

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(t("notifications.push_title"), style = MaterialTheme.typography.titleSmall)
                            Text(t("notifications.push_desc"), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(
                            checked = pushEnabled,
                            onCheckedChange = { onUpdateNotificationPrefs(it, emailEnabled) }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(t("notifications.email_title"), style = MaterialTheme.typography.titleSmall)
                            Text(t("notifications.email_desc"), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(
                            checked = emailEnabled,
                            onCheckedChange = { onUpdateNotificationPrefs(pushEnabled, it) }
                        )
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        OutlinedButton(
                            onClick = { notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Rounded.NotificationsActive, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(t("settings.push_permission_grant"))
                        }
                    }
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(t("settings.legal_section"), style = MaterialTheme.typography.titleMedium)

                    OutlinedButton(
                        onClick = { showContact = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.ContactSupport, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(t("nav.contact"))
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { showPrivacy = true },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Rounded.PrivacyTip, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(t("nav.privacy"))
                        }
                        OutlinedButton(
                            onClick = { showTerms = true },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Rounded.Description, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(t("nav.terms"))
                        }
                    }

                    OutlinedButton(
                        onClick = { showCancellation = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Rounded.Policy, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(t("nav.cancellation"))
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(top = 4.dp)
                    ) {
                        Icon(Icons.Rounded.Dns, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = "${t("settings.api_server_label")}: ${BuildConfig.API_BASE_URL}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Button(
                onClick = onSignOut,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("sign_out_button"),
                shape = RoundedCornerShape(14.dp)
            ) {
                Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(t("auth.sign_out"), style = MaterialTheme.typography.labelLarge)
            }

            Spacer(modifier = Modifier.height(16.dp))
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
    if (showCancellation) {
        LegalInfoDialog(
            title = t("settings.cancellation_title"),
            body = t("settings.cancellation_body"),
            onDismiss = { showCancellation = false }
        )
    }
    if (showContact) {
        ContactSupportDialog(
            isSubmitting = isMutating,
            onSubmit = { subject, message ->
                onSubmitSupportTicket(subject, message) {
                    showContact = false
                }
            },
            onDismiss = { showContact = false }
        )
    }
}
