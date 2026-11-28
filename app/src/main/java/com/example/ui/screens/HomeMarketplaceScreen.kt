package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.R
import com.example.data.ServiceCategory
import com.example.data.ServiceOffering
import com.example.data.UserProfile
import com.example.i18n.AppLanguage
import com.example.i18n.LocalBilingualConfig
import com.example.i18n.t
import com.example.ui.UiState
import com.example.ui.components.BilingualEmptyState
import com.example.ui.components.categoryIcon
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun HomeMarketplaceScreen(
    userProfile: UserProfile?,
    servicesState: UiState<List<ServiceOffering>>,
    searchQuery: String,
    selectedCategoryKey: String?,
    isMutating: Boolean,
    onSearchChange: (String) -> Unit,
    onSelectCategory: (String?) -> Unit,
    onRefresh: () -> Unit,
    onCreateBooking: (
        service: ServiceOffering,
        customerName: String,
        customerPhone: String,
        serviceAddress: String,
        scheduledDate: String,
        scheduledSlot: String,
        notes: String,
        onBooked: () -> Unit
    ) -> Unit
) {
    val config = LocalBilingualConfig.current
    val lang = config.language
    var selectedService by remember { mutableStateOf<ServiceOffering?>(null) }

    val categoryLookup = ServiceCategory.entries.associate { cat ->
        cat.key to t(cat.i18nKey)
    }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        when (servicesState) {
            is UiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(text = t("common.loading"), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }

            is UiState.Error -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    BilingualEmptyState(
                        title = t("common.error_generic"),
                        hint = servicesState.message
                    )
                    OutlinedButton(onClick = onRefresh) {
                        Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(t("common.retry"))
                    }
                }
            }

            is UiState.Success -> {
                val filteredServices = remember(servicesState.data, searchQuery, selectedCategoryKey) {
                    val q = searchQuery.trim().lowercase()
                    servicesState.data.filter { svc ->
                        val catMatches = selectedCategoryKey == null || svc.categoryKey == selectedCategoryKey
                        val queryMatches = if (q.isEmpty()) true else {
                            svc.titleBn.lowercase().contains(q) ||
                                svc.titleEn.lowercase().contains(q) ||
                                svc.descriptionBn.lowercase().contains(q) ||
                                svc.descriptionEn.lowercase().contains(q) ||
                                svc.providerNameBn.lowercase().contains(q) ||
                                svc.providerNameEn.lowercase().contains(q) ||
                                svc.categoryKey.lowercase().contains(q) ||
                                (categoryLookup[svc.categoryKey]?.lowercase()?.contains(q) == true)
                        }
                        catMatches && queryMatches
                    }
                }

                LazyColumn(
                    modifier = Modifier
                        .widthIn(max = 760.dp)
                        .fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        val userName = userProfile?.fullName?.takeIf { it.isNotBlank() } ?: ""
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    modifier = Modifier.weight(1f),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Image(
                                        painter = painterResource(id = R.drawable.img_brand_logo),
                                        contentDescription = t("app.name"),
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(RoundedCornerShape(10.dp)),
                                        contentScale = ContentScale.Fit
                                    )
                                    Text(
                                        text = if (userName.isNotBlank()) "${t("home.greeting")}, $userName" else t("home.greeting"),
                                        style = MaterialTheme.typography.titleMedium,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                                IconButton(onClick = onRefresh) {
                                    Icon(Icons.Rounded.Refresh, contentDescription = t("home.refresh"))
                                }
                            }
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(16f / 9f),
                                shape = RoundedCornerShape(22.dp),
                                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
                            ) {
                                Image(
                                    painter = painterResource(id = R.drawable.img_hero_banner),
                                    contentDescription = t("home.hero_title"),
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            }
                        }
                    }

                    item {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = onSearchChange,
                            placeholder = {
                                Text(
                                    text = t("home.search_placeholder"),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            },
                            leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                            trailingIcon = {
                                if (searchQuery.isNotEmpty()) {
                                    IconButton(onClick = { onSearchChange("") }) {
                                        Icon(Icons.Rounded.Close, contentDescription = t("common.cancel"))
                                    }
                                }
                            },
                            singleLine = true,
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("service_search_input")
                        )
                    }

                    // 12 Categories Filter Row
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = t("home.categories_title"),
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onBackground
                            )
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                item {
                                    FilterChip(
                                        selected = selectedCategoryKey == null,
                                        onClick = { onSelectCategory(null) },
                                        label = { Text(t("home.all_categories")) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = MaterialTheme.colorScheme.primary,
                                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                        )
                                    )
                                }
                                items(ServiceCategory.entries) { cat ->
                                    val selected = selectedCategoryKey == cat.key
                                    FilterChip(
                                        selected = selected,
                                        onClick = { onSelectCategory(if (selected) null else cat.key) },
                                        label = { Text(t(cat.i18nKey)) },
                                        leadingIcon = {
                                            Icon(
                                                imageVector = categoryIcon(cat.key),
                                                contentDescription = null,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = MaterialTheme.colorScheme.primary,
                                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                                            selectedLeadingIconColor = MaterialTheme.colorScheme.onPrimary
                                        )
                                    )
                                }
                            }
                        }
                    }

                    item {
                        Text(
                            text = t("home.featured_services"),
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }

                    if (filteredServices.isEmpty()) {
                        item {
                            BilingualEmptyState(
                                icon = Icons.Rounded.Search,
                                title = t("home.no_services_found"),
                                hint = t("home.no_services_hint")
                            )
                        }
                    } else {
                        items(filteredServices, key = { it.id }) { service ->
                            ServiceMarketplaceCard(
                                service = service,
                                language = lang,
                                onClick = { selectedService = service }
                            )
                        }
                    }
                }
            }
        }
    }

    selectedService?.let { service ->
        ServiceDetailAndBookingSheet(
            service = service,
            userProfile = userProfile,
            isMutating = isMutating,
            onDismiss = { selectedService = null },
            onConfirmBooking = { name, phone, address, date, slot, notes ->
                onCreateBooking(
                    service,
                    name,
                    phone,
                    address,
                    date,
                    slot,
                    notes
                ) {
                    selectedService = null
                }
            }
        )
    }
}

@Composable
private fun ServiceMarketplaceCard(
    service: ServiceOffering,
    language: AppLanguage,
    onClick: () -> Unit
) {
    val config = LocalBilingualConfig.current
    val category = ServiceCategory.fromKey(service.categoryKey)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .testTag("service_card_${service.id}"),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = categoryIcon(service.categoryKey),
                        contentDescription = t(category.i18nKey),
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(26.dp)
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = t(category.i18nKey),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.secondary,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = service.localizedTitle(language),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
                Surface(
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Star,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.secondary,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = config.formatNumber(service.rating),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSecondaryContainer,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Text(
                text = service.localizedDescription(language),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            imageVector = Icons.Rounded.Verified,
                            contentDescription = t("home.verified_badge"),
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(15.dp)
                        )
                        Text(
                            text = service.localizedProviderName(language),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    Text(
                        text = "${service.localizedArea(language)} • ${config.formatNumber(service.durationMinutes)} ${t("home.mins")}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = t("home.starting_at"),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = config.formatCurrencyInr(service.basePriceInr),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServiceDetailAndBookingSheet(
    service: ServiceOffering,
    userProfile: UserProfile?,
    isMutating: Boolean,
    onDismiss: () -> Unit,
    onConfirmBooking: (
        name: String,
        phone: String,
        address: String,
        date: String,
        slot: String,
        notes: String
    ) -> Unit
) {
    val config = LocalBilingualConfig.current
    val lang = config.language
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val defaultDate = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }

    var customerName by rememberSaveable(service.id) { mutableStateOf(userProfile?.fullName.orEmpty()) }
    var customerPhone by rememberSaveable(service.id) { mutableStateOf(userProfile?.mobileNumber.orEmpty()) }
    var serviceAddress by rememberSaveable(service.id) { mutableStateOf(userProfile?.fullAddress.orEmpty()) }
    var scheduledDate by rememberSaveable(service.id) { mutableStateOf(defaultDate) }
    var slotIndex by rememberSaveable(service.id) { mutableIntStateOf(0) }
    var notes by rememberSaveable(service.id) { mutableStateOf("") }
    var errorKey by rememberSaveable { mutableStateOf<String?>(null) }

    val slotOptions = listOf(
        t("service.slot_morning"),
        t("service.slot_afternoon"),
        t("service.slot_evening")
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = service.localizedTitle(lang),
                style = MaterialTheme.typography.headlineSmall
            )
            Text(
                text = service.localizedDescription(lang),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = t("service.provider_profile"),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Rounded.Person, contentDescription = null, modifier = Modifier.size(18.dp))
                        Text(service.localizedProviderName(lang), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Rounded.LocationOn, contentDescription = null, modifier = Modifier.size(18.dp))
                        Text("${t("service.area")}: ${service.localizedArea(lang)}", style = MaterialTheme.typography.bodySmall)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Rounded.Schedule, contentDescription = null, modifier = Modifier.size(18.dp))
                        Text(
                            "${t("service.estimated_time")}: ${config.formatNumber(service.durationMinutes)} ${t("home.mins")} • ${t("service.service_charge")}: ${config.formatCurrencyInr(service.basePriceInr)}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            Text(
                text = t("service.book_service"),
                style = MaterialTheme.typography.titleMedium
            )

            OutlinedTextField(
                value = customerName,
                onValueChange = { customerName = it; errorKey = null },
                label = { Text(t("auth.full_name")) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = customerPhone,
                onValueChange = { customerPhone = it.filter { ch -> ch.isDigit() || ch == '+' }.take(14); errorKey = null },
                label = { Text(t("auth.mobile")) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = serviceAddress,
                onValueChange = { serviceAddress = it; errorKey = null },
                label = { Text(t("auth.address")) },
                minLines = 2,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = scheduledDate,
                onValueChange = { scheduledDate = it },
                label = { Text(t("service.date_label")) },
                leadingIcon = { Icon(Icons.Rounded.CalendarMonth, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(text = t("service.slot_label"), style = MaterialTheme.typography.labelLarge)
                slotOptions.forEachIndexed { idx, slotLabel ->
                    FilterChip(
                        selected = slotIndex == idx,
                        onClick = { slotIndex = idx },
                        label = { Text(slotLabel) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text(t("service.notes_label")) },
                placeholder = { Text(t("service.notes_hint")) },
                minLines = 2,
                maxLines = 4,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("booking_notes_input")
            )

            errorKey?.let { key ->
                Text(
                    text = t(key),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }

            Button(
                onClick = {
                    when {
                        customerName.trim().length < 2 -> errorKey = "auth.err_name_required"
                        customerPhone.filter { it.isDigit() }.length < 10 -> errorKey = "auth.err_mobile_invalid"
                        serviceAddress.trim().length < 4 -> errorKey = "auth.err_address_required"
                        else -> onConfirmBooking(
                            customerName,
                            customerPhone,
                            serviceAddress,
                            scheduledDate,
                            slotOptions[slotIndex],
                            notes
                        )
                    }
                },
                enabled = !isMutating,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("confirm_booking_button"),
                shape = RoundedCornerShape(14.dp)
            ) {
                if (isMutating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(text = t("service.confirm_booking"), style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}
