import React from 'react';
import './App.css';
import PianoDetector from './PianoDetector';
import logo from './images/logo.png'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className='logo-image'></img>
      </header>
      <main>
        <PianoDetector />
      </main>
    </div>
  );
}

export default App;