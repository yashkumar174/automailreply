# AutoSort for Gmail

Never miss the email that matters. AutoSort runs inside your Google account every
10 minutes and labels new inbox mail, so an interview invite can't hide under 40
job alerts.

- **Claude reads your new mail** and tells apart an interview invite, an offer, a
  rejection and a plain "we received your application", from any company or job
  portal. You don't need to know who will write to you.
- **Optional rules (free):** "anything from `@dream-company.com` → `AutoSort/VIP`, star it".
- You choose the categories: add, rename or remove them in one file.

Default labels:

| Label | Comes from | Extra |
|---|---|---|
| `AutoSort/VIP` | your sender list (empty until you add some) | starred + important + phone alert |
| `AutoSort/Job Alerts` | known LinkedIn / Indeed / Naukri alert senders, plus other portal alerts Claude spots | known senders are archived; ones Claude spots stay in the inbox |
| `AutoSort/Jobs/Offer` | Claude | starred + important + phone alert |
| `AutoSort/Jobs/Interview` | Claude | starred + important + phone alert |
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
3. **Edit `Config` (optional).** If there are people you already know you never want to
   miss, add them to the `VIP` rule. Otherwise leave it empty.
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

## Phone alerts for interview and offer emails

Gmail's own notifications fire when an email arrives, before AutoSort has sorted it, so
they can't tell an interview invite from a job alert. AutoSort sends its own alert
instead, right after it labels an email `Jobs/Interview`, `Jobs/Offer` or `VIP`:

> 🎉 **Interview: Acme Talent**
> Next steps for Software Engineer at Acme
> [Open in Gmail]

Set up **Telegram** (recommended) or **ntfy**. If you set up both, you get both.

### Telegram (recommended)

1. **Create a bot.** In Telegram, search for **@BotFather** (blue checkmark), tap
   **Start**, send `/newbot`, and pick any name and username (the username must end in
   `bot`, e.g. `yash_autosort_bot`). BotFather replies with a **token** like
   `7123456789:AAH...`. Keep it secret.
2. **Save the token.** In the script editor: **Project Settings** (gear) →
   **Script properties** → **Add script property**: `TELEGRAM_BOT_TOKEN` = the token. Save.
3. **Say hi to your bot.** Tap the `t.me/...` link in BotFather's reply, tap **Start**,
   and send it any message, e.g. `hi`.
4. **Get your chat ID.** Back in the editor, run `findTelegramChatId`. The log shows
   `Your chat ID is 123456789`. Add a script property `TELEGRAM_CHAT_ID` = that number.
5. **Test it.** Run `testNotification`. Your bot should message you within seconds.

### ntfy

Some ntfy.sh servers refuse connections from Google; if `testNotification` fails with
"Address unavailable", use Telegram instead and delete the `NTFY_TOPIC` property.

1. **Install ntfy** on your phone from the Play Store or App Store. No account needed.
2. **Pick a secret topic name.** Anyone who knows the name can read your alerts, so make
   it long and random, e.g. `autosort-yash-7f3k9q2m`. In the app, tap **+**, type the
   name, and tap **Subscribe**.
3. **Give AutoSort the name.** Add a script property `NTFY_TOPIC` = your topic name.
4. **Test it.** Run `testNotification`.

### Good to know

Alerts arrive up to 10 minutes after the email, because that's how often AutoSort
checks. Set `RUN_EVERY_MINUTES: 5` in `Config` and run `setup` again for faster alerts.
Emails older than a day (e.g. from `sortRecentEmails`) are labeled and starred but don't
send an alert. To get alerts for another category, add `notify: true` to it.

## Cost

Rules are free. Only emails no rule matched are sent to Claude, and only their first
6,000 characters.

| Model (`CLAUDE_MODEL`) | Per email (approx.) | 20 emails/day to Claude |
|---|---|---|
| `claude-haiku-5-5` (default) | ~$0.0003 | ~$0.20 / month |
| `claude-opus-5-5` (most accurate) | ~$0.01 | ~$6–9 / month |

Haiku is usually accurate enough for sorting email. If it mislabels things, switch to Opus
by changing one line in `Config`: `CLAUDE_MODEL: 'claude-opus-5-5'`. Adding rules for
senders that write often (job
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
