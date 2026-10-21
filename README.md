# Pengurusan Pesakit Dialisis

Aplikasi web untuk memantau pesakit hemodialisis dari beberapa centre. Ia merekod sesi dialisis, rekod darah, dan mengira UF seterusnya berbanding berat kering. Ada juga tip makanan dan penjagaan tapak fistula, graft, serta kateter.

Data contoh sepuluh pesakit rekaan dimuatkan pada pelayar. Ia bukan rekod klinikal.

## Teknologi

| Lapisan | Pilihan | Sebab |
| --- | --- | --- |
| Antara muka | Next.js, React, TypeScript | Satu projek untuk halaman dan borang. Sesuai untuk Netlify dan Vercel. |
| Gaya | Tailwind CSS dan shadcn/ui | Komponen borang, dialog, dan jadual yang boleh diubah. |
| Carta | Recharts | Trend berat tiba, berat selepas, dan berat kering. |
| Pangkalan data | Supabase (Postgres) | Beberapa centre, hubungan pesakit–sesi–darah, dan polisi akses pada baris. |
| Hos | Netlify | `netlify.toml` sedia dengan pemalam Next.js. |

Supabase dipilih kerana data ini berjadual: centre, pesakit, sesi, dan makmal. Postgres menguatkuasakan hubungan dan keunikan satu sesi bagi setiap pesakit pada satu tarikh. Polisi baris boleh dihadkan kepada staf centre tertentu apabila log masuk ditambah. Kunci `service_role` tidak digunakan dalam pelayar.

Jika pembolehubah Supabase kosong, aplikasi menyimpan data dalam `localStorage`. Sambungan tidak wajib untuk mencuba aplikasi. Apabila Supabase diisi, pesakit mendaftar sendiri dan super admin meluluskan permohonan.

## Jalankan tempatan

```bash
npm install
npm run dev
```

Buka `http://127.0.0.1:47231` jika pelayan dimulakan dengan port itu, atau port yang Next.js paparkan.

```bash
npm test
npm run lint
```

## Sambung Supabase

1. Cipta projek di [supabase.com](https://supabase.com).
2. Buka SQL Editor dan jalankan `supabase/schema.sql`. Projek yang sudah ada jadual jalankan `supabase/access.sql` sekali.
3. Dalam Authentication → Providers → Email, matikan **Confirm email** supaya pendaftaran terus aktif.
4. Salin `.env.example` ke `.env.local`.
5. Isi `NEXT_PUBLIC_SUPABASE_URL` (bermula dengan `https://`, tanpa awalan `db.`) dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (kunci publishable).
6. Buka laman, tekan **Daftar super admin**, dan cipta emel serta kata laluan. Butang **Jana** membuat kata laluan. Akaun ini hanya boleh dicipta sekali.
7. Pesakit tekan **Daftar permohonan pesakit** dan memilih kata laluan sendiri. Super admin meluluskan di halaman **Permohonan**. Selepas itu pesakit log masuk dan mengisi sesi serta rekod darah sendiri.
8. Jalankan `supabase/portal.sql` sekali. Ia menambah medan sesi dan menutup bacaan rekod kesihatan oleh super admin. Rekod sedia ada tidak dipadam.
9. Jalankan `supabase/darah.sql` sekali untuk laporan makmal. Ia menambah jadual dokumen, keputusan, audit, dan analisis, serta bucket peribadi `lab-reports`. Ia tidak memadam rekod darah lama. Tiada kunci OCR atau model bahasa disimpan dalam aplikasi. PDF yang ada teks dibaca di pelayar. Imej tidak diekstrak secara automatik.

Pesakit yang diluluskan hanya membaca dan menulis rekod sendiri. Super admin melihat semua rekod dan permohonan. Kunci publishable tanpa sesi tidak boleh membaca rekod klinikal.

## Hos di Netlify

1. Tolak repositori ini ke hos Git yang Netlify boleh baca.
2. Cipta laman baharu daripada repositori. Arahan binaan dan pemalam dibaca dari `netlify.toml`.
3. Tambah dua pembolehubah persekitaran yang sama seperti `.env.local`.
4. Terbitkan laman.

Next.js pada Netlify memerlukan Node 22, sudah ditetapkan dalam `netlify.toml`.

## Logik UF

Apabila pesakit tiba:

- **UF seterusnya** = berat selepas dialisis terakhir − berat semasa tiba. Nilai negatif bermaksud berat naik.
- **Penambahan cecair (IDWG)** = berat semasa tiba − berat selepas terakhir.
- **UF untuk capai berat kering** = berat semasa tiba − berat kering.

Dua angka UF tidak semestinya sama.

- Jika sesi lepas tamat pada berat kering, UF sasaran hampir sama dengan cecair yang baru naik.
- Jika sesi lepas masih di atas berat kering, UF sasaran lebih besar kerana baki cecair lama belum dibuang.
- Jika sesi lepas sudah di bawah berat kering, UF sasaran lebih kecil. Jangan tarik semua cecair yang naik.

Amaran dalam aplikasi:

- Penambahan cecair melebihi 5% berat kering ditanda tinggi. Antara 4% dan 5% dipantau.
- Kadar UF sasaran melebihi 13 mL/kg/jam, pada tempoh yang direkodkan, ditanda terlalu laju.
- Berat selepas dalam 0.3 kg dari berat kering dikira capai sasaran.

UF dikira dalam aplikasi, bukan disimpan sebagai lajur, supaya rumus kekal di satu tempat.

## Rekod darah

Sasaran pada borang manual ialah julat pemantauan dialisis yang lazim, contohnya hemoglobin 10–12 g/dL, kalium 3.5–5.5 mmol/L, dan URR sekurang-kurangnya 65%. Kreatinin dipaparkan sebagai trend kerana nilainya sentiasa tinggi pada pesakit dialisis.

Laporan PDF atau imej disimpan secara peribadi dan tidak terus menjadi rekod. Pesakit menyemak nilai, unit, dan tarikh sebelum pengesahan. Carta dan analisis hanya menggunakan keputusan yang disahkan serta rekod manual yang sedia ada. Unit yang berbeza tidak digabung. Analisis `peraturan-darah-v1` memetik tarikh dan nilai yang tersimpan. Ia bukan diagnosis dan tidak menetapkan ubat, dos, atau perubahan dialisis.

## Penafian

Aplikasi ini tidak menggantikan doktor, jururawat dialisis, atau preskripsi centre. Had cecair, ubat pengikat fosfat, dan berat kering adalah keputusan klinikal individu.
