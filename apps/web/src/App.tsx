import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Setup } from './screens/Setup.jsx';
import { Lobby } from './screens/Lobby.jsx';
import { Play } from './screens/Play.jsx';
import { Results } from './screens/Results.jsx';

export function App() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        justifyContent: 'center',
        background: '#c8c0b0',
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/lobby/:roomCode" element={<Lobby />} />
          <Route path="/play/:gameId" element={<Play />} />
          <Route path="/results/:gameId" element={<Results />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
