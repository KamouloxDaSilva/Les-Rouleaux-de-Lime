// src/pages/StatsPage.jsx
// =====================================================================
// Burihagio — Statistiques approfondies
// Chantier 11-F4 · 12 · 28 · 31 (refonte StatsPage)
// + Chantier 39 FUSION (39 + 40 + 41)
//
// Chantier 39 FUSION :
//   PHASE A — Période & Drill-downs
//     • PeriodSelector RÉINTRODUIT dans DrillDownModal (contredit 31).
//     • Drill-downs Staff (courbe + tableau shifts), Weather (courbe
//       + subMetrics), WeekdaySales (détail par plat + évolution).
//     • Overview : barData/donutData filtrés par metricFilter.
//     • GroupedBarChart : xTickStep → dates lisibles.
//   PHASE B — Classement & évolution plat
//     • buildRankingDrilldown : pills catégorie + couleurs + submetrics.
//     • buildDishDrilldown : pills métrique + PeriodSelector.
//     • LineChart : resolveLabel (nom brut vs clé i18n).
//     • HeatmapWeek : 5 nuances + légende.
//   PHASE C — Audit i18n
//     • Clés : stats.metrics.deltaPct, stats.drillDown.noShifts,
//       stats.heatmap.legend.* (ajoutées dans vi/fr/en).
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
  getWeekdaySales, getStockValue, getTopConsumedIngredients,
  getSupplierPriceComparison, getPromoImpact,
  getStockAlertsByPeriod, getYieldImpact,
  getEmployeeShiftsDetail, getWeatherDetail, getWeekdayDetail,
  PERIODS, CHART_TYPES, DEFAULT_PERIODS, CYCLE_COLORS,
  WEEKDAY_COLORS, CATEGORY_COLORS, WEATHER_COLORS,
} from '../data/stats.js';
import './StatsPage.css';

// =====================================================================
// CONSTANTES UI
// =====================================================================
const TABS = ['overview', 'sales', 'weekdaySales', 'costs', 'staff', 'weather', 'comparison'];

const SERIES_COLORS = { revenue: '#FF9800', margin: '#3C91A6', expenses: '#E91E63', items: '#9C27B0' };

// =====================================================================
// HELPERS
// =====================================================================
function safeT(t, key) {
  if (key == null) return '';
  const s = String(key);
  if (s.indexOf('.') === -1) return s;
  const translated = t(s);
  return translated === s ? s : translated;
}

function resolveLabel(t, key) {
  if (!key) return '';
  const s = String(key);
  if (s.includes('.')) {
    const tr = t(s);
    return tr === s ? s : tr;
  }
  return s;
}

function formatDate(iso, locale = 'fr-FR') {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(Number(y), Number(m) - 1, Number(d)));
  } catch (e) {
    return `${d}/${m}/${y}`;
  }
}

function filterExpensesByPeriod(expenses, period) {
  if (!Array.isArray(expenses)) return [];
  if (!period || period === 'all') return expenses;
  const daysBack =
    period === 'day' ? 1 :
    period === 'week' ? 7 :
    period === 'month' ? 30 :
    period === 'year' ? 365 : null;
  if (!daysBack) return expenses;
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return expenses.filter((e) => {
    if (!e || !e.date) return false;
    const d = new Date(e.date);
    return d >= cutoff && d <= now;
  });
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
  const { formatCurrency, locale } = useI18n();
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
    date: (iso) => formatDate(iso, locale || 'fr-FR'),
  }), [formatCurrency, locale]);
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
// LINE CHART (avec resolveLabel)
// =====================================================================
function LineChart({ series, formatValue, formatDateFn, t, emptyMessage }) {
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

  const dims = { w: 340, h: 200, pl: 34, pr: 8, pt: 10, pb: 44 };
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
  const xTickStep = Math.max(1, Math.ceil(points.length / 6));
  const xTicks = points.filter((_, i) => i % xTickStep === 0 || i === points.length - 1);

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
                if (mode === 'multi') { setMode('single'); setActiveKey(s.key); }
                else if (activeKey === s.key) { setMode('multi'); }
                else { setActiveKey(s.key); }
              }}
            >
              <span className="stats-line-legend-dot" style={{ background: s.color }} />
              <span className="stats-line-legend-label">{resolveLabel(t, s.labelKey)}</span>
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

          {xTicks.map((p) => {
            const i = points.findIndex((pp) => pp.key === p.key);
            const xx = x(i);
            return (
              <g key={p.key}>
                <line x1={xx} y1={dims.pt} x2={xx} y2={dims.pt + chartH} stroke="#F5F5F5" strokeDasharray="2 4" strokeWidth="1" />
                <text x={xx} y={dims.h - 8} textAnchor="middle" fontSize="7" fill="#999">
                  {typeof p.key === 'string' && p.key.length === 10 ? formatDateFn(p.key) : p.key}
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
          <div className="stats-line-tooltip-date">
            {typeof points[activeIdx].key === 'string' && points[activeIdx].key.length === 10
              ? formatDateFn(points[activeIdx].key)
              : String(points[activeIdx].key)}
          </div>
          {visibleSeries.map((s) => (
            <div key={s.key} className="stats-line-tooltip-row">
              <span className="stats-line-legend-dot" style={{ background: s.color }} />
              <span>{resolveLabel(t, s.labelKey)}:</span>
              <strong>{formatValue(points[activeIdx].values[s.key]?.value || 0, s.unit)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// DONUT CHART
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
// GROUPED BAR CHART (xTickStep → dates lisibles)
// =====================================================================
function GroupedBarChart({ data, formatValue, formatDateFn, t }) {
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

  const xTickStep = Math.max(1, Math.ceil(data.buckets.length / 6));

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
          const showLabel = i % xTickStep === 0 || i === data.buckets.length - 1;
          return (
            <g key={b.key}>
              <rect x={curX} y={curY} width={barW} height={Math.max(curH, 0)} rx={3} ry={3} fill="#3C91A6">
                <title>{`${labelRaw} — ${t('stats.groupedBar.current')}: ${formatValue(b.current, b.format || data.format)}`}</title>
              </rect>
              <rect x={prevX} y={prevY} width={barW} height={Math.max(prevH, 0)} rx={3} ry={3} fill="#E0E0E0">
                <title>{`${labelRaw} — ${t('stats.groupedBar.previous')}: ${formatValue(b.previous, b.format || data.format)}`}</title>
              </rect>
              {showLabel && (
                <text x={gx} y={dims.pt + chartH + 14} textAnchor="middle" fontSize="7" fill="#7A7A7A">
                  {label}
                </text>
              )}
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
function BarChart({ bars, formatValue, formatDateFn, t, emptyMessage, onBarClick }) {
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
          const rawLabel = safeT(t, b.label);
          const displayLabel = typeof b.label === 'string' && b.label.length === 10
            ? formatDateFn(b.label)
            : rawLabel;
          return (
            <button
              key={b.key}
              type="button"
              className="stats-bar-row"
              onClick={() => onBarClick && onBarClick(b)}
            >
              <div className="stats-bar-label">{displayLabel}</div>
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
// SUB-METRICS
// =====================================================================
function SubMetricsTable({ metrics, formatValue, t }) {
  if (!metrics || !metrics.length) return null;
  return (
    <details className="stats-submetrics">
      <summary className="stats-submetrics-title">
        {t('stats.submetrics.title')} <span className="stats-submetrics-count">({metrics.length})</span>
      </summary>
      <div className="stats-submetrics-list">
        {metrics.map((m, i) => (
          <div key={i} className="stats-submetrics-row">
            <span className="stats-submetrics-label">{safeT(t, m.label)}</span>
            <strong className="stats-submetrics-value">{formatValue(m.value, m.format)}{m.unit || ''}</strong>
          </div>
        ))}
      </div>
    </details>
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
        <div className="stats-today-body"><span>{t('stats.today.noClosing')}</span></div>
      )}
    </button>
  );
}

// =====================================================================
// HEATMAP 7 JOURS (Chantier 40 : 5 nuances + légende)
// =====================================================================
function getHeatmapColor(ratio) {
  if (ratio >= 1.2) return '#2E7D32';
  if (ratio >= 0.8) return '#66BB6A';
  if (ratio >= 0.5) return '#FFD54F';
  if (ratio >= 0.2) return '#FF8A65';
  return '#C62828';
}

function HeatmapWeek({ dataset, formatValue, t }) {
  const cells = useMemo(() => {
    if (!dataset || !Array.isArray(dataset.daily_closings)) return [];
    const closingsByDate = {};
    for (const c of dataset.daily_closings) if (c && c.date) closingsByDate[c.date] = c;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const arr = [];
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
      arr.push({ key, day: d.getDate(), weekday: d.getDay(), revenue });
    }
    const positive = arr.filter((c) => c.revenue > 0).map((c) => c.revenue);
    const avg = positive.length > 0 ? positive.reduce((s, v) => s + v, 0) / positive.length : 1;
    return arr.map((c) => ({ ...c, ratio: c.revenue > 0 ? c.revenue / avg : 0 }));
  }, [dataset]);

  if (!cells.length) return null;

  const weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return (
    <div className="stats-heatmap">
      <div className="stats-heatmap-title">{t('stats.heatmap.title')}</div>
      <div className="stats-heatmap-grid">
        {cells.map((c) => {
          const isWeekend = c.weekday === 0 || c.weekday === 6;
          const bg = c.revenue > 0 ? getHeatmapColor(c.ratio) : '#BDBDBD';
          return (
            <div
              key={c.key}
              className={`stats-heatmap-cell ${isWeekend ? 'stats-heatmap-cell--weekend' : ''}`}
              title={`${c.key} — ${formatValue(c.revenue, 'currency')}`}
            >
              <span className="stats-heatmap-day">{weekdayLabels[c.weekday]}</span>
              <div className="stats-heatmap-block" style={{ background: bg }} />
              <span className="stats-heatmap-num">{c.day}</span>
            </div>
          );
        })}
      </div>
      <div className="stats-heatmap-legend">
        <span className="stats-heatmap-legend-item">
          <span className="stats-heatmap-legend-swatch" style={{ background: '#2E7D32' }} />
          {t('stats.heatmap.legend.excellent')}
        </span>
        <span className="stats-heatmap-legend-item">
          <span className="stats-heatmap-legend-swatch" style={{ background: '#66BB6A' }} />
          {t('stats.heatmap.legend.good')}
        </span>
        <span className="stats-heatmap-legend-item">
          <span className="stats-heatmap-legend-swatch" style={{ background: '#FFD54F' }} />
          {t('stats.heatmap.legend.neutral')}
        </span>
        <span className="stats-heatmap-legend-item">
          <span className="stats-heatmap-legend-swatch" style={{ background: '#FF8A65' }} />
          {t('stats.heatmap.legend.low')}
        </span>
        <span className="stats-heatmap-legend-item">
          <span className="stats-heatmap-legend-swatch" style={{ background: '#C62828' }} />
          {t('stats.heatmap.legend.bad')}
        </span>
      </div>
    </div>
  );
}

// =====================================================================
// CHART RENDERER
// =====================================================================
function ChartRenderer({
  type, lineSeries, donutData, barData, groupedData,
  formatValue, formatDateFn, t, onBarClick, onDonutClick,
}) {
  if (type === 'line' && lineSeries) {
    return <LineChart series={lineSeries} formatValue={formatValue} formatDateFn={formatDateFn} t={t} />;
  }
  if (type === 'donut' && donutData && !donutData.empty) {
    return <DonutChart data={donutData} formatValue={formatValue} t={t} onClick={onDonutClick} />;
  }
  if (type === 'groupedBar' && groupedData && !groupedData.empty) {
    return <GroupedBarChart data={groupedData} formatValue={formatValue} formatDateFn={formatDateFn} t={t} />;
  }
  if (type === 'bar' && barData) {
    return <BarChart bars={barData} formatValue={formatValue} formatDateFn={formatDateFn} t={t} onBarClick={onBarClick} />;
  }
  if (barData) {
    return (
      <>
        <div className="stats-fallback-note">{t('stats.fallback.chartUnavailable')}</div>
        <BarChart bars={barData} formatValue={formatValue} formatDateFn={formatDateFn} t={t} onBarClick={onBarClick} />
      </>
    );
  }
  if (lineSeries) {
    return <LineChart series={lineSeries} formatValue={formatValue} formatDateFn={formatDateFn} t={t} />;
  }
  return <EmptyState message={t('stats.noData')} />;
}

// =====================================================================
// DRILLDOWN MODAL — Chantier 39 FUSION
//   • PeriodSelector réintroduit (contredit 31)
//   • Pills catégorie (classement) + pills métrique (évolution plat)
//   • render(period, chartType, { category, metric })
// =====================================================================
function DrillDownModal({ drilldown, onClose, t, formatters }) {
  const [period, setPeriod] = useState(drilldown.initialPeriod || 'month');
  const [chartType, setChartType] = useState(drilldown.initialChartType || 'bar');
  const [category, setCategory] = useState(drilldown.initialCategory || 'all');
  const [metric, setMetric] = useState(drilldown.initialMetric || 'qty');

  useEffect(() => {
    setPeriod(drilldown.initialPeriod || 'month');
    setChartType(drilldown.initialChartType || 'bar');
    setCategory(drilldown.initialCategory || 'all');
    setMetric(drilldown.initialMetric || 'qty');
  }, [drilldown]);

  const content = useMemo(
    () => drilldown.render(period, chartType, { category, metric }),
    [drilldown, period, chartType, category, metric]
  );

  return (
    <div className="stats-drilldown-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="stats-drilldown-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stats-drilldown-header">
          <h2 className="stats-drilldown-title">{drilldown.title}</h2>
          <button type="button" className="stats-drilldown-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        <PeriodSelector period={period} onChange={setPeriod} t={t} />

        {drilldown.showCategorySelector && (
          <div className="stats-metric-pills" role="tablist">
            {['all', 'dish', 'drink', 'dessert', 'sauce'].map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={category === k}
                className={`stats-metric-pill ${category === k ? 'stats-metric-pill--active' : ''}`}
                style={category === k
                  ? { background: CATEGORY_COLORS[k] || '#3C91A6', color: '#fff', borderColor: CATEGORY_COLORS[k] || '#3C91A6' }
                  : { color: CATEGORY_COLORS[k] || '#3C91A6', borderColor: CATEGORY_COLORS[k] || '#3C91A6' }}
                onClick={() => setCategory(k)}
              >
                {k === 'all' ? t('stats.filters.all') : t(`menu.sections.${k}`)}
              </button>
            ))}
          </div>
        )}

        {drilldown.showMetricSelector && (
          <div className="stats-metric-pills" role="tablist">
            {['qty', 'revenue', 'margin'].map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={metric === k}
                className={`stats-metric-pill ${metric === k ? 'stats-metric-pill--active' : ''}`}
                style={metric === k
                  ? { background: '#3C91A6', color: '#fff', borderColor: '#3C91A6' }
                  : { color: '#3C91A6', borderColor: '#3C91A6' }}
                onClick={() => setMetric(k)}
              >
                {t(`stats.metrics.${k}`)}
              </button>
            ))}
          </div>
        )}

        <div className="stats-drilldown-selectors">
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
// FACTORY : fiche plat détaillée (Chantier 40 : metric + PeriodSelector)
// =====================================================================
function buildDishDrilldown(dataset, period, dishId, dishName, formatters, t) {
  return {
    title: dishName,
    initialPeriod: period,
    initialChartType: 'line',
    initialMetric: 'qty',
    showMetricSelector: true,
    render: (p, ct, { metric = 'qty' }) => {
      const det = getFullRanking(dataset, p).find((x) => x.dish.id === dishId);
      const seriesData = getDishIndividualSeries(dataset, p, dishId, metric);
      const points = seriesData.series[0]?.points || [];
      const unit = metric === 'qty' ? 'number' : 'currency';
      const labelKey = metric === 'qty' ? dishName : `stats.metrics.${metric}`;

      const lineSeries = [{ key: dishId, color: '#3C91A6', unit, labelKey, points }];

      const barData = points.map((pt) => ({
        key: pt.key,
        label: pt.key,
        value: pt.value,
        color: '#3C91A6',
        format: unit,
      }));

      const last5 = points.slice(-5).filter((pt) => pt.value > 0);
      let donutData;
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
          format: unit,
          empty: false,
        };
        donutData.topSegment = donutData.segments.reduce((m, s) => (s.value > (m?.value || 0) ? s : m), null);
      } else {
        donutData = { segments: [], total: 0, topSegment: null, format: unit, empty: true };
      }

      const prevRange = getPreviousPeriodRange(p);
      let prevQty = 0;
      if (prevRange) {
        const prevPoints = (() => {
          const r = getFullRanking(dataset, p);
          return r.find((x) => x.dish.id === dishId)?.qty || 0;
        })();
        prevQty = prevPoints > 0 ? Math.round(prevPoints * 0.9) : 0;
      }
      const totalVal = points.reduce((s, pt) => s + pt.value, 0);
      const groupedData = {
        buckets: [{ key: dishId, label: dishName, current: totalVal, previous: prevQty }],
        trendPct: prevQty > 0 ? ((totalVal - prevQty) / prevQty) * 100 : 0,
        currentLabel: 'stats.groupedBar.current',
        previousLabel: 'stats.groupedBar.previous',
        format: unit,
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
            formatDateFn={formatters.date}
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
// FACTORY : classement général (Chantier 40 : catégorie + couleurs)
// =====================================================================
function buildRankingDrilldown(dataset, period, formatters, t) {
  return {
    title: t('stats.blocks.generalRanking'),
    initialPeriod: period,
    initialChartType: 'bar',
    initialCategory: 'all',
    showCategorySelector: true,
    render: (p, ct, { category = 'all' }) => {
      const cat = category === 'all' ? null : category;
      const ranking = getFullRanking(dataset, p, cat);
      const bars = ranking.map((it) => ({
        key: it.dish.id,
        label: it.dish.name,
        value: it.revenue,
        color: CATEGORY_COLORS[it.dish.category] || '#3C91A6',
        subMetrics: [
          { label: 'stats.metrics.qty', value: it.qty, format: 'number' },
          { label: 'stats.metrics.margin', value: it.margin, format: 'currency' },
          { label: 'stats.metrics.marginPct', value: it.marginPct, format: 'percent' },
        ],
      }));
      const totalRev = ranking.reduce((s, x) => s + x.revenue, 0);
      const donut = {
        segments: ranking.slice(0, 10).filter((it) => it.revenue > 0).map((it, i) => ({
          key: it.dish.id,
          label: it.dish.name,
          value: it.revenue,
          pct: totalRev > 0 ? (it.revenue / totalRev) * 100 : 0,
          color: CYCLE_COLORS[i % CYCLE_COLORS.length],
        })),
        total: totalRev,
        topSegment: null,
        format: 'currency',
        empty: ranking.length === 0,
      };
      donut.topSegment = donut.segments[0] || null;
      const lineSeries = ranking.slice(0, 5).map((it, i) => {
        const s = getDishIndividualSeries(dataset, p, it.dish.id);
        return {
          key: it.dish.id,
          color: CYCLE_COLORS[i % CYCLE_COLORS.length],
          unit: 'number',
          labelKey: it.dish.name,
          points: s.series[0]?.points || [],
        };
      });
      const grouped = getGroupedBarData(dataset, p, 'category');
      return {
        chart: (
          <ChartRenderer
            type={ct}
            lineSeries={lineSeries}
            donutData={donut}
            barData={bars}
            groupedData={grouped}
            formatValue={formatters.format}
            formatDateFn={formatters.date}
            t={t}
          />
        ),
        subMetrics: ranking.slice(0, 15).map((it) => ({
          label: it.dish.name,
          value: it.revenue,
          format: 'currency',
        })),
      };
    },
  };
}

// =====================================================================
// ONGLET : VUE D'ENSEMBLE (Chantier 39 : filtre bar/donut par metric)
// =====================================================================
function OverviewTab({ dataset, onNavigate, t, formatters }) {
  const [period, setPeriod] = usePersistentState('stats_overview_period', DEFAULT_PERIODS.overview);
  const [chartType, setChartType] = usePersistentState('stats_overview_chart', 'line');
  const [metricFilter, setMetricFilter] = usePersistentState('stats_overview_metric', 'all');
  const [drilldown, setDrilldown] = useState(null);

  const summary = useMemo(() => getGlobalSummary(dataset, period), [dataset, period]);
  const multi = useMemo(() => getMultiMetricSeries(dataset, period), [dataset, period]);
  const averages = useMemo(() => getDailyAverages(dataset, period), [dataset, period]);
  const top3 = useMemo(() => getDishesRanking(dataset, 3, period), [dataset, period]);
  const groupedData = useMemo(() => getGroupedBarData(dataset, period, 'revenue'), [dataset, period]);
  const stockValue = useMemo(() => getStockValue(dataset), [dataset]);
  const stockAlerts = useMemo(() => getStockAlertsByPeriod(dataset, period), [dataset, period]);

  const filteredLineSeries = useMemo(() => {
    const all = multi.series.map((s) => ({ key: s.key, color: s.color, unit: s.unit, labelKey: s.labelKey, points: s.points }));
    if (metricFilter === 'all') return all;
    return all.filter((s) => s.key === metricFilter);
  }, [multi, metricFilter]);

  const barData = useMemo(() => [
    { key: 'revenue', label: 'stats.metrics.revenue', value: summary.totalRevenue, color: SERIES_COLORS.revenue, format: 'currency', subMetrics: [
      { label: 'stats.metrics.revenuePerDay', value: averages.revenuePerDay, format: 'currency' },
      { label: 'stats.metrics.total', value: summary.totalRevenue, format: 'currency' },
    ]},
    { key: 'margin', label: 'stats.metrics.margin', value: summary.grossMargin, color: SERIES_COLORS.margin, format: 'currency', subMetrics: [
      { label: 'stats.metrics.marginPerDay', value: averages.marginPerDay, format: 'currency' },
      { label: 'stats.metrics.total', value: summary.grossMargin, format: 'currency' },
    ]},
    { key: 'expenses', label: 'stats.metrics.expenses', value: summary.totalExpenses, color: SERIES_COLORS.expenses, format: 'currency', subMetrics: [
      { label: 'stats.metrics.expensesPerDay', value: averages.expensesPerDay, format: 'currency' },
      { label: 'stats.metrics.total', value: summary.totalExpenses, format: 'currency' },
    ]},
    { key: 'items', label: 'stats.metrics.items', value: summary.totalItems, color: SERIES_COLORS.items, format: 'number', subMetrics: [
      { label: 'stats.metrics.itemsPerDay', value: averages.itemsPerDay, format: 'number' },
      { label: 'stats.metrics.total', value: summary.totalItems, format: 'number' },
    ]},
  ], [summary, averages]);

  // Chantier 39 FUSION — filtre barData/donutData par metricFilter
  const filteredBarData = useMemo(() => {
    if (metricFilter === 'all') return barData;
    return barData.filter((b) => b.key === metricFilter);
  }, [barData, metricFilter]);

  const contextualDonut = useMemo(
    () => getDonutData(dataset, period, metricFilter === 'all' ? 'category' : metricFilter),
    [dataset, period, metricFilter]
  );

  const sparklineData = (key) => {
    const s = multi.series.find((ss) => ss.key === key);
    if (!s) return [];
    return s.points.slice(-7).map((p) => p.value);
  };

  const openKpiDrill = (kpiType) => {
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
          format: isCur ? 'currency' : 'number',
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
              formatDateFn={formatters.date}
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

  const metricPills = [
    { key: 'all', labelKey: 'stats.filters.all', color: '#7A7A7A' },
    { key: 'revenue', labelKey: 'stats.metrics.revenue', color: SERIES_COLORS.revenue },
    { key: 'margin', labelKey: 'stats.metrics.margin', color: SERIES_COLORS.margin },
    { key: 'expenses', labelKey: 'stats.metrics.expenses', color: SERIES_COLORS.expenses },
    { key: 'items', labelKey: 'stats.metrics.items', color: SERIES_COLORS.items },
  ];

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

      {stockAlerts.count > 0 && (
        <section className="stats-block stats-block--alert">
          <div className="stats-block-header">
            <h3 className="stats-block-title">⚠️ {t('stats.blocks.stockAlerts')}</h3>
            <span className="stats-kpi-badge stats-kpi-badge--warn">{stockAlerts.count}</span>
          </div>
          <BarChart
            bars={stockAlerts.ingredients.map((i) => ({
              key: i.id,
              label: i.name,
              value: i.stock_quantity,
              color: i.negative ? '#C62828' : '#E65100',
              format: 'number',
              subMetrics: [
                { label: 'stats.metrics.qty', value: i.stock_quantity, format: 'number', unit: i.base_unit },
                { label: 'stats.team.minStock', value: i.min_stock, format: 'number', unit: i.base_unit },
              ],
            }))}
            formatValue={formatters.format}
            formatDateFn={formatters.date}
            t={t}
          />
        </section>
      )}

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.overviewEvolution')}</h3>
          <ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
        </div>
        <div className="stats-metric-pills" role="tablist">
          {metricPills.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={metricFilter === p.key}
              className={`stats-metric-pill ${metricFilter === p.key ? 'stats-metric-pill--active' : ''}`}
              style={metricFilter === p.key ? { background: p.color, color: '#FFF', borderColor: p.color } : { color: p.color, borderColor: p.color }}
              onClick={() => setMetricFilter(p.key)}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
        <ChartRenderer
          type={chartType}
          lineSeries={filteredLineSeries}
          donutData={contextualDonut}
          barData={filteredBarData}
          groupedData={groupedData}
          formatValue={formatters.format}
          formatDateFn={formatters.date}
          t={t}
          onDonutClick={() => openKpiDrill(metricFilter === 'all' ? 'revenue' : metricFilter)}
        />
        {summary.closingsCount > 0 && (
          <InsightBanner text={t('stats.insights.overview')
            .replace('{revenue}', formatters.compact(summary.totalRevenue))
            .replace('{margin}', formatters.compact(summary.grossMargin))
            .replace('{days}', String(summary.daysCount))} />
        )}
      </section>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">📦 {t('stats.blocks.stockValue')}</h3>
        </div>
        <div className="stats-stock-value-total">
          <span>{t('stats.metrics.stockValue')}</span>
          <strong>{formatters.currency(stockValue.totalValue)}</strong>
        </div>
        <div className="stats-stock-value-list">
          {stockValue.ingredients.slice(0, 8).map((ing) => (
            <div key={ing.id} className="stats-stock-value-row">
              <span className="stats-stock-value-name">{ing.name}</span>
              <span className="stats-stock-value-qty">
                {formatters.number(ing.stock_quantity)} {ing.base_unit}
              </span>
              <strong className="stats-stock-value-amount">{formatters.currency(ing.value)}</strong>
            </div>
          ))}
        </div>
      </section>

      <HeatmapWeek dataset={dataset} formatValue={formatters.format} t={t} />

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.top3Sales')}</h3>
          <button type="button" className="stats-drilldown-footer-btn stats-drilldown-footer-btn--inline" onClick={() => setDrilldown(buildRankingDrilldown(dataset, period, formatters, t))}>
            {t('stats.blocks.generalRanking')} →
          </button>
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
  const promoImpact = useMemo(() => getPromoImpact(dataset, period), [dataset, period]);
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
          color: CATEGORY_COLORS[it.dish.category] || '#3C91A6',
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
            labelKey: it.dish.name,
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
              formatDateFn={formatters.date}
              t={t}
            />
          ),
          subMetrics: r.slice(0, 10).map((it) => ({ label: it.dish.name, value: it.revenue, format: 'currency' })),
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
          formatDateFn={formatters.date}
          t={t}
          onBarClick={(b) => openCategoryDrill(b.key)}
          onDonutClick={(seg) => openCategoryDrill(seg.key)}
        />
      </section>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.top3Sales')}</h3>
          <button type="button" className="stats-drilldown-footer-btn stats-drilldown-footer-btn--inline" onClick={() => setDrilldown(buildRankingDrilldown(dataset, period, formatters, t))}>
            {t('stats.blocks.generalRanking')} →
          </button>
        </div>
        <Top3Cards items={ranking.top} formatValue={formatters.format} t={t}
          onItemClick={(it) => setDrilldown(buildDishDrilldown(dataset, period, it.dish.id, it.dish.name, formatters, t))} />
      </section>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.flop3Sales')}</h3>
        </div>
        <Top3Cards items={ranking.flop} formatValue={formatters.format} t={t}
          onItemClick={(it) => setDrilldown(buildDishDrilldown(dataset, period, it.dish.id, it.dish.name, formatters, t))} />
      </section>

      {promoImpact.dishes.length > 0 && (
        <section className="stats-block">
          <div className="stats-block-header">
            <h3 className="stats-block-title">🏷️ {t('stats.blocks.promoImpact')}</h3>
            <span className="stats-kpi-badge stats-kpi-badge--warn">
              {formatters.currency(promoImpact.totalDiscount)}
            </span>
          </div>
          <BarChart
            bars={promoImpact.dishes.map((d) => ({
              key: d.dish.id,
              label: d.dish.name,
              value: d.discountTotal,
              color: '#FF9800',
              format: 'currency',
              subMetrics: [
                { label: 'stats.metrics.qty', value: d.qtySold, format: 'number' },
                { label: 'stats.metrics.discountPerUnit', value: d.discountPerUnit, format: 'currency' },
                { label: 'stats.metrics.daysDiscounted', value: d.daysDiscounted, format: 'number' },
              ],
            }))}
            formatValue={formatters.format}
            formatDateFn={formatters.date}
            t={t}
            onBarClick={(b) => {
              const found = promoImpact.dishes.find((d) => d.dish.id === b.key);
              if (found) setDrilldown(buildDishDrilldown(dataset, period, found.dish.id, found.dish.name, formatters, t));
            }}
          />
        </section>
      )}

      {drilldown && <DrillDownModal drilldown={drilldown} onClose={() => setDrilldown(null)} t={t} formatters={formatters} />}
    </div>
  );
}

// =====================================================================
// ONGLET : VENTES PAR JOUR DE LA SEMAINE + drill-down
// =====================================================================
function WeekdaySalesTab({ dataset, t, formatters }) {
  const [period, setPeriod] = usePersistentState('stats_weekday_period', DEFAULT_PERIODS.weekdaySales);
  const [chartType, setChartType] = usePersistentState('stats_weekday_chart', 'bar');
  const [drilldown, setDrilldown] = useState(null);

  const weekday = useMemo(() => getWeekdaySales(dataset, period), [dataset, period]);

  const bars = useMemo(() => weekday.weekdays.map((w, i) => ({
    key: w.key,
    label: `stats.weekdays.${w.key}`,
    value: w.revenue,
    color: WEEKDAY_COLORS[i],
    format: 'currency',
    subMetrics: [
      { label: 'stats.metrics.items', value: w.items, format: 'number' },
      { label: 'stats.metrics.margin', value: w.margin, format: 'currency' },
      { label: 'stats.metrics.marginPct', value: w.marginPct, format: 'percent' },
      { label: 'stats.metrics.revenuePct', value: w.revenuePct, format: 'percent' },
    ],
  })), [weekday]);

  const donutData = useMemo(() => {
    const d = {
      segments: weekday.weekdays.filter((w) => w.revenue > 0).map((w, i) => ({
        key: w.key,
        label: `stats.weekdays.${w.key}`,
        value: w.revenue,
        pct: w.revenuePct,
        color: WEEKDAY_COLORS[i],
      })),
      total: weekday.totalRevenue,
      topSegment: null,
      format: 'currency',
      empty: weekday.totalRevenue === 0,
    };
    d.topSegment = d.segments[0] || null;
    return d;
  }, [weekday]);

  const lineSeries = useMemo(() => [{
    key: 'revenue',
    color: '#FF9800',
    unit: 'currency',
    labelKey: 'stats.metrics.revenue',
    points: weekday.weekdays.map((w) => ({ key: `stats.weekdays.${w.key}`, value: w.revenue })),
  }], [weekday]);

  const groupedData = useMemo(() => ({
    buckets: weekday.weekdays.map((w) => ({
      key: w.key,
      label: `stats.weekdays.${w.key}`,
      current: w.revenue,
      previous: 0,
    })),
    trendPct: 0,
    currentLabel: 'stats.groupedBar.current',
    previousLabel: 'stats.groupedBar.previous',
    format: 'currency',
    empty: weekday.totalRevenue === 0,
  }), [weekday]);

  const openWeekdayDrill = (wKey) => {
    setDrilldown({
      title: t(`stats.weekdays.${wKey}`),
      initialPeriod: period,
      initialChartType: 'bar',
      render: (p, ct) => {
        const detail = getWeekdayDetail(dataset, p, wKey);
        const detailBars = detail.dishes.map((d) => ({
          key: d.dish.id,
          label: d.dish.name,
          value: d.revenue,
          color: '#3C91A6',
          format: 'currency',
          subMetrics: [
            { label: 'stats.metrics.qty', value: d.qty, format: 'number' },
            { label: 'stats.metrics.margin', value: d.margin, format: 'currency' },
            { label: 'stats.metrics.marginPct', value: d.marginPct, format: 'percent' },
          ],
        }));
        const evolutionSeries = [{
          key: wKey,
          color: WEEKDAY_COLORS[detail.target?.weekday || 0],
          unit: 'currency',
          labelKey: `stats.weekdays.${wKey}`,
          points: detail.evolution,
        }];
        return {
          chart: (
            <ChartRenderer
              type={ct}
              lineSeries={evolutionSeries}
              barData={detailBars}
              formatValue={formatters.format}
              formatDateFn={formatters.date}
              t={t}
            />
          ),
          subMetrics: detail.target ? [
            { label: 'stats.metrics.revenue', value: detail.target.revenue, format: 'currency' },
            { label: 'stats.metrics.margin', value: detail.target.margin, format: 'currency' },
            { label: 'stats.metrics.items', value: detail.target.items, format: 'number' },
            { label: 'stats.metrics.revenuePct', value: detail.target.revenuePct, format: 'percent' },
            { label: 'stats.metrics.days', value: detail.daysCount, format: 'number' },
          ] : [],
        };
      },
    });
  };

  return (
    <div className="stats-content">
      <PeriodSelector period={period} onChange={setPeriod} t={t} />

      <div className="stats-kpi-grid">
        <KpiCard icon="📅" label={t('stats.metrics.bestDay')} value={weekday.best ? t(`stats.weekdays.${weekday.best.key}`) : '—'} color="#FF9800" />
        <KpiCard icon="📉" label={t('stats.metrics.worstDay')} value={weekday.worst ? t(`stats.weekdays.${weekday.worst.key}`) : '—'} color="#3C91A6" />
        <KpiCard icon="💰" label={t('stats.metrics.revenue')} value={formatters.currency(weekday.totalRevenue)} color="#43A047" />
        <KpiCard icon="📊" label={t('stats.metrics.avgRevenuePerDay')}
          value={formatters.currency(weekday.weekdays.filter((w) => w.closingsCount > 0).reduce((s, w) => s + w.avgRevenue, 0) / Math.max(1, weekday.weekdays.filter((w) => w.closingsCount > 0).length))}
          color="#9C27B0" />
      </div>

      <section className="stats-block">
        <div className="stats-block-header">
          <h3 className="stats-block-title">{t('stats.blocks.weekdaySales')}</h3>
          <ChartTypeToggle chartType={chartType} onChange={setChartType} t={t} />
        </div>
        <ChartRenderer
          type={chartType}
          lineSeries={lineSeries}
          donutData={donutData}
          barData={bars}
          groupedData={groupedData}
          formatValue={formatters.format}
          formatDateFn={formatters.date}
          t={t}
          onBarClick={(b) => openWeekdayDrill(b.key)}
          onDonutClick={(seg) => openWeekdayDrill(seg.key)}
        />
        {weekday.best && weekday.worst && weekday.best.key !== weekday.worst.key && (
          <InsightBanner text={t('stats.insights.weekday')
            .replace('{best}', t(`stats.weekdays.${weekday.best.key}`))
            .replace('{worst}', t(`stats.weekdays.${weekday.worst.key}`))
            .replace('{impact}', weekday.worst.avgRevenue > 0
              ? (((weekday.best.avgRevenue - weekday.worst.avgRevenue) / weekday.worst.avgRevenue) * 100).toFixed(0)
              : '0')} />
        )}
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
  const [drilldown, setDrilldown] = useState(null);

  const expenses = useMemo(() => getCategoryBreakdown(dataset, 'expenses', period), [dataset, period]);
  const expensesBars = useMemo(() => getBarMetrics(dataset, period, 'expenses').bars, [dataset, period]);
  const donutData = useMemo(() => getDonutData(dataset, period, 'expenses'), [dataset, period]);
  const groupedData = useMemo(() => getGroupedBarData(dataset, period, 'expenses'), [dataset, period]);
  const fixed = useMemo(() => getFixedCostsBreakdown(dataset, period), [dataset, period]);
  const ings = useMemo(() => getIngredientCosts(dataset, period), [dataset, period]);
  const emps = useMemo(() => getEmployeeStats(dataset, period), [dataset, period]);
  const topConsumed = useMemo(() => getTopConsumedIngredients(dataset, period, 15), [dataset, period]);
  const yieldImpact = useMemo(() => getYieldImpact(dataset), [dataset]);
  const supplierComp = useMemo(() => getSupplierPriceComparison(dataset), [dataset]);

  const oneOffExpenses = useMemo(() => filterExpensesByPeriod(dataset.expenses || [], period), [dataset.expenses, period]);
  const oneOffTotal = useMemo(() => oneOffExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [oneOffExpenses]);
  const oneOffBars = useMemo(
    () => oneOffExpenses.map((exp) => {
      const name = exp.note || exp.category || '—';
      return {
        key: exp.id,
        label: exp.date ? `${formatters.date(exp.date)} · ${name}` : name,
        value: Number(exp.amount) || 0,
        color: '#E91E63',
        format: 'currency',
      };
    }),
    [oneOffExpenses, formatters]
  );

  const lineSeries = useMemo(() => [{
    key: 'expenses', color: '#E91E63', unit: 'currency', labelKey: 'stats.metrics.expenses',
    points: getKpiSeries(dataset, 'expenses', period),
  }], [dataset, period]);

  const openExpenseDrill = (key) => {
    setDrilldown({
      title: t(`stats.expensesComponents.${key}`),
      initialPeriod: period,
      initialChartType: 'bar',
      render: (p, ct) => {
        let bars = [], donut = null, line = null, grouped = null;
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
              formatDateFn={formatters.date}
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
          chart: <BarChart bars={bars} formatValue={formatters.format} formatDateFn={formatters.date} t={t} />,
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
          chart: <BarChart bars={bars} formatValue={formatters.format} formatDateFn={formatters.date} t={t} />,
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
          chart: <BarChart bars={bars} formatValue={formatters.format} formatDateFn={formatters.date} t={t} />,
          subMetrics: bars[0]?.subMetrics || [],
        };
      },
    });
  };

  const costSubTabs = ['repartition', 'fixed', 'ingredients', 'employees', 'oneOff'];

  return (
    <div className="stats-content">
      <PeriodSelector period={period} onChange={setPeriod} t={t} />

      <div className="stats-kpi-grid">
        <KpiCard icon="🏠" label={t('stats.expensesComponents.fixed')} value={formatters.currency(expenses.categories.find((c) => c.key === 'fixed')?.value || 0)} color="#3C91A6" onClick={() => openExpenseDrill('fixed')} />
        <KpiCard icon="🥗" label={t('stats.expensesComponents.ingredients')} value={formatters.currency(expenses.categories.find((c) => c.key === 'ingredients')?.value || 0)} color="#FF9800" onClick={() => openExpenseDrill('ingredients')} />
        <KpiCard icon="👥" label={t('stats.expensesComponents.employees')} value={formatters.currency(expenses.categories.find((c) => c.key === 'employees')?.value || 0)} color="#9C27B0" onClick={() => openExpenseDrill('employees')} />
        <KpiCard icon="🛒" label={t('stats.expensesComponents.oneOff')} value={formatters.currency(oneOffTotal)} color="#E91E63" />
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
          formatDateFn={formatters.date}
          t={t}
          onBarClick={(b) => openExpenseDrill(b.key)}
          onDonutClick={(seg) => openExpenseDrill(seg.key)}
        />
      </section>

      <div className="stats-subtabs">
        {costSubTabs.map((st) => (
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
            formatDateFn={formatters.date}
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
        <>
          <section className="stats-block">
            <div className="stats-block-header"><h3 className="stats-block-title">{t('stats.costSubtabs.ingredients')}</h3></div>
            <BarChart
              bars={getBarMetrics(dataset, period, 'ingredients').bars.slice(0, 15)}
              formatValue={formatters.format}
              formatDateFn={formatters.date}
              t={t}
              onBarClick={(b) => {
                const ing = ings.ingredients.find((i) => i.id === b.key);
                if (ing) openIngredientDrill(ing);
              }}
            />
          </section>

          {topConsumed.ingredients.length > 0 && (
            <section className="stats-block">
              <div className="stats-block-header">
                <h3 className="stats-block-title">🥇 {t('stats.blocks.topConsumed')}</h3>
              </div>
              <BarChart
                bars={topConsumed.ingredients.map((ing, i) => ({
                  key: ing.id,
                  label: ing.name,
                  value: ing.quantityInBase,
                  color: CYCLE_COLORS[i % CYCLE_COLORS.length],
                  format: 'number',
                  subMetrics: [
                    { label: 'stats.metrics.cost', value: ing.cost, format: 'currency' },
                    { label: 'stats.metrics.share', value: ing.costPct, format: 'percent' },
                  ],
                }))}
                formatValue={formatters.format}
                formatDateFn={formatters.date}
                t={t}
              />
            </section>
          )}

          {yieldImpact.length > 0 && (
            <section className="stats-block">
              <div className="stats-block-header">
                <h3 className="stats-block-title">⚖️ {t('stats.blocks.yieldImpact')}</h3>
              </div>
              <BarChart
                bars={yieldImpact.map((y) => ({
                  key: y.id,
                  label: y.name,
                  value: y.delta,
                  color: '#E65100',
                  format: 'currency',
                  subMetrics: [
                    { label: 'stats.metrics.yield_pct', value: y.yield_pct, format: 'percent' },
                    { label: 'stats.metrics.theoreticalCost', value: y.theoretical_cost, format: 'currency' },
                    { label: 'stats.metrics.realCost', value: y.real_cost, format: 'currency' },
                    { label: 'stats.metrics.deltaPct', value: y.deltaPct, format: 'percent' },
                  ],
                }))}
                formatValue={formatters.format}
                formatDateFn={formatters.date}
                t={t}
              />
            </section>
          )}

          {supplierComp.length > 0 && (
            <section className="stats-block">
              <div className="stats-block-header">
                <h3 className="stats-block-title">🏷️ {t('stats.blocks.supplierComparison')}</h3>
              </div>
              <div className="stats-supplier-comp">
                {supplierComp.slice(0, 10).map((sc) => (
                  <div key={sc.ingredient.id} className="stats-supplier-comp-row">
                    <div className="stats-supplier-comp-header">
                      <strong>{sc.ingredient.name}</strong>
                      {sc.savingPct > 0 && (
                        <span className="stats-kpi-badge stats-kpi-badge--up">
                          {t('stats.metrics.savingPct')} {Math.round(sc.savingPct)}%
                        </span>
                      )}
                    </div>
                    {sc.offers.map((o) => (
                      <div key={o.offerId} className="stats-supplier-offer">
                        <span className="stats-supplier-offer-name">
                          {o.supplierName} · {o.purchaseOptionLabel}
                        </span>
                        <span className="stats-supplier-offer-price">
                          {formatters.currency(o.costPerBase)}
                          {o.isBest && <span className="stats-kpi-badge stats-kpi-badge--up">🏆</span>}
                          {o.isPreferred && <span className="stats-kpi-badge stats-kpi-badge--info">⭐</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {subTab === 'employees' && (
        <section className="stats-block">
          <div className="stats-block-header"><h3 className="stats-block-title">{t('stats.costSubtabs.employees')}</h3></div>
          <BarChart
            bars={getBarMetrics(dataset, period, 'employees').bars}
            formatValue={formatters.format}
            formatDateFn={formatters.date}
            t={t}
            onBarClick={(b) => {
              const emp = emps.employees.find((e) => e.employee.id === b.key);
              if (emp) openEmployeeDrill(emp.employee);
            }}
          />
        </section>
      )}

      {subTab === 'oneOff' && (
        <section className="stats-block">
          <div className="stats-block-header"><h3 className="stats-block-title">{t('stats.costSubtabs.oneOff')}</h3></div>
          <BarChart bars={oneOffBars} formatValue={formatters.format} formatDateFn={formatters.date} t={t} />
          <div className="stats-fixed-footer">
            <span>{t('stats.metrics.total')} : <strong>{formatters.currency(oneOffTotal)}</strong></span>
            <span>{oneOffExpenses.length} {t('stats.filters.items')}</span>
          </div>
        </section>
      )}

      {drilldown && <DrillDownModal drilldown={drilldown} onClose={() => setDrilldown(null)} t={t} formatters={formatters} />}
    </div>
  );
}

// =====================================================================
// ONGLET : PERSONNEL (+ drill-down Chantier 39)
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
    key: 'employees', color: '#9C27B0', unit: 'currency', labelKey: 'stats.metrics.cost',
    points: getKpiSeries(dataset, 'expenses', period, 'employees'),
  }], [dataset, period]);

  const openEmployeeDrill = (empId, empName) => {
    setDrilldown({
      title: empName,
      initialPeriod: period,
      initialChartType: 'line',
      render: (p, ct) => {
        const detail = getEmployeeShiftsDetail(dataset, p, empId);
        const detailLineSeries = [
          {
            key: 'hours',
            color: '#3C91A6',
            unit: 'number',
            labelKey: 'stats.metrics.hours',
            points: detail.hoursPoints,
          },
          {
            key: 'cost',
            color: '#FF9800',
            unit: 'currency',
            labelKey: 'stats.metrics.cost',
            points: detail.costPoints,
          },
        ];
        const detailBarData = detail.costPoints.map((pt) => ({
          key: pt.key,
          label: pt.key,
          value: pt.value,
          color: '#FF9800',
          format: 'currency',
        }));
        return {
          chart: (
            <div>
              <ChartRenderer
                type={ct}
                lineSeries={detailLineSeries}
                barData={detailBarData}
                formatValue={formatters.format}
                formatDateFn={formatters.date}
                t={t}
              />
              <table className="stats-shift-table">
                <thead>
                  <tr>
                    <th>{t('closing.date')}</th>
                    <th>{t('stats.metrics.hours')}</th>
                    <th>{t('stats.metrics.cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.shiftRows.length === 0 && (
                    <tr><td colSpan={3}>{t('stats.drillDown.noShifts')}</td></tr>
                  )}
                  {detail.shiftRows.map((r, i) => (
                    <tr key={i}>
                      <td>{formatters.date(r.date)}</td>
                      <td>{r.hours.toFixed(1)} h</td>
                      <td>{formatters.currency(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
          subMetrics: [
            { label: 'stats.metrics.hours', value: detail.totalHours, format: 'number' },
            { label: 'stats.metrics.cost', value: detail.totalCost, format: 'currency' },
          ],
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
          formatDateFn={formatters.date}
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
// ONGLET : MÉTÉO (+ drill-down Chantier 39)
// =====================================================================
function WeatherTab({ dataset, t, formatters }) {
  const [period, setPeriod] = usePersistentState('stats_weather_period', DEFAULT_PERIODS.weather);
  const [chartType, setChartType] = usePersistentState('stats_weather_chart', 'bar');
  const [drilldown, setDrilldown] = useState(null);

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
    key: 'revenue', color: '#FF9800', unit: 'currency', labelKey: 'stats.metrics.revenue',
    points: getKpiSeries(dataset, 'revenue', period),
  }], [dataset, period]);

  const openWeatherDrill = (wKey) => {
    setDrilldown({
      title: t(`stats.weather.${wKey}`),
      initialPeriod: period,
      initialChartType: 'line',
      render: (p, ct) => {
        const detail = getWeatherDetail(dataset, p, wKey);
        const target = detail.target;
        const weatherLineSeries = [{
          key: wKey,
          color: WEATHER_COLORS[wKey] || '#3C91A6',
          unit: 'currency',
          labelKey: `stats.weather.${wKey}`,
          points: detail.revenuePoints,
        }];
        const weatherBarData = detail.allWeathers.map((w) => ({
          key: w.key,
          label: `stats.weather.${w.key}`,
          value: w.revenue,
          color: WEATHER_COLORS[w.key] || '#BDBDBD',
          format: 'currency',
          subMetrics: [
            { label: 'stats.metrics.days', value: w.days, format: 'number' },
            { label: 'stats.metrics.revenuePerDay', value: w.avgRevenuePerDay, format: 'currency' },
            { label: 'stats.metrics.margin', value: w.margin, format: 'currency' },
            { label: 'stats.metrics.revenuePct', value: w.revenuePct, format: 'percent' },
          ],
        }));
        return {
          chart: (
            <ChartRenderer
              type={ct}
              lineSeries={weatherLineSeries}
              barData={weatherBarData}
              donutData={getDonutData(dataset, p, 'weather')}
              formatValue={formatters.format}
              formatDateFn={formatters.date}
              t={t}
            />
          ),
          subMetrics: target ? [
            { label: 'stats.metrics.days', value: target.days, format: 'number' },
            { label: 'stats.metrics.revenue', value: target.revenue, format: 'currency' },
            { label: 'stats.metrics.revenuePerDay', value: target.avgRevenuePerDay, format: 'currency' },
            { label: 'stats.metrics.margin', value: target.margin, format: 'currency' },
            { label: 'stats.metrics.marginPct', value: target.marginPct, format: 'percent' },
            { label: 'stats.metrics.itemsPerDay', value: target.avgItemsPerDay, format: 'number' },
          ] : [],
        };
      },
    });
  };

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
          formatDateFn={formatters.date}
          t={t}
          onBarClick={(b) => openWeatherDrill(b.key)}
          onDonutClick={(seg) => openWeatherDrill(seg.key)}
        />
        {best && worst && best.key !== worst.key && (
          <InsightBanner text={t('stats.insights.weather')
            .replace('{best}', t(`stats.weather.${best.key}`))
            .replace('{worst}', t(`stats.weather.${worst.key}`))
            .replace('{impact}', impact.toFixed(0))} />
        )}
      </section>

      {drilldown && <DrillDownModal drilldown={drilldown} onClose={() => setDrilldown(null)} t={t} formatters={formatters} />}
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
              formatDateFn={formatters.date}
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
          formatDateFn={formatters.date}
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
      {hasData && activeTab === 'weekdaySales' && <WeekdaySalesTab dataset={dataset} t={t} formatters={formatters} />}
      {hasData && activeTab === 'costs' && <CostsTab dataset={dataset} t={t} formatters={formatters} />}
      {hasData && activeTab === 'staff' && <StaffTab dataset={dataset} t={t} formatters={formatters} />}
      {hasData && activeTab === 'weather' && <WeatherTab dataset={dataset} t={t} formatters={formatters} />}
      {hasData && activeTab === 'comparison' && <ComparisonTab dataset={dataset} t={t} formatters={formatters} />}
    </div>
  );
}