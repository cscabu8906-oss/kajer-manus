package com.example.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AcUnit
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.Build
import androidx.compose.material.icons.rounded.Carpenter
import androidx.compose.material.icons.rounded.CleaningServices
import androidx.compose.material.icons.rounded.FormatPaint
import androidx.compose.material.icons.rounded.Kitchen
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.Plumbing
import androidx.compose.material.icons.rounded.Translate
import androidx.compose.material.icons.rounded.Yard
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.data.BookingStatus
import com.example.data.ServiceCategory
import com.example.i18n.AppLanguage
import com.example.i18n.t
import com.example.ui.theme.StatusAcceptedBg
import com.example.ui.theme.StatusAcceptedFg
import com.example.ui.theme.StatusCompletedBg
import com.example.ui.theme.StatusCompletedFg
import com.example.ui.theme.StatusPendingBg
import com.example.ui.theme.StatusPendingFg
import com.example.ui.theme.StatusProgressBg
import com.example.ui.theme.StatusProgressFg
import com.example.ui.theme.StatusRejectedBg
import com.example.ui.theme.StatusRejectedFg

@Composable
fun LanguageTogglePill(
    currentLanguage: AppLanguage,
    onSelectLanguage: (AppLanguage) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .heightIn(min = 48.dp)
            .testTag("language_toggle_pill"),
        shape = RoundedCornerShape(24.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier.padding(4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            AppLanguage.entries.forEach { lang ->
                val selected = lang == currentLanguage
                val bg by animateColorAsState(
                    if (selected) MaterialTheme.colorScheme.primary else Color.Transparent,
                    label = "lang_pill_bg"
                )
                val fg by animateColorAsState(
                    if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                    label = "lang_pill_fg"
                )
                Box(
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .clip(RoundedCornerShape(20.dp))
                        .background(bg)
                        .clickable(role = Role.Button) { onSelectLanguage(lang) }
                        .testTag("language_option_${lang.code}")
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (lang == AppLanguage.BN) "বাংলা" else "EN",
                        style = MaterialTheme.typography.labelLarge,
                        color = fg,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
fun LanguageSelectorCard(
    currentLanguage: AppLanguage,
    onSelectLanguage: (AppLanguage) -> Unit,
    showSyncedNote: Boolean = false,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
        shape = MaterialTheme.shapes.large
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Translate,
                        contentDescription = t("language.label"),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = t("language.choose_title"),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = t("language.choose_subtitle"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                AppLanguage.entries.forEach { lang ->
                    val isSelected = lang == currentLanguage
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 52.dp)
                            .clip(MaterialTheme.shapes.medium)
                            .clickable(role = Role.RadioButton) { onSelectLanguage(lang) }
                            .testTag("selector_card_${lang.code}"),
                        shape = MaterialTheme.shapes.medium,
                        color = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        border = BorderStroke(
                            width = if (isSelected) 2.dp else 1.dp,
                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Language,
                                contentDescription = null,
                                tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = lang.nativeLabel,
                                style = MaterialTheme.typography.labelLarge,
                                color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    }
                }
            }

            if (showSyncedNote) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = t("language.synced_note"),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
fun BookingStatusBadge(status: BookingStatus, modifier: Modifier = Modifier) {
    val (bg, fg) = when (status) {
        BookingStatus.PENDING -> StatusPendingBg to StatusPendingFg
        BookingStatus.ACCEPTED -> StatusAcceptedBg to StatusAcceptedFg
        BookingStatus.IN_PROGRESS -> StatusProgressBg to StatusProgressFg
        BookingStatus.COMPLETED -> StatusCompletedBg to StatusCompletedFg
        BookingStatus.REJECTED, BookingStatus.CANCELLED -> StatusRejectedBg to StatusRejectedFg
    }
    Surface(
        modifier = modifier,
        color = bg,
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            text = t(status.i18nKey),
            style = MaterialTheme.typography.labelMedium,
            color = fg,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
        )
    }
}

fun categoryIcon(categoryKey: String): ImageVector = when (ServiceCategory.fromKey(categoryKey)) {
    ServiceCategory.ELECTRICIAN -> Icons.Rounded.Bolt
    ServiceCategory.PLUMBER -> Icons.Rounded.Plumbing
    ServiceCategory.AC_REPAIR -> Icons.Rounded.AcUnit
    ServiceCategory.HOME_CLEANING -> Icons.Rounded.CleaningServices
    ServiceCategory.CARPENTER -> Icons.Rounded.Carpenter
    ServiceCategory.PAINTER -> Icons.Rounded.FormatPaint
    ServiceCategory.APPLIANCE_REPAIR -> Icons.Rounded.Kitchen
    ServiceCategory.GARDENING -> Icons.Rounded.Yard
}

@Composable
fun BilingualEmptyState(
    icon: ImageVector = Icons.Rounded.Build,
    title: String,
    hint: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(36.dp)
            )
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = hint,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun LegalInfoDialog(
    title: String,
    body: String,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title, style = MaterialTheme.typography.titleLarge) },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text(text = body, style = MaterialTheme.typography.bodyMedium)
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(text = t("common.close"))
            }
        }
    )
}

@Composable
fun ContactSupportDialog(
    isSubmitting: Boolean,
    onSubmit: (subject: String, message: String) -> Unit,
    onDismiss: () -> Unit
) {
    var subject by rememberSaveable { mutableStateOf("") }
    var message by rememberSaveable { mutableStateOf("") }
    var showError by rememberSaveable { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = t("settings.contact_title"), style = MaterialTheme.typography.titleLarge) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it; showError = false },
                    label = { Text(t("settings.contact_subject")) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("contact_subject_input")
                )
                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it; showError = false },
                    label = { Text(t("settings.contact_message")) },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("contact_message_input")
                )
                if (showError) {
                    Text(
                        text = t("common.required_field"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (subject.trim().length < 2 || message.trim().length < 5) {
                        showError = true
                    } else {
                        onSubmit(subject, message)
                    }
                },
                enabled = !isSubmitting,
                modifier = Modifier.testTag("contact_submit_button")
            ) {
                Text(t("settings.contact_send"))
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text(t("common.cancel"))
            }
        }
    )
}
