// src/data/fixtures.js
import { SCHEMA_VERSION, createRestaurant, createIngredient, createDish, createFixedCost, createDailyClosing, createEmployee, createShift } from './model.js';

export const FIXTURE_RESTAURANT_ID = 'resto-main';
function getDateOffset(daysAgo = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10);
}

export function createDefaultFixtures() {
  const restaurant = createRestaurant({ id: FIXTURE_RESTAURANT_ID, name: 'Burihagio', currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' });
  const rid = restaurant.id;

  const ingredients = [
    createIngredient({ id: 'ing-banh-trang', restaurant_id: rid, name: 'Bánh tráng', unit: 'tờ', unit_cost: 200 }),
    createIngredient({ id: 'ing-bun', restaurant_id: rid, name: 'Bún', unit: 'g', unit_cost: 30 }),
    createIngredient({ id: 'ing-tom', restaurant_id: rid, name: 'Tôm', unit: 'g', unit_cost: 250 }),
    createIngredient({ id: 'ing-thit-heo', restaurant_id: rid, name: 'Thịt heo', unit: 'g', unit_cost: 120 }),
    createIngredient({ id: 'ing-xa-lach', restaurant_id: rid, name: 'Xà lách', unit: 'g', unit_cost: 40 }),
    createIngredient({ id: 'ing-bac-ha', restaurant_id: rid, name: 'Rau bạc hà', unit: 'g', unit_cost: 50 }),
    createIngredient({ id: 'ing-rau-mui', restaurant_id: rid, name: 'Rau mùi', unit: 'g', unit_cost: 50 }),
    createIngredient({ id: 'ing-dau-phong', restaurant_id: rid, name: 'Đậu phộng', unit: 'g', unit_cost: 80 }),
  ];

  const dishes = [
    createDish({ id: 'dish-goi-cuon-tom-thit', restaurant_id: rid, name: 'Gỏi cuốn tôm thịt', category: 'Gỏi cuốn', price: 25000, active: true, recipe: [{ ingredient_id: 'ing-banh-trang', quantity: 1 }, { ingredient_id: 'ing-bun', quantity: 30 }, { ingredient_id: 'ing-tom', quantity: 30 }, { ingredient_id: 'ing-thit-heo', quantity: 20 }, { ingredient_id: 'ing-xa-lach', quantity: 10 }, { ingredient_id: 'ing-bac-ha', quantity: 5 }, { ingredient_id: 'ing-rau-mui', quantity: 5 }, { ingredient_id: 'ing-dau-phong', quantity: 5 }] }),
    createDish({ id: 'dish-goi-cuon-tom', restaurant_id: rid, name: 'Gỏi cuốn tôm', category: 'Gỏi cuốn', price: 22000, active: true, recipe: [{ ingredient_id: 'ing-banh-trang', quantity: 1 }, { ingredient_id: 'ing-bun', quantity: 30 }, { ingredient_id: 'ing-tom', quantity: 40 }, { ingredient_id: 'ing-xa-lach', quantity: 10 }, { ingredient_id: 'ing-bac-ha', quantity: 5 }, { ingredient_id: 'ing-rau-mui', quantity: 5 }, { ingredient_id: 'ing-dau-phong', quantity: 5 }] }),
    createDish({ id: 'dish-goi-cuon-chay', restaurant_id: rid, name: 'Gỏi cuốn chay', category: 'Gỏi cuốn', price: 18000, active: true, recipe: [{ ingredient_id: 'ing-banh-trang', quantity: 1 }, { ingredient_id: 'ing-bun', quantity: 40 }, { ingredient_id: 'ing-xa-lach', quantity: 20 }, { ingredient_id: 'ing-bac-ha', quantity: 10 }, { ingredient_id: 'ing-rau-mui', quantity: 10 }, { ingredient_id: 'ing-dau-phong', quantity: 10 }] }),
  ];

  const fixed_costs = [
    createFixedCost({ id: 'fc-loyer', restaurant_id: rid, name: 'Tiền thuê mặt bằng', amount: 5000000, frequency: 'monthly' }),
    createFixedCost({ id: 'fc-electricite', restaurant_id: rid, name: 'Tiền điện', amount: 800000, frequency: 'monthly' }),
  ];

  const employees = [
    createEmployee({ id: 'emp-1', restaurant_id: rid, name: 'Lan', hourly_rate: 25000, active: true }),
    createEmployee({ id: 'emp-2', restaurant_id: rid, name: 'Hùng', hourly_rate: 30000, active: true }),
  ];

  const shifts = [
    createShift({ restaurant_id: rid, employee_id: 'emp-1', date: getDateOffset(1), hours_worked: 4 }),
    createShift({ restaurant_id: rid, employee_id: 'emp-2', date: getDateOffset(1), hours_worked: 5 }),
    createShift({ restaurant_id: rid, employee_id: 'emp-1', date: getDateOffset(0), hours_worked: 6 }),
  ];

  const daily_closings = [
    createDailyClosing({ restaurant_id: rid, date: getDateOffset(2), weather: 'sunny', notes: 'Ngày khai trương', sales: [{ dish_id: 'dish-goi-cuon-tom-thit', quantity_sold: 45, quantity_lost: 2 }, { dish_id: 'dish-goi-cuon-tom', quantity_sold: 30, quantity_lost: 0 }] }),
    createDailyClosing({ restaurant_id: rid, date: getDateOffset(1), weather: 'rainy', notes: 'Mưa to', sales: [{ dish_id: 'dish-goi-cuon-tom-thit', quantity_sold: 20, quantity_lost: 5 }, { dish_id: 'dish-goi-cuon-tom', quantity_sold: 15, quantity_lost: 0 }] }),
    createDailyClosing({ restaurant_id: rid, date: getDateOffset(0), weather: 'cloudy', notes: '', sales: [{ dish_id: 'dish-goi-cuon-tom-thit', quantity_sold: 35, quantity_lost: 0 }, { dish_id: 'dish-goi-cuon-tom', quantity_sold: 25, quantity_lost: 0 }, { dish_id: 'dish-goi-cuon-chay', quantity_sold: 12, quantity_lost: 0 }] }),
  ];

  return { schema_version: SCHEMA_VERSION, active_restaurant_id: rid, restaurants: [restaurant], ingredients, dishes, fixed_costs, daily_closings, employees, shifts };
}