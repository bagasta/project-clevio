# Clevio Pro - API Documentation

## Overview

Clevio Pro WhatsApp API menyediakan interface RESTful yang komprehensif untuk berinteraksi dengan WhatsApp Web melalui whatsapp-web.js library. API ini memungkinkan Anda untuk mengirim pesan, mengelola grup, dan melakukan berbagai operasi WhatsApp secara programmatic.

## Base URL

```
http://localhost:3000
```

## Authentication

API ini tidak menggunakan authentication khusus, namun pastikan untuk mengamankan akses ke server dalam environment production.

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Parameter tidak valid |
| 404 | Not Found - Resource tidak ditemukan |
| 500 | Internal Server Error |

## Endpoints

### Status & QR Code

#### GET /status
Mendapatkan status client WhatsApp.

**Response:**
```json
{
  "ready": true,
  "qr": false
}
```

#### GET /qr
Mendapatkan QR code untuk pairing device.

**Response:**
```json
{
  "qr": "qr-code-string",
  "dataUrl": "data:image/png;base64,..."
}
```

### Messages

#### POST /messages/send
Mengirim pesan teks ke chat.

**Request Body:**
```json
{
  "chatId": "6281234567890@c.us",
  "content": "Hello World!",
  "options": {
    "linkPreview": false,
    "sendMediaAsSticker": false,
    "sendMediaAsDocument": false
  }
}
```

**Response:**
```json
{
  "messageId": "message-id-string"
}
```

#### POST /messages/send-media
Mengirim media (gambar, video, audio, dokumen).

**Request Body:**
```json
{
  "chatId": "6281234567890@c.us",
  "mimetype": "image/jpeg",
  "data": "base64-encoded-data",
  "filename": "image.jpg",
  "caption": "Caption untuk media",
  "options": {
    "sendMediaAsSticker": false,
    "sendMediaAsDocument": false
  }
}
```

**Response:**
```json
{
  "messageId": "message-id-string"
}
```

#### POST /messages/send-sticker
Mengirim sticker.

**Request Body:**
```json
{
  "chatId": "6281234567890@c.us",
  "mimetype": "image/webp",
  "data": "base64-encoded-sticker-data",
  "filename": "sticker.webp",
  "stickerAuthor": "Author Name",
  "stickerName": "Sticker Name",
  "stickerCategories": ["category1", "category2"]
}
```

#### POST /messages/send-location
Mengirim lokasi.

**Request Body:**
```json
{
  "chatId": "6281234567890@c.us",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "name": "Jakarta",
  "address": "Jakarta, Indonesia"
}
```

#### POST /messages/reply
Membalas pesan.

**Request Body:**
```json
{
  "chatId": "6281234567890@c.us",
  "content": "This is a reply",
  "quotedMessageId": "quoted-message-id"
}
```

#### POST /messages/react
Memberikan reaksi emoji ke pesan.

**Request Body:**
```json
{
  "chatId": "6281234567890@c.us",
  "messageId": "message-id-to-react",
  "emoji": "👍"
}
```

#### GET /messages/:chatId
Mengambil pesan dari chat.

**Query Parameters:**
- `limit` (optional): Jumlah pesan yang diambil (default: 20)

**Response:**
```json
[
  {
    "id": "message-id",
    "body": "Message content",
    "fromMe": false,
    "timestamp": 1234567890,
    "type": "chat"
  }
]
```

### Groups

#### POST /groups
Membuat grup baru.

**Request Body:**
```json
{
  "title": "Nama Grup",
  "participants": [
    "6281234567890@c.us",
    "6289876543210@c.us"
  ],
  "options": {
    "description": "Deskripsi grup"
  }
}
```

#### GET /groups/:groupId/invite-code
Mendapatkan kode undangan grup.

**Response:**
```json
{
  "code": "invite-code-string"
}
```

#### POST /groups/join
Bergabung ke grup menggunakan kode undangan.

**Request Body:**
```json
{
  "inviteCode": "invite-code-string"
}
```

#### POST /groups/:groupId/subject
Mengubah nama grup.

**Request Body:**
```json
{
  "subject": "Nama Grup Baru"
}
```

#### POST /groups/:groupId/description
Mengubah deskripsi grup.

**Request Body:**
```json
{
  "description": "Deskripsi grup baru"
}
```

#### POST /groups/:groupId/add-participants
Menambah member ke grup.

**Request Body:**
```json
{
  "participantIds": [
    "6281234567890@c.us",
    "6289876543210@c.us"
  ]
}
```

#### POST /groups/:groupId/remove-participants
Menghapus member dari grup.

**Request Body:**
```json
{
  "participantIds": [
    "6281234567890@c.us"
  ]
}
```

#### POST /groups/:groupId/promote-participants
Menjadikan member sebagai admin.

**Request Body:**
```json
{
  "participantIds": [
    "6281234567890@c.us"
  ]
}
```

#### POST /groups/:groupId/demote-participants
Menurunkan admin menjadi member biasa.

**Request Body:**
```json
{
  "participantIds": [
    "6281234567890@c.us"
  ]
}
```

### Chat Operations

#### POST /chats/:chatId/mute
Mute chat.

**Request Body:**
```json
{
  "duration": 3600000
}
```

#### POST /chats/:chatId/unmute
Unmute chat.

#### POST /chats/:chatId/pin
Pin chat.

#### POST /chats/:chatId/unpin
Unpin chat.

#### POST /chats/:chatId/archive
Archive chat.

#### POST /chats/:chatId/unarchive
Unarchive chat.

#### DELETE /chats/:chatId
Hapus chat.

#### GET /chats
Mendapatkan daftar semua chat.

**Response:**
```json
[
  {
    "id": "chat-id",
    "name": "Chat Name",
    "isGroup": false,
    "isMuted": false,
    "isPinned": false,
    "isArchived": false,
    "unreadCount": 0,
    "lastMessage": {
      "body": "Last message content",
      "timestamp": 1234567890
    }
  }
]
```

### Contacts

#### GET /contacts
Mendapatkan daftar kontak.

**Response:**
```json
[
  {
    "id": "contact-id",
    "name": "Contact Name",
    "number": "6281234567890",
    "isMyContact": true,
    "isUser": true,
    "isWAContact": true
  }
]
```

#### GET /contacts/:contactId
Mendapatkan detail kontak.

#### GET /contacts/:contactId/profile-picture
Mendapatkan foto profil kontak.

**Response:**
```json
{
  "url": "profile-picture-url"
}
```

### Profile

#### GET /profile
Mendapatkan profil user saat ini.

**Response:**
```json
{
  "name": "User Name",
  "number": "6281234567890",
  "profilePicture": "profile-picture-url"
}
```

#### POST /profile/name
Mengubah nama profil.

**Request Body:**
```json
{
  "name": "New Name"
}
```

#### POST /profile/status
Mengubah status profil.

**Request Body:**
```json
{
  "status": "New status message"
}
```

### Polls

#### POST /polls/create
Membuat polling.

**Request Body:**
```json
{
  "chatId": "6281234567890@c.us",
  "question": "Pertanyaan polling?",
  "options": [
    "Opsi 1",
    "Opsi 2",
    "Opsi 3"
  ],
  "allowMultipleAnswers": false
}
```

### Business Features

#### GET /business/profile
Mendapatkan profil bisnis (jika akun bisnis).

#### POST /business/profile
Mengupdate profil bisnis.

#### GET /business/catalog
Mendapatkan katalog produk.

#### POST /business/catalog/product
Menambah produk ke katalog.

## Chat ID Format

Chat ID menggunakan format berikut:
- **Individual Chat**: `6281234567890@c.us`
- **Group Chat**: `1234567890-1234567890@g.us`
- **Broadcast List**: `1234567890@broadcast`

## Media Types

Supported media types:
- **Images**: image/jpeg, image/png, image/gif, image/webp
- **Videos**: video/mp4, video/3gpp, video/quicktime
- **Audio**: audio/mpeg, audio/ogg, audio/wav, audio/mp4
- **Documents**: application/pdf, application/msword, application/vnd.ms-excel, dll

## Error Responses

```json
{
  "error": "Error message description"
}
```

## Rate Limiting

API tidak memiliki rate limiting built-in, namun WhatsApp Web memiliki batasan pengiriman pesan. Disarankan untuk:
- Tidak mengirim lebih dari 1 pesan per detik
- Batch pesan untuk pengiriman massal
- Implementasi retry mechanism untuk error handling

## Examples

### Mengirim Pesan Teks
```bash
curl -X POST http://localhost:3000/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "6281234567890@c.us",
    "content": "Hello from API!"
  }'
```

### Mengirim Gambar
```bash
curl -X POST http://localhost:3000/messages/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "6281234567890@c.us",
    "mimetype": "image/jpeg",
    "data": "base64-encoded-image-data",
    "filename": "image.jpg",
    "caption": "Ini adalah gambar dari API"
  }'
```

### Membuat Grup
```bash
curl -X POST http://localhost:3000/groups \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Grup API Test",
    "participants": [
      "6281234567890@c.us",
      "6289876543210@c.us"
    ]
  }'
```

## WebSocket Events (Future)

Planned untuk versi mendatang:
- Real-time message notifications
- Status change events
- Typing indicators
- Online/offline status

## SDK dan Libraries

Untuk kemudahan penggunaan, Anda dapat membuat wrapper atau menggunakan HTTP client libraries:

### JavaScript/Node.js
```javascript
const axios = require('axios');

class ClevioAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.client = axios.create({ baseURL });
  }
  
  async sendMessage(chatId, content, options = {}) {
    const response = await this.client.post('/messages/send', {
      chatId,
      content,
      options
    });
    return response.data;
  }
  
  async getStatus() {
    const response = await this.client.get('/status');
    return response.data;
  }
}

// Usage
const api = new ClevioAPI();
api.sendMessage('6281234567890@c.us', 'Hello!');
```

### Python
```python
import requests

class ClevioAPI:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
    
    def send_message(self, chat_id, content, options=None):
        url = f"{self.base_url}/messages/send"
        data = {
            'chatId': chat_id,
            'content': content,
            'options': options or {}
        }
        response = requests.post(url, json=data)
        return response.json()
    
    def get_status(self):
        url = f"{self.base_url}/status"
        response = requests.get(url)
        return response.json()

# Usage
api = ClevioAPI()
api.send_message('6281234567890@c.us', 'Hello from Python!')
```

## Changelog

### v1.0.0
- Initial API release
- Basic messaging functionality
- Group management
- Chat operations
- Contact management
- Profile management

---

Untuk informasi lebih lanjut, silakan merujuk ke dokumentasi utama atau hubungi tim support.

