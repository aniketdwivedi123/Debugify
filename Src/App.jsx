import React, { useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import './App.css'
import Navbar from './components/Navbar'
import { buildCodeIssueReview, buildFallbackReview, buildReviewDisplay, collectCodeIssues, describeReviewError, prepareReviewPrompt, resolveActiveApiKey } from './reviewUtils'

// Lightweight Markdown → HTML renderer (no external deps)
function renderMarkdown(text) {
  if (!text) return ''
  let html = text
    // Escape HTML entities first
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Fenced code blocks  ```lang\n...\n```
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
      `<pre class="md-code-block"><code>${code.trim()}</code></pre>`
    )
    // Inline code `...`
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Headings ### ## #
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // Bold **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic *text*
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Unordered list items  - item
    .replace(/^[\-\*] (.+)$/gm, '<li class="md-li">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (block) => `<ul class="md-ul">${block}</ul>`)
    // Horizontal rule ---
    .replace(/^---+$/gm, '<hr class="md-hr" />')
    // Paragraphs — blank lines become paragraph breaks
    .replace(/\n{2,}/g, '</p><p class="md-p">')
    // Single newlines inside paragraphs become <br>
    .replace(/\n/g, '<br />')
  return `<p class="md-p">${html}</p>`
}

const languageTemplates = {
  javascript: `// Write JavaScript here\nconsole.log('Debugify editor ready');`,
  typescript: `// Write TypeScript here\nconst message: string = 'Hello';\nconsole.log(message);`,
  python: `# Write Python here\nprint('Debugify editor ready')`,
  java: `public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Debugify editor ready\");\n  }\n}`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << \"Debugify editor ready\" << endl;\n  return 0;\n}`,
  html: `<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Hello Debugify</h1>\n  </body>\n</html>`,
  css: `body {\n  font-family: Arial, sans-serif;\n  background: #111;\n  color: white;\n}`
}

const App = () => {
  const [language, setLanguage] = useState('javascript')
  const [code, setCode] = useState(languageTemplates.javascript)
  const [review, setReview] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [codeIssues, setCodeIssues] = useState([])
  const editorRef = useRef(null)
  const monacoRef = useRef(null)

  const handleLanguageChange = (event) => {
    const selectedLanguage = event.target.value
    setLanguage(selectedLanguage)
    setCode(languageTemplates[selectedLanguage] || '')
    setCodeIssues([])
  }

  const handleReview = async () => {
    if (!code.trim()) {
      setReview('')
      setReviewError('Please enter some code before reviewing it.')
      return
    }

    const activeMarkers = editorRef.current && monacoRef.current
      ? monacoRef.current.editor.getModelMarkers({ resource: editorRef.current.getModel()?.uri })
      : []
    const currentIssues = collectCodeIssues(code, language, activeMarkers.map((marker) => ({ message: marker.message })))

    if (currentIssues.length > 0) {
      setReview(buildCodeIssueReview(currentIssues, code, language))
      setReviewError('')
      return
    }

    const apiKey = resolveActiveApiKey(apiKeyInput, import.meta.env.VITE_GEMINI_API_KEY)

    if (!apiKey) {
      setReview('')
      setReviewError('AI reviews are disabled. Add a valid API key to enable reviews.')
      return
    }

    setIsReviewing(true)
    setReviewError('')
    setReview('')

    try {
      const prompt = prepareReviewPrompt(language, code, 1100)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemini-3.6-flash',
            input: prompt.text
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error?.message || 'Gemini request failed.')
      }

      // Parse text from Interactions API step outputs
      const modelOutputStep = data.steps?.find((step) => step.type === 'model_output')
      const textObj = modelOutputStep?.content?.find((item) => item.type === 'text')
      const generatedText = textObj?.text || data?.steps?.[0]?.content?.[0]?.text || 'No review available.'

      setReview(generatedText)
    } catch (error) {
      const friendlyMessage = describeReviewError(error.message)
      const fallbackReview = buildFallbackReview(code, language)
      setReviewError('')
      setReview(buildReviewDisplay(fallbackReview, friendlyMessage))
    } finally {
      setIsReviewing(false)
    }
  }

  return (
    <div>
      <Navbar />
      <div className="app-layout">
        <p className="page-response">Response</p>
        <div className="editor-wrapper">
          <div className="editor-panel rounded-xl bg-zinc-950/90 shadow-xl overflow-hidden">
            <div className="editor-surface">
              <Editor
                height="100%"
                language={language}
                value={code}
                theme="vs-dark"
                onChange={(value) => {
                  setCode(value || '')
                }}
                onMount={(editor, monaco) => {
                  editorRef.current = editor
                  monacoRef.current = monaco

                  const updateMarkers = () => {
                    const model = editor.getModel()
                    if (!model) return

                    const markers = monaco.editor.getModelMarkers({ resource: model.uri })
                    setCodeIssues(markers.map((marker) => ({ message: marker.message })))
                  }

                  editor.onDidChangeModelContent(updateMarkers)
                  monaco.editor.onDidChangeMarkers(updateMarkers)
                  updateMarkers()
                }}
              />
            </div>

            <div className="language-toolbar">
              <label className="language-label" htmlFor="language-select">
                Select language
              </label>
              <select
                id="language-select"
                value={language}
                onChange={handleLanguageChange}
                className="language-select"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
              </select>
              
              <button className="review-button" onClick={handleReview} disabled={isReviewing}>
                <span style={{fontSize: 16}}>🔍</span>
                {isReviewing ? 'Analyzing...' : 'Review'}
              </button>
            </div>
          </div>
        </div>

        <div className="response-panel">
          {isReviewing ? (
            <p className="response-body">Analyzing your code…</p>
          ) : review ? (
            <div
              className="response-body md-rendered"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(review) }}
            />
          ) : reviewError ? (
            <p className="response-error">{reviewError}</p>
          ) : (
            <p className="response-body">Click Review to get an AI-based debugging response for your code.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
