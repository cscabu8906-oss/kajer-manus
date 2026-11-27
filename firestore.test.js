const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_123";
const BOB_UID = "bob_456";
const ADMIN_UID = "admin_789";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

function pastDate(offsetMs = 5000) {
  return new Date(Date.now() - offsetMs);
}

function validUserPayload(uid, email = "alice@example.com") {
  return {
    userId: uid,
    fullName: "অনিমেষ রায়",
    email,
    mobileNumber: "9830012345",
    fullAddress: "২৪/বি পার্ক স্ট্রিট, কলকাতা ৭০০০১৬",
    accountRole: "customer",
    languagePreference: "bn",
    bengaliNumerals: true,
    pushNotificationsEnabled: true,
    emailNotificationsEnabled: true,
    profileCompleted: true,
    createdAt: pastDate(10000),
    updatedAt: pastDate(10000),
  };
}

function validServicePayload(providerId = BOB_UID) {
  return {
    categoryKey: "electrician",
    titleBn: "বাড়ির ওয়্যারিং ও সুইচ মেরামত",
    titleEn: "Home Wiring & Switch Repair",
    descriptionBn: "সকল প্রকার বৈদ্যুতিক সুইচবোর্ড ও পাখা মেরামত।",
    descriptionEn: "All types of electrical switchboard and fan repair.",
    providerNameBn: "সুমন দত্ত",
    providerNameEn: "Suman Dutta",
    providerAreaBn: "সল্টলেক, কলকাতা",
    providerAreaEn: "Salt Lake, Kolkata",
    providerId,
    basePriceInr: 299,
    durationMinutes: 60,
    rating: 4.8,
    active: true,
    createdAt: pastDate(10000),
    updatedAt: pastDate(10000),
  };
}

function validBookingPayload(customerId = ALICE_UID, providerId = BOB_UID) {
  return {
    customerId,
    customerName: "অনিমেষ রায়",
    customerPhone: "9830012345",
    serviceAddress: "২৪/বি পার্ক স্ট্রিট, কলকাতা",
    serviceId: "svc_elec_1",
    serviceTitleBn: "বাড়ির ওয়্যারিং ও সুইচ মেরামত",
    serviceTitleEn: "Home Wiring & Switch Repair",
    categoryKey: "electrician",
    providerId,
    providerNameBn: "সুমন দত্ত",
    providerNameEn: "Suman Dutta",
    scheduledDate: "2026-11-28",
    scheduledSlot: "10:00 AM - 12:00 PM",
    amountInr: 299,
    notes: "মূল ঘরের সুইচবোর্ড পরীক্ষা করতে হবে",
    status: "pending",
    languageAtBooking: "bn",
    createdAt: pastDate(10000),
    updatedAt: pastDate(10000),
  };
}

test("Unauthenticated user: denied across all collections", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).get());
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).set(validUserPayload(ALICE_UID)));
  await assertFails(unauthDb.collection("services").where("active", "==", true).get());
  await assertFails(unauthDb.collection("bookings").where("customerId", "==", ALICE_UID).get());
});

test("User profile: owner create, partial language sync update, cross-user & ghost-field denial", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID, { email: "alice@example.com", email_verified: true }).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID, { email: "bob@example.com", email_verified: true }).firestore();

  // Valid create
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).set(validUserPayload(ALICE_UID))
  );

  // Language sync partial update succeeds
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).update({
      languagePreference: "en",
      updatedAt: pastDate(1000),
    })
  );

  // Shadow/ghost field rejected
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).update({
      languagePreference: "bn",
      isAdmin: true,
      updatedAt: pastDate(500),
    })
  );

  // Immutable createdAt mutation rejected
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).update({
      createdAt: pastDate(100),
      updatedAt: pastDate(100),
    })
  );

  // Cross-user PII read & write denied
  await assertFails(bobDb.collection("users").doc(ALICE_UID).get());
  await assertFails(bobDb.collection("users").doc(ALICE_UID).update({
    languagePreference: "en",
    updatedAt: pastDate(500),
  }));
  // Non-admin list users denied
  await assertFails(aliceDb.collection("users").get());
});

test("Services: authenticated filtered list succeeds, non-admin write denied, verified admin write succeeds, spoofed email denied", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID, { email: "alice@example.com", email_verified: true }).firestore();
  const spoofAdminDb = testEnv.authenticatedContext("spoof_1", { email: "cscabu8906@gmail.com", email_verified: false }).firestore();
  const realAdminDb = testEnv.authenticatedContext(ADMIN_UID, { email: "cscabu8906@gmail.com", email_verified: true }).firestore();

  // Non-admin & unverified-email admin cannot create services
  await assertFails(aliceDb.collection("services").doc("svc_elec_1").set(validServicePayload()));
  await assertFails(spoofAdminDb.collection("services").doc("svc_elec_1").set(validServicePayload()));

  // Verified admin creates bilingual service
  await assertSucceeds(realAdminDb.collection("services").doc("svc_elec_1").set(validServicePayload()));

  // Independent bilingual update succeeds without overwriting other language
  await assertSucceeds(
    realAdminDb.collection("services").doc("svc_elec_1").update({
      titleBn: "নতুন ওয়্যারিং সেবা",
      updatedAt: pastDate(1000),
    })
  );

  // Signed-in user filtered query matches allow list rule
  await assertSucceeds(aliceDb.collection("services").where("active", "==", true).get());
  // Unfiltered services list denied for non-admin
  await assertFails(aliceDb.collection("services").get());
});

test("Bookings: customer create & cancel pending, provider workflow, terminal lock, query isolation", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID, { email: "alice@example.com", email_verified: true }).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID, { email: "bob@example.com", email_verified: true }).firestore();
  const charlieDb = testEnv.authenticatedContext("charlie_999", { email: "charlie@example.com", email_verified: true }).firestore();

  // Customer creates pending booking
  await assertSucceeds(
    aliceDb.collection("bookings").doc("bk_1").set(validBookingPayload(ALICE_UID, BOB_UID))
  );

  // Cannot create booking already accepted
  await assertFails(
    aliceDb.collection("bookings").doc("bk_bad").set({
      ...validBookingPayload(ALICE_UID, BOB_UID),
      status: "accepted",
    })
  );

  // Customer scoped list succeeds; unfiltered list fails
  await assertSucceeds(aliceDb.collection("bookings").where("customerId", "==", ALICE_UID).get());
  await assertFails(aliceDb.collection("bookings").get());

  // Unrelated user cannot read or mutate booking
  await assertFails(charlieDb.collection("bookings").doc("bk_1").get());
  await assertFails(charlieDb.collection("bookings").doc("bk_1").update({
    status: "cancelled",
    updatedAt: pastDate(1000),
  }));

  // Provider accepts -> in_progress -> completed
  await assertSucceeds(
    bobDb.collection("bookings").doc("bk_1").update({
      status: "accepted",
      updatedAt: pastDate(2000),
    })
  );
  // Customer cannot cancel once accepted
  await assertFails(
    aliceDb.collection("bookings").doc("bk_1").update({
      status: "cancelled",
      updatedAt: pastDate(1500),
    })
  );
  await assertSucceeds(
    bobDb.collection("bookings").doc("bk_1").update({
      status: "completed",
      updatedAt: pastDate(1000),
    })
  );

  // Terminal state lock: provider cannot change completed booking
  await assertFails(
    bobDb.collection("bookings").doc("bk_1").update({
      status: "accepted",
      updatedAt: pastDate(500),
    })
  );
});

test("User notifications & support tickets subcollections: strict owner isolation", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID, { email: "alice@example.com", email_verified: true }).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID, { email: "bob@example.com", email_verified: true }).firestore();

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("notifications").doc("notif_1").set({
      userId: ALICE_UID,
      titleBn: "বুকিং গৃহীত",
      titleEn: "Booking Accepted",
      bodyBn: "আপনার বুকিং গ্রহণ করা হয়েছে।",
      bodyEn: "Your booking has been accepted.",
      bookingId: "bk_1",
      type: "booking_status",
      readFlag: false,
      languageCode: "bn",
      createdAt: pastDate(5000),
    })
  );

  await assertSucceeds(aliceDb.collection("users").doc(ALICE_UID).collection("notifications").get());
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("notifications").doc("notif_1").update({
      readFlag: true,
    })
  );

  await assertFails(bobDb.collection("users").doc(ALICE_UID).collection("notifications").get());

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("support_tickets").doc("tkt_1").set({
      userId: ALICE_UID,
      subject: "সাহায্য প্রয়োজন",
      message: "আমার বুকিং সময় পরিবর্তন করতে চাই।",
      languageCode: "bn",
      status: "open",
      createdAt: pastDate(5000),
    })
  );
  await assertFails(bobDb.collection("users").doc(ALICE_UID).collection("support_tickets").get());
});
