import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import { loadFaceModels, detectorOptions } from "../utils/faces/loadModels";
import { captureFrame } from "../utils/faces/frame";
import { euclideanDistance, MATCH_THRESHOLD } from "../utils/faces/descriptors";

// `streamRef` is the live MediaStream from useMediaStream — needed so
// captureFrame() can fall back to the TRACK's settings when the hidden <video>
// element momentarily reports 0×0.
export const useFaceAttendance = ({
  socketRef,
  enrolledDescriptor,
  videoRef,
  videoReady,
  streamRef,
}) => {
  // 'none' (not enrolled) | 'verified' | 'unverified'
  const [matchState, setMatchState] = useState("none");
  const tickRunningRef = useRef(false); // guards overlapping async ticks

  useEffect(() => {
    console.log("[attendance effect]", {
      enrolled: !!enrolledDescriptor,
      videoReady,
      videoExists: !!videoRef.current,
    });

    if (!enrolledDescriptor || !videoReady || !videoRef.current) return;
    let intervalId = null;
    let cancelled = false;

    const tick = async () => {
      if (tickRunningRef.current || cancelled) return;
      tickRunningRef.current = true;
      try {
        const video = videoRef.current;
        // temporary
        console.log("[attendance]", {
          enrolled: !!enrolledDescriptor,
          video: !!video,
          readyState: video?.readyState,
          width: video?.videoWidth,
          height: video?.videoHeight,
          stream: !!streamRef?.current,
        });

        const frame = video
          ? await captureFrame(video, streamRef?.current)
          : null;
        if (frame && frame.luma >= 8) {
          const canvas = frame.canvas;

          const detection = await faceapi
            .detectSingleFace(canvas, detectorOptions())
            ?.withFaceLandmarks()
            ?.withFaceDescriptor();

          const verified =
            !!detection &&
            euclideanDistance(detection.descriptor, enrolledDescriptor) <=
              MATCH_THRESHOLD;

          console.log("[attendance detection]", {
            found: !!detection,
            distance: detection
              ? euclideanDistance(detection.descriptor, enrolledDescriptor)
              : null,
            threshold: MATCH_THRESHOLD,
            verified,
          });

          if (!cancelled) {
            setMatchState(verified ? "verified" : "unverified");
            socketRef.current?.emit("verified-update", { verified });
          }
        }
      } catch (err) {
        console.warn("[attendance] tick failed:", err.message);
      } finally {
        tickRunningRef.current = false;
      }
    };

    loadFaceModels().then(() => {
      if (cancelled) return;
      tick(); // first check immediately
      intervalId = setInterval(tick, 10000); // then every 10s — matches the server cooldown
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [enrolledDescriptor, videoReady, socketRef, videoRef, streamRef]);

  return { matchState };
};
