import Meeting from '../models/meeting.model.js';

const CODE_RE = /^[a-z0-9]{4,12}$/;

export const recordMeeting = async ({ meetingCode, username }) => {
  const code = String(meetingCode || '').trim().toLowerCase();
  if (!CODE_RE.test(code)) throw Object.assign(new Error('Invalid meeting code'), { status: 400 });
  if (!username) throw Object.assign(new Error('username required'), { status: 400 });

  return Meeting.findOneAndUpdate(
    { meetingCode: code },
    {
      // Meeting-level facts: written once, at creation.
      $setOnInsert: { meetingCode: code, meetingOwner: username },
      // Per-visitor facts: refreshed on every join so "last seen" is honest.
      $set: { user_id: username, date: new Date() },
    },
    // `returnDocument: 'after'` replaces the deprecated `new: true` — identical
    // behaviour, and it silences mongoose's deprecation warning on every boot.
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};
