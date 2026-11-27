package com.example.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ContactSupport
import androidx.compose.material.icons.automirrored.rounded.EventNote
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Policy
import androidx.compose.material.icons.rounded.PrivacyTip
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.data.KajerManushRepository
import com.example.data.UserProfile
import com.example.i18n.AppLanguage
import com.example.i18n.LanguagePreferencesStore
import com.example.i18n.t
import com.example.ui.components.ContactSupportDialog
import com.example.ui.components.LanguageSelectorCard
import com.example.ui.components.LanguageTogglePill
import com.example.ui.components.LegalInfoDialog
import com.example.ui.screens.AdminDashboardScreen
import com.example.ui.screens.BookingsScreen
import com.example.ui.screens.HomeMarketplaceScreen
import com.example.ui.screens.NotificationsScreen
import com.example.ui.screens.ProfileCompletionScreen
import com.example.ui.screens.ProfileSettingsScreen
import kotlinx.coroutines.launch

const val ROUTE_HOME = "home"
const val ROUTE_BOOKINGS = "bookings"
const val ROUTE_NOTIFICATIONS = "notifications"
const val ROUTE_PROFILE = "profile"
const val ROUTE_ADMIN = "admin"

private data class NavDestinationItem(
    val route: String,
    val labelKey: String,
    val icon: ImageVector
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthenticatedApp(
    repository: KajerManushRepository,
    initialUser: UserProfile,
    currentLanguage: AppLanguage,
    bengaliNumerals: Boolean,
    prefsStore: LanguagePreferencesStore
) {
    val scope = rememberCoroutineScope()
    val currentUserId = initialUser.userId

    val viewModel: KajerManushViewModel = viewModel(
        key = currentUserId,
        factory = viewModelFactory {
            initializer {
                KajerManushViewModel(
                    repository = repository,
                    prefsStore = prefsStore,
                    currentUserId = currentUserId,
                    initialUser = initialUser
                )
            }
        }
    )

    val profileState by viewModel.userProfileState.collectAsStateWithLifecycle()
    val servicesState by viewModel.servicesState.collectAsStateWithLifecycle()
    val customerBookingsState by viewModel.customerBookingsState.collectAsStateWithLifecycle()
    val providerBookingsState by viewModel.providerBookingsState.collectAsStateWithLifecycle()
    val providerApproved by viewModel.providerApproved.collectAsStateWithLifecycle()
    val providerProfile by viewModel.providerProfile.collectAsStateWithLifecycle()
    val notificationsState by viewModel.notificationsState.collectAsStateWithLifecycle()
    val isAdmin by viewModel.isAdmin.collectAsStateWithLifecycle()
    val adminStats by viewModel.adminStats.collectAsStateWithLifecycle()
    val adminProviders by viewModel.adminProviders.collectAsStateWithLifecycle()
    val adminServices by viewModel.adminServicesState.collectAsStateWithLifecycle()
    val adminBookings by viewModel.adminBookingsState.collectAsStateWithLifecycle()
    val adminUsers by viewModel.adminUsersState.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val selectedCategory by viewModel.selectedCategoryKey.collectAsStateWithLifecycle()
    val actionMessage by viewModel.actionMessage.collectAsStateWithLifecycle()
    val isMutating by viewModel.isMutating.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(actionMessage) {
        actionMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearActionMessage()
        }
    }

    val loadedProfile = (profileState as? UiState.Success)?.data
    if (profileState is UiState.Loading && loadedProfile == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(10.dp))
                Text(t("common.loading"))
            }
        }
        return
    }

    if (loadedProfile != null && !loadedProfile.profileCompleted) {
        val savedMsg = t("settings.profile_saved")
        val errMsg = t("common.error_generic")
        ProfileCompletionScreen(
            profile = loadedProfile,
            currentLanguage = currentLanguage,
            isSaving = isMutating,
            onSelectLanguage = { lang -> viewModel.switchLanguage(lang, bengaliNumerals) },
            onSaveRegistration = { name, mobile, address ->
                viewModel.updateProfile(name, mobile, address, savedMsg, errMsg)
            }
        )
        return
    }

    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route ?: ROUTE_HOME
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    var showPrivacy by rememberSaveable { mutableStateOf(false) }
    var showTerms by rememberSaveable { mutableStateOf(false) }
    var showCancellation by rememberSaveable { mutableStateOf(false) }
    var showContact by rememberSaveable { mutableStateOf(false) }

    val unreadCount = (notificationsState as? UiState.Success)?.data?.count { !it.readFlag } ?: 0

    val destinations = remember(isAdmin) {
        buildList {
            add(NavDestinationItem(ROUTE_HOME, "nav.home", Icons.Rounded.Home))
            add(NavDestinationItem(ROUTE_BOOKINGS, "nav.bookings", Icons.AutoMirrored.Rounded.EventNote))
            add(NavDestinationItem(ROUTE_NOTIFICATIONS, "nav.notifications", Icons.Rounded.Notifications))
            add(NavDestinationItem(ROUTE_PROFILE, "nav.profile", Icons.Rounded.Person))
            if (isAdmin) {
                add(NavDestinationItem(ROUTE_ADMIN, "nav.admin", Icons.Rounded.AdminPanelSettings))
            }
        }
    }

    val navigateTo: (String) -> Unit = { route ->
        if (currentRoute != route) {
            navController.navigate(route) {
                popUpTo(ROUTE_HOME) { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    val bookingCreatedMsg = t("service.booking_success")
    val bookingStatusMsg = t("booking.status_updated")
    val profileSavedMsg = t("settings.profile_saved")
    val providerSavedMsg = t("booking.provider_profile_saved")
    val reviewSavedMsg = t("booking.review_submitted")
    val contactSentMsg = t("settings.contact_sent")
    val genericErrMsg = t("common.error_generic")

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = t("app.name"),
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = loadedProfile?.fullName?.ifBlank { initialUser.fullName } ?: initialUser.fullName,
                        style = MaterialTheme.typography.titleSmall
                    )
                    Text(
                        text = loadedProfile?.email ?: initialUser.email,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    LanguageSelectorCard(
                        currentLanguage = currentLanguage,
                        onSelectLanguage = { lang -> viewModel.switchLanguage(lang, bengaliNumerals) },
                        showSyncedNote = true
                    )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                destinations.forEach { dest ->
                    NavigationDrawerItem(
                        label = { Text(t(dest.labelKey)) },
                        selected = currentRoute == dest.route,
                        onClick = {
                            scope.launch { drawerState.close() }
                            navigateTo(dest.route)
                        },
                        icon = { Icon(dest.icon, contentDescription = null) },
                        modifier = Modifier.padding(horizontal = 12.dp)
                    )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                NavigationDrawerItem(
                    label = { Text(t("nav.contact")) },
                    selected = false,
                    onClick = {
                        scope.launch { drawerState.close() }
                        showContact = true
                    },
                    icon = { Icon(Icons.AutoMirrored.Rounded.ContactSupport, contentDescription = null) },
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
                NavigationDrawerItem(
                    label = { Text(t("nav.privacy")) },
                    selected = false,
                    onClick = {
                        scope.launch { drawerState.close() }
                        showPrivacy = true
                    },
                    icon = { Icon(Icons.Rounded.PrivacyTip, contentDescription = null) },
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
                NavigationDrawerItem(
                    label = { Text(t("nav.terms")) },
                    selected = false,
                    onClick = {
                        scope.launch { drawerState.close() }
                        showTerms = true
                    },
                    icon = { Icon(Icons.Rounded.Description, contentDescription = null) },
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
                NavigationDrawerItem(
                    label = { Text(t("nav.cancellation")) },
                    selected = false,
                    onClick = {
                        scope.launch { drawerState.close() }
                        showCancellation = true
                    },
                    icon = { Icon(Icons.Rounded.Policy, contentDescription = null) },
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
                NavigationDrawerItem(
                    label = { Text(t("auth.sign_out")) },
                    selected = false,
                    onClick = {
                        scope.launch { drawerState.close() }
                        viewModel.signOut()
                    },
                    icon = { Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = null) },
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
            }
        }
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val isWideScreen = maxWidth >= 600.dp

            Scaffold(
                contentWindowInsets = WindowInsets.safeDrawing,
                snackbarHost = { SnackbarHost(snackbarHostState) },
                topBar = {
                    TopAppBar(
                        navigationIcon = {
                            IconButton(
                                onClick = { scope.launch { drawerState.open() } },
                                modifier = Modifier.testTag("nav_menu_button")
                            ) {
                                Icon(Icons.Rounded.Menu, contentDescription = t("nav.menu"))
                            }
                        },
                        title = {
                            Text(
                                text = t("app.name"),
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Bold
                            )
                        },
                        actions = {
                            IconButton(onClick = { navigateTo(ROUTE_NOTIFICATIONS) }) {
                                BadgedBox(
                                    badge = {
                                        if (unreadCount > 0) {
                                            Badge { Text(unreadCount.toString()) }
                                        }
                                    }
                                ) {
                                    Icon(Icons.Rounded.Notifications, contentDescription = t("nav.notifications"))
                                }
                            }
                            LanguageTogglePill(
                                currentLanguage = currentLanguage,
                                onSelectLanguage = { lang -> viewModel.switchLanguage(lang, bengaliNumerals) },
                                modifier = Modifier.padding(end = 8.dp)
                            )
                        }
                    )
                },
                bottomBar = {
                    if (!isWideScreen) {
                        NavigationBar {
                            destinations.forEach { dest ->
                                NavigationBarItem(
                                    selected = currentRoute == dest.route,
                                    onClick = { navigateTo(dest.route) },
                                    icon = {
                                        if (dest.route == ROUTE_NOTIFICATIONS && unreadCount > 0) {
                                            BadgedBox(badge = { Badge { Text(unreadCount.toString()) } }) {
                                                Icon(dest.icon, contentDescription = t(dest.labelKey))
                                            }
                                        } else {
                                            Icon(dest.icon, contentDescription = t(dest.labelKey))
                                        }
                                    },
                                    label = { Text(t(dest.labelKey), maxLines = 1) },
                                    modifier = Modifier.testTag("bottom_nav_${dest.route}")
                                )
                            }
                        }
                    }
                }
            ) { innerPadding ->
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    if (isWideScreen) {
                        NavigationRail(modifier = Modifier.fillMaxHeight()) {
                            destinations.forEach { dest ->
                                NavigationRailItem(
                                    selected = currentRoute == dest.route,
                                    onClick = { navigateTo(dest.route) },
                                    icon = {
                                        if (dest.route == ROUTE_NOTIFICATIONS && unreadCount > 0) {
                                            BadgedBox(badge = { Badge { Text(unreadCount.toString()) } }) {
                                                Icon(dest.icon, contentDescription = t(dest.labelKey))
                                            }
                                        } else {
                                            Icon(dest.icon, contentDescription = t(dest.labelKey))
                                        }
                                    },
                                    label = { Text(t(dest.labelKey), maxLines = 1) }
                                )
                            }
                        }
                    }

                    NavHost(
                        navController = navController,
                        startDestination = ROUTE_HOME,
                        modifier = Modifier.weight(1f).fillMaxSize()
                    ) {
                        composable(ROUTE_HOME) {
                            HomeMarketplaceScreen(
                                userProfile = loadedProfile,
                                servicesState = servicesState,
                                searchQuery = searchQuery,
                                selectedCategoryKey = selectedCategory,
                                isMutating = isMutating,
                                onSearchChange = viewModel::setSearchQuery,
                                onSelectCategory = viewModel::selectCategory,
                                onRefresh = viewModel::loadServices,
                                onCreateBooking = { svc, name, phone, addr, date, slot, notes, onBooked ->
                                    viewModel.createBooking(
                                        service = svc,
                                        customerName = name,
                                        customerPhone = phone,
                                        serviceAddress = addr,
                                        scheduledDate = date,
                                        scheduledSlot = slot,
                                        notes = notes,
                                        language = currentLanguage,
                                        successMsg = bookingCreatedMsg,
                                        errorMsg = genericErrMsg,
                                        onBooked = onBooked
                                    )
                                }
                            )
                        }

                        composable(ROUTE_BOOKINGS) {
                            BookingsScreen(
                                customerBookingsState = customerBookingsState,
                                providerBookingsState = providerBookingsState,
                                isProviderAccount = loadedProfile?.accountRole == "provider" || loadedProfile?.accountRole == "admin",
                                providerApproved = providerApproved,
                                providerProfile = providerProfile,
                                isMutating = isMutating,
                                onRefresh = viewModel::loadBookings,
                                onUpdateBookingStatus = { booking, newStatus ->
                                    viewModel.updateBookingStatus(
                                        booking = booking,
                                        newStatus = newStatus,
                                        successMsg = bookingStatusMsg,
                                        errorMsg = genericErrMsg
                                    )
                                },
                                onSubmitReview = { bookingId, rating, comment, onDone ->
                                    viewModel.submitReview(bookingId, rating, comment, reviewSavedMsg, genericErrMsg, onDone)
                                },
                                onApplyProviderProfile = { bioBn, bioEn, cats, locBn, locEn, exp, onDone ->
                                    viewModel.applyProviderProfile(bioBn, bioEn, cats, locBn, locEn, exp, providerSavedMsg, genericErrMsg, onDone)
                                },
                                onToggleProviderAvailability = viewModel::toggleProviderAvailability
                            )
                        }

                        composable(ROUTE_NOTIFICATIONS) {
                            NotificationsScreen(
                                notificationsState = notificationsState,
                                onRefresh = viewModel::loadNotifications,
                                onMarkRead = viewModel::markNotificationRead
                            )
                        }

                        composable(ROUTE_PROFILE) {
                            ProfileSettingsScreen(
                                profile = loadedProfile,
                                currentLanguage = currentLanguage,
                                bengaliNumerals = bengaliNumerals,
                                isMutating = isMutating,
                                onSelectLanguage = { lang -> viewModel.switchLanguage(lang, bengaliNumerals) },
                                onToggleBengaliNumerals = { enabled -> viewModel.toggleBengaliNumerals(enabled, currentLanguage) },
                                onUpdateNotificationPrefs = viewModel::updateNotificationPrefs,
                                onSaveProfile = { name, mobile, addr ->
                                    viewModel.updateProfile(name, mobile, addr, profileSavedMsg, genericErrMsg)
                                },
                                onSubmitSupportTicket = { subject, msg, onDone ->
                                    viewModel.submitSupportTicket(subject, msg, currentLanguage, contactSentMsg, genericErrMsg, onDone)
                                },
                                onSignOut = viewModel::signOut
                            )
                        }

                        composable(ROUTE_ADMIN) {
                            AdminDashboardScreen(
                                isAdmin = isAdmin,
                                currentLanguage = currentLanguage,
                                stats = adminStats,
                                providers = adminProviders,
                                services = adminServices,
                                bookings = adminBookings,
                                users = adminUsers,
                                isMutating = isMutating,
                                onSelectLanguage = { lang -> viewModel.switchLanguage(lang, bengaliNumerals) },
                                onRefresh = viewModel::loadAdminData,
                                onApproveProvider = { providerId, decision ->
                                    viewModel.approveProviderAdmin(providerId, decision, bookingStatusMsg, genericErrMsg)
                                },
                                onSaveService = { svc, isNew, onSaved ->
                                    viewModel.saveServiceAdmin(svc, isNew, profileSavedMsg, genericErrMsg, onSaved)
                                },
                                onUpdateBookingStatus = { booking, newStatus ->
                                    viewModel.updateBookingStatus(booking, newStatus, bookingStatusMsg, genericErrMsg)
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showPrivacy) {
        LegalInfoDialog(title = t("settings.privacy_title"), body = t("settings.privacy_body"), onDismiss = { showPrivacy = false })
    }
    if (showTerms) {
        LegalInfoDialog(title = t("settings.terms_title"), body = t("settings.terms_body"), onDismiss = { showTerms = false })
    }
    if (showCancellation) {
        LegalInfoDialog(title = t("settings.cancellation_title"), body = t("settings.cancellation_body"), onDismiss = { showCancellation = false })
    }
    if (showContact) {
        ContactSupportDialog(
            isSubmitting = isMutating,
            onSubmit = { subject, msg ->
                viewModel.submitSupportTicket(subject, msg, currentLanguage, contactSentMsg, genericErrMsg) {
                    showContact = false
                }
            },
            onDismiss = { showContact = false }
        )
    }
}
