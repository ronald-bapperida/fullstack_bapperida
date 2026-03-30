# Panduan Deployment — Portal Admin BAPPERIDA Kalimantan Tengah

Panduan ini menjelaskan cara deploy aplikasi di server **Ubuntu** (20.04/22.04/24.04 LTS).

---

## Prasyarat

- Ubuntu 20.04 / 22.04 / 24.04 LTS
- Node.js 20+
- PostgreSQL 14+
- Git

---

## 1. Instalasi Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # seharusnya v20.x.x
```

---

## 2. Instalasi PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Jalankan PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Buat database dan user
sudo -u postgres psql <<EOF
CREATE USER bapperida WITH PASSWORD 'password_anda';
CREATE DATABASE heliumdb OWNER bapperida;
GRANT ALL PRIVILEGES ON DATABASE heliumdb TO bapperida;
EOF
```

Setelah database siap, set environment variable:

```bash
export DATABASE_URL="postgresql://bapperida:password_anda@localhost/heliumdb"
```

---

## 3. Instalasi LibreOffice (SANGAT DIANJURKAN)

LibreOffice digunakan untuk konversi **DOCX → PDF** dengan akurasi tinggi.
Tanpa LibreOffice, aplikasi akan fallback ke konversi via Puppeteer (kualitas lebih rendah).

### Ubuntu 22.04 / 24.04

```bash
sudo apt update
sudo apt install -y libreoffice libreoffice-writer

# Verifikasi instalasi
libreoffice --version
# Contoh output: LibreOffice 7.3.7.2 ...
```

### Ubuntu 20.04 (jika versi dari apt terlalu lama)

```bash
# Tambahkan PPA LibreOffice terbaru
sudo add-apt-repository ppa:libreoffice/ppa
sudo apt update
sudo apt install -y libreoffice libreoffice-writer

libreoffice --version
```

### Test konversi DOCX → PDF manual

```bash
# Test konversi manual
soffice --headless --convert-to pdf --outdir /tmp /path/ke/file.docx
# Hasil: /tmp/file.pdf
```

### Font tambahan (opsional, untuk memastikan font Times New Roman tersedia)

```bash
sudo apt install -y ttf-mscorefonts-installer
sudo fc-cache -fv
```

> **Catatan**: Jika `ttf-mscorefonts-installer` tidak tersedia, pasang manual:
> ```bash
> sudo apt install -y fontconfig
> sudo cp /path/ke/font/*.ttf /usr/local/share/fonts/
> sudo fc-cache -fv
> ```

---

## 4. Instalasi Puppeteer / Chromium (fallback jika LibreOffice tidak dipakai)

Jika LibreOffice **tidak** diinstal, aplikasi menggunakan Puppeteer untuk konversi PDF.
Puppeteer membutuhkan dependensi berikut di Ubuntu:

```bash
sudo apt install -y \
  libglib2.0-0 libglib2.0-dev \
  libnss3 libnss3-dev \
  libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2 \
  libpango-1.0-0 libcairo2 \
  fonts-liberation

# Install Chrome via Puppeteer
npx puppeteer browsers install chrome
```

---

## 5. Clone dan Setup Aplikasi

```bash
# Clone repository
git clone <repo-url> /opt/bapperida
cd /opt/bapperida

# Install dependencies
npm install

# Set environment variables
cat > .env <<EOF
DATABASE_URL=postgresql://bapperida:password_anda@localhost/heliumdb
JWT_SECRET=ganti_dengan_secret_panjang_dan_acak
NODE_ENV=production
EOF

# Buat direktori uploads
mkdir -p uploads/letters uploads/permits uploads/templates

# Jalankan migrasi
npx tsx server/migrate.ts

# Build frontend
npm run build
```

---

## 6. Jalankan Aplikasi

### Menggunakan PM2 (dianjurkan untuk production)

```bash
# Install PM2
sudo npm install -g pm2

# Jalankan aplikasi
pm2 start "node dist/index.js" --name bapperida

# Atau untuk development mode
pm2 start "npx tsx server/index.ts" --name bapperida

# Auto-start saat server restart
pm2 startup
pm2 save
```

### Cek status

```bash
pm2 status
pm2 logs bapperida
```

---

## 7. Setup Nginx Reverse Proxy (opsional)

```bash
sudo apt install -y nginx

sudo cat > /etc/nginx/sites-available/bapperida <<'EOF'
server {
    listen 80;
    server_name domain-anda.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/bapperida /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. Urutan Prioritas Konversi DOCX → PDF

Aplikasi menggunakan metode konversi secara berurutan:

| Prioritas | Metode | Akurasi | Keterangan |
|-----------|--------|---------|------------|
| 1 | **LibreOffice headless** | ⭐⭐⭐⭐⭐ | Terbaik — hasil identik dengan dokumen asli |
| 2 | Mammoth + Puppeteer | ⭐⭐⭐ | Fallback — digunakan jika LibreOffice tidak ada |
| 3 | HTML (browser view) | ⭐⭐ | Fallback akhir jika Puppeteer/Chrome tidak ada |

**Rekomendasi**: Selalu install LibreOffice di server production untuk hasil PDF yang akurat.

---

## 9. Verifikasi Instalasi

Setelah semua terinstall, cek status dengan:

```bash
# Cek Node.js
node -v

# Cek PostgreSQL
psql --version

# Cek LibreOffice
libreoffice --version
# atau
soffice --version

# Cek koneksi database
psql $DATABASE_URL -c "SELECT version();"

# Cek aplikasi berjalan
curl http://localhost:5000/api/news
```

---

## 10. Default Credentials

| Username | Password | Role |
|----------|----------|------|
| superadmin | Admin@123 | Super Admin |
| admin_bpp | Admin@123 | Admin BAPPEDA |
| admin_rida | Admin@123 | Admin RIDA |

> **Penting**: Ganti password default setelah pertama kali login di production!
