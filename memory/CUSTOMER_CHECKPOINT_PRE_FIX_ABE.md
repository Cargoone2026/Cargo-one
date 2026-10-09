# Customer App — Checkpoint Before Fix A / B / E

**Date:** 2026-10-06
**Authorised by:** User, in the message that initiated this round of Customer
fixes.

## Baseline this checkpoint represents

- Tag: `customer-r71-16-1-golden`
- Commit: `ac1feef7e47b09801c3661f98ad3522f985b937e`
- Date: 2026-09-20
- Title: *"R71.16.1 — Fix native PaymentSheet refund: fall back to
  `bookings.stripe_payment_intent_id` when `stripe_session_id` is null"*
- State of Customer source tree at this commit was verified (via
  `git diff --stat ac1feef HEAD -- mobile/apps/customer/`) to equal the
  working-tree state **before** Fix A/B/E were applied in this session.

## Files that this round of fixes WILL change

| File | Reason | Fix |
|---|---|---|
| `mobile/apps/customer/src/pushNotifications.ts` | Add staleness check to cold-start response handler | Fix A |
| `mobile/apps/customer/src/screens/Bookings.tsx` | Replace `useEffect(load)` with `useFocusEffect(load)` | Fix B |
| `mobile/apps/customer/src/screens/Home.tsx` | Replace `useEffect(load)` with `useFocusEffect(load)` | Fix B |
| `mobile/apps/customer/src/components/BiometricGate.tsx` | Replace `return null` during `checking` with `<LoadingScreen />` | Fix E |

No other Customer file, and no Driver / backend / web / shared-core /
`package.json` / `app.json` / lockfile / native file is touched by this
round.

## How to revert this round (if the physical-device test fails)

Any single file:
```bash
git checkout ac1feef -- mobile/apps/customer/src/pushNotifications.ts
git checkout ac1feef -- mobile/apps/customer/src/screens/Bookings.tsx
git checkout ac1feef -- mobile/apps/customer/src/screens/Home.tsx
git checkout ac1feef -- mobile/apps/customer/src/components/BiometricGate.tsx
```

Or all four at once:
```bash
git checkout ac1feef -- \
  mobile/apps/customer/src/pushNotifications.ts \
  mobile/apps/customer/src/screens/Bookings.tsx \
  mobile/apps/customer/src/screens/Home.tsx \
  mobile/apps/customer/src/components/BiometricGate.tsx
```

Nothing in `node_modules`, Pods, Metro cache, `.env`, or any config is
affected by this round, so reverting the four files above fully restores
Customer to the golden state.
