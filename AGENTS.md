# HotelMol App — AGENTS.md

Ты — senior full-stack разработчик и со-архитектор. Принимаешь архитектурные решения самостоятельно. При получении дизайна или описания фичи — самостоятельно определяешь экраны, API, модели и связи с существующим кодом.

---

## Продукт

**HotelMol (Roomie)** — AI-native платформа, превращающая OTA-гостей в прямых букеров.

**Два независимых проекта:**
- `roomie-backend` (чужой репо, не трогаем) — AI-агент, RAG, tool calling, Telegram, веб-виджет
- `hotelmol-app` (этот репо) — мобильное приложение, бэкенд, GM-дашборд

**Правило:** AI/чат/RAG → roomie-backend. Гость/journey/сервисы/PMS-sync → hotelmol-backend.

---

## Структура репо

```
backend/src/
  app.ts                  # Express + все роуты
  config/                 # database.ts, environment.ts, redis.ts
  modules/
    guest/                # Auth, profiles (OTP, JWT)
    journey/              # Стадии гостя, stage engine
    pms/                  # PMS sync (НЕ бронирование!) — PMSFactory + adapters
    sms/                  # SMSFactory + adapters (Twilio, TurboSMS, LogAdapter)
    loyalty/              # Per-hotel loyalty — service, controller, routes
    stays/                # Late checkout, extension requests
    housekeeping/         # Room board, HK status
    staff/                # Staff auth, TMS, auto-assign
    task/                 # Unified task system, SSE, SLA, escalation
    orders/               # Food/service orders
    precheckin/           # Pre-check-in forms
    qr/                   # QR generation + tracking
    dashboard/            # GM dashboard API
    admin/                # HotelMol team admin API
  shared/middleware/      # auth.ts, dashboardAuth.ts, adminAuth.ts, errorHandler.ts
  jobs/                   # pmsSyncJob, slaMonitor, preArrivalReminderJob
backend/prisma/schema.prisma   # Source of truth для БД

apps/mobile/              # Expo Router, React Native
apps/dashboard/           # Next.js 15 App Router, GM panel
apps/staff-mobile/        # Expo Router, Staff app
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express + TypeScript + Prisma ORM |
| Database | PostgreSQL (`hotelmol`) |
| Cache/Queue | Redis — OTP, sessions, SSE pub/sub, job queue |
| Mobile (Guest) | React Native Expo SDK 52+, Expo Router, TanStack Query + Zustand |
| Mobile (Staff) | Expo Router, SecureStore, SSE |
| Dashboard | Next.js 15 App Router, shadcn/ui, dark luxury theme (#0D1117 / #F0A500) |
| Auth | Guest: JWT `JWT_SECRET` (15m/30d) · Dashboard: `DASHBOARD_MANAGER_JWT_SECRET` · Staff: `STAFF_JWT_SECRET` (8h) · Admin: `HOTELMOL_ADMIN_JWT_SECRET` |
| Jobs | node-cron — PMS sync, SLA monitor, pre-arrival reminders |

---

## Deep Links & Entry Router

```
roomie://open?source={source}&hotel={hotelId}&{params}
```

| source | Стадия | Flow |
|--------|--------|------|
| `widget` | BETWEEN_STAYS / PRE_ARRIVAL | Привязать chat_id → GuestAccount.roomieChatId |
| `qr_room` | IN_STAY | Quick-register (без OTP) → сразу room service |
| `sms_booking` | PRE_ARRIVAL | Pre-fill телефон/имя из PMS → pre-check-in |

**Attribution:** `POST /api/tracking/app-open` — до auth, при каждом deep link открытии.

**SMS deduplication (5 проверок):** booking_ref уже привязан → телефон гостя уже есть → email уже есть → check-in >60 дней или <2 часов → SMS уже отправляли.

---

## Guest Journey

```
PRE_ARRIVAL → CHECKED_IN → IN_STAY → CHECKOUT → POST_STAY → BETWEEN_STAYS
```

**Переходы:** QR скан → IN_STAY · PMS webhook check-in → CHECKED_IN · checkOut+2ч → POST_STAY · 7 дней post-stay → BETWEEN_STAYS.

**PMS данные:** PRE_ARRIVAL — даты/тип номера/цена · CHECKED_IN — номер комнаты · POST_STAY — история для loyalty.

---

## PMS Integration

Цель в этом проекте: **sync бронирований для SMS + journey**, НЕ бронирование (это в roomie-backend).

- **Webhook** (Servio v06.00.096+): `POST /api/pms/webhook/:hotelId` → `{ "Add": { "Guests": [id] } }`
- **Polling** (fallback): cron 15 мин → `adapter.getReservations(lastSync)`
- **Manual**: CSV upload / кнопка в дашборде

`PMSFactory.create(cfg)` — `cfg` это полный `HotelPMSConfig` из Prisma.
Адаптеры: ServioAdapter, EasyMSAdapter, MockPMSAdapter (для тестов, pmsType=`'mock'`).
Docs: `docs/pms/servio-api.md`, `docs/pms/easyms-api.md`.

---

## SMS Architecture

`SMSFactory` → адаптеры (Twilio, TurboSMS, LogAdapter). Конфигурация per-hotel в БД.

**Цепочка:** OTA бронь → PMS webhook/polling → hotelmol-backend → GuestStay(PRE_ARRIVAL) → 5 мин delay → SMS → deep link → приложение.

**Timing:** delay 5 мин · не слать если check-in >60д или <2ч · не слать если гость уже в приложении.

---

## Loyalty (per-hotel, реализовано)

**Принцип:** `LoyaltyAccount` уникален по `(guestId, hotelId)`. Баллы заработаны в отеле A — используются только в A.

**Auto-earn триггеры (fire-and-forget):**

| Событие | Файл | Начисление |
|---------|------|-----------|
| Stage → POST_STAY | `journey.service.ts` | N ночей × `pointsPerNight` × tier multiplier |
| Order → DELIVERED | `order.service.ts` | subtotal × `pointsPerAmount` × tier multiplier |
| Native pre-checkin | `precheckin.controller.ts` | `preCheckinBonus` (1 раз per stay) |

**Tiers** (по `lifetimePoints`, не уменьшается при списании): BRONZE 1.0x · SILVER 1.25x · GOLD 1.5x · PLATINUM 2.0x. Пороги настраиваются в `LoyaltySettings`.

**Модуль:** `backend/src/modules/loyalty/` · Dashboard: `apps/dashboard/src/app/dashboard/[hotelId]/loyalty/page.tsx`

---

## API Endpoints

```
# Auth (guest)
POST /api/guest/register · verify-otp · login · refresh · quick-register
GET  /api/guest/me       PUT /api/guest/me
POST /api/guest/link-hotel · link-chat · link-booking
GET  /api/guest/current-stay

# Hotel & Services
GET  /api/hotels/:id · /api/hotels/:id/services
POST /api/services/order  GET /api/guest/requests

# Pre-check-in
GET|POST /api/precheckin/*  POST /api/precheckin/native-submit

# Stays
POST /api/stays/:stayId/late-checkout    GET /api/stays/:stayId/late-checkout
POST /api/stays/:stayId/extend

# Loyalty (guest JWT)
GET  /api/loyalty/:hotelId               — баланс + тир
GET  /api/loyalty/:hotelId/transactions  — история (paginated)
POST /api/loyalty/:hotelId/redeem        — { points }

# Tracking
POST /api/tracking/app-open  GET /api/tracking/stats/:hotelId

# QR
POST /api/qr/generate  GET /api/qr/list/:hotelId  GET /qr/:qrCodeId

# PMS (admin/webhook)
POST /api/pms/webhook/:hotelId · /api/pms/sync/:hotelId
GET  /api/pms/sync-status/:hotelId · /api/pms/capabilities/:hotelId

# SMS (admin)
GET|PUT /api/sms/config/:hotelId  GET|PUT /api/sms/templates/:hotelId

# Dashboard (dashboard JWT)
POST /api/dashboard/auth/login
GET  /api/dashboard/hotels/:hotelId/overview · guests · orders · stats · sms-logs
GET  /api/dashboard/hotels/:hotelId/service-requests  PUT .../status
POST /api/dashboard/hotels/:hotelId/qr/generate · generate-bulk
GET  /api/dashboard/hotels/:hotelId/qr · qr/download-all · qr/:qrId/pdf
GET|PUT  /api/dashboard/hotels/:hotelId/loyalty/settings
GET      /api/dashboard/hotels/:hotelId/loyalty/members · stats
POST     /api/dashboard/hotels/:hotelId/loyalty/adjust   — { guestId, points, description }
GET|PATCH /api/dashboard/housekeeping/:hotelId/rooms/*
GET  /api/dashboard/staff/:hotelId  POST|PATCH|DELETE ./:staffId
GET  /api/dashboard/staff/:hotelId/stats · templates

# Staff (staff JWT)
POST /api/staff/auth/login · refresh
GET  /api/staff/tasks  PATCH /api/staff/tasks/:id/status
GET|PATCH /api/staff/rooms/*

# Unified Tasks (v1)
GET|POST /api/v1/tasks  PATCH /api/v1/tasks/:id  GET /api/v1/sse/tasks
```

---

## Модели данных (Prisma)

**Guest:** `GuestAccount` (email, phone, roomieChatId, expoPushToken) · `GuestHotel` (guestId+hotelId, source) · `GuestStay` (stage, bookingRef, checkIn/Out, pmsData, preCheckinCompleted)

**Hotel:** `Hotel` · `HotelPMSConfig` (syncMode: POLLING/WEBHOOK/MANUAL/DISABLED) · `HotelSMSConfig` · `HotelPOSConfig` · `HotelTMSConfig`

**Services:** `ServiceCategory` · `ServiceItem` · `ServiceRequest` · `ServiceRequestItem`

**Orders:** `Order` (FOOD/HK/SPA/TRANSPORT, statuses: PENDING→DELIVERED) · `OrderItem`

**Staff/TMS:** `StaffMember` (role, department, pin) · `StaffShift` · `InternalTask` · `TaskTemplate` · `ChecklistItem` · `TaskChecklist` · `TaskComment` · `TaskAttachment` · `TaskPhoto` · `Department` · `StaffGroup`

**Housekeeping:** `Room` (housekeepingStatus, occupancyStatus) · `RoomStatusChange`
HK lifecycle: DIRTY → CLEANING → CLEANED → INSPECTED → READY (+ OOO, DND side states)

**Loyalty:** `LoyaltySettings` (pointsPerNight, pointsPerAmount, preCheckinBonus, tiers config) · `LoyaltyAccount` (guestId+hotelId unique, points, lifetimePoints, tier) · `LoyaltyTransaction` (type, points ±, stayId?, orderId?)

**Other:** `QRCode` · `QRScan` · `SMSLog` · `AppOpen` · `StageTransition` · `LateCheckoutRequest` · `DashboardManager` · `DashboardManagerHotel`

**Enums:**
- `JourneyStage`: PRE_ARRIVAL · CHECKED_IN · IN_STAY · CHECKOUT · POST_STAY · BETWEEN_STAYS
- `EntrySource`: widget · qr_room · qr_lobby · qr_restaurant · qr_spa · sms_booking · organic · direct
- `LoyaltyTier`: BRONZE · SILVER · GOLD · PLATINUM
- `LoyaltyTransactionType`: EARN_STAY · EARN_SERVICE · EARN_PRECHECKIN · EARN_BONUS · REDEEM · EXPIRE · MANUAL_ADJUST
- `StaffRole`: GENERAL_MANAGER · HEAD_OF_DEPT · SUPERVISOR · LINE_STAFF · RECEPTIONIST
- `StaffDepartment`: HOUSEKEEPING · MAINTENANCE · FOOD_AND_BEVERAGE · FRONT_OFFICE · SECURITY · MANAGEMENT
- `TaskStatus`: NEW · ASSIGNED · ACCEPTED · IN_PROGRESS · ON_HOLD · COMPLETED · INSPECTED · CLOSED · CANCELLED · ESCALATED
- `HousekeepingStatus`: DIRTY · CLEANING · CLEANED · INSPECTED · READY · OUT_OF_ORDER · DO_NOT_DISTURB
- `OccupancyStatus`: VACANT · OCCUPIED · STAYOVER · CHECKOUT · CHECKIN

---

## Coding Rules

**Backend:** модули `modules/{name}/` (controller + service + routes) · Prisma ORM · zod валидация · factory pattern для PMS/SMS · модули общаются через сервисы · pino логирование · `req.params.foo as string` (Express v5 params).

**Mobile:** Expo Router `(auth)` + `(app)` groups · TanStack Query + Zustand (minimal) · два API клиента: `hotelmolApi` (→ hotelmol-backend) + `roomieApi` (→ roomie-backend, чат only) · expo-secure-store · loading/error/empty states на каждом экране.

**Dashboard:** Next.js App Router · dark theme `#0D1117` bg / `#F0A500` accent · auth в localStorage (`hm_dashboard_auth` / `hm_admin_auth`) · SSE через `?token=JWT` query param.

**Не делать:** AI/LLM/RAG в этом проекте · оплата в приложении · Mobile key (Q4 2026) · Voice mode (2027) · микросервисы.

---

## Чат (подключение к roomie-backend)

`GuestAccount.roomieChatId` = UUID чата в roomie-backend.

**WebView (MVP):** `<WebView source={{ uri: ROOMIE_WIDGET_URL + '?hotel=X&chat=Y' }} />`

**Нативный (позже):** `POST roomie-backend/api/chats` → SSE stream → `POST /api/ai/:hotelId/ask`.

При переходе из виджета: deep link с chat_id → привязать к гостю. Без deep link → `GET roomie-backend/api/chats/by-email` → или создать новый.

---

## Статус этапов

| Этап | Статус |
|------|--------|
| 0: Scaffold (Expo + Express + Prisma) | ✅ |
| 1: Guest Auth (OTP, JWT, quick-register) | ✅ |
| 2: Deep Links + Entry Router | ✅ |
| 3: Chat (WebView → roomie-backend) | ✅ |
| 4: Pre-Check-In + Services + Orders | ✅ |
| 5: PMS Sync + SMS | ✅ |
| 6: QR + GM Dashboard | ✅ |
| 7: Staff TMS + Housekeeping | ✅ |
| 8: Loyalty (per-hotel) | ✅ |
| 9: Room Tags + Booking (Q2-Q3) | 🔜 |
