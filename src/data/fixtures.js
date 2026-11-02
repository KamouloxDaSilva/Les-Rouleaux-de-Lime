// src/data/fixtures.js
import {
  SCHEMA_VERSION,
  createRestaurant,
  createIngredient,
  createDish,
  createFixedCost,
  createDailyClosing,
  createEmployee,
  createShift,
  createSupplier,
  createExpense,
  createPromotion,
  // ── v9 ──
  createSupplierOffer,
  createFormula,
} from './model.js';

export const FIXTURE_RESTAURANT_ID = 'resto-main';

function getDateOffset(daysAgo = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function getFutureDateOffset(daysAhead = 0) {
  const d = new Date(); d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

export function createDefaultFixtures() {
  const restaurant = createRestaurant({
    id: FIXTURE_RESTAURANT_ID,
    name: 'Burihagio',
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  const rid = restaurant.id;

  // ──────────────── FOURNISSEURS ────────────────
  const suppliers = [
    createSupplier({
      id: 'sup-1', restaurant_id: rid,
      name: 'Chợ đầu mối Bình Điền',
      phone: '0901234567', notes: 'Livraison le matin', sort_order: 0,
    }),
    createSupplier({
      id: 'sup-2', restaurant_id: rid,
      name: 'Đại lý Nước giải khát',
      phone: '0987654321', notes: '', sort_order: 1,
    }),
  ];

  // ──────────────── INGRÉDIENTS v9 ────────────────
  const ingredients = [
    // 0. Bánh tráng — pièce, ambiant, longue conservation
    createIngredient({
      id: 'ing-banh-trang', restaurant_id: rid, name: 'Bánh tráng',
      category: 'dish', unit: 'tờ', unit_cost: 200,
      supplier_id: 'sup-1', stock_quantity: 500, min_stock: 100, sort_order: 0,
      base_unit: 'piece',
      purchase_options: [
        { id: 'po-banh-trang-pack', label: 'pack 100', quantity_in_base: 100 },
      ],
      recipe_units: [
        { id: 'ru-banh-trang-to', label: 'tờ', quantity_in_base: 1, is_default: true },
      ],
      storage_type: 'ambient',
      shelf_life_days: 90,
    }),

    // 1. Bún — g, frais
    createIngredient({
      id: 'ing-bun', restaurant_id: rid, name: 'Bún',
      category: 'dish', unit: 'g', unit_cost: 30,
      supplier_id: 'sup-1', stock_quantity: 5000, min_stock: 1000, sort_order: 1,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-bun-kg', label: 'kg', quantity_in_base: 1000 },
      ],
      recipe_units: [
        { label: 'g', quantity_in_base: 1, is_default: true },
      ],
      storage_type: 'fresh',
      shelf_life_days: 3,
    }),

    // 2. Tôm — g, yield 0.9, poids variable, offre preferred
    createIngredient({
      id: 'ing-tom', restaurant_id: rid, name: 'Tôm',
      category: 'dish', unit: 'g', unit_cost: 250,
      supplier_id: 'sup-1', stock_quantity: 2000, min_stock: 500, sort_order: 2,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-tom-kg', label: 'kg', quantity_in_base: 1000 },
        { id: 'po-tom-barq', label: 'barquette 500g', quantity_in_base: 500 },
      ],
      recipe_units: [
        { label: 'g', quantity_in_base: 1, is_default: true },
        { label: 'portion 30g', quantity_in_base: 30 },
      ],
      yield_factor: 0.9,
      variable_weight: true,
      average_unit_weight: 15,
      weight_range: { min: 10, max: 20 },
      storage_type: 'fresh',
      shelf_life_days: 2,
      preferred_supplier_id: 'sup-1',
    }),

    // 3. Thịt heo — g, frais
    createIngredient({
      id: 'ing-thit-heo', restaurant_id: rid, name: 'Thịt heo',
      category: 'dish', unit: 'g', unit_cost: 120,
      supplier_id: 'sup-1', stock_quantity: 1500, min_stock: 500, sort_order: 3,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-thit-heo-kg', label: 'kg', quantity_in_base: 1000 },
      ],
      recipe_units: [
        { label: 'g', quantity_in_base: 1, is_default: true },
      ],
      storage_type: 'refrigerated',
      shelf_life_days: 3,
    }),

    // 4. Xà lách — g, yield 0.85 (feuilles abîmées)
    createIngredient({
      id: 'ing-xa-lach', restaurant_id: rid, name: 'Xà lách',
      category: 'dish', unit: 'g', unit_cost: 40,
      supplier_id: 'sup-1', stock_quantity: 300, min_stock: 1000, sort_order: 4,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-xa-lach-kg', label: 'kg', quantity_in_base: 1000 },
        { id: 'po-xa-lach-botte', label: 'botte 200g', quantity_in_base: 200 },
      ],
      recipe_units: [
        { label: 'g', quantity_in_base: 1, is_default: true },
        { label: 'feuille 10g', quantity_in_base: 10 },
      ],
      yield_factor: 0.85,
      storage_type: 'fresh',
      shelf_life_days: 3,
    }),

    // 5. Rau bạc hà — g
    createIngredient({
      id: 'ing-bac-ha', restaurant_id: rid, name: 'Rau bạc hà',
      category: 'dish', unit: 'g', unit_cost: 50,
      supplier_id: 'sup-1', stock_quantity: 1000, min_stock: 200, sort_order: 5,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-bac-ha-kg', label: 'kg', quantity_in_base: 1000 },
      ],
      recipe_units: [{ label: 'g', quantity_in_base: 1, is_default: true }],
      storage_type: 'fresh',
      shelf_life_days: 4,
    }),

    // 6. Rau mùi — g
    createIngredient({
      id: 'ing-rau-mui', restaurant_id: rid, name: 'Rau mùi',
      category: 'dish', unit: 'g', unit_cost: 50,
      supplier_id: 'sup-1', stock_quantity: 800, min_stock: 200, sort_order: 6,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-rau-mui-kg', label: 'kg', quantity_in_base: 1000 },
      ],
      recipe_units: [{ label: 'g', quantity_in_base: 1, is_default: true }],
      storage_type: 'fresh',
      shelf_life_days: 4,
    }),

    // 7. Đậu phộng — g
    createIngredient({
      id: 'ing-dau-phong', restaurant_id: rid, name: 'Đậu phộng',
      category: 'dish', unit: 'g', unit_cost: 80,
      supplier_id: 'sup-1', stock_quantity: 2000, min_stock: 500, sort_order: 7,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-dau-phong-kg', label: 'kg', quantity_in_base: 1000 },
      ],
      recipe_units: [{ label: 'g', quantity_in_base: 1, is_default: true }],
      storage_type: 'ambient',
      shelf_life_days: 180,
    }),

    // 8. Trà — g
    createIngredient({
      id: 'ing-tra', restaurant_id: rid, name: 'Trà',
      category: 'drink', unit: 'g', unit_cost: 100,
      supplier_id: 'sup-2', stock_quantity: 500, min_stock: 100, sort_order: 8,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-tra-pot', label: 'pot 50g', quantity_in_base: 50 },
      ],
      recipe_units: [{ label: 'g', quantity_in_base: 1, is_default: true }],
      storage_type: 'ambient',
      shelf_life_days: 365,
    }),

    // 9. Đường — track_stock=false (toujours dispo)
    createIngredient({
      id: 'ing-duong', restaurant_id: rid, name: 'Đường',
      category: 'drink', unit: 'g', unit_cost: 20,
      supplier_id: 'sup-2', stock_quantity: 3000, min_stock: 500, sort_order: 9,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-duong-kg', label: 'kg', quantity_in_base: 1000 },
      ],
      recipe_units: [{ label: 'g', quantity_in_base: 1, is_default: true }],
      track_stock: false,
      storage_type: 'ambient',
      shelf_life_days: 365,
    }),

    // 10. Mía — kg → g, yield 0.5, offre preferred
    createIngredient({
      id: 'ing-mia', restaurant_id: rid, name: 'Mía',
      category: 'drink', unit: 'kg', unit_cost: 8000,
      supplier_id: 'sup-2', stock_quantity: 20, min_stock: 5, sort_order: 10,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-mia-kg', label: 'kg', quantity_in_base: 1000 },
        { id: 'po-mia-cay', label: 'cây', quantity_in_base: 1500 },
      ],
      recipe_units: [{ label: 'g', quantity_in_base: 1, is_default: true }],
      yield_factor: 0.5,
      storage_type: 'ambient',
      shelf_life_days: 7,
      preferred_supplier_id: 'sup-2',
    }),

    // 11. Nước mắm — ml
    createIngredient({
      id: 'ing-nuoc-mam', restaurant_id: rid, name: 'Nước mắm',
      category: 'sauce', unit: 'ml', unit_cost: 60,
      supplier_id: '', stock_quantity: 1000, min_stock: 200, sort_order: 11,
      base_unit: 'ml',
      purchase_options: [
        { id: 'po-nuoc-mam-bt', label: 'bouteille 750ml', quantity_in_base: 750 },
      ],
      recipe_units: [
        { label: 'ml', quantity_in_base: 1, is_default: true },
        { label: 'c. à soupe 15ml', quantity_in_base: 15 },
      ],
      storage_type: 'ambient',
      shelf_life_days: 365,
    }),

    // 12. Tỏi — g
    createIngredient({
      id: 'ing-toi', restaurant_id: rid, name: 'Tỏi',
      category: 'sauce', unit: 'g', unit_cost: 80,
      supplier_id: '', stock_quantity: 500, min_stock: 100, sort_order: 12,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-toi-kg', label: 'kg', quantity_in_base: 1000 },
      ],
      recipe_units: [{ label: 'g', quantity_in_base: 1, is_default: true }],
      storage_type: 'ambient',
      shelf_life_days: 60,
    }),

    // 13. Ớt — g
    createIngredient({
      id: 'ing-ot', restaurant_id: rid, name: 'Ớt',
      category: 'sauce', unit: 'g', unit_cost: 50,
      supplier_id: '', stock_quantity: 300, min_stock: 100, sort_order: 13,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-ot-kg', label: 'kg', quantity_in_base: 1000 },
      ],
      recipe_units: [{ label: 'g', quantity_in_base: 1, is_default: true }],
      storage_type: 'ambient',
      shelf_life_days: 14,
    }),

    // 14. Đậu xanh — g
    createIngredient({
      id: 'ing-dau-xanh', restaurant_id: rid, name: 'Đậu xanh',
      category: 'dessert', unit: 'g', unit_cost: 70,
      supplier_id: '', stock_quantity: 1000, min_stock: 200, sort_order: 14,
      base_unit: 'g',
      purchase_options: [
        { id: 'po-dau-xanh-kg', label: 'kg', quantity_in_base: 1000 },
      ],
      recipe_units: [{ label: 'g', quantity_in_base: 1, is_default: true }],
      storage_type: 'ambient',
      shelf_life_days: 180,
    }),

    // 15. Nước cốt dừa — ml
    createIngredient({
      id: 'ing-nuoc-cot-dua', restaurant_id: rid, name: 'Nước cốt dừa',
      category: 'dessert', unit: 'ml', unit_cost: 40,
      supplier_id: '', stock_quantity: 2000, min_stock: 500, sort_order: 15,
      base_unit: 'ml',
      purchase_options: [
        { id: 'po-nuoc-cot-dua-can', label: 'canette 400ml', quantity_in_base: 400 },
      ],
      recipe_units: [{ label: 'ml', quantity_in_base: 1, is_default: true }],
      storage_type: 'ambient',
      shelf_life_days: 180,
    }),
  ];

  // ──────────────── DISHES v9 (quantity + quantity_in_base) ────────────────
  const dishes = [
    // Plats — Gỏi cuốn (toutes unités factor=1 sauf Bánh tráng tờ→piece factor=1)
    createDish({
      id: 'dish-goi-cuon-tom-thit', restaurant_id: rid, name: 'Gỏi cuốn tôm thịt',
      category: 'dish', subcategory: 'Gỏi cuốn', price: 25000, active: true,
      recipe: [
        { ingredient_id: 'ing-banh-trang', quantity: 1, quantity_in_base: 1 },
        { ingredient_id: 'ing-bun', quantity: 30, quantity_in_base: 30 },
        { ingredient_id: 'ing-tom', quantity: 30, quantity_in_base: 30 },
        { ingredient_id: 'ing-thit-heo', quantity: 20, quantity_in_base: 20 },
        { ingredient_id: 'ing-xa-lach', quantity: 10, quantity_in_base: 10 },
        { ingredient_id: 'ing-bac-ha', quantity: 5, quantity_in_base: 5 },
        { ingredient_id: 'ing-rau-mui', quantity: 5, quantity_in_base: 5 },
        { ingredient_id: 'ing-dau-phong', quantity: 5, quantity_in_base: 5 },
      ],
    }),
    createDish({
      id: 'dish-goi-cuon-tom', restaurant_id: rid, name: 'Gỏi cuốn tôm',
      category: 'dish', subcategory: 'Gỏi cuốn', price: 22000, active: true,
      recipe: [
        { ingredient_id: 'ing-banh-trang', quantity: 1, quantity_in_base: 1 },
        { ingredient_id: 'ing-bun', quantity: 30, quantity_in_base: 30 },
        { ingredient_id: 'ing-tom', quantity: 40, quantity_in_base: 40 },
        { ingredient_id: 'ing-xa-lach', quantity: 10, quantity_in_base: 10 },
        { ingredient_id: 'ing-bac-ha', quantity: 5, quantity_in_base: 5 },
        { ingredient_id: 'ing-rau-mui', quantity: 5, quantity_in_base: 5 },
        { ingredient_id: 'ing-dau-phong', quantity: 5, quantity_in_base: 5 },
      ],
    }),
    createDish({
      id: 'dish-goi-cuon-chay', restaurant_id: rid, name: 'Gỏi cuốn chay',
      category: 'dish', subcategory: 'Gỏi cuốn', price: 18000, active: true,
      recipe: [
        { ingredient_id: 'ing-banh-trang', quantity: 1, quantity_in_base: 1 },
        { ingredient_id: 'ing-bun', quantity: 40, quantity_in_base: 40 },
        { ingredient_id: 'ing-xa-lach', quantity: 20, quantity_in_base: 20 },
        { ingredient_id: 'ing-bac-ha', quantity: 10, quantity_in_base: 10 },
        { ingredient_id: 'ing-rau-mui', quantity: 10, quantity_in_base: 10 },
        { ingredient_id: 'ing-dau-phong', quantity: 10, quantity_in_base: 10 },
      ],
    }),

    // Boissons
    createDish({
      id: 'dish-tra-da', restaurant_id: rid, name: 'Trà đá',
      category: 'drink', subcategory: '', price: 5000, active: true,
      recipe: [
        { ingredient_id: 'ing-tra', quantity: 5, quantity_in_base: 5 },
        { ingredient_id: 'ing-duong', quantity: 10, quantity_in_base: 10 },
      ],
    }),
    createDish({
      id: 'dish-nuoc-mia', restaurant_id: rid, name: 'Nước mía',
      category: 'drink', subcategory: '', price: 10000, active: true,
      // ⚠️ Mía : unit='kg', base_unit='g' → quantity 0.2 kg = 200 g
      recipe: [
        { ingredient_id: 'ing-mia', quantity: 0.2, quantity_in_base: 200 },
        { ingredient_id: 'ing-duong', quantity: 5, quantity_in_base: 5 },
      ],
    }),

    // Desserts
    createDish({
      id: 'dish-che-ba-mau', restaurant_id: rid, name: 'Chè ba màu',
      category: 'dessert', subcategory: 'Chè', price: 15000, active: true,
      recipe: [
        { ingredient_id: 'ing-dau-xanh', quantity: 30, quantity_in_base: 30 },
        { ingredient_id: 'ing-nuoc-cot-dua', quantity: 30, quantity_in_base: 30 },
        { ingredient_id: 'ing-duong', quantity: 20, quantity_in_base: 20 },
      ],
    }),

    // Sauces
    createDish({
      id: 'dish-nuoc-cham', restaurant_id: rid, name: 'Nước chấm',
      category: 'sauce', subcategory: '', price: 3000, active: true,
      recipe: [
        { ingredient_id: 'ing-nuoc-mam', quantity: 20, quantity_in_base: 20 },
        { ingredient_id: 'ing-toi', quantity: 5, quantity_in_base: 5 },
        { ingredient_id: 'ing-ot', quantity: 3, quantity_in_base: 3 },
      ],
    }),
  ];

  // ──────────────── CHARGES FIXES ────────────────
  const fixed_costs = [
    createFixedCost({ id: 'fc-loyer', restaurant_id: rid, name: 'Tiền thuê mặt bằng', amount: 5000000, frequency: 'monthly', sort_order: 0 }),
    createFixedCost({ id: 'fc-electricite', restaurant_id: rid, name: 'Tiền điện', amount: 800000, frequency: 'monthly', sort_order: 1 }),
  ];

  // ──────────────── EMPLOYÉS ────────────────
  const employees = [
    createEmployee({ id: 'emp-1', restaurant_id: rid, name: 'Lan', hourly_rate: 25000, active: true, days_per_week: 5, sort_order: 0 }),
    createEmployee({ id: 'emp-2', restaurant_id: rid, name: 'Hùng', hourly_rate: 30000, active: true, days_per_week: 6, sort_order: 1 }),
  ];

  const shifts = [
    createShift({ restaurant_id: rid, employee_id: 'emp-1', date: getDateOffset(1), hours_worked: 4 }),
    createShift({ restaurant_id: rid, employee_id: 'emp-2', date: getDateOffset(1), hours_worked: 5 }),
    createShift({ restaurant_id: rid, employee_id: 'emp-1', date: getDateOffset(0), hours_worked: 6 }),
  ];

  // ──────────────── DÉPENSES ────────────────
  const expenses = [
    createExpense({ id: 'exp-1', restaurant_id: rid, date: getDateOffset(3), amount: 150000, category: 'material', note: 'Achat de nouveaux bols' }),
    createExpense({ id: 'exp-2', restaurant_id: rid, date: getDateOffset(1), amount: 50000, category: 'transport', note: 'Livraison marché' }),
  ];

  // ──────────────── PROMOTIONS ────────────────
  const promotions = [
    createPromotion({
      id: 'promo-1', restaurant_id: rid, dish_id: 'dish-goi-cuon-tom-thit',
      type: 'fixed_amount', value: 2000,
      start_date: getDateOffset(0), end_date: getFutureDateOffset(7), active: true,
    }),
    createPromotion({
      id: 'promo-2', restaurant_id: rid, dish_id: 'dish-nuoc-mia',
      type: 'percentage', value: 10,
      start_date: getDateOffset(10), end_date: getDateOffset(2), active: true,
    }),
  ];

  // ──────────────── CLÔTURES ────────────────
  const daily_closings = [
    createDailyClosing({
      restaurant_id: rid, date: getDateOffset(2), weather: 'sunny', notes: 'Ngày khai trương',
      sales: [
        { dish_id: 'dish-goi-cuon-tom-thit', quantity_sold: 45 },
        { dish_id: 'dish-goi-cuon-tom', quantity_sold: 30 },
        { dish_id: 'dish-tra-da', quantity_sold: 12 },
      ],
    }),
    createDailyClosing({
      restaurant_id: rid, date: getDateOffset(1), weather: 'rainy', notes: 'Mưa to',
      sales: [
        { dish_id: 'dish-goi-cuon-tom-thit', quantity_sold: 20 },
        { dish_id: 'dish-goi-cuon-tom', quantity_sold: 15 },
        { dish_id: 'dish-che-ba-mau', quantity_sold: 8 },
      ],
    }),
    createDailyClosing({
      restaurant_id: rid, date: getDateOffset(0), weather: 'cloudy', notes: '',
      sales: [
        { dish_id: 'dish-goi-cuon-tom-thit', quantity_sold: 35 },
        { dish_id: 'dish-goi-cuon-tom', quantity_sold: 25 },
        { dish_id: 'dish-goi-cuon-chay', quantity_sold: 12 },
        { dish_id: 'dish-nuoc-mia', quantity_sold: 6 },
      ],
    }),
  ];

  // ──────────────── v9 — SUPPLIER OFFERS (2) ────────────────
  const supplier_offers = [
    // Tôm — offre preferred chez Bình Điền (kg = 1000 g @ 250 000 ₫)
    createSupplierOffer({
      id: 'offer-tom-bd',
      restaurant_id: rid,
      ingredient_id: 'ing-tom',
      supplier_id: 'sup-1',
      purchase_option_id: 'po-tom-kg',
      cost: 250000, // 250 000 / 1000 g = 250 ₫/g → cohérent avec reference_unit_cost
      is_available: true,
      is_preferred: true,
      min_order_quantity: 1,
      lead_time_days: 0,
    }),
    // Mía — offre preferred chez Đại lý (cây = 1500 g @ 12 000 ₫)
    createSupplierOffer({
      id: 'offer-mia-bd',
      restaurant_id: rid,
      ingredient_id: 'ing-mia',
      supplier_id: 'sup-2',
      purchase_option_id: 'po-mia-cay',
      cost: 12000, // 12 000 / 1500 g = 8 ₫/g → cohérent avec reference_unit_cost
      is_available: true,
      is_preferred: true,
      min_order_quantity: 1,
      lead_time_days: 0,
    }),
  ];

  // ──────────────── v9 — FORMULES (1) ────────────────
  const formulas = [
    createFormula({
      id: 'formula-classique',
      restaurant_id: rid,
      name: 'Formule Classique',
      description: 'Rouleau + boisson + sauce',
      emoji: '✨',
      color: '#FF9800',
      composition: [
        { dish_id: 'dish-goi-cuon-tom-thit', quantity: 1, slot: 'main' },
        { dish_id: 'dish-tra-da', quantity: 1, slot: 'drink' },
        { dish_id: 'dish-nuoc-cham', quantity: 1, slot: 'sauce' },
      ],
      pricing_mode: 'discounted',
      fixed_price: 0,
      discount_pct: 10,
      active: true,
    }),
  ];

  // ──────────────── v9 — PURCHASE RECEIPTS (vides) ────────────────
  const purchase_receipts = [];

  return {
    schema_version: SCHEMA_VERSION,
    active_restaurant_id: rid,
    restaurants: [restaurant],
    ingredients,
    dishes,
    fixed_costs,
    daily_closings,
    employees,
    shifts,
    planning: [],
    suppliers,
    expenses,
    promotions,
    tasks: [],
    // ── v9 ──
    supplier_offers,
    formulas,
    purchase_receipts,
  };
}