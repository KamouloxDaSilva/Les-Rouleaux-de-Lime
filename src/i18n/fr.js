// src/i18n/fr.js
export default {
  app: { name: 'Les Rouleaux de Lime' },
  nav: { home: 'Accueil', closing: 'Clôture', menu: 'Menu', expenses: 'Employés', settings: 'Réglages' },
  home: { greeting: 'Bonjour !', subtitle: 'Qu\'est-ce qu\'on mange aujourd\'hui ?', todaySummary: 'Résumé du jour', revenue: 'CA', expenses: 'Charges fixes', laborCost: 'Salaires', foodCost: 'Coût matière', profit: 'Bénéfice net', weatherLabel: 'Météo', notesLabel: 'Notes', noClosingTitle: 'Non clôturé', noClosingDesc: 'Allez dans Clôture.', historyTitle: 'Historique' },
  menu: { title: 'Menu', tabs: { dishes: 'Plats', ingredients: 'Ingrédients' }, addDish: 'Ajouter', empty: 'Aucun plat', confirmDelete: 'Supprimer ?', dish: { name: 'Nom', category: 'Catégorie', price: 'Prix', foodCost: 'Coût', margin: 'Marge', active: 'En vente' }, recipe: { title: 'Recette', addIngredient: 'Ajouter', selectIngredient: 'Choisir', totalCost: 'Total' }, ingredients: { add: 'Ajouter', empty: 'Aucun', confirmDelete: 'Supprimer ?', name: 'Nom', unit: 'Unité', unitCost: 'Prix', supplier: 'Fournisseur' } },
  employees: {
    title: 'Employés & Salaires',
    addEmployee: 'Ajouter un employé',
    empty: 'Aucun employé',
    confirmDelete: 'Supprimer cet employé ?',
    name: 'Nom',
    hourlyRate: 'Taux horaire',
    active: 'Actif',
    shifts: 'Heures travaillées (aujourd\'hui)',
    addShift: 'Ajouter des heures',
    exportCsv: 'Exporter en CSV',
    totalLaborToday: 'Total salaires aujourd\'hui'
  },
  placeholder: { comingSoon: 'En développement...' },
  settings: { title: 'Réglages', sections: { restaurant: { title: 'Restaurant', name: 'Nom', address: 'Adresse', phone: 'Téléphone', currency: 'Devise', timezone: 'Fuseau' }, fixedCosts: { title: 'Charges', empty: 'Aucune', add: 'Ajouter', edit: 'Modifier', delete: 'Supprimer', confirmDelete: 'Supprimer ?', frequency: { daily: 'Jour', weekly: 'Semaine', monthly: 'Mois' } }, data: { title: 'Données', export: 'Export', import: 'Import', reset: 'Reset', exportHint: 'Sauvegarder', importHint: 'Restaurer', resetHint: 'Effacer', resetConfirm: 'Effacer tout ?', importSuccess: 'Succès', importError: 'Erreur' }, about: { title: 'À propos', version: 'Version', schemaVersion: 'Données' } } },
  closing: { title: 'Clôture', date: 'Date', weather: 'Météo', weatherOptions: { sunny: 'Soleil', cloudy: 'Nuages', rainy: 'Pluie', stormy: 'Orage' }, sales: 'Ventes', dishName: 'Plat', sold: 'Vendus', lost: 'Pertes', notes: 'Notes', notesPlaceholder: '...', estimatedRevenue: 'Prévu', saveButton: 'Enregistrer', saveSuccess: 'Enregistré', alreadyClosed: 'Déjà clôturé.' },
  common: { save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', delete: 'Supprimer', add: 'Ajouter', close: 'Fermer', error: 'Erreur', success: 'Succès', loading: 'Chargement…' },
  languages: { vi: 'Tiếng Việt', fr: 'Français', en: 'English' },
}