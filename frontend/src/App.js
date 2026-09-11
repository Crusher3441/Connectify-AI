import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/landing.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import  AuthenticationPage  from './pages/authentication.jsx';

function app(){
  return (
    <AuthProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path='/auth' element={<AuthenticationPage/>}/>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
    
  )
}

export default app;