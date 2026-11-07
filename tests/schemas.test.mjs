import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApplicationIdSchema,
  ApplicationSchema,
  ListApplicationsQuerySchema,
  UpdateApplicationSchema,
} from '../src/lib/schemas.ts';

const valid = { title: 'Frontend Intern', company: 'Acme', type: 'Internship', platform: 'LinkedIn' };

test('create: applies defaults, trims text, and normalizes empty optionals to null', () => {
  const result = ApplicationSchema.parse({
    ...valid,
    title: '  Frontend Intern  ',
    location: '   ',
    url: '',
    notes: '',
  });
  assert.equal(result.title, 'Frontend Intern');
  assert.equal(result.status, 'APPLIED');
  assert.equal(result.location, null);
  assert.equal(result.url, null);
  assert.equal(result.notes, null);
});

test('create: rejects missing/blank required fields and unknown enum values', () => {
  assert.equal(ApplicationSchema.safeParse({ ...valid, title: '   ' }).success, false);
  assert.equal(ApplicationSchema.safeParse({ ...valid, company: '' }).success, false);
  assert.equal(ApplicationSchema.safeParse({ ...valid, type: 'Freelance' }).success, false);
  assert.equal(ApplicationSchema.safeParse({ ...valid, platform: 'MySpace' }).success, false);
  assert.equal(ApplicationSchema.safeParse({ ...valid, status: 'GHOSTED' }).success, false);
});

test('create: rejects server-managed and unknown fields (strict)', () => {
  for (const extra of [{ id: crypto.randomUUID() }, { appliedAt: '2020-01-01' }, { updatedAt: 'x' }, { isAdmin: true }]) {
    assert.equal(ApplicationSchema.safeParse({ ...valid, ...extra }).success, false);
  }
});

test('create: only allows http(s) URLs', () => {
  assert.equal(ApplicationSchema.safeParse({ ...valid, url: 'https://example.com/job' }).success, true);
  assert.equal(ApplicationSchema.safeParse({ ...valid, url: 'http://example.com' }).success, true);
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com', 'not a url', '//evil.com']) {
    assert.equal(ApplicationSchema.safeParse({ ...valid, url }).success, false, url);
  }
});

test('create: enforces length limits', () => {
  assert.equal(ApplicationSchema.safeParse({ ...valid, title: 'a'.repeat(201) }).success, false);
  assert.equal(ApplicationSchema.safeParse({ ...valid, notes: 'a'.repeat(5001) }).success, false);
});

test('update: partial updates do not reset status to the create default', () => {
  const result = UpdateApplicationSchema.parse({ notes: 'follow up Friday' });
  assert.deepEqual(result, { notes: 'follow up Friday' });
  assert.equal('status' in result, false);
});

test('update: null or empty string clears optional fields; omitted stays undefined', () => {
  const result = UpdateApplicationSchema.parse({ location: null, url: '' });
  assert.equal(result.location, null);
  assert.equal(result.url, null);
  assert.equal(result.notes, undefined);
});

test('update: rejects empty body, blank required fields, and unknown fields', () => {
  assert.equal(UpdateApplicationSchema.safeParse({}).success, false);
  assert.equal(UpdateApplicationSchema.safeParse({ title: ' ' }).success, false);
  assert.equal(UpdateApplicationSchema.safeParse({ title: null }).success, false);
  assert.equal(UpdateApplicationSchema.safeParse({ id: crypto.randomUUID() }).success, false);
  assert.equal(UpdateApplicationSchema.safeParse({ status: 'OFFER' }).success, true);
});

test('list query: validates filters and ignores unrelated params', () => {
  const result = ListApplicationsQuerySchema.parse({ q: ' acme ', platform: 'Glints', type: 'Job', status: 'OFFER', page: '2' });
  assert.equal(result.q, 'acme');
  assert.equal(ListApplicationsQuerySchema.safeParse({ platform: 'Nope' }).success, false);
  assert.equal(ListApplicationsQuerySchema.safeParse({ status: 'nope' }).success, false);
  assert.deepEqual(ListApplicationsQuerySchema.parse({}), {});
});

test('id: accepts UUIDs only', () => {
  assert.equal(ApplicationIdSchema.safeParse(crypto.randomUUID()).success, true);
  assert.equal(ApplicationIdSchema.safeParse('123').success, false);
  assert.equal(ApplicationIdSchema.safeParse("1' OR '1'='1").success, false);
});

test('create: empty platform/type produce friendly messages for the form', () => {
  const platform = ApplicationSchema.safeParse({ ...valid, platform: '' });
  assert.equal(platform.error.issues[0].message, 'Select a platform');
  const type = ApplicationSchema.safeParse({ ...valid, type: '' });
  assert.equal(type.error.issues[0].message, 'Select a type');
});

test('create: accepts the raw string values a form submits', () => {
  const result = ApplicationSchema.parse({ ...valid, status: 'APPLIED', location: '', url: '', notes: '' });
  assert.deepEqual([result.location, result.url, result.notes], [null, null, null]);
});
