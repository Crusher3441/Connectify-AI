export const waitForPresentedFrame = (video, timeoutMs = 3000) =>
  new Promise((resolve) => {
    if (typeof video.requestVideoFrameCallback === 'function') {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(false);
      }, timeoutMs);
      video.requestVideoFrameCallback(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(true);
      });
      return;
    }
    // No rVFC (Safari/Firefox): a short settle beat, then let the caller draw.
    setTimeout(() => resolve(false), 120);
  });

// Mean luminance 0–255. Sampled, not exhaustive — a getUserMedia canvas is
// never tainted, so reading pixels back is safe and cheap enough.
// Returns -1 when the pixels are unreadable ("unknown"), which is NOT "black".
const measureLuma = (ctx, width, height) => {
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    let sum = 0;
    let n = 0;
    const step = Math.max(4, Math.floor(data.length / 4 / 4000) * 4);
    for (let i = 0; i < data.length; i += step) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n += 1;
    }
    return n ? Math.round(sum / n) : 0;
  } catch {
    return -1;
  }
};


export const captureFrame = async (video, stream) => {
  if (!video) return null;
  const track = stream?.getVideoTracks?.()[0];
  const settings = track?.getSettings?.() || {};
  const width = video.videoWidth || settings.width || 0;
  const height = video.videoHeight || settings.height || 0;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(video, 0, 0);
  let luma = measureLuma(ctx, width, height);

  // The retry: wait for a genuinely presented frame, then draw again.
  if (luma >= 0 && luma < 8) {
    await waitForPresentedFrame(video);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0);
    luma = measureLuma(ctx, width, height);
  }

  return { canvas, ctx, width, height, luma };
};