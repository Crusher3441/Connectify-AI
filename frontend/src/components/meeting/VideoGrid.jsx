import VideoTile from './VideoTile';
import styles from '../../styles/videoComponent.module.css';

export default function VideoGrid({ localStream, remoteStreams, myName, nameFor, metaFor, mySocketId, sharerId, localMatchState = 'none' }) {
  const remoteEntries = Object.entries(remoteStreams);

  return (
    <div
      className={styles.grid}
      style={{ '--tile-count': remoteEntries.length + 1 }}
    >
      <VideoTile
        stream={localStream}
        name={myName}
        isLocal
        isOwner={!!metaFor?.(mySocketId)?.isOwner}
        raised={metaFor?.(mySocketId)?.raisedHand}
        matchState={localMatchState}
      />
      {remoteEntries.map(([socketId, stream]) => (
        <VideoTile
          key={socketId}
          stream={stream}
          name={nameFor(socketId)}
          isOwner={!!metaFor?.(socketId)?.isOwner}
          raised={metaFor?.(socketId)?.raisedHand}
          pill={socketId === sharerId ? '🖥 Presenting' : undefined}
        />
      ))}
    </div>
  );
}