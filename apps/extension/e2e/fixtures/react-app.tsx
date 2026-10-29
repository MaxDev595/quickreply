import { useState } from 'react';
import { createRoot } from 'react-dom/client';

/** Controlled inputs: the DOM value only "sticks" if React's state is updated. */
function App() {
  const [text, setText] = useState('');
  const [area, setArea] = useState('');
  const [submitted, setSubmitted] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(text);
      }}
    >
      <input id="react-input" aria-label="React input" value={text} onChange={(e) => setText(e.target.value)} />
      <textarea id="react-textarea" aria-label="React textarea" value={area} onChange={(e) => setArea(e.target.value)} />
      <output id="react-state">{text}</output>
      <output id="react-area-state">{area}</output>
      <output id="react-submitted">{submitted}</output>
      <button type="submit">Submit</button>
    </form>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
