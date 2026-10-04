# DECISIONS.md — Black Flow v1.0

Catatan keputusan arsitektur dan runtime. Diperbarui di akhir setiap fase.

## 0. Ringkasan Eksekutif
- **Nama proyek**: Black Flow (generasi lanjutan FlowMind)
- **Stack**: HTML/CSS/JS native (ES modules) + Netlify Functions/Edge + Supabase
- **Deploy**: Netlify (static + functions)
- **Database**: Supabase (Postgres + Auth + Storage + Realtime)
- **PWA**: Ya, service worker + manifest

---

## 1. Keputusan Runtime (Spike Fase 0)

### 1.1 Jalur Chat: Edge vs Function
**Keputusan**: Default **Edge Function** (`/chat/*`), fallback ke **Function** (`/api/chat/*`) bila spike gagal.

**Alasan**:
- Edge: CPU limit 50ms (wall-clock excluded), header ≤40s, streaming hemat CPU via pass-through SSE
- Function: 60s sync, 20MB streaming, 6MB buffered payload
- Butuh spike validasi: stream 120s × 8k token tidak putus, CPU <50ms, overhead router p95 <150ms

**Config**:
```env
ROUTER_DEADLINE_MS=55000
TTFB_TIMEOUT_MS=10000
MAX_ATTEMPTS=6
```

### 1.2 Region Function
**Keputusan**: Default `cmh` (Ohio, US). `sin` (Singapura) hanya untuk plan Pro/Enterprise.

**Alasan**: Netlify batas region gratis ke `cmh`. User Indonesia → latency lebih tinggi tapi gratis. Plan berbayar bisa request region `sin`.

### 1.3 Streaming Strategy
**Keputusan**: 
- Edge: Pass-through SSE byte-for-byte untuk upstream OpenAI-compatible. Header dikirim awal (connection alive).
- Function: Buffer dulu, kirim header saat chunk pertama (TTFB ≤30s untuk HTTP status jujur).

**Alasan**: Edge header limit 40s. Function boleh 60s tapi payload buffered 6MB.

### 1.4 Payload Besar (File)
**Keputusan**: File **tidak lewat function**. Client upload ke Supabase Storage via signed URL. Tool ambil via signed URL/stream.

**Alasan**: Function buffered payload 6MB (biner Base64 ~4.5MB). Supabase Storage handle GB-an.

---

## 2. Arsitektur Blackbox Engine (Unified Router)

### 2.1 Satu Router untuk Semua Kelas
**Keputusan**: `route(target_id, input, ctx)` handle `model`, `vendor`, `scrape`.

**Alasan**: DRY. Failover, circuit breaker, fallback, logging sama semua kelas.

### 2.2 API Pool (JSON + Supabase)
**Keputusan**: Definisi Vendor/Target/Entry/Credential/Policy disimpan sebagai JSON di `/pool/*.json` + sinkron ke Supabase via seed script. Admin UI edit & ekspor balik JSON.

**Alasan**: Git-trackable, reviewable, CI-validatable (JSON Schema). Secret tidak di JSON.

### 2.3 Credential Group & Tier
**Keputusan**: `credential_group` format `<vendor>/<tier>/*` (mis. `google/pro/*`, `ilovepdf/byok/*`). Tier: `free|pro|internal|byok`.

**Alasan**: Plan → allowed tier mapping simpel. BYOK per-user tier `byok`.

### 2.4 Fallback Tangga (Configurable)
**Keputusan**: 
1. Sibling (Entry lain Target sama)
2. Similar (Target lain via `similar_to` edge, max 1 hop, mode `auto|ask_model|ask_user`)
3. Local (adapter `client|builtin`, priority ≥100)
4. LLM (adapter `llm_native`, khusus teks)

**Alasan**: Declaratif di pool, bukan hardcode. Mode per capability di Policy.

---

## 3. Data Model & RLS

### 3.1 Tabel Utama (Supabase)
- `profiles`, `plans`, `subscriptions` (billing WhatsApp)
- `conversations`, `messages` (chat)
- `files` (Supabase Storage ref)
- `pool_vendors`, `pool_credentials`, `pool_targets`, `pool_entries`, `pool_health`, `pool_policies`, `pool_changes`, `pool_calls`
- `request_logs`, `api_keys`, `usage_daily`, `tool_jobs`
- `orders`, `order_events` (WhatsApp billing)
- `feature_flags`, `announcements`, `audit_logs`

### 3.2 RLS Policy
**Keputusan**: User hanya akses data sendiri (`auth.uid() = user_id`). Admin (`role IN ('admin','owner')`) akses semua. Pool tables read-only untuk user (hanya `status='active'`), write untuk admin.

**Alasan**: Keamanan standar. Service key hanya di Function/Edge.

---

## 4. Auth & Billing

### 4.1 Auth
**Keputusan**: Supabase Auth (email/password, magic link, Google, GitHub). Email verified required. Guest trial + Turnstile. 2FA TOTP (P2).

### 4.2 Billing: WhatsApp Manual
**Keputusan**: Tidak ada payment gateway otomatis v1. Alur:
1. User pilih plan → Order `pending` (ID `BF-YYMMDD-XXXX`, unique code 3 digit, expire 24h)
2. Buka WhatsApp ke `6282226650038` (0822-2665-0038) dengan pesan terisi
3. Owner balas instruksi bayar (transfer/e-wallet/QRIS)
4. User bayar → kirim bukti via WA atau upload di app
5. Admin konfirmasi → subscription aktif/perpanjang
6. Order expire → `expired` otomatis

**Config**: `PAYMENT_WA_NUMBER=6282226650038` (satu sumber, tidak hardcode).

**Abstraksi**: `PaymentProvider` interface (`create_order`, `get_instructions`, `confirm`) → implementasi `whatsapp_manual`. Bisa ganti gateway nanti tanpa ubah logika plan.

### 4.3 Plan & Kuota
**Default** (Phase 0, bisa diubah owner via admin):
| Plan | Monthly | Yearly | Msgs/Hari | Tools/Giliran | File Max | Pool |
|------|---------|--------|-----------|---------------|----------|------|
| Free | 0 | 0 | 30 | 1 | 10 MB | free |
| Pro | 100k | 1M | 1000 | 6 | 100 MB | free, pro |
| Team | 300k | 3M | 5000 | 10 | 500 MB | free, pro, internal |

---

## 5. Keamanan & Privasi

### 5.1 Key Vault
**Keputusan**: AES-256-GCM, master key di env Netlify, rotasi via `key_version`. Dekripsi hanya di memori Function/Edge. UI hanya label + 4 digit terakhir.

### 5.2 Input/Output Sanitization
**Keputusan**: 
- Semua input divalidasi skema (Zod/JSON Schema)
- Output model/tool disanitasi sebelum render (DOMPurify wajib)
- Hasil tool/web/file = untrusted data → dibungkus delimiter, model dilarang eksekusi instruksi di dalamnya

### 5.3 SSRF Guard
**Keputusan**: Semua fetch keluar lewat guard: blok IP privat/loopback/metadata (`169.254.169.254`, `127.0.0.1`, `localhost`, `metadata.google.internal`), batasi redirect & ukuran respons.

### 5.4 Data Policy & Private Mode
**Keputusan**: Setiap Entry punya `data_policy` (`retention`, `region`). User/workspace bisa enable Private Mode → hanya route ke kandidat dengan policy diizinkan, atau force fallback local.

### 5.5 Header Keamanan (netlify.toml + kode Edge)
CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Edge Function set header sendiri (netlify.toml tidak berlaku untuk Edge response).

---

## 6. Observability

### 6.1 Logging
**Keputusan**: Structured log per request (`request_id`, `user_id/api_key_id`, target, attempts, status, tokens, cost, latency). Log **tidak** berisi key, Authorization header, atau isi prompt penuh.

### 6.2 Metrik
- `request_logs` + `pool_calls` per percobaan
- Success rate, fallback rate per capability/connector
- Latency p95, cost est
- Health map realtime (Supabase Realtime)

### 6.3 Alerting
Admin alert ke Telegram/Discord/email untuk:
- Semua endpoint model X mati
- Key invalid (401/403)
- Kuota/hari habis
- Order baru

### 6.4 Public Status Page
Halaman `/status` baca dari `pool_health`.

---

## 7. UI/UX

### 6.1 Tema "Black" (Default)
```css
--color-bg: #0A0A0B;
--color-surface: #121214;
--color-border: rgba(255,255,255,.08);
--color-text-primary: #EDEDED;
--color-accent-start: #7C5CFF;
--color-accent-end: #22D3EE;
```
Light theme opsional.

### 6.2 Layout
- Sidebar collapsible (desktop), drawer (mobile)
- Topbar dengan model picker pill (grup per family, badge vision/tools/reasoning, status dot)
- Composer auto-grow, 4-state button (dictate/voice/send/stop)
- Streaming via fetch + ReadableStream (parser SSE custom)

### 6.3 Dashboard Menyatu
Hash routing `#/dashboard/*`, `#/admin/*`, `#/auth/*` tanpa reload. Shell chat tetap ada.

### 6.4 Mobile-First
`100dvh` + safe-area, touch target ≥44px, PWA, mode hemat data.

---

## 8. Tooling & CI

### 8.1 Dependencies
- **Vendor**: Library dipin, di-vendor ke `/vendor/` (Tailwind via CDN hanya dev, prod pakai CSS custom)
- **Supabase JS**: CDN (esm.sh)
- **DOMPurify**: CDN
- **KaTeX/Mermaid**: CDN (load on demand)

### 8.2 CI/CD
- Netlify deploy preview per PR
- Lint: JSON Schema validation untuk pool files
- Test: Unit (Vitest), E2E (Playwright) - P1

### 8.3 Environment Variables (Netlify)
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
API_KEY_PEPPER
MASTER_ENCRYPTION_KEY (base64 32 bytes)
ROUTER_DEADLINE_MS=55000
TTFB_TIMEOUT_MS=10000
MAX_ATTEMPTS=6
PAYMENT_WA_NUMBER=6282226650038
```

---

## 9. Open Questions / Future

| # | Topic | Status | Target Phase |
|---|-------|--------|--------------|
| 1 | Payment gateway otomatis (Midtrans/Xendit/Stripe) | Tertunda | Phase 3+ |
| 2 | Workspace/Team (shared pool, shared chat) | P2 | Phase 3 |
| 3 | Canvas panel (dokumen/kode editable) | P1 | Phase 2 |
| 4 | code.run (Pyodide Web Worker) | P2 | Phase 3 |
| 4 | Voice mode (STT/TTS) | P2 | Phase 3 |
| 5 | Memory cross-chat | P2 | Phase 3 |
| 6 | Share link read-only | P1 | Phase 2 |
| 7 | Import FlowMind data lama | P2 | Phase 3 |
| 8 | Eval akurasi pemilihan tool | P2 | Phase 4 |
| 9 | Auto-router model (AI pilih model) | P2 | Phase 4 |
| 10 | Import OpenAPI → Connector draft | P2 | Phase 3 |

---

## 10. Changelog Keputusan

| Tanggal | Fase | Keputusan | Catatan |
|---------|------|-----------|---------|
| 2026-10-04 | 0 | Edge default, Function fallback | Spike validasi 120s stream |
| 2026-10-04 | 0 | Region `cmh` default, `sin` Pro only | Netlify limit |
| 2026-10-04 | 0 | Unified Router untuk model/vendor/scrape | DRY |
| 2026-10-04 | 0 | API Pool JSON + Supabase sync | Git-trackable |
| 2026-10-04 | 0 | WhatsApp manual billing | Tidak ada gateway v1 |
| 2026-10-04 | 0 | Key Vault AES-256-GCM | Master key di env |
| 2026-10-04 | 0 | RLS user-only, admin-all | Standard |
| 2026-10-04 | 0 | Tema "Black" default | PRD Section 6 |

---

*File ini hidup. Update di akhir setiap fase. Commit bersama perubahan kode.*