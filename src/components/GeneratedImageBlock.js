import { useState } from 'react';

export default function GeneratedImageBlock({ imageBase64, mimeType }) {
  const [enlarged, setEnlarged] = useState(false);
  const src = imageBase64
    ? `data:${mimeType || 'image/png'};base64,${imageBase64}`
    : null;
  if (!src) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `generated-image-${Date.now()}.png`;
    a.click();
  };

  const block = (
    <div className="generated-image-block">
      <img
        src={src}
        alt="Generated"
        className="generated-image-img"
        onClick={() => setEnlarged(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setEnlarged(true)}
      />
      <div className="generated-image-actions">
        <button type="button" onClick={() => setEnlarged(true)}>
          Enlarge
        </button>
        <button type="button" onClick={handleDownload}>
          Download
        </button>
      </div>
    </div>
  );

  if (enlarged) {
    return (
      <div
        className="chart-overlay"
        onClick={() => setEnlarged(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Escape' && setEnlarged(false)}
      >
        <div className="chart-overlay-inner" onClick={(e) => e.stopPropagation()}>
          <img src={src} alt="Generated (enlarged)" className="generated-image-enlarged" />
          <div className="generated-image-actions">
            <button type="button" onClick={handleDownload}>
              Download
            </button>
            <button type="button" onClick={() => setEnlarged(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
  return block;
}
