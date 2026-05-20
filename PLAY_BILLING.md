# SafeSteps Google Play Billing Setup

The Android app includes Google Play Billing Library `8.3.0`.

Create these subscription products in Play Console:

| Plan | Product ID | Child limit | Suggested price |
| --- | --- | ---: | --- |
| Starter | `safesteps_starter_monthly` | 1 | GBP 2.99/month |
| Plus | `safesteps_plus_monthly` | 2 | GBP 4.99/month |
| Family | `safesteps_family_monthly` | 6 | GBP 7.99/month |

For each product:

1. Create a subscription in Play Console.
2. Use the exact product ID above.
3. Add a monthly base plan.
4. Set the suggested price or your preferred localized price.
5. Activate the subscription.
6. Upload a build that includes the Billing Library.
7. Add license testers in Play Console for test purchases.

The app queries Google Play for live product prices. The GBP values shown in code are fallbacks for local builds or when Play Billing is unavailable.

Important production note: purchases should be verified server-side before unlocking paid entitlement permanently. The current app stores the active plan locally after Google reports a purchase, which is acceptable for early testing but not final release security.
