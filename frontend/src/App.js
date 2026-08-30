import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/landing.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';

function app(){
  return (
    <AuthProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
    
  )
}

export default app;