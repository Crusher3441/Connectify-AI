import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Tab, Tabs, TextField, Typography} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function AuthenticationPage() {
  const navigate = useNavigate();
  const { user, login, register } = useAuth();

  const [mode, setMode] = useState(0); // 0 = login · 1 = register
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [notice, setNotice] = useState(null); // post-registration info
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? redirect to home
  useEffect(() => {
    if (user) navigate('/home', { replace: true });
  }, [user, navigate]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Client checks MIRROR the server's rules for instant feedback
  // The server re-validates everything these can never be the gate
  const validate = () => {
    if (mode === 1 && form.name.trim().length < 2) return 'Name must be at least 2 characters';
    if (!USERNAME_RE.test(form.username.trim())) return 'Username: 3–20 letters, numbers or underscores';
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const problem = validate();
    if (problem) return setError(problem);

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 0) {
        await login({ username: form.username.trim(), password: form.password });
        navigate('/home');
      } else {
        await register({ name: form.name.trim(), username: form.username.trim(), password: form.password });
        // Explicit flow: account created then flip to Login with the username prefilled
        setMode(0);
        setNotice('Account created — log in to continue.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'var(--color-bg)', p: 2,
    }}>
      <Paper elevation={6} sx={{ width: '100%', maxWidth: 400, p: 3, bgcolor: 'var(--color-surface)' }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
          MeetSync <Box component="span" sx={{ color: 'var(--color-primary)' }}>AI</Box>
        </Typography>

        <Tabs value={mode} onChange={(_, v) => { setMode(v); setError(null); setNotice(null); }}>
          <Tab label="Login" />
          <Tab label="Register" />
        </Tabs>

        <Box component="form" onSubmit={submit} sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mode === 1 && (
            <TextField label="Name" value={form.name} onChange={set('name')} required />
          )}
          <TextField label="Username" value={form.username} onChange={set('username')} required />
          <TextField label="Password" type="password" value={form.password} onChange={set('password')} required />

          {error && <Alert severity="error">{error}</Alert>}
          {notice && <Alert severity="success">{notice}</Alert>}

          <Button type="submit" variant="contained" disabled={busy} sx={{ py: 1.2 }}>
            {busy ? <CircularProgress size={22} color="inherit" /> : mode === 0 ? 'Login' : 'Create account'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}