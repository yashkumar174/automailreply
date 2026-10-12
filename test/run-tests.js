/**
 * Offline tests for the sorting logic. Gmail and the Claude API are faked,
 * so this runs anywhere with Node: `node test/run-tests.js`
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadScript({ fetchResponse } = {}) {
  const fetchCalls = [];
  const context = {
    console: { log() {}, warn() {}, error() {} },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => (k === 'ANTHROPIC_API_KEY' ? 'test-key' : null) }),
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
  return { context, fetchCalls };
}

function fakeMessage({ from, subject = '', body = '' }) {
  return { getFrom: () => from, getSubject: () => subject, getPlainBody: () => body };
}

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
    const msg = fakeMessage({ from: 'Jane <jane@dream-company.com>', subject: 'Hello' });
    const result = vm.runInContext('classify_', context)(msg);
    assert.strictEqual(result.category.label, 'VIP');
    assert.strictEqual(result.source, 'rule');
    assert.strictEqual(fetchCalls.length, 0);
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

    const { url, options, payload } = fetchCalls[0];
    assert.strictEqual(url, 'https://api.anthropic.com/v1/messages');
    assert.strictEqual(options.headers['x-api-key'], 'test-key');
    assert.strictEqual(payload.model, 'claude-haiku-5-5');
    // Haiku doesn't support server-side fallbacks, so neither is sent.
    assert.strictEqual(payload.fallbacks, undefined);
    assert.strictEqual(options.headers['anthropic-beta'], undefined);
    assert.deepStrictEqual(payload.output_config.format.schema.properties.category.enum, [
      'Jobs/Offer', 'Jobs/Interview', 'Jobs/Rejected', 'Jobs/Applied', 'Jobs/Recruiter Outreach', 'None',
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
