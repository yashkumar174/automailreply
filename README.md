# AutoSort for Gmail

Never miss the email that matters. AutoSort runs inside your Google account every
10 minutes and labels new inbox mail, so an interview invite can't hide under 40
job alerts.

- **Rules first (free):** "anything from `@dream-company.com` → `AutoSort/VIP`, star it".
- **Claude for everything else:** reads emails no rule caught and tells apart an
  interview invite, an offer, a rejection and a plain "we received your application".
- You choose the categories: add, rename or remove them in one file.

Default labels:

| Label | Comes from | Extra |
|---|---|---|
| `AutoSort/VIP` | your sender list | starred + important |
| `AutoSort/Job Alerts` | LinkedIn / Indeed / Glassdoor / Naukri alerts | archived out of the inbox |
| `AutoSort/Jobs/Offer` | Claude | starred + important |
| `AutoSort/Jobs/Interview` | Claude | starred + important |
| `AutoSort/Jobs/Rejected` | Claude | |
| `AutoSort/Jobs/Applied` | Claude | |
| `AutoSort/Jobs/Recruiter Outreach` | Claude | |

Emails that fit nothing are left exactly as they were.

## Setup (about 10 minutes)

1. **Create the script.** Go to [script.google.com](https://script.google.com) → **New project**.
   Name it `AutoSort`.
2. **Add the code.** In the editor:
   - Replace the contents of `Code.gs` with [`src/Code.js`](src/Code.js).
   - Click **+** → **Script**, name it `Config`, and paste [`src/Config.js`](src/Config.js).
3. **Edit `Config`.** At minimum, put your real must-not-miss senders in the `VIP` rule.
4. **Add your Claude API key.** Get one at [console.anthropic.com](https://console.anthropic.com)
   (add a small amount of credit). Then in the script editor: **Project Settings** (gear icon)
   → **Script properties** → **Add script property**:
   - Property: `ANTHROPIC_API_KEY`
   - Value: your key (`sk-ant-...`)

   The key lives only in your script's settings, never in the code.
5. **Turn it on.** Pick `setup` in the function dropdown at the top and click **Run**.
   Google asks for permission to read/label your Gmail and connect to an external service
   (the Claude API). You'll see an "unverified app" screen because you wrote the app
   yourself: click **Advanced → Go to AutoSort**.

From now on new mail is sorted every 10 minutes. Check **Executions** (left sidebar) to
see each run's log, for example:

```
AutoSort/Jobs/Interview [claude] Acme Talent <no-reply@greenhouse.io> | Next steps for SDE role
AutoSort/Job Alerts [rule] LinkedIn <jobalerts-noreply@linkedin.com> | 30 new jobs for you
(left alone) [claude] Mom <mom@example.com> | Dinner Sunday?
```

### Sort mail you already have

- `previewRecentEmails`: logs how the last 14 days *would* be sorted, without changing
  anything. Good for tuning your rules (it still makes Claude calls).
- `sortRecentEmails`: actually sorts the last 14 days. Large inboxes are finished over the
  next few timer runs.

Change `BACKFILL_DAYS` in `Config` to look further back. Run `stop` to turn the timer off.

## Customizing

Everything is in `Config`.

**Add a rule** (free, instant, for senders you know):

```js
{ label: 'College', from: ['@university.edu'], important: true },
{ label: 'Bank OTP', from: ['@hdfcbank.net'], keywords: ['otp'], archive: true },
```

`from` matches part of the sender's address; `keywords` match the subject or body. With
both, both must match. The first matching rule wins, so put specific rules above broad ones.

**Add a Claude category** (for things you can't describe by sender):

```js
{ label: 'Bills', description: 'Bills, invoices, payment due reminders, or receipts.' },
```

Claude decides from the `description`, so be specific about what belongs and what doesn't.

Each item can have `star: true`, `important: true` and/or `archive: true`. After adding
categories, run `setup` again so the new labels appear in Gmail right away.

## Get a phone alert for important labels

Interview and Offer emails are starred and marked Important. In the Gmail app, open
**Settings → your account → Notifications** and choose **High priority only** so your phone
buzzes for those and stays quiet for alerts. On Android you can instead turn on
notifications for just the `AutoSort/Jobs/Interview` label under **Manage labels**.

## Cost

Rules are free. Only emails no rule matched are sent to Claude, and only their first
6,000 characters.

| Model (`CLAUDE_MODEL`) | Per email (approx.) | 20 emails/day to Claude |
|---|---|---|
| `claude-opus-5-5` (default, most accurate) | ~$0.01 | ~$6–9 / month |
| `claude-haiku-5-5` | ~$0.0003 | ~$0.20 / month |

Haiku is usually accurate enough for sorting email. To use it, change one line in `Config`:
`CLAUDE_MODEL: 'claude-haiku-5-5'`. Adding rules for senders that write often (job
boards, newsletters) cuts cost with either model.

Set `AI_ENABLED: false` to run rules only, for free.

## Troubleshooting

- **Nothing gets labeled by Claude:** check the run log under **Executions**. `no API key`
  means the `ANTHROPIC_API_KEY` script property is missing or misnamed.
- **`Claude API returned 401`:** the key is wrong. **`400`:** usually a typo in
  `CLAUDE_MODEL`. **`429` / `529`:** rate limit or overload. That run stops and the same
  emails are retried next run, so nothing gets skipped.
- **Email from you isn't sorted:** by design. Your own replies in a thread are ignored;
  the thread is sorted by the latest email someone else sent.

## Development

`src/` is laid out for [clasp](https://github.com/google/clasp), so you can push from
this repo instead of copy-pasting:

```sh
npm install -g @google/clasp
clasp login
clasp create --type standalone --title AutoSort --rootDir src
clasp push
```

Offline tests (Gmail and Claude are faked, so no account or key needed):

```sh
node test/run-tests.js
```
