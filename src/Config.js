/**
 * AutoSort configuration. This is the only file you need to edit.
 *
 * Claude reads every new email and files job emails under five labels:
 *
 *   AutoSort/Jobs/Applied        AutoSort/Jobs/Interview
 *   AutoSort/Jobs/Offer Letter   AutoSort/Jobs/Rejected
 *   AutoSort/Jobs/Job Alerts
 *
 * Everything else (newsletters, social media, personal mail...) is left alone.
 *
 * Options you can put on a category or rule:
 *   star: true       -> star the email
 *   important: true  -> mark the thread Important
 *   notify: true     -> send a phone alert (Telegram or ntfy; see README)
 *   archive: true    -> move it out of the inbox (still findable under its label)
 */
const CONFIG = {
  LABEL_PREFIX: 'AutoSort',

  // ---------------------------------------------------------------------------
  // The job labels. Claude picks one of these, or none.
  // ---------------------------------------------------------------------------
  AI_CATEGORIES: [
    {
      label: 'Jobs/Applied',
      description:
        "Confirmation that the user's application was received or submitted, or a status update " +
        'with no decision yet ("under review", "application viewed by the employer").',
    },
    {
      label: 'Jobs/Interview',
      description:
        "The user's application moved forward: interview invite or scheduling, phone screen, " +
        'online assessment / coding test / assignment, shortlisted or selected for the next round, ' +
        'cleared a round, or a recruiter asking for availability, documents or details to proceed.',
      star: true,
      important: true,
      notify: true,
    },
    {
      label: 'Jobs/Offer Letter',
      description:
        'An actual job or internship offer to the user: offer letter, "pleased to offer you", ' +
        'salary/CTC or stipend offered, joining date, or onboarding and background checks after an offer.',
      star: true,
      important: true,
      notify: true,
    },
    {
      label: 'Jobs/Rejected',
      description:
        "The user's application was declined: \"unfortunately\", \"not moving forward\", " +
        '"position has been filled", "decided to go with other candidates", even when softened ' +
        'with "we will keep your resume on file".',
    },
    {
      // Labeled but kept in the inbox, so a misread real update is never hidden.
      // Known alert-only senders (RULES below) are also moved out of the inbox.
      label: 'Jobs/Job Alerts',
      description:
        'Automated job listings or recommendations not tied to one of the user\'s applications: ' +
        'job alerts, "jobs you may like", "N new jobs matching your profile", hiring drives or ' +
        'recruiter mass mailers sent to many people.',
    },
  ],

  // How Claude should think about borderline emails. Edit to taste.
  AI_GUIDE: `
The user is a job seeker who applies to many jobs and internships, mostly through job portals
(Naukri, LinkedIn, Indeed, Internshala, Foundit, Glassdoor) and company career sites (Workday,
Greenhouse, Lever, SuccessFactors, etc.). Your job is to make sure no real update about the
user's OWN applications gets lost.

Read the whole email, and any earlier messages from the same thread, and decide what it means
for the user. Judge the meaning, not keywords:
- First ask: is this about a specific application the user made, or a specific company moving
  forward with the user? If not, it is never Applied, Interview, Offer Letter or Rejected,
  even when it contains words like "interview", "selected" or "offer". Job listings and
  recommendations sent to many people are Jobs/Job Alerts. Newsletters, courses, webinars,
  career tips, premium upsells and profile-view notices are None.
- "Congratulations" alone is not an offer. Shortlisting or clearing a round is Jobs/Interview;
  Jobs/Offer Letter needs an actual offer.
- Test or assessment links (HackerRank, HackerEarth, Codility, Mettl, etc.), assignments,
  "fill this form to proceed" and "share your availability" are Jobs/Interview.
- A short reply in an ongoing conversation with a recruiter (for example "Sure, Tuesday 3 PM
  works") belongs to whatever stage the thread is at, so use the earlier messages.
- An attachment named like "Offer_Letter.pdf" or "Appointment Letter" is strong evidence of an
  offer.
- When genuinely unsure whether an email is positive progress on the user's application,
  choose Jobs/Interview: a false alarm costs the user a glance, a miss can cost them the job.
`,

  // ---------------------------------------------------------------------------
  // Sender rules, checked before Claude (free and instant). The first match wins.
  // `from` matches the sender's address; `keywords` match the subject or body.
  // With both, both must match.
  // ---------------------------------------------------------------------------
  RULES: [
    {
      // Senders that only ever send job alerts: labeled and moved out of the
      // inbox without asking Claude. Don't add senders that also send real
      // application updates.
      label: 'Jobs/Job Alerts',
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
    // A person you never want to miss, for example:
    // { label: 'VIP', from: ['priya.recruiter@gmail.com', '@dream-company.com'], star: true, notify: true },
  ],

  // ---------------------------------------------------------------------------
  // Claude settings. The API key is NOT stored here: put it in
  // Project Settings -> Script properties as ANTHROPIC_API_KEY.
  // ---------------------------------------------------------------------------
  AI_ENABLED: true,
  // Cheap and good enough for sorting email. For the most accurate (and ~40x
  // pricier) option, use 'claude-opus-5-5' (see README, "Cost").
  CLAUDE_MODEL: 'claude-haiku-5-5',
  // How hard Claude thinks about each email: 'low', 'medium' or 'high'.
  AI_EFFORT: 'medium',
  // How much of each email Claude reads, after quoted replies, long links and
  // blank space are stripped out.
  MAX_BODY_CHARS: 6000,
  // Earlier messages from the same thread Claude sees for context.
  THREAD_CONTEXT_MESSAGES: 2,

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
  // Phone alerts. Your Telegram bot token / chat ID or ntfy topic are NOT
  // stored here: they go in Project Settings -> Script properties (see README).
  // ---------------------------------------------------------------------------
  NTFY_SERVER: 'https://ntfy.sh',
  // No alerts for emails older than this (e.g. when sorting old mail).
  NOTIFY_MAX_AGE_HOURS: 24,
};
