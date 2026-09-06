import { useEffect, useRef, useState } from 'react'
import './App.css'

const recordsStorageKey = 'type-training-records'
const customArticlesStorageKey = 'type-training-articles'
const punctuationMap = {
  '。': '.',
  '，': ',',
  '：': ':',
  '；': ';',
  '？': '?',
  '！': '!',
  '（': '(',
  '）': ')',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
}
const normalizeCharacter = (character) => punctuationMap[character] || character
const leftHandKeys = new Set('12345!@#$%qwertasdfgzxcvb~')
const rightHandKeys = new Set(`67890^&*()yuiophjklnm-_=+[]{}\\|;:'",.<>/?`)
const articleModules = import.meta.glob('./articles/*.txt', { query: '?raw', import: 'default', eager: true })
const articles = Object.entries(articleModules).map(([path, content]) => ({
  id: path,
  name: path.split('/').pop().replace(/\.txt$/, '').replace(/[-_]/g, ' '),
  text: content.trim(),
})).filter((article) => article.text).map((article) => ({
  ...article,
  wordCount: article.text.split(/\s+/).filter(Boolean).length,
}))

function readStoredRecords() {
  try {
    const stored = window.localStorage.getItem(recordsStorageKey)
    const records = stored ? JSON.parse(stored) : []
    return Array.isArray(records) ? records : []
  } catch {
    return []
  }
}

function readStoredArticles() {
  try {
    const stored = window.localStorage.getItem(customArticlesStorageKey)
    const savedArticles = stored ? JSON.parse(stored) : []
    return Array.isArray(savedArticles) ? savedArticles.filter((article) => article?.id && article?.name && article?.text) : []
  } catch {
    return []
  }
}

function getArticleStats(text) {
  const typedCharacters = text.toLowerCase().split('').filter((character) => !/\s/.test(character))
  const leftHand = typedCharacters.filter((character) => leftHandKeys.has(normalizeCharacter(character))).length
  const rightHand = typedCharacters.filter((character) => rightHandKeys.has(normalizeCharacter(character))).length
  const totalHands = leftHand + rightHand

  return {
    words: text.split(/\s+/).filter(Boolean).length,
    characters: text.length,
    leftHand,
    rightHand,
    leftPercent: totalHands ? Math.round((leftHand / totalHands) * 100) : 0,
    rightPercent: totalHands ? Math.round((rightHand / totalHands) * 100) : 0,
  }
}

function TypingApp() {
  const requestedArticleId = new URLSearchParams(window.location.search).get('article')
  const [typed, setTyped] = useState('')
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [selectedArticleId, setSelectedArticleId] = useState(() => {
    const articleIds = [...articles, ...readStoredArticles()].map((article) => article.id)
    return articleIds.includes(requestedArticleId) ? requestedArticleId : articles[0]?.id || ''
  })
  const [records, setRecords] = useState(readStoredRecords)
  const [customArticles, setCustomArticles] = useState(readStoredArticles)
  const [recordMessage, setRecordMessage] = useState('')
  const [showRecords, setShowRecords] = useState(true)
  const importInputRef = useRef(null)
  const savedRoundRef = useRef(false)
  const typingSurfaceRef = useRef(null)
  const activeCharacterRef = useRef(null)
  const availableArticles = [...articles, ...customArticles]
  const selectedArticle = availableArticles.find((article) => article.id === selectedArticleId) || availableArticles[0]
  const targetText = selectedArticle?.text || ''

  const isComplete = targetText.length > 0 && typed.length === targetText.length
  const correct = typed.split('').filter((character, index) => normalizeCharacter(character) === normalizeCharacter(targetText[index])).length
  const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100
  const wpm = elapsed > 0 ? Math.round((correct / 5) / (elapsed / 60000)) : 0
  const cpm = elapsed > 0 ? Math.round(correct / (elapsed / 60000)) : 0
  const personalBestWpm = records.length ? Math.max(...records.map((record) => record.wpm || 0)) : 0
  const today = new Date()
  const todayRecords = records.filter((record) => {
    const recordDate = new Date(record.createdAt)
    return recordDate.toDateString() === today.toDateString()
  })
  const todayAverageWpm = todayRecords.length
    ? Math.round(todayRecords.reduce((total, record) => total + (record.wpm || 0), 0) / todayRecords.length)
    : 0

  const formatTime = (milliseconds) => `${(milliseconds / 1000).toFixed(1)}s`
  const formatRecordDate = (createdAt) => {
    const date = new Date(createdAt)
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  }

  useEffect(() => {
    if (!startedAt || isComplete) return undefined

    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 100)
    return () => window.clearInterval(timer)
  }, [startedAt, isComplete])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Enter') {
        const target = event.target
        if (target instanceof HTMLElement && target.closest('button, a, input, select, textarea')) return
        event.preventDefault()
        restart()
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        if (!isComplete && typed.length) setTyped(typed.slice(0, -1))
        return
      }

      const character = event.key.length === 1 ? event.key : ''
      if (isComplete || !character) return
      event.preventDefault()

      const nextValue = typed + character
      const timestamp = startedAt || Date.now()
      if (!startedAt) setStartedAt(timestamp)
      setTyped(nextValue)
      if (nextValue.length === targetText.length) setElapsed(Date.now() - timestamp)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isComplete, startedAt, targetText, typed])

  useEffect(() => {
    if (!isComplete || savedRoundRef.current) return

    savedRoundRef.current = true

    const record = {
      id: Date.now(),
      time: elapsed,
      accuracy,
      wpm,
      createdAt: new Date().toISOString(),
    }
    const nextRecords = [record, ...records].slice(0, 20)
    setRecords(nextRecords)
    window.localStorage.setItem(recordsStorageKey, JSON.stringify(nextRecords))
  // A completed round should be saved once, when completion changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete])

  useEffect(() => {
    function handleArticleStorage(event) {
      if (event.key === customArticlesStorageKey) setCustomArticles(readStoredArticles())
    }

    window.addEventListener('storage', handleArticleStorage)
    return () => window.removeEventListener('storage', handleArticleStorage)
  }, [])

  useEffect(() => {
    if (!typingSurfaceRef.current || !activeCharacterRef.current) return

    const surface = typingSurfaceRef.current
    const surfaceRect = surface.getBoundingClientRect()
    const characterRect = activeCharacterRef.current.getBoundingClientRect()
    const topPadding = 38
    const activeLineOffset = characterRect.top - surfaceRect.top - topPadding

    if (Math.abs(activeLineOffset) > 1) {
      surface.scrollTop = Math.max(0, Math.round(surface.scrollTop + activeLineOffset))
    }
  }, [targetText, typed])

  function restart() {
    setTyped('')
    setStartedAt(null)
    setElapsed(0)
    savedRoundRef.current = false
  }

  function handleArticleChange(event) {
    setSelectedArticleId(event.target.value)
    restart()
  }

  function deleteRecord(recordId) {
    const nextRecords = records.filter((record) => record.id !== recordId)
    setRecords(nextRecords)
    window.localStorage.setItem(recordsStorageKey, JSON.stringify(nextRecords))
  }

  function clearRecords() {
    setRecords([])
    window.localStorage.removeItem(recordsStorageKey)
  }

  function exportRecords() {
    const file = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'type-training-records.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(event) {
    const [file] = event.target.files
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result)
        if (!Array.isArray(imported)) throw new Error('Records must be an array')

        const validRecords = imported.filter((record) => (
          record && Number.isFinite(record.time) && Number.isFinite(record.accuracy) && Number.isFinite(record.wpm)
        )).map((record, index) => ({
          id: Date.now() + index,
          time: record.time,
          accuracy: record.accuracy,
          wpm: record.wpm,
          createdAt: record.createdAt || new Date().toISOString(),
        })).slice(0, 20)

        setRecords(validRecords)
        window.localStorage.setItem(recordsStorageKey, JSON.stringify(validRecords))
        setRecordMessage(`${validRecords.length} record${validRecords.length === 1 ? '' : 's'} imported`)
      } catch {
        setRecordMessage('Could not import that file')
      }
      event.target.value = ''
    }
    reader.readAsText(file)
  }

  function renderTargetText() {
    let characterIndex = 0

    return targetText.split(/(\s+)/).filter(Boolean).map((part, partIndex) => {
      const partStart = characterIndex
      characterIndex += part.length

      if (/\s+/.test(part)) {
        return <span className="text-space" key={`space-${partIndex}`}>{part.split('').map((character, offset) => renderTargetCharacter(character, partStart + offset))}</span>
      }

      return <span className="word" key={`word-${partIndex}`}>{part.split('').map((character, offset) => renderTargetCharacter(character, partStart + offset))}</span>
    })
  }

  function renderTargetCharacter(character, index) {
    const state = index < typed.length ? (normalizeCharacter(typed[index]) === normalizeCharacter(character) ? 'correct' : 'incorrect') : index === typed.length ? 'current' : ''
    const className = `${state}${character === ' ' ? ' space' : ''}`
    return <span className={className} key={`${character}-${index}`} ref={index === typed.length ? activeCharacterRef : undefined}>{character}</span>
  }

  return (
    <main className="typing-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Type home"><span className="brand-mark">T</span><span>Type Training</span></a>
        <div className="header-stats" aria-label="Typing performance summary">
          <div className="header-stat"><span>WPM PR</span><strong>{personalBestWpm}</strong></div>
          <div className="header-stat"><span>TODAY AVG</span><strong>{todayAverageWpm}</strong></div>
        </div>
        <span className="session-label">"Stay hungry, stay foolish" -- Steve Jobs</span>
      </header>
      
      <section className="practice-area" aria-labelledby="page-title">
        {/* <div className="intro"><p className="eyebrow">A — Z / BEGINNER DRILL</p><h1 id="page-title">Find your flow.</h1><p className="lede">Type the alphabet as quickly and accurately as you can.</p></div> */}
        <div className="test-panel">
          <div className="test-header"><span className="test-status">{isComplete ? 'Round complete' : startedAt ? 'In progress' : 'Ready when you are'}</span><div className="article-picker"><a className="article-library-link" href="?view=articles">ARTICLES</a><select id="article-select" value={selectedArticleId} onChange={handleArticleChange}>{availableArticles.map((article) => <option value={article.id} key={article.id}>{article.name} ({article.wordCount || article.text.split(/\s+/).filter(Boolean).length})</option>)}</select></div><span className="test-count">{typed.length.toString().padStart(2, '0')} / {targetText.length}</span></div>
          <div className="typing-surface" aria-label="Keyboard typing area" ref={typingSurfaceRef}>
            <div className="alphabet-display">
              {renderTargetText()}
            </div>
          </div>
          <div className="metrics" aria-live="polite"><div className="metric"><span>TIME</span><strong>{formatTime(elapsed)}</strong></div><div className="metric"><span>ACCURACY</span><strong>{accuracy}%</strong></div><div className="metric speed-metric"><span>SPEED (WPM | CPM)</span><strong>{wpm} | {cpm}</strong></div></div>
        </div>
        <button className="restart-button" type="button" onClick={restart}><span aria-hidden="true">↻</span> Restart test (enter/return)</button>
        <section className="records-section" aria-labelledby="records-title">
          <div className="records-heading">
            <div><p className="eyebrow">YOUR HISTORY</p><div className="records-title-row"><h2 id="records-title">Records</h2><button className="toggle-records" type="button" onClick={() => setShowRecords((visible) => !visible)}>{showRecords ? 'Collapse' : 'Show'}</button></div></div>
            <div className="records-actions">
              <button type="button" onClick={exportRecords} disabled={!records.length}>Export</button>
              <button type="button" onClick={() => importInputRef.current?.click()}>Import</button>
              <button className="warning-button" type="button" onClick={clearRecords} disabled={!records.length}>Clear</button>
              <input ref={importInputRef} className="file-input" type="file" accept="application/json" onChange={handleImport} />
            </div>
          </div>
          {showRecords && <>
            {recordMessage && <p className="record-message" role="status">{recordMessage}</p>}
            {records.length ? (
              <div className="records-list">
                {records.map((record, index) => (
                  <div className="record-row" key={`${record.id}-${index}`}>
                    <span className="record-number">{String(records.length - index).padStart(2, '0')}</span>
                    <strong>{formatTime(record.time)}</strong>
                    <span className="record-accuracy"><b>{record.accuracy}%</b> accuracy</span>
                    <span className="record-wpm"><b>{record.wpm}</b> WPM</span>
                    <span className="record-date">{formatRecordDate(record.createdAt)}</span>
                    <button className="delete-record" type="button" onClick={() => deleteRecord(record.id)} aria-label={`Delete record ${index + 1}`}>×</button>
                  </div>
                ))}
              </div>
            ) : <p className="empty-records">Complete a round to save your first record.</p>}
          </>}
        </section>
      </section>
      <footer className="page-footer">&copy; 2026 Cody Feng. All rights reserved.</footer>
    </main>
  )
}

function ArticleLibrary() {
  const [customArticles, setCustomArticles] = useState(readStoredArticles)
  const records = readStoredRecords()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef(null)
  const allArticles = [...articles, ...customArticles]
  const personalBestWpm = records.length ? Math.max(...records.map((record) => record.wpm || 0)) : 0
  const today = new Date()
  const todayRecords = records.filter((record) => new Date(record.createdAt).toDateString() === today.toDateString())
  const todayAverageWpm = todayRecords.length
    ? Math.round(todayRecords.reduce((total, record) => total + (record.wpm || 0), 0) / todayRecords.length)
    : 0

  function saveArticle(event) {
    event.preventDefault()
    const name = title.trim()
    const content = text.trim()
    if (!name || !content) {
      setMessage('Add a title and some text first')
      return
    }

    const article = { id: `custom-${Date.now()}`, name, text: content, wordCount: content.split(/\s+/).filter(Boolean).length }
    const nextArticles = [article, ...customArticles]
    setCustomArticles(nextArticles)
    window.localStorage.setItem(customArticlesStorageKey, JSON.stringify(nextArticles))
    setTitle('')
    setText('')
    setMessage('Article added')
  }

  function handleTextFile(event) {
    const [file] = event.target.files
    if (!file) return
    setTitle(file.name.replace(/\.txt$/i, '').replace(/[-_]/g, ' '))
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result || ''))
    reader.readAsText(file)
    event.target.value = ''
  }

  function deleteArticle(articleId) {
    const nextArticles = customArticles.filter((article) => article.id !== articleId)
    setCustomArticles(nextArticles)
    window.localStorage.setItem(customArticlesStorageKey, JSON.stringify(nextArticles))
  }

  return (
    <main className="article-library-page">
      <header className="topbar"><a className="brand" href="."><span className="brand-mark">T</span><span>Type Training</span></a><div className="header-stats" aria-label="Typing performance summary"><div className="header-stat"><span>WPM PR</span><strong>{personalBestWpm}</strong></div><div className="header-stat"><span>TODAY AVG</span><strong>{todayAverageWpm}</strong></div></div><span className="session-label">ARTICLE LIBRARY</span></header>
      <section className="article-library-content">
        <a className="article-back-button" href=".">← Back to typing</a>
        {/* <p className="eyebrow">YOUR READING ROOM</p> */}
        <h1>Articles.</h1>
        <p className="lede">Choose a passage to practice, or add one of your own.</p>
        <form className="article-form" onSubmit={saveArticle}>
          <div className="article-form-heading"><h2>Add an article</h2><button type="button" onClick={() => fileInputRef.current?.click()}>Import .txt</button><input ref={fileInputRef} className="file-input" type="file" accept="text/plain,.txt" onChange={handleTextFile} /></div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Article title" aria-label="Article title" />
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste or type your article here" aria-label="Article text" rows="7" />
          <button type="submit">Add</button>
          {message && <p className="record-message" role="status">{message}</p>}
        </form>
        <div className="library-list">
          {allArticles.map((article) => { const stats = getArticleStats(article.text); return <article className="library-row" key={article.id}><a className="library-select" href={`?article=${encodeURIComponent(article.id)}`}><h2>{article.name}</h2><div className="article-stats"><span>{stats.words} words</span><span>{stats.characters} characters</span><span>Left {stats.leftHand} ({stats.leftPercent}%)</span><span>Right {stats.rightHand} ({stats.rightPercent}%)</span></div></a>{article.id.startsWith('custom-') && <button className="delete-record" type="button" onClick={() => deleteArticle(article.id)} aria-label={`Delete ${article.name}`}>×</button>}</article> })}
        </div>
      </section>
    </main>
  )
}

function App() {
  const isArticleLibrary = new URLSearchParams(window.location.search).get('view') === 'articles'
  return isArticleLibrary ? <ArticleLibrary /> : <TypingApp />
}

export default App
