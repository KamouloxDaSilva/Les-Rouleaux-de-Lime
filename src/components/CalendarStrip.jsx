// src/components/CalendarStrip.jsx
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import './CalendarStrip.css';

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMonday(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0 = dimanche, 1 = lundi…
  const diff = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CalendarStrip({
  selectedDate = new Date(),
  onSelectDate,
  weekOffset: weekOffsetProp,
  className = '',
  showMonthLabel = true,
}) {
  const { t } = useI18n();
  const [weekOffset, setWeekOffset] = useState(weekOffsetProp || 0);

  useEffect(() => {
    setWeekOffset(weekOffsetProp || 0);
  }, [selectedDate, weekOffsetProp]);

  const locale = t('home.locale');
  const days = t('home.days');
  const today = new Date();

  const baseMonday = getMonday(selectedDate);
  const displayedMonday = new Date(baseMonday);
  displayedMonday.setDate(baseMonday.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(displayedMonday);
    d.setDate(displayedMonday.getDate() + i);
    return d;
  });

  const monthLabel = showMonthLabel
    ? displayedMonday.toLocaleString(locale, {
        month: 'long',
        year: 'numeric',
      })
    : '';

  const goPrev = () => setWeekOffset((o) => o - 1);
  const goNext = () => setWeekOffset((o) => o + 1);

  const handleSelect = (d) => {
    if (onSelectDate) onSelectDate(d);
    setWeekOffset(0);
  };

  return (
    <section
      className={`calendar-strip ${className}`.trim()}
      aria-label={t('home.timeline.weekOf')}
    >
      <div className="calendar-strip__header">
        <button
          type="button"
          className="calendar-strip__nav"
          onClick={goPrev}
          aria-label={t('common.back')}
        >
          ‹
        </button>
        {showMonthLabel && (
          <span className="calendar-strip__month">{monthLabel}</span>
        )}
        <button
          type="button"
          className="calendar-strip__nav"
          onClick={goNext}
          aria-label={t('common.add')}
        >
          ›
        </button>
      </div>

      <div
        className="calendar-strip__days"
        role="group"
        aria-label={t('home.timeline.weekOf')}
      >
        {weekDays.map((d, index) => {
          const isWeekend = index >= 5;
          const isActive = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          return (
            <button
              key={toIsoDate(d)}
              type="button"
              className={
                'calendar-strip__day' +
                (isWeekend ? ' calendar-strip__day--weekend' : '') +
                (isActive ? ' calendar-strip__day--active' : '')
              }
              onClick={() => handleSelect(d)}
              aria-label={`${days[index]} ${d.getDate()}`}
              aria-current={isActive ? 'date' : undefined}
              aria-pressed={isActive}
            >
              <span className="calendar-strip__day-label">
                {days[index]}
              </span>
              <span className="calendar-strip__day-number">
                {d.getDate()}
              </span>
              {isToday && !isActive && (
                <span className="calendar-strip__dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}