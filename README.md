# AutoSort for Gmail

Never miss the email that matters. AutoSort runs inside your Google account every
10 minutes. Claude reads each new email and files your job emails (and dividend
notices) under labels, so an interview invite can't hide under 40 job alerts:

```
AutoSort
 ├─ Jobs
 │   ├─ Applied        application received / under review
 │   ├─ Interview      interview, test, shortlisted, next round   ⭐ + phone alert
 │   ├─ Offer Letter   an actual offer, joining, onboarding        ⭐ + phone alert
 │   ├─ Rejected       not moving forward
 │   └─ Job Alerts     job listings and recommendations
 └─ Dividends          dividend payment / credit notices for your shares
```

Job alerts from known alert-only senders (LinkedIn, Indeed and Naukri alert addresses)
are also moved out of the inbox; other alerts Claude spots stay in the inbox, labeled.
Everything else (newsletters, social media, personal mail) is left exactly as it was. You don't need to know who will write to you: Claude judges what each email
means, from any company or job portal.

How Claude reads an email:
- **The whole message, cleaned up.** Quoted older replies, long tracking links and blank
  space are stripped first, so the part that matters fits.
- **The conversation so far.** For a reply like "Sure, Tuesday 3 PM works", it also reads
  the earlier messages in the thread to know which stage you're at.
- **Attachment names**, so an `Offer_Letter.pdf` counts as an offer.
- **A guide for tricky cases**, e.g. "congratulations, you're shortlisted" is Interview,
  not Offer; a rejection that says "we'll keep your resume on file" is still Rejected;
  a mass "hiring now" mailer is nothing at all.
- **Its reasoning is logged** next to every decision, so you can see why it chose a label.

## Setup (about 10 minutes)

1. **Create the script.** Go to [script.google.com](https://script.google.com) → **New project**.
   Name it `AutoSort`.
2. **Add the code.** In the editor:
   - Replace the contents of `Code.gs` with [`src/Code.js`](src/Code.js).
   - Click **+** → **Script**, name it `Config`, and paste [`src/Config.js`](src/Config.js).
3. **Add your Claude API key.** Get one at [console.anthropic.com](https://console.anthropic.com)
   (add a small amount of credit). Then in the script editor: **Project Settings** (gear icon)
   → **Script properties** → **Add script property**:
   - Property: `ANTHROPIC_API_KEY`
   - Value: your key (`sk-ant-...`)

   The key lives only in your script's settings, never in the code.
4. **Turn it on.** Pick `setup` in the function dropdown at the top and click **Run**.
   Google asks for permission to read/label your Gmail and connect to an external service
   (the Claude API). You'll see an "unverified app" screen because you wrote the app
   yourself: click **Advanced → Go to AutoSort**.

From now on new mail is sorted every 10 minutes. Check **Executions** (left sidebar) to
see each run's log, for example:

```
AutoSort/Jobs/Interview [claude: invites Yash to a HackerRank test for the SDE role] Acme <no-reply@greenhouse.io> | Next steps
AutoSort/Jobs/Job Alerts [rule] Indeed <donotreply@jobalert.indeed.com> | 20 new jobs for you
(left alone) [claude: a family message about dinner] Mom <mom@example.com> | Dinner Sunday?
```

### Updating from an earlier version

Earlier versions also made `VIP`, `Job Alerts`, `Recruiter Outreach` and `Jobs/Offer`
labels. After pasting the new files, run **`cleanUpOldLabels`** once: it moves `Jobs/Offer`
emails to `Jobs/Offer Letter` and `Job Alerts` emails to `Jobs/Job Alerts`, and removes the
`VIP` and `Recruiter Outreach` labels. No email is deleted. Then run `setup` again.

### Sort mail you already have

- `previewRecentEmails`: logs how the last 14 days *would* be sorted, without changing
  anything (it still makes Claude calls).
- `sortRecentEmails`: actually sorts the last 14 days. Large inboxes are finished over the
  next few timer runs.

Change `BACKFILL_DAYS` in `Config` to look further back. Run `stop` to turn the timer off.

## Customizing

Everything is in `Config`.

- **Tricky emails sorted wrong?** Add a line to `AI_GUIDE` describing the case, e.g.
  `- Emails from Superset about campus drives are None unless they name the user.`
- **Another alert-only sender?** Add its address to the `Jobs/Job Alerts` rule in `RULES`.
  Its emails skip Claude and move out of the inbox. Only add senders that never send real
  application updates.
- **A person you never want to miss?** Add a rule to `RULES`:

  ```js
  { label: 'VIP', from: ['priya.recruiter@gmail.com', '@dream-company.com'], star: true, notify: true },
  ```

  `from` matches part of the sender's address; `keywords` match the subject or body.
- **Another category?** Add it to `AI_CATEGORIES` with a clear `description`, e.g.
  `{ label: 'Bills', description: 'Bills, invoices, payment due reminders, or receipts.' }`.
- **Sharper judgement?** Set `AI_EFFORT: 'high'`, or switch `CLAUDE_MODEL` to
  `'claude-opus-5-5'` (see Cost).

Each category or rule can have `star`, `important`, `notify` and `archive` set to `true`.
After adding one, run `setup` again so its label appears in Gmail right away.

## Phone alerts for interview and offer emails

Gmail's own notifications fire when an email arrives, before AutoSort has sorted it, so
they can't tell an interview invite from a job alert. AutoSort sends its own alert
instead, right after it labels an email `Jobs/Interview` or `Jobs/Offer Letter`:

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

Rules are free. Other emails go to Claude: up to 6,000 characters of the cleaned-up
email plus a short excerpt of up to 2 earlier messages in the thread.

| Model (`CLAUDE_MODEL`) | Per email (approx.) | 20 emails/day to Claude |
|---|---|---|
| `claude-haiku-5-5` (default) | ~$0.0005–0.001 | ~$0.30–0.60 / month |
| `claude-opus-5-5` (most accurate) | ~$0.01–0.02 | ~$6–12 / month |

Haiku with `AI_EFFORT: 'medium'` is usually accurate enough. If it mislabels things, try
`AI_EFFORT: 'high'` first, then Opus (`CLAUDE_MODEL: 'claude-opus-5-5'`). Adding alert-only
senders to the Job Alerts rule cuts cost with either model.

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
