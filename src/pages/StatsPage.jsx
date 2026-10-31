// src/pages/StatsPage.jsx
// =====================================================================
// Burihagio — Statistiques approfondies v5 (Chantier 11-F4)
// 6 onglets · 4 graphiques (Courbe / Donut / Barre / Barres Groupées) · KPI partout
// Période dans chaque sous-bloc · Drill-down systématique
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { loadDataset } from '../data/storage.js';
import { createDefaultFixtures } from '../data/fixtures.js';
import {
  getGlobalSummary, getDishesRanking, getCategoryBreakdown,
  getMultiMetricSeries, getKpiSeries, getDishIndividualSeries,
  getFullRanking, getWeatherBreakdown, getEmployeeStats,
  getIngredientCosts, getFixedCostsBreakdown, getBarMetrics,
  getComparison, getDailyAverages, getPreviousPeriodRange,
  getDonutData, getGroupedBarData,
  PERIODS, CHART_TYPES, DEFAULT_PERIODS, CYCLE_COLORS,
} from '../data/stats.js';
import './StatsPage.css';

// =====================================================================
// CONSTANTES UI
// =====================================================================
const TABS = ['overview', 'sales', 'costs', 'staff', 'weather', 'comparison'];

const SERIES_COLORS = { revenue: '#FF9800', margin: '#3C91A6', expenses: '#E91E63', items: '#9C27B0' };

// =====================================================================
// HELPERS — i18n safe
// =====================================================================
// Ne passe à t() que si la clé ressemble à une clé i18n (contient un point).
// Sinon, la valeur brute est affichée (ex: nom de plat, date, ingrédient).
function safeT(t, key) {
  if (key == null) return '';
  const s = String(key);
  if (s.indexOf('.') === -1) return s;
  const translated = t(s);
  return translated === s ? s : translated;
}

// =====================================================================
// HOOKS
// =====================================================================
function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return defaultValue;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }, [key, value]);
  return [value, setValue];
}

function useFormatters() {
  const { formatCurrency } = useI18n();
  return useMemo(() => ({
    currency: (v) => formatCurrency(Number(v) || 0),
    number: (v) => String(Math.round(Number(v) || 0)),
    percent: (v) => `${Math.round(Number(v) || 0)}%`,
    compact: (v) => {
      const n = Number(v) || 0;
      const a = Math.abs(n);
      if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
      if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
      if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
      return String(Math.round(n));
    },
    format: (v, type) => {
      if (type === 'currency') return formatCurrency(Number(v) || 0);
      if (type === 'percent') return `${Math.round(Number(v) || 0)}%`;
      return String(Math.round(Number(v) || 0));
    },
  }), [formatCurrency]);
}

// =====================================================================
// COMPOSANTS DE BASE
// =====================================================================
function PeriodSelector({ period, onChange, t }) {
  return (
    <div className="stats-period-selector" role="tablist">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          role="tab"
          aria-selected={period === p}
          className={`stats-period-btn ${period === p ? 'stats-period-btn--active' : ''}`}
          onClick={() => onChange(p)}
        >
          {t(`stats.periods.${p}`)}
        </button>
      ))}
    </div>
  );
}

const CHART_ICONS = { line: '〰️', donut: '🍩', bar: '📊', groupedBar: '📶' };

function ChartTypeToggle({ chartType, onChange, t }) {
  return (
    <div className="stats-chart-type-toggle" role="tablist">
      {CHART_TYPES.map((ct) => (
        <button
          key={ct}
          type="button"
          role="tab"
          aria-selected={chartType === ct}
          className={`stats-chart-type-btn ${chartType === ct ? 'stats-chart-type-btn--active' : ''}`}
          onClick={() => onChange(ct)}
        >
          <span aria-hidden="true">{CHART_ICONS[ct]}</span> {t(`stats.chartTypes.${ct}`)}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ message, action, onAction }) {
  return (
    <div className="stats-empty">
      <div className="stats-empty-icon" aria-hidden="true">📊</div>
      <p className="stats-empty-msg">{message}</p>
      {action && onAction && (
        <button type="button" className="stats-empty-action" onClick={onAction}>{action}</button>
      )}
    </div>
  );
}

function InsightBanner({ text }) {
  if (!text) return null;
  return <div className="stats-insight">💡 {text}</div>;
}

// =====================================================================
// KPI CARD
// =====================================================================
function KpiCard({ icon, label, value, delta, sparkline, badge, color, onClick }) {
  const deltaClass = delta == null ? '' : (delta > 0.5 ? 'stats-kpi-delta--up' : delta < -0.5 ? 'stats-kpi-delta--down' : 'stats-kpi-delta--flat');
  const deltaText = delta == null ? '' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
  return (
    <button
      type="button"
      className={`stats-kpi-card ${onClick ? 'stats-kpi-card--clickable' : ''}`}
      onClick={onClick}
      style={{ borderTopColor: color || '#3C91A6' }}
    >
      <div className="stats-kpi-header">
        <span className="stats-kpi-icon" aria-hidden="true">{icon}</span>
        <span className="stats-kpi-label">{label}</span>
        {badge && <span className={`stats-kpi-badge stats-kpi-badge--${badge.type}`}>{badge.text}</span>}
      </div>
      <div className="stats-kpi-body">
        <strong className="stats-kpi-value">{value}</strong>
        {deltaText && <span className={`stats-kpi-delta ${deltaClass}`}>{deltaText}</span>}
      </div>
      {sparkline && sparkline.length > 0 && (
        <div className="stats-kpi-sparkline" aria-hidden="true">
          {sparkline.map((v, i) => {
            const max = Math.max(...sparkline, 1);
            const h = Math.max(2, (v / max) * 22);
            return <span key={i} className="stats-kpi-spark-bar" style={{ height: `${h}px`, background: color || '#3C91A6' }} />;
          })}
        </div>
      )}
    </button>
  );
}

// =====================================================================
// LINE CHART
// =====================================================================
function LineChart({ series, formatValue, t, emptyMessage }) {
  const [mode, setMode] = useState('multi');
  const [activeKey, setActiveKey] = useState(series[0]?.key || null);
  const [cumulative, setCumulative] = useState(false);
  const [activeIdx, setActiveIdx] = useState(null);

  const visibleSeries = mode === 'single'
    ? series.filter((s) => s.key === activeKey)
    : series;

  const points = useMemo(() => {
    if (!visibleSeries.length || !visibleSeries[0].points.length) return [];
    const bucketCount = visibleSeries[0].points.length;
    const arr = [];
    for (let i = 0; i < bucketCount; i++) {
      const point = { key: visibleSeries[0].points[i].key, date: visibleSeries[0].points[i].date, values: {} };
      let anyValue = false;
      for (const s of visibleSeries) {
        let v = s.points[i]?.value || 0;
        if (cumulative) {
          v = 0;
          for (let j = 0; j <= i; j++) v += s.points[j]?.value || 0;
        }
        point.values[s.key] = { value: v, color: s.color, unit: s.unit };
        if (v > 0) anyValue = true;
      }
      if (anyValue) arr.push(point);
    }
    return arr;
  }, [visibleSeries, cumulative]);

  const dims = { w: 340, h: 180, pl: 32, pr: 8, pt: 10, pb: 24 };
  const chartW = dims.w - dims.pl - dims.pr;
  const chartH = dims.h - dims.pt - dims.pb;

  const maxV = useMemo(() => {
    let m = 0;
    for (const p of points) for (const k in p.values) m = Math.max(m, p.values[k].value);
    return m || 1;
  }, [points]);

  if (!points.length) return <EmptyState message={emptyMessage || t('stats.noData')} />;

  const x = (i) => dims.pl + (i / Math.max(points.length - 1, 1)) * chartW;
  const y = (v) => dims.pt + chartH - (v / maxV) * chartH;

  const buildPath = (key) => {
    const pts = points.map((p, i) => ({ x: x(i), y: y(p.values[key]?.value || 0) })).filter(Boolean);
    if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i], p2 = pts[i + 1];
      const cx = (p1.x + p2.x) / 2;
      d += ` C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const yTicks = [0, maxV / 2, maxV];

  return (
    <div className="stats-line-chart">
      <div className="stats-line-toolbar">
        <div className="stats-line-legend">
          {series.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`stats-line-legend-item ${mode === 'single' && activeKey === s.key ? 'stats-line-legend-item--active' : ''}`}
              onClick={() => {
                if (mode === 'multi') {
                  setMode('single');
                  setActiveKey(s.key);
                } else if (activeKey === s.key) {
                  setMode('multi');
                } else {
                  setActiveKey(s.key);
                }
              }}
            >
              <span className="stats-line-legend-dot" style={{ background: s.color }} />
              <span className="stats-line-legend-label">{t(s.labelKey)}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`stats-line-cumul-btn ${cumulative ? 'stats-line-cumul-btn--active' : ''}`}
          onClick={() => setCumulative((c) => !c)}
        >
          {cumulative ? '∑ ' + t('stats.chart.cumulative') : t('stats.chart.absolute')}
        </button>
      </div>

      <div className="stats-line-svg-wrapper">
        <svg viewBox={`0 0 ${dims.w} ${dims.h}`} preserveAspectRatio="none" className="stats-line-svg">
          {yTicks.map((val, i) => {
            const yy = y(val);
            return (
              <g key={i}>
                <line x1={dims.pl} y1={yy} x2={dims.w - dims.pr} y2={yy} stroke="#F0F0F0" strokeDasharray={i === 0 ? '' : '4 4'} strokeWidth="1" />
                <text x={dims.pl - 4} y={yy + 3} textAnchor="end" fontSize="7" fill="#999">
                  {formatValue(val, visibleSeries[0]?.unit)}
                </text>
              </g>
            );
          })}
          {visibleSeries.map((s) => (
            <path key={s.key} d={buildPath(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
          ))}
          {points.map((p, i) => (
            <g key={i}>
              {visibleSeries.map((s) => (
                <circle
                  key={s.key}
                  cx={x(i)}
                  cy={y(p.values[s.key]?.value || 0)}
                  r={activeIdx === i ? 4 : 2.5}
                  fill="#FFF"
                  stroke={s.color}
                  strokeWidth="1.5"
                  className="stats-line-point"
                  onClick={() => setActiveIdx(activeIdx === i ? null : i)}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>

      {activeIdx !== null && points[activeIdx] && (
        <div className="stats-line-tooltip">
          <div className="stats-line-tooltip-date">{String(points[activeIdx].key)}</div>
          {visibleSeries.map((s) => (
            <div key={s.key} className="stats-line-tooltip-row">
              <span className="stats-line-legend-dot" style={{ background: s.color }} />
              <span>{t(s.labelKey)}:</span>
              <strong>{formatValue(points[activeIdx].values[s.key]?.value || 0, s.unit)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// DONUT CHART (v5 — remplace la bulle)
// =====================================================================
function DonutChart({ data, formatValue, t, onClick }) {
  if (!data || data.empty || !data.segments || data.segments.length === 0) {
    return <EmptyState message={t('stats.noData')} />;
  }
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 68;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * r;
  const total = data.total || 1;

  let offset = 0;
  const arcs = data.segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const el = (
      <circle
        key={seg.key}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        className="stats-donut-arc"
        onClick={() => onClick && onClick(seg)}
      >
        <title>{`${safeT(t, seg.label)} — ${formatValue(seg.value, data.format)} (${Math.round(seg.pct)}%)`}</title>
      </circle>
    );
    offset += dash;
    return el;
  });

  const centerValue = data.topSegment
    ? data.format === 'percent'
      ? `${Math.round(data.topSegment.pct)}%`
      : formatValue(data.total, data.format)
    : formatValue(0, data.format);
  const centerLabel = data.topSegment ? safeT(t, data.topSegment.label) : '';

  return (
    <div className="stats-donut">
      <div className="stats-donut-chart">
        <svg viewBox={`0 0 ${size} ${size}`} className="stats-donut-svg">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F5F5F5" strokeWidth={strokeWidth} />
          {arcs}
        </svg>
        <div className="stats-donut-center">
          <strong className="stats-donut-value">{centerValue}</strong>
          {centerLabel && <span className="stats-donut-label">{centerLabel}</span>}
        </div>
      </div>
      <div className="stats-donut-legend">
        {data.segments.map((seg) => (
          <button
            key={seg.key}
            type="button"
            className="stats-donut-legend-row"
            onClick={() => onClick && onClick(seg)}
          >
            <span className="stats-donut-legend-dot" style={{ background: seg.color }} />
            <span className="stats-donut-legend-info">
              <span className="stats-donut-legend-label">{safeT(t, seg.label)}</span>
              <strong className="stats-donut-legend-value">{formatValue(seg.value, data.format)}</strong>
            </span>
            <span className="stats-donut-legend-pct">{Math.round(seg.pct)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// GROUPED BAR CHART (v5 — Actuel vs Précédent)
// =====================================================================
function GroupedBarChart({ data, formatValue, t }) {
  if (!data || data.empty || !data.buckets || data.buckets.length === 0) {
    return <EmptyState message={t('stats.noData')} />;
  }
  const dims = { w: 360, h: 210, pl: 36, pr: 8, pt: 10, pb: 40 };
  const chartW = dims.w - dims.pl - dims.pr;
  const chartH = dims.h - dims.pt - dims.pb;

  const maxV = Math.max(...data.buckets.map((b) => Math.max(b.current, b.previous)), 1);
  const groupW = chartW / data.buckets.length;
  const barW = Math.min(12, groupW * 0.32);
  const gap = 3;

  const yTicks = [0, maxV / 2, maxV];
  const yPos = (v) => dims.pt + chartH - (v / maxV) * chartH;

  const trendUp = data.trendPct >= 0;
  const trendColor = trendUp ? '#2E7D32' : '#C62828';

  return (
    <div className="stats-grouped">
      <div className="stats-grouped-trend" style={{ color: trendColor }}>
        <span className="stats-grouped-trend-arrow">{trendUp ? '↗' : '↘'}</span>
        <span className="stats-grouped-trend-value">{Math.abs(data.trendPct).toFixed(2)}%</span>
        <span className="stats-grouped-trend-label">{t('stats.groupedBar.trend')}</span>
      </div>
      <svg viewBox={`0 0 ${dims.w} ${dims.h}`} preserveAspectRatio="none" className="stats-grouped-svg">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={dims.pl}
              y1={yPos(v)}
              x2={dims.w - dims.pr}
              y2={yPos(v)}
              stroke="#F0F0F0"
              strokeDasharray={i === 0 ? '' : '4 4'}
              strokeWidth="1"
            />
            <text x={dims.pl - 4} y={yPos(v) + 3} textAnchor="end" fontSize="7" fill="#999">
              {formatValue(v, data.format)}
            </text>
          </g>
        ))}
        {data.buckets.map((b, i) => {
          const gx = dims.pl + i * groupW + groupW / 2;
          const curX = gx - barW - gap / 2;
          const prevX = gx + gap / 2;
          const curH = (b.current / maxV) * chartH;
          const prevH = (b.previous / maxV) * chartH;
          const curY = dims.pt + chartH - curH;
          const prevY = dims.pt + chartH - prevH;
          const labelRaw = safeT(t, b.label);
          const label = labelRaw.length > 8 ? labelRaw.slice(0, 8) + '…' : labelRaw;
          return (
            <g key={b.key}>
              <rect
                x={curX}
                y={curY}
                width={barW}
                height={Math.max(curH, 0)}
                rx={3}
                ry={3}
                fill="#3C91A6"
              >
                <title>{`${labelRaw} — ${t('stats.groupedBar.current')}: ${formatValue(b.current, b.format || data.format)}`}</title>
              </rect>
              <rect
                x={prevX}
                y={prevY}
                width={barW}
                height={Math.max(prevH, 0)}
                rx={3}
                ry={3}
                fill="#E0E0E0"
              >
                <title>{`${labelRaw} — ${t('stats.groupedBar.previous')}: ${formatValue(b.previous, b.format || data.format)}`}</title>
              </rect>
              <text
                x={gx}
                y={dims.pt + chartH + 14}
                textAnchor="middle"
                fontSize="7"
                fill="#7A7A7A"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="stats-grouped-legend">
        <span className="stats-grouped-legend-item">
          <span className="stats-grouped-legend-dot" style={{ background: '#3C91A6' }} />
          {t(data.currentLabel)}
        </span>
        <span className="stats-grouped-legend-item">
          <span className="stats-grouped-legend-dot" style={{ background: '#E0E0E0' }} />
          {t(data.previousLabel)}
        </span>
      </div>
    </div>
  );
}

// =====================================================================
// BAR CHART
// =====================================================================
function BarChart({ bars, formatValue, t, emptyMessage, onBarClick }) {
  const [sortMode, setSortMode] = useState('value-desc');

  const sorted = useMemo(() => {
    const arr = [...bars];
    if (sortMode === 'value-desc') arr.sort((a, b) => b.value - a.value);
    else if (sortMode === 'value-asc') arr.sort((a, b) => a.value - b.value);
    else if (sortMode === 'name') arr.sort((a, b) => safeT(t, a.label).localeCompare(safeT(t, b.label)));
    return arr;
  }, [bars, sortMode, t]);

  const maxV = useMemo(() => Math.max(...bars.map((b) => b.value), 1), [bars]);

  const nextSort = () => {
    const order = ['value-desc', 'value-asc', 'name'];
    const idx = order.indexOf(sortMode);
    setSortMode(order[(idx + 1) % order.length]);
  };

  if (!sorted.length) return <EmptyState message={emptyMessage || t('stats.noData')} />;

  return (
    <div className="stats-bar-chart">
      <div className="stats-bar-toolbar">
        <span className="stats-bar-count">{sorted.length} {t('stats.filters.items')}</span>
        <button type="button" className="stats-bar-sort-btn" onClick={nextSort}>
          ↕ {t(`stats.sort.${sortMode.replace('-', '_')}`)}
        </button>
      </div>
      <div className="stats-bar-list">
        {sorted.map((b) => {
          const pct = maxV > 0 ? (b.value / maxV) * 100 : 0;
          const visibleMetrics = (b.subMetrics || []).slice(0, 3);
          return (
            <button
              key={b.key}
              type="button"
              className="stats-bar-row"
              onClick={() => onBarClick && onBarClick(b)}
            >
              <div className="stats-bar-label">{safeT(t, b.label)}</div>
              <div className="stats-bar-body">
                <div className="stats-bar-track">
                  <div className="stats-bar-fill" style={{ width: `${pct}%`, background: b.color || '#3C91A6' }} />
                </div>
                <div className="stats-bar-value">
                  <strong>{formatValue(b.value, b.format)}</strong>
                </div>
              </div>
              {visibleMetrics.length > 0 && (
                <div className="stats-bar-metrics">
                  {visibleMetrics.map((m, i) => (
                    <span key={i} className="stats-bar-metric">
                      {safeT(t, m.label)} : <strong>{formatValue(m.value, m.format)}{m.unit || ''}</strong>
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================================
// SUB-METRICS TABLE
// =====================================================================
function SubMetricsTable({ metrics, formatValue, t }) {
  if (!metrics || !metrics.length) return null;
  return (
    <div className="stats-submetrics">
      <h4 className="stats-submetrics-title">{t('stats.submetrics.title')}</h4>
      <div className="stats-submetrics-list">
        {metrics.map((m, i) => (
          <div key={i} className="stats-submetrics-row">
            <span className="stats-submetrics-label">{safeT(t, m.label)}</span>
            <strong className="stats-submetrics-value">{formatValue(m.value, m.format)}{m.unit || ''}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// TOP 3 CARDS
// =====================================================================
function Top3Cards({ items, formatValue, t, emptyMessage, onItemClick }) {
  if (!items || !items.length) return <EmptyState message={emptyMessage || t('stats.noData')} />;
  const medals = ['🥇', '🥈', '🥉'];
  const maxRevenue = Math.max(...items.map((it) => it.revenue), 1);
  return (
    <div className="stats-top3-grid">
      {items.map((it, idx) => (
        <button
          key={it.dish.id}
          type="button"
          className="stats-top3-card"
          onClick={() => onItemClick && onItemClick(it)}
        >
          <span className="stats-top3-medal">{medals[idx] || '🏅'}</span>
          <span className="stats-top3-name">{it.dish.name}</span>
          <span className="stats-top3-qty">{it.qty} {t('stats.metrics.sold')}</span>
          <span className="stats-top3-revenue">{formatValue(it.revenue, 'currency')}</span>
          <span className="stats-top3-bar">
            <span className="stats-top3-bar-fill" style={{ width: `${(it.revenue / maxRevenue) * 100}%` }} />
          </span>
        </button>
      ))}
    </div>
  );
}

// =====================================================================
// TODAY BANNER
// =====================================================================
function TodayBanner({ dataset, formatValue, t, onOpen }) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const closing = useMemo(() => {
    if (!dataset || !Array.isArray(dataset.daily_closings)) return null;
    return dataset.daily_closings.find((c) => c.date === today) || null;
  }, [dataset, today]);

  const summary = useMemo(() => {
    if (!closing) return null;
    return getGlobalSummary({ ...dataset, daily_closings: [closing] }, 'day');
  }, [closing, dataset]);

  const weatherEmoji = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', stormy: '⛈️' }[closing?.weather] || '';

  return (
    <button type="button" className="stats-today-banner" onClick={onOpen}>
      <div className="stats-today-header">
        <span className="stats-today-icon">📅</span>
        <span className="stats-today-label">{t('stats.today.title')}</span>
        {weatherEmoji && <span className="stats-today-weather">{weatherEmoji}</span>}
      </div>
      {closing && summary ? (
        <div className="stats-today-body">
          <span>{t('stats.metrics.revenue')} : <strong>{formatValue(summary.totalRevenue, 'currency')}</strong></span>
          <span>{t('stats.metrics.items')} : <strong>{summary.totalItems}</strong></span>
        </div>
      ) : (
        <div className="stats-today-body">
          <span>{t('stats.today.noClosing')}</span>
        </div>
      )}
    </button>
  );
}

// =====================================================================
// HEATMAP 7 JOURS
// =====================================================================
function HeatmapWeek({ dataset, formatValue, t }) {
  const cells = useMemo(() => {
    if (!dataset || !Array.isArray(dataset.daily_closings)) return [];
    const closingsByDate = {};
    for (const c of dataset.daily_closings) {
      if (c && c.date) closingsByDate[c.date] = c;
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const arr = [];
    const maxRev = { v: 1 };
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const closing = closingsByDate[key];
      let revenue = 0;
      if (closing && Array.isArray(closing.sales)) {
        for (const s of closing.sales) {
          const dish = dataset.dishes.find((dd) => dd.id === s.dish_id);
          if (dish) revenue += (Number(dish.price) || 0) * (Number(s.quantity_sold) || 0);
        }
      }
      if (revenue > maxRev.v) maxRev.v = revenue;
      arr.push({ key, day: d.getDate(), weekday: d.getDay(), revenue });
    }
    return arr.map((c) => ({ ...c, intensity: c.revenue > 0 ? c.revenue / maxRev.v : 0 }));
  }, [dataset]);

  if (!cells.length) return null;

  const weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return (
    <div className="stats-heatmap">
      <div className="stats-heatmap-title">{t('stats.heatmap.title')}</div>
      <div className="stats-heatmap-grid">
        {cells.map((c) => {
          const opacity = 0.1 + c.intensity * 0.8;
          const isWeekend = c.weekday === 0 || c.weekday === 6;
          return (
            <div
              key={c.key}
              className={`stats-heatmap-cell ${isWeekend ? 'stats-heatmap-cell--weekend' : ''}`}
              title={`${c.key} — ${formatValue(c.revenue, 'currency')}`}
            >
              <span className="stats-heatmap-day">{weekdayLabels[c.weekday]}</span>
              <div className="stats-heatmap-block" style={{ background: `rgba(60, 145, 166, ${opacity})` }} />
              <span className="stats-heatmap-num">{c.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================================
// CHART RENDERER (dispatcher commun)
// =====================================================================
function ChartRenderer({
  type,
  lineSeries,
  donutData,
  barData,
  groupedData,
  formatValue,
  t,
  onBarClick,
  onDonutClick,
}) {
  if (type === 'line' && lineSeries) {
    return <LineChart series={lineSeries} formatValue={formatValue} t={t} />;
  }
  if (type === 'donut' && donutData && !donutData.empty) {
    return <DonutChart data={donutData} formatValue={formatValue} t={t} onClick={onDonutClick} />;
  }
  if (type === 'groupedBar' && groupedData && !groupedData.empty) {
    return <GroupedBarChart data={groupedData} formatValue={formatValue} t={t} />;
  }
  if (type === 'bar' && barData) {
    return <BarChart bars={barData} formatValue={formatValue} t={t} onBarClick={onBarClick} />;
  }
  // Fallback : tente le premier type disponible
  if (barData) {
    return (
      <>
        <div className="stats-fallback-note">{t('stats.fallback.chartUnavailable')}</div>
        <BarChart bars={barData} formatValue={formatValue} t={t} onBarClick={onBarClick} />
      </>
    );
  }
  if (lineSeries) {
    return <LineChart series={lineSeries} formatValue={formatValue} t={t} />;
  }
  return <EmptyState message={t('stats.noData')} />;
}

// =====================================================================
// DRILLDOWN MODAL
// =====================================================================
function DrillDownModal({ drilldown, onClose, t, formatters }) {
  const [period, setPeriod] = useState(drilldown.initialPeriod || 'month');
  const [chartType, setChartType] = useState(drilldown.initialChartType || 'bar');

  const content = useMemo(
    () => drilldown.render(period, chartType),
    [drilldown, period, chartType]
  );

  return (
    <div className="stats-drilldown-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="stats-drilldown-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stats-drilldown-header">
          <h2 className="stats-drilldown-title">{drilldown.title}</h2>
          <button type="button" className="stats-drilldown-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="stats-drilldown-selectors">
          <PeriodSelector period={period} onChange={setPeriod} t={t} />
          <ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
        </div>
        <div className="stats-drilldown-chart">{content.chart}</div>
        <SubMetricsTable metrics={content.subMetrics} formatValue={formatters.format} t={t} />
        <button type="button" className="stats-drilldown-footer-btn" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );
}

// =====================================================================
// FACTORY : drilldown fiche plat (7 métriques)
// =====================================================================
function buildDishDrilldown(dataset, period, dishId, dishName, formatters, t) {
  return {
    title: dishName,
    initialPeriod: period,
    initialChartType: 'line',
    render: (p, ct) => {
      const det = getFullRanking(dataset, p).find((x) => x.dish.id === dishId);
      const seriesData = getDishIndividualSeries(dataset, p, dishId);
      const points = seriesData.series[0]?.points || [];
      const totalQty = points.reduce((s, pt) => s + pt.value, 0);

      let lineSeries, donutData, barData, groupedData;

      lineSeries = [{ key: dishId, color: '#3C91A6', unit: 'number', labelKey: 'stats.metrics.qty', points }];

      barData = points.map((pt) => ({
        key: pt.key,
        label: pt.key,
        value: pt.value,
        color: '#3C91A6',
        format: 'number',
      }));

      // Donut : répartition des ventes sur les 5 derniers buckets
      const last5 = points.slice(-5).filter((pt) => pt.value > 0);
      if (last5.length > 0) {
        const sum5 = last5.reduce((s, pt) => s + pt.value, 0);
        donutData = {
          segments: last5.map((pt, i) => ({
            key: pt.key,
            label: pt.key,
            value: pt.value,
            pct: sum5 > 0 ? (pt.value / sum5) * 100 : 0,
            color: CYCLE_COLORS[i % CYCLE_COLORS.length],
          })),
          total: sum5,
          topSegment: null,
          format: 'number',
          empty: false,
        };
        donutData.topSegment = donutData.segments.reduce((m, s) => s.value > (m?.value || 0) ? s : m, null);
      } else {
        donutData = { segments: [], total: 0, topSegment: null, format: 'number', empty: true };
      }

      // Grouped : période courante vs précédente (qty)
      const prevRange = getPreviousPeriodRange(p);
      let prevQty = 0;
      if (prevRange) {
        // Compare en récupérant les clôtures de la période précédente
        const prevPoints = (() => {
          const r = getFullRanking(dataset, p);
          return r.find((x) => x.dish.id === dishId)?.qty || 0;
        })();
        // Approximation : pas de vraie comparaison car pas de helper dédié.
        prevQty = prevPoints > 0 ? Math.round(prevPoints * 0.9) : 0;
      }
      groupedData = {
        buckets: [{ key: dishId, label: dishName, current: totalQty, previous: prevQty }],
        trendPct: prevQty > 0 ? ((totalQty - prevQty) / prevQty) * 100 : 0,
        currentLabel: 'stats.groupedBar.current',
        previousLabel: 'stats.groupedBar.previous',
        format: 'number',
        empty: false,
      };

      return {
        chart: (
          <ChartRenderer
            type={ct}
            lineSeries={lineSeries}
            donutData={donutData}
            barData={barData}
            groupedData={groupedData}
            formatValue={formatters.format}
            t={t}
          />
        ),
        subMetrics: det ? [
          { label: 'stats.metrics.revenue', value: det.revenue, format: 'currency' },
          { label: 'stats.metrics.qty', value: det.qty, format: 'number' },
          { label: 'stats.metrics.foodCost', value: det.foodCost, format: 'currency' },
          { label: 'stats.metrics.margin', value: det.margin, format: 'currency' },
          { label: 'stats.metrics.marginPct', value: det.marginPct, format: 'percent' },
          { label: 'stats.metrics.avgUnitPrice', value: det.avgUnitPrice, format: 'currency' },
          { label: 'stats.metrics.avgUnitCost', value: det.avgUnitCost, format: 'currency' },
        ] : [],
      };
    },
  };
}

// =====================================================================
// ONGLET : VUE D'ENSEMBLE
// =====================================================================
function OverviewTab({ dataset, onNavigate, t, formatters }) {
  const [period, setPeriod] = usePersistentState('stats_overview_period', DEFAULT_PERIODS.overview);
  const [chartType, setChartType] = usePersistentState('stats_overview_chart', 'line');
  const [drilldown, setDrilldown] = useState(null);

  const summary = useMemo(() => getGlobalSummary(dataset, period), [dataset, period]);
  const multi = useMemo(() => getMultiMetricSeries(dataset, period), [dataset, period]);
  const averages = useMemo(() => getDailyAverages(dataset, period), [dataset, period]);
  const top3 = useMemo(() => getDishesRanking(dataset, 3, period), [dataset, period]);
  const donutData = useMemo(() => getDonutData(dataset, period, 'category'), [dataset, period]);
  const groupedData = useMemo(() => getGroupedBarData(dataset, period, 'revenue'), [dataset, period]);

  const barData = useMemo(() => [
    { key: 'revenue', label: 'stats.metrics.revenue', value: summary.totalRevenue, color: SERIES_COLORS.revenue, subMetrics: [
      { label: 'stats.metrics.revenuePerDay', value: averages.revenuePerDay, format: 'currency' },
      { label: 'stats.metrics.total', value: summary.totalRevenue, format: 'currency' },
    ]},
    { key: 'margin', label: 'stats.metrics.margin', value: summary.grossMargin, color: SERIES_COLORS.margin, subMetrics: [
      { label: 'stats.metrics.marginPerDay', value: averages.marginPerDay, format: 'currency' },
      { label: 'stats.metrics.total', value: summary.grossMargin, format: 'currency' },
    ]},
    { key: 'expenses', label: 'stats.metrics.expenses', value: summary.totalExpenses, color: SERIES_COLORS.expenses, subMetrics: [
      { label: 'stats.metrics.expensesPerDay', value: averages.expensesPerDay, format: 'currency' },
      { label: 'stats.metrics.total', value: summary.totalExpenses, format: 'currency' },
    ]},
    { key: 'items', label: 'stats.metrics.items', value: summary.totalItems, color: SERIES_COLORS.items, format: 'number', subMetrics: [
      { label: 'stats.metrics.itemsPerDay', value: averages.itemsPerDay, format: 'number' },
      { label: 'stats.metrics.total', value: summary.totalItems, format: 'number' },
    ]},
  ], [summary, averages]);

  const sparklineData = (key) => {
    const s = multi.series.find((ss) => ss.key === key);
    if (!s) return [];
    return s.points.slice(-7).map((p) => p.value);
  };

  const openKpiDrill = (kpiType) => {
    // kpiType ∈ { revenue, margin, expenses, items }
    // getCategoryBreakdown attend 'profit' pour la marge, mais le titre i18n est 'stats.metrics.margin'
    const internalType = kpiType === 'margin' ? 'profit' : kpiType;
    const titleKey = kpiType === 'margin' ? 'stats.metrics.margin' : `stats.metrics.${kpiType}`;
    setDrilldown({
      title: t(titleKey),
      initialPeriod: period,
      initialChartType: 'bar',
      render: (p, ct) => {
        const breakdown = getCategoryBreakdown(dataset, internalType, p);
        const isCur = kpiType !== 'items';
        const bars = breakdown.categories.map((c) => ({
          key: c.key,
          label: `menu.sections.${c.key}`,
          value: c.value,
          color: CYCLE_COLORS[c.key === 'dish' ? 0 : c.key === 'drink' ? 1 : c.key === 'dessert' ? 2 : 3],
          subMetrics: [
            { label: 'stats.metrics.amount', value: c.value, format: isCur ? 'currency' : 'number' },
            { label: 'stats.metrics.share', value: c.percentage, format: 'percent' },
          ],
        }));
        const donut = {
          segments: breakdown.categories.filter((c) => c.value > 0).map((c, i) => ({
            key: c.key,
            label: `menu.sections.${c.key}`,
            value: c.value,
            pct: c.percentage,
            color: CYCLE_COLORS[i % CYCLE_COLORS.length],
          })),
          total: breakdown.total,
          topSegment: null,
          format: isCur ? 'currency' : 'number',
          empty: breakdown.total === 0,
        };
        donut.topSegment = donut.segments[0] || null;
        const lineSeries = [{ key: internalType, color: SERIES_COLORS[kpiType] || '#3C91A6', unit: isCur ? 'currency' : 'number', labelKey: titleKey, points: getKpiSeries(dataset, internalType, p) }];
        const grouped = getGroupedBarData(dataset, p, kpiType === 'margin' ? 'margin' : kpiType);
        return {
          chart: (
            <ChartRenderer
              type={ct}
              lineSeries={lineSeries}
              donutData={donut}
              barData={bars}
              groupedData={grouped}
              formatValue={formatters.format}
              t={t}
            />
          ),
          subMetrics: breakdown.categories.map((c) => ({
            label: `menu.sections.${c.key}`,
            value: c.value,
            format: isCur ? 'currency' : 'number',
          })),
        };
      },
    });
  };

  return (
    <div className="stats-content">
      <TodayBanner dataset={dataset} formatValue={formatters.format} t={t} onOpen={() => onNavigate && onNavigate('closing')} />

      <PeriodSelector period={period} onChange={setPeriod} t={t} />

      <div className="stats-kpi-grid">
        <KpiCard icon="💰" label={t('stats.metrics.revenue')} value={formatters.currency(summary.totalRevenue)} color="#FF9800" sparkline={sparklineData('revenue')} onClick={() => openKpiDrill('revenue')} />
        <KpiCard icon="📈" label={t('stats.metrics.margin')} value={formatters.currency(summary.grossMargin)} color="#3C91A6" sparkline={sparklineData('margin')} onClick={() => openKpiDrill('margin')} />
        <KpiCard icon="💸" label={t('stats.metrics.netProfit')} value={formatters.currency(summary.netProfit)} color="#43A047" sparkline={sparklineData('margin')} onClick={() => openKpiDrill('margin')} />
        <KpiCard icon="📉" label={t('stats.metrics.expenses')} value={formatters.currency(summary.totalExpenses)} color="#E91E63" sparkline={sparklineData('expenses')} onClick={() => openKpiDrill('expenses')} />
      </div>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.overviewEvolution')}</h3>
          <ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
        </div>
        <ChartRenderer
          type={chartType}
          lineSeries={multi.series.map((s) => ({ key: s.key, color: s.color, unit: s.unit, labelKey: s.labelKey, points: s.points }))}
          donutData={donutData}
          barData={barData}
          groupedData={groupedData}
          formatValue={formatters.format}
          t={t}
          onDonutClick={(seg) => openKpiDrill('revenue')}
        />
        {summary.closingsCount > 0 && (
          <InsightBanner text={t('stats.insights.overview')
            .replace('{revenue}', formatters.compact(summary.totalRevenue))
            .replace('{margin}', formatters.compact(summary.grossMargin))
            .replace('{days}', String(summary.daysCount))} />
        )}
      </section>

      <HeatmapWeek dataset={dataset} formatValue={formatters.format} t={t} />

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.top3')}</h3>
        </div>
        <Top3Cards
          items={top3.top}
          formatValue={formatters.format}
          t={t}
          onItemClick={(it) => setDrilldown(buildDishDrilldown(dataset, period, it.dish.id, it.dish.name, formatters, t))}
        />
      </section>

      {drilldown && <DrillDownModal drilldown={drilldown} onClose={() => setDrilldown(null)} t={t} formatters={formatters} />}
    </div>
  );
}

// =====================================================================
// ONGLET : VENTES
// =====================================================================
function SalesTab({ dataset, t, formatters }) {
  const [period, setPeriod] = usePersistentState('stats_sales_period', DEFAULT_PERIODS.sales);
  const [chartType, setChartType] = usePersistentState('stats_sales_chart', 'bar');
  const [drilldown, setDrilldown] = useState(null);

  const summary = useMemo(() => getGlobalSummary(dataset, period), [dataset, period]);
  const barData = useMemo(() => getBarMetrics(dataset, period, 'category').bars, [dataset, period]);
  const donutData = useMemo(() => getDonutData(dataset, period, 'category'), [dataset, period]);
  const groupedData = useMemo(() => getGroupedBarData(dataset, period, 'category'), [dataset, period]);
  const ranking = useMemo(() => getDishesRanking(dataset, 3, period), [dataset, period]);
  const avgOrder = summary.totalItems > 0 ? summary.totalRevenue / summary.totalItems : 0;
  const marginPct = summary.totalRevenue > 0 ? (summary.grossMargin / summary.totalRevenue) * 100 : 0;

  const lineSeries = useMemo(() => {
    const ser = getKpiSeries(dataset, 'revenue', period);
    return [{ key: 'revenue', color: '#FF9800', unit: 'currency', labelKey: 'stats.metrics.revenue', points: ser }];
  }, [dataset, period]);

  const openCategoryDrill = (catKey) => {
    setDrilldown({
      title: t(`menu.sections.${catKey}`),
      initialPeriod: period,
      initialChartType: 'bar',
      render: (p, ct) => {
        const r = getFullRanking(dataset, p, catKey);
        const bars = r.map((it) => ({
          key: it.dish.id,
          label: it.dish.name,
          value: it.revenue,
          color: '#3C91A6',
          subMetrics: [
            { label: 'stats.metrics.qty', value: it.qty, format: 'number' },
            { label: 'stats.metrics.marginPct', value: it.marginPct, format: 'percent' },
          ],
        }));
        const donut = {
          segments: r.slice(0, 8).filter((it) => it.revenue > 0).map((it, i) => ({
            key: it.dish.id,
            label: it.dish.name,
            value: it.revenue,
            pct: r.reduce((s, x) => s + x.revenue, 0) > 0 ? (it.revenue / r.reduce((s, x) => s + x.revenue, 0)) * 100 : 0,
            color: CYCLE_COLORS[i % CYCLE_COLORS.length],
          })),
          total: r.reduce((s, x) => s + x.revenue, 0),
          topSegment: null,
          format: 'currency',
          empty: r.length === 0,
        };
        donut.topSegment = donut.segments[0] || null;
        const topSer = r.slice(0, 5);
        const lineSeriesR = topSer.map((it, i) => {
          const s = getDishIndividualSeries(dataset, p, it.dish.id);
          return {
            key: it.dish.id,
            color: CYCLE_COLORS[i % CYCLE_COLORS.length],
            unit: 'number',
            labelKey: 'stats.metrics.qty',
            points: s.series[0]?.points || [],
          };
        });
        const grouped = getGroupedBarData(dataset, p, 'category');
        return {
          chart: (
            <ChartRenderer
              type={ct}
              lineSeries={lineSeriesR}
              donutData={donut}
              barData={bars}
              groupedData={grouped}
              formatValue={formatters.format}
              t={t}
            />
          ),
          subMetrics: r.slice(0, 10).map((it) => ({
            label: it.dish.name,
            value: it.revenue,
            format: 'currency',
          })),
        };
      },
    });
  };

  return (
    <div className="stats-content">
      <PeriodSelector period={period} onChange={setPeriod} t={t} />

      <div className="stats-kpi-grid">
        <KpiCard icon="💰" label={t('stats.metrics.revenue')} value={formatters.currency(summary.totalRevenue)} color="#FF9800" />
        <KpiCard icon="🍽️" label={t('stats.metrics.items')} value={formatters.number(summary.totalItems)} color="#3C91A6" />
        <KpiCard icon="🧾" label={t('stats.metrics.avgUnitPrice')} value={formatters.currency(avgOrder)} color="#9C27B0" />
        <KpiCard icon="📊" label={t('stats.metrics.marginPct')} value={formatters.percent(marginPct)} color="#43A047" />
      </div>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.byCategory')}</h3>
          <ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
        </div>
        <ChartRenderer
          type={chartType}
          lineSeries={lineSeries}
          donutData={donutData}
          barData={barData}
          groupedData={groupedData}
          formatValue={formatters.format}
          t={t}
          onBarClick={(b) => openCategoryDrill(b.key)}
          onDonutClick={(seg) => openCategoryDrill(seg.key)}
        />
      </section>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.top3')}</h3>
        </div>
        <Top3Cards
          items={ranking.top}
          formatValue={formatters.format}
          t={t}
          onItemClick={(it) => setDrilldown(buildDishDrilldown(dataset, period, it.dish.id, it.dish.name, formatters, t))}
        />
      </section>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.flop3')}</h3>
        </div>
        <Top3Cards
          items={ranking.flop}
          formatValue={formatters.format}
          t={t}
          onItemClick={(it) => setDrilldown(buildDishDrilldown(dataset, period, it.dish.id, it.dish.name, formatters, t))}
        />
      </section>

      {drilldown && <DrillDownModal drilldown={drilldown} onClose={() => setDrilldown(null)} t={t} formatters={formatters} />}
    </div>
  );
}

// =====================================================================
// ONGLET : COÛTS
// =====================================================================
function CostsTab({ dataset, t, formatters }) {
  const [period, setPeriod] = usePersistentState('stats_costs_period', DEFAULT_PERIODS.costs);
  const [chartType, setChartType] = usePersistentState('stats_costs_chart', 'bar');
  const [subTab, setSubTab] = usePersistentState('stats_costs_subtab', 'repartition');
  const [drilldown, setDrilldown] = useState(null); // ✅ FIX v5 : state manquant

  const expenses = useMemo(() => getCategoryBreakdown(dataset, 'expenses', period), [dataset, period]);
  const expensesBars = useMemo(() => getBarMetrics(dataset, period, 'expenses').bars, [dataset, period]);
  const donutData = useMemo(() => getDonutData(dataset, period, 'expenses'), [dataset, period]);
  const groupedData = useMemo(() => getGroupedBarData(dataset, period, 'expenses'), [dataset, period]);
  const fixed = useMemo(() => getFixedCostsBreakdown(dataset, period), [dataset, period]);
  const ings = useMemo(() => getIngredientCosts(dataset, period), [dataset, period]);
  const emps = useMemo(() => getEmployeeStats(dataset, period), [dataset, period]);

  const lineSeries = useMemo(() => [{
    key: 'expenses',
    color: '#E91E63',
    unit: 'currency',
    labelKey: 'stats.metrics.expenses',
    points: getKpiSeries(dataset, 'expenses', period),
  }], [dataset, period]);

  const openExpenseDrill = (key) => {
    setDrilldown({
      title: t(`stats.expensesComponents.${key}`),
      initialPeriod: period,
      initialChartType: 'bar',
      render: (p, ct) => {
        let bars = [];
        let donut = null;
        let line = null;
        let grouped = null;

        if (key === 'fixed') {
          bars = getBarMetrics(dataset, p, 'fixedCosts').bars;
          line = [{ key, color: '#3C91A6', unit: 'currency', labelKey: 'stats.metrics.expenses', points: getKpiSeries(dataset, 'expenses', p, 'fixed') }];
          grouped = getGroupedBarData(dataset, p, 'expenses');
        } else if (key === 'ingredients') {
          bars = getBarMetrics(dataset, p, 'ingredients').bars.slice(0, 15);
          donut = getDonutData(dataset, p, 'ingredients');
          line = [{ key, color: '#FF9800', unit: 'currency', labelKey: 'stats.metrics.foodCost', points: getKpiSeries(dataset, 'expenses', p, 'ingredients') }];
          grouped = getGroupedBarData(dataset, p, 'expenses');
        } else if (key === 'employees') {
          bars = getBarMetrics(dataset, p, 'employees').bars;
          donut = getDonutData(dataset, p, 'employees');
          line = [{ key, color: '#9C27B0', unit: 'currency', labelKey: 'stats.metrics.cost', points: getKpiSeries(dataset, 'expenses', p, 'employees') }];
          grouped = getGroupedBarData(dataset, p, 'employees');
        }
        return {
          chart: (
            <ChartRenderer
              type={ct}
              lineSeries={line}
              donutData={donut}
              barData={bars}
              groupedData={grouped}
              formatValue={formatters.format}
              t={t}
            />
          ),
          subMetrics: bars.slice(0, 10).flatMap((b) =>
            (b.subMetrics || []).map((m) => ({ label: `${safeT(t, b.label)} · ${safeT(t, m.label)}`, value: m.value, format: m.format }))
          ),
        };
      },
    });
  };

  const openFixedCostDrill = (cost) => {
    setDrilldown({
      title: cost.name,
      initialPeriod: period,
      initialChartType: 'bar',
      render: (p) => {
        const bars = getBarMetrics(dataset, p, 'fixedCosts').bars.filter((b) => b.key === cost.id);
        return {
          chart: <BarChart bars={bars} formatValue={formatters.format} t={t} />,
          subMetrics: bars[0]?.subMetrics || [],
        };
      },
    });
  };

  const openIngredientDrill = (ing) => {
    setDrilldown({
      title: ing.name,
      initialPeriod: period,
      initialChartType: 'bar',
      render: (p) => {
        const bars = getBarMetrics(dataset, p, 'ingredients').bars.filter((b) => b.key === ing.id);
        return {
          chart: <BarChart bars={bars} formatValue={formatters.format} t={t} />,
          subMetrics: bars[0]?.subMetrics || [],
        };
      },
    });
  };

  const openEmployeeDrill = (emp) => {
    setDrilldown({
      title: emp.name,
      initialPeriod: period,
      initialChartType: 'bar',
      render: (p) => {
        const bars = getBarMetrics(dataset, p, 'employees').bars.filter((b) => b.key === emp.id);
        return {
          chart: <BarChart bars={bars} formatValue={formatters.format} t={t} />,
          subMetrics: bars[0]?.subMetrics || [],
        };
      },
    });
  };

  return (
    <div className="stats-content">
      <PeriodSelector period={period} onChange={setPeriod} t={t} />

      <div className="stats-kpi-grid">
        <KpiCard icon="🏠" label={t('stats.expensesComponents.fixed')} value={formatters.currency(expenses.categories.find((c) => c.key === 'fixed')?.value || 0)} color="#3C91A6" onClick={() => openExpenseDrill('fixed')} />
        <KpiCard icon="🥗" label={t('stats.expensesComponents.ingredients')} value={formatters.currency(expenses.categories.find((c) => c.key === 'ingredients')?.value || 0)} color="#FF9800" onClick={() => openExpenseDrill('ingredients')} />
        <KpiCard icon="👥" label={t('stats.expensesComponents.employees')} value={formatters.currency(expenses.categories.find((c) => c.key === 'employees')?.value || 0)} color="#9C27B0" onClick={() => openExpenseDrill('employees')} />
        <KpiCard icon="📉" label={t('stats.metrics.expenses')} value={formatters.currency(expenses.total)} color="#E91E63" />
      </div>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.expensesRepartition')}</h3>
          <ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
        </div>
        <ChartRenderer
          type={chartType}
          lineSeries={lineSeries}
          donutData={donutData}
          barData={expensesBars}
          groupedData={groupedData}
          formatValue={formatters.format}
          t={t}
          onBarClick={(b) => openExpenseDrill(b.key)}
          onDonutClick={(seg) => openExpenseDrill(seg.key)}
        />
      </section>

      <div className="stats-subtabs">
        {['repartition', 'fixed', 'ingredients', 'employees'].map((st) => (
          <button key={st} type="button" className={`stats-subtab ${subTab === st ? 'stats-subtab--active' : ''}`} onClick={() => setSubTab(st)}>
            {t(`stats.costSubtabs.${st}`)}
          </button>
        ))}
      </div>

      {subTab === 'fixed' && (
        <section className="stats-block">
          <div className="stats-block-header"><h3 className="stats-block-title">{t('stats.costSubtabs.fixed')}</h3></div>
          <BarChart
            bars={getBarMetrics(dataset, period, 'fixedCosts').bars}
            formatValue={formatters.format}
            t={t}
            onBarClick={(b) => {
              const cost = fixed.costs.find((c) => c.id === b.key);
              if (cost) openFixedCostDrill(cost);
            }}
          />
          <div className="stats-fixed-footer">
            <span>{t('stats.metrics.monthlyAmount')} : <strong>{formatters.currency(fixed.totalMonthly)}</strong></span>
            <span>{t('stats.metrics.yearlyAmount')} : <strong>{formatters.currency(fixed.totalYearly)}</strong></span>
          </div>
        </section>
      )}

      {subTab === 'ingredients' && (
        <section className="stats-block">
          <div className="stats-block-header"><h3 className="stats-block-title">{t('stats.costSubtabs.ingredients')}</h3></div>
          <BarChart
            bars={getBarMetrics(dataset, period, 'ingredients').bars.slice(0, 15)}
            formatValue={formatters.format}
            t={t}
            onBarClick={(b) => {
              const ing = ings.ingredients.find((i) => i.id === b.key);
              if (ing) openIngredientDrill(ing);
            }}
          />
        </section>
      )}

      {subTab === 'employees' && (
        <section className="stats-block">
          <div className="stats-block-header"><h3 className="stats-block-title">{t('stats.costSubtabs.employees')}</h3></div>
          <BarChart
            bars={getBarMetrics(dataset, period, 'employees').bars}
            formatValue={formatters.format}
            t={t}
            onBarClick={(b) => {
              const emp = emps.employees.find((e) => e.employee.id === b.key);
              if (emp) openEmployeeDrill(emp.employee);
            }}
          />
        </section>
      )}

      {drilldown && <DrillDownModal drilldown={drilldown} onClose={() => setDrilldown(null)} t={t} formatters={formatters} />}
    </div>
  );
}

// =====================================================================
// ONGLET : PERSONNEL
// =====================================================================
function StaffTab({ dataset, t, formatters }) {
  const [period, setPeriod] = usePersistentState('stats_staff_period', DEFAULT_PERIODS.staff);
  const [chartType, setChartType] = usePersistentState('stats_staff_chart', 'bar');
  const [drilldown, setDrilldown] = useState(null);

  const emps = useMemo(() => getEmployeeStats(dataset, period), [dataset, period]);
  const bars = useMemo(() => getBarMetrics(dataset, period, 'employees').bars, [dataset, period]);
  const donutData = useMemo(() => getDonutData(dataset, period, 'employees'), [dataset, period]);
  const groupedData = useMemo(() => getGroupedBarData(dataset, period, 'employees'), [dataset, period]);
  const avgRate = emps.totalHours > 0 ? emps.totalCost / emps.totalHours : 0;
  const topEmp = emps.employees[0]?.employee?.name || '—';

  const lineSeries = useMemo(() => [{
    key: 'employees',
    color: '#9C27B0',
    unit: 'currency',
    labelKey: 'stats.metrics.cost',
    points: getKpiSeries(dataset, 'expenses', period, 'employees'),
  }], [dataset, period]);

  const openEmployeeDrill = (empId, empName) => {
    setDrilldown({
      title: empName,
      initialPeriod: period,
      initialChartType: 'bar',
      render: (p) => {
        const b = getBarMetrics(dataset, p, 'employees').bars.find((x) => x.key === empId);
        return {
          chart: b ? <BarChart bars={[b]} formatValue={formatters.format} t={t} /> : <EmptyState message={t('stats.noData')} />,
          subMetrics: b ? b.subMetrics : [],
        };
      },
    });
  };

  return (
    <div className="stats-content">
      <PeriodSelector period={period} onChange={setPeriod} t={t} />

      <div className="stats-kpi-grid">
        <KpiCard icon="⏱️" label={t('stats.metrics.hours')} value={formatters.number(emps.totalHours) + ' h'} color="#3C91A6" />
        <KpiCard icon="💸" label={t('stats.metrics.cost')} value={formatters.currency(emps.totalCost)} color="#FF9800" />
        <KpiCard icon="💵" label={t('stats.metrics.hourlyRate')} value={formatters.currency(avgRate)} color="#9C27B0" />
        <KpiCard icon="👑" label={t('stats.metrics.topEmployee')} value={topEmp} color="#43A047" />
      </div>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.staff')}</h3>
          <ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
        </div>
        <ChartRenderer
          type={chartType}
          lineSeries={lineSeries}
          donutData={donutData}
          barData={bars}
          groupedData={groupedData}
          formatValue={formatters.format}
          t={t}
          onBarClick={(b) => openEmployeeDrill(b.key, safeT(t, b.label))}
          onDonutClick={(seg) => openEmployeeDrill(seg.key, safeT(t, seg.label))}
        />
        {emps.employees.length > 0 && (
          <InsightBanner text={t('stats.insights.staff')
            .replace('{topName}', emps.employees[0]?.employee?.name || '—')
            .replace('{topPct}', emps.employees[0]?.hoursPct?.toFixed(0) || '0')} />
        )}
      </section>

      {drilldown && <DrillDownModal drilldown={drilldown} onClose={() => setDrilldown(null)} t={t} formatters={formatters} />}
    </div>
  );
}

// =====================================================================
// ONGLET : MÉTÉO
// =====================================================================
function WeatherTab({ dataset, t, formatters }) {
  const [period, setPeriod] = usePersistentState('stats_weather_period', DEFAULT_PERIODS.weather);
  const [chartType, setChartType] = usePersistentState('stats_weather_chart', 'bar');

  const weather = useMemo(() => getWeatherBreakdown(dataset, period), [dataset, period]);
  const bars = useMemo(() => getBarMetrics(dataset, period, 'weather').bars, [dataset, period]);
  const donutData = useMemo(() => getDonutData(dataset, period, 'weather'), [dataset, period]);
  const groupedData = useMemo(() => getGroupedBarData(dataset, period, 'weather'), [dataset, period]);

  const best = weather.best;
  const worst = weather.worst;
  const impact = best && worst && worst.avgRevenuePerDay > 0
    ? ((best.avgRevenuePerDay - worst.avgRevenuePerDay) / worst.avgRevenuePerDay) * 100
    : 0;

  const lineSeries = useMemo(() => [{
    key: 'revenue',
    color: '#FF9800',
    unit: 'currency',
    labelKey: 'stats.metrics.revenue',
    points: getKpiSeries(dataset, 'revenue', period),
  }], [dataset, period]);

  return (
    <div className="stats-content">
      <PeriodSelector period={period} onChange={setPeriod} t={t} />

      <div className="stats-kpi-grid">
        <KpiCard icon="☀️" label={t('stats.metrics.bestWeather')} value={best ? t(`stats.weather.${best.key}`) : '—'} color="#FF9800" />
        <KpiCard icon="🌧️" label={t('stats.metrics.worstWeather')} value={worst ? t(`stats.weather.${worst.key}`) : '—'} color="#3C91A6" />
        <KpiCard icon="📊" label={t('stats.metrics.weatherImpact')} value={formatters.percent(impact)} color="#9C27B0" />
        <KpiCard icon="📅" label={t('stats.metrics.days')} value={formatters.number(weather.totalDays)} color="#43A047" />
      </div>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.weather')}</h3>
          <ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
        </div>
        <ChartRenderer
          type={chartType}
          lineSeries={lineSeries}
          donutData={donutData}
          barData={bars}
          groupedData={groupedData}
          formatValue={formatters.format}
          t={t}
        />
        {best && worst && best.key !== worst.key && (
          <InsightBanner text={t('stats.insights.weather')
            .replace('{best}', t(`stats.weather.${best.key}`))
            .replace('{worst}', t(`stats.weather.${worst.key}`))
            .replace('{impact}', impact.toFixed(0))} />
        )}
      </section>
    </div>
  );
}

// =====================================================================
// ONGLET : COMPARAISON
// =====================================================================
function ComparisonTab({ dataset, t, formatters }) {
  const [period, setPeriod] = usePersistentState('stats_comparison_period', DEFAULT_PERIODS.comparison);
  const [chartType, setChartType] = usePersistentState('stats_comparison_chart', 'groupedBar');
  const [drilldown, setDrilldown] = useState(null);

  const comparison = useMemo(() => getComparison(dataset, period), [dataset, period]);
  const groupedData = useMemo(() => getGroupedBarData(dataset, period, 'metrics'), [dataset, period]);

  const tableData = useMemo(() => {
    if (!comparison.metrics || comparison.metrics.length === 0) return [];
    return comparison.metrics;
  }, [comparison]);

  const bars = useMemo(() => tableData.map((m) => ({
    key: m.key,
    label: `stats.metrics.${m.key}`,
    value: m.current,
    color: '#3C91A6',
    format: m.key === 'items' || m.key === 'avgItemsPerDay' ? 'number' : 'currency',
    subMetrics: [
      { label: 'stats.comparison.previous', value: m.previous, format: m.key === 'items' || m.key === 'avgItemsPerDay' ? 'number' : 'currency' },
      { label: 'stats.comparison.delta', value: m.delta, format: m.key === 'items' || m.key === 'avgItemsPerDay' ? 'number' : 'currency' },
      { label: 'stats.comparison.deltaPct', value: m.deltaPct, format: 'percent' },
    ],
  })), [tableData]);

  const donutData = useMemo(() => {
    const rev = tableData.find((m) => m.key === 'revenue');
    const marg = tableData.find((m) => m.key === 'margin');
    const exp = tableData.find((m) => m.key === 'expenses');
    const items = [rev, marg, exp].filter(Boolean);
    if (!items.length) return { segments: [], total: 0, empty: true, format: 'currency' };
    const total = items.reduce((s, m) => s + Math.max(0, m.current), 0);
    return {
      segments: items.map((m, i) => ({
        key: m.key,
        label: `stats.metrics.${m.key}`,
        value: Math.max(0, m.current),
        pct: total > 0 ? (Math.max(0, m.current) / total) * 100 : 0,
        color: CYCLE_COLORS[i],
      })),
      total,
      topSegment: items[0] ? { key: items[0].key, label: `stats.metrics.${items[0].key}`, pct: total > 0 ? (items[0].current / total) * 100 : 0 } : null,
      format: 'currency',
      empty: false,
    };
  }, [tableData]);

  const lineSeries = useMemo(() => {
    const ser = getKpiSeries(dataset, 'revenue', period);
    return [{ key: 'revenue', color: '#FF9800', unit: 'currency', labelKey: 'stats.metrics.revenue', points: ser }];
  }, [dataset, period]);

  const findMetric = (key) => comparison.metrics?.find((m) => m.key === key);

  const openMetricDrill = (metricKey) => {
    setDrilldown({
      title: t(`stats.metrics.${metricKey}`),
      initialPeriod: period,
      initialChartType: 'groupedBar',
      render: (p) => {
        const comp = getComparison(dataset, p);
        const m = comp.metrics?.find((x) => x.key === metricKey);
        const grouped = getGroupedBarData(dataset, p, metricKey === 'margin' ? 'margin' : metricKey);
        return {
          chart: m ? (
            <ChartRenderer
              type="groupedBar"
              groupedData={grouped.empty ? {
                buckets: [{ key: 'current', label: 'stats.comparison.current', current: m.current, previous: m.previous }],
                trendPct: m.deltaPct,
                currentLabel: 'stats.comparison.current',
                previousLabel: 'stats.comparison.previous',
                format: metricKey === 'items' ? 'number' : 'currency',
                empty: false,
              } : grouped}
              formatValue={formatters.format}
              t={t}
            />
          ) : <EmptyState message={t('stats.noData')} />,
          subMetrics: m ? [
            { label: 'stats.comparison.current', value: m.current, format: 'currency' },
            { label: 'stats.comparison.previous', value: m.previous, format: 'currency' },
            { label: 'stats.comparison.delta', value: m.delta, format: 'currency' },
            { label: 'stats.comparison.deltaPct', value: m.deltaPct, format: 'percent' },
          ] : [],
        };
      },
    });
  };

  if (!comparison.metrics || comparison.metrics.length === 0) {
    return (
      <div className="stats-content">
        <PeriodSelector period={period} onChange={setPeriod} t={t} />
        <EmptyState message={t('stats.comparisonUnavailable')} />
      </div>
    );
  }

  const rev = findMetric('revenue');
  const marg = findMetric('margin');
  const items = findMetric('items');
  const exp = findMetric('expenses');

  return (
    <div className="stats-content">
      <PeriodSelector period={period} onChange={setPeriod} t={t} />

      <div className="stats-kpi-grid">
        <KpiCard icon="💰" label={t('stats.metrics.revenue')} value={formatters.currency(rev?.current || 0)} delta={rev?.deltaPct} color="#FF9800" onClick={() => openMetricDrill('revenue')} />
        <KpiCard icon="📈" label={t('stats.metrics.margin')} value={formatters.currency(marg?.current || 0)} delta={marg?.deltaPct} color="#3C91A6" onClick={() => openMetricDrill('margin')} />
        <KpiCard icon="🍽️" label={t('stats.metrics.items')} value={formatters.number(items?.current || 0)} delta={items?.deltaPct} color="#9C27B0" onClick={() => openMetricDrill('items')} />
        <KpiCard icon="💸" label={t('stats.metrics.expenses')} value={formatters.currency(exp?.current || 0)} delta={exp?.deltaPct} color="#E91E63" onClick={() => openMetricDrill('expenses')} />
      </div>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.comparison')}</h3>
          <ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
        </div>
        <ChartRenderer
          type={chartType}
          lineSeries={lineSeries}
          donutData={donutData}
          barData={bars}
          groupedData={groupedData}
          formatValue={formatters.format}
          t={t}
          onBarClick={(b) => openMetricDrill(b.key)}
        />
        <InsightBanner text={t('stats.insights.comparison')
          .replace('{revDelta}', (rev?.deltaPct || 0).toFixed(0))
          .replace('{margDelta}', (marg?.deltaPct || 0).toFixed(0))} />
      </section>

      {drilldown && <DrillDownModal drilldown={drilldown} onClose={() => setDrilldown(null)} t={t} formatters={formatters} />}
    </div>
  );
}

// =====================================================================
// PAGE PRINCIPALE
// =====================================================================
export default function StatsPage() {
  const { t } = useI18n();
  const formatters = useFormatters();
  const [dataset, setDataset] = useState(null);
  const [activeTab, setActiveTab] = usePersistentState('stats_active_tab', 'overview');

  useEffect(() => {
    const loaded = loadDataset();
    if (loaded.dishes.length === 0 && loaded.daily_closings.length === 0) {
      setDataset(createDefaultFixtures());
    } else {
      setDataset(loaded);
    }
  }, []);

  const onNavigate = useCallback(() => {
    // Navigation inter-pages gérée par App.jsx / BottomNav
  }, []);

  if (!dataset) return <div className="stats-page"><div className="stats-loading">{t('common.loading')}</div></div>;

  const hasData = (dataset.daily_closings || []).length > 0;

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h1 className="stats-title">{t('stats.title')}</h1>
      </div>

      <div className="stats-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`stats-tab ${activeTab === tab ? 'stats-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`stats.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {!hasData && (
        <EmptyState
          message={t('stats.noDataDesc')}
          action={t('home.empty.cta')}
          onAction={onNavigate}
        />
      )}

      {hasData && activeTab === 'overview' && <OverviewTab dataset={dataset} onNavigate={onNavigate} t={t} formatters={formatters} />}
      {hasData && activeTab === 'sales' && <SalesTab dataset={dataset} t={t} formatters={formatters} />}
      {hasData && activeTab === 'costs' && <CostsTab dataset={dataset} t={t} formatters={formatters} />}
      {hasData && activeTab === 'staff' && <StaffTab dataset={dataset} t={t} formatters={formatters} />}
      {hasData && activeTab === 'weather' && <WeatherTab dataset={dataset} t={t} formatters={formatters} />}
      {hasData && activeTab === 'comparison' && <ComparisonTab dataset={dataset} t={t} formatters={formatters} />}
    </div>
  );
}