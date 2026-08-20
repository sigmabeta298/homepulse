import { describe, it, expect } from 'vitest';
import { isEmailAllowed } from './auth-allowlist';

describe('isEmailAllowed', () => {
	it('allows an email that exactly matches the list', () => {
		expect(isEmailAllowed('me@gmail.com', 'me@gmail.com,family@gmail.com')).toBe(true);
	});

	it('rejects an email not on the list', () => {
		expect(isEmailAllowed('stranger@gmail.com', 'me@gmail.com,family@gmail.com')).toBe(false);
	});

	it('is case-insensitive (Google emails are not case-sensitive)', () => {
		expect(isEmailAllowed('ME@GMAIL.com', 'me@gmail.com')).toBe(true);
		expect(isEmailAllowed('me@gmail.com', 'ME@GMAIL.COM')).toBe(true);
	});

	it('tolerates stray whitespace in the env var list', () => {
		expect(isEmailAllowed('me@gmail.com', ' me@gmail.com , family@gmail.com ')).toBe(true);
	});

	it('fails closed when the allowlist env var is unset (locks everyone out, not in)', () => {
		expect(isEmailAllowed('me@gmail.com', undefined)).toBe(false);
	});

	it('fails closed when the allowlist env var is an empty string', () => {
		expect(isEmailAllowed('me@gmail.com', '')).toBe(false);
	});

	it('fails closed when the allowlist is just stray commas/whitespace', () => {
		expect(isEmailAllowed('me@gmail.com', ' , , ')).toBe(false);
	});

	it('rejects a null or undefined email outright', () => {
		expect(isEmailAllowed(null, 'me@gmail.com')).toBe(false);
		expect(isEmailAllowed(undefined, 'me@gmail.com')).toBe(false);
	});

	it('does not partial-match (a substring of an allowed email is not allowed)', () => {
		expect(isEmailAllowed('me@gmail.co', 'me@gmail.com')).toBe(false);
		expect(isEmailAllowed('notme@gmail.com', 'me@gmail.com')).toBe(false);
	});

	it('handles a single-email allowlist with no commas', () => {
		expect(isEmailAllowed('me@gmail.com', 'me@gmail.com')).toBe(true);
	});
});
