/**
 * FanFood multi-venue domain: schema, seed data, and row mappers.
 *
 * Venues, sections, and menu items live in SQLite so the product can scale
 * beyond a single ballpark without code changes per stadium.
 */

import type { BoundDatabase } from '../types.ts';
import { generateUUID } from './auth.ts';

// ==== TYPES ====

/** How food reaches the fan at this venue. */
export type DeliveryMode = 'premium' | 'all' | 'pickup_only';

/** Bowl level for a section. */
export type SectionLevel = 'field' | 'club' | 'view' | 'suite' | 'other';

/** Zoning label used for logistics and UI. */
export type SectionZone =
  | 'dugout_club'
  | 'field_club'
  | 'field_box'
  | 'bleachers'
  | 'arcade'
  | 'club'
  | 'view_box'
  | 'view_reserve'
  | 'specialty'
  | 'sro';

/** Payment method for an order. */
export type PaymentType = 'Cash' | 'Card';

/** Venue as returned by the API. */
export interface Venue {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  address: string;
  capacity: number | null;
  timezone: string;
  deliveryMode: DeliveryMode;
  active: boolean;
}

/** Section / seating zone for a venue. */
export interface VenueSection {
  id: string;
  venueId: string;
  code: string;
  level: SectionLevel;
  zone: SectionZone;
  rowMin: string | null;
  rowMax: string | null;
  deliveryEligible: boolean;
  notes: string | null;
  sortOrder: number;
}

/** Menu item sold at a venue. */
export interface MenuItem {
  id: string;
  venueId: string;
  name: string;
  price: number;
  category: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
}

/** In-seat (or pickup) food order. */
export interface FoodOrder {
  id: string;
  userId: string;
  venueId: string;
  venueName: string;
  menuItemId: string | null;
  foodType: string;
  qty: number;
  totalPrice: number;
  section: string;
  row: string;
  seat: string;
  level: string | null;
  zone: string | null;
  deliveryEligible: boolean;
  paymentType: PaymentType;
  status: string;
  confirmNumber: string;
  createdAt: number;
}

// ==== MAPPERS ====

/**
 * Map a Venues row to the API shape.
 *
 * @param row - SQLite row
 * @returns Venue
 */
export function mapVenueRow(row: Record<string, unknown>): Venue {
  const mode = String(row.delivery_mode ?? 'pickup_only');
  const deliveryMode: DeliveryMode =
    mode === 'premium' || mode === 'all' || mode === 'pickup_only' ? mode : 'pickup_only';
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    shortName: String(row.short_name ?? row.name),
    city: String(row.city ?? ''),
    state: String(row.state ?? ''),
    address: String(row.address ?? ''),
    capacity: row.capacity == null ? null : Number(row.capacity),
    timezone: String(row.timezone ?? 'America/Los_Angeles'),
    deliveryMode,
    active: Number(row.active) === 1,
  };
}

/**
 * Map a VenueSections row to the API shape.
 *
 * @param row - SQLite row
 * @returns VenueSection
 */
export function mapSectionRow(row: Record<string, unknown>): VenueSection {
  return {
    id: String(row.id),
    venueId: String(row.venue_id),
    code: String(row.code),
    level: String(row.level) as SectionLevel,
    zone: String(row.zone) as SectionZone,
    rowMin: row.row_min == null ? null : String(row.row_min),
    rowMax: row.row_max == null ? null : String(row.row_max),
    deliveryEligible: Number(row.delivery_eligible) === 1,
    notes: row.notes == null ? null : String(row.notes),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/**
 * Map a MenuItems row to the API shape.
 *
 * @param row - SQLite row
 * @returns MenuItem
 */
export function mapMenuItemRow(row: Record<string, unknown>): MenuItem {
  return {
    id: String(row.id),
    venueId: String(row.venue_id),
    name: String(row.name),
    price: Number(row.price),
    category: String(row.category ?? 'Other'),
    description: row.description == null ? null : String(row.description),
    active: Number(row.active) === 1,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/**
 * Map an Orders row to the API shape.
 *
 * @param row - SQLite row
 * @returns FoodOrder
 */
export function mapOrderRow(row: Record<string, unknown>): FoodOrder {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    venueId: String(row.venue_id ?? ''),
    venueName: String(row.venue_name ?? row.stadium ?? ''),
    menuItemId: row.menu_item_id == null ? null : String(row.menu_item_id),
    foodType: String(row.food_type),
    qty: Number(row.qty),
    totalPrice: Number(row.total_price),
    section: String(row.section),
    row: String(row.row),
    seat: String(row.seat),
    level: row.level == null ? null : String(row.level),
    zone: row.zone == null ? null : String(row.zone),
    deliveryEligible: Number(row.delivery_eligible ?? 0) === 1,
    paymentType: row.payment_type === 'Card' ? 'Card' : 'Cash',
    status: String(row.status),
    confirmNumber: String(row.confirm_number),
    createdAt: Number(row.created_at),
  };
}

/**
 * Build a short confirmation code.
 *
 * @returns Code like FF-A1B2C3
 */
export function makeConfirmNumber(): string {
  return `FF-${generateUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

// ==== SCHEMA + SEED ====

/**
 * Create FanFood tables if missing, then seed venues when empty.
 *
 * @param db - Bound database helper
 * @returns void
 */
export async function ensureFanFoodSchema(db: BoundDatabase): Promise<void> {
  await db.executeQuery({
    query: `CREATE TABLE IF NOT EXISTS Venues (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      address TEXT NOT NULL,
      capacity INTEGER,
      timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
      delivery_mode TEXT NOT NULL DEFAULT 'pickup_only',
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`,
  });

  await db.executeQuery({
    query: `CREATE TABLE IF NOT EXISTS VenueSections (
      id TEXT PRIMARY KEY,
      venue_id TEXT NOT NULL,
      code TEXT NOT NULL,
      level TEXT NOT NULL,
      zone TEXT NOT NULL,
      row_min TEXT,
      row_max TEXT,
      delivery_eligible INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(venue_id, code),
      FOREIGN KEY (venue_id) REFERENCES Venues(id)
    )`,
  });

  await db.executeQuery({
    query: `CREATE INDEX IF NOT EXISTS idx_venue_sections_venue ON VenueSections(venue_id)`,
  });

  await db.executeQuery({
    query: `CREATE TABLE IF NOT EXISTS MenuItems (
      id TEXT PRIMARY KEY,
      venue_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (venue_id) REFERENCES Venues(id)
    )`,
  });

  await db.executeQuery({
    query: `CREATE INDEX IF NOT EXISTS idx_menu_items_venue ON MenuItems(venue_id)`,
  });

  await db.executeQuery({
    query: `CREATE TABLE IF NOT EXISTS Orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      venue_id TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      menu_item_id TEXT,
      food_type TEXT NOT NULL,
      qty INTEGER NOT NULL,
      total_price REAL NOT NULL,
      section TEXT NOT NULL,
      row TEXT NOT NULL,
      seat TEXT NOT NULL,
      level TEXT,
      zone TEXT,
      delivery_eligible INTEGER NOT NULL DEFAULT 0,
      payment_type TEXT NOT NULL,
      status TEXT NOT NULL,
      confirm_number TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      stadium TEXT
    )`,
  });

  await db.executeQuery({
    query: `CREATE INDEX IF NOT EXISTS idx_orders_user_id ON Orders(user_id)`,
  });
  await db.executeQuery({
    query: `CREATE INDEX IF NOT EXISTS idx_orders_venue_id ON Orders(venue_id)`,
  });

  // Migrate older Orders tables that only had stadium
  await tryAddColumn(db, 'Orders', 'venue_id', 'TEXT');
  await tryAddColumn(db, 'Orders', 'venue_name', 'TEXT');
  await tryAddColumn(db, 'Orders', 'menu_item_id', 'TEXT');
  await tryAddColumn(db, 'Orders', 'level', 'TEXT');
  await tryAddColumn(db, 'Orders', 'zone', 'TEXT');
  await tryAddColumn(db, 'Orders', 'delivery_eligible', 'INTEGER NOT NULL DEFAULT 0');

  await seedIfEmpty(db);
}

/**
 * Best-effort ADD COLUMN for SQLite migrations (ignore if exists).
 *
 * @param db - Bound database
 * @param table - Table name
 * @param column - Column name
 * @param typeSql - SQL type fragment
 */
async function tryAddColumn(
  db: BoundDatabase,
  table: string,
  column: string,
  typeSql: string
): Promise<void> {
  const result = await db.executeQuery({
    query: `ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`,
  });
  // Duplicate column name is expected on re-run — ignore failures
  void result;
}

/**
 * Seed venues/menu/sections when no venues exist yet.
 *
 * @param db - Bound database
 */
async function seedIfEmpty(db: BoundDatabase): Promise<void> {
  const existing = await db.executeQuery({
    query: 'SELECT id FROM Venues LIMIT 1',
  });
  if (existing.success && Array.isArray(existing.data) && existing.data.length > 0) {
    return;
  }
  await seedOraclePark(db);
}

/**
 * Insert Oracle Park venue, sections, and menu (SF Giants).
 *
 * @param db - Bound database
 */
async function seedOraclePark(db: BoundDatabase): Promise<void> {
  const venueId = generateUUID();
  const now = Date.now();

  await db.executeQuery({
    query: `INSERT INTO Venues (
      id, slug, name, short_name, city, state, address, capacity, timezone,
      delivery_mode, active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    params: [
      venueId,
      'oracle-park',
      'Oracle Park',
      'Oracle Park',
      'San Francisco',
      'CA',
      '24 Willie Mays Plaza, San Francisco, CA 94107',
      41265,
      'America/Los_Angeles',
      'premium',
      now,
    ],
  });

  // Sections: field 101–152, club 202–234, view 302–336
  let sort = 0;
  const sectionInserts: Array<{
    code: string;
    level: SectionLevel;
    zone: SectionZone;
    rowMin: string;
    rowMax: string;
    delivery: number;
    notes: string | null;
  }> = [];

  for (let n = 101; n <= 106; n++) {
    sectionInserts.push({
      code: String(n),
      level: 'field',
      zone: 'field_box',
      rowMin: '1',
      rowMax: '41',
      delivery: 0,
      notes: 'Right-field line field boxes',
    });
  }
  for (let n = 107; n <= 124; n++) {
    let notes = 'Field Club (A–R) + field boxes (~23–43). Delivery for Field Club / Diamond / Dugout.';
    if (n === 122 || n === 123) notes += ' Giants dugout.';
    if (n === 108 || n === 109) notes += ' Visitor dugout.';
    sectionInserts.push({
      code: String(n),
      level: 'field',
      zone: 'field_club',
      rowMin: 'A',
      rowMax: '43',
      delivery: 1,
      notes,
    });
  }
  for (let n = 125; n <= 135; n++) {
    sectionInserts.push({
      code: String(n),
      level: 'field',
      zone: 'field_box',
      rowMin: '1',
      rowMax: '41',
      delivery: 0,
      notes: 'Left-field line field boxes; netting through 135',
    });
  }
  for (let n = 136; n <= 144; n++) {
    sectionInserts.push({
      code: String(n),
      level: 'field',
      zone: 'bleachers',
      rowMin: '1',
      rowMax: '40',
      delivery: 0,
      notes: n === 144 ? 'Bleachers; overlooks bullpen; benches' : 'Bleachers; benches; near Fan Lot',
    });
  }
  for (let n = 145; n <= 152; n++) {
    sectionInserts.push({
      code: String(n),
      level: 'field',
      zone: 'arcade',
      rowMin: '1',
      rowMax: '3',
      delivery: 0,
      notes: 'Arcade over RF wall; McCovey Cove behind; mostly 3 rows + SRO',
    });
  }
  for (let n = 202; n <= 234; n++) {
    sectionInserts.push({
      code: String(n),
      level: 'club',
      zone: 'club',
      rowMin: 'A',
      rowMax: 'M',
      delivery: 0,
      notes:
        n >= 230 && n <= 232
          ? 'Alaska Airlines Club; patio tables in 230–232'
          : 'Alaska Airlines Club Level; indoor concourse',
    });
  }
  for (let n = 302; n <= 336; n++) {
    sectionInserts.push({
      code: String(n),
      level: 'view',
      zone: n <= 320 ? 'view_box' : 'view_reserve',
      rowMin: 'A',
      rowMax: '19',
      delivery: 0,
      notes:
        n <= 305
          ? 'View level; Bay Bridge views from RF upper'
          : n >= 330
            ? 'Deep left-field view; farther from action'
            : 'View Boxes (letter rows) / View Reserve (number rows)',
    });
  }

  for (const s of sectionInserts) {
    sort += 1;
    await db.executeQuery({
      query: `INSERT INTO VenueSections (
        id, venue_id, code, level, zone, row_min, row_max, delivery_eligible, notes, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        generateUUID(),
        venueId,
        s.code,
        s.level,
        s.zone,
        s.rowMin,
        s.rowMax,
        s.delivery,
        s.notes,
        sort,
      ],
    });
  }

  const menu: Array<{ name: string; price: number; category: string; description: string; order: number }> = [
    { name: 'Garlic Fries', price: 12.5, category: 'Classics', description: 'Oracle Park staple — fries with garlic & parsley', order: 1 },
    { name: 'Gilroy Garlic Fries', price: 12.5, category: 'Classics', description: 'Signature garlic fries', order: 2 },
    { name: 'Hot Dog', price: 8.5, category: 'Classics', description: 'Ballpark dog', order: 3 },
    { name: 'Char Siu Dog', price: 14.0, category: 'Classics', description: 'Foot-long with char siu glaze, Kewpie, fried onions (Doggie Diner)', order: 4 },
    { name: 'Crab Sandwich', price: 28.0, category: 'Seafood', description: 'Dungeness crab on garlic sourdough (Crazy Crab’z)', order: 5 },
    { name: 'Clam Chowder Bread Bowl', price: 16.5, category: 'Seafood', description: 'Sourdough bowl of clam chowder', order: 6 },
    { name: 'Helmet Nachos', price: 18.0, category: 'Mexican', description: 'Souvenir helmet nachos — carne asada or pollo', order: 7 },
    { name: 'Birria Grilled Cheese', price: 17.0, category: 'Mexican', description: 'Sourdough griddled in consommé with braised birria (SF Selects)', order: 8 },
    { name: 'Lumpia (Bacon Cheeseburger)', price: 15.0, category: 'Local', description: 'The Lumpia Company — Moo Moo sauce', order: 9 },
    { name: 'Spicy Ahi Poke Bowl', price: 19.0, category: 'Local', description: 'Da Poke-Man — rice or greens', order: 10 },
    { name: 'Pacific Eats Rice Bowl', price: 16.0, category: 'Local', description: 'Bulgogi, chicken, or tofu rice bowl', order: 11 },
    { name: 'Ghirardelli Sundae', price: 12.0, category: 'Dessert', description: 'Hot fudge sundae with Ghirardelli chocolate', order: 12 },
    { name: 'Beer', price: 14.0, category: 'Drinks', description: 'Domestic draft', order: 13 },
    { name: 'Soft Drink', price: 6.5, category: 'Drinks', description: 'Fountain soda', order: 14 },
  ];

  for (const item of menu) {
    await db.executeQuery({
      query: `INSERT INTO MenuItems (
        id, venue_id, name, price, category, description, active, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      params: [generateUUID(), venueId, item.name, item.price, item.category, item.description, item.order],
    });
  }
}

/**
 * Load a venue by slug or id.
 *
 * @param db - Bound database
 * @param slugOrId - Venue slug or UUID
 * @returns Venue or null
 */
export async function findVenue(db: BoundDatabase, slugOrId: string): Promise<Venue | null> {
  const result = await db.executeQuery({
    query: 'SELECT * FROM Venues WHERE (slug = ? OR id = ?) AND active = 1 LIMIT 1',
    params: [slugOrId, slugOrId],
  });
  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }
  return mapVenueRow(result.data[0] as Record<string, unknown>);
}

/**
 * Load a section for a venue by section code.
 *
 * @param db - Bound database
 * @param venueId - Venue id
 * @param code - Section code e.g. "122"
 * @returns VenueSection or null
 */
export async function findSection(
  db: BoundDatabase,
  venueId: string,
  code: string
): Promise<VenueSection | null> {
  const result = await db.executeQuery({
    query: 'SELECT * FROM VenueSections WHERE venue_id = ? AND code = ? LIMIT 1',
    params: [venueId, code],
  });
  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }
  return mapSectionRow(result.data[0] as Record<string, unknown>);
}

/**
 * Load a menu item by id for a venue.
 *
 * @param db - Bound database
 * @param venueId - Venue id
 * @param menuItemId - Menu item id
 * @returns MenuItem or null
 */
export async function findMenuItem(
  db: BoundDatabase,
  venueId: string,
  menuItemId: string
): Promise<MenuItem | null> {
  const result = await db.executeQuery({
    query: 'SELECT * FROM MenuItems WHERE id = ? AND venue_id = ? AND active = 1 LIMIT 1',
    params: [menuItemId, venueId],
  });
  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }
  return mapMenuItemRow(result.data[0] as Record<string, unknown>);
}

/**
 * Whether an email is an admin.
 *
 * Uses `ADMIN_EMAILS` (comma-separated). Empty list → all users admin in
 * non-production (local DX); production with empty list → no admins.
 *
 * @param email - User email
 * @param env - Process env (injectable for tests)
 * @returns True when the email may use admin APIs
 */
export function isAdminEmail(
  email: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const list = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) {
    return env.NODE_ENV !== 'production' && env.ENV !== 'production';
  }
  if (list.includes('*')) return true;
  return list.includes(email.trim().toLowerCase());
}

/**
 * Slugify a venue name for URLs.
 *
 * @param name - Display name
 * @returns URL-safe slug
 */
export function slugifyVenue(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Parse and validate delivery mode from request body.
 *
 * @param value - Raw value
 * @returns DeliveryMode or null if invalid
 */
export function parseDeliveryMode(value: unknown): DeliveryMode | null {
  if (value === 'premium' || value === 'all' || value === 'pickup_only') return value;
  return null;
}
