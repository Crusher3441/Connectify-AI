import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/landing.jsx';

function app(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  )
}

export default app;