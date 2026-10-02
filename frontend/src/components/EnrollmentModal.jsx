import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { loadFaceModels, detectorOptions } from '../utils/faces/loadModels';
import { captureFrame } from '../utils/faces/frame';
import styles from '../styles/enrollment.module.css';

// Waits until the element has DECODED frames available.
// readyState 2 (HAVE_CURRENT_DATA) alone is not enough — videoWidth can still
// be 0, which would produce a 0x0 canvas and a silent "no face" result.
// (Being *decoded* is not the same as being *presented* — see frame.js.)
const waitForFrames = (video, timeoutMs = 8000) =>
  new Promise((resolve) => {
    const ready = () => video.readyState >= 2 && video.videoWidth > 0;
    if (ready()) return resolve(true);

    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onReady);
      clearTimeout(timer);
      resolve(ok);
    };
    const onReady = () => finish(ready());
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);
    const timer = setTimeout(() => finish(ready()), timeoutMs);
    video.play().catch(() => {}); // nudge playback in case it stalled
  });

// Props:
//   stream    — the shared local camera stream (owned by VideoMeet, Phase 3D)
//   onConfirm — async (descriptor: number[]) => boolean — parent emits + awaits ack
//   onSkip    — user declines; attendance simply won't include them
export default function EnrollmentModal({ stream, onConfirm, onSkip }) {
  const [phase, setPhase] = useState('loading'); // loading|ready|detecting|captured|submitting
  const [error, setError] = useState(null);
  const [score, setScore] = useState(null);
  // Diagnostics: keep the exact frame handed to face-api and show it back, so
  // "no face detected" stops being unactionable.
  const [frameUrl, setFrameUrl] = useState(null);
  const [frameLuma, setFrameLuma] = useState(null);
  const videoRef = useRef(null);
  const descriptorRef = useRef(null);

  useEffect(() => {
    let alive = true;
    loadFaceModels()
      .then(() => { if (alive) setPhase('ready'); })
      .catch((e) => { if (alive) setError('Model download failed — check your connection. ' + e.message); });
    return () => { alive = false; };
  }, []);

  // Attach the stream from an effect as well as the ref callback: if `stream`
  // resolves AFTER this component mounts, a mount-time-only ref callback has
  // already fired with null and never re-runs, leaving the preview blank.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream]);
const capture = async () => {
    setPhase('detecting');
    setError(null);

    const video = videoRef.current;
    if (!video) {
      setPhase('ready');
      return setError(
        stream
          ? 'Camera preview is not ready — close and reopen the enrollment modal.'
          : 'No camera stream — allow camera access and rejoin the meeting.'
      );
    }

    // BUGFIX: the original was a one-shot `video.readyState < 2` check that
    // failed instantly if no frame had decoded yet — but the button enables as
    // soon as the ~6MB model download resolves, which regularly lands first.
    if (!(await waitForFrames(video))) {
      setPhase('ready');
      return setError(
        'The camera is not producing video yet — check that another app is not ' +
        'using it, then try again.'
      );
    }

    // BUGFIX: captureFrame() owns the compositor race, the track-settings
    // dimension fallback and the black-frame retry. See utils/faces/frame.js.
    const frame = await captureFrame(video, stream);
    if (!frame) {
      setPhase('ready');
      return setError(
        'The camera returned a zero-sized frame. Close other apps that may be ' +
        'using it and rejoin.'
      );
    }

    const { canvas, luma } = frame;
    try {
      setFrameLuma(luma);
      setFrameUrl(canvas.toDataURL('image/jpeg', 0.6));
    } catch { /* diagnostics must never break capture */ }

    // A black frame produces "no face" from every detector, forever.
    if (luma >= 0 && luma < 8) {
      setPhase('ready');
      return setError(
        'The captured frame is completely black even though the preview above ' +
        'shows you. This browser would not hand the video frame to a canvas — ' +
        'try Chrome or Edge, or close other apps that may be holding the camera.'
      );
    }

   
    const detection = await faceapi
      .detectSingleFace(canvas, detectorOptions())
      ?.withFaceLandmarks()
      ?.withFaceDescriptor();

    if (!detection) {
      setPhase('ready');
      
      let best = 0;
      try {
        const probes = await faceapi.detectAllFaces(canvas, detectorOptions(0.01, 320));
        best = probes.reduce((m, r) => Math.max(m, r?.detection?.score || 0), 0);
      } catch { /* diagnostics must never break the flow */ }

      return setError(
        best > 0.05
          ? `Face found but only ${Math.round(best * 100)}% confident (needs 30%). ` +
            `Move closer to the camera, face the light, and remove anything ` +
            `covering your face.`
          : 'No face detected at all — check that your face is visible in the ' +
            'preview above, and that the room is lit from the front (not backlit ' +
            'by a window).'
      );
    }

    descriptorRef.current = Array.from(detection.descriptor); // Float32Array → plain array for the wire
    setScore(Math.round(detection.detection.score * 100));
    setPhase('captured');
  };

  const confirm = async () => {
    setPhase('submitting');
    const ok = await onConfirm(descriptorRef.current);
    if (ok) return;                       // parent unmounts the modal on success
    setPhase('captured');
    setError('Server rejected the enrollment — try capturing again.');
  };
return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2 className={styles.title}>Face enrollment</h2>
        <p className={styles.subtitle}>
          Your face is analyzed <strong>in your browser only</strong>. We send an
          anonymous 128-number signature — never an image — and only when you confirm.
        </p>

        <div className={styles.preview}>
          {stream && (
            <video
              className={styles.video}
              
              ref={(el) => {
                videoRef.current = el;                 // ← THE LINE THAT WAS MISSING
                if (el) { el.srcObject = stream; el.play().catch(() => {}); }
              }}
              autoPlay playsInline muted
            />
          )}
          {phase === 'detecting' && <div className={styles.scan}>Analyzing…</div>}
        </div>

        {phase === 'loading' && <p className={styles.note}>Downloading face models (~6MB, one time)…</p>}
        {error && <p className={styles.error}>{error}</p>}

        {/* Diagnostics: the exact frame the detector received. Without this,
            "no face detected" gives the user nothing to act on. */}
        {frameUrl && (
          <div className={styles.framePreview}>
            <p className={styles.note}>
              Frame handed to the detector
              {frameLuma !== null ? ` (brightness ${frameLuma}/255)` : ''}:
            </p>
            <img className={styles.frameImg} src={frameUrl} alt="captured frame" />
          </div>
        )}

        {phase === 'captured' && <p className={styles.note}>Face captured — detection confidence {score}%</p>}

        <div className={styles.actions}>
          {phase === 'captured' ? (
            <>
              <button className={styles.secondaryBtn} onClick={() => { setPhase('ready'); setScore(null); }}>
                Retake
              </button>
              <button className={styles.primaryBtn} onClick={confirm} disabled={phase === 'submitting'}>
                {phase === 'submitting' ? 'Saving…' : 'This is me — confirm'}
              </button>
            </>
          ) : (
            <button className={styles.primaryBtn} onClick={capture} disabled={phase !== 'ready'}>
              {phase === 'ready' ? 'Capture my face' : 'Working…'}
            </button>
          )}
          <button className={styles.linkBtn} onClick={onSkip}>Skip (I won't be tracked)</button>
        </div>
      </div>
    </div>
  );
}