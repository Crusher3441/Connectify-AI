import VideoTile from './VideoTile';
import styles from '../../styles/videoComponent.module.css';

export default function VideoGrid({ localStream, remoteStreams, myName, nameFor, metaFor, mySocketId, sharerId }) {
  const remoteEntries = Object.entries(remoteStreams);

  return (
    <div
      className={styles.grid}
      style={{ '--tile-count': remoteEntries.length + 1 }}
    >
      <VideoTile stream={localStream} name={myName} isLocal raised={metaFor?.(mySocketId)?.raisedHand}
      />
      {remoteEntries.map(([socketId, stream]) => (
        <VideoTile key={socketId} stream={stream} name={nameFor(socketId)} raised={metaFor?.(socketId)?.raisedHand} pill={socketId === sharerId ? '🖥 Presenting' : undefined}
        />
      ))}
    </div>
  );
}
