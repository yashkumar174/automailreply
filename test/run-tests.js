/**
 * Offline tests for the sorting logic. Gmail and the Claude API are faked,
 * so this runs anywhere with Node: `node test/run-tests.js`
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadScript({ fetchResponse, props = { ANTHROPIC_API_KEY: 'test-key' } } = {}) {
  const fetchCalls = [];
  const warnings = [];
  const context = {
    console: { log() {}, warn: (m) => warnings.push(m), error() {} },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props[k] || null }),
    },
    UrlFetchApp: {
      fetch(url, options) {
        fetchCalls.push({ url, options, payload: JSON.parse(options.payload) });
        return {
          getResponseCode: () => fetchResponse.status,
          getContentText: () => JSON.stringify(fetchResponse.body),
        };
      },
    },
  };
  vm.createContext(context);
  for (const file of ['Config.js', 'Code.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'), context, { filename: file });
  }
  return { context, fetchCalls, warnings };
}

function fakeMessage({ id = 'm1', from, subject = '', body = '', date = new Date(), attachments = [] }) {
  return {
    getId: () => id,
    getFrom: () => from,
    getSubject: () => subject,
    getPlainBody: () => body,
    getDate: () => date,
    getAttachments: () => attachments.map((name) => ({ getName: () => name })),
  };
}

const fakeThread = { getId: () => 'thread123' };
const interview = { label: 'Jobs/Interview', notify: true };

function claudeSays(category) {
  return {
    status: 200,
    body: {
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: JSON.stringify({ category, reason: 'test' }) },
      ],
    },
  };
}

const tests = {
  'VIP sender rule matches by domain without calling Claude'() {
    const { context, fetchCalls } = loadScript({ fetchResponse: claudeSays('None') });
    vm.runInContext("CONFIG.RULES = [{ label: 'VIP', from: ['@dream-company.com'] }]", context);
    const msg = fakeMessage({ from: 'Jane <jane@dream-company.com>', subject: 'Hello' });
    const result = vm.runInContext('classify_', context)(msg);
    assert.strictEqual(result.category.label, 'VIP');
    assert.strictEqual(result.source, 'rule');
    assert.strictEqual(fetchCalls.length, 0);
  },

  'portal replies from non-alert senders reach Claude'() {
    const { context, fetchCalls } = loadScript({ fetchResponse: claudeSays('Jobs/Interview') });
    const msg = fakeMessage({ from: 'Naukri <info@naukri.com>', subject: 'You have been shortlisted' });
    const result = vm.runInContext('classify_', context)(msg);
    assert.strictEqual(result.category.label, 'Jobs/Interview');
    assert.strictEqual(fetchCalls.length, 1);
  },

  'known alert senders go to Job Alerts and are archived without calling Claude'() {
    const { context, fetchCalls } = loadScript({ fetchResponse: claudeSays('Jobs/Interview') });
    const msg = fakeMessage({ from: 'Indeed <donotreply@jobalert.indeed.com>', subject: '20 more jobs' });
    const result = vm.runInContext('classify_', context)(msg);
    assert.strictEqual(result.category.label, 'Jobs/Job Alerts');
    assert.strictEqual(result.category.archive, true);
    assert.strictEqual(result.source, 'rule');
    assert.strictEqual(fetchCalls.length, 0);
  },

  'Claude sees earlier thread messages and attachment names'() {
    const { context, fetchCalls } = loadScript({ fetchResponse: claudeSays('Jobs/Offer Letter') });
    const first = fakeMessage({ id: 'a', from: 'HR <hr@acme.com>', body: 'Can you join on 1 Nov? Offer attached.' });
    const latest = fakeMessage({ id: 'b', from: 'HR <hr@acme.com>', body: 'Reminder', attachments: ['Offer_Letter.pdf'] });
    const thread = { getMessages: () => [first, latest] };
    const result = vm.runInContext('classify_', context)(latest, thread);
    assert.strictEqual(result.category.label, 'Jobs/Offer Letter');
    const prompt = fetchCalls[0].payload.messages[0].content;
    assert.match(prompt, /<earlier_messages_in_thread>[\s\S]*Can you join on 1 Nov/);
    assert.match(prompt, /Attachments: Offer_Letter\.pdf/);
  },

  'quoted replies, links and blank space are stripped before Claude reads it'() {
    const { context } = loadScript();
    const clean = vm.runInContext('cleanBody_', context);
    const body =
      'Hi Yash,\r\n\r\n\r\nPlease take the test: https://hackerrank.com/t/abc?utm=xyz\r\n' +
      '> old quoted line\r\n\r\nOn Mon, 12 Oct 2026 at 10:00, Acme <hr@acme.com>\r\nwrote:\r\n> earlier email';
    assert.strictEqual(clean(body), 'Hi Yash,\n\nPlease take the test: [link]');
  },

  'rule with from + keywords needs both to match'() {
    const { context } = loadScript();
    const ruleMatches = vm.runInContext('ruleMatches_', context);
    const rule = { label: 'X', from: ['@acme.com'], keywords: ['interview'] };
    assert.ok(ruleMatches(rule, { address: 'hr@acme.com', subject: 'Interview invite', body: '' }));
    assert.ok(!ruleMatches(rule, { address: 'hr@acme.com', subject: 'Newsletter', body: '' }));
    assert.ok(!ruleMatches(rule, { address: 'hr@other.com', subject: 'Interview', body: '' }));
  },

  'unmatched email goes to Claude and its answer picks the category'() {
    const { context, fetchCalls } = loadScript({ fetchResponse: claudeSays('Jobs/Interview') });
    const msg = fakeMessage({
      from: 'Talent Team <no-reply@greenhouse.io>',
      subject: 'Next steps for Software Engineer',
      body: 'We would like to schedule a call.',
    });
    const result = vm.runInContext('classify_', context)(msg);
    assert.strictEqual(result.category.label, 'Jobs/Interview');
    assert.strictEqual(result.source, 'claude');
    assert.strictEqual(result.reason, 'test');

    const { url, options, payload } = fetchCalls[0];
    assert.strictEqual(url, 'https://api.anthropic.com/v1/messages');
    assert.strictEqual(options.headers['x-api-key'], 'test-key');
    assert.strictEqual(payload.model, 'claude-haiku-5-5');
    // Haiku doesn't support server-side fallbacks, so neither is sent.
    assert.strictEqual(payload.fallbacks, undefined);
    assert.strictEqual(options.headers['anthropic-beta'], undefined);
    assert.strictEqual(payload.output_config.effort, 'medium');
    assert.deepStrictEqual(payload.output_config.format.schema.properties.category.enum, [
      'Jobs/Applied', 'Jobs/Interview', 'Jobs/Offer Letter', 'Jobs/Rejected', 'Jobs/Job Alerts', 'Dividends', 'None',
    ]);
  },

  '"None", refusals and unparseable answers leave the email alone'() {
    for (const response of [
      claudeSays('None'),
      { status: 200, body: { stop_reason: 'refusal', content: [] } },
      { status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] } },
    ]) {
      const { context } = loadScript({ fetchResponse: response });
      const result = vm.runInContext('classify_', context)(fakeMessage({ from: 'x@y.com' }));
      assert.strictEqual(result.category, null);
    }
  },

  'API errors throw so the email is retried next run'() {
    const { context } = loadScript({ fetchResponse: { status: 529, body: { error: 'overloaded' } } });
    assert.throws(() => vm.runInContext('classify_', context)(fakeMessage({ from: 'x@y.com' })), /529/);
  },

  'interview email sends a phone alert via ntfy'() {
    const { context, fetchCalls } = loadScript({ fetchResponse: { status: 200, body: {} }, props: { NTFY_TOPIC: 'my-topic' } });
    const msg = fakeMessage({ from: '"Acme Talent" <no-reply@greenhouse.io>', subject: 'Next steps 🎉' });
    vm.runInContext('notify_', context)(fakeThread, msg, interview);
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].url, 'https://ntfy.sh');
    const p = fetchCalls[0].payload;
    assert.strictEqual(p.topic, 'my-topic');
    assert.strictEqual(p.title, 'Interview: Acme Talent');
    assert.strictEqual(p.message, 'Next steps 🎉');
    assert.strictEqual(p.priority, 4);
    assert.strictEqual(p.click, 'https://mail.google.com/mail/u/0/#all/thread123');
  },

  'interview email sends a Telegram message with a Gmail button'() {
    const { context, fetchCalls } = loadScript({
      fetchResponse: { status: 200, body: { ok: true } },
      props: { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '987' },
    });
    const msg = fakeMessage({ from: 'Acme Talent <no-reply@greenhouse.io>', subject: 'Next steps' });
    vm.runInContext('notify_', context)(fakeThread, msg, interview);
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].url, 'https://api.telegram.org/bot123:abc/sendMessage');
    const p = fetchCalls[0].payload;
    assert.strictEqual(p.chat_id, '987');
    assert.strictEqual(p.text, '🎉 Interview: Acme Talent\nNext steps');
    assert.strictEqual(p.reply_markup.inline_keyboard[0][0].url, 'https://mail.google.com/mail/u/0/#all/thread123');
  },

  'one failing channel does not block the other'() {
    const { context, fetchCalls, warnings } = loadScript({
      fetchResponse: { status: 500, body: {} },
      props: { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c', NTFY_TOPIC: 'n' },
    });
    const sent = vm.runInContext('sendAlert_', context)({ title: 'x', message: 'y' });
    assert.strictEqual(sent, 0);
    assert.strictEqual(fetchCalls.length, 2);
    assert.strictEqual(warnings.length, 2);
  },

  'no alert without a topic or for old emails'() {
    let { context, fetchCalls } = loadScript({ fetchResponse: { status: 200, body: {} }, props: {} });
    vm.runInContext('notify_', context)(fakeThread, fakeMessage({ from: 'a@b.com' }), interview);
    assert.strictEqual(fetchCalls.length, 0);

    ({ context, fetchCalls } = loadScript({ fetchResponse: { status: 200, body: {} }, props: { NTFY_TOPIC: 't' } }));
    const old = fakeMessage({ from: 'a@b.com', date: new Date(Date.now() - 3 * 24 * 3600 * 1000) });
    vm.runInContext('notify_', context)(fakeThread, old, interview);
    assert.strictEqual(fetchCalls.length, 0);
  },

  'a failed alert is logged, not thrown'() {
    const { context, warnings } = loadScript({ fetchResponse: { status: 500, body: {} }, props: { NTFY_TOPIC: 't' } });
    vm.runInContext('notify_', context)(fakeThread, fakeMessage({ from: 'a@b.com' }), interview);
    assert.match(warnings[0], /ntfy alert failed: ntfy returned 500/);
  },

  'cleanUpOldLabels moves Offer and Job Alerts emails, removes unused labels'() {
    const { context } = loadScript();
    const labels = {};
    const makeLabel = (name, threads = []) => {
      labels[name] = { getName: () => name, getThreads: () => threads, deleteLabel: () => delete labels[name] };
      return labels[name];
    };
    const thread = (inInbox) => {
      const t = { added: [], moved: false, isInInbox: () => inInbox };
      t.addLabel = (l) => t.added.push(l.getName());
      t.moveToInbox = () => (t.moved = true);
      return t;
    };
    const offerThread = thread(true);
    const alertThread = thread(false);
    ['AutoSort', 'AutoSort/Jobs', 'AutoSort/Jobs/Applied', 'AutoSort/Jobs/Interview', 'AutoSort/Jobs/Rejected', 'AutoSort/VIP', 'Personal']
      .forEach((n) => makeLabel(n));
    makeLabel('AutoSort/Jobs/Offer', [offerThread]);
    makeLabel('AutoSort/Job Alerts', [alertThread]);
    context.GmailApp = {
      getUserLabels: () => Object.values(labels),
      getUserLabelByName: (n) => labels[n] || null,
      createLabel: (n) => makeLabel(n),
    };

    vm.runInContext('cleanUpOldLabels', context)();
    assert.deepStrictEqual(Object.keys(labels).sort(), [
      'AutoSort', 'AutoSort/Jobs', 'AutoSort/Jobs/Applied', 'AutoSort/Jobs/Interview',
      'AutoSort/Jobs/Job Alerts', 'AutoSort/Jobs/Offer Letter', 'AutoSort/Jobs/Rejected', 'Personal',
    ]);
    assert.deepStrictEqual(offerThread.added, ['AutoSort/Jobs/Offer Letter']);
    assert.deepStrictEqual(alertThread.added, ['AutoSort/Jobs/Job Alerts']);
    assert.strictEqual(alertThread.moved, false);
  },

  'a big backfill narrows the window instead of dropping the oldest emails'() {
    const { context } = loadScript();
    const DAY = 24 * 3600 * 1000;
    const now = Date.now();
    const since = now - 10 * DAY;
    // 800 inbox threads spread evenly over the 10 days.
    const threads = Array.from({ length: 800 }, (_, i) => {
      const msg = { ...fakeMessage({ id: `m${i}`, from: 'x@y.com', date: new Date(since + 1000 + (i * 10 * DAY) / 800) }), isDraft: () => false };
      return { getMessages: () => [msg], date: msg.getDate().getTime() };
    });
    const queries = [];
    context.Session = { getActiveUser: () => ({ getEmail: () => 'me@gmail.com' }) };
    context.GmailApp = {
      getAliases: () => [],
      search(query, start, max) {
        queries.push(query);
        const after = Number(/after:(\d+)/.exec(query)[1]) * 1000;
        const beforeMatch = /before:(\d+)/.exec(query);
        const before = beforeMatch ? Number(beforeMatch[1]) * 1000 : Infinity;
        return threads
          .filter((t) => t.date > after && t.date < before)
          .sort((a, b) => b.date - a.date)
          .slice(start, start + max);
      },
    };

    const { emails, until } = vm.runInContext('findNewEmails_', context)(since, now);
    assert.ok(until < now, 'window should have been narrowed');
    assert.ok(emails.length > 0 && emails.length < 500);
    // The very oldest email is included, and the list is oldest first.
    assert.strictEqual(emails[0].message.getId(), 'm0');
    assert.ok(emails.every((e, i) => i === 0 || emails[i - 1].message.getDate() <= e.message.getDate()));
    assert.ok(queries.some((q) => q.includes('before:')));
  },

  'sortMatchingEmails skips threads that already have an AutoSort label'() {
    const { context, fetchCalls } = loadScript({ fetchResponse: claudeSays('Dividends') });
    const makeThread = (id, labels) => {
      const msg = { ...fakeMessage({ id, from: 'Registrar <div@in.mpms.mufg.com>', subject: `Dividend ${id}` }), isDraft: () => false };
      const t = { labels: labels.slice(), getMessages: () => [msg] };
      t.getLabels = () => t.labels.map((n) => ({ getName: () => n }));
      t.addLabel = (l) => t.labels.push(l.getName());
      t.removeLabel = () => {};
      return t;
    };
    const done = makeThread('a', ['AutoSort/Dividends']);
    const todo = makeThread('b', ['Personal']);
    let searched;
    context.Session = { getActiveUser: () => ({ getEmail: () => 'me@gmail.com' }) };
    context.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
    context.GmailApp = {
      getAliases: () => [],
      search: (q) => ((searched = q), [done, todo]),
      getUserLabelByName: (n) => ({ getName: () => n }),
      createLabel: (n) => ({ getName: () => n }),
    };

    vm.runInContext('sortMatchingEmails', context)();
    assert.strictEqual(searched, 'dividend newer_than:1y');
    assert.strictEqual(fetchCalls.length, 1);
    assert.match(fetchCalls[0].payload.messages[0].content, /Dividend b/);
    assert.ok(todo.labels.includes('AutoSort/Dividends'));
  },

  'recheckMatchingEmails removes the label from emails that no longer fit'() {
    const { context } = loadScript({ fetchResponse: claudeSays('None') });
    const msg = { ...fakeMessage({ id: 't', from: 'Balrampur <cs.bcml@kfintech.com>', subject: 'Information Required on TDS (Form 15G/H)' }), isDraft: () => false };
    const labels = ['AutoSort/Dividends', 'Personal'];
    const thread = {
      getMessages: () => [msg],
      getLabels: () => labels.map((n) => ({ getName: () => n })),
      removeLabel: (l) => labels.splice(labels.indexOf(l.getName()), 1),
    };
    let searched;
    context.Session = { getActiveUser: () => ({ getEmail: () => 'me@gmail.com' }) };
    context.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
    context.GmailApp = { getAliases: () => [], search: (q) => ((searched = q), [thread]) };

    vm.runInContext('recheckMatchingEmails', context)();
    assert.strictEqual(searched, 'label:autosort-dividends');
    assert.deepStrictEqual(labels, ['Personal']);
  },

  'sender address is extracted from display-name format'() {
    const { context } = loadScript();
    const senderAddress = vm.runInContext('senderAddress_', context);
    assert.strictEqual(senderAddress(fakeMessage({ from: 'Jane Doe <Jane@Acme.com>' })), 'jane@acme.com');
    assert.strictEqual(senderAddress(fakeMessage({ from: 'bob@acme.com' })), 'bob@acme.com');
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}\n     ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
