package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.CloudSync
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.BookingStatus
import com.example.data.ServiceBooking
import com.example.data.ServiceCategory
import com.example.data.ServiceOffering
import com.example.data.UserProfile
import com.example.i18n.AppLanguage
import com.example.i18n.LocalBilingualConfig
import com.example.i18n.t
import com.example.ui.components.BilingualEmptyState
import com.example.ui.components.BookingStatusBadge
import com.example.ui.components.LanguageTogglePill

@Composable
fun AdminDashboardScreen(
    isAdmin: Boolean,
    currentLanguage: AppLanguage,
    services: List<ServiceOffering>,
    bookings: List<ServiceBooking>,
    users: List<UserProfile>,
    isMutating: Boolean,
    onSelectLanguage: (AppLanguage) -> Unit,
    onSeedDefaultServices: () -> Unit,
    onSaveService: (ServiceOffering, Boolean, () -> Unit) -> Unit,
    onUpdateBookingStatus: (ServiceBooking, BookingStatus) -> Unit
) {
    if (!isAdmin) {
        BilingualEmptyState(
            icon = Icons.Rounded.Lock,
            title = t("admin.access_denied"),
            hint = t("admin.access_denied_desc")
        )
        return
    }

    val config = LocalBilingualConfig.current
    var selectedSection by rememberSaveable { mutableIntStateOf(0) }
    var editingService by remember { mutableStateOf<ServiceOffering?>(null) }
    var creatingNew by remember { mutableStateOf(false) }

    val sectionTitles = listOf(
        t("admin.stats"),
        t("admin.services"),
        t("admin.bookings"),
        t("admin.users"),
        t("admin.templates")
    )

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyColumn(
            modifier = Modifier
                .widthIn(max = 820.dp)
                .fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.AdminPanelSettings,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = t("admin.title"),
                            style = MaterialTheme.typography.headlineSmall
                        )
                    }
                    LanguageTogglePill(
                        currentLanguage = currentLanguage,
                        onSelectLanguage = onSelectLanguage
                    )
                }
            }

            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(sectionTitles.size) { index ->
                        FilterChip(
                            selected = selectedSection == index,
                            onClick = { selectedSection = index },
                            label = { Text(sectionTitles[index]) },
                            modifier = Modifier.testTag("admin_tab_$index")
                        )
                    }
                }
            }

            when (selectedSection) {
                0 -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                AdminStatCard(
                                    label = t("admin.total_services"),
                                    value = config.formatNumber(services.size),
                                    modifier = Modifier.weight(1f)
                                )
                                AdminStatCard(
                                    label = t("admin.total_bookings"),
                                    value = config.formatNumber(bookings.size),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                AdminStatCard(
                                    label = t("admin.total_users"),
                                    value = config.formatNumber(users.size),
                                    modifier = Modifier.weight(1f)
                                )
                                AdminStatCard(
                                    label = t("admin.pending_bookings"),
                                    value = config.formatNumber(bookings.count { it.status == "pending" }),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                1 -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Surface(
                                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = t("admin.independent_note"),
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                OutlinedButton(
                                    onClick = onSeedDefaultServices,
                                    enabled = !isMutating,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Rounded.CloudSync, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(t("admin.seed_catalog"))
                                }
                                Button(
                                    onClick = {
                                        creatingNew = true
                                        editingService = ServiceOffering()
                                    },
                                    enabled = !isMutating,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(t("admin.add_service"))
                                }
                            }
                        }
                    }

                    items(services, key = { it.id }) { svc ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(svc.titleBn, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                    Text(svc.titleEn, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(
                                        "${t(ServiceCategory.fromKey(svc.categoryKey).i18nKey)} • ${config.formatCurrencyInr(svc.basePriceInr)}",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                                IconButton(onClick = {
                                    creatingNew = false
                                    editingService = svc
                                }) {
                                    Icon(Icons.Rounded.Edit, contentDescription = t("admin.edit_service"))
                                }
                            }
                        }
                    }
                }

                2 -> {
                    items(bookings, key = { it.id }) { booking ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        ) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = booking.localizedServiceTitle(currentLanguage),
                                        style = MaterialTheme.typography.titleSmall,
                                        modifier = Modifier.weight(1f)
                                    )
                                    BookingStatusBadge(status = booking.statusEnum)
                                }
                                Text(
                                    text = "${booking.customerName} (${booking.customerPhone}) • ${config.formatCurrencyInr(booking.amountInr)}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (booking.status == "pending") {
                                        Button(onClick = { onUpdateBookingStatus(booking, BookingStatus.ACCEPTED) }) {
                                            Text(t("booking.accept_btn"))
                                        }
                                        OutlinedButton(onClick = { onUpdateBookingStatus(booking, BookingStatus.REJECTED) }) {
                                            Text(t("booking.reject_btn"))
                                        }
                                    } else if (booking.status == "accepted") {
                                        Button(onClick = { onUpdateBookingStatus(booking, BookingStatus.COMPLETED) }) {
                                            Text(t("booking.complete_btn"))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                3 -> {
                    items(users, key = { it.userId }) { usr ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        ) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(usr.fullName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                Text(usr.email, style = MaterialTheme.typography.bodySmall)
                                Text(
                                    text = "${usr.accountRole} • ${t("language.label")}: ${AppLanguage.fromCode(usr.languagePreference).nativeLabel}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }

                4 -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(t("admin.template_preview_title"), style = MaterialTheme.typography.titleMedium)
                            TemplatePreviewCard(t("admin.otp_sample_title"), t("admin.otp_sample_body"))
                            TemplatePreviewCard(t("admin.reset_sample_title"), t("admin.reset_sample_body"))
                            TemplatePreviewCard(t("notifications.push_title"), t("admin.booking_push_sample"))
                            TemplatePreviewCard(t("notifications.email_title"), t("admin.security_alert_sample"))
                        }
                    }
                }
            }
        }
    }

    editingService?.let { svc ->
        BilingualServiceEditorDialog(
            initial = svc,
            isNew = creatingNew,
            isSaving = isMutating,
            onDismiss = { editingService = null },
            onSave = { updated ->
                onSaveService(updated, creatingNew) {
                    editingService = null
                }
            }
        )
    }
}

@Composable
private fun AdminStatCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(text = value, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Text(text = label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun TemplatePreviewCard(title: String, body: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f))
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Text(text = body, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun BilingualServiceEditorDialog(
    initial: ServiceOffering,
    isNew: Boolean,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSave: (ServiceOffering) -> Unit
) {
    var categoryKey by rememberSaveable { mutableStateOf(initial.categoryKey) }
    var titleBn by rememberSaveable { mutableStateOf(initial.titleBn) }
    var titleEn by rememberSaveable { mutableStateOf(initial.titleEn) }
    var descBn by rememberSaveable { mutableStateOf(initial.descriptionBn) }
    var descEn by rememberSaveable { mutableStateOf(initial.descriptionEn) }
    var priceStr by rememberSaveable { mutableStateOf(if (initial.basePriceInr > 0) initial.basePriceInr.toString() else "299") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isNew) t("admin.add_service") else t("admin.edit_service")) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(ServiceCategory.entries) { cat ->
                        FilterChip(
                            selected = categoryKey == cat.key,
                            onClick = { categoryKey = cat.key },
                            label = { Text(t(cat.i18nKey)) }
                        )
                    }
                }
                OutlinedTextField(
                    value = titleBn,
                    onValueChange = { titleBn = it },
                    label = { Text(t("admin.title_bn")) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = titleEn,
                    onValueChange = { titleEn = it },
                    label = { Text(t("admin.title_en")) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = descBn,
                    onValueChange = { descBn = it },
                    label = { Text(t("admin.desc_bn")) },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = descEn,
                    onValueChange = { descEn = it },
                    label = { Text(t("admin.desc_en")) },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = priceStr,
                    onValueChange = { priceStr = it.filter(Char::isDigit).take(6) },
                    label = { Text(t("admin.price_inr")) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val price = priceStr.toLongOrNull() ?: 299L
                    if (titleBn.isNotBlank() && titleEn.isNotBlank() && descBn.isNotBlank() && descEn.isNotBlank()) {
                        onSave(
                            initial.copy(
                                categoryKey = categoryKey,
                                titleBn = titleBn,
                                titleEn = titleEn,
                                descriptionBn = descBn,
                                descriptionEn = descEn,
                                basePriceInr = price
                            )
                        )
                    }
                },
                enabled = !isSaving
            ) {
                Text(t("admin.save_service"))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(t("common.cancel"))
            }
        }
    )
}
