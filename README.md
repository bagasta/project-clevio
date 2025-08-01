# Clevio Pro - WhatsApp Management System

Clevio Pro adalah sistem manajemen WhatsApp yang komprehensif yang menggabungkan dashboard web yang intuitif dengan API WhatsApp yang powerful. Sistem ini memungkinkan Anda untuk mengelola multiple sesi WhatsApp, mengirim pesan, media, dan melakukan berbagai operasi WhatsApp melalui interface web yang user-friendly atau melalui RESTful API.

## 🚀 Fitur Utama

### Dashboard Web
- **Multi-Session Management**: Kelola multiple akun WhatsApp dalam satu dashboard
- **Real-time Updates**: Monitoring status sesi secara real-time menggunakan Server-Sent Events
- **QR Code Scanner**: Tampilan QR code untuk pairing device WhatsApp
- **Webhook Configuration**: Konfigurasi webhook untuk setiap sesi
- **Session Control**: Create, delete, dan rescan sesi WhatsApp
- **Secure Authentication**: Login system dengan session management

### WhatsApp API
- **Message Sending**: Kirim pesan teks, media, sticker, dan lokasi
- **Group Management**: Buat grup, kelola member, dan atur permissions
- **Chat Operations**: Mute/unmute chat, pin/unpin messages
- **Media Support**: Kirim gambar, video, audio, dan dokumen
- **Sticker Support**: Kirim sticker dengan metadata lengkap
- **Location Sharing**: Kirim lokasi dengan koordinat dan alamat
- **Message Reactions**: React ke pesan dengan emoji
- **Reply Messages**: Balas pesan dengan quote
- **Poll Creation**: Buat polling dalam grup atau chat

## 📁 Struktur Project

```
clevio-pro/
├── dashboard-server/           # Dashboard web server
│   ├── dashboard-server.js    # Main server file
│   └── package.json          # Dependencies untuk dashboard
├── whatsapp-api/             # WhatsApp API server
│   ├── whatsapp-api.js       # Main API file
│   └── package.json          # Dependencies untuk API
├── public/                   # Static files untuk dashboard
│   ├── dashboard.html        # Dashboard page
│   ├── login.html           # Login page
│   └── js/
│       ├── dashboard.js      # Dashboard JavaScript
│       ├── dashboard-api.js  # API client (legacy)
│       └── login.js          # Login JavaScript
├── .env                      # Environment variables
├── .gitignore               # Git ignore rules
├── package.json             # Root package.json
├── start.sh                 # Startup script
└── README.md                # Dokumentasi ini
```

## 🛠️ Instalasi

### Prerequisites
- Node.js (versi 16 atau lebih tinggi)
- npm atau yarn
- Google Chrome atau Chromium (untuk Puppeteer)

### Langkah Instalasi

1. **Clone atau download project**
   ```bash
   # Jika menggunakan git
   git clone <repository-url>
   cd clevio-pro
   
   # Atau extract file zip ke folder clevio-pro
   ```

2. **Install dependencies**
   ```bash
   # Install dependencies untuk semua komponen
   npm run install-all
   
   # Atau install manual
   cd dashboard-server && npm install
   cd ../whatsapp-api && npm install
   cd ..
   ```

3. **Konfigurasi environment variables**
   
   File `.env` sudah disediakan dengan konfigurasi default:
   ```env
   # Dashboard Configuration
   USERNAME=admin
   PASSWORD=admin123
   SESSION_SECRET=clevio_secret
   DASHBOARD_PORT=4000
   
   # API Configuration
   PORT=3000
   ```
   
   Anda dapat mengubah nilai-nilai ini sesuai kebutuhan.

## 🚀 Menjalankan Aplikasi

### Menggunakan Script Startup (Recommended)
```bash
# Memberikan permission execute (hanya sekali)
chmod +x start.sh

# Menjalankan aplikasi
./start.sh
```

### Menggunakan npm Scripts
```bash
# Menjalankan kedua server secara bersamaan
npm start

# Atau menjalankan secara terpisah
npm run start:dashboard  # Dashboard di port 4000
npm run start:api       # API di port 3000

# Untuk development dengan auto-reload
npm run dev
```

### Manual
```bash
# Terminal 1 - Dashboard Server
cd dashboard-server
npm start

# Terminal 2 - WhatsApp API Server
cd whatsapp-api
npm start
```

## 🌐 Akses Aplikasi

Setelah aplikasi berjalan:

- **Dashboard Web**: http://localhost:4000
- **WhatsApp API**: http://localhost:3000
- **Login Credentials**: 
  - Username: `admin`
  - Password: `admin123`

## 📖 Panduan Penggunaan

### Dashboard Web

1. **Login**
   - Buka http://localhost:4000
   - Masukkan username dan password (default: admin/admin123)

2. **Membuat Sesi WhatsApp Baru**
   - Klik tombol "Create Session"
   - Masukkan nama sesi (unik)
   - Opsional: masukkan webhook URL
   - Klik "Create Session"

3. **Scan QR Code**
   - Setelah sesi dibuat, status akan menunjukkan "qr"
   - Klik icon QR code untuk menampilkan QR
   - Scan QR code menggunakan WhatsApp di ponsel Anda
   - Status akan berubah menjadi "ready" setelah berhasil

4. **Mengelola Sesi**
   - **Edit Webhook**: Klik icon edit untuk mengubah webhook URL
   - **Rescan**: Klik icon refresh untuk generate QR code baru
   - **Delete**: Klik icon trash untuk menghapus sesi

### WhatsApp API

API menyediakan berbagai endpoint untuk operasi WhatsApp:

#### Status dan QR Code
```bash
# Cek status client
GET http://localhost:3000/status

# Dapatkan QR code
GET http://localhost:3000/qr
```

#### Mengirim Pesan
```bash
# Kirim pesan teks
POST http://localhost:3000/messages/send
Content-Type: application/json

{
  "chatId": "6281234567890@c.us",
  "content": "Hello World!"
}

# Kirim media
POST http://localhost:3000/messages/send-media
Content-Type: application/json

{
  "chatId": "6281234567890@c.us",
  "mimetype": "image/jpeg",
  "data": "base64-encoded-image-data",
  "filename": "image.jpg",
  "caption": "Ini adalah gambar"
}

# Kirim lokasi
POST http://localhost:3000/messages/send-location
Content-Type: application/json

{
  "chatId": "6281234567890@c.us",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "name": "Jakarta",
  "address": "Jakarta, Indonesia"
}
```

#### Manajemen Grup
```bash
# Buat grup baru
POST http://localhost:3000/groups
Content-Type: application/json

{
  "title": "Grup Test",
  "participants": ["6281234567890@c.us", "6289876543210@c.us"]
}

# Tambah member ke grup
POST http://localhost:3000/groups/{groupId}/add-participants
Content-Type: application/json

{
  "participantIds": ["6281234567890@c.us"]
}
```

## 🔧 Konfigurasi

### Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `USERNAME` | admin | Username untuk login dashboard |
| `PASSWORD` | admin123 | Password untuk login dashboard |
| `SESSION_SECRET` | clevio_secret | Secret key untuk session |
| `DASHBOARD_PORT` | 4000 | Port untuk dashboard server |
| `PORT` | 3000 | Port untuk WhatsApp API server |

### Webhook Configuration

Webhook memungkinkan Anda menerima notifikasi real-time untuk:
- Pesan masuk
- Status perubahan
- Event grup
- Dan lainnya

Konfigurasi webhook dapat dilakukan melalui dashboard atau API.

## 🛡️ Security

### Rekomendasi Keamanan

1. **Ubah Credentials Default**
   ```env
   USERNAME=your_secure_username
   PASSWORD=your_strong_password
   SESSION_SECRET=your_random_secret_key

   CLEVIO_USERNAME=admin
   CLEVIO_PASSWORD=rahasia123
   SESSION_SECRET=keyboardcat

   ```

2. **Gunakan HTTPS di Production**
   - Setup reverse proxy (nginx/apache)
   - Install SSL certificate
   - Redirect HTTP ke HTTPS

3. **Firewall Configuration**
   - Batasi akses ke port yang diperlukan
   - Gunakan VPN untuk akses remote

4. **Regular Updates**
   - Update dependencies secara berkala
   - Monitor security vulnerabilities

## 🚀 Deployment

### Production Deployment

1. **Menggunakan PM2**
   ```bash
   # Install PM2
   npm install -g pm2
   
   # Start aplikasi dengan PM2
   pm2 start dashboard-server/dashboard-server.js --name "clevio-dashboard"
   pm2 start whatsapp-api/whatsapp-api.js --name "clevio-api"
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

2. **Menggunakan Docker** (Opsional)
   ```dockerfile
   # Dockerfile example
   FROM node:18-alpine
   WORKDIR /app
   COPY . .
   RUN npm run install-all
   EXPOSE 3000 4000
   CMD ["npm", "start"]
   ```

3. **Reverse Proxy dengan Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:4000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /api/ {
           proxy_pass http://localhost:3000/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 🔍 Troubleshooting

### Masalah Umum

1. **QR Code Tidak Muncul**
   - Pastikan Chrome/Chromium terinstall
   - Cek log error di console
   - Restart aplikasi

2. **Session Tidak Tersimpan**
   - Pastikan folder `.wwebjs_auth` memiliki permission write
   - Cek space disk yang tersedia

3. **API Tidak Merespon**
   - Cek apakah port 3000 sudah digunakan aplikasi lain
   - Pastikan firewall tidak memblokir port

4. **Dashboard Tidak Bisa Diakses**
   - Cek apakah port 4000 sudah digunakan
   - Pastikan aplikasi berjalan dengan benar

### Log Files

Log aplikasi dapat dilihat di:
- Console output saat menjalankan aplikasi
- PM2 logs: `pm2 logs`
- System logs: `/var/log/` (Linux)

## 🤝 Contributing

Kontribusi sangat diterima! Silakan:

1. Fork repository
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📄 License

Project ini menggunakan ISC License. Lihat file `LICENSE` untuk detail lengkap.

## 🆘 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

1. Cek dokumentasi ini terlebih dahulu
2. Lihat bagian Troubleshooting
3. Buat issue di repository
4. Hubungi tim support

## 🔄 Changelog

### Version 1.0.0
- Initial release
- Dashboard web dengan multi-session management
- WhatsApp API dengan fitur lengkap
- Real-time updates menggunakan SSE
- Comprehensive documentation

---

**Dibuat dengan ❤️ oleh Tim Clevio Pro**

