import React from 'react';
import './App.css';
import PianoDetector from './PianoDetector';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Piano Chord Detector</h1>
      </header>
      <main>
        <PianoDetector />
      </main>
    </div>
  );
}

export default App;