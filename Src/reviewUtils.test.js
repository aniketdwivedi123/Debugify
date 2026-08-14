import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCodeIssueReview, buildFallbackReview, buildReviewDisplay, collectCodeIssues, describeReviewError, prepareReviewPrompt, resolveActiveApiKey } from './reviewUtils.js'

test('buildFallbackReview includes a useful summary and issue hints', () => {
  const review = buildFallbackReview("const x = 1\nif (x == 1) console.log(x)", 'javascript')

  assert.match(review, /Summary:/)
  assert.match(review, /Potential issues:/)
  assert.match(review, /===/i)
})

test('resolveActiveApiKey prefers the pasted key when provided', () => {
  assert.equal(resolveActiveApiKey('paste-key', 'env-key'), 'paste-key')
  assert.equal(resolveActiveApiKey('', 'env-key'), 'env-key')
  assert.equal(resolveActiveApiKey('   ', ''), '')
})

test('describeReviewError explains quota limits clearly', () => {
  const message = describeReviewError('Quota exceeded for metric: generate_content_free_tier_requests')
  assert.match(message, /quota|rate/i)
})

test('buildReviewDisplay keeps the fallback review visible when an error is shown', () => {
  const fallbackReview = buildFallbackReview('const x = 1', 'javascript')
  const combined = buildReviewDisplay(fallbackReview, 'Gemini is currently rate-limited or out of quota.')

  assert.match(combined, /rate-limited/i)
  assert.match(combined, /Potential issues:/i)
})

test('buildCodeIssueReview surfaces editor diagnostics as review text', () => {
  const review = buildCodeIssueReview([{ message: 'Unexpected token' }], 'const x =', 'javascript')

  assert.match(review, /Errors:/i)
  assert.match(review, /Unexpected token/i)
})

test('buildCodeIssueReview includes every detected issue message', () => {
  const review = buildCodeIssueReview(
    [{ message: 'Unexpected token' }, { message: 'Missing semicolon' }, { message: 'Undefined variable' }],
    'const x =',
    'javascript'
  )

  assert.match(review, /Unexpected token/i)
  assert.match(review, /Missing semicolon/i)
  assert.match(review, /Undefined variable/i)
})

test('collectCodeIssues merges editor markers with fallback diagnostics', () => {
  const issues = collectCodeIssues('function test( {', 'javascript', [{ message: 'Unexpected token' }])

  assert.match(issues.join(' '), /Unexpected token/i)
  assert.match(issues.join(' '), /unbalanced/i)
})

test('buildFallbackReview gives actionable replacement guidance', () => {
  const review = buildFallbackReview('if (x == 1) { console.log(x) }', 'javascript')

  assert.match(review, /Replace/i)
  assert.match(review, /===/i)
})

test('prepareReviewPrompt trims long code for free-tier usage', () => {
  const longCode = 'const x = 1;\n'.repeat(2500)
  const payload = prepareReviewPrompt('javascript', longCode, 800)

  assert.match(payload.text, /truncated/i)
  assert.ok(payload.code.length <= 800 + 80)
  assert.equal(payload.wasTruncated, true)
})
