# AEROFLOW LAB

Interactive Aerodynamic Wind Tunnel, Eulerian Navier-Stokes Fluid Telemetry, and Acoustic Vortex Shedding Simulator.

AeroFlow Lab adalah simulator terowongan angin aerodinamika interaktif berbasis peramban web. Sistem ini memecahkan persamaan fluida Navier-Stokes 2D tak termampatkan (incompressible) secara real-time langsung di atas GPU/CPU melalui HTML5 Canvas, dilengkapi pelacak asap laser (streakline smoke rake), telemetri koefisien gaya angkat (Lift) dan hambat (Drag), serta generator akustik prosedural berbasis Web Audio API.

---

## Fitur Utama

- **Solver Navier-Stokes Eulerian**: Algoritma adveksi Semi-Lagrangian yang stabil tanpa ledakan numerik, dipadukan dengan pemecah tekanan Jacobi Poisson (22 iterasi per frame) untuk menjamin divergensi nol (kondisi inkompresibilitas).
- **Vorticity Confinement (Fedkiw et al.)**: Mengurangi redaman numerik bawaan metode grid diskrit, menjaga ketajaman struktur pusaran dan memicu terbentuknya fenomena Von Karman vortex street di belakang benda tumpul secara natural.
- **Kalkulasi Gaya Aerodinamika Real-Time**: Integrasi langsung tekanan permukaan pada batas benda padat untuk menghitung gaya angkat (Lift, CL), gaya hambat (Drag, CD), rasio efisiensi L/D, serta deteksi stall otomatis saat lapisan batas (boundary layer) mengalami separasi arus.
- **Preset Geometri Aerodinamika**:
  1. NACA 0012: Airfoil simetris standar penerbangan untuk analisis sudut serang dan stall.
  2. NACA 4412: Airfoil berlekuk (cambered) yang menghasilkan gaya angkat positif pada sudut nol derajat.
  3. Silinder Pejal: Menampilkan pembentukan deret pusaran Von Karman bolak-balik.
  4. Sayap Formula 1: Profil sayap terbalik dengan Gurney flap untuk menghasilkan downforce tinggi.
  5. Supersonic Diamond Wedge: Profil baji tajam berhambatan rendah.
  6. Flat Plate: Menampilkan pemisahan arus ekstrem dan olakan turbulen masif.
  7. Mode Gambar Bebas: Gambar atau hapus rintangan khusus secara langsung menggunakan kursor mouse atau layar sentuh.
- **Lima Mode Visualisasi Khusus**:
  1. Wind Tunnel Smoke: Rake filamen asap laser dengan partikel pelacak Lagrangian.
  2. Pressure Gradient: Peta gradien tekanan Bernoulli (merah untuk stagnasi tinggi, biru untuk hisapan angkat).
  3. Vorticity & Cores: Visualisasi putaran vorteks searah jarum jam (oranye) dan berlawanan jarum jam (sian).
  4. Optical Schlieren: Simulasi foto shadowgraph optik NASA berdasarkan deviasi gradien indeks refraksi udara.
  5. Velocity Vectors: Grid panah vektor arah dan kecepatan aliran lokal.
- **Sintesis Audio Prosedural**: Pembangkit deru angin (pink noise filter), nada siulan pusaran berdasarkan frekuensi Strouhal (f = St * U / D), dan gemuruh getaran stall frekuensi rendah tanpa sampel audio eksternal.

---

## Persamaan Matematika dan Fisika

Sistem fluida memecahkan persamaan konservasi momentum Navier-Stokes:

$$
\frac{\partial \vec{u}}{\partial t} + (\vec{u} \cdot \nabla)\vec{u} = -\frac{1}{\rho}\nabla p + \nu \nabla^2 \vec{u} + \vec{f}
$$

Dengan syarat inkompresibilitas:

$$
\nabla \cdot \vec{u} = 0
$$

Gaya angkat dan gaya hambat dievaluasi dari integral tegangan tekanan di sepanjang kontur permukaan tertutup rintangan:

$$
\vec{F} = \oint_{\partial \Omega} -p \, \hat{n} \, ds
$$

Koefisien aerodinamika tanpa dimensi:

$$
C_L = \frac{2 F_L}{\rho U_\infty^2 c}, \quad C_D = \frac{2 F_D}{\rho U_\infty^2 c}
$$

Siulan aeroakustik pusaran dihitung lewat relasi bilangan Strouhal (St sekitar 0.21):

$$
f_{shed} = St \cdot \frac{U_\infty}{D}
$$

---

## Pintasan Tombol (Keyboard Shortcuts)

| Tombol | Fungsi |
|---|---|
| `Space` | Menjeda atau melanjutkan simulasi |
| `M` | Menyalakan atau mematikan synthesizer audio aeroakustik |
| `R` | Mereset arus dan menyegarkan medan fluida |
| `C` | Membersihkan kanvas untuk mode gambar bebas |
| `1` sampai `6` | Memilih model preset geometri secara cepat |
| `Drag Mouse` | Menggeser posisi model airfoil di dalam lorong angin |
| `Klik Kanan` | Menghapus bagian rintangan pada mode gambar bebas |

---

## Cara Menjalankan

Proyek ini dibangun murni menggunakan standar web modern (Vanilla ES Modules, Canvas 2D, Web Audio API) tanpa dependensi eksternal, bundler, maupun instalasi npm.

1. Buka berkas `index.html` langsung di peramban web modern (Google Chrome, Firefox, Safari, atau Edge).
2. Atau jalankan server lokal ringan jika diinginkan:
   ```bash
   npx serve .
   # atau
   python -m http.server 8000
   ```
3. Akses `http://localhost:8000` di peramban Anda.

---

## Lisensi

Didistribusikan di bawah Lisensi MIT. Lihat berkas `LICENSE` untuk rincian lengkap.
