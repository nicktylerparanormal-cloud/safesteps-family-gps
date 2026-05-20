# SafeSteps Play Release Checklist

Use this checklist for internal or closed testing first.

## 1. Backend

- Deploy the project root to a Node host with HTTPS.
- Attach Postgres.
- Set `PUBLIC_BASE_URL` to the deployed HTTPS URL.
- Confirm these URLs load:
  - `/`
  - `/privacy.html`
  - `/terms.html`
  - `/delete-data.html`

## 2. Android Build

Update:

```text
app/src/main/java/com/tylabsmedia/safesteps/child/AppConfig.java
```

Set:

```java
static final String DEFAULT_API_BASE_URL = "https://your-live-url";
```

Then build the Play upload artifact:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat bundleRelease
```

The unsigned AAB appears at:

```text
app/build/outputs/bundle/release/app-release.aab
```

For Play upload, sign it with an upload key or configure Gradle signing.

This project now has local upload-key signing configured through:

```text
keystore/safesteps-upload-key.jks
safesteps-upload-key.properties
```

Both files are ignored by git. Back them up somewhere private and secure. If this upload key is lost, future Play uploads become painful and may require a key reset process through Google Play.

Current upload key fingerprint:

```text
SHA1: 44:D0:72:83:14:DD:1B:1A:D0:15:01:A4:F1:60:CF:BF:B3:DD:FC:7C
SHA256: 3D:8A:31:17:B2:A3:ED:3A:D6:D2:E9:77:6D:CB:74:75:D7:1D:B5:C2:EE:41:DF:CD:97:EC:A4:AA:B1:AA:8F:21
```

## 3. Play Billing Products

Create these subscriptions in Play Console:

- `safesteps_starter_monthly`
- `safesteps_plus_monthly`
- `safesteps_family_monthly`

Suggested prices:

- Starter: GBP 2.99/month
- Plus: GBP 4.99/month
- Family: GBP 7.99/month

## 4. Store Listing URLs

Use the deployed URLs:

- Privacy policy: `https://your-live-url/privacy.html`
- Terms: `https://your-live-url/terms.html`
- Data deletion: `https://your-live-url/delete-data.html`

## 5. Background Location Review

In-app disclosure already explains that SafeSteps collects location while the app is closed or the phone is locked, and that sharing is visible in an ongoing notification.

Play Console review materials should say:

```text
SafeSteps uses background location so a parent or guardian can see the paired child's live location and route history while the child's phone is locked or the app is closed. The child phone shows an ongoing notification while sharing is active, and sharing can be stopped at any time.
```

Prepare a short demo video showing:

1. Parent creates a child pairing code.
2. Child pairs with code and passkey.
3. Child grants foreground and background location.
4. Child starts sharing.
5. Ongoing notification is visible.
6. Parent dashboard receives location.

## 6. Internal Test

- Upload signed AAB.
- Add internal testers.
- Add license testers for Billing.
- Install from Google Play, not sideload.
- Test signup, subscription screen, pairing, child location, dashboard map, account deletion.
