import Meeting from '../models/meeting.model.js';

const CODE_RE = /^[a-z0-9]{4,12}$/;

export const recordMeeting = async ({ meetingCode, username }) => {
  const code = String(meetingCode || '').trim().toLowerCase();
  if (!CODE_RE.test(code)) throw Object.assign(new Error('Invalid meeting code'), { status: 400 });
  if (!username) throw Object.assign(new Error('username required'), { status: 400 });

  // Upsert: re-joining the same meeting must NOT create a second row.
  return Meeting.findOneAndUpdate(
    { meetingCode: code },
    {
      user_id: username,
      meetingCode: code,
      meetingOwner: username, // first recorder is the designated host 
      date: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};
