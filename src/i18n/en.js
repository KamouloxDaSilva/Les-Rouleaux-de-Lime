// src/i18n/en.js
export default {
  app: { name: 'Burihagio' },
  nav: { home: 'Home', closing: 'Closing', menu: 'Menu', expenses: 'Employees', settings: 'Settings' },
  home: { greeting: 'Hello!', subtitle: 'What are we eating today?', todaySummary: 'Today\'s Summary', revenue: 'Revenue', expenses: 'Fixed costs', laborCost: 'Labor cost', foodCost: 'Food cost', profit: 'Net profit', weatherLabel: 'Weather', notesLabel: 'Notes', noClosingTitle: 'No closing', noClosingDesc: 'Go to Closing tab.', historyTitle: 'History' },
  menu: { title: 'Menu', tabs: { dishes: 'Dishes', ingredients: 'Ingredients' }, addDish: 'Add', empty: 'No dishes', confirmDelete: 'Delete?', dish: { name: 'Name', category: 'Category', price: 'Price', foodCost: 'Cost', margin: 'Margin', active: 'Active' }, recipe: { title: 'Recipe', addIngredient: 'Add', selectIngredient: 'Select', totalCost: 'Total' }, ingredients: { add: 'Add', empty: 'None', confirmDelete: 'Delete?', name: 'Name', unit: 'Unit', unitCost: 'Cost', supplier: 'Supplier' } },
  employees: {
    title: 'Employees & Wages',
    addEmployee: 'Add employee',
    empty: 'No employees',
    confirmDelete: 'Delete this employee?',
    name: 'Name',
    hourlyRate: 'Hourly rate',
    active: 'Active',
    shifts: 'Hours worked (today)',
    addShift: 'Add hours',
    exportCsv: 'Export CSV',
    totalLaborToday: 'Total labor today'
  },
  placeholder: { comingSoon: 'Coming soon...' },
  settings: { title: 'Settings', sections: { restaurant: { title: 'Restaurant', name: 'Name', address: 'Address', phone: 'Phone', currency: 'Currency', timezone: 'Timezone' }, fixedCosts: { title: 'Fixed costs', empty: 'None', add: 'Add', edit: 'Edit', delete: 'Delete', confirmDelete: 'Delete?', frequency: { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' } }, data: { title: 'Data', export: 'Export', import: 'Import', reset: 'Reset', exportHint: 'Download', importHint: 'Restore', resetHint: 'Erase all', resetConfirm: 'Erase?', importSuccess: 'Success', importError: 'Error' }, about: { title: 'About', version: 'Version', schemaVersion: 'Data' } } },
  closing: { title: 'Closing', date: 'Date', weather: 'Weather', weatherOptions: { sunny: 'Sunny', cloudy: 'Cloudy', rainy: 'Rainy', stormy: 'Stormy' }, sales: 'Sales', dishName: 'Dish', sold: 'Sold', lost: 'Lost', notes: 'Notes', notesPlaceholder: '...', estimatedRevenue: 'Est.', saveButton: 'Save', saveSuccess: 'Saved', alreadyClosed: 'Already closed.' },
  common: { save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete', add: 'Add', close: 'Close', error: 'Error', success: 'Success', loading: 'Loading…' },
  languages: { vi: 'Tiếng Việt', fr: 'Français', en: 'English' },
}