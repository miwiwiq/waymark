import { canViewContent, relationshipOf, statusAfterFollow } from './follow-rules.js';

describe('statusAfterFollow', () => {
  it('accepts a first request to a public profile at once', () => {
    expect(statusAfterFollow(null, false)).toBe('ACCEPTED');
  });

  it('makes a first request to a private profile pending', () => {
    expect(statusAfterFollow(null, true)).toBe('PENDING');
  });

  it('treats a request after a rejection like a first request', () => {
    expect(statusAfterFollow('REJECTED', true)).toBe('PENDING');
    expect(statusAfterFollow('REJECTED', false)).toBe('ACCEPTED');
  });

  it('leaves pending and accepted requests unchanged', () => {
    expect(statusAfterFollow('PENDING', false)).toBe('PENDING');
    expect(statusAfterFollow('ACCEPTED', true)).toBe('ACCEPTED');
  });
});

describe('relationshipOf', () => {
  const owner = 'owner-id';

  it('recognizes the owner', () => {
    expect(relationshipOf(owner, owner, null)).toBe('self');
  });

  it('maps statuses to what the viewer sees', () => {
    expect(relationshipOf('viewer', owner, 'ACCEPTED')).toBe('following');
    expect(relationshipOf('viewer', owner, 'PENDING')).toBe('requested');
    expect(relationshipOf('viewer', owner, null)).toBe('none');
  });

  it('shows a rejected request as no relationship', () => {
    expect(relationshipOf('viewer', owner, 'REJECTED')).toBe('none');
  });

  it('treats anonymous visitors as strangers', () => {
    expect(relationshipOf(undefined, owner, null)).toBe('none');
  });
});

describe('canViewContent', () => {
  it('shows public profiles to everyone', () => {
    expect(canViewContent(false, 'none')).toBe(true);
  });

  it('shows private profiles to the owner and accepted followers only', () => {
    expect(canViewContent(true, 'self')).toBe(true);
    expect(canViewContent(true, 'following')).toBe(true);
    expect(canViewContent(true, 'requested')).toBe(false);
    expect(canViewContent(true, 'none')).toBe(false);
  });
});
