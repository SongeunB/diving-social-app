import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          {/* 추후 추가할 라우트들 */}
          {/* <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/logbook" element={<Logbook />} />
          <Route path="/community" element={<Community />} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
