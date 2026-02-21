export default function PlayVideoCard({ video }) {
  if (!video?.url) return null;
  return (
    <div className="play-video-card">
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="play-video-link"
      >
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="play-video-thumb"
          />
        )}
        <span className="play-video-title">{video.title || 'Watch video'}</span>
        <span className="play-video-hint">Opens in new tab →</span>
      </a>
    </div>
  );
}
