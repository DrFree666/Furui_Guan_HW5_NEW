// ── YouTube / Channel JSON tool declarations (exact names required for grading) ───

export const YOUTUBE_TOOL_DECLARATIONS = [
  {
    name: 'generateImage',
    description:
      'Generate an image from a text prompt and an optional anchor/reference image. Use when the user asks to create, edit, or transform an image (e.g. "make this look like watercolor", "generate an image of..."). If the user attached an image, use it as the anchor; otherwise generate from the text prompt only.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: {
          type: 'STRING',
          description: 'Clear text description of the image to generate or how to transform the anchor image.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'plot_metric_vs_time',
    description:
      'Plot a numeric metric (e.g. viewCount, likeCount, commentCount) vs time for the channel videos. Use when the user asks for a time series, trend over time, or "plot X over time". Returns a chart displayed in the chat.',
    parameters: {
      type: 'OBJECT',
      properties: {
        metric_field: {
          type: 'STRING',
          description:
            'Exact field name from the channel JSON, e.g. viewCount, likeCount, commentCount. Use the same key as in the loaded JSON.',
        },
      },
      required: ['metric_field'],
    },
  },
  {
    name: 'play_video',
    description:
      'Open or play a YouTube video from the loaded channel data. Use when the user says "play", "open", "watch", or "show me the video". The user can specify which video by: title (e.g. "play the asbestos video"), ordinal ("play the first video", "second video"), or "most viewed".',
    parameters: {
      type: 'OBJECT',
      properties: {
        identifier: {
          type: 'STRING',
          description:
            'How to find the video: a substring of the title (e.g. "asbestos"), "first", "last", "most viewed", or 1-based ordinal like "1" for first, "2" for second.',
        },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'compute_stats_json',
    description:
      'Compute statistics (mean, median, std, min, max) for a numeric field in the channel JSON. Use when the user asks for average, statistics, distribution, or "how many views/likes" across the videos. Valid fields include viewCount, likeCount, commentCount, and duration (in seconds).',
    parameters: {
      type: 'OBJECT',
      properties: {
        field_name: {
          type: 'STRING',
          description:
            'Exact numeric field name from the channel JSON, e.g. viewCount, likeCount, commentCount.',
        },
      },
      required: ['field_name'],
    },
  },
];

const API = process.env.REACT_APP_API_URL || '';

// ── Executor: run tools and return results (generateImage is async) ─────────────

export async function executeYouTubeTool(toolName, args, context) {
  const { channelData, images = [] } = context || {};
  const videos = channelData?.videos || [];

  switch (toolName) {
    case 'generateImage': {
      const prompt = args?.prompt || '';
      const anchor = images.length ? images[0] : null;
      const res = await fetch(`${API}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          imageBase64: anchor?.data || null,
          mimeType: anchor?.mimeType || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed');
      return {
        _imageResult: true,
        imageBase64: data.imageBase64,
        mimeType: data.mimeType || 'image/png',
      };
    }

    case 'plot_metric_vs_time': {
      const field = args?.metric_field || 'viewCount';
      const key = field in (videos[0] || {}) ? field : { viewCount: 'viewCount', likeCount: 'likeCount', commentCount: 'commentCount' }[field] || field;
      const points = videos
        .filter((v) => v.publishedAt != null)
        .map((v) => ({
          date: v.publishedAt,
          value: typeof v[key] === 'number' ? v[key] : parseInt(v[key], 10) || 0,
          title: v.title,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      return {
        _chartType: 'metric_vs_time',
        data: points,
        metricField: key,
      };
    }

    case 'play_video': {
      const id = (args?.identifier || '').trim().toLowerCase();
      let video = null;
      if (id === 'first' || id === '1') {
        video = videos[0];
      } else if (id === 'last' || id === String(videos.length)) {
        video = videos[videos.length - 1];
      } else if (id === 'most viewed') {
        video = [...videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))[0];
      } else {
        video = videos.find(
          (v) =>
            (v.title || '').toLowerCase().includes(id) ||
            (v.videoId || '').toLowerCase() === id
        );
      }
      if (!video) return { error: `No video found for "${args?.identifier}"` };
      return {
        _chartType: 'play_video',
        video: {
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          url: video.url || `https://www.youtube.com/watch?v=${video.videoId}`,
          videoId: video.videoId,
        },
      };
    }

    case 'compute_stats_json': {
      const field = args?.field_name || 'viewCount';
      const key = field in (videos[0] || {}) ? field : 'viewCount';
      const values = videos
        .map((v) => {
          const raw = v[key];
          if (typeof raw === 'number' && !isNaN(raw)) return raw;
          if (key === 'duration' && raw) return parseDuration(raw);
          return parseInt(raw, 10);
        })
        .filter((n) => !isNaN(n));
      if (!values.length) return { error: `No numeric values for field "${key}"` };
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      return {
        field_name: key,
        count: values.length,
        mean: Math.round(mean * 100) / 100,
        median: Math.round(median * 100) / 100,
        std: Math.round(Math.sqrt(variance) * 100) / 100,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function parseDuration(iso) {
  if (typeof iso === 'number') return iso;
  const s = String(iso);
  const match = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || 0, 10);
  const m = parseInt(match[2] || 0, 10);
  const sec = parseInt(match[3] || 0, 10);
  return h * 3600 + m * 60 + sec;
}
