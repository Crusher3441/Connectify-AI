export const notFound = (req, res, next) => {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
};

// Central place where every unhandled error becomes a clean JSON 500.
// Never leaks err.stack or the request body to the client (body may hold a
// password or a face descriptor — audit #2 hygiene).
export const errorHandler = (err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: err.expose ? err.message : 'Server error' });
};