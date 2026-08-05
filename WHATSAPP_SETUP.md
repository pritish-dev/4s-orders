# WhatsApp alerts for 4S Orders

The backend (`Code.gs`) can send WhatsApp messages to one or more phone numbers
when key order events happen, plus a daily sales summary. It uses the **official
Meta WhatsApp Cloud API** — reliable, free within Meta's generous limits, and no
risk of your number being banned.

## What triggers a message

| Event | When it fires | Enabled key |
| --- | --- | --- |
| **New order** | A sales exec saves a brand-new booking (not on edits) | `order` |
| **WON / Godrej SO added** | The Godrej SO / WON number is filled in | `won` |
| **Delivery update** | An order is marked delivered / pending / rescheduled | `delivery` |
| **Service request** | A service / complaint is raised on an order | `service` |
| **Daily sales summary** | Every day at ~9:30 PM (Asia/Kolkata) | `summary` |

Every send is **best-effort**: if WhatsApp is down or misconfigured, orders still
save normally — a failed alert never blocks the app. Failures are recorded in the
`APP AUDIT LOG` tab as `WA_SEND_FAIL`.

> **Note — numbers, not groups.** The official Cloud API can message individual
> phone numbers only; it cannot post into a WhatsApp *group*. Add each person who
> should be alerted (owner, manager, etc.) as a recipient number.

---

## One-time setup

### 1. Get Meta WhatsApp Cloud API credentials

1. Go to <https://developers.facebook.com/> → **My Apps** → **Create App** →
   type **Business**.
2. Add the **WhatsApp** product to the app.
3. In **WhatsApp → API Setup** you get:
   - a **Phone number ID** (the sender) — copy it,
   - a temporary **access token** (good for 24h — fine for first testing).
4. For production, create a **permanent** token: **Business Settings → Users →
   System Users →** add a system user → **Generate token** for your app with the
   `whatsapp_business_messaging` permission. Copy that token.
5. Under **API Setup → "To"**, add each recipient number and verify it once (Meta
   requires recipients to be added while the app is in test mode; once you add a
   real business phone number and the app is live, this restriction lifts).

### 2. Configure the backend

Open the Apps Script project (the one that hosts `Code.gs`) → **Editor**, pick
the `waConfigure` function from the dropdown or paste this into a scratch run:

```js
waConfigure({
  token:      'EAAG...your permanent token...',
  phoneId:    '123456789012345',          // Meta phone-number ID
  recipients: '9876543210, 9123456789',   // owner / manager numbers (10-digit = India)
  mode:       'text',                      // 'text' to start; 'template' for production
  enabled:    true,
  events:     'order,won,delivery,service,summary'
});
```

Run it once (authorise the script if prompted). Credentials are stored in
**Script Properties** — never written to `Code.gs` or committed to git.

- **Recipients** — comma/space separated. A bare 10-digit number gets `91`
  prepended automatically; pass a full number (e.g. `971...`) for other countries.
  Change the default with `cc: '971'` in `waConfigure`, or per number.
- **events** — drop any you don't want (e.g. `'order,won,summary'`). Omit the key
  entirely to keep all five on.

### 3. Schedule the 9:30 PM summary

Run this once from the editor:

```js
installWhatsAppTriggers();
```

It creates a daily time trigger (~21:30, script timezone Asia/Kolkata). Re-running
it is safe — it replaces the old trigger. Remove it with `removeWhatsAppTriggers()`.

### 4. Test

```js
waTest();      // sends a test message to every recipient
waStatus();    // prints current config (token masked) + whether the trigger is set
```

Check the **Executions** log for the API response. A `200` means delivered.

---

## `text` mode vs `template` mode

The Cloud API has a rule for **business-initiated** messages (which these alerts
are):

- **`text` mode** — plain, fully-formatted multi-line messages. They only deliver
  if the recipient has messaged your business number in the **last 24 hours**.
  Perfect for **testing** and for numbers that chat with the business regularly.
- **`template` mode** — uses **pre-approved message templates**, which deliver at
  **any time**, 24/7. This is the **reliable production path**.

Start in `text` mode to confirm the pipeline works, then switch to `template` mode
for always-on delivery:

```js
waConfigure({ mode: 'template' });
```

### Templates to create (for `template` mode)

In **WhatsApp Manager → Message templates → Create**, make these (category
**Utility**, language **English**). The body variables must match the order and
count below. Default template names are shown — if you name them differently, set
an override, e.g. `WA_TPL_ORDER`, in Script Properties.

**`order_booked`**
```
🆕 New Order — 4S Interiors

Order: {{1}}
Customer: {{2}}
Amount: {{3}}
Items: {{4}}
Sales: {{5}}
```

**`won_added`**
```
✅ Godrej SO / WON added — 4S Interiors

Order: {{1}}
Customer: {{2}}
WON: {{3}}
Updated by: {{4}}
```

**`delivery_update`**
```
🚚 Delivery Update — 4S Interiors

Order: {{1}}
Customer: {{2}}
Status: {{3}}
Updated by: {{4}}
```

**`service_request`**
```
🛠️ Service Request — 4S Interiors

Order: {{1}}
Customer: {{2}}
Status: {{3}}
Issue: {{4}}
Updated by: {{5}}
```

**`daily_summary`**
```
📊 Daily Sales Summary — 4S Interiors
{{1}}

Orders today: {{2}}
Total value: {{3}}
Top exec: {{4}}
```

Approval usually takes minutes to a few hours. Once approved, set
`mode: 'template'` and you're production-ready.

---

## Managing it later

| Task | How |
| --- | --- |
| Turn all alerts off | `waConfigure({ enabled: false })` |
| Change recipients | `waConfigure({ recipients: '9876543210, 9000000000' })` |
| Enable only some events | `waConfigure({ events: 'order,summary' })` |
| Switch to production | `waConfigure({ mode: 'template' })` |
| See current config | `waStatus()` |
| Move summary time | edit `atHour`/`nearMinute` in `installWhatsAppTriggers()`, re-run it |
| Stop the summary | `removeWhatsAppTriggers()` |

All settings live in Script Properties, so they survive redeploys of `Code.gs`.
