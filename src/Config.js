/**
 * AutoSort configuration. This is the only file you need to edit.
 *
 * How an email gets sorted:
 *   1. RULES are checked top to bottom. The first rule that matches wins.
 *   2. If no rule matches, Claude reads the email and picks one of AI_CATEGORIES
 *      (or none, in which case the email is left alone).
 *
 * Every category becomes a Gmail label under LABEL_PREFIX, e.g. "AutoSort/Jobs/Interview".
 *
 * Options you can put on any rule or AI category:
 *   star: true       -> star the email
 *   important: true  -> mark the thread Important
 *   archive: true    -> move it out of the inbox (still findable under its label)
 *   notify: true     -> send a phone alert (needs the ntfy app; see README)
 */
const CONFIG = {
  LABEL_PREFIX: 'AutoSort',

  // ---------------------------------------------------------------------------
  // RULES: free, instant, predictable. Use them for senders you already know.
  //
  //   from:     matches if the sender's address contains any of these
  //             (a full address like 'hr@acme.com' or a domain like '@acme.com')
  //   keywords: matches if the subject or body contains any of these (case-insensitive)
  //
  // If a rule has both `from` and `keywords`, BOTH must match.
  // ---------------------------------------------------------------------------
  RULES: [
    {
      // OPTIONAL. You don't need this to catch job replies: Claude reads every
      // email no rule matched, whoever sent it. Add addresses here only for
      // people you already know you never want to miss, e.g.
      //   from: ['priya.recruiter@gmail.com', '@dream-company.com'],
      label: 'VIP',
      from: [],
      star: true,
      important: true,
      notify: true,
    },
    {
      // Automated job-board alerts: useful, but they bury the real replies.
      // Only addresses that send nothing but alerts belong here, because
      // matching mail is archived without Claude reading it.
      label: 'Job Alerts',
      from: [
        'jobalerts-noreply@linkedin.com',
        'jobs-listings@linkedin.com',
        'alert@indeed.com',
        '@jobalert.indeed.com',
        'jobalert@naukri.com',
        'recommendationnc@naukri.com',
      ],
      archive: true,
    },
  ],

  // ---------------------------------------------------------------------------
  // AI_CATEGORIES: Claude picks one of these for emails no rule matched.
  // The description is what Claude reads to decide, so make it specific.
  // ---------------------------------------------------------------------------
  AI_CATEGORIES: [
    {
      label: 'Jobs/Offer',
      description: 'A job offer, offer letter, or compensation/joining details for a role the user applied to.',
      star: true,
      important: true,
      notify: true,
    },
    {
      label: 'Jobs/Interview',
      description:
        'Positive progress on a job application: interview invitation or scheduling, phone screen, ' +
        'online assessment or coding test, "we would like to move forward", selected or shortlisted for the ' +
        'next round (including job-portal notifications like Naukri or LinkedIn saying so), or a recruiter ' +
        'asking for availability or more information to continue the process.',
      star: true,
      important: true,
      notify: true,
    },
    {
      label: 'Jobs/Rejected',
      description:
        'A job application was declined: "unfortunately", "not moving forward", "position filled", ' +
        '"decided to pursue other candidates".',
    },
    {
      label: 'Jobs/Applied',
      description:
        'Automatic confirmation that a job application was received or submitted, with no decision yet.',
    },
    {
      label: 'Jobs/Recruiter Outreach',
      description:
        'A specific recruiter or hiring manager personally contacting the user about a role they have ' +
        'not applied to yet. Not automated job recommendations or "jobs you may like" lists.',
    },
    {
      // Catches alerts from portals and addresses the Job Alerts rule doesn't
      // list. Labeled but kept in the inbox, so a misread email is never hidden.
      label: 'Job Alerts',
      description:
        'Automated job listings or recommendations from a job portal (Naukri, Indeed, LinkedIn, ' +
        'Internshala, Glassdoor, etc.): "jobs matching your profile", "new jobs for you", ' +
        '"immediate requirement" mailers, job alert digests.',
    },
  ],

  // ---------------------------------------------------------------------------
  // Claude settings. The API key is NOT stored here: put it in
  // Project Settings -> Script properties as ANTHROPIC_API_KEY.
  // ---------------------------------------------------------------------------
  AI_ENABLED: true,
  // Cheap and good enough for sorting email. For the most accurate (and ~40x
  // pricier) option, use 'claude-opus-5-5' (see README, "Cost").
  CLAUDE_MODEL: 'claude-haiku-5-5',
  // Only the first part of long emails is sent to Claude. The decision almost
  // always sits at the top, and this keeps newsletters from costing extra.
  MAX_BODY_CHARS: 6000,

  // ---------------------------------------------------------------------------
  // Scheduling
  // ---------------------------------------------------------------------------
  // How often to check for new mail. Apps Script allows 1, 5, 10, 15 or 30.
  RUN_EVERY_MINUTES: 10,
  // Upper limit of emails handled in one run; leftovers are picked up next run.
  MAX_EMAILS_PER_RUN: 60,
  // How far back sortRecentEmails() / previewRecentEmails() look.
  BACKFILL_DAYS: 14,

  // ---------------------------------------------------------------------------
  // Phone alerts. Your ntfy topic is NOT stored here: put it in
  // Project Settings -> Script properties as NTFY_TOPIC (see README).
  // ---------------------------------------------------------------------------
  NTFY_SERVER: 'https://ntfy.sh',
  // No alerts for emails older than this (e.g. when sorting old mail).
  NOTIFY_MAX_AGE_HOURS: 24,
};
