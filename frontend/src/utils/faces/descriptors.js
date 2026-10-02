// A descriptor is a 128-number "fingerprint" of a face. Same person →
// small euclidean distance; different person → large. 0.6 is the
// industry-typical acceptance threshold for face-api descriptors.
export const MATCH_THRESHOLD = 0.6;

export const euclideanDistance = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};
