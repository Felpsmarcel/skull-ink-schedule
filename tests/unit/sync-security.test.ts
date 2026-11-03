import { describe, expect, it } from 'vitest';
import { privateSyncAuthorized } from '../../src/lib/sync-auth.server';
import { ownershipConflict, syncFreshness, SYNC_LOCATION_ID, SYNC_QUERY_KEYS } from '../../src/lib/sync-core';

describe('private sync authorization (fictional credentials)', () => {
  it('fails closed without the dedicated secret, even with public credentials', () => {
    expect(privateSyncAuthorized(new Request('https://example.test', { headers: { apikey: 'fake-public', authorization: 'Bearer fake-public' } }), undefined)).toBe(false);
  });
  it('rejects the public-key header', () => {
    expect(privateSyncAuthorized(new Request('https://example.test', { headers: { apikey: 'fictional-private' } }), 'fictional-private')).toBe(false);
  });
  it('accepts only the dedicated bearer', () => {
    expect(privateSyncAuthorized(new Request('https://example.test', { headers: { authorization: 'Bearer fictional-private' } }), 'fictional-private')).toBe(true);
    expect(privateSyncAuthorized(new Request('https://example.test', { headers: { authorization: 'Bearer invalid' } }), 'fictional-private')).toBe(false);
  });
});
describe('studio boundaries and real completion', () => {
  it('fixes the owner-confirmed location', () => expect(SYNC_LOCATION_ID).toBe('9iqrKUVPDddINb9S4Iwd'));
  it('blocks changed artists', () => expect(ownershipConflict({ artist_id: 'a', calendar_id: 'c' }, 'b', 'c')).toBe(true));
  it('blocks changed calendars', () => expect(ownershipConflict({ artist_id: 'a', calendar_id: 'c' }, 'a', 'new')).toBe(true));
  it('blocks events belonging to another calendar', () => expect(ownershipConflict(undefined, 'a', 'c', 'other')).toBe(true));
  it('allows unchanged ownership', () => expect(ownershipConflict({ artist_id: 'a', calendar_id: 'c' }, 'a', 'c', 'c')).toBe(false));
  it('does not label missing completion as current', () => expect(syncFreshness(null, 'succeeded')).toBe('stale'));
  it('shows failure despite previous completion', () => expect(syncFreshness(new Date().toISOString(), 'failed')).toBe('failed'));
  it('invalidates both range caches', () => {
    expect(SYNC_QUERY_KEYS).toContain('agenda-range');
    expect(SYNC_QUERY_KEYS).toContain('agenda-status-range');
  });
});
