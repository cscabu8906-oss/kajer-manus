package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.material.icons.automirrored.rounded.EventNote
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Engineering
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.MarkEmailRead
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
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
import com.example.data.ProviderProfile
import com.example.data.ServiceBooking
import com.example.data.ServiceCategory
import com.example.data.UserNotification
import com.example.i18n.LocalBilingualConfig
import com.example.i18n.t
import com.example.ui.UiState
import com.example.ui.components.BilingualEmptyState
import com.example.ui.components.BookingStatusBadge
import com.example.ui.components.ReviewDialog

@Composable
fun BookingsScreen(
    customerBookingsState: UiState<List<ServiceBooking>>,
    providerBookingsState: UiState<List<ServiceBooking>>,
    isProviderAccount: Boolean,
    providerApproved: Boolean,
    providerProfile: ProviderProfile?,
    isMutating: Boolean,
    onRefresh: () -> Unit,
    onUpdateBookingStatus: (ServiceBooking, BookingStatus) -> Unit,
    onSubmitReview: (bookingId: String, rating: Int, comment: String, onDone: () -> Unit) -> Unit,
    onApplyProviderProfile: (
        bioBn: String,
        bioEn: String,
        categories: List<String>,
        locationBn: String,
        locationEn: String,
        experienceYears: Int,
        onDone: () -> Unit
    ) -> Unit,
    onToggleProviderAvailability: (Boolean) -> Unit
) {
    var providerMode by rememberSaveable(isProviderAccount) { mutableStateOf(isProviderAccount) }
    var selectedStatusKey by rememberSaveable { mutableStateOf<String?>(null) }
    var cancelTarget by remember { mutableStateOf<ServiceBooking?>(null) }
    var reviewTarget by remember { mutableStateOf<ServiceBooking?>(null) }
    var showWorkerSetup by rememberSaveable { mutableStateOf(false) }

    val activeState = if (providerMode) providerBookingsState else customerBookingsState

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 760.dp)
                .fillMaxSize()
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (isProviderAccount) {
                    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                        SegmentedButton(
                            selected = !providerMode,
                            onClick = { providerMode = false },
                            shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
                            modifier = Modifier.testTag("customer_mode_tab")
                        ) {
                            Text(t("booking.switch_to_customer"))
                        }
                        SegmentedButton(
                            selected = providerMode,
                            onClick = { providerMode = true },
                            shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
                            modifier = Modifier.testTag("provider_mode_tab")
                        ) {
                            Text(t("booking.switch_to_provider"))
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (providerMode) t("booking.provider_dashboard") else t("booking.my_bookings"),
                        style = MaterialTheme.typography.headlineSmall
                    )
                    IconButton(onClick = onRefresh) {
                        Icon(Icons.Rounded.Refresh, contentDescription = t("home.refresh"))
                    }
                }

                if (providerMode) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = if (providerApproved) {
                                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
                            } else {
                                MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.7f)
                            }
                        )
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
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
                                        imageVector = if (providerApproved) Icons.Rounded.Verified else Icons.Rounded.HourglassTop,
                                        contentDescription = null,
                                        tint = if (providerApproved) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary
                                    )
                                    Text(
                                        text = if (providerApproved) t("booking.provider_approved_badge") else t("booking.provider_pending_banner"),
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                                if (providerApproved && providerProfile != null) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(t("booking.provider_available"), style = MaterialTheme.typography.labelSmall)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Switch(
                                            checked = providerProfile.isAvailable,
                                            onCheckedChange = onToggleProviderAvailability
                                        )
                                    }
                                }
                            }

                            OutlinedButton(
                                onClick = { showWorkerSetup = true },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(t("booking.provider_setup_btn"))
                            }
                        }
                    }
                }

                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterChip(
                            selected = selectedStatusKey == null,
                            onClick = { selectedStatusKey = null },
                            label = { Text(t("booking.all")) }
                        )
                    }
                    items(BookingStatus.entries) { status ->
                        FilterChip(
                            selected = selectedStatusKey == status.key,
                            onClick = {
                                selectedStatusKey = if (selectedStatusKey == status.key) null else status.key
                            },
                            label = { Text(t(status.i18nKey)) }
                        )
                    }
                }
            }

            when (activeState) {
                is UiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is UiState.Error -> {
                    BilingualEmptyState(
                        title = t("common.error_generic"),
                        hint = activeState.message
                    )
                }
                is UiState.Success -> {
                    val filtered = remember(activeState.data, selectedStatusKey) {
                        if (selectedStatusKey == null) activeState.data
                        else activeState.data.filter { it.status == selectedStatusKey }
                    }
                    if (filtered.isEmpty()) {
                        BilingualEmptyState(
                            icon = if (providerMode) Icons.Rounded.Engineering else Icons.AutoMirrored.Rounded.EventNote,
                            title = if (providerMode) t("booking.provider_empty_title") else t("booking.empty_title"),
                            hint = if (providerMode) t("booking.provider_empty_hint") else t("booking.empty_hint")
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(filtered, key = { it.id }) { booking ->
                                BookingCard(
                                    booking = booking,
                                    providerMode = providerMode,
                                    isMutating = isMutating,
                                    onRequestCancel = { cancelTarget = booking },
                                    onRequestReview = { reviewTarget = booking },
                                    onUpdateStatus = { status -> onUpdateBookingStatus(booking, status) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    cancelTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { cancelTarget = null },
            title = { Text(t("booking.cancel_confirm_title")) },
            text = { Text(t("booking.cancel_confirm_msg")) },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdateBookingStatus(target, BookingStatus.CANCELLED)
                        cancelTarget = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text(t("common.yes"))
                }
            },
            dismissButton = {
                TextButton(onClick = { cancelTarget = null }) {
                    Text(t("common.no"))
                }
            }
        )
    }

    reviewTarget?.let { target ->
        ReviewDialog(
            isSubmitting = isMutating,
            onSubmit = { rating, comment ->
                onSubmitReview(target.id, rating, comment) {
                    reviewTarget = null
                }
            },
            onDismiss = { reviewTarget = null }
        )
    }

    if (showWorkerSetup) {
        WorkerSetupDialog(
            initial = providerProfile,
            isSaving = isMutating,
            onSave = { bioBn, bioEn, cats, locBn, locEn, exp ->
                onApplyProviderProfile(bioBn, bioEn, cats, locBn, locEn, exp) {
                    showWorkerSetup = false
                }
            },
            onDismiss = { showWorkerSetup = false }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WorkerSetupDialog(
    initial: ProviderProfile?,
    isSaving: Boolean,
    onSave: (bioBn: String, bioEn: String, cats: List<String>, locBn: String, locEn: String, exp: Int) -> Unit,
    onDismiss: () -> Unit
) {
    var location by rememberSaveable { mutableStateOf(initial?.serviceLocationEn ?: initial?.serviceLocationBn ?: "Kolkata") }
    var bio by rememberSaveable { mutableStateOf(initial?.bioEn ?: initial?.bioBn ?: "") }
    var expStr by rememberSaveable { mutableStateOf((initial?.experienceYears ?: 2).toString()) }
    val selectedCats = remember {
        mutableStateListOf<String>().apply {
            val initCats = initial?.serviceCategories.orEmpty()
            if (initCats.isNotEmpty()) addAll(initCats) else add(ServiceCategory.ELECTRICIAN.key)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t("booking.provider_setup_btn")) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it },
                    label = { Text(t("booking.provider_location")) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = expStr,
                    onValueChange = { expStr = it.filter(Char::isDigit).take(2) },
                    label = { Text(t("booking.provider_exp")) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = bio,
                    onValueChange = { bio = it },
                    label = { Text(t("booking.provider_bio")) },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    ServiceCategory.entries.forEach { cat ->
                        val chosen = selectedCats.contains(cat.key)
                        FilterChip(
                            selected = chosen,
                            onClick = {
                                if (chosen && selectedCats.size > 1) selectedCats.remove(cat.key)
                                else if (!chosen) selectedCats.add(cat.key)
                            },
                            label = { Text(t(cat.i18nKey)) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !isSaving && location.trim().length >= 2 && selectedCats.isNotEmpty(),
                onClick = {
                    onSave(
                        bio,
                        bio,
                        selectedCats.toList(),
                        location,
                        location,
                        expStr.toIntOrNull() ?: 1
                    )
                }
            ) {
                Text(t("booking.provider_save_profile"))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(t("common.cancel"))
            }
        }
    )
}

@Composable
private fun BookingCard(
    booking: ServiceBooking,
    providerMode: Boolean,
    isMutating: Boolean,
    onRequestCancel: () -> Unit,
    onRequestReview: () -> Unit,
    onUpdateStatus: (BookingStatus) -> Unit
) {
    val config = LocalBilingualConfig.current
    val lang = config.language
    val status = booking.statusEnum

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("booking_card_${booking.id}"),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = booking.localizedServiceTitle(lang),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                BookingStatusBadge(status = status)
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Rounded.Person, contentDescription = null, modifier = Modifier.size(16.dp))
                Text(
                    text = if (providerMode) booking.customerName else booking.localizedProviderName(lang),
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Rounded.CalendarToday, contentDescription = null, modifier = Modifier.size(16.dp))
                Text(
                    text = "${t("booking.scheduled_for")}: ${config.formatDigits(booking.scheduledDate)} • ${booking.scheduledSlot}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Rounded.LocationOn, contentDescription = null, modifier = Modifier.size(16.dp))
                Text(
                    text = "${t("booking.address_label")}: ${booking.serviceAddress}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (booking.notes.isNotBlank()) {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = booking.notes,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(10.dp)
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${t("booking.amount_label")}: ${config.formatCurrencyInr(booking.amountInr)}",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = config.formatTimestamp(booking.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (!providerMode && (status == BookingStatus.PENDING || status == BookingStatus.ACCEPTED)) {
                OutlinedButton(
                    onClick = onRequestCancel,
                    enabled = !isMutating,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(t("booking.cancel_btn"), color = MaterialTheme.colorScheme.error)
                }
            }

            if (!providerMode && status == BookingStatus.COMPLETED) {
                if (booking.hasReview) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Rounded.Star, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(16.dp))
                        Text(t("booking.reviewed_badge"), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    }
                } else {
                    Button(
                        onClick = onRequestReview,
                        enabled = !isMutating,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Rounded.Star, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(t("booking.leave_review"))
                    }
                }
            }

            if (providerMode) {
                when (status) {
                    BookingStatus.PENDING -> {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = { onUpdateStatus(BookingStatus.REJECTED) },
                                enabled = !isMutating,
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(t("booking.reject_btn"), color = MaterialTheme.colorScheme.error)
                            }
                            Button(
                                onClick = { onUpdateStatus(BookingStatus.ACCEPTED) },
                                enabled = !isMutating,
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(t("booking.accept_btn"))
                            }
                        }
                    }
                    BookingStatus.ACCEPTED -> {
                        Button(
                            onClick = { onUpdateStatus(BookingStatus.IN_PROGRESS) },
                            enabled = !isMutating,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(t("booking.start_work_btn"))
                        }
                    }
                    BookingStatus.IN_PROGRESS -> {
                        Button(
                            onClick = { onUpdateStatus(BookingStatus.COMPLETED) },
                            enabled = !isMutating,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(t("booking.complete_btn"))
                        }
                    }
                    else -> Unit
                }
            }
        }
    }
}

@Composable
fun NotificationsScreen(
    notificationsState: UiState<List<UserNotification>>,
    onRefresh: () -> Unit,
    onMarkRead: (String) -> Unit
) {
    val config = LocalBilingualConfig.current
    val lang = config.language

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyColumn(
            modifier = Modifier
                .widthIn(max = 760.dp)
                .fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = t("notifications.title"),
                        style = MaterialTheme.typography.headlineSmall
                    )
                    IconButton(onClick = onRefresh) {
                        Icon(Icons.Rounded.Refresh, contentDescription = t("home.refresh"))
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Surface(
                        modifier = Modifier.weight(1f),
                        shape = MaterialTheme.shapes.medium,
                        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Rounded.NotificationsActive, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Text(t("notifications.push_title"), style = MaterialTheme.typography.labelLarge)
                            Text(t("notifications.push_desc"), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Surface(
                        modifier = Modifier.weight(1f),
                        shape = MaterialTheme.shapes.medium,
                        color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.6f)
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Icon(Icons.Rounded.Email, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                            Text(t("notifications.email_title"), style = MaterialTheme.typography.labelLarge)
                            Text(t("notifications.email_desc"), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }

            when (notificationsState) {
                is UiState.Loading -> {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    }
                }
                is UiState.Error -> {
                    item {
                        BilingualEmptyState(title = t("common.error_generic"), hint = notificationsState.message)
                    }
                }
                is UiState.Success -> {
                    if (notificationsState.data.isEmpty()) {
                        item {
                            BilingualEmptyState(
                                icon = Icons.Rounded.NotificationsNone,
                                title = t("notifications.empty_title"),
                                hint = t("notifications.empty_hint")
                            )
                        }
                    } else {
                        items(notificationsState.data, key = { it.id }) { notif ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { if (!notif.readFlag) onMarkRead(notif.id) },
                                colors = CardDefaults.cardColors(
                                    containerColor = if (notif.readFlag) {
                                        MaterialTheme.colorScheme.surface
                                    } else {
                                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
                                    }
                                ),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
                            ) {
                                Column(
                                    modifier = Modifier.padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = notif.localizedTitle(lang),
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = if (notif.readFlag) FontWeight.Medium else FontWeight.Bold,
                                            modifier = Modifier.weight(1f)
                                        )
                                        if (notif.readFlag) {
                                            Icon(
                                                imageVector = Icons.Rounded.MarkEmailRead,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    }
                                    Text(
                                        text = notif.localizedBody(lang),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = config.formatTimestamp(notif.createdAt),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
