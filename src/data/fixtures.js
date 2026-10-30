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
} from './model.js';

export const FIXTURE_RESTAURANT_ID = 'resto-main';

function getDateOffset(daysAgo = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
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

  // ---------------- INGREDIENTS ----------------
  const ingredients = [
    // Plats (gỏi cuốn)
    createIngredient({ id: 'ing-banh-trang', restaurant_id: rid, name: 'Bánh tráng', category: 'dish', unit: 'tờ', unit_cost: 200 }),
    createIngredient({ id: 'ing-bun', restaurant_id: rid, name: 'Bún', category: 'dish', unit: 'g', unit_cost: 30 }),
    createIngredient({ id: 'ing-tom', restaurant_id: rid, name: 'Tôm', category: 'dish', unit: 'g', unit_cost: 250 }),
    createIngredient({ id: 'ing-thit-heo', restaurant_id: rid, name: 'Thịt heo', category: 'dish', unit: 'g', unit_cost: 120 }),
    createIngredient({ id: 'ing-xa-lach', restaurant_id: rid, name: 'Xà lách', category: 'dish', unit: 'g', unit_cost: 40 }),
    createIngredient({ id: 'ing-bac-ha', restaurant_id: rid, name: 'Rau bạc hà', category: 'dish', unit: 'g', unit_cost: 50 }),
    createIngredient({ id: 'ing-rau-mui', restaurant_id: rid, name: 'Rau mùi', category: 'dish', unit: 'g', unit_cost: 50 }),
    createIngredient({ id: 'ing-dau-phong', restaurant_id: rid, name: 'Đậu phộng', category: 'dish', unit: 'g', unit_cost: 80 }),

    // Boissons
    createIngredient({ id: 'ing-tra', restaurant_id: rid, name: 'Trà', category: 'drink', unit: 'g', unit_cost: 100 }),
    createIngredient({ id: 'ing-duong', restaurant_id: rid, name: 'Đường', category: 'drink', unit: 'g', unit_cost: 20 }),
    createIngredient({ id: 'ing-mia', restaurant_id: rid, name: 'Mía', category: 'drink', unit: 'kg', unit_cost: 8000 }),

    // Sauces
    createIngredient({ id: 'ing-nuoc-mam', restaurant_id: rid, name: 'Nước mắm', category: 'sauce', unit: 'ml', unit_cost: 60 }),
    createIngredient({ id: 'ing-toi', restaurant_id: rid, name: 'Tỏi', category: 'sauce', unit: 'g', unit_cost: 80 }),
    createIngredient({ id: 'ing-ot', restaurant_id: rid, name: 'Ớt', category: 'sauce', unit: 'g', unit_cost: 50 }),

    // Desserts
    createIngredient({ id: 'ing-dau-xanh', restaurant_id: rid, name: 'Đậu xanh', category: 'dessert', unit: 'g', unit_cost: 70 }),
    createIngredient({ id: 'ing-nuoc-cot-dua', restaurant_id: rid, name: 'Nước cốt dừa', category: 'dessert', unit: 'ml', unit_cost: 40 }),
  ];

  // ---------------- DISHES ----------------
  const dishes = [
    // Plats — Gỏi cuốn
    createDish({
      id: 'dish-goi-cuon-tom-thit', restaurant_id: rid, name: 'Gỏi cuốn tôm thịt',
      category: 'dish', subcategory: 'Gỏi cuốn', price: 25000, active: true,
      recipe: [
        { ingredient_id: 'ing-banh-trang', quantity: 1 },
        { ingredient_id: 'ing-bun', quantity: 30 },
        { ingredient_id: 'ing-tom', quantity: 30 },
        { ingredient_id: 'ing-thit-heo', quantity: 20 },
        { ingredient_id: 'ing-xa-lach', quantity: 10 },
        { ingredient_id: 'ing-bac-ha', quantity: 5 },
        { ingredient_id: 'ing-rau-mui', quantity: 5 },
        { ingredient_id: 'ing-dau-phong', quantity: 5 },
      ],
    }),
    createDish({
      id: 'dish-goi-cuon-tom', restaurant_id: rid, name: 'Gỏi cuốn tôm',
      category: 'dish', subcategory: 'Gỏi cuốn', price: 22000, active: true,
      recipe: [
        { ingredient_id: 'ing-banh-trang', quantity: 1 },
        { ingredient_id: 'ing-bun', quantity: 30 },
        { ingredient_id: 'ing-tom', quantity: 40 },
        { ingredient_id: 'ing-xa-lach', quantity: 10 },
        { ingredient_id: 'ing-bac-ha', quantity: 5 },
        { ingredient_id: 'ing-rau-mui', quantity: 5 },
        { ingredient_id: 'ing-dau-phong', quantity: 5 },
      ],
    }),
    createDish({
      id: 'dish-goi-cuon-chay', restaurant_id: rid, name: 'Gỏi cuốn chay',
      category: 'dish', subcategory: 'Gỏi cuốn', price: 18000, active: true,
      recipe: [
        { ingredient_id: 'ing-banh-trang', quantity: 1 },
        { ingredient_id: 'ing-bun', quantity: 40 },
        { ingredient_id: 'ing-xa-lach', quantity: 20 },
        { ingredient_id: 'ing-bac-ha', quantity: 10 },
        { ingredient_id: 'ing-rau-mui', quantity: 10 },
        { ingredient_id: 'ing-dau-phong', quantity: 10 },
      ],
    }),

    // Boissons
    createDish({
      id: 'dish-tra-da', restaurant_id: rid, name: 'Trà đá',
      category: 'drink', subcategory: '', price: 5000, active: true,
      recipe: [
        { ingredient_id: 'ing-tra', quantity: 5 },
        { ingredient_id: 'ing-duong', quantity: 10 },
      ],
    }),
    createDish({
      id: 'dish-nuoc-mia', restaurant_id: rid, name: 'Nước mía',
      category: 'drink', subcategory: '', price: 10000, active: true,
      recipe: [
        { ingredient_id: 'ing-mia', quantity: 0.2 },
        { ingredient_id: 'ing-duong', quantity: 5 },
      ],
    }),

    // Desserts
    createDish({
      id: 'dish-che-ba-mau', restaurant_id: rid, name: 'Chè ba màu',
      category: 'dessert', subcategory: 'Chè', price: 15000, active: true,
      recipe: [
        { ingredient_id: 'ing-dau-xanh', quantity: 30 },
        { ingredient_id: 'ing-nuoc-cot-dua', quantity: 30 },
        { ingredient_id: 'ing-duong', quantity: 20 },
      ],
    }),

    // Sauces
    createDish({
      id: 'dish-nuoc-cham', restaurant_id: rid, name: 'Nước chấm',
      category: 'sauce', subcategory: '', price: 3000, active: true,
      recipe: [
        { ingredient_id: 'ing-nuoc-mam', quantity: 20 },
        { ingredient_id: 'ing-toi', quantity: 5 },
        { ingredient_id: 'ing-ot', quantity: 3 },
      ],
    }),
  ];

  // ---------------- CHARGES FIXES ----------------
  const fixed_costs = [
    createFixedCost({ id: 'fc-loyer', restaurant_id: rid, name: 'Tiền thuê mặt bằng', amount: 5000000, frequency: 'monthly' }),
    createFixedCost({ id: 'fc-electricite', restaurant_id: rid, name: 'Tiền điện', amount: 800000, frequency: 'monthly' }),
  ];

  // ---------------- EMPLOYÉS ----------------
  const employees = [
    createEmployee({ id: 'emp-1', restaurant_id: rid, name: 'Lan', hourly_rate: 25000, active: true, days_per_week: 5 }),
    createEmployee({ id: 'emp-2', restaurant_id: rid, name: 'Hùng', hourly_rate: 30000, active: true, days_per_week: 6 }),
  ];

  const shifts = [
    createShift({ restaurant_id: rid, employee_id: 'emp-1', date: getDateOffset(1), hours_worked: 4 }),
    createShift({ restaurant_id: rid, employee_id: 'emp-2', date: getDateOffset(1), hours_worked: 5 }),
    createShift({ restaurant_id: rid, employee_id: 'emp-1', date: getDateOffset(0), hours_worked: 6 }),
  ];

  // ---------------- CLÔTURES ----------------
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
  };
}