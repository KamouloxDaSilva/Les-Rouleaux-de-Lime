// src/pages/StatsPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { loadDataset } from '../data/storage.js';
import { getActiveRestaurant } from '../data/model.js';
import { getRevenueSeries, getDishesRanking, getGlobalSummary } from '../data/stats.js';
import './StatsPage.css';

const PERIODS = ['week', 'month', 'year'];

const LOCALE_MAP = { vi: 'vi-VN', fr: 'fr-FR', en: 'en-US' };

function RevenueChart({ series, period, locale, label, emptyLabel }) {
  const width = 320;
  const height = 150;
  const padTop = 16;
  const padBottom = 22;
  const chartHeight = height - padTop - padBottom;
  const max = Math.max(0, ...series.map((s) => s.revenue));

  if (max <= 0) {
    return <div className="stats-chart-empty">{emptyLabel}</div>;
  }

  const labelStep = period === 'week' ? 1 : period === 'year' ? 1 : 5;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="stats-chart-svg" role="img" aria-label={label}>
      <defs>
        <linearGradient id="statsBarGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF9800" />
          <stop offset="100%" stopColor="#3C91A6" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((frac) => (
        <line
          key={frac}
          x1={0}
          x2={width}
          y1={padTop + chartHeight * frac}
          y2={padTop + chartHeight * frac}
          stroke="#E6D9BE"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      ))}
      {series.map((point, i) => {
        const slot = width / series.length;
        const barW = Math.max(4, slot * 0.65);
        const x = slot * i + (slot - barW) / 2;
        const h = max > 0 ? (point.revenue / max) * chartHeight : 0;
        const y = padTop + chartHeight - h;
        return (
          <rect
            key={point.key}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={Math.min(4, barW / 2)}
            fill="url(#statsBarGradient)"
          />
        );
      })}
      {series.map((point, i) => {
        if (i % labelStep !== 0) return null;
        const slot = width / series.length;
        const x = slot * i + slot / 2;
        const labelText =
          period === 'year'
            ? point.date.toLocaleDateString(locale, { month: 'short' })
            : String(point.date.getDate());
        return (
          <text
            key={point.key}
            x={x}
            y={height - 6}
            textAnchor="middle"
            fontSize={10}
            fill="#7A7A7A"
          >
            {labelText}
          </text>
        );
      })}
    </svg>
  );
}

function marginClass(pct) {
  if (pct >= 60) return 'is-good';
  if (pct >= 30) return 'is-warn';
  return 'is-bad';
}

export default function StatsPage() {
  const { t, formatCurrency, lang } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    setDataset(loadDataset());
  }, []);

  const locale = LOCALE_MAP[lang] || 'vi-VN';

  const series = useMemo(() => (dataset ? getRevenueSeries(dataset, period) : []), [dataset, period]);
  const ranking = useMemo(
    () => (dataset ? getDishesRanking(dataset, 5) : { top: [], flop: [] }),
    [dataset]
  );
  const summary = useMemo(() => (dataset ? getGlobalSummary(dataset) : null), [dataset]);
  const restaurant = useMemo(() => (dataset ? getActiveRestaurant(dataset) : null), [dataset]);

  if (!dataset || !summary || !restaurant) {
    return <div className="stats-page">{t('common.loading')}</div>;
  }

  if (summary.dayCount === 0) {
    return (
      <div className="stats-page">
        <h1 className="stats-title">{t('stats.title')}</h1>
        <div className="card stats-empty">
          <div className="stats-empty-icon">📊</div>
          <h2>{t('stats.noData')}</h2>
          <p>{t('stats.noDataDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-page">
      <h1 className="stats-title">{t('stats.title')}</h1>

      <div className="stats-period-tabs" role="tablist">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            className={`stats-period-tab ${period === p ? 'is-active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {t(`stats.periods.${p}`)}
          </button>
        ))}
      </div>

      <section className="card stats-chart-card">
        <h2 className="stats-section-title">{t('stats.chartTitle')}</h2>
        <RevenueChart
          series={series}
          period={period}
          locale={locale}
          label={t('stats.chartTitle')}
          emptyLabel={t('stats.noChartData')}
        />
      </section>

      <section className="stats-kpis">
        <div className="kpi-card kpi-card--orange">
          <span className="kpi-label">{t('stats.summary.revenue')}</span>
          <strong className="kpi-value">{formatCurrency(summary.totalRevenue)}</strong>
        </div>
        <div className="kpi-card kpi-card--blue">
          <span className="kpi-label">{t('stats.summary.margin')}</span>
          <strong className="kpi-value">{formatCurrency(summary.margin)}</strong>
          <span className="kpi-sub">{summary.marginPct.toFixed(0)}%</span>
        </div>
        <div className="kpi-card kpi-card--cream">
          <span className="kpi-label">{t('stats.summary.foodCostPct')}</span>
          <strong className="kpi-value">{summary.foodCostPct.toFixed(0)}%</strong>
        </div>
        <div className="kpi-card kpi-card--cream">
          <span className="kpi-label">{t('stats.summary.avgTicket')}</span>
          <strong className="kpi-value">{formatCurrency(summary.avgTicket)}</strong>
        </div>
      </section>

      <section className="card stats-details">
        <h2 className="stats-section-title">{t('stats.summary.title')}</h2>
        <dl className="stats-details-list">
          <div>
            <dt>{t('stats.summary.days')}</dt>
            <dd>{summary.dayCount}</dd>
          </div>
          <div>
            <dt>{t('stats.summary.avgDaily')}</dt>
            <dd>{formatCurrency(summary.avgDailyRevenue)}</dd>
          </div>
          <div>
            <dt>{t('stats.summary.monthlyFixedCosts')}</dt>
            <dd>{formatCurrency(summary.monthlyFixedCosts)}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2 className="stats-section-title">{t('stats.topTitle')}</h2>
        {ranking.top.length === 0 ? (
          <p className="stats-list-empty">—</p>
        ) : (
          <ul className="ranking-list">
            {ranking.top.map((item, i) => (
              <li key={item.dish.id} className="ranking-item">
                <span className="ranking-position ranking-position--top">{i + 1}</span>
                <div className="ranking-info">
                  <span className="ranking-name">{item.dish.name}</span>
                  <span className="ranking-meta">
                    {item.qty} {t('stats.units.sold')} · {formatCurrency(item.revenue)}
                  </span>
                </div>
                <span className={`ranking-margin ${marginClass(item.marginPct)}`}>
                  {item.marginPct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="stats-section-title">{t('stats.flopTitle')}</h2>
        {ranking.flop.length === 0 ? (
          <p className="stats-list-empty">—</p>
        ) : (
          <ul className="ranking-list">
            {ranking.flop.map((item, i) => (
              <li key={item.dish.id} className="ranking-item">
                <span className="ranking-position ranking-position--flop">{i + 1}</span>
                <div className="ranking-info">
                  <span className="ranking-name">{item.dish.name}</span>
                  <span className="ranking-meta">
                    {item.qty} {t('stats.units.sold')} · {formatCurrency(item.revenue)}
                  </span>
                </div>
                <span className={`ranking-margin ${marginClass(item.marginPct)}`}>
                  {item.marginPct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}