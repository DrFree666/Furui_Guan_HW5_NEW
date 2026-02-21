import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function MetricVsTimeChart({ data, metricField }) {
  const [enlarged, setEnlarged] = useState(false);
  const chartData = (data || []).map((d) => ({
    ...d,
    dateLabel: d.date ? new Date(d.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' }) : '',
  }));

  const handleDownload = () => {
    const container = document.querySelector('.metric-vs-time-chart');
    const svg = container?.querySelector('svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metric_vs_time_${metricField || 'chart'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const content = (
    <div className={`metric-vs-time-chart ${enlarged ? 'enlarged' : ''}`}>
      <p className="metric-vs-time-label">
        {metricField || 'Metric'} vs time
      </p>
      <ResponsiveContainer width="100%" height={enlarged ? 400 : 260}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v)}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(15,15,35,0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#e2e8f0',
            }}
            formatter={(value) => [value?.toLocaleString(), metricField]}
            labelFormatter={(label) => label}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#818cf8"
            strokeWidth={2}
            dot={{ fill: '#818cf8', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="metric-vs-time-actions">
        <button type="button" className="chart-enlarge-btn" onClick={() => setEnlarged((e) => !e)}>
          {enlarged ? 'Shrink' : 'Enlarge'}
        </button>
        <button type="button" className="chart-download-btn" onClick={handleDownload}>
          Download
        </button>
      </div>
    </div>
  );

  if (enlarged) {
    return (
      <div className="chart-overlay" onClick={() => setEnlarged(false)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Escape' && setEnlarged(false)}>
        <div className="chart-overlay-inner" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }
  return content;
}
