PROMPT SECTION 1

CLIENT FOUNDATION, LAYOUT, NAVIGATION, AUTH, TYPES, DAN MOCK STORE

Baca kembali:

Master prompt

docs/client-progress.md

Hasil Section 0

Codebase terbaru

Kerjakan hanya Section 1 — Client Foundation.

Jangan mengimplementasikan halaman bisnis secara penuh di luar foundation.

Scope

1. Client access

Tambahkan atau rapikan role CLIENT

Integrasikan ke mock auth existing

Tambahkan mock Client account jika diperlukan

Client hanya dapat mengakses /client/**

Jangan mengubah akses role lain tanpa kebutuhan

2. Client layout

Buat atau gunakan ulang:

Client desktop sidebar

Client mobile navigation

Header

Breadcrumb area

User/company summary

Notification entry point

Responsive content container

Active menu state

Collapsed sidebar jika pattern existing mendukung

3. Navigation 18 halaman

Buat group:

HOME
- Dashboard
- Notifications

REQUEST & COMMERCIAL
- Travel Requests
- Quotations & Proposals
- Approval Center

TRAVEL MANAGEMENT
- Projects
- Participants
- Itineraries
- Reservations
- Trip Center
- Change Requests

COLLABORATION
- Documents
- Messages & Activities
- Issues & Support

FINANCE
- Finance & Billing

INSIGHTS
- Reports & Analytics
- Feedback & Evaluation

COMPANY
- Company Profile

4. Shared domain types

Tambahkan type/interface yang dibutuhkan seluruh Client area.

Hindari duplicate type jika type serupa sudah tersedia.

5. Mock data foundation

Siapkan mock data terpusat untuk lima scenario utama:

Korea Incentive Trip

Abu Dhabi Business Delegation

Manila Corporate Meeting

Bali MICE Event

Singapore Conference

Data harus menggunakan ID relasional konsisten.

6. Store/service foundation

Gunakan pattern existing.

Sediakan fondasi state/action untuk:

Read entity

Filter

Search

Update mock status

Add activity

Add notification

Cross-module state update

7. Base reusable UI

Gunakan existing components terlebih dahulu.

Buat jika belum ada:

Page header

Status badge

Summary card

Filter bar

Empty state

Error state

Loading skeleton

Confirmation dialog

Activity timeline

Readiness progress

Jangan membuat ulang component existing.

8. Route shells

Pastikan seluruh 18 route utama dapat dikenali oleh navigation.

Route yang belum dikerjakan boleh menggunakan shell yang jelas untuk development, tetapi jangan membuat placeholder final.

Shell harus ditandai sebagai belum diimplementasikan dalam progress docs dan tidak boleh dianggap selesai.

Acceptance criteria

Role CLIENT tersedia

Client layout berfungsi

Navigation responsive

Semua menu memiliki route yang valid

Role lain tidak rusak

Shared types tersedia

Mock scenarios tersedia

Store/service foundation tersedia

Tidak ada duplicate source of truth

Foundation siap digunakan Section 2–7

Test

Jalankan:

lint

typecheck

relevant tests

build

Perbaiki error yang disebabkan Section 1.

Dokumentasi

Update:

docs/client-information-architecture.md
docs/client-page-inventory.md
docs/client-mock-data-scenarios.md
docs/client-progress.md

Format laporan

SECTION 1 — CLIENT FOUNDATION
STATUS:

ROUTES:
- ...

LAYOUT:
- ...

AUTH / ROLE:
- ...

NAVIGATION:
- ...

TYPES:
- ...

MOCK DATA:
- ...

STORE / SERVICE:
- ...

REUSABLE COMPONENTS:
- ...

FILES CHANGED:
- ...

TEST:
- lint:
- typecheck:
- test:
- build:

KNOWN ISSUES:
- ...

NEXT SECTION:
Section 2 — Home

Berhenti setelah Section 1 selesai.