// src/pages/StatsPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { loadDataset } from '../data/storage.js';
import { createDefaultFixtures } from '../data/fixtures.js';
import { getActiveRestaurant } from '../data/model.js';
import { getDishFoodCost } from '../data/calculations.js';
import { getCategoryBreakdown } from '../data/stats.js';
import './StatsPage.css';

const CATEGORY_COLORS = {
  dish: '#3C91A6',
  drink: '#FF9800',
  dessert: '#E91E63',
  sauce: '#9C27B0',
};

export default function StatsPage() {
  const { t, formatCurrency } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview | top | low
  const [drillDownData, setDrillDownData] = useState(null);

  // Chantier 11-F1 — locale i18n (vi-VN / fr-FR / en-US) pour Intl.DateTimeFormat
  const locale = t('home.locale');

  useEffect(() => {
    const loaded = loadDataset();
    const isEmpty = loaded.dishes.length === 0 && loaded.daily_closings.length === 0;
    setDataset(isEmpty ? createDefaultFixtures() : loaded);
  }, []);

  const restaurant = useMemo(() => dataset ? getActiveRestaurant(dataset) : null, [dataset]);

  // --- CALCULS DES STATISTIQUES ---
  const stats = useMemo(() => {
    if (!dataset || !restaurant) return null;

    let totalRevenue = 0;
    let totalFoodCost = 0;
    let totalItemsSold = 0;

    const salesByCategory = { dish: 0, drink: 0, dessert: 0 };
    const dishSalesMap = {};

    // Initialiser les ventes par plat
    dataset.dishes.filter(d => d.restaurant_id === restaurant.id).forEach(d => {
      dishSalesMap[d.id] = { ...d, qty: 0, revenue: 0 };
    });

    // Agréger les données des clôtures
    dataset.daily_closings.forEach(closing => {
      closing.sales.forEach(sale => {
        const dish = dataset.dishes.find(d => d.id === sale.dish_id);
        if (!dish) return;

        const revenue = dish.price * sale.quantity_sold;
        const foodCost = getDishFoodCost(dish, dataset.ingredients) * sale.quantity_sold;

        totalRevenue += revenue;
        totalFoodCost += foodCost;
        totalItemsSold += sale.quantity_sold;

        if (salesByCategory[dish.category] !== undefined) {
          salesByCategory[dish.category] += revenue;
        }

        if (dishSalesMap[dish.id]) {
          dishSalesMap[dish.id].qty += sale.quantity_sold;
          dishSalesMap[dish.id].revenue += revenue;
        }
      });
    });

    const totalProfit = totalRevenue - totalFoodCost;

    // Liste triée des plats
    const sortedDishes = Object.values(dishSalesMap)
      .filter(d => d.qty > 0)
      .sort((a, b) => b.qty - a.qty);

    const topDishes = sortedDishes.slice(0, 5);
    const lowDishes = [...sortedDishes].reverse().slice(0, 5);

    // Pourcentages pour le Donut
    const totalCatSales = salesByCategory.dish + salesByCategory.drink + salesByCategory.dessert || 1;
    const catPercentages = {
      dish: (salesByCategory.dish / totalCatSales) * 100,
      drink: (salesByCategory.drink / totalCatSales) * 100,
      dessert: (salesByCategory.dessert / totalCatSales) * 100,
    };

    // Données pour le graphique en barres (7 derniers jours)
    // Chantier 11-F1 — locale dynamique au lieu de 'fr-FR' hardcodé
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const closing = dataset.daily_closings.find(c => c.date === dateStr);

      let dayRevenue = 0;
      if (closing) {
        closing.sales.forEach(s => {
          const dish = dataset.dishes.find(dd => dd.id === s.dish_id);
          if (dish) dayRevenue += dish.price * s.quantity_sold;
        });
      }

      last7Days.push({
        date: dateStr,
        dayLabel: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d),
        revenue: dayRevenue,
      });
    }
    const maxRevenue = Math.max(...last7Days.map(d => d.revenue), 1);

    return {
      totalRevenue, totalProfit, totalItemsSold,
      salesByCategory, catPercentages, topDishes, lowDishes,
      last7Days, maxRevenue,
    };
  }, [dataset, restaurant, locale]);

  const handleKpiClick = (kpiType) => {
    const data = getCategoryBreakdown(dataset, kpiType);
    setDrillDownData({ kpiType, ...data });
  };

  if (!dataset || !stats) return <div>{t('common.loading')}</div>;

  // Préparation du gradient pour le donut de drill-down
  let drillDownGradient = '';
  if (drillDownData && drillDownData.total > 0) {
    let cumulative = 0;
    const parts = drillDownData.categories.map((cat) => {
      const start = cumulative;
      cumulative += cat.percentage;
      return `${CATEGORY_COLORS[cat.key]} ${start}% ${cumulative}%`;
    });
    drillDownGradient = `conic-gradient(${parts.join(', ')})`;
  }

  return (
    <div className="stats-page">
      <h1 className="stats-title">{t('stats.title')}</h1>

      {/* --- GRILLE DES KPIs --- */}
      <div className="stats-kpi-grid">
        <div className="kpi-card" onClick={() => handleKpiClick('revenue')}>
          <div className="kpi-icon" style={{ background: '#FFF3E0', color: '#FF9800' }}>💰</div>
          <div className="kpi-content">
            <span className="kpi-label">{t('stats.totalRevenue')}</span>
            <strong className="kpi-value">{formatCurrency(stats.totalRevenue)}</strong>
          </div>
        </div>

        <div className="kpi-card" onClick={() => handleKpiClick('profit')}>
          <div className="kpi-icon" style={{ background: '#E0F2F1', color: '#3C91A6' }}>📈</div>
          <div className="kpi-content">
            <span className="kpi-label">{t('stats.totalProfit')}</span>
            <strong className="kpi-value">{formatCurrency(stats.totalProfit)}</strong>
          </div>
        </div>

        <div className="kpi-card" onClick={() => handleKpiClick('items')}>
          <div className="kpi-icon" style={{ background: '#F3E5F5', color: '#9C27B0' }}>🍽️</div>
          <div className="kpi-content">
            <span className="kpi-label">{t('stats.itemsSold')}</span>
            <strong className="kpi-value">{stats.totalItemsSold}</strong>
          </div>
        </div>
      </div>

      {/* --- ONGLETS --- */}
      <div className="stats-tabs">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>{t('stats.overview')}</button>
        <button className={activeTab === 'top' ? 'active' : ''} onClick={() => setActiveTab('top')}>{t('stats.topSales')}</button>
        <button className={activeTab === 'low' ? 'active' : ''} onClick={() => setActiveTab('low')}>{t('stats.lowSales')}</button>
      </div>

      {/* --- CONTENU DES ONGLETS --- */}
      {activeTab === 'overview' && (
        <div className="stats-content">
          {/* Donut Chart */}
          <div className="card chart-card">
            <h3 className="chart-title">{t('stats.salesByCategory')}</h3>
            <div className="donut-container">
              <div className="donut-chart" style={{
                background: `conic-gradient(
                  #3C91A6 0% ${stats.catPercentages.dish}%,
                  #FF9800 ${stats.catPercentages.dish}% ${stats.catPercentages.dish + stats.catPercentages.drink}%,
                  #E91E63 ${stats.catPercentages.dish + stats.catPercentages.drink}% 100%
                )`,
              }}>
                <div className="donut-hole">
                  <strong>{formatCurrency(stats.totalRevenue)}</strong>
                  <span>{t('stats.total')}</span>
                </div>
              </div>
              <div className="donut-legend">
                <div className="legend-item"><span className="dot" style={{ background: '#3C91A6' }}></span> {t('menu.sections.dish')} <strong>{Math.round(stats.catPercentages.dish)}%</strong></div>
                <div className="legend-item"><span className="dot" style={{ background: '#FF9800' }}></span> {t('menu.sections.drink')} <strong>{Math.round(stats.catPercentages.drink)}%</strong></div>
                <div className="legend-item"><span className="dot" style={{ background: '#E91E63' }}></span> {t('menu.sections.dessert')} <strong>{Math.round(stats.catPercentages.dessert)}%</strong></div>
              </div>
            </div>
          </div>

          {/* Bar Chart (7 jours) */}
          <div className="card chart-card">
            <h3 className="chart-title">{t('stats.last7Days')}</h3>
            <div className="bar-chart-container">
              {stats.last7Days.map((day, i) => {
                const height = Math.max((day.revenue / stats.maxRevenue) * 100, 5); // 5% min pour voir la barre
                return (
                  <div key={i} className="bar-wrapper">
                    <div className="bar-tooltip">{formatCurrency(day.revenue)}</div>
                    <div className="bar" style={{ height: `${height}%` }}></div>
                    <span className="bar-label">{day.dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'top' || activeTab === 'low') && (
        <div className="stats-content">
          <div className="card list-card">
            <h3 className="chart-title">{activeTab === 'top' ? t('stats.topSales') : t('stats.lowSales')}</h3>
            <ul className="stats-dish-list">
              {(activeTab === 'top' ? stats.topDishes : stats.lowDishes).map((dish, idx) => (
                <li key={dish.id} className="stats-dish-item">
                  <span className="rank">#{idx + 1}</span>
                  <div className="dish-info">
                    <span className="dish-name">{dish.name}</span>
                    <span className="dish-cat">{t(`menu.sections.${dish.category}`)}</span>
                  </div>
                  <div className="dish-stats">
                    <strong>{dish.qty} {t('stats.sold')}</strong>
                    <span>{formatCurrency(dish.revenue)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* --- MODALE DE DRILL-DOWN --- */}
      {drillDownData && (
        <div className="stats-modal-backdrop" onClick={() => setDrillDownData(null)}>
          <div className="stats-modal" onClick={e => e.stopPropagation()}>
            <h2>{t(`stats.drillDown.${drillDownData.kpiType}`)}</h2>
            {drillDownData.total > 0 ? (
              <div className="drilldown-container">
                <div className="drilldown-donut" style={{ background: drillDownGradient }}>
                  <div className="drilldown-hole">
                    <strong>
                      {drillDownData.kpiType === 'items'
                        ? drillDownData.total
                        : formatCurrency(drillDownData.total)}
                    </strong>
                    <span>{t('stats.total')}</span>
                  </div>
                </div>
                <div className="drilldown-legend">
                  {drillDownData.categories.map(cat => (
                    <div key={cat.key} className="legend-item">
                      <span className="dot" style={{ background: CATEGORY_COLORS[cat.key] }}></span>
                      {t(`menu.sections.${cat.key}`)}
                      <strong>
                        {drillDownData.kpiType === 'items'
                          ? cat.value
                          : formatCurrency(cat.value)}
                      </strong>
                      <span className="pct">{Math.round(cat.percentage)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p>{t('stats.drillDown.noData')}</p>
            )}
            <button className="btn-close" onClick={() => setDrillDownData(null)}>{t('common.close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}