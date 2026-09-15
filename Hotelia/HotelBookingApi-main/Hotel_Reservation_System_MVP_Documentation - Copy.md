# Hotel Reservation System
## Team Project Documentation (MVP Scope — 8 Days)

---

## 1. Project Summary

We are building a **Hotel Reservation System**: a web application where users can search hotels, view rooms and availability, submit booking requests, and track their status — while admins manage hotels, rooms, availability, and confirm or reject reservations.

**Scope decision:** We are building the **core/proposed version**, not the full business-analytics version. No Stripe payments, no refund processing, no notification system, no full analytics suite. This is a deliberate scoping choice for an 8-day timeline — a complete, polished simple system beats a half-finished ambitious one.

**Stack:**

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Bootstrap, JavaScript |
| Backend | ASP.NET Core Web API (.NET) |
| Database | SQL Server |
| Auth | JWT-based authentication |
| Architecture | Frontend → REST API → Database |

**Payments note:** Deliberately excluded from MVP but designed to bolt on later without rework — `Booking` and `Payment` will remain conceptually separate from day one, even though only `Booking` gets built now. If time allows, Stripe Test Mode can be added post-MVP without touching the core booking flow.

---

## 2. User Roles

- **User** — registers/logs in, searches hotels, views details, submits a booking request, views booking status, cancels confirmed bookings, optionally reviews after a completed stay.
- **Admin** — manages hotels/room types/inventory, views all reservations, confirms/rejects/cancels bookings.
- **Receptionist (optional, only if time allows)** — confirms/rejects bookings for assigned hotel only. Cannot manage hotels/rooms.

---

## 3. Core Reservation Flow

```
Register/Login → Search hotel (city + dates) → View hotel details
→ Select room → Submit booking request → Booking = PENDING
→ Admin reviews →  CONFIRM → Booking = CONFIRMED, availability updated
              →  REJECT  → Booking = REJECTED, user notified via status

User cancels CONFIRMED booking → Booking = CANCELLED → availability restored
After check-out date passes → Booking = COMPLETED
```

No payment step in this version — booking goes straight from request to admin decision. Keep this flow in mind for schema, API, and UI — it's the whole app.

---

## 4. Data Models (MVP)

- **User**: id, name, email, password_hash, role (ADMIN | USER), created_at
- **Hotel**: id, name, city, address, description, stars, thumbnail_url, created_at
- **RoomType**: id, hotel_id, name, capacity, bed_type, base_price, description
- **RoomInventory**: id, room_type_id, date, total_rooms, sold_rooms
- **Booking**: id, user_id, hotel_id, room_type_id, check_in, check_out, nights, total_price, status (PENDING | CONFIRMED | REJECTED | CANCELLED | COMPLETED), created_at
- **Review** (optional, only if time permits): id, user_id, hotel_id, rating, comment, created_at

No `Payment` or `Refund` tables in the MVP.

---

## 5. Team Structure & Task Splitting (8 Days)

Given the compressed timeline, ownership is tighter and parallelism starts almost immediately — backend defines the API contract on Day 1-2 so frontend and admin can build against it without waiting.

### Member 1 — Backend & Database
- SQL Server schema + EF Core migrations (User, Hotel, RoomType, RoomInventory, Booking)
- JWT auth + role-based authorization
- Hotels & Room Types endpoints (CRUD)
- Availability endpoint + double-booking prevention logic
- Bookings endpoints: create, cancel, list (user + admin)
- Admin confirm/reject endpoints

### Member 2 — Frontend (User Side)
- Home/search page (city + check-in/check-out)
- Hotel details page (rooms, prices, availability)
- Booking request page/flow
- My Bookings page (status display, cancel button)
- Login/register pages
- Responsive layout (Bootstrap)

### Member 3 — Admin Frontend & Integration
- Admin login + dashboard shell
- Hotel management UI (add/edit/delete)
- Room type management UI
- Inventory management UI (set room counts)
- Reservation management UI (pending list, confirm/reject, cancel)
- Frontend↔API integration support for Member 2 where needed
- End-to-end testing, demo data seeding, bug triage

### Shared
- Agree on API contract (endpoint shapes) before backend locks anything in — do this on Day 1.
- Everyone tests the full flow together before the demo, not just their own piece.

---

## 6. 8-Day Timeline

| Day | Focus | Owner(s) |
|---|---|---|
| 1 | Schema design, API contract agreement, auth setup | Member 1 (all review) |
| 2 | Auth endpoints + login/register UI; Hotel/RoomType CRUD backend | Member 1, Member 2 |
| 3 | Availability logic; Hotel search + details UI | Member 1, Member 2 |
| 4 | Booking create/cancel endpoints; Booking UI + My Bookings | Member 1, Member 2 |
| 5 | Admin dashboard shell, hotel/room/inventory management UI | Member 3 |
| 6 | Admin confirm/reject endpoints + UI; double-booking edge cases | Member 1, Member 3 |
| 7 | Full integration pass, bug fixes, seed demo data | All |
| 8 | Final testing, polish, prepare demo/presentation | All |

Buffer is intentionally thin — if a task slips, cut scope (e.g., drop Reviews) rather than cut testing time on Day 7-8.

---

## 7. Project Rules

### 7.1 Git & Workflow
- `main` stays demo-ready at all times.
- Feature branches per task (e.g., `feature/booking-create`, `feature/admin-hotels`).
- PR review by at least one other member before merging — with 8 days, review fast but don't skip it; broken `main` costs more time than it saves.

### 7.2 API Contract Discipline
- Lock the endpoint list and payload shapes on Day 1 (use Section "API Structure" below as the base). Any change gets flagged to the other two immediately — frontend and admin UI both depend on it directly.

### 7.3 Database Rules
- Migrations only through EF Core, no manual schema drift.
- Booking status is a fixed enum (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`) — don't invent ad hoc states.
- Availability = `total_rooms - sold_rooms`; must be checked before confirming a booking to prevent double booking.

### 7.4 Security Rules (non-negotiable even under time pressure)
- Passwords hashed, never stored plain.
- JWT + role-based authorization on every protected endpoint; admin endpoints reject normal users.
- Validate/sanitize all input server-side.

### 7.5 Scope Discipline
- MVP checklist (Section 8 below) is the definition of "done." Anything beyond it is bonus, not a blocker.
- If behind schedule by Day 5, cut the optional items first (Reviews, Receptionist role) before touching core booking/admin flow.
- Do not start Stripe/payments integration unless the full MVP checklist is done and tested, with real days left over.

### 7.6 Communication
- Raise blockers immediately — with only 8 days, a half-day stall on one person stalls the other two.
- Quick daily check-in (even 10 min async in chat) on what's done / what's blocked.

---

## 8. MVP Scope Checklist (Definition of Done)

- [ ] Auth: register, login, JWT, role-based access
- [ ] Hotel search by city + dates
- [ ] Hotel details page (rooms, prices, availability)
- [ ] Booking request creation → PENDING
- [ ] Admin: confirm/reject bookings
- [ ] Availability tracking + double-booking prevention
- [ ] User: cancel confirmed booking, availability restored
- [ ] My Bookings page with status
- [ ] Admin: hotel/room/inventory management (CRUD)
- [ ] Responsive UI (Bootstrap)

**Bonus if time remains (in priority order):**
1. Payments (Stripe Test Mode) — bolt-on, add after MVP is fully working
2. Reviews & ratings
3. Simple analytics (booking counts, revenue by hotel — 1-2 charts)
4. Receptionist role

---

## 9. API Structure (MVP)

```http
POST /api/auth/register
POST /api/auth/login

GET  /api/hotels
GET  /api/hotels/{id}
POST /api/admin/hotels
PUT  /api/admin/hotels/{id}
DELETE /api/admin/hotels/{id}

POST /api/admin/hotels/{id}/room-types
PUT  /api/admin/room-types/{id}
DELETE /api/admin/room-types/{id}

GET  /api/room-types/{id}/availability?from=...&to=...
PUT  /api/admin/room-inventory

POST  /api/bookings
GET   /api/me/bookings
PATCH /api/bookings/{id}/cancel

GET   /api/admin/bookings?status=PENDING
PATCH /api/admin/bookings/{id}/confirm
PATCH /api/admin/bookings/{id}/reject
```
