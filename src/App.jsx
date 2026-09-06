import { useEffect, useRef, useState } from 'react'
import './App.css'

const alphabet = 'abcdefghijklmnopqrstuvwxyz'

function App() {
  const [typed, setTyped] = useState('')
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef(null)

  const isComplete = typed.length === alphabet.length
  const correct = typed.split('').filter((letter, index) => letter === alphabet[index]).length
  const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100
  const wpm = elapsed > 0 ? Math.round((correct / 5) / (elapsed / 60000)) : 0

  useEffect(() => {
    if (!startedAt || isComplete) return undefined

    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 100)
    return () => window.clearInterval(timer)
  }, [startedAt, isComplete])

  function handleChange(event) {
    const nextValue = event.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, alphabet.length)
    if (!startedAt && nextValue) setStartedAt(Date.now())
    setTyped(nextValue)
    if (nextValue.length === alphabet.length) setElapsed(startedAt ? Date.now() - startedAt : 0)
  }

  function restart() {
    setTyped('')
    setStartedAt(null)
    setElapsed(0)
    inputRef.current?.focus()
  }

  const formatTime = (milliseconds) => `${(milliseconds / 1000).toFixed(1)}s`

  return (
    <main className="typing-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Type home"><span className="brand-mark">T</span><span>Type Training</span></a>
        <span className="session-label">SPEED SESSION / 01</span>
      </header>
      <section className="practice-area" aria-labelledby="page-title">
        <div className="intro"><p className="eyebrow">A — Z / BEGINNER DRILL</p><h1 id="page-title">Find your flow.</h1><p className="lede">Type the alphabet as quickly and accurately as you can.</p></div>
        <div className="test-panel">
          <div className="test-header"><span className="test-status">{isComplete ? 'Round complete' : startedAt ? 'In progress' : 'Ready when you are'}</span><span className="test-count">{typed.length.toString().padStart(2, '0')} / 26</span></div>
          <div className="alphabet-display" aria-label="Alphabet typing progress">
            {alphabet.split('').map((letter, index) => { const state = index < typed.length ? (typed[index] === letter ? 'correct' : 'incorrect') : index === typed.length ? 'current' : ''; return <span className={state} key={letter}>{letter}</span> })}
          </div>
          <label className="typing-input-label" htmlFor="typing-input">Your typing</label>
          <input ref={inputRef} id="typing-input" className="typing-input" value={typed} onChange={handleChange} autoComplete="off" autoCapitalize="none" spellCheck="false" placeholder="Start typing here..." disabled={isComplete} autoFocus />
          <div className="metrics" aria-live="polite"><div className="metric"><span>TIME</span><strong>{formatTime(elapsed)}</strong></div><div className="metric"><span>ACCURACY</span><strong>{accuracy}%</strong></div><div className="metric"><span>WPM</span><strong>{wpm}</strong></div></div>
        </div>
        <button className="restart-button" type="button" onClick={restart}><span aria-hidden="true">↻</span> Restart test</button>
      </section>
      <footer className="page-footer"><span>Keep your eyes on the letters.</span><span className="footer-dot" aria-hidden="true">●</span><span>Small steps, faster hands.</span></footer>
    </main>
  )
}

export default App
