// Every business rule the owner might change lives here, and only here.
// (GC2 Challenge 4: changing a rule should be a one-line edit.)

module.exports = {
  // Time (Quezon City: Asia/Manila, UTC+8, no daylight saving)
  UTC_OFFSET_MINUTES: 8 * 60,
  SLOT_MINUTES: 30, // bookings start on :00 or :30 and last whole slots
  BOOKING_DAYS_AHEAD: 7,
  PAST_GRACE_MINUTES: 5, // a slot that started under 5 minutes ago can still be booked
  IDLE_GRACE_MINUTES: 10, // the socket frees for the next driver this long after the window ends
  MAX_KWH: 200,

  // Money, in centavos
  RESERVATION_FEE_CENTS: 5000, // ₱50: WattSpot's own revenue per booking
  DEPOSIT_CENTS: 10000, // ₱100: refundable, so not counted as revenue

  // Watt Credits (loyalty)
  POINTS_PER_PESO: 0.02, // 1 credit for every ₱50 of charging fee
  OFF_PEAK_MULTIPLIER: 2, // GC1: reward charging during off-peak grid hours
  OFF_PEAK_START_HOUR: 22,
  OFF_PEAK_END_HOUR: 6,
  POINT_VALUE_CENTS: 100, // 1 credit = ₱1 when paying with Watt Credits

  // Owner screen: a product-day with 80%+ of its socket-slots booked is "almost full"
  ALMOST_FULL_RATIO: 0.8,

  PAYMENT_METHODS: ['GCash', 'Maya Wallet', 'Card', 'Watt Credits'],
  CREDITS_PAYMENT: 'Watt Credits',

  ISSUE_TYPES: ['Broken charger', 'Socket blocked', 'Payment problem', 'Station closed', 'Other'],

  // Connector codes stored in the database → labels shown to drivers
  CONNECTORS: { CCS2: 'CCS2 DC', Type2: 'Type 2 AC', CHAdeMO: 'CHAdeMO DC' },
};
