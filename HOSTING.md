# SafeSteps Hosted Test Setup

This version has a hosted-ready backend with:

- parent email/password signup and login
- revocable parent sessions
- child pairing sessions
- 6-digit pairing code plus 4-digit passkey
- private child device tokens
- location ping storage
- parent dashboard polling
- privacy and terms pages
- account deletion endpoint
- rate limiting and location retention
- purchase verification endpoint ready for Google credentials
- Postgres support through `DATABASE_URL`
- JSON-file storage for local development

## Pairing Flow

1. Parent opens the dashboard.
2. Parent creates an account or logs in.
3. Parent enters a child name and taps add.
4. Backend creates a child record plus a pairing session.
5. Dashboard shows a 6-digit pairing code and 4-digit passkey.
6. Child opens the Android app, chooses child setup, and enters the code and passkey.
7. Backend verifies the code and passkey, then returns a private child device token.
8. Child app uses that token for future location pings.

## Local Test

From the project root:

```bash
node mock-backend-server.js
```

Open:

```text
http://localhost:8787
```

For local phone testing, the APK must be built with the laptop IP address as `DEFAULT_API_BASE_URL`, for example:

```text
http://192.168.0.171:8787
```

## Hosted Deployment

Deploy the project root as a Node service. The root `package.json` starts `backend/server.js`, and the backend serves the `parent-web` dashboard and legal pages.

For Render, `render.yaml` is included and defines:

- one Node web service
- one Postgres database
- production env vars

Set these environment variables:

```text
PORT=8787
PUBLIC_BASE_URL=https://your-hosted-safe-steps-api.example.com
DATABASE_URL=postgres://...
LOCATION_RETENTION_DAYS=30
RATE_LIMIT_MAX=120
```

Notes:

- `PUBLIC_BASE_URL` must be the public HTTPS URL of the hosted backend.
- `DATABASE_URL` enables Postgres storage.
- Without `DATABASE_URL`, the backend uses a local JSON file, which is fine for quick tests but not production.
- `LOCATION_RETENTION_DAYS` controls route-history retention.
- After deployment, set `DEFAULT_API_BASE_URL` in `app/src/main/java/com/tylabsmedia/safesteps/child/AppConfig.java` to the hosted `PUBLIC_BASE_URL`, then rebuild the APK.
- The normal APK hides developer server controls and uses that built-in URL automatically.

Public release URLs:

- Privacy: `/privacy.html`
- Terms: `/terms.html`
- Data deletion: `/delete-data.html`

## Parent Accounts

The dashboard now uses:

- `POST /api/parent/signup`
- `POST /api/parent/login`
- `POST /api/parent/logout`
- `DELETE /api/parent/account`

Account deletion revokes sessions, removes children, deletes child location data, and records a completed deletion request.

## Maps

The parent dashboard uses Leaflet with OpenStreetMap tiles for testing. For production, review tile usage terms or switch to a paid provider such as Google Maps or Mapbox if traffic grows.

## Current Test APK

The debug APK is built at:

```text
app/build/outputs/apk/debug/app-debug.apk
```

For the Play release flow, follow `PLAY_RELEASE_CHECKLIST.md`.

## Security Notes Before Production

This is good enough for controlled real-life testing, but before app-store release add:

- proper parent sign-in
- HTTPS-only production config
- parental consent and privacy policy flows
- safe-zone and notification rules stored server-side
- Google Play purchase verification using the Google Play Developer API
