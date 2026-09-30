import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/landing.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import  AuthenticationPage  from './pages/authentication.jsx';
import HomePage from './pages/home.jsx';
import { withAuth } from './utils/withAuth.jsx';

const ProtectedHome = withAuth(HomePage);

function app(){
  return (
    <AuthProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path='/auth' element={<AuthenticationPage/>}/>
        <Route path='/home' element={<ProtectedHome/>}/>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
    
  )
}

export default app;