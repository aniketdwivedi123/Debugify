export function buildFallbackReview(code, language) {
  const trimmed = (code || '').trim()
  const summary = trimmed
    ? `Summary: The ${language || 'provided'} code has an error. The response below shows the actual error in your code and what should be changed to fix it.`
    : 'Summary: No code was provided yet.'

  const issues = []
  if (/==/.test(trimmed)) issues.push('Replace == with === to avoid type coercion issues.')
  if (/console\.log/.test(trimmed)) issues.push('Replace console.log with a clearer explanation or comment for maintainability.')
  if (!trimmed) issues.push('Paste some code to get a meaningful review.')

  return [summary, '', 'Potential issues:', ...issues].join('\n')
}

export function buildCodeIssueReview(codeIssues, code, language) {
  const issues = Array.isArray(codeIssues) ? codeIssues : []
  const trimmedCode = (code || '').trim()

  if (!issues.length) {
    return buildFallbackReview(trimmedCode, language)
  }

  const summarizedIssues = issues
    .map((issue) => {
      if (typeof issue === 'string') return issue
      return issue?.message || 'Code issue detected.'
    })
    .map((message) => `- ${message}`)
    .join('\n')

  const summary = trimmedCode
    ? `Summary: The ${language || 'provided'} code has an error. The response below shows the actual error in your code and what should be changed to fix it.`
    : 'Summary: No code was provided yet.'

  return [summary, '', 'Errors:', summarizedIssues].join('\n')
}

export function collectCodeIssues(code, language, editorMarkers = []) {
  const markers = Array.isArray(editorMarkers) ? editorMarkers : []
  const normalizedCode = (code || '').trim()
  const issues = markers
    .map((marker) => {
      const message = marker?.message || 'Code issue detected.'
      const line = marker?.startLineNumber || marker?.startLine || 1
      return `Line ${line}: ${message}`
    })
    .filter(Boolean)

  const fallbackIssues = []
  if (!normalizedCode) {
    fallbackIssues.push('Line 1: No code was provided yet. Add your code and try again.')
  } else {
    if (language === 'javascript' && /\{[^}]*$/.test(normalizedCode)) {
      fallbackIssues.push('Line 1: Unbalanced braces detected. Replace the opening brace with a matching closing brace or remove the extra one.')
    }
    if (language === 'javascript' && /\bfunction\b/.test(normalizedCode) && /\(/.test(normalizedCode) && !/\)/.test(normalizedCode)) {
      fallbackIssues.push('Line 1: Missing closing parenthesis. Add the missing ) to complete the function call or declaration.')
    }
    if (language === 'python' && /:\s*$/.test(normalizedCode) && !/\n/.test(normalizedCode)) {
      fallbackIssues.push('Line 1: Possible missing block indentation. Add the required indentation under the statement that ends with :.')
    }
  }

  return [...issues, ...fallbackIssues]
}

export function resolveActiveApiKey(apiKeyInput, envApiKey) {
  const inputKey = (apiKeyInput || '').trim()
  const envKey = (envApiKey || '').trim()
  return inputKey || envKey
}

export function describeReviewError(message) {
  const text = (message || '').toLowerCase()

  if (
    text.includes('no longer available') ||
    text.includes('model not found') ||
    text.includes('deprecated') ||
    text.includes('not supported')
  ) {
    return 'The selected Gemini model was deprecated. Debugify has been updated to use gemini-3.6-flash with the Google Interactions API. Please try again.'
  }

  if (text.includes('quota') || text.includes('rate limit') || text.includes('free tier')) {
    return 'Gemini is currently rate-limited or out of quota. Please try again later or use a paid plan.'
  }

  if (text.includes('api key') || text.includes('invalid') || text.includes('unauthorized')) {
    return 'The Gemini API key looks invalid or missing. Please enter a valid key and try again.'
  }

  return message || 'Could not generate a review right now.'
}

export function buildReviewDisplay(reviewText, errorMessage) {
  const normalizedReview = (reviewText || '').trim()
  const normalizedError = (errorMessage || '').trim()

  if (!normalizedReview) return normalizedError
  if (!normalizedError) return normalizedReview

  return [normalizedError, normalizedReview].filter(Boolean).join('\n\n')
}

export function prepareReviewPrompt(language, code, maxChars = 1200) {
  const basePrompt = `You are Debugify, a senior code reviewer. Review the following ${language} code. Return a short but useful response with:
- a summary of the code
- possible bugs or issues
- improvement suggestions
- a corrected version if needed
Keep the response concise and practical.`

  const normalizedCode = (code || '').trim()
  const codeSnippet = normalizedCode.length > maxChars
    ? `${normalizedCode.slice(0, maxChars)}\n\n// Code truncated for free-tier usage.`
    : normalizedCode

  return {
    text: `${basePrompt}\n\nCode:\n\n${codeSnippet}`,
    code: codeSnippet,
    wasTruncated: normalizedCode.length > maxChars,
  }
}
