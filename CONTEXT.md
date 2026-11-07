# CONTEXT.md — InternSit

Dokumen ini adalah konteks lengkap untuk melanjutkan pembangunan **InternSit** yang sudah diinisialisasi.
Dibuat berdasarkan pengalaman membangun project sebelumnya (MyLamaran) oleh pemilik yang sama.
**Baca seluruh dokumen ini sebelum mengerjakan apapun.**

---

## 1. Apa Itu InternSit

**InternSit** adalah aplikasi manajemen lamaran kerja dan magang pribadi (single-user).
Tujuannya murni: **mencatat, memantau, dan mengelola status lamaran** yang sudah dikirim
dari berbagai platform (LinkedIn, Jobstreet, Glints, MagangHub, Instagram, dll).

**Tidak ada scraping. Tidak ada aggregasi API eksternal. Tidak ada background job.**
Semua data diisi secara manual oleh user. Simpel, cepat, bisa dibuka di HP.

- **Deployment target:** Vercel (frontend + API routes serverless)
- **Database:** Neon Serverless Postgres
- **Auth:** single password gate + signed session cookie (single-user, sudah diimplementasikan)
- **PWA:** Ya — harus bisa di-install di HP, ada offline-fallback saat tidak ada koneksi

---

## 2. Tech Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Didukung Vercel natively, full-stack serverless |
| Language | **TypeScript** | Konsistensi dengan MyLamaran |
| Styling | **Tailwind CSS v3** | Konsistensi design system dengan MyLamaran |
| Database | **Neon Serverless Postgres** | Free tier, tanpa kartu kredit, cocok Vercel |
| ORM | **Drizzle ORM** | Ringan, type-safe, cocok untuk serverless/edge |
| Auth | **Single password gate** | HMAC SHA-256 via Web Crypto; tanpa akun atau provider eksternal |
| Forms/Validasi | **Zod** (sudah terpasang) + **React Hook Form** (rencana langkah 9) | Schema di-share client dan server |
| Icons | **Lucide React** | Sama seperti MyLamaran |
| PWA | **next-pwa** (rencana langkah 13, belum terpasang) | Plugin PWA untuk Next.js |
| Deployment | **Vercel** | Gratis, HTTPS otomatis, deploy dari GitHub push |

**Auth yang sudah berjalan:**
- `src/lib/auth.ts`: password dicek terhadap `APP_PASSWORD`; token sesi ditandatangani
  HMAC SHA-256 dengan `AUTH_SECRET`, menggunakan Web Crypto (edge dan Node).
- Cookie `internsit_session`: masa berlaku 30 hari, `httpOnly`, `secure` hanya di
  production, `sameSite: 'lax'`, `path: '/'`.
- Simpan `APP_PASSWORD` dan `AUTH_SECRET` hanya di `.env.local` untuk lokal atau env
  deployment. Jangan tulis nilainya di dokumentasi, source, log, atau commit.
- Rotasi `AUTH_SECRET` membatalkan semua sesi lama. Mengganti `APP_PASSWORD` saja
  **tidak** membatalkan sesi yang sudah diterbitkan.
- `src/middleware.ts`: `/login` dan `/api/login` publik; aset Next/PWA dikecualikan
  oleh matcher (`/_next/static`, `/_next/image`, favicon, manifest, service worker,
  workbox, ikon, offline page). Halaman lain tanpa sesi diarahkan ke `/login`;
  API lain tanpa sesi mengembalikan `401` JSON.
- `POST /api/login` sudah ada: validasi Zod, cek password, terbitkan cookie.
  `POST /api/logout` sudah ada dan dilindungi middleware: hapus cookie.
- Delay 800 ms untuk password salah **bukan rate limiting sungguhan**. Rate limiting
  yang efektif untuk production masih perlu direncanakan sebelum deployment publik.

---

## 3. Fitur MVP — Scope Ketat

### Wajib Ada
- **Tambah lamaran baru:** isi manual — judul posisi, perusahaan, platform asal, tipe
  (Job/Internship), lokasi/work mode, URL lamaran, status awal, catatan.
- **Kanban board:** tiga kolom APPLIED | INTERVIEWING | OFFER,
  plus section Archived/Rejected terpisah di bawah.
- **Edit & hapus lamaran:** klik kartu → modal edit, ada tombol hapus di footer modal.
- **Advance status:** tombol "Next →" di kartu untuk pindah stage tanpa buka modal.
- **Filter & search:** cari nama posisi/perusahaan, filter by platform dan tipe.
- **Statistik ringkas:** total lamaran, aktif, sedang diproses, offer diterima.
- **PWA:** manifest, service worker, bisa di-install di HP, offline fallback page.
- **Dark mode / Light mode toggle:** persisted di localStorage, default dark.

### Eksplisit Di Luar Scope — Jangan Dikerjakan
- Scraping atau koneksi ke API job board manapun
- Notifikasi push atau email
- Multi-user / kolaborasi
- Export CSV (pertimbangkan setelah MVP stabil, bukan sekarang)
- Rekomendasi berbasis AI/ML

---

## 4. Data Model

**Satu tabel tunggal:** `applications`

```sql
CREATE TABLE applications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,         -- nama posisi
  company     text        NOT NULL,         -- nama perusahaan
  type        text        NOT NULL,         -- 'Job' | 'Internship'
  platform    text        NOT NULL,         -- lihat Section 7
  location    text,                         -- 'Remote' | 'Jakarta' | 'Hybrid', bebas
  url         text,                         -- link lamaran (optional)
  status      text        NOT NULL DEFAULT 'APPLIED', -- 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED'
  notes       text,                         -- catatan bebas (optional)
  applied_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX applications_status_idx ON applications (status);
CREATE INDEX applications_applied_at_idx ON applications (applied_at DESC);
```

**Tidak ada kolom `user_id` dan tidak ada tabel `users`** — satu personal workspace
bersama di balik password gate, tanpa identitas/ownership per akun.
**Tidak ada tabel lain** untuk MVP. Schema aktual: `src/db/schema.ts`.

### Drizzle Schema

```ts
// src/db/schema.ts
import { pgTable, text, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { desc } from 'drizzle-orm';

export const applications = pgTable(
  'applications',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    title:     text('title').notNull(),
    company:   text('company').notNull(),
    type:      text('type').notNull(),
    platform:  text('platform').notNull(),
    location:  text('location'),
    url:       text('url'),
    status:    text('status').notNull().default('APPLIED'),
    notes:     text('notes'),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('applications_status_idx').on(t.status),
    index('applications_applied_at_idx').on(desc(t.appliedAt)),
  ],
);

export type Application    = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
```

---

## 5. API Routes

Routes lamaran **sudah diimplementasikan (langkah 7)** di `src/app/api/applications/`.
Setiap handler memverifikasi sesi sendiri lewat `requireSession()` (`src/lib/api.ts`,
memakai `verifySessionToken()`), selain dijaga middleware (defense in depth); tanpa
sesi → `401`. Semua respons memakai `Cache-Control: no-store`.

```
GET    /api/applications          → 200 { applications: [...] }, urut applied_at DESC
POST   /api/applications          → 201 { application }
PATCH  /api/applications/[id]     → 200 { application } (hanya field yang dikirim; updated_at diperbarui)
DELETE /api/applications/[id]     → 200 { ok: true, id }
```

- **GET query params** (semua opsional, nilai kosong dianggap tidak ada):
  `q` (cari di title/company, case-insensitive, `%`/`_` dicocokkan literal),
  `platform`, `type`, `status`. Nilai enum tidak valid → `400`.
- **Error:** `400` `{ error, issues: [{ path, message }] }` untuk body/query/id tidak
  valid (termasuk JSON rusak, field tak dikenal, body PATCH kosong); `404` bila id
  tidak ditemukan; `500` `{ error }` generik (detail hanya di log server).
- `id`, `applied_at`, `updated_at` dikelola server dan **ditolak** jika dikirim klien.
- **Single-user:** tidak ada ownership clause atau `user_id`. PATCH dan DELETE
  menargetkan `id` lamaran. Jangan menambahkan tabel akun atau filter ownership untuk MVP.
- Respons berisi `Date` yang diserialisasi JSON menjadi ISO string (cocok dengan
  `ApplicationItem` di `src/lib/applications.ts`).
- Pagination belum ada (data personal, skala kecil); tambahkan hanya bila diperlukan.

### Zod Schema (di-share client & server)

Implementasi aktual ada di `src/lib/schemas.ts` (ringkasan aturan; baca source untuk detail):

- `ApplicationSchema` (`z.strictObject`): `title`/`company` wajib (trim, maks 200),
  `type` ∈ `Job|Internship`, `platform` ∈ `PLATFORMS` (Section 7; enum, bukan string
  bebas), `status` default `APPLIED`, `location` (maks 200), `url` (maks 2048),
  `notes` (maks 5000). Field opsional di-trim; `''`/`null` disimpan sebagai `NULL`.
- **`url` hanya `http://` atau `https://`** — nilainya dipakai sebagai `href`, jadi
  `javascript:`/`data:` ditolak.
- `UpdateApplicationSchema` dibangun dari field dasar (`.partial()` + minimal satu
  field), **bukan** `ApplicationSchema.partial()`: di Zod 4 default `status` tetap
  diterapkan pada field yang tidak dikirim, sehingga PATCH yang hanya mengubah catatan
  akan mereset status ke `APPLIED`. Pada update, `undefined` = tidak diubah,
  `null`/`''` = hapus nilai.
- `ListApplicationsQuerySchema` (`q`, `platform`, `type`, `status`) dan
  `ApplicationIdSchema` (`z.uuid()`).
- Konstanta bersama `APPLICATION_STATUSES`, `APPLICATION_TYPES`, `PLATFORMS` ada di
  `src/lib/applications.ts`. `schemas.ts` mengimpornya dengan ekstensi `.ts` agar unit
  test Node dapat memuatnya (`allowImportingTsExtensions` di `tsconfig.json`).
- Karena ada `transform`, tipe input form dan output schema berbeda; perhatikan saat
  memakai React Hook Form di langkah 9.

---

## 6. Status Flow

```
APPLIED  →  INTERVIEW  →  OFFER
                ↓               ↓
           REJECTED         REJECTED
              ↓
           APPLIED   (restore / reapply)
```

Tombol "Next →" di kartu:
- APPLIED → INTERVIEW
- INTERVIEW → OFFER
- OFFER → REJECTED
- REJECTED → APPLIED

---

## 7. Platform Options

```ts
export const PLATFORMS = [
  'LinkedIn',
  'Jobstreet',
  'Glints',
  'MagangHub (Kemnaker)',
  'Kalibrr',
  'Indeed',
  'Company Website',
  'Instagram / Social Media',
  'Referral / Kenalan',
  'Other',
] as const;
```

---

## 8. Design System — Wajib Diikuti Ketat

Desain InternSit **harus terasa sama** dengan MyLamaran: operational dashboard,
bukan aplikasi konsumen yang playful.
Referensi: Linear (density), Grafana (status visualization), Better Uptime (clarity).

### CSS Variables — Salin Persis ke `globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-background: #FFFFFF;
    --color-surface: #F9FAFB;
    --color-surface-lowest: #FFFFFF;
    --color-surface-low: #F3F4F6;
    --color-surface-container: #E5E7EB;
    --color-surface-high: #D1D5DB;
    --color-on-surface: #111827;
    --color-on-surface-variant: #4B5563;
    --color-on-primary: #FFFFFF;
    --color-outline: #D1D5DB;
    --color-outline-variant: 229 231 235;
    --color-primary: #111827;
    --color-primary-container: #E5E7EB;
    --color-primary-fixed: #374151;
    --color-border: #E5E7EB;
    --color-success: #16A34A;
    --color-warning: #D97706;
    --color-danger: #DC2626;
    --color-input-bg: #F3F4F6;
    --color-input-border: #D1D5DB;
    --color-input-focus-border: #111827;
  }

  .dark {
    --color-background: #0B0F14;
    --color-surface: #10151C;
    --color-surface-lowest: #0E131A;
    --color-surface-low: #161D26;
    --color-surface-container: #1B232D;
    --color-surface-high: #222B36;
    --color-on-surface: #E2E8F0;
    --color-on-surface-variant: #B0BEC5;
    --color-on-primary: #0F172A;
    --color-outline: #475569;
    --color-outline-variant: 51 65 85;
    --color-primary: #E2E8F0;
    --color-primary-container: #CBD5E1;
    --color-primary-fixed: #94A3B8;
    --color-border: #334155;
    --color-success: #22C55E;
    --color-warning: #F59E0B;
    --color-danger: #EF4444;
    --color-input-bg: #1B232D;
    --color-input-border: #475569;
    --color-input-focus-border: #E2E8F0;
  }

  /* Scrollbar custom untuk modal — tipis, mengikuti tema */
  .modal-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--color-outline) var(--color-surface-lowest);
  }
  .modal-scrollbar::-webkit-scrollbar { width: 6px; }
  .modal-scrollbar::-webkit-scrollbar-track { background: var(--color-surface-lowest); }
  .modal-scrollbar::-webkit-scrollbar-thumb {
    background: var(--color-outline);
    border-radius: 999px;
  }
  .modal-scrollbar::-webkit-scrollbar-button { display: none; }
}
```

### Tailwind Config — Salin Persis ke `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'Figtree', ...defaultTheme.fontFamily.sans],
        display: ['Inter', 'Figtree', ...defaultTheme.fontFamily.sans],
        mono:    ['JetBrains Mono', 'ui-monospace', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        background: 'var(--color-background)',
        surface: {
          DEFAULT:   'var(--color-surface)',
          lowest:    'var(--color-surface-lowest)',
          low:       'var(--color-surface-low)',
          container: 'var(--color-surface-container)',
          high:      'var(--color-surface-high)',
        },
        'on-surface': {
          DEFAULT: 'var(--color-on-surface)',
          variant: 'var(--color-on-surface-variant)',
        },
        'on-primary': 'var(--color-on-primary)',
        outline: {
          DEFAULT: 'var(--color-outline)',
          variant: 'rgb(var(--color-outline-variant) / <alpha-value>)',
        },
        primary: {
          DEFAULT:   'var(--color-primary)',
          container: 'var(--color-primary-container)',
          fixed:     'var(--color-primary-fixed)',
        },
        border:  'var(--color-border)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger:  'var(--color-danger)',
        'input-bg':    'var(--color-input-bg)',
        'input-border':'var(--color-input-border)',
        'input-focus': 'var(--color-input-focus-border)',
      },
    },
  },
  plugins: [],
};

export default config;
```

### Typography

Muat dari Bunny Fonts (lebih cepat dari Google Fonts) di `layout.tsx`:
```
Inter (400, 500, 600, 700, 900) + JetBrains Mono (400, 500)
```

### Status Colors — FUNGSIONAL, Jangan Pakai di Luar Konteks Status

| Status | dot / badge color |
|---|---|
| APPLIED | `bg-blue-500` / `text-blue-600 dark:text-blue-400` |
| INTERVIEW | `bg-amber-500` / `text-amber-600 dark:text-amber-400` |
| OFFER | `bg-emerald-500` / `text-emerald-600 dark:text-emerald-400` |
| REJECTED | `bg-rose-500` / `text-rose-600 dark:text-rose-400` |

### Anti-Pattern — Jangan Dilakukan
- **Jangan pakai `purple`** di manapun — tidak ada di design system ini
- Jangan pakai gradient mencolok atau animasi berlebihan
- Jangan tambah warna aksen baru di luar palet di atas
- Jangan buat status badge hanya dengan warna — selalu sertakan label teks juga

---

## 9. Layout & Komponen

### Sidebar / Navigation
- Sudah diimplementasikan di `src/components/dashboard-shell.tsx`, dipasang lewat
  `src/app/(dashboard)/layout.tsx`. Halaman `/` ada di `src/app/(dashboard)/page.tsx`;
  route group tidak mengubah URL. Root `src/app/layout.tsx` memuat font dan tema;
  `/login` berada di luar dashboard shell.
- **Desktop (`lg`, >=1024px):** sidebar kiri `fixed`, lebar `w-64` (256px),
  konten utama `lg:ml-64`. Isi: logo, Dashboard, theme toggle, label
  **Personal workspace / Single-user**, dan logout; tidak ada avatar/profil akun.
- **Mobile (<1024px):** `sticky` top bar `h-16` + hamburger membuka native
  `<dialog>` via `showModal()`, drawer kanan `w-72`, `top-16`, backdrop `bg-black/40`.
  Focus terkunci secara native; Escape, tombol tutup, klik backdrop, dan navigasi
  menutup drawer. Body scroll dikunci selama terbuka; drawer ditutup saat masuk
  breakpoint desktop. Animasi masuk hanya `motion-safe` (hormati reduced motion).
- Logout memanggil `POST /api/logout`, lalu full navigation ke `/login` untuk
  membersihkan cache router halaman privat.

Nav links MVP:
```
/   → Dashboard (Kanban + statistik)
```

### Kanban Board

Grid: `grid grid-cols-1 xl:grid-cols-3 gap-4 xl:gap-6`
Tiga kolom: APPLIED | INTERVIEWING | OFFER
Section di bawah: Archived / Rejected (grid 3-4 kolom, tampil hanya jika ada data).
Label kolom **INTERVIEWING** memetakan nilai status **`INTERVIEW`**, bukan enum baru.

**Langkah 6–8 — selesai (Kanban memakai data Neon lewat API):**
- `src/components/kanban-board.tsx` (client component, tanpa props) dipasang pada
  halaman dashboard dan mengambil data dari `GET /api/applications` setelah mount.
  Data dummy sudah dihapus.
- `src/lib/applications-client.ts`: `listApplications()` dan
  `updateApplicationStatus()` (PATCH hanya `{ status }`), dengan `ApiError` (`status`
  0 = gagal jaringan). `AbortError` dibiarkan agar pemanggil bisa mengabaikannya.
- Tiga keadaan muat: skeleton (hormati reduced motion), error dengan tombol
  **Try again**, dan siap. Respons `401` mengarahkan ke `/login`. Papan kosong
  menampilkan "No applications yet."
- Tombol "Next →" bersifat **optimistic**: kartu pindah dulu, lalu PATCH; tombol
  dinonaktifkan selama request berjalan. Jika gagal, status dikembalikan dan muncul
  pesan error (`role="alert"`). Jika `404` (sudah dihapus di tempat lain), kartu
  dibuang dari papan. Respons server menggantikan state lokal.
- **Modal Add (langkah 9):** `src/components/application-modal.tsx`, native `<dialog>`
  (`showModal()`, Escape/backdrop/Cancel menutup; dikunci saat submit) dengan pola
  header/body/footer Section 9. Tombol **Add application** ada di toolbar atas papan.
  React Hook Form + `zodResolver(ApplicationSchema)` — schema yang sama dengan server.
  Tipe: `useForm<ApplicationFormValues, unknown, ApplicationInput>` (input form vs
  payload hasil parse). Field: title*, company*, type (segmented radio, default
  Internship)*, platform (select, wajib dipilih)*, status (default Applied), location,
  url, notes. Form direset tiap dibuka. Error `400` server dipetakan ke field via
  `issues[].path`; `401` ke `/login`; lainnya tampil sebagai pesan form. Setelah
  sukses kartu baru disisipkan di paling atas tanpa refetch.
- **Modal Edit/hapus (langkah 10):** komponen yang sama (`ApplicationModal`) dipakai
  ulang; mode edit aktif bila prop `application` diberikan. Klik kartu membuka modal
  (klik pada link/tombol di kartu diabaikan); judul kartu adalah `<button>` agar bisa
  dijangkau keyboard/screen reader. Dinonaktifkan selama kartu sedang pindah stage.
  Simpan mengirim **hanya field yang berubah** (`dirtyFields`) lewat `PATCH`; tanpa
  perubahan modal langsung menutup. Mengubah status di modal memindahkan kartu ke
  kolom lain. Hapus ada di footer kiri dengan konfirmasi inline (**Keep** / **Delete**,
  fokus awal di Keep). `404` saat simpan/hapus dianggap sudah terhapus: kartu dibuang
  dan muncul pesan di papan. Selama simpan/hapus berjalan, semua cara menutup modal
  dikunci.
- Belum ada auto-refresh atau refetch saat fokus; muat ulang halaman untuk melihat
  perubahan dari perangkat lain.
- `src/lib/applications.ts` berisi `ApplicationItem` (tanggal ISO string),
  `ApplicationStatus`, `nextStatus()`, dan `timeAgo()`. Waktu relatif dihitung setelah
  hydration dan diperbarui setiap menit untuk menghindari beda jam server/client.
- Tiga kolom utama + section Rejected kondisional; kartu menampilkan URL eksternal
  jika ada (buka tab baru dengan `rel="noopener noreferrer"`), lokasi dan preview
  notes opsional, serta waktu applied.
- Tombol "Next →" mengikuti alur Section 6.
- **Statistik (langkah 11):** `StatsHeader` di `kanban-board.tsx`, di atas toolbar
  papan, dihitung dari state papan oleh `computeStats()` (`src/lib/applications.ts`)
  sehingga otomatis ikut berubah saat tambah/pindah/edit/hapus tanpa fetch tambahan.
  Empat kartu `<dl>` (grid `grid-cols-2 lg:grid-cols-4`): Total, Active (bukan
  REJECTED), In Progress (APPLIED + INTERVIEW), Offers. Angka memakai warna netral
  (warna status hanya untuk konteks status). Skeleton memuat juga menampilkan empat
  placeholder kartu. Keputusan pemilik: **statistik mengikuti filter** (dihitung dari
  daftar hasil filter, bukan data penuh).
- **Filter/search (langkah 12):** sepenuhnya client-side (data personal kecil), state
  di `KanbanBoard`, tidak disimpan di URL dan hilang saat refresh. Logika murni di
  `src/lib/applications.ts`: `filterApplications()`, `matchesFilters()`,
  `hasActiveFilters()`, `EMPTY_FILTERS`. Bilah `role="search"` di bawah statistik:
  input cari (judul/perusahaan, case-insensitive; setiap kata harus cocok di judul
  atau perusahaan; karakter khusus dicocokkan literal), select platform, select tipe;
  semua kondisi aktif digabung (AND). Baris info menampilkan "Showing X of Y" +
  tombol **Clear filters** saat filter aktif. Filter berlaku untuk kolom, section
  Rejected, dan statistik. Jika tak ada hasil: "No applications match your filters."
  Jika lamaran baru/diedit tidak cocok dengan filter aktif, muncul catatan bahwa ia
  tersembunyi oleh filter. Filter status tidak disediakan (kolom sudah per status).

**Kartu lamaran** menampilkan (urutan dari atas ke bawah):
1. Judul posisi — `text-sm font-semibold line-clamp-1`
2. Badge tipe (Job / Internship) — netral `border border-outline-variant bg-surface-low text-on-surface-variant`
3. Nama perusahaan + ikon `Briefcase`
4. Platform asal — `font-mono text-[11px]`
5. Lokasi — `MapPin` icon, hanya jika ada
6. Waktu applied — `timeAgo()` function
7. Footer kartu: tombol ExternalLink (jika URL ada) + tombol "Next →"
8. Preview notes — `italic line-clamp-2`, hanya jika ada

**Empty state kolom:**
```tsx
<div className="flex flex-col items-center justify-center py-12 border-2
  border-dashed border-outline-variant rounded-xl text-on-surface-variant">
  <AlertCircle className="w-8 h-8 mb-2 opacity-30" />
  <p className="text-xs">No applications in this stage</p>
</div>
```

### Modal — Pattern Wajib (Sama dengan MyLamaran)

```tsx
// Struktur modal — header & footer sticky, body scrollable
<div className="flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]
  bg-surface-lowest rounded-xl border border-outline-variant shadow-2xl w-full">

  {/* Header — sticky */}
  <div className="flex shrink-0 items-start justify-between gap-3
    border-b border-outline p-4 sm:p-6">
    ...title + close button...
  </div>

  {/* Body — scrollable */}
  <div className="modal-scrollbar min-h-0 flex-1 overflow-y-auto
    overscroll-contain space-y-4 p-4 sm:p-6">
    ...form fields...
  </div>

  {/* Footer — sticky */}
  <div className="flex shrink-0 justify-end gap-3
    border-t border-outline p-4 sm:px-6">
    ...buttons...
  </div>
</div>
```

**Input di mobile:** tambahkan `text-base` agar tidak ada auto-zoom di iOS:
```
[&_input]:text-base [&_select]:text-base [&_textarea]:text-base
sm:[&_input]:text-sm sm:[&_select]:text-sm sm:[&_textarea]:text-sm
```

### Statistik Header

```tsx
// 4 kartu stat di atas kanban
{ label: 'Total',      value: applications.length }
{ label: 'Active',     value: applications.filter(a => a.status !== 'REJECTED').length }
{ label: 'In Progress',value: applications.filter(a => ['APPLIED','INTERVIEW'].includes(a.status)).length }
{ label: 'Offers',     value: applications.filter(a => a.status === 'OFFER').length }
```

---

## 10. PWA

### public/manifest.json

```json
{
  "name": "InternSit",
  "short_name": "InternSit",
  "description": "Kelola status lamaran kerja dan magang kamu dalam satu tempat.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#0B0F14",
  "theme_color": "#0B0F14",
  "icons": [
    { "src": "/icon-192.png",        "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png",        "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-512.png","sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### next-pwa config (next.config.ts)

```ts
import withPWA from 'next-pwa';

const config = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  skipWaiting: true,
  runtimeCaching: [], // hanya cache /_next/static/ saja (default next-pwa)
})({
  // next config biasa di sini
});

export default config;
```

Konfigurasi PWA di atas masih rencana langkah 13, bukan fitur yang sudah terpasang.
Jangan cache halaman yang butuh sesi (`/` dan route privat lain), respons API
lamaran, atau respons login/logout. Aset PWA publik tidak berarti data privat boleh
tersedia dari cache tanpa sesi.

---

## 11. Dark Mode

```ts
// src/lib/theme.ts
export function initTheme() {
  const saved = localStorage.getItem('theme');
  document.documentElement.classList.toggle('dark', saved !== 'light');
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
```

Panggil `initTheme()` di `layout.tsx` via inline script (sebelum render) untuk
mencegah flash of unstyled content (FOUC). Default: dark.

---

## 12. Aturan untuk AI Agent

- Baca dokumen ini sepenuhnya sebelum menulis kode apapun.
- Ikuti design system di Section 8 ketat — jangan improvise warna atau font baru.
- Scope ketat sesuai Section 3. Jangan tambahkan fitur di luar itu.
- Semua API lamaran wajib dilindungi session middleware dan memverifikasi sesi
  lagi di handler (`src/lib/auth.ts`); API tanpa sesi harus `401`. `/api/login`
  publik; `/api/logout` dilindungi. Tidak ada ownership clause/`user_id` di MVP.
- Jangan masukkan nilai secret/credential ke dokumentasi atau source; gunakan
  nama env saja (`DATABASE_URL`, `APP_PASSWORD`, `AUTH_SECRET`).
- Gunakan Drizzle ORM — jangan raw SQL kecuali untuk migration file.
- Zod schema di-share antara client (form validation) dan server (API validation).
- Modal pattern: header sticky + body scrollable + footer sticky. Lihat Section 9.
- Jangan commit perubahan kecuali diminta eksplisit.
- Jangan tambah dependensi tanpa alasan jelas.

---

## 13. Urutan Pengerjaan (14 Langkah)

```
1.  [SELESAI] Init Next.js 15 App Router + TypeScript + Tailwind CSS v3
2.  [SELESAI] Setup Neon Postgres + Drizzle ORM + migration schema applications
3.  [SELESAI] Single password gate — auth.ts, middleware, login/logout + cookie sesi
4.  [SELESAI] globals.css + tailwind.config.ts (design system tokens)
5.  [SELESAI] Sidebar desktop + native mobile dialog + dark mode toggle + logout
6.  [SELESAI] Kanban dengan data dummy (kini digantikan data nyata di langkah 8)
7.  [SELESAI] API GET POST PATCH DELETE /api/applications + Zod + sesi
8.  [SELESAI] Sambungkan Kanban ke API — fetch real data dari Neon
9.  [SELESAI] Modal Add Application (form lengkap)
10. [SELESAI] Modal Edit Application (form + hapus)
11. [SELESAI] Statistik header (hitung dari data)
12. [SELESAI] Filter/search (client-side atau query param)
13. [BERIKUTNYA] PWA — manifest.json, ikon, next-pwa, offline.html
14. Deploy ke Vercel — env DATABASE_URL + APP_PASSWORD + AUTH_SECRET, test install di HP
```

---

## 14. Pola dari MyLamaran — Adaptasi Langsung

Pola berikut sudah teruji di MyLamaran, salin dan sesuaikan:

| Pola | Detail |
|---|---|
| Kanban grid | `grid grid-cols-1 xl:grid-cols-3 gap-4 xl:gap-6 items-start` |
| Kartu | `bg-surface-lowest border-2 border-outline hover:border-primary rounded-xl p-4 motion-safe:hover:-translate-y-0.5 motion-safe:transition-all` — `cursor-pointer` hanya saat aksi edit tersedia (langkah 10) |
| Modal | `flex flex-col max-h-[calc(100dvh-3rem)]` — header/footer `shrink-0`, body `flex-1 overflow-y-auto` |
| Scrollbar | class `.modal-scrollbar` — lihat Section 8 globals.css |
| timeAgo | `const diff = Date.now() - new Date(iso).getTime(); const h = Math.floor(diff/3600000); if (h<1) return 'Just now'; if (h<24) return h+'h ago'; return Math.floor(h/24)+'d ago';` |
| Status badge | Selalu label teks + warna, tidak hanya warna |
| Sidebar mobile | Native `<dialog>` kanan: `fixed top-16 right-0 bottom-0 w-72`, `showModal()`, focus lock + Escape/backdrop + body scroll lock; animasi `motion-safe` |
| Dark toggle | Toggle class `dark` di `document.documentElement` + simpan ke `localStorage` |
| Type toggle | Segmented control dua tombol: active = `bg-primary text-on-primary shadow-sm` |
| Empty state | `border-2 border-dashed border-outline-variant rounded-xl` + ikon opacity-30 |
| Rejected section | Section terpisah bawah kanban, header rose, `grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4` |

**Koreksi token MyLamaran:** gunakan `bg-surface-lowest`, bukan
`bg-surface-container-lowest` yang tidak terdaftar di konfigurasi Section 8.
Gunakan `hover:border-primary`, bukan `hover:border-primary/40`: `primary` memakai
CSS variable bernilai hex (`var(--color-primary)`), bukan format warna dengan
`<alpha-value>`, sehingga modifier opacity `/40` tidak didukung oleh konfigurasi
Tailwind v3 ini. Jangan mengubah token design system untuk mengakalinya.

---

## 15. Cara Menggunakan File Ini di Project & Thread Baru

### Workflow Project yang Sudah Diinisialisasi

Gunakan **Node.js 24 LTS** (lokal saat ini 24.11.1), termasuk untuk native TypeScript
stripping pada unit test. Project sudah memakai **Next.js 15.5.29 + Tailwind CSS 3.4.19**. Jangan jalankan
ulang scaffolding `create-next-app` atau install `latest` yang dapat mengubah stack
ke Next.js 16 / Tailwind CSS 4. Pertahankan `package-lock.json` dan versi project.

Dari root project, setelah menyiapkan env lokal:

```bash
npm ci
npm run dev
```

**Output development dan production dipisahkan** di `next.config.ts`:
- `npm run dev` menggunakan `.next-dev/`.
- `npm run build` dan `npm start` menggunakan `.next/`.
- Jangan menyatukan kembali kedua folder: production build yang menimpa output dev
  saat dev server berjalan pernah menyebabkan CSS/chunk JavaScript `404` dan error
  `Cannot find module` (`500`). `.next-dev/` diabaikan Git/ESLint dan tipe hasil
  generate-nya disertakan di `tsconfig.json`.
- Jika browser masih meminta chunk lama setelah restart, lakukan hard refresh
  (`Ctrl+Shift+R`). Jika perlu membersihkan cache output, hentikan server terkait
  terlebih dahulu; jangan hapus output server yang sedang aktif.

Nama env yang diperlukan di `.env.local` (isi secara privat, jangan commit nilainya):
- `DATABASE_URL` — koneksi Neon Postgres.
- `APP_PASSWORD` — password personal workspace.
- `AUTH_SECRET` — secret kuat untuk tanda tangan sesi; rotasi membatalkan sesi lama.

Script database yang sudah tersedia (jalankan hanya sesuai kebutuhan):

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

`db:generate` membuat migration dari `src/db/schema.ts`; `db:migrate` menerapkannya
ke database yang dikonfigurasi; `db:studio` membuka UI database. Untuk validasi kode
tersedia `npm test` (unit test `nextStatus()`/`timeAgo()` di
`tests/applications.test.mjs`, schema Zod di `tests/schemas.test.mjs`, dan client API
di `tests/applications-client.test.mjs`; UI form belum punya test otomatis),
`npm run lint`, dan `npm run build`. Jangan menambahkan dependensi form/PWA sebelum
langkahnya.

Buka **http://localhost:3000** setelah `npm run dev`, lalu login dengan nilai
`APP_PASSWORD` dari `.env.local`. Perubahan kode tampil lewat hot reload. Kanban kini
membaca dan menyimpan ke Neon: klik Next langsung tersimpan, dan tombol Add
application menambah lamaran baru. Uji dark/light lewat toggle tema di sidebar/drawer.

### Cara Pakai di Thread Baru Zed

1. **Buka folder `InternSit` di Zed** — `File > Open Folder`
2. **Buka Agent panel** (Ctrl+? atau ikon robot)
3. **Mulai thread baru**, ketik perintah pembuka ini:

```
Baca file CONTEXT.md terlebih dahulu secara menyeluruh.
Setelah selesai, konfirmasi bahwa kamu sudah memahami:
- Apa itu InternSit dan apa yang membedakannya dari MyLamaran
- Tech stack yang dipakai
- Design system (warna, font, token)
- Scope MVP yang ketat
Periksa status terkini di Section 13 dan source sebelum melanjutkan.
Langkah 1–12 sudah selesai; Kanban membaca/menyimpan data Neon, Next menyimpan status,
modal Add dan Edit/hapus, statistik, serta filter/search berfungsi (statistik mengikuti
filter). Belum ada PWA dan deploy. Jangan mengulang setup. Lanjutkan langkah 13 bila
diminta.
```

4. Agent akan membaca `CONTEXT.md` dan langsung punya semua konteks
   tanpa perlu penjelasan ulang dari nol.

---

*Dokumen ini adalah sumber kebenaran tunggal untuk project InternSit.
Jika ada ambiguitas, tanya pemilik project — jangan asumsikan sendiri.*
