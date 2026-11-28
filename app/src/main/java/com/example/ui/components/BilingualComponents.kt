package com.example.ui.components

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.Build
import androidx.compose.material.icons.rounded.Carpenter
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CleaningServices
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Construction
import androidx.compose.material.icons.rounded.DirectionsCar
import androidx.compose.material.icons.rounded.Engineering
import androidx.compose.material.icons.rounded.FormatPaint
import androidx.compose.material.icons.rounded.Kitchen
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Plumbing
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.StarOutline
import androidx.compose.material.icons.rounded.Translate
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material.icons.rounded.Yard
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.BookingStatus
import com.example.data.PaymentMethod
import com.example.data.PaymentStatus
import com.example.data.RazorpayOrderPayload
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
import org.json.JSONObject

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
fun AccountRoleSelector(
    selectedRole: String,
    onSelectRole: (String) -> Unit,
    modifier: Modifier = Modifier,
    showLabel: Boolean = true,
    customerTestTag: String = "role_option_customer",
    providerTestTag: String = "role_option_provider"
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (showLabel) {
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
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            AccountRoleOptionCard(
                title = t("auth.role_customer"),
                subtitle = t("auth.role_customer_desc"),
                icon = Icons.Rounded.Person,
                selected = selectedRole != "provider",
                onClick = { onSelectRole("customer") },
                modifier = Modifier
                    .weight(1f)
                    .testTag(customerTestTag)
            )
            AccountRoleOptionCard(
                title = t("auth.role_provider"),
                subtitle = t("auth.role_provider_desc"),
                icon = Icons.Rounded.Engineering,
                selected = selectedRole == "provider",
                onClick = { onSelectRole("provider") },
                modifier = Modifier
                    .weight(1f)
                    .testTag(providerTestTag)
            )
        }
    }
}

@Composable
private fun AccountRoleOptionCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val containerColor by animateColorAsState(
        targetValue = if (selected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
        },
        label = "role_card_bg"
    )
    val borderColor by animateColorAsState(
        targetValue = if (selected) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
        },
        label = "role_card_border"
    )

    Surface(
        modifier = modifier
            .heightIn(min = 64.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable(role = Role.RadioButton, onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        color = containerColor,
        border = BorderStroke(
            width = if (selected) 2.dp else 1.dp,
            color = borderColor
        )
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(
                        if (selected) {
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)
                        } else {
                            MaterialTheme.colorScheme.surface.copy(alpha = 0.7f)
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp)
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (selected) {
                        MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f)
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            if (selected) {
                Icon(
                    imageVector = Icons.Rounded.CheckCircle,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp)
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

@Composable
fun BookingPaymentBadge(
    paymentMethod: String,
    paymentStatus: PaymentStatus,
    modifier: Modifier = Modifier
) {
    val (bg, fg) = when (paymentStatus) {
        PaymentStatus.PAID -> StatusCompletedBg to StatusCompletedFg
        PaymentStatus.UNPAID, PaymentStatus.PENDING -> StatusPendingBg to StatusPendingFg
        PaymentStatus.FAILED -> StatusRejectedBg to StatusRejectedFg
        PaymentStatus.REFUNDED -> StatusProgressBg to StatusProgressFg
    }
    val methodLabel = t(PaymentMethod.fromKey(paymentMethod).i18nKey)
    val statusLabel = t(paymentStatus.i18nKey)
    Surface(
        modifier = modifier,
        color = bg,
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            text = "$statusLabel • $methodLabel",
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
    ServiceCategory.INTERNET_TECHNICIAN -> Icons.Rounded.Wifi
    ServiceCategory.CONSTRUCTION_WORKER -> Icons.Rounded.Construction
    ServiceCategory.DRIVER -> Icons.Rounded.DirectionsCar
    ServiceCategory.GARDENING -> Icons.Rounded.Yard
    ServiceCategory.OTHER_SERVICES -> Icons.Rounded.Build
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
fun ReviewDialog(
    isSubmitting: Boolean,
    onSubmit: (rating: Int, comment: String) -> Unit,
    onDismiss: () -> Unit
) {
    var rating by rememberSaveable { mutableIntStateOf(5) }
    var comment by rememberSaveable { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(t("booking.leave_review"), style = MaterialTheme.typography.titleLarge) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(t("booking.rating_label"), style = MaterialTheme.typography.labelLarge)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    (1..5).forEach { star ->
                        IconButton(onClick = { rating = star }) {
                            Icon(
                                imageVector = if (star <= rating) Icons.Rounded.Star else Icons.Rounded.StarOutline,
                                contentDescription = "$star",
                                tint = MaterialTheme.colorScheme.secondary,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = comment,
                    onValueChange = { comment = it },
                    label = { Text(t("booking.review_comment")) },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSubmit(rating, comment) },
                enabled = !isSubmitting
            ) {
                Text(t("booking.submit_review"))
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text(t("common.cancel"))
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

private class RazorpayBridge(
    private val mainHandler: Handler,
    private val onSuccess: (String, String, String) -> Unit,
    private val onError: (String) -> Unit,
    private val onDismiss: () -> Unit
) {
    @JavascriptInterface
    fun onPaymentSuccess(orderId: String, paymentId: String, signature: String) {
        mainHandler.post { onSuccess(orderId, paymentId, signature) }
    }

    @JavascriptInterface
    fun onPaymentError(message: String) {
        mainHandler.post { onError(message) }
    }

    @JavascriptInterface
    fun onCheckoutDismissed() {
        mainHandler.post { onDismiss() }
    }
}

private fun buildRazorpayCheckoutHtml(order: RazorpayOrderPayload, themeColorHex: String): String {
    val key = JSONObject.quote(order.keyId)
    val currency = JSONObject.quote(order.currency)
    val description = JSONObject.quote(order.serviceTitle)
    val orderId = JSONObject.quote(order.orderId)
    val prefillName = JSONObject.quote(order.prefillName)
    val prefillEmail = JSONObject.quote(order.prefillEmail)
    val prefillContact = JSONObject.quote(order.prefillContact)
    val bookingId = JSONObject.quote(order.bookingId)
    val color = JSONObject.quote(themeColorHex)
    return """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fffbf4; color: #1a201e; text-align: center; padding: 20px; }
          </style>
        </head>
        <body>
          <div>Opening secure checkout...</div>
          <script>
            (function() {
              if (typeof Razorpay === 'undefined') {
                KajerPayBridge.onPaymentError('Unable to load Razorpay Checkout. Check internet connection.');
                return;
              }
              var options = {
                key: $key,
                amount: ${order.amountPaise},
                currency: $currency,
                name: "Kajer Manus",
                description: $description,
                order_id: $orderId,
                prefill: { name: $prefillName, email: $prefillEmail, contact: $prefillContact },
                notes: { booking_id: $bookingId },
                theme: { color: $color },
                modal: {
                  ondismiss: function() { KajerPayBridge.onCheckoutDismissed(); }
                },
                handler: function(response) {
                  KajerPayBridge.onPaymentSuccess(
                    response.razorpay_order_id || $orderId,
                    response.razorpay_payment_id || "",
                    response.razorpay_signature || ""
                  );
                }
              };
              var rzp = new Razorpay(options);
              rzp.on('payment.failed', function(resp) {
                var msg = (resp && resp.error && resp.error.description) ? resp.error.description : 'Payment failed';
                KajerPayBridge.onPaymentError(msg);
              });
              rzp.open();
            })();
          </script>
        </body>
        </html>
    """.trimIndent()
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun RazorpayCheckoutDialog(
    order: RazorpayOrderPayload,
    onSuccess: (orderId: String, paymentId: String, signature: String) -> Unit,
    onError: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val primaryHex = String.format("#%06X", 0xFFFFFF and MaterialTheme.colorScheme.primary.toArgb())
    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    DisposableEffect(order.orderId) {
        onDispose {
            webViewRef?.stopLoading()
            webViewRef?.destroy()
            webViewRef = null
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = t("booking.razorpay_title"),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .minimumInteractiveComponentSize()
                            .testTag("close_razorpay_dialog")
                    ) {
                        Icon(Icons.Rounded.Close, contentDescription = t("common.close"))
                    }
                }
                HorizontalDivider()
                AndroidView(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    factory = { context ->
                        WebView(context).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.allowFileAccess = false
                            settings.allowContentAccess = false
                            webChromeClient = WebChromeClient()
                            webViewClient = WebViewClient()
                            addJavascriptInterface(
                                RazorpayBridge(
                                    mainHandler = Handler(Looper.getMainLooper()),
                                    onSuccess = onSuccess,
                                    onError = onError,
                                    onDismiss = onDismiss
                                ),
                                "KajerPayBridge"
                            )
                            loadDataWithBaseURL(
                                "https://www.kajermanus.in",
                                buildRazorpayCheckoutHtml(order, primaryHex),
                                "text/html",
                                "UTF-8",
                                null
                            )
                            webViewRef = this
                        }
                    }
                )
            }
        }
    }
}
