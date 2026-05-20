# SafeSteps Family GPS by Tylabs Media

SEO-friendly product name:

**SafeSteps Family GPS - Child Location Tracker & Route History by Tylabs Media**

SafeSteps is a family safety location product for parents who want live child location, route history, safe-zone alerts, and simple child phone pairing.

## Test Run

### Hosted-Ready Pairing Flow

SafeSteps now supports a real pairing flow:

- parent opens the dashboard
- parent signs up or logs in
- parent adds a child and receives a 6-digit pairing code plus 4-digit passkey
- child opens the Android app and chooses child setup
- child enters the pairing code and passkey
- backend issues a private child device token
- child app sends location updates using that token
- dashboard shows live updates
- parent app flow includes Google Play subscription plan buttons

See `HOSTING.md` for deployment notes.
See `PLAY_BILLING.md` for Google Play subscription setup.
See `PLAY_RELEASE_CHECKLIST.md` for the Play upload checklist.

### Working Local Phone Test

From this project folder, start the local SafeSteps test server:

```bash
node mock-backend-server.js
```

It serves the parent dashboard and receives child-phone location pings.

For local phone testing, build the APK with this as `DEFAULT_API_BASE_URL`:

```text
http://192.168.0.171:8787
```

The parent dashboard is served at the same URL.

Install the debug APK from:

```text
app/build/outputs/apk/debug/app-debug.apk
```

In the parent dashboard, add a child to create a pairing code and passkey. In the child app, choose child setup, enter the pairing code and passkey. Then allow location permissions and tap Start sharing location.

### Parent Dashboard

For the live local or hosted version, open the backend URL in a browser. Local example:

`http://localhost:8787`

The dashboard currently supports:

- add multiple children, up to 6
- parent signup, login, logout, and account deletion
- select a child
- start tracking
- stop tracking
- enable auto track per child
- generate a child-phone pairing code
- view live interactive map location
- view journey history for the last hour, 6 hours, 24 hours, or 7 days
- see the active subscription tier
- public privacy, terms, and data deletion pages

### Child Android App

Open this folder in Android Studio and run the `app` module on a physical Android phone.

The child app currently supports:

- visible child setup screen
- child name
- parent or child setup choice
- pairing code and passkey from parent dashboard
- foreground location permission
- locked-phone/background location permission
- persistent tracking notification
- start sharing
- stop sharing
- authenticated location pingbacks to a backend endpoint
- no visible server/developer controls in the normal setup flow

The package name is:

`com.tylabsmedia.safesteps.child`

## Product Flow

1. Parent creates an account.
2. Parent chooses a plan.
3. Parent adds a child in the dashboard.
4. Dashboard generates a pairing code and passkey.
5. Child installs SafeSteps Family GPS on their Android phone.
6. Child enters the pairing code and passkey.
7. Parent can start, stop, or auto-enable tracking for that child.
8. Child phone sends location pings to the backend.
9. Parent sees the live map and route history.

## Pricing Recommendation

- **Starter:** 1 child, GBP 2.99/month
- **Plus:** 2 children, GBP 3.99/month
- **Family:** up to 6 children, GBP 7.99/month
- **Trial:** 7 days free

Later, add a **Family Pro** tier at GBP 9.99/month with longer history, advanced alerts, SOS, and priority support.

## Backend Ping Contract

The child app sends:

```http
POST /api/child/location-pings
Authorization: Bearer <child-device-token>
Content-Type: application/json
```

Example body:

```json
{
  "childName": "Alex",
  "latitude": 51.5014760,
  "longitude": -0.1406340,
  "accuracyMeters": 8.5,
  "altitudeMeters": 24.1,
  "speedMetersPerSecond": 1.2,
  "bearingDegrees": 82.0,
  "provider": "gps",
  "capturedAt": 1779192000000
}
```

The backend should validate the bearer token, map it to a paired child profile, store the point, update the child's latest location, and send realtime updates to the parent dashboard.

## Play Console Notes

This app uses background location, so the Play Console listing needs:

- a clear family safety purpose
- in-app disclosure before requesting background location
- a privacy policy explaining location use, retention, deletion, and sharing
- a demo video for Google Play background location review
- visible ongoing notification while live tracking is active

Do not market this as hidden or stealth tracking. The safer positioning is real-time family location sharing with route history and safety alerts.
