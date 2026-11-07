import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { ApiError, createApplication, listApplications, updateApplicationStatus } from '../src/lib/applications-client.ts';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const reply = (status, body) => async () =>
  new Response(body === undefined ? 'not json' : JSON.stringify(body), { status });

test('listApplications returns the applications array', async () => {
  globalThis.fetch = reply(200, { applications: [{ id: '1' }] });
  assert.deepEqual(await listApplications(), [{ id: '1' }]);
});

test('listApplications surfaces the server error message and status', async () => {
  globalThis.fetch = reply(401, { error: 'Unauthorized' });
  await assert.rejects(listApplications(), (e) => e instanceof ApiError && e.status === 401 && e.message === 'Unauthorized');
});

test('listApplications handles non-JSON error bodies and malformed success bodies', async () => {
  globalThis.fetch = reply(502, undefined);
  await assert.rejects(listApplications(), (e) => e instanceof ApiError && e.status === 502 && /502/.test(e.message));
  globalThis.fetch = reply(200, { nope: true });
  await assert.rejects(listApplications(), (e) => e instanceof ApiError);
});

test('network failures become ApiError with status 0', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(listApplications(), (e) => e instanceof ApiError && e.status === 0);
});

test('aborted requests keep their AbortError (so callers can ignore them)', async () => {
  globalThis.fetch = async () => {
    throw new DOMException('aborted', 'AbortError');
  };
  await assert.rejects(listApplications(), (e) => e.name === 'AbortError');
});

test('updateApplicationStatus sends a PATCH with only the status and encodes the id', async () => {
  let call;
  globalThis.fetch = async (url, init) => {
    call = { url, init };
    return new Response(JSON.stringify({ application: { id: 'a/b', status: 'OFFER' } }), { status: 200 });
  };
  const saved = await updateApplicationStatus('a/b', 'OFFER');
  assert.equal(saved.status, 'OFFER');
  assert.equal(call.url, '/api/applications/a%2Fb');
  assert.equal(call.init.method, 'PATCH');
  assert.deepEqual(JSON.parse(call.init.body), { status: 'OFFER' });
});

test('updateApplicationStatus reports 404 for rows deleted elsewhere', async () => {
  globalThis.fetch = reply(404, { error: 'Application not found' });
  await assert.rejects(updateApplicationStatus('x', 'OFFER'), (e) => e instanceof ApiError && e.status === 404);
});

test('createApplication POSTs the payload and returns the created row', async () => {
  let call;
  globalThis.fetch = async (url, init) => {
    call = { url, init };
    return new Response(JSON.stringify({ application: { id: 'new', status: 'APPLIED' } }), { status: 201 });
  };
  const payload = { title: 'T', company: 'C', type: 'Job', platform: 'Glints', status: 'APPLIED', location: null, url: null, notes: null };
  const created = await createApplication(payload);
  assert.equal(created.id, 'new');
  assert.equal(call.url, '/api/applications');
  assert.equal(call.init.method, 'POST');
  assert.deepEqual(JSON.parse(call.init.body), payload);
});

test('createApplication exposes server validation issues on ApiError', async () => {
  globalThis.fetch = reply(400, { error: 'Invalid request', issues: [{ path: 'url', message: 'URL must start with http:// or https://' }, { bad: true }] });
  await assert.rejects(createApplication({}), (e) =>
    e instanceof ApiError && e.status === 400 && e.issues.length === 1 && e.issues[0].path === 'url');
});

test('updateApplication PATCHes exactly the provided fields', async () => {
  let call;
  globalThis.fetch = async (url, init) => {
    call = { url, init };
    return new Response(JSON.stringify({ application: { id: '1', notes: null } }), { status: 200 });
  };
  const { updateApplication } = await import('../src/lib/applications-client.ts');
  await updateApplication('1', { notes: null, location: 'Remote' });
  assert.equal(call.init.method, 'PATCH');
  assert.deepEqual(JSON.parse(call.init.body), { notes: null, location: 'Remote' });
});

test('deleteApplication sends DELETE and surfaces 404/network errors', async () => {
  let call;
  globalThis.fetch = async (url, init) => {
    call = { url, init };
    return new Response(JSON.stringify({ ok: true, id: 'a/b' }), { status: 200 });
  };
  const { deleteApplication } = await import('../src/lib/applications-client.ts');
  assert.equal(await deleteApplication('a/b'), undefined);
  assert.equal(call.url, '/api/applications/a%2Fb');
  assert.equal(call.init.method, 'DELETE');

  globalThis.fetch = reply(404, { error: 'Application not found' });
  await assert.rejects(deleteApplication('x'), (e) => e instanceof ApiError && e.status === 404);
  globalThis.fetch = async () => {
    throw new TypeError('offline');
  };
  await assert.rejects(deleteApplication('x'), (e) => e instanceof ApiError && e.status === 0);
});
