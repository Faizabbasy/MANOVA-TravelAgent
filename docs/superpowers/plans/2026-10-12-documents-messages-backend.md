# Dokumen & Pesan ke Backend (S9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Metadata dokumen & pesan internal dimiliki server.

**Architecture:** Migrasi 0032; modul `core/documents.ts` (dokumen + pesan) dan `core/document-routes.ts`; capability `document.manage`. Frontend `data/documents-sync.ts`; `/documents` & project page dialihkan; portal tetap lokal (`DOC-L`/`MSG-L`).

**Tech Stack:** Bun + Elysia + PostgreSQL/PGlite; Nuxt 4 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-documents-messages-backend-design.md`

## Global Constraints

- bun di `backend/`, pnpm di `frontend/`; tanpa lockfile baru; jangan ubah migrasi 0001–0031; jangan `git add docs` (folder dokumen milik user tidak dilacak).
- 400 validasi, 422 aturan, 404 tidak ada; audit dalam transaksi; rbac backend & frontend sinkron.
- vue-tsc ≤ 1983; eslint per file tidak naik.

## Review Focus

1. Pengirim pesan & pengunggah dokumen selalu aktor (body diabaikan) — Task 2.
2. Mention ke user tidak ada → 400; notifikasi mention tetap muncul lokal — Task 2 & 4.
3. Sinkron mempertahankan `DOC-L`/`MSG-L` portal — Task 4.
4. Tab Dokumen project tetap menggabungkan dokumen legacy — Task 4.
5. Seed ulang tidak menimpa baris API — Task 3.

---

### Task 1: Migrasi 0032 + prefix
- [ ] Tes `documents and messages exist after 0032` → merah → migrasi + ids.ts (`DOC-C`, `MSG-`) → hijau → commit.

### Task 2: API dokumen & pesan
- [ ] Tes `test/documents-messages.test.ts` → merah → `core/documents.ts`, `core/document-routes.ts`, capability `document.manage` (backend + frontend rbac + constants/capabilities), `app.ts` → hijau → commit.

### Task 3: Seed
- [ ] Tes seed (19 dokumen, 11 pesan, seed ulang menjaga baris API) → extract + seed → hijau → seluruh `bun run test` → commit.

### Task 4: Frontend
- [ ] Tes `documents-sync.test.ts` → `documents-sync.ts` + types/endpoints + layout/settings → guard (`createDocument(`, `sendMessage(`) → `/documents` & project page memakai server, mention lokal → prefix lokal `DOC-L`/`MSG-L` → `pnpm test`, vue-tsc, eslint → commit.

### Task 5: Dokumentasi + verifikasi
- ADR-004 S9, spec status, memory; migrate + seed lokal; smoke; `pnpm build`; commit.
