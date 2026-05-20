# SafeSteps Billing Setup

Target pricing:

- Starter: 1 child, GBP 2.99/month
- Plus: 2 children, GBP 3.99/month
- Family: up to 6 children, GBP 7.99/month
- Trial: 7 days free

## Google Play Console Products

Create three subscription products or one subscription with multiple base plans/offers, depending on how you want upgrades handled.

Recommended simple setup for MVP:

### Starter

- Product ID: `safesteps_starter_monthly`
- Base plan ID: `starter_monthly_299`
- Price: GBP 2.99/month
- Child limit: 1
- Offer ID: `trial_7_days`

### Plus

- Product ID: `safesteps_plus_monthly`
- Base plan ID: `plus_monthly_399`
- Price: GBP 3.99/month
- Child limit: 2
- Offer ID: `trial_7_days`

### Family

- Product ID: `safesteps_family_monthly`
- Base plan ID: `family_monthly_799`
- Price: GBP 7.99/month
- Child limit: 6
- Offer ID: `trial_7_days`

## Parent App Flow

1. Parent creates or signs into their account.
2. App checks whether the parent account has an active subscription entitlement.
3. If not subscribed, show the plan picker.
4. Parent selects Starter, Plus, or Family.
5. Google Play Billing starts the 7-day free trial.
6. App sends the purchase token to the backend.
7. Backend verifies the purchase with Google Play Developer API.
8. Backend stores the plan and child limit against the parent account.
9. Dashboard enforces the child limit.

The child phone app should not show payment. It should only pair to a subscribed parent account.

## Entitlement Shape

```json
{
  "parentId": "parent_123",
  "provider": "google_play",
  "productId": "safesteps_plus_monthly",
  "basePlanId": "plus_monthly_399",
  "offerId": "trial_7_days",
  "status": "active",
  "trial": true,
  "childLimit": 2,
  "renewalTime": "2026-06-19T12:00:00Z"
}
```

The backend should be the source of truth for whether the parent can access live tracking, add children, and view history.
