import { useState } from 'react';
import './YouTubeChannelDownload.css';

const API = process.env.REACT_APP_API_URL || '';

export default function YouTubeChannelDownload() {
  const [url, setUrl] = useState('https://www.youtube.com/@veritasium');
  const [maxVideos, setMaxVideos] = useState(10);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleDownload = async () => {
    setError('');
    setResult(null);
    setProgress(0);
    setLoading(true);
    const max = Math.min(100, Math.max(1, parseInt(String(maxVideos), 10) || 10));
    try {
    const eventSource = new EventSource(
      `${API}/api/youtube/channel?url=${encodeURIComponent(url.trim())}&max=${max}`
    );
    let lastData = null;
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        lastData = data;
        if (data.error) {
          setError(data.error);
          eventSource.close();
          setLoading(false);
          return;
        }
        if (data.done && data.data) {
          setResult(data.data);
          setProgress(100);
          eventSource.close();
          setLoading(false);
          return;
        }
        if (typeof data.progress === 'number' && typeof data.total === 'number') {
          setProgress(Math.round((data.progress / data.total) * 100));
        }
      } catch (err) {
        setError(err.message || 'Parse error');
        eventSource.close();
        setLoading(false);
      }
    };
    eventSource.onerror = () => {
      if (lastData?.error) setError(lastData.error);
      else setError('Connection error or server closed. If you did not set YOUTUBE_API_KEY in .env, add it to use this tab — or drag a channel JSON file into Chat instead.');
      eventSource.close();
      setLoading(false);
    };
    } catch (err) {
      setError(err.message || 'Failed to start download');
      setLoading(false);
    }
  };

  const handleDownloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `youtube-channel-${(result.channelTitle || 'channel').replace(/\W+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="youtube-download-page">
      <div className="youtube-download-card">
        <h2>YouTube Channel Download</h2>
        <p className="youtube-download-desc">
          Enter a YouTube channel URL to download video metadata (title, description, duration, views, likes, comments, URL). Requires <code>YOUTUBE_API_KEY</code> in .env. Without it, you can still use the Chat tab: drag a channel JSON file (e.g. <code>veritasium_10_videos.json</code> from the app’s public folder) into the chat to analyze it.
        </p>
        <div className="youtube-download-form">
          <label>
            Channel URL
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/@channel"
              disabled={loading}
            />
          </label>
          <label>
            Max videos (1–100)
            <input
              type="number"
              min={1}
              max={100}
              value={maxVideos}
              onChange={(e) => setMaxVideos(e.target.value)}
              disabled={loading}
            />
          </label>
          <button
            type="button"
            className="youtube-download-btn"
            onClick={handleDownload}
            disabled={loading}
          >
            Download Channel Data
          </button>
        </div>
        {loading && (
          <div className="youtube-progress-wrap">
            <div className="youtube-progress-bar">
              <div className="youtube-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="youtube-progress-text">{progress}%</span>
          </div>
        )}
        {error && <p className="youtube-download-error">{error}</p>}
        {result && (
          <div className="youtube-result">
            <p className="youtube-result-summary">
              Downloaded <strong>{result.videoCount}</strong> videos from <strong>{result.channelTitle}</strong>.
            </p>
            <button type="button" className="youtube-download-json-btn" onClick={handleDownloadJson}>
              Download JSON file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
