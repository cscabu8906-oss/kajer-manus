package com.example.ui.screens

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
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.PrivacyTip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
    onSaveProfile: (name: String, mobile: String, address: String, role: String) -> Unit,
    onSubmitSupportTicket: (subject: String, message: String, onDone: () -> Unit) -> Unit,
    onSignOut: () -> Unit
) {
    var fullName by rememberSaveable(profile?.userId, profile?.fullName) { mutableStateOf(profile?.fullName.orEmpty()) }
    var mobile by rememberSaveable(profile?.userId, profile?.mobileNumber) { mutableStateOf(profile?.mobileNumber.orEmpty()) }
    var address by rememberSaveable(profile?.userId, profile?.fullAddress) { mutableStateOf(profile?.fullAddress.orEmpty()) }
    var role by rememberSaveable(profile?.userId, profile?.accountRole) { mutableStateOf(profile?.accountRole ?: "customer") }

    var showPrivacy by rememberSaveable { mutableStateOf(false) }
    var showTerms by rememberSaveable { mutableStateOf(false) }
    var showContact by rememberSaveable { mutableStateOf(false) }

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

            // Language Switcher Card (Profile & App Settings)
            LanguageSelectorCard(
                currentLanguage = currentLanguage,
                onSelectLanguage = onSelectLanguage,
                showSyncedNote = true
            )

            // Bengali Numerals Toggle Card
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

            // Profile Account Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(t("settings.account_section"), style = MaterialTheme.typography.titleMedium)

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

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = role == "customer",
                            onClick = { role = "customer" },
                            label = { Text(t("auth.role_customer")) },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = role == "provider",
                            onClick = { role = "provider" },
                            label = { Text(t("auth.role_provider")) },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Button(
                        onClick = { onSaveProfile(fullName, mobile, address, role) },
                        enabled = !isMutating && fullName.isNotBlank() && mobile.length >= 5 && address.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(t("settings.edit_profile"))
                    }
                }
            }

            // Notification Preferences
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
                }
            }

            // Legal & Contact Support
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
                }
            }

            // Sign Out
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
