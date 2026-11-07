import assert from 'node:assert/strict';
import test from 'node:test';
import { APPLICATION_STATUSES, EMPTY_FILTERS, computeStats, filterApplications, hasActiveFilters, matchesFilters, nextStatus, timeAgo } from '../src/lib/applications.ts';

const now = Date.parse('2026-11-07T12:00:00.000Z');

test('Next follows the full status cycle, including archive and restore', () => {
  assert.equal(nextStatus('APPLIED'), 'INTERVIEW');
  assert.equal(nextStatus('INTERVIEW'), 'OFFER');
  assert.equal(nextStatus('OFFER'), 'REJECTED');
  assert.equal(nextStatus('REJECTED'), 'APPLIED');
  for (const original of APPLICATION_STATUSES) {
    let status = original;
    for (let i = 0; i < 4; i++) status = nextStatus(status);
    assert.equal(status, original);
  }
});

test('timeAgo handles the first hour and exact hour/day boundaries', () => {
  assert.equal(timeAgo('2026-11-07T12:00:00.000Z', now), 'Just now');
  assert.equal(timeAgo('2026-11-07T11:00:01.000Z', now), 'Just now');
  assert.equal(timeAgo('2026-11-07T11:00:00.000Z', now), '1h ago');
  assert.equal(timeAgo('2026-11-06T13:00:00.000Z', now), '23h ago');
  assert.equal(timeAgo('2026-11-06T12:00:00.000Z', now), '1d ago');
  assert.equal(timeAgo('2026-11-04T12:00:00.000Z', now), '3d ago');
});

test('timeAgo handles future and invalid timestamps', () => {
  assert.equal(timeAgo('2026-11-08T12:00:00.000Z', now), 'Just now');
  assert.equal(timeAgo('not-a-date', now), 'Unknown date');
});

test('computeStats returns zeros for an empty board', () => {
  assert.deepEqual(computeStats([]), { total: 0, active: 0, inProgress: 0, offers: 0 });
});

test('computeStats counts each status into the right buckets', () => {
  const stats = computeStats(
    ['APPLIED', 'APPLIED', 'INTERVIEW', 'OFFER', 'OFFER', 'OFFER', 'REJECTED', 'REJECTED'].map((status) => ({ status })),
  );
  assert.deepEqual(stats, { total: 8, active: 6, inProgress: 3, offers: 3 });
});

test('computeStats: moving a card through the cycle keeps the invariants', () => {
  let status = 'APPLIED';
  for (let i = 0; i < 4; i++) {
    const { total, active, inProgress, offers } = computeStats([{ status }]);
    assert.equal(total, 1);
    assert.equal(active, status === 'REJECTED' ? 0 : 1);
    assert.equal(inProgress, status === 'APPLIED' || status === 'INTERVIEW' ? 1 : 0);
    assert.equal(offers, status === 'OFFER' ? 1 : 0);
    status = nextStatus(status);
  }
});

const sample = [
  { title: 'Frontend Developer Intern', company: 'Acme Corp', platform: 'LinkedIn', type: 'Internship', status: 'APPLIED' },
  { title: 'Backend Engineer', company: 'Nusa Digital', platform: 'Glints', type: 'Job', status: 'OFFER' },
  { title: 'Data Analyst Intern', company: 'ACME Labs', platform: 'Glints', type: 'Internship', status: 'REJECTED' },
  { title: '100% Remote_Dev', company: 'Foo', platform: 'Other', type: 'Job', status: 'INTERVIEW' },
];
const titles = (filters) => filterApplications(sample, { ...EMPTY_FILTERS, ...filters }).map((a) => a.title);

test('filters: empty filters return everything (as a copy)', () => {
  assert.equal(hasActiveFilters(EMPTY_FILTERS), false);
  assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, query: '   ' }), false);
  const result = filterApplications(sample, EMPTY_FILTERS);
  assert.deepEqual(result, sample);
  assert.notEqual(result, sample);
});

test('filters: search is case-insensitive and matches title or company', () => {
  assert.deepEqual(titles({ query: 'acme' }), ['Frontend Developer Intern', 'Data Analyst Intern']);
  assert.deepEqual(titles({ query: 'BACKEND' }), ['Backend Engineer']);
  assert.deepEqual(titles({ query: '  nusa  ' }), ['Backend Engineer']);
  assert.deepEqual(titles({ query: 'zzz' }), []);
});

test('filters: every search word must match across title and company', () => {
  assert.deepEqual(titles({ query: 'acme intern' }), ['Frontend Developer Intern', 'Data Analyst Intern']);
  assert.deepEqual(titles({ query: 'acme backend' }), []);
});

test('filters: special characters are matched literally', () => {
  assert.deepEqual(titles({ query: '100%' }), ['100% Remote_Dev']);
  assert.deepEqual(titles({ query: '_dev' }), ['100% Remote_Dev']);
  assert.deepEqual(titles({ query: '.*' }), []);
});

test('filters: platform and type combine with search (AND)', () => {
  assert.deepEqual(titles({ platform: 'Glints' }), ['Backend Engineer', 'Data Analyst Intern']);
  assert.deepEqual(titles({ type: 'Job' }), ['Backend Engineer', '100% Remote_Dev']);
  assert.deepEqual(titles({ platform: 'Glints', type: 'Internship' }), ['Data Analyst Intern']);
  assert.deepEqual(titles({ platform: 'Glints', type: 'Internship', query: 'acme' }), ['Data Analyst Intern']);
  assert.deepEqual(titles({ platform: 'LinkedIn', query: 'nusa' }), []);
});

test('stats follow the filtered list', () => {
  const all = computeStats(sample);
  assert.deepEqual(all, { total: 4, active: 3, inProgress: 2, offers: 1 });
  const glints = computeStats(filterApplications(sample, { ...EMPTY_FILTERS, platform: 'Glints' }));
  assert.deepEqual(glints, { total: 2, active: 1, inProgress: 0, offers: 1 });
  assert.deepEqual(computeStats(filterApplications(sample, { ...EMPTY_FILTERS, query: 'zzz' })), { total: 0, active: 0, inProgress: 0, offers: 0 });
  assert.equal(matchesFilters(sample[0], { ...EMPTY_FILTERS, query: 'frontend' }), true);
});
