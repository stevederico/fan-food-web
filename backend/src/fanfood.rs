//! FanFood venues, menus, sections, and orders.
//!
//! Schema statements live in [`crate::db`] (`FANFOOD_SCHEMA`). This module
//! seeds Oracle Park, maps rows to the API shapes, and applies the order
//! rules the Node `backend/lib/fanfood.ts` routes used.

use crate::db::{Db, DbError, Row, Value};
use crate::json::Json;
use crate::validation::{self, escape_html};

/// How a domain call failed: an HTTP status the route should return, or a driver error.
#[derive(Debug)]
pub enum FanFail {
    /// Status and plain-language message for the client.
    Http(u16, String),
    /// SQLite failure. Routes log it and answer 500.
    Db(DbError),
}

impl From<DbError> for FanFail {
    fn from(e: DbError) -> Self {
        FanFail::Db(e)
    }
}

fn http(status: u16, msg: impl Into<String>) -> FanFail {
    FanFail::Http(status, msg.into())
}

/// Venue returned by the fan and admin APIs.
#[derive(Debug, Clone, PartialEq)]
pub struct Venue {
    /// Row id.
    pub id: String,
    /// URL key.
    pub slug: String,
    /// Display name.
    pub name: String,
    /// Short label. Falls back to `name` when the column is null.
    pub short_name: String,
    /// City.
    pub city: String,
    /// State.
    pub state: String,
    /// Street address.
    pub address: String,
    /// Seating capacity, when set.
    pub capacity: Option<i64>,
    /// IANA timezone.
    pub timezone: String,
    /// `premium`, `all`, or `pickup_only`.
    pub delivery_mode: String,
    /// Inactive venues are hidden from the fan list.
    pub active: bool,
}

/// Seating zone inside a venue.
#[derive(Debug, Clone, PartialEq)]
pub struct VenueSection {
    /// Row id.
    pub id: String,
    /// Owning venue.
    pub venue_id: String,
    /// Section code, e.g. `122`.
    pub code: String,
    /// Bowl level.
    pub level: String,
    /// Logistics zone.
    pub zone: String,
    /// First row hint.
    pub row_min: Option<String>,
    /// Last row hint.
    pub row_max: Option<String>,
    /// In-seat when the venue mode is `premium`.
    pub delivery_eligible: bool,
    /// Operator notes.
    pub notes: Option<String>,
    /// Listing order.
    pub sort_order: i64,
}

/// Item sold at a venue. `price` is dollars.
#[derive(Debug, Clone, PartialEq)]
pub struct MenuItem {
    /// Row id.
    pub id: String,
    /// Owning venue.
    pub venue_id: String,
    /// Item name.
    pub name: String,
    /// Server price in dollars.
    pub price: f64,
    /// Menu grouping.
    pub category: String,
    /// Optional blurb.
    pub description: Option<String>,
    /// Inactive items stay off the fan menu.
    pub active: bool,
    /// Listing order.
    pub sort_order: i64,
}

/// One fan's order. Price is the server total, not the client's.
#[derive(Debug, Clone, PartialEq)]
pub struct FoodOrder {
    /// Row id.
    pub id: String,
    /// Owner. Reads and writes filter on this.
    pub user_id: String,
    /// Venue id.
    pub venue_id: String,
    /// Venue name captured at order time.
    pub venue_name: String,
    /// Menu row, when the order came from the menu.
    pub menu_item_id: Option<String>,
    /// Item name snapshot.
    pub food_type: String,
    /// Quantity.
    pub qty: i64,
    /// `price * qty`, rounded to cents.
    pub total_price: f64,
    /// Section code.
    pub section: String,
    /// Row.
    pub row: String,
    /// Seat.
    pub seat: String,
    /// Level captured from the section.
    pub level: Option<String>,
    /// Zone captured from the section.
    pub zone: Option<String>,
    /// Whether this order is in-seat delivery.
    pub delivery_eligible: bool,
    /// `Cash` or `Card`.
    pub payment_type: String,
    /// `Ordered` for delivery, `Pickup` otherwise.
    pub status: String,
    /// Short confirmation code.
    pub confirm_number: String,
    /// Unix milliseconds.
    pub created_at: i64,
}

/// Inputs for [`place_order`]. Text fields are already trimmed; row and seat are escaped.
pub struct PlaceOrder {
    /// Authenticated user id.
    pub user_id: String,
    /// Venue slug or id.
    pub venue_key: String,
    /// Menu item id.
    pub menu_item_id: String,
    /// Section code as typed.
    pub section_code: String,
    /// Escaped row.
    pub row: String,
    /// Escaped seat.
    pub seat: String,
    /// `Cash` or `Card`.
    pub payment_type: String,
    /// Whole quantity from 1 to 20.
    pub qty: i64,
}

/// Turn a display name into a URL slug. Max 80 characters.
pub fn slugify_venue(name: &str) -> String {
    let trimmed = name.trim().to_lowercase();
    let mut out = String::new();
    let mut dash = false;
    for c in trimmed.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
            dash = false;
        } else if !dash {
            out.push('-');
            dash = true;
        }
    }
    let trimmed = out.trim_matches('-');
    let mut slug = trimmed.to_string();
    if slug.len() > 80 {
        slug.truncate(80);
    }
    slug
}

/// Accept only the three delivery modes.
pub fn parse_delivery_mode(value: &str) -> Option<&'static str> {
    match value {
        "premium" => Some("premium"),
        "all" => Some("all"),
        "pickup_only" => Some("pickup_only"),
        _ => None,
    }
}

/// Round `unit * qty` to cents, matching `Math.round(n * 100) / 100` for positive prices.
pub fn order_total(unit_price: f64, qty: i64) -> f64 {
    (unit_price * qty as f64 * 100.0).round() / 100.0
}

/// In-seat delivery from venue mode and the section flag.
pub fn seat_delivery(mode: &str, section_eligible: bool) -> bool {
    match mode {
        "all" => true,
        "pickup_only" => false,
        _ => section_eligible,
    }
}

/// Parse a quantity the way the Node route did: numbers are floored, then 1..=20.
pub fn parse_qty(value: Option<&Json>) -> Option<i64> {
    let n = match value {
        Some(Json::Num(n)) if n.is_finite() => n.floor(),
        Some(Json::Str(s)) => s.trim().parse::<f64>().ok().filter(|n| n.is_finite())?,
        _ => return None,
    };
    if !(1.0..=20.0).contains(&n) {
        return None;
    }
    let qty = n.floor() as i64;
    if (1..=20).contains(&qty) {
        Some(qty)
    } else {
        None
    }
}

/// Whether `email` may call admin routes.
///
/// Empty `ADMIN_EMAILS` makes every user an admin outside production
/// (`NODE_ENV` and `ENV`). `*` allows everyone. Matching is case-insensitive.
pub fn is_admin_email(email: &str) -> bool {
    let list = crate::config::env("ADMIN_EMAILS").unwrap_or_default();
    let node_env = crate::config::env("NODE_ENV").unwrap_or_default();
    let env_name = crate::config::env("ENV").unwrap_or_default();
    is_admin_email_in(email, &list, &node_env, &env_name)
}

/// Pure form of [`is_admin_email`] so tests do not mutate process env.
pub fn is_admin_email_in(email: &str, admin_emails: &str, node_env: &str, env_name: &str) -> bool {
    let list: Vec<String> = admin_emails
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();
    if list.is_empty() {
        return node_env != "production" && env_name != "production";
    }
    if list.iter().any(|s| s == "*") {
        return true;
    }
    let email = email.trim().to_lowercase();
    list.iter().any(|s| s == &email)
}

fn text_req(row: &Row, col: &str) -> Result<String, DbError> {
    row.text(col)
        .map(str::to_string)
        .ok_or_else(|| DbError::failure(format!("missing column {col}")))
}

fn text_opt(row: &Row, col: &str) -> Option<String> {
    match row.get(col) {
        Some(Value::Text(s)) => Some(s.clone()),
        _ => None,
    }
}

fn flag(row: &Row, col: &str) -> bool {
    match row.get(col) {
        Some(Value::Int(n)) => *n == 1,
        Some(Value::Real(n)) => *n == 1.0,
        _ => false,
    }
}

fn map_venue(row: &Row) -> Result<Venue, DbError> {
    let name = text_req(row, "name")?;
    let mode = row.text("delivery_mode").unwrap_or("pickup_only");
    let delivery_mode = parse_delivery_mode(mode).unwrap_or("pickup_only").to_string();
    Ok(Venue {
        id: text_req(row, "id")?,
        slug: text_req(row, "slug")?,
        short_name: text_opt(row, "short_name").unwrap_or_else(|| name.clone()),
        name,
        city: row.text("city").unwrap_or("").to_string(),
        state: row.text("state").unwrap_or("").to_string(),
        address: row.text("address").unwrap_or("").to_string(),
        capacity: row.number("capacity").map(|n| n as i64),
        timezone: row
            .text("timezone")
            .unwrap_or("America/Los_Angeles")
            .to_string(),
        delivery_mode,
        active: flag(row, "active"),
    })
}

fn map_section(row: &Row) -> Result<VenueSection, DbError> {
    Ok(VenueSection {
        id: text_req(row, "id")?,
        venue_id: text_req(row, "venue_id")?,
        code: text_req(row, "code")?,
        level: text_req(row, "level")?,
        zone: text_req(row, "zone")?,
        row_min: text_opt(row, "row_min"),
        row_max: text_opt(row, "row_max"),
        delivery_eligible: flag(row, "delivery_eligible"),
        notes: text_opt(row, "notes"),
        sort_order: row.number("sort_order").unwrap_or(0.0) as i64,
    })
}

fn map_menu(row: &Row) -> Result<MenuItem, DbError> {
    Ok(MenuItem {
        id: text_req(row, "id")?,
        venue_id: text_req(row, "venue_id")?,
        name: text_req(row, "name")?,
        price: row
            .number("price")
            .ok_or_else(|| DbError::failure("missing column price"))?,
        category: row.text("category").unwrap_or("Other").to_string(),
        description: text_opt(row, "description"),
        active: flag(row, "active"),
        sort_order: row.number("sort_order").unwrap_or(0.0) as i64,
    })
}

fn map_order(row: &Row) -> Result<FoodOrder, DbError> {
    let payment = if row.text("payment_type") == Some("Card") {
        "Card"
    } else {
        "Cash"
    };
    Ok(FoodOrder {
        id: text_req(row, "id")?,
        user_id: text_req(row, "user_id")?,
        venue_id: row.text("venue_id").unwrap_or("").to_string(),
        venue_name: row
            .text("venue_name")
            .or_else(|| row.text("stadium"))
            .unwrap_or("")
            .to_string(),
        menu_item_id: text_opt(row, "menu_item_id"),
        food_type: text_req(row, "food_type")?,
        qty: row
            .number("qty")
            .ok_or_else(|| DbError::failure("missing column qty"))? as i64,
        total_price: row
            .number("total_price")
            .ok_or_else(|| DbError::failure("missing column total_price"))?,
        section: text_req(row, "section")?,
        row: text_req(row, "row")?,
        seat: text_req(row, "seat")?,
        level: text_opt(row, "level"),
        zone: text_opt(row, "zone"),
        delivery_eligible: flag(row, "delivery_eligible"),
        payment_type: payment.to_string(),
        status: text_req(row, "status")?,
        confirm_number: text_req(row, "confirm_number")?,
        created_at: row
            .number("created_at")
            .ok_or_else(|| DbError::failure("missing column created_at"))? as i64,
    })
}

fn one(db: &Db, sql: &str, params: &[Value]) -> Result<Option<Row>, DbError> {
    let mut rows = db.query(sql, params)?;
    if rows.is_empty() {
        Ok(None)
    } else {
        Ok(Some(rows.remove(0)))
    }
}

/// Active venues, alphabetical.
pub fn list_active_venues(db: &Db) -> Result<Vec<Venue>, DbError> {
    list_venues(db, true)
}

/// Every venue, including inactive. Admin list.
pub fn list_all_venues(db: &Db) -> Result<Vec<Venue>, DbError> {
    list_venues(db, false)
}

fn list_venues(db: &Db, active_only: bool) -> Result<Vec<Venue>, DbError> {
    let sql = if active_only {
        "SELECT * FROM Venues WHERE active = 1 ORDER BY name ASC"
    } else {
        "SELECT * FROM Venues ORDER BY name ASC"
    };
    db.query(sql, &[])?
        .iter()
        .map(map_venue)
        .collect()
}

/// Active venue by slug or id.
pub fn find_active_venue(db: &Db, slug_or_id: &str) -> Result<Option<Venue>, DbError> {
    let key = Value::Text(slug_or_id.to_string());
    match one(
        db,
        "SELECT * FROM Venues WHERE (slug = ? OR id = ?) AND active = 1 LIMIT 1",
        &[key.clone(), key],
    )? {
        Some(row) => map_venue(&row).map(Some),
        None => Ok(None),
    }
}

fn venue_by_id(db: &Db, id: &str) -> Result<Option<Venue>, DbError> {
    match one(
        db,
        "SELECT * FROM Venues WHERE id = ? LIMIT 1",
        &[Value::Text(id.to_string())],
    )? {
        Some(row) => map_venue(&row).map(Some),
        None => Ok(None),
    }
}

fn require_active_venue(db: &Db, slug_or_id: &str) -> Result<Venue, FanFail> {
    match find_active_venue(db, slug_or_id)? {
        Some(v) => Ok(v),
        None => Err(http(404, "Venue not found")),
    }
}

/// Fan menu for an active venue, plus the venue (for the `X-Venue` header).
pub fn active_menu(db: &Db, slug: &str) -> Result<(Venue, Vec<MenuItem>), FanFail> {
    let venue = require_active_venue(db, slug)?;
    let items = db
        .query(
            "SELECT * FROM MenuItems WHERE venue_id = ? AND active = 1 ORDER BY sort_order ASC, name ASC",
            &[Value::Text(venue.id.clone())],
        )?
        .iter()
        .map(map_menu)
        .collect::<Result<Vec<_>, _>>()?;
    Ok((venue, items))
}

/// Admin menu, including inactive items.
pub fn admin_menu(db: &Db, venue_id: &str) -> Result<Vec<MenuItem>, DbError> {
    db.query(
        "SELECT * FROM MenuItems WHERE venue_id = ? ORDER BY sort_order ASC, name ASC",
        &[Value::Text(venue_id.to_string())],
    )?
    .iter()
    .map(map_menu)
    .collect()
}

/// Seating list for an active venue.
pub fn active_sections(db: &Db, slug: &str) -> Result<Vec<VenueSection>, FanFail> {
    let venue = require_active_venue(db, slug)?;
    let rows = db.query(
        "SELECT * FROM VenueSections WHERE venue_id = ? ORDER BY sort_order ASC, code ASC",
        &[Value::Text(venue.id)],
    )?;
    rows.iter().map(map_section).collect::<Result<Vec<_>, _>>().map_err(FanFail::from)
}

/// Orders owned by `user_id`, newest first.
pub fn list_orders(db: &Db, user_id: &str) -> Result<Vec<FoodOrder>, DbError> {
    db.query(
        "SELECT * FROM Orders WHERE user_id = ? ORDER BY created_at DESC",
        &[Value::Text(user_id.to_string())],
    )?
    .iter()
    .map(map_order)
    .collect()
}

/// One order owned by `user_id`. Missing and someone else's order are both `None`.
pub fn find_order(db: &Db, id: &str, user_id: &str) -> Result<Option<FoodOrder>, DbError> {
    match one(
        db,
        "SELECT * FROM Orders WHERE id = ? AND user_id = ? LIMIT 1",
        &[Value::Text(id.to_string()), Value::Text(user_id.to_string())],
    )? {
        Some(row) => map_order(&row).map(Some),
        None => Ok(None),
    }
}

fn new_id() -> Result<String, DbError> {
    crate::crypto::random_uuid_v4().map_err(|e| DbError::failure(e.to_string()))
}

fn confirm_number() -> Result<String, DbError> {
    let id = new_id()?;
    let compact: String = id.chars().filter(|c| *c != '-').take(6).collect();
    Ok(format!("FF-{}", compact.to_ascii_uppercase()))
}

/// Place an order. The total comes from the menu row, never from the client.
pub fn place_order(db: &Db, input: &PlaceOrder) -> Result<FoodOrder, FanFail> {
    if input.venue_key.is_empty() {
        return Err(http(400, "Venue is required"));
    }
    if input.menu_item_id.is_empty() {
        return Err(http(400, "Menu item is required"));
    }
    if input.section_code.is_empty() || input.row.is_empty() || input.seat.is_empty() {
        return Err(http(400, "Section, row, and seat are required"));
    }
    if !(1..=20).contains(&input.qty) {
        return Err(http(400, "Quantity must be between 1 and 20"));
    }
    let venue = require_active_venue(db, &input.venue_key)?;
    let menu = match one(
        db,
        "SELECT * FROM MenuItems WHERE id = ? AND venue_id = ? AND active = 1 LIMIT 1",
        &[
            Value::Text(input.menu_item_id.clone()),
            Value::Text(venue.id.clone()),
        ],
    )? {
        Some(row) => map_menu(&row)?,
        None => return Err(http(400, "Unknown menu item for this venue")),
    };
    let section = match one(
        db,
        "SELECT * FROM VenueSections WHERE venue_id = ? AND code = ? LIMIT 1",
        &[
            Value::Text(venue.id.clone()),
            Value::Text(input.section_code.clone()),
        ],
    )? {
        Some(row) => map_section(&row)?,
        None => {
            return Err(http(
                400,
                format!(
                    "Section {} is not valid at {}",
                    input.section_code, venue.name
                ),
            ));
        }
    };
    let deliver = seat_delivery(&venue.delivery_mode, section.delivery_eligible);
    let total = order_total(menu.price, input.qty);
    let id = new_id()?;
    let confirm = confirm_number()?;
    let created_at = crate::config::now_ms();
    let status = if deliver { "Ordered" } else { "Pickup" };
    let section_safe = escape_html(&section.code);
    let payment = if input.payment_type == "Card" { "Card" } else { "Cash" };
    db.run(
        "INSERT INTO Orders (
            id, user_id, venue_id, venue_name, menu_item_id, food_type, qty, total_price,
            section, row, seat, level, zone, delivery_eligible, payment_type, status,
            confirm_number, created_at, stadium
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        &[
            Value::Text(id.clone()),
            Value::Text(input.user_id.clone()),
            Value::Text(venue.id.clone()),
            Value::Text(venue.name.clone()),
            Value::Text(menu.id.clone()),
            Value::Text(menu.name.clone()),
            Value::Int(input.qty),
            Value::Real(total),
            Value::Text(section_safe.clone()),
            Value::Text(input.row.clone()),
            Value::Text(input.seat.clone()),
            Value::Text(section.level.clone()),
            Value::Text(section.zone.clone()),
            Value::Int(if deliver { 1 } else { 0 }),
            Value::Text(payment.to_string()),
            Value::Text(status.to_string()),
            Value::Text(confirm.clone()),
            Value::Int(created_at),
            Value::Text(venue.name.clone()),
        ],
    )?;
    Ok(FoodOrder {
        id,
        user_id: input.user_id.clone(),
        venue_id: venue.id,
        venue_name: venue.name,
        menu_item_id: Some(menu.id),
        food_type: menu.name,
        qty: input.qty,
        total_price: total,
        section: section_safe,
        row: input.row.clone(),
        seat: input.seat.clone(),
        level: Some(section.level),
        zone: Some(section.zone),
        delivery_eligible: deliver,
        payment_type: payment.to_string(),
        status: status.to_string(),
        confirm_number: confirm,
        created_at,
    })
}

fn opt_text(value: Option<&str>) -> Value {
    match value {
        Some(s) => Value::Text(s.to_string()),
        None => Value::Null,
    }
}

fn nonempty<'a>(body: &'a Json, key: &str) -> Option<&'a str> {
    let s = body.get_str(key)?.trim();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

fn bounded_name(raw: &str, label: &str) -> Result<String, FanFail> {
    let name = escape_html(raw.trim());
    if name.is_empty() || validation::utf16_len(&name) > 120 {
        return Err(http(400, format!("{label} is required (max 120)")));
    }
    Ok(name)
}

fn parse_capacity(value: &Json) -> Result<Option<i64>, FanFail> {
    match value {
        Json::Null => Ok(None),
        Json::Str(s) if s.trim().is_empty() => Ok(None),
        Json::Num(n) if n.is_finite() && *n >= 0.0 => Ok(Some(*n as i64)),
        Json::Str(s) => {
            let n: f64 = s.trim().parse().unwrap_or(f64::NAN);
            if n.is_finite() && n >= 0.0 {
                Ok(Some(n as i64))
            } else {
                Err(http(400, "Invalid capacity"))
            }
        }
        _ => Err(http(400, "Invalid capacity")),
    }
}

fn flag_on(value: &Json) -> bool {
    match value {
        Json::Bool(false) => false,
        Json::Num(n) if *n == 0.0 => false,
        _ => true,
    }
}

fn is_truthy_one(value: Option<&Json>) -> bool {
    match value {
        Some(Json::Bool(true)) => true,
        Some(Json::Num(n)) if *n == 1.0 => true,
        _ => false,
    }
}

fn sort_value(value: Option<&Json>, default: i64) -> i64 {
    match value {
        Some(Json::Num(n)) if n.is_finite() => *n as i64,
        Some(Json::Str(s)) => s
            .trim()
            .parse::<f64>()
            .ok()
            .filter(|n| n.is_finite())
            .map(|n| n as i64)
            .unwrap_or(default),
        _ => default,
    }
}

fn parse_price(value: &Json) -> Result<f64, FanFail> {
    let n = match value {
        Json::Num(n) => *n,
        Json::Str(s) => s.trim().parse().unwrap_or(f64::NAN),
        _ => f64::NAN,
    };
    if n.is_finite() && (0.0..=1000.0).contains(&n) {
        Ok(n)
    } else {
        Err(http(400, "Invalid price"))
    }
}

/// Create a venue. Slug collisions get a short suffix from the new id.
pub fn create_venue(db: &Db, body: &Json) -> Result<Venue, FanFail> {
    let name_raw = body.get_str("name").unwrap_or("");
    let name = bounded_name(name_raw, "Name")?;
    let short_name = match nonempty(body, "shortName") {
        Some(s) => escape_html(s),
        None => name.clone(),
    };
    let city = escape_html(nonempty(body, "city").unwrap_or(""));
    let state = escape_html(nonempty(body, "state").unwrap_or(""));
    let address = escape_html(nonempty(body, "address").unwrap_or(""));
    if city.is_empty() || state.is_empty() || address.is_empty() {
        return Err(http(400, "City, state, and address are required"));
    }
    // Slug comes from the raw name, not the HTML-escaped form (`&` would become `amp`).
    let mut slug = match nonempty(body, "slug") {
        Some(s) => slugify_venue(s),
        None => slugify_venue(name_raw),
    };
    if slug.is_empty() {
        return Err(http(400, "Invalid slug"));
    }
    let mode = body
        .get_str("deliveryMode")
        .and_then(parse_delivery_mode)
        .unwrap_or("pickup_only");
    let capacity = match body.get("capacity") {
        None | Some(Json::Null) => None,
        Some(v) => parse_capacity(v)?,
    };
    let timezone = nonempty(body, "timezone").unwrap_or("America/Los_Angeles");
    let active = match body.get("active") {
        Some(v) => flag_on(v),
        None => true,
    };
    let id = new_id()?;
    let taken = one(
        db,
        "SELECT id FROM Venues WHERE slug = ? LIMIT 1",
        &[Value::Text(slug.clone())],
    )?;
    if taken.is_some() {
        let suffix = id.get(..6).unwrap_or(&id);
        slug = format!("{slug}-{suffix}");
    }
    let now = crate::config::now_ms();
    db.run(
        "INSERT INTO Venues (
            id, slug, name, short_name, city, state, address, capacity, timezone,
            delivery_mode, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        &[
            Value::Text(id.clone()),
            Value::Text(slug),
            Value::Text(name),
            Value::Text(short_name),
            Value::Text(city),
            Value::Text(state),
            Value::Text(address),
            match capacity {
                Some(n) => Value::Int(n),
                None => Value::Null,
            },
            Value::Text(timezone.to_string()),
            Value::Text(mode.to_string()),
            Value::Int(if active { 1 } else { 0 }),
            Value::Int(now),
        ],
    )
    .map_err(|e| {
        if e.message.contains("UNIQUE") {
            http(500, "Failed to create venue")
        } else {
            FanFail::Db(e)
        }
    })?;
    venue_by_id(db, &id)?.ok_or_else(|| http(500, "Created but not found"))
}

/// Update a venue. Omitted fields stay as stored.
pub fn update_venue(db: &Db, id: &str, body: &Json) -> Result<Venue, FanFail> {
    let cur = venue_by_id(db, id)?.ok_or_else(|| http(404, "Venue not found"))?;
    let name = match nonempty(body, "name") {
        Some(s) => bounded_name(s, "Name")?,
        None => cur.name.clone(),
    };
    let short_name = match nonempty(body, "shortName") {
        Some(s) => escape_html(s),
        None => cur.short_name.clone(),
    };
    let city = match nonempty(body, "city") {
        Some(s) => escape_html(s),
        None => cur.city.clone(),
    };
    let state = match nonempty(body, "state") {
        Some(s) => escape_html(s),
        None => cur.state.clone(),
    };
    let address = match nonempty(body, "address") {
        Some(s) => escape_html(s),
        None => cur.address.clone(),
    };
    let mode = body
        .get_str("deliveryMode")
        .and_then(parse_delivery_mode)
        .unwrap_or(parse_delivery_mode(&cur.delivery_mode).unwrap_or("pickup_only"));
    let timezone = nonempty(body, "timezone").unwrap_or(cur.timezone.as_str());
    let capacity = match body.get("capacity") {
        None => cur.capacity,
        Some(v) => parse_capacity(v)?,
    };
    let active = match body.get("active") {
        None => cur.active,
        Some(v) => flag_on(v),
    };
    db.run(
        "UPDATE Venues SET name = ?, short_name = ?, city = ?, state = ?, address = ?,
            capacity = ?, timezone = ?, delivery_mode = ?, active = ? WHERE id = ?",
        &[
            Value::Text(name),
            Value::Text(short_name),
            Value::Text(city),
            Value::Text(state),
            Value::Text(address),
            match capacity {
                Some(n) => Value::Int(n),
                None => Value::Null,
            },
            Value::Text(timezone.to_string()),
            Value::Text(mode.to_string()),
            Value::Int(if active { 1 } else { 0 }),
            Value::Text(id.to_string()),
        ],
    )?;
    venue_by_id(db, id)?.ok_or_else(|| http(404, "Venue not found"))
}

fn venue_exists(db: &Db, id: &str) -> Result<bool, DbError> {
    Ok(one(
        db,
        "SELECT id FROM Venues WHERE id = ? LIMIT 1",
        &[Value::Text(id.to_string())],
    )?
    .is_some())
}

/// Add an active menu item.
pub fn create_menu_item(db: &Db, venue_id: &str, body: &Json) -> Result<MenuItem, FanFail> {
    if !venue_exists(db, venue_id)? {
        return Err(http(404, "Venue not found"));
    }
    let name = bounded_name(body.get_str("name").unwrap_or(""), "Name")
        .map_err(|_| http(400, "Name is required"))?;
    let price = parse_price(body.get("price").unwrap_or(&Json::Null))?;
    let category = match nonempty(body, "category") {
        Some(s) => escape_html(s),
        None => "Other".to_string(),
    };
    let description = body.get_str("description").map(|s| escape_html(s.trim()));
    let sort_order = sort_value(body.get("sortOrder"), 0);
    let id = new_id()?;
    db.run(
        "INSERT INTO MenuItems (
            id, venue_id, name, price, category, description, active, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
        &[
            Value::Text(id.clone()),
            Value::Text(venue_id.to_string()),
            Value::Text(name),
            Value::Real(price),
            Value::Text(category),
            opt_text(description.as_deref()),
            Value::Int(sort_order),
        ],
    )?;
    let row = one(
        db,
        "SELECT * FROM MenuItems WHERE id = ? LIMIT 1",
        &[Value::Text(id)],
    )?
    .ok_or_else(|| http(500, "Created but not found"))?;
    Ok(map_menu(&row)?)
}

/// Update or deactivate a menu item.
pub fn update_menu_item(db: &Db, id: &str, body: &Json) -> Result<MenuItem, FanFail> {
    let cur = match one(
        db,
        "SELECT * FROM MenuItems WHERE id = ? LIMIT 1",
        &[Value::Text(id.to_string())],
    )? {
        Some(row) => map_menu(&row)?,
        None => return Err(http(404, "Menu item not found")),
    };
    let name = match nonempty(body, "name") {
        Some(s) => escape_html(s),
        None => cur.name.clone(),
    };
    if name.is_empty() {
        return Err(http(400, "Name is required"));
    }
    let price = match body.get("price") {
        Some(v) => parse_price(v)?,
        None => cur.price,
    };
    let category = match nonempty(body, "category") {
        Some(s) => escape_html(s),
        None => cur.category.clone(),
    };
    let description = match body.get("description") {
        None => cur.description.clone(),
        Some(Json::Str(s)) => Some(escape_html(s.trim())),
        Some(_) => None,
    };
    let active = match body.get("active") {
        None => cur.active,
        Some(v) => flag_on(v),
    };
    let sort_order = if body.get("sortOrder").is_some() {
        sort_value(body.get("sortOrder"), cur.sort_order)
    } else {
        cur.sort_order
    };
    db.run(
        "UPDATE MenuItems SET name = ?, price = ?, category = ?, description = ?,
            active = ?, sort_order = ? WHERE id = ?",
        &[
            Value::Text(name),
            Value::Real(price),
            Value::Text(category),
            opt_text(description.as_deref()),
            Value::Int(if active { 1 } else { 0 }),
            Value::Int(sort_order),
            Value::Text(id.to_string()),
        ],
    )?;
    let row = one(
        db,
        "SELECT * FROM MenuItems WHERE id = ? LIMIT 1",
        &[Value::Text(id.to_string())],
    )?
    .ok_or_else(|| http(404, "Not found"))?;
    Ok(map_menu(&row)?)
}

/// Add a section. A duplicate code for the venue is 409.
pub fn create_section(db: &Db, venue_id: &str, body: &Json) -> Result<VenueSection, FanFail> {
    if !venue_exists(db, venue_id)? {
        return Err(http(404, "Venue not found"));
    }
    let code = escape_html(body.get_str("code").unwrap_or("").trim());
    if code.is_empty() || validation::utf16_len(&code) > 20 {
        return Err(http(400, "Section code required"));
    }
    let level = nonempty(body, "level").unwrap_or("field");
    let zone = nonempty(body, "zone").unwrap_or("field_box");
    let row_min = nonempty(body, "rowMin").map(escape_html);
    let row_max = nonempty(body, "rowMax").map(escape_html);
    let delivery = is_truthy_one(body.get("deliveryEligible"));
    let notes = body.get_str("notes").map(|s| escape_html(s.trim()));
    let sort_order = sort_value(body.get("sortOrder"), 0);
    let id = new_id()?;
    if let Err(e) = db.run(
        "INSERT INTO VenueSections (
            id, venue_id, code, level, zone, row_min, row_max, delivery_eligible, notes, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        &[
            Value::Text(id.clone()),
            Value::Text(venue_id.to_string()),
            Value::Text(code),
            Value::Text(level.to_string()),
            Value::Text(zone.to_string()),
            opt_text(row_min.as_deref()),
            opt_text(row_max.as_deref()),
            Value::Int(if delivery { 1 } else { 0 }),
            opt_text(notes.as_deref()),
            Value::Int(sort_order),
        ],
    ) {
        if e.message.contains("UNIQUE") {
            return Err(http(409, "Section code already exists for this venue"));
        }
        return Err(FanFail::Db(e));
    }
    let row = one(
        db,
        "SELECT * FROM VenueSections WHERE id = ? LIMIT 1",
        &[Value::Text(id)],
    )?
    .ok_or_else(|| http(500, "Created but not found"))?;
    Ok(map_section(&row)?)
}

/// Update a section.
pub fn update_section(db: &Db, id: &str, body: &Json) -> Result<VenueSection, FanFail> {
    let cur = match one(
        db,
        "SELECT * FROM VenueSections WHERE id = ? LIMIT 1",
        &[Value::Text(id.to_string())],
    )? {
        Some(row) => map_section(&row)?,
        None => return Err(http(404, "Section not found")),
    };
    let code = match nonempty(body, "code") {
        Some(s) => escape_html(s),
        None => cur.code.clone(),
    };
    let level = match nonempty(body, "level") {
        Some(s) => s.to_string(),
        None => cur.level.clone(),
    };
    let zone = match nonempty(body, "zone") {
        Some(s) => s.to_string(),
        None => cur.zone.clone(),
    };
    let row_min = match body.get("rowMin") {
        None => cur.row_min.clone(),
        Some(Json::Str(s)) => Some(escape_html(s.trim())),
        Some(_) => None,
    };
    let row_max = match body.get("rowMax") {
        None => cur.row_max.clone(),
        Some(Json::Str(s)) => Some(escape_html(s.trim())),
        Some(_) => None,
    };
    let delivery = match body.get("deliveryEligible") {
        None => cur.delivery_eligible,
        Some(_) => is_truthy_one(body.get("deliveryEligible")),
    };
    let notes = match body.get("notes") {
        None => cur.notes.clone(),
        Some(Json::Str(s)) => Some(escape_html(s.trim())),
        Some(_) => None,
    };
    let sort_order = if body.get("sortOrder").is_some() {
        sort_value(body.get("sortOrder"), cur.sort_order)
    } else {
        cur.sort_order
    };
    db.run(
        "UPDATE VenueSections SET code = ?, level = ?, zone = ?, row_min = ?, row_max = ?,
            delivery_eligible = ?, notes = ?, sort_order = ? WHERE id = ?",
        &[
            Value::Text(code),
            Value::Text(level),
            Value::Text(zone),
            opt_text(row_min.as_deref()),
            opt_text(row_max.as_deref()),
            Value::Int(if delivery { 1 } else { 0 }),
            opt_text(notes.as_deref()),
            Value::Int(sort_order),
            Value::Text(id.to_string()),
        ],
    )?;
    let row = one(
        db,
        "SELECT * FROM VenueSections WHERE id = ? LIMIT 1",
        &[Value::Text(id.to_string())],
    )?
    .ok_or_else(|| http(404, "Not found"))?;
    Ok(map_section(&row)?)
}

/// Insert Oracle Park the first time the venues table is empty.
pub(crate) fn seed_if_empty(db: &Db) -> Result<(), DbError> {
    let existing = db.query("SELECT id FROM Venues LIMIT 1", &[])?;
    if !existing.is_empty() {
        return Ok(());
    }
    db.exec("BEGIN IMMEDIATE")?;
    match seed_oracle_park(db).and_then(|_| db.exec("COMMIT")) {
        Ok(()) => Ok(()),
        Err(e) => {
            let _ = db.exec("ROLLBACK");
            Err(e)
        }
    }
}

struct SeedSection {
    code: String,
    level: &'static str,
    zone: &'static str,
    row_min: &'static str,
    row_max: &'static str,
    delivery: i64,
    notes: String,
}

fn push_range(
    out: &mut Vec<SeedSection>,
    start: i32,
    end: i32,
    level: &'static str,
    zone: &'static str,
    row_min: &'static str,
    row_max: &'static str,
    delivery: i64,
    notes: impl Fn(i32) -> String,
) {
    for n in start..=end {
        out.push(SeedSection {
            code: n.to_string(),
            level,
            zone,
            row_min,
            row_max,
            delivery,
            notes: notes(n),
        });
    }
}

fn seed_oracle_park(db: &Db) -> Result<(), DbError> {
    let venue_id = new_id()?;
    let now = crate::config::now_ms();
    db.run(
        "INSERT INTO Venues (
            id, slug, name, short_name, city, state, address, capacity, timezone,
            delivery_mode, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
        &[
            Value::Text(venue_id.clone()),
            Value::Text("oracle-park".into()),
            Value::Text("Oracle Park".into()),
            Value::Text("Oracle Park".into()),
            Value::Text("San Francisco".into()),
            Value::Text("CA".into()),
            Value::Text("24 Willie Mays Plaza, San Francisco, CA 94107".into()),
            Value::Int(41265),
            Value::Text("America/Los_Angeles".into()),
            Value::Text("premium".into()),
            Value::Int(now),
        ],
    )?;

    let mut sections = Vec::new();
    push_range(
        &mut sections,
        101,
        106,
        "field",
        "field_box",
        "1",
        "41",
        0,
        |_| "Right-field line field boxes".into(),
    );
    let club = "Field Club (A\u{2013}R) + field boxes (~23\u{2013}43). Delivery for Field Club / Diamond / Dugout.";
    push_range(
        &mut sections,
        107,
        124,
        "field",
        "field_club",
        "A",
        "43",
        1,
        |n| {
            let mut notes = club.to_string();
            if n == 122 || n == 123 {
                notes.push_str(" Giants dugout.");
            }
            if n == 108 || n == 109 {
                notes.push_str(" Visitor dugout.");
            }
            notes
        },
    );
    push_range(
        &mut sections,
        125,
        135,
        "field",
        "field_box",
        "1",
        "41",
        0,
        |_| "Left-field line field boxes; netting through 135".into(),
    );
    push_range(
        &mut sections,
        136,
        144,
        "field",
        "bleachers",
        "1",
        "40",
        0,
        |n| {
            if n == 144 {
                "Bleachers; overlooks bullpen; benches".into()
            } else {
                "Bleachers; benches; near Fan Lot".into()
            }
        },
    );
    push_range(
        &mut sections,
        145,
        152,
        "field",
        "arcade",
        "1",
        "3",
        0,
        |_| "Arcade over RF wall; McCovey Cove behind; mostly 3 rows + SRO".into(),
    );
    push_range(&mut sections, 202, 234, "club", "club", "A", "M", 0, |n| {
        if (230..=232).contains(&n) {
            "Alaska Airlines Club; patio tables in 230\u{2013}232".into()
        } else {
            "Alaska Airlines Club Level; indoor concourse".into()
        }
    });
    push_range(
        &mut sections,
        302,
        336,
        "view",
        "view_box",
        "A",
        "19",
        0,
        |n| {
            if n <= 305 {
                "View level; Bay Bridge views from RF upper".into()
            } else if n >= 330 {
                "Deep left-field view; farther from action".into()
            } else {
                "View Boxes (letter rows) / View Reserve (number rows)".into()
            }
        },
    );
    // 321+ is view_reserve, matching the Node seed (`n <= 320 ? view_box : view_reserve`).
    for section in &mut sections {
        if section.level == "view" {
            if let Ok(n) = section.code.parse::<i32>() {
                if n > 320 {
                    section.zone = "view_reserve";
                }
            }
        }
    }

    for (index, section) in sections.iter().enumerate() {
        db.run(
            "INSERT INTO VenueSections (
                id, venue_id, code, level, zone, row_min, row_max, delivery_eligible, notes, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            &[
                Value::Text(new_id()?),
                Value::Text(venue_id.clone()),
                Value::Text(section.code.clone()),
                Value::Text(section.level.into()),
                Value::Text(section.zone.into()),
                Value::Text(section.row_min.into()),
                Value::Text(section.row_max.into()),
                Value::Int(section.delivery),
                Value::Text(section.notes.clone()),
                Value::Int((index as i64) + 1),
            ],
        )?;
    }

    let menu: &[(&str, f64, &str, &str)] = &[
        ("Garlic Fries", 12.5, "Classics", "Oracle Park staple \u{2014} fries with garlic & parsley"),
        ("Gilroy Garlic Fries", 12.5, "Classics", "Signature garlic fries"),
        ("Hot Dog", 8.5, "Classics", "Ballpark dog"),
        ("Char Siu Dog", 14.0, "Classics", "Foot-long with char siu glaze, Kewpie, fried onions (Doggie Diner)"),
        ("Crab Sandwich", 28.0, "Seafood", "Dungeness crab on garlic sourdough (Crazy Crab\u{2019}z)"),
        ("Clam Chowder Bread Bowl", 16.5, "Seafood", "Sourdough bowl of clam chowder"),
        ("Helmet Nachos", 18.0, "Mexican", "Souvenir helmet nachos \u{2014} carne asada or pollo"),
        ("Birria Grilled Cheese", 17.0, "Mexican", "Sourdough griddled in consomm\u{e9} with braised birria (SF Selects)"),
        ("Lumpia (Bacon Cheeseburger)", 15.0, "Local", "The Lumpia Company \u{2014} Moo Moo sauce"),
        ("Spicy Ahi Poke Bowl", 19.0, "Local", "Da Poke-Man \u{2014} rice or greens"),
        ("Pacific Eats Rice Bowl", 16.0, "Local", "Bulgogi, chicken, or tofu rice bowl"),
        ("Ghirardelli Sundae", 12.0, "Dessert", "Hot fudge sundae with Ghirardelli chocolate"),
        ("Beer", 14.0, "Drinks", "Domestic draft"),
        ("Soft Drink", 6.5, "Drinks", "Fountain soda"),
    ];
    for (index, item) in menu.iter().enumerate() {
        db.run(
            "INSERT INTO MenuItems (
                id, venue_id, name, price, category, description, active, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
            &[
                Value::Text(new_id()?),
                Value::Text(venue_id.clone()),
                Value::Text(item.0.into()),
                Value::Real(item.1),
                Value::Text(item.2.into()),
                Value::Text(item.3.into()),
                Value::Int((index as i64) + 1),
            ],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Pool;

    #[test]
    fn slugify_collapses_punctuation_and_caps_length() {
        assert_eq!(slugify_venue("  Oracle Park!! "), "oracle-park");
        assert_eq!(slugify_venue("--Hi--"), "hi");
        assert_eq!(slugify_venue("   "), "");
        let long = "a".repeat(100);
        assert_eq!(slugify_venue(&long).len(), 80);
    }

    #[test]
    fn totals_round_to_cents() {
        assert_eq!(order_total(12.5, 2), 25.0);
        assert_eq!(order_total(8.5, 3), 25.5);
        assert_eq!(order_total(6.5, 1), 6.5);
    }

    #[test]
    fn delivery_follows_venue_mode() {
        assert!(seat_delivery("all", false));
        assert!(!seat_delivery("pickup_only", true));
        assert!(seat_delivery("premium", true));
        assert!(!seat_delivery("premium", false));
    }

    #[test]
    fn admin_list_is_case_insensitive_and_open_in_dev() {
        assert!(is_admin_email_in("Ada@Example.com", "", "development", ""));
        assert!(!is_admin_email_in("ada@example.com", "", "production", ""));
        assert!(!is_admin_email_in("ada@example.com", "", "", "production"));
        assert!(is_admin_email_in("Ada@Example.com", "ada@example.com, other@x.com", "production", ""));
        assert!(!is_admin_email_in("nope@example.com", "ada@example.com", "production", ""));
        assert!(is_admin_email_in("anyone@example.com", "*", "production", "production"));
    }

    #[test]
    fn qty_accepts_one_through_twenty() {
        assert_eq!(parse_qty(Some(&Json::Num(2.9))), Some(2));
        assert_eq!(parse_qty(Some(&Json::Num(0.4))), None);
        assert_eq!(parse_qty(Some(&Json::Num(21.0))), None);
        assert_eq!(parse_qty(Some(&Json::Str("3".into()))), Some(3));
    }

    #[test]
    fn oracle_park_seeds_once() {
        let dir = std::env::temp_dir().join(format!(
            "ff-seed-{}-{}",
            std::process::id(),
            crate::config::now_ms()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("FanFood.db").to_string_lossy().into_owned();
        {
            let pool = Pool::open(&path, 1).unwrap();
            let venues = pool
                .with(|db| db.query("SELECT COUNT(*) AS n FROM Venues", &[]))
                .unwrap();
            assert_eq!(venues[0].int("n"), Some(1));
            let sections = pool
                .with(|db| db.query("SELECT COUNT(*) AS n FROM VenueSections", &[]))
                .unwrap();
            assert_eq!(sections[0].int("n"), Some(120));
            let eligible = pool
                .with(|db| {
                    db.query(
                        "SELECT delivery_eligible FROM VenueSections WHERE code = '122'",
                        &[],
                    )
                })
                .unwrap();
            assert_eq!(eligible[0].int("delivery_eligible"), Some(1));
            let boxes = pool
                .with(|db| {
                    db.query(
                        "SELECT delivery_eligible FROM VenueSections WHERE code = '101'",
                        &[],
                    )
                })
                .unwrap();
            assert_eq!(boxes[0].int("delivery_eligible"), Some(0));
        }
        {
            let pool = Pool::open(&path, 1).unwrap();
            let venues = pool
                .with(|db| db.query("SELECT COUNT(*) AS n FROM Venues", &[]))
                .unwrap();
            assert_eq!(venues[0].int("n"), Some(1));
            let menu = pool
                .with(|db| db.query("SELECT COUNT(*) AS n FROM MenuItems", &[]))
                .unwrap();
            assert_eq!(menu[0].int("n"), Some(14));
        }
        let _ = std::fs::remove_dir_all(&dir);
    }
}
