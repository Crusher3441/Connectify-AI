import Attendance from '../models/attendance.model.js';
import Transcript from '../models/transcript.model.js';

// Generalizes the Phase 5K rule: you may access a meeting's artifacts if you
// hosted it OR were tracked as a participant in it. One function, used by
// every report route — no per-route authorization drift.
export const canAccessMeeting = async (username, meetingCode) => {
  const attendance = await Attendance.findOne({
    meetingCode,
    $or: [
      { meetingOwner: username },
      { 'participants.username': username },
    ],
  }).select('_id').lean();
  if (attendance) return true;

  const transcript = await Transcript.findOne({
    meetingCode,
    $or: [
      { owner: username },
      { 'entries.username': username },
    ],
  }).select('_id').lean();
  return !!transcript;
};

// Every meeting code the user may see — the input for $in queries.
export const accessibleMeetingCodes = async (username) => {
  const [fromAttendance, fromTranscript] = await Promise.all([
    Attendance.find({
      $or: [
        { meetingOwner: username },
        { 'participants.username': username },
      ],
    }).distinct('meetingCode'),
    Transcript.find({
      $or: [{ owner: username }, { 'entries.username': username }],
    }).distinct('meetingCode'),
  ]);
  return [...new Set([...fromAttendance, ...fromTranscript])];
};