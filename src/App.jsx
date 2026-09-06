import { useEffect, useRef, useState } from 'react'
import './App.css'

const recordsStorageKey = 'type-training-records'
const articleModules = import.meta.glob('./articles/*.txt', { query: '?raw', import: 'default', eager: true })
const articles = Object.entries(articleModules).map(([path, content]) => ({
  id: path,
  name: path.split('/').pop().replace(/\.txt$/, '').replace(/[-_]/g, ' '),
  text: content.trim(),
})).filter((article) => article.text)

function readStoredRecords() {
  try {
    const stored = window.localStorage.getItem(recordsStorageKey)
    const records = stored ? JSON.parse(stored) : []
    return Array.isArray(records) ? records : []
  } catch {
    return []
  }
}

function App() {
  const [typed, setTyped] = useState('')
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [selectedArticleId, setSelectedArticleId] = useState(articles[0]?.id || '')
  const [records, setRecords] = useState(readStoredRecords)
  const [recordMessage, setRecordMessage] = useState('')
  const [showRecords, setShowRecords] = useState(true)
  const importInputRef = useRef(null)
  const savedRoundRef = useRef(false)
  const selectedArticle = articles.find((article) => article.id === selectedArticleId) || articles[0]
  const targetText = selectedArticle?.text || ''

  const isComplete = targetText.length > 0 && typed.length === targetText.length
  const correct = typed.split('').filter((character, index) => character === targetText[index]).length
  const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100
  const wpm = elapsed > 0 ? Math.round((correct / 5) / (elapsed / 60000)) : 0
  const cpm = elapsed > 0 ? Math.round(correct / (elapsed / 60000)) : 0

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

  return (
    <main className="typing-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Type home"><span className="brand-mark">T</span><span>Type Training</span></a>
        <span className="session-label">"Stay hungry, stay foolish" -- Steve Jobs</span>
      </header>
      <section className="practice-area" aria-labelledby="page-title">
        {/* <div className="intro"><p className="eyebrow">A — Z / BEGINNER DRILL</p><h1 id="page-title">Find your flow.</h1><p className="lede">Type the alphabet as quickly and accurately as you can.</p></div> */}
        <div className="test-panel">
          <div className="test-header"><span className="test-status">{isComplete ? 'Round complete' : startedAt ? 'In progress' : 'Ready when you are'}</span><div className="article-picker"><label htmlFor="article-select">ARTICLE</label><select id="article-select" value={selectedArticleId} onChange={handleArticleChange}>{articles.map((article) => <option value={article.id} key={article.id}>{article.name}</option>)}</select></div><span className="test-count">{typed.length.toString().padStart(2, '0')} / {targetText.length}</span></div>
          <div className="typing-surface" aria-label="Keyboard typing area">
            <div className="alphabet-display">
              {targetText.split('').map((character, index) => { const state = index < typed.length ? (typed[index] === character ? 'correct' : 'incorrect') : index === typed.length ? 'current' : ''; const className = `${state}${character === ' ' ? ' space' : ''}`; return <span className={className} key={`${character}-${index}`}>{character}</span> })}
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
              <button className="warning-button" type="button" onClick={clearRecords} disabled={!records.length}>Clear all</button>
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

export default App
