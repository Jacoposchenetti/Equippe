const assert = require('node:assert/strict');
const {
  aggregateAnalytics,
  isAnalyticsAdminEmail,
  sanitizeMetadata,
  sanitizePath,
  sanitizeReferrer,
  sanitizeSessionId,
} = require('./lib/analyticsCore');

const ts = (millis) => ({ toMillis: () => millis });

assert.equal(isAnalyticsAdminEmail('admin@tuaequipe.it'), true, 'known admin email should pass');
assert.equal(isAnalyticsAdminEmail('user@example.com'), false, 'non-admin email should fail');

assert.equal(sanitizeSessionId('abc_def-1234567890'), 'abc_def-1234567890');
assert.equal(sanitizeSessionId('short'), '');
assert.equal(sanitizePath('/dashboard?email=test@example.com#x'), '/dashboard');
assert.equal(sanitizePath('https://evil.test/dashboard'), '/');
assert.equal(sanitizeReferrer('https://google.com/search?q=email@test.it'), 'https://google.com/search');

const metadata = sanitizeMetadata({
  label: 'Iscriviti ora',
  email: 'person@example.com',
  phone: '+39 333 111 2222',
  conversion: true,
});
assert.deepEqual(metadata, { label: 'Iscriviti ora', conversion: true });

const events = [
  { session_id: 's1', path: '/', referrer: 'direct', timestamp: ts(1), device: 'desktop', event_type: 'page_view', metadata: {} },
  { session_id: 's1', path: '/register', referrer: '/', timestamp: ts(2), device: 'desktop', event_type: 'page_view', metadata: {} },
  { session_id: 's1', path: '/register', referrer: '/', timestamp: ts(3), device: 'desktop', event_type: 'form_start', metadata: {} },
  { session_id: 's1', path: '/register', referrer: '/', timestamp: ts(4), device: 'desktop', event_type: 'form_submit', metadata: { conversion: true } },
  { session_id: 's2', path: '/', referrer: 'direct', timestamp: ts(5), device: 'mobile', event_type: 'page_view', metadata: {} },
];

const aggregate = aggregateAnalytics(events);
assert.equal(aggregate.totals.visits, 3);
assert.equal(aggregate.totals.sessions, 2);
assert.equal(aggregate.totals.conversions, 1);
assert.equal(aggregate.totals.conversionRate, 50);
assert.equal(aggregate.topPages[0].path, '/');
assert.equal(aggregate.funnel[3].sessions, 1);

console.log('analytics tests passed');
