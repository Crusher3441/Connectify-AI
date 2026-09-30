import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

export const withAuth = (WrappedComponent) => {
  function WithAuth(props) {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
      if (!localStorage.getItem('token')) {
        navigate('/auth', { replace: true });
      } else {
        setChecking(false);
      }
    }, [navigate]);

    if (checking) {
      return (
        <Box sx={{
          minHeight: '100vh', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <CircularProgress />
        </Box>
      );
    }
    return <WrappedComponent {...props} />;
  }
  return WithAuth;
};
