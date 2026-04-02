# CUlink Mobile — Developer Guide

## Project Structure

```
CUlink/                        ← Your existing Django backend
└── accounts/api/              ← NEW: REST API endpoints
    ├── __init__.py
    ├── serializers.py         ← DRF serializers for all models
    ├── views.py               ← API views (Auth, Wall, Chat, Workspace, Profile)
    └── urls.py                ← /api/v1/ URL routing

CUlink-Mobile/                 ← NEW: React Native mobile app
├── app/
│   ├── _layout.tsx            ← Root layout + auth guard
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (tabs)/
│       ├── _layout.tsx        ← Bottom tab bar
│       ├── wall.tsx           ← Knowledge Wall
│       ├── chat.tsx           ← Real-time chat (Pusher)
│       ├── workspace.tsx      ← Workspace docs & items
│       └── profile.tsx        ← Profile + settings
├── constants/index.ts         ← Colors, API URL, spacing
├── services/api.ts            ← Axios client + all API helpers
├── store/index.ts             ← Zustand state (auth + notifications)
├── eas.json                   ← EAS Build config
└── app.json                   ← Expo config
```

---

## Step 1 — Configure the API URL

Open `CUlink-Mobile/constants/index.ts` and set your backend URL:

```ts
// For local testing (use your PC's LAN IP):
export const API_BASE_URL = 'http://192.168.1.X:8000/api/v1';

// For production (your Vercel deployment):
export const API_BASE_URL = 'https://culink.vercel.app/api/v1';
```

**Also update your Pusher cluster** if it's not `mt1`.

---

## Step 2 — Run locally with Expo Go

```bash
cd CUlink-Mobile
npm start
```

Scan the QR code with **Expo Go** on your phone.

> ⚠️ Your phone and PC must be on the **same Wi-Fi** for local testing.

---

## Step 3 — Build APK (Android)

```bash
# Install EAS CLI globally (one-time)
npm install -g eas-cli

# Login to your Expo account (free)
eas login

# Link this project to Expo
eas init

# Build the APK
npm run build:apk
```

The APK link will appear in your terminal. Download it to your Android device and install it.

---

## Step 4 — Build IPA (iOS)

```bash
npm run build:ipa
```

> ⚠️ **IPA requires a free Apple Developer account** at [developer.apple.com](https://developer.apple.com).  
> EAS will guide you through signing. To install on your iPhone, use **AltStore** (free) or **Xcode**.

---

## Step 5 — Deploy Backend Changes to Vercel

Your Django backend has new packages. Push the updated code to trigger a Vercel redeploy:

```bash
cd CUlink
git add requirements.txt authapp/settings.py authapp/urls.py accounts/api/
git commit -m "feat: add DRF REST API for mobile app"
git push
```

Vercel will auto-install the new packages (`djangorestframework`, `djangorestframework-simplejwt`, `django-cors-headers`).

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register/` | Register |
| POST | `/api/v1/auth/login/` | Login → returns JWT |
| POST | `/api/v1/auth/refresh/` | Refresh access token |
| POST | `/api/v1/auth/verify-email/` | Verify email token |
| GET | `/api/v1/profile/` | Get own profile |
| PATCH | `/api/v1/profile/update/` | Update profile + avatar |
| GET | `/api/v1/wall/` | Paginated posts |
| POST | `/api/v1/wall/create/` | Create post |
| POST | `/api/v1/wall/<id>/like/` | Toggle like |
| POST | `/api/v1/wall/<id>/comment/` | Add comment |
| GET | `/api/v1/chat/inbox/` | Chat conversations |
| GET | `/api/v1/chat/<user>/messages/` | Message history |
| POST | `/api/v1/chat/<user>/send/` | Send DM |
| GET | `/api/v1/workspace/` | List docs |
| POST | `/api/v1/workspace/doc/create/` | Create doc |
| GET | `/api/v1/workspace/doc/<id>/` | Get doc + items |
| PATCH | `/api/v1/workspace/item/<id>/update/` | Update item |

All endpoints (except auth) require `Authorization: Bearer <access_token>` header.
