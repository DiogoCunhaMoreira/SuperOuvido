import React from 'react';
import './App.css';
import PianoDetector from './PianoDetector';
import LanguageToggle from './components/LanguageToggle';
import logo from './images/logo.png'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <LanguageToggle />
        <img src={logo} className='logo-image' alt="SuperOuvido" />
      </header>
      <main>
        <PianoDetector />
      </main>
    </div>
  );
}

export default App;
