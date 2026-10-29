// src/pages/ExpensesPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { getActiveRestaurant, createEmployee, createShift } from '../data/model.js'
import { loadDataset, saveDataset } from '../data/storage.js'
import { createDefaultFixtures } from '../data/fixtures.js'
import { getDailyLaborCost } from '../data/calculations.js'
import './ExpensesPage.css'

function getTodayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ExpensesPage() {
  const { t, formatCurrency } = useI18n()
  const [dataset, setDataset] = useState(null)
  const [feedback, setFeedback] = useState(null)
  
  const [isEditingEmp, setIsEditingEmp] = useState(false)
  const [empForm, setEmpForm] = useState({ name: '', hourly_rate: '' })

  const [selectedDate, setSelectedDate] = useState(getTodayString())

  useEffect(() => {
    const loaded = loadDataset()
    const isEmpty = loaded.employees.length === 0
    const initial = isEmpty ? createDefaultFixtures() : loaded
    if (isEmpty) { try { saveDataset(initial) } catch(e){} }
    setDataset(initial)
  }, [])

  const restaurant = useMemo(() => (dataset ? getActiveRestaurant(dataset) : null), [dataset])
  const employees = dataset?.employees || []
  const shifts = dataset?.shifts || []
  const activeEmployees = employees.filter(e => e.active)

  const dailyLabor = useMemo(() => {
    return getDailyLaborCost(selectedDate, shifts, employees)
  }, [selectedDate, shifts, employees])

  function commit(next) {
    setDataset(next)
    try { saveDataset(next) } catch (e) { setFeedback({ type: 'error', message: e.message }) }
  }

  function handleSubmitEmp(e) {
    e.preventDefault()
    if (!restaurant || !empForm.name.trim()) return
    const rate = Number(empForm.hourly_rate)
    if (!Number.isFinite(rate) || rate < 0) return

    const newEmp = createEmployee({ restaurant_id: restaurant.id, name: empForm.name, hourly_rate: rate })
    commit({ ...dataset, employees: [...employees, newEmp] })
    setIsEditingEmp(false)
    setEmpForm({ name: '', hourly_rate: '' })
  }

  function deleteEmp(id) {
    if (!window.confirm(t('employees.confirmDelete'))) return
    commit({ 
      ...dataset, 
      employees: employees.filter(e => e.id !== id),
      shifts: shifts.filter(s => s.employee_id !== id) 
    })
  }

  function handleAddShift(empId) {
    if (!restaurant) return
    const hoursStr = window.prompt("Nombre d'heures travaillées ? (ex: 4.5)", "4")
    if (!hoursStr) return
    const hours = parseFloat(hoursStr)
    if (!Number.isFinite(hours) || hours <= 0) return

    const newShift = createShift({ restaurant_id: restaurant.id, employee_id: empId, date: selectedDate, hours_worked: hours })
    commit({ ...dataset, shifts: [...shifts, newShift] })
  }

  function deleteShift(shiftId) {
    commit({ ...dataset, shifts: shifts.filter(s => s.id !== shiftId) })
  }

  function handleExportCsv() {
    if (!dataset) return
    let csv = "Date,Employé,Taux horaire,Heures,Total\n"
    
    const sortedShifts = [...shifts].sort((a,b) => a.date.localeCompare(b.date))
    sortedShifts.forEach(s => {
      const emp = employees.find(e => e.id === s.employee_id)
      if (emp) {
        csv += `${s.date},${emp.name},${emp.hourly_rate},${s.hours_worked},${emp.hourly_rate * s.hours_worked}\n`
      }
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salaires-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!dataset || !restaurant) return <div className="expenses-page">{t('common.loading')}</div>

  return (
    <div className="expenses-page">
      <div className="expenses-header">
        <h1>{t('employees.title')}</h1>
        <button className="btn btn-secondary" onClick={handleExportCsv}>
          📥 {t('employees.exportCsv')}
        </button>
      </div>

      {feedback && <div className="expenses-feedback">{feedback.message}</div>}

      <section className="expenses-section">
        <div className="section-title-row">
          <h2>{t('employees.title')}</h2>
          {!isEditingEmp && (
            <button className="btn btn-primary" onClick={() => setIsEditingEmp(true)}>
              + {t('employees.addEmployee')}
            </button>
          )}
        </div>

        {isEditingEmp && (
          <form className="expenses-form" onSubmit={handleSubmitEmp}>
            <input type="text" placeholder={t('employees.name')} required value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} />
            <input type="number" placeholder={t('employees.hourlyRate')} required min="0" step="1000" value={empForm.hourly_rate} onChange={e => setEmpForm({...empForm, hourly_rate: e.target.value})} />
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setIsEditingEmp(false)}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary">{t('common.save')}</button>
            </div>
          </form>
        )}

        <div className="employee-list">
          {employees.map(emp => (
            <div key={emp.id} className="employee-card">
              <div className="emp-main">
                <strong>{emp.name}</strong>
                <span>{formatCurrency(emp.hourly_rate)} / h</span>
              </div>
              <button className="btn btn-ghost btn-danger" onClick={() => deleteEmp(emp.id)}>{t('common.delete')}</button>
            </div>
          ))}
        </div>
      </section>

      <section className="expenses-section">
        <h2>{t('employees.shifts')}</h2>
        
        <div className="date-picker-row">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} max={getTodayString()} />
          <div className="total-labor">
            {t('employees.totalLaborToday')}: <strong>{formatCurrency(dailyLabor)}</strong>
          </div>
        </div>

        <div className="shift-list">
          {activeEmployees.map(emp => {
            const empShifts = shifts.filter(s => s.date === selectedDate && s.employee_id === emp.id)
            return (
              <div key={emp.id} className="shift-row">
                <span className="shift-name">{emp.name}</span>
                <div className="shift-chips">
                  {empShifts.map(s => (
                    <span key={s.id} className="shift-chip" onClick={() => deleteShift(s.id)} title="Cliquer pour supprimer">
                      {s.hours_worked}h ✕
                    </span>
                  ))}
                </div>
                <button className="btn btn-ghost" onClick={() => handleAddShift(emp.id)}>
                  + {t('employees.addShift')}
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}