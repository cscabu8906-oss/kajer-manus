package com.example.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.data.AdminStats
import com.example.data.AdminTwoFactorSetup
import com.example.data.AdminTwoFactorStatus
import com.example.data.BookingStatus
import com.example.data.PaymentStatus
import com.example.data.ProviderProfile
import com.example.data.ServiceBooking
import com.example.data.ServiceCategory
import com.example.data.ServiceOffering
import com.example.data.UserProfile
import com.example.i18n.AppLanguage
import com.example.i18n.LocalBilingualConfig
import com.example.i18n.t
import com.example.ui.components.BilingualEmptyState
import com.example.ui.components.BookingPaymentBadge
import com.example.ui.components.BookingStatusBadge
import com.example.ui.components.LanguageTogglePill

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdminDashboardScreen(
    currentUserId: String,
    isAdmin: Boolean,
    currentLanguage: AppLanguage,
    stats: AdminStats,
    providers: List<ProviderProfile>,
    services: List<ServiceOffering>,
    bookings: List<ServiceBooking>,
    users: List<UserProfile>,
    admin2faStatus: AdminTwoFactorStatus,
    admin2faSetup: AdminTwoFactorSetup?,
    admin2faBackupCodes: List<String>,
    isMutating: Boolean,
    onSelectLanguage: (AppLanguage) -> Unit,
    onRefresh: () -> Unit,
    onApproveProvider: (providerId: String, decision: String) -> Unit,
    onSaveService: (ServiceOffering, Boolean, () -> Unit) -> Unit,
    onUpdateBookingStatus: (ServiceBooking, BookingStatus) -> Unit,
    onUpdateBookingPayment: (ServiceBooking, PaymentStatus) -> Unit,
    onUpdateUser: (
        userId: String,
        fullName: String,
        email: String,
        mobileNumber: String,
        fullAddress: String,
        role: String,
        isVerified: Boolean,
        newPassword: String?,
        onDone: () -> Unit
    ) -> Unit,
    onDeleteUser: (userId: String, onDone: () -> Unit) -> Unit,
    onStart2faSetup: () -> Unit,
    onConfirm2faSetup: (code: String) -> Unit,
    onDisable2fa: (password: String, code: String, onDone: () -> Unit) -> Unit,
    onClear2faBackupCodes: () -> Unit
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
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current

    var selectedSection by rememberSaveable { mutableIntStateOf(0) }
    var editingService by remember { mutableStateOf<ServiceOffering?>(null) }
    var creatingNew by remember { mutableStateOf(false) }
    var editingUser by remember { mutableStateOf<UserProfile?>(null) }
    var deletingUser by remember { mutableStateOf<UserProfile?>(null) }

    var confirm2faCode by rememberSaveable { mutableStateOf("") }
    var disablePassword by rememberSaveable { mutableStateOf("") }
    var disableCode by rememberSaveable { mutableStateOf("") }

    val sectionTitles = listOf(
        t("admin.stats"),
        t("admin.providers"),
        t("admin.services"),
        t("admin.bookings"),
        t("admin.users"),
        t("admin.templates"),
        t("admin.security_tab")
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onRefresh) {
                            Icon(Icons.Rounded.Refresh, contentDescription = t("home.refresh"))
                        }
                        LanguageTogglePill(
                            currentLanguage = currentLanguage,
                            onSelectLanguage = onSelectLanguage
                        )
                    }
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
                                    label = t("admin.total_users"),
                                    value = config.formatNumber(stats.totalUsers),
                                    modifier = Modifier.weight(1f)
                                )
                                AdminStatCard(
                                    label = t("admin.pending_providers"),
                                    value = config.formatNumber(stats.pendingProviders),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                AdminStatCard(
                                    label = t("admin.total_bookings"),
                                    value = config.formatNumber(stats.totalBookings),
                                    modifier = Modifier.weight(1f)
                                )
                                AdminStatCard(
                                    label = t("admin.pending_bookings"),
                                    value = config.formatNumber(stats.pendingBookings),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                AdminStatCard(
                                    label = t("admin.paid_bookings"),
                                    value = config.formatNumber(stats.paidBookings),
                                    modifier = Modifier.weight(1f)
                                )
                                AdminStatCard(
                                    label = t("admin.paid_revenue"),
                                    value = config.formatCurrencyInr(stats.paidRevenueInr),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                1 -> {
                    items(providers, key = { it.id }) { prov ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        ) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(prov.fullName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                Text("${prov.email} • ${prov.mobileNumber}", style = MaterialTheme.typography.bodySmall)
                                Text(
                                    "${prov.serviceLocationEn} • ${prov.approvalStatus.uppercase()}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                if (!prov.isApproved) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            enabled = !isMutating,
                                            onClick = { onApproveProvider(prov.id, "approved") }
                                        ) {
                                            Text(t("admin.approve_btn"))
                                        }
                                        OutlinedButton(
                                            enabled = !isMutating,
                                            onClick = { onApproveProvider(prov.id, "rejected") }
                                        ) {
                                            Text(t("admin.reject_btn"))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                2 -> {
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
                            Button(
                                onClick = {
                                    creatingNew = true
                                    editingService = ServiceOffering()
                                },
                                enabled = !isMutating,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(t("admin.add_service"))
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
                                IconButton(
                                    onClick = {
                                        creatingNew = false
                                        editingService = svc
                                    },
                                    modifier = Modifier.minimumInteractiveComponentSize()
                                ) {
                                    Icon(Icons.Rounded.Edit, contentDescription = t("admin.edit_service"))
                                }
                            }
                        }
                    }
                }

                3 -> {
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
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    BookingPaymentBadge(
                                        paymentMethod = booking.paymentMethod,
                                        paymentStatus = booking.paymentStatusEnum
                                    )
                                    if (booking.razorpayPaymentId.isNotBlank()) {
                                        Text(
                                            text = booking.razorpayPaymentId,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    if (booking.status == "pending") {
                                        Button(
                                            enabled = !isMutating,
                                            onClick = { onUpdateBookingStatus(booking, BookingStatus.ACCEPTED) }
                                        ) {
                                            Text(t("booking.accept_btn"))
                                        }
                                        OutlinedButton(
                                            enabled = !isMutating,
                                            onClick = { onUpdateBookingStatus(booking, BookingStatus.REJECTED) }
                                        ) {
                                            Text(t("booking.reject_btn"))
                                        }
                                    } else if (booking.status == "accepted") {
                                        Button(
                                            enabled = !isMutating,
                                            onClick = { onUpdateBookingStatus(booking, BookingStatus.COMPLETED) }
                                        ) {
                                            Text(t("booking.complete_btn"))
                                        }
                                    }
                                    listOf(PaymentStatus.PAID, PaymentStatus.UNPAID, PaymentStatus.REFUNDED).forEach { targetStatus ->
                                        FilterChip(
                                            selected = booking.paymentStatusEnum == targetStatus,
                                            enabled = !isMutating,
                                            onClick = { onUpdateBookingPayment(booking, targetStatus) },
                                            label = { Text(t(targetStatus.i18nKey)) },
                                            modifier = Modifier.testTag("admin_booking_payment_${booking.id}_${targetStatus.key}")
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                4 -> {
                    items(users, key = { it.userId }) { usr ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Column(
                                    modifier = Modifier.weight(1f),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(usr.fullName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                        if (usr.twoFactorEnabled) {
                                            Surface(
                                                color = MaterialTheme.colorScheme.primaryContainer,
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Text(
                                                    text = "2FA",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }
                                    Text("${usr.email} • ${usr.mobileNumber}", style = MaterialTheme.typography.bodySmall)
                                    Text(
                                        text = "${usr.accountRole} • ${t("language.label")}: ${AppLanguage.fromCode(usr.languagePreference).nativeLabel}",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                                IconButton(
                                    onClick = { editingUser = usr },
                                    enabled = !isMutating,
                                    modifier = Modifier
                                        .minimumInteractiveComponentSize()
                                        .testTag("edit_user_${usr.userId}")
                                ) {
                                    Icon(Icons.Rounded.Edit, contentDescription = t("admin.edit_user"))
                                }
                                IconButton(
                                    onClick = { deletingUser = usr },
                                    enabled = !isMutating && usr.userId != currentUserId,
                                    modifier = Modifier
                                        .minimumInteractiveComponentSize()
                                        .testTag("delete_user_${usr.userId}")
                                ) {
                                    Icon(
                                        Icons.Rounded.Delete,
                                        contentDescription = t("admin.delete_user"),
                                        tint = if (usr.userId != currentUserId) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                                    )
                                }
                            }
                        }
                    }
                }

                5 -> {
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

                6 -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.Security,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.primary
                                        )
                                        Text(
                                            text = t("admin.twofa_title"),
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Surface(
                                        color = if (admin2faStatus.enabled) {
                                            MaterialTheme.colorScheme.primaryContainer
                                        } else {
                                            MaterialTheme.colorScheme.secondaryContainer
                                        },
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Text(
                                            text = if (admin2faStatus.enabled) {
                                                "${t("admin.twofa_enabled")} • ${t("admin.twofa_backup_remaining")}: ${config.formatNumber(admin2faStatus.backupCodesRemaining)}"
                                            } else {
                                                t("admin.twofa_disabled")
                                            },
                                            style = MaterialTheme.typography.labelLarge,
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                        )
                                    }
                                }
                            }

                            if (admin2faBackupCodes.isNotEmpty()) {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(16.dp),
                                        verticalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Text(
                                            text = t("admin.twofa_backup_title"),
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                        FlowRow(
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            admin2faBackupCodes.forEach { code ->
                                                Surface(
                                                    shape = RoundedCornerShape(8.dp),
                                                    color = MaterialTheme.colorScheme.surface
                                                ) {
                                                    Text(
                                                        text = code,
                                                        fontFamily = FontFamily.Monospace,
                                                        style = MaterialTheme.typography.labelLarge,
                                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                                    )
                                                }
                                            }
                                        }
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Button(
                                                onClick = {
                                                    clipboard.setText(AnnotatedString(admin2faBackupCodes.joinToString("\n")))
                                                }
                                            ) {
                                                Icon(Icons.Rounded.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text(t("admin.twofa_copy_backup"))
                                            }
                                            OutlinedButton(onClick = onClear2faBackupCodes) {
                                                Text(t("common.close"))
                                            }
                                        }
                                    }
                                }
                            }

                            if (!admin2faStatus.enabled) {
                                if (admin2faSetup == null) {
                                    Button(
                                        onClick = onStart2faSetup,
                                        enabled = !isMutating,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .testTag("start_2fa_setup_button")
                                    ) {
                                        Icon(Icons.Rounded.Key, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(t("admin.twofa_setup_btn"))
                                    }
                                } else {
                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(16.dp),
                                            verticalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Text(t("admin.twofa_secret_label"), style = MaterialTheme.typography.labelLarge)
                                            Surface(
                                                color = MaterialTheme.colorScheme.surfaceVariant,
                                                shape = RoundedCornerShape(10.dp),
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                Text(
                                                    text = admin2faSetup.secretBase32,
                                                    fontFamily = FontFamily.Monospace,
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    modifier = Modifier.padding(12.dp)
                                                )
                                            }
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                OutlinedButton(
                                                    onClick = { clipboard.setText(AnnotatedString(admin2faSetup.secretBase32)) },
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Icon(Icons.Rounded.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                                                    Spacer(modifier = Modifier.width(6.dp))
                                                    Text(t("admin.twofa_copy_key"))
                                                }
                                                OutlinedButton(
                                                    onClick = {
                                                        try {
                                                            context.startActivity(
                                                                Intent(Intent.ACTION_VIEW, Uri.parse(admin2faSetup.otpauthUrl))
                                                            )
                                                        } catch (_: Exception) {
                                                        }
                                                    },
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Icon(Icons.Rounded.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
                                                    Spacer(modifier = Modifier.width(6.dp))
                                                    Text(t("admin.twofa_open_auth"))
                                                }
                                            }
                                            OutlinedTextField(
                                                value = confirm2faCode,
                                                onValueChange = { confirm2faCode = it.filter(Char::isDigit).take(6) },
                                                label = { Text(t("auth.two_factor_code")) },
                                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                                singleLine = true,
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .testTag("confirm_2fa_code_input")
                                            )
                                            Button(
                                                enabled = !isMutating && confirm2faCode.length == 6,
                                                onClick = {
                                                    onConfirm2faSetup(confirm2faCode)
                                                    confirm2faCode = ""
                                                },
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .testTag("confirm_2fa_button")
                                            ) {
                                                Text(t("admin.twofa_confirm_btn"))
                                            }
                                        }
                                    }
                                }
                            } else {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.4f))
                                ) {
                                    Column(
                                        modifier = Modifier.padding(16.dp),
                                        verticalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Text(
                                            text = t("admin.twofa_disable_title"),
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.error
                                        )
                                        OutlinedTextField(
                                            value = disablePassword,
                                            onValueChange = { disablePassword = it },
                                            label = { Text(t("admin.twofa_current_password")) },
                                            visualTransformation = PasswordVisualTransformation(),
                                            singleLine = true,
                                            modifier = Modifier.fillMaxWidth()
                                        )
                                        OutlinedTextField(
                                            value = disableCode,
                                            onValueChange = { disableCode = it.take(12) },
                                            label = { Text(t("auth.two_factor_code")) },
                                            singleLine = true,
                                            modifier = Modifier.fillMaxWidth()
                                        )
                                        Button(
                                            enabled = !isMutating && disablePassword.isNotBlank() && disableCode.trim().length >= 6,
                                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                                            onClick = {
                                                onDisable2fa(disablePassword, disableCode) {
                                                    disablePassword = ""
                                                    disableCode = ""
                                                }
                                            },
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Text(t("admin.twofa_disable_btn"))
                                        }
                                    }
                                }
                            }
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

    editingUser?.let { usr ->
        AdminUserEditorDialog(
            initial = usr,
            isSelf = usr.userId == currentUserId,
            isSaving = isMutating,
            onDismiss = { editingUser = null },
            onSave = { fullName, email, mobile, addr, role, verified, newPass ->
                onUpdateUser(usr.userId, fullName, email, mobile, addr, role, verified, newPass) {
                    editingUser = null
                }
            }
        )
    }

    deletingUser?.let { usr ->
        AlertDialog(
            onDismissRequest = { deletingUser = null },
            title = { Text(t("admin.delete_user")) },
            text = { Text("${usr.fullName} (${usr.email})\n\n${t("admin.delete_user_confirm")}") },
            confirmButton = {
                Button(
                    enabled = !isMutating,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    onClick = {
                        onDeleteUser(usr.userId) {
                            deletingUser = null
                        }
                    }
                ) {
                    Text(t("admin.delete_user"))
                }
            },
            dismissButton = {
                TextButton(onClick = { deletingUser = null }) {
                    Text(t("common.cancel"))
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

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AdminUserEditorDialog(
    initial: UserProfile,
    isSelf: Boolean,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSave: (
        fullName: String,
        email: String,
        mobile: String,
        address: String,
        role: String,
        isVerified: Boolean,
        newPassword: String?
    ) -> Unit
) {
    var fullName by rememberSaveable { mutableStateOf(initial.fullName) }
    var email by rememberSaveable { mutableStateOf(initial.email) }
    var mobile by rememberSaveable { mutableStateOf(initial.mobileNumber) }
    var address by rememberSaveable { mutableStateOf(initial.fullAddress) }
    var role by rememberSaveable { mutableStateOf(initial.accountRole.ifBlank { "customer" }) }
    var isVerified by rememberSaveable { mutableStateOf(initial.isVerified) }
    var newPassword by rememberSaveable { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t("admin.edit_user")) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    label = { Text(t("auth.full_name")) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(t("auth.email")) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = mobile,
                    onValueChange = { mobile = it.take(20) },
                    label = { Text(t("auth.mobile")) },
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
                Text(t("admin.role_label"), style = MaterialTheme.typography.labelLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("customer", "provider", "admin").forEach { r ->
                        FilterChip(
                            selected = role == r,
                            enabled = !isSelf || r == "admin",
                            onClick = { role = r },
                            label = { Text(r) }
                        )
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(t("admin.verified_label"), style = MaterialTheme.typography.bodyMedium)
                    Switch(checked = isVerified, onCheckedChange = { isVerified = it })
                }
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it },
                    label = { Text(t("admin.new_password_optional")) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                enabled = !isSaving && fullName.trim().length >= 2 && email.contains("@") && mobile.count { it.isDigit() } >= 10 && address.trim().length >= 4 && (newPassword.isBlank() || newPassword.length >= 8),
                onClick = {
                    onSave(
                        fullName.trim(),
                        email.trim(),
                        mobile.trim(),
                        address.trim(),
                        role,
                        isVerified,
                        newPassword.ifBlank { null }
                    )
                }
            ) {
                Text(t("common.save"))
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
