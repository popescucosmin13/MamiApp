import type { Timestamp } from 'firebase/firestore';

export type AllergyRisk = 'low' | 'medium' | 'high';
export type ReactionSeverity = 'none' | 'mild' | 'moderate' | 'severe' | 'unknown';

export interface DiversificationProfile {
  childId: string;
  userId: string;
  status: 'not_started' | 'preparing' | 'active' | 'paused';
  startedAt?: string | Timestamp;
  method: 'puree' | 'blw' | 'mixed' | 'unknown';
  mealsPerDay: number;
  restrictions: string[];
  notes?: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface IntroducedFood {
  id: string;
  childId: string;
  userId: string;
  name: string;
  category:
    | 'vegetable'
    | 'fruit'
    | 'cereal'
    | 'protein'
    | 'dairy'
    | 'legume'
    | 'fat'
    | 'other';
  introducedAt: string | Timestamp;
  testDay: 1 | 2 | 3 | 'completed';
  isAllergen: boolean;
  allergenType?: string;
  reactionStatus: ReactionSeverity;
  acceptance: 'liked' | 'neutral' | 'refused' | 'unknown';
  texture: 'puree' | 'mashed' | 'soft_pieces' | 'finger_food' | 'mixed';
  notes?: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface MealEntry {
  id: string;
  childId: string;
  userId: string;
  date: string | Timestamp;
  time: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: {
    foodId?: string;
    name: string;
    isNew?: boolean;
    amountEstimate?: 'taste' | 'small' | 'medium' | 'large';
  }[];
  texture: 'puree' | 'mashed' | 'soft_pieces' | 'finger_food' | 'mixed';
  acceptance: 'poor' | 'medium' | 'good';
  photoBeforeUrl?: string;
  photoAfterUrl?: string;
  notes?: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface FoodReaction {
  id: string;
  childId: string;
  userId: string;
  suspectedFoodId?: string;
  suspectedFoodName: string;
  mealId?: string;
  reactionAt: string | Timestamp;
  symptoms: string[];
  severity: 'mild' | 'moderate' | 'severe';
  photos: string[];
  contactedDoctor: boolean;
  notes?: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

// Păstrăm și vechile tipuri pentru compatibilitate cu codul existent pe care încă nu l-am rescris
export interface FoodRecord {
  id?: string;
  foodKey: string;
  testedDate: Timestamp;
  reaction: 'none' | 'mild' | 'severe';
  notes?: string;
  isAllergy: boolean;
}

export interface FoodMaster {
  key: string;
  name_ro: string;
  name_en: string;
  minAgeMonths: number;
  allergyRisk: AllergyRisk;
  category: 'fruit' | 'vegetable' | 'protein' | 'grain' | 'dairy' | 'other';
  preparationTips: string;
  nutritionalBenefit: string;
}

export function getFoodEmoji(food: Pick<FoodMaster, 'key' | 'category' | 'name_ro'> | string): string {
  const keyOrName = typeof food === 'string' ? food.toLowerCase() : `${food.key} ${food.name_ro}`.toLowerCase();
  const category = typeof food === 'string' ? undefined : food.category;

  if (/(salmon|cod|somon|peste|pește)/.test(keyOrName)) return '🐟';
  if (/(shellfish|fructe de mare|crevet|shrimp)/.test(keyOrName)) return '🦐';
  if (/(chicken|pui|turkey|curcan)/.test(keyOrName)) return '🍗';
  if (/(beef|vita|vită)/.test(keyOrName)) return '🥩';
  if (/(egg|ou|galbenus|gălbenuș)/.test(keyOrName)) return '🥚';
  if (/(peanut|arahide|nuts|nuci|migdale)/.test(keyOrName)) return '🥜';
  if (/(lentils|linte|soy|soia)/.test(keyOrName)) return '🫘';
  if (/(yogurt|iaurt)/.test(keyOrName)) return '🥣';
  if (/(milk|lapte)/.test(keyOrName)) return '🥛';
  if (/(cheese|branza|brânză)/.test(keyOrName)) return '🧀';
  if (/(banana|banan)/.test(keyOrName)) return '🍌';
  if (/(apple|mar|măr)/.test(keyOrName)) return '🍎';
  if (/(pear|para|pară)/.test(keyOrName)) return '🍐';
  if (/(peach|piersic)/.test(keyOrName)) return '🍑';
  if (/(mango)/.test(keyOrName)) return '🥭';
  if (/(avocado)/.test(keyOrName)) return '🥑';
  if (/(broccoli|cauliflower|conopid)/.test(keyOrName)) return '🥦';
  if (/(spinach|spanac)/.test(keyOrName)) return '🥬';
  if (/(zucchini|dovlecel)/.test(keyOrName)) return '🥒';
  if (/(potato|cartof)/.test(keyOrName)) return '🥔';
  if (/(pumpkin|dovleac)/.test(keyOrName)) return '🎃';
  if (/(peas|mazare|mazăre)/.test(keyOrName)) return '🫛';
  if (/(carrot|morcov|parsnip|pastarnac|păstârnac)/.test(keyOrName)) return '🥕';
  if (/(rice|orez)/.test(keyOrName)) return '🍚';
  if (/(oat|ovaz|ovăz)/.test(keyOrName)) return '🥣';
  if (/(pasta|paste)/.test(keyOrName)) return '🍝';
  if (/(bread|paine|pâine)/.test(keyOrName)) return '🍞';
  if (/(wheat|grau|grâu|gluten|cereal)/.test(keyOrName)) return '🌾';

  if (category === 'fruit') return '🍎';
  if (category === 'vegetable') return '🥕';
  if (category === 'protein') return '🥩';
  if (category === 'dairy') return '🧀';
  if (category === 'grain') return '🌾';
  return '🍽️';
}

// Lista alimente diversificare
export const FOODS_MASTER: FoodMaster[] = [
  // Legume (6+ luni)
  { key: 'carrot', name_ro: 'Morcov', name_en: 'Carrot', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Gătit la abur sau fiert, piure fin la 6 luni.', nutritionalBenefit: 'Vitamina A, beta-caroten' },
  { key: 'sweet_potato', name_ro: 'Cartof dulce', name_en: 'Sweet potato', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Copt sau fiert, piure. Introduce dulceața naturală.', nutritionalBenefit: 'Vitamina A, C, potasiu' },
  { key: 'zucchini', name_ro: 'Dovlecel', name_en: 'Zucchini', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Fiert la abur, piure sau bastoane moi BLW.', nutritionalBenefit: 'Hidratare, vitamina C' },
  { key: 'peas', name_ro: 'Mazăre', name_en: 'Peas', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Piure fin. Bogată în proteine vegetale.', nutritionalBenefit: 'Proteine, fier, vitamina K' },
  { key: 'broccoli', name_ro: 'Broccoli', name_en: 'Broccoli', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Fiert la abur. Introduce gustul amar devreme.', nutritionalBenefit: 'Vitamina C, K, folat' },
  { key: 'spinach', name_ro: 'Spanac', name_en: 'Spinach', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Fiert, piure. Nu mai mult de 3x/săpt la sugar.', nutritionalBenefit: 'Fier, magneziu, folat' },
  { key: 'cauliflower', name_ro: 'Conopidă', name_en: 'Cauliflower', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Fiert la abur, piure sau bastoane pentru BLW.', nutritionalBenefit: 'Vitamina C, K, folat' },
  { key: 'potato', name_ro: 'Cartof', name_en: 'Potato', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Fiert sau copt, piure cu lapte matern.', nutritionalBenefit: 'Carbohidrați, potasiu, vitamina C' },
  { key: 'pumpkin', name_ro: 'Dovleac', name_en: 'Pumpkin', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Copt, piure. Textură cremoasă naturală.', nutritionalBenefit: 'Beta-caroten, vitamina A' },
  { key: 'parsnip', name_ro: 'Păstârnac', name_en: 'Parsnip', minAgeMonths: 6, allergyRisk: 'low', category: 'vegetable', preparationTips: 'Fiert la abur, piure.', nutritionalBenefit: 'Folat, vitamina C' },
  // Fructe (6+ luni)
  { key: 'banana', name_ro: 'Banană', name_en: 'Banana', minAgeMonths: 6, allergyRisk: 'low', category: 'fruit', preparationTips: 'Piure sau bastoane moi. Bine coaptă.', nutritionalBenefit: 'Potasiu, vitamina B6' },
  { key: 'avocado', name_ro: 'Avocado', name_en: 'Avocado', minAgeMonths: 6, allergyRisk: 'low', category: 'fruit', preparationTips: 'Piure direct. Bogat în grăsimi sănătoase pentru creier.', nutritionalBenefit: 'Grăsimi sănătoase, folat, vitamina K' },
  { key: 'apple', name_ro: 'Măr', name_en: 'Apple', minAgeMonths: 6, allergyRisk: 'low', category: 'fruit', preparationTips: 'Copt sau fiert la abur, piure. Ras crud după 8 luni.', nutritionalBenefit: 'Fibre, vitamina C' },
  { key: 'pear', name_ro: 'Pară', name_en: 'Pear', minAgeMonths: 6, allergyRisk: 'low', category: 'fruit', preparationTips: 'Piure sau feliuțe moi. Ușor laxativă.', nutritionalBenefit: 'Fibre, vitamina C' },
  { key: 'peach', name_ro: 'Piersică', name_en: 'Peach', minAgeMonths: 6, allergyRisk: 'low', category: 'fruit', preparationTips: 'Piure. Fără coajă și sâmbure.', nutritionalBenefit: 'Vitamina A, C' },
  { key: 'mango', name_ro: 'Mango', name_en: 'Mango', minAgeMonths: 6, allergyRisk: 'low', category: 'fruit', preparationTips: 'Piure sau bastoane moi. Fără sâmbure.', nutritionalBenefit: 'Vitamina A, C, folat' },
  // Proteine (6+ luni)
  { key: 'chicken', name_ro: 'Pui', name_en: 'Chicken', minAgeMonths: 6, allergyRisk: 'low', category: 'protein', preparationTips: 'Fiert sau gătit la abur, omogen. Fără os.', nutritionalBenefit: 'Proteine, zinc, vitamina B12' },
  { key: 'turkey', name_ro: 'Curcan', name_en: 'Turkey', minAgeMonths: 6, allergyRisk: 'low', category: 'protein', preparationTips: 'Fiert sau gătit la abur. Alternativă slabă la pui.', nutritionalBenefit: 'Proteine, seleniu, zinc' },
  { key: 'beef', name_ro: 'Carne de vită', name_en: 'Beef', minAgeMonths: 6, allergyRisk: 'low', category: 'protein', preparationTips: 'Fiert bine. Sursa principală de fier heminimic.', nutritionalBenefit: 'Fier, zinc, vitamina B12' },
  { key: 'lentils', name_ro: 'Linte', name_en: 'Lentils', minAgeMonths: 6, allergyRisk: 'low', category: 'protein', preparationTips: 'Fierte complet, piure. Proteină vegetală.', nutritionalBenefit: 'Proteine, fier, folat' },
  // Pește (8+ luni)
  { key: 'salmon', name_ro: 'Somon', name_en: 'Salmon', minAgeMonths: 8, allergyRisk: 'medium', category: 'protein', preparationTips: 'Copt sau fiert la abur. Fără oase, verificat.', nutritionalBenefit: 'Omega-3, DHA, vitamina D, B12' },
  { key: 'cod', name_ro: 'Cod', name_en: 'Cod', minAgeMonths: 8, allergyRisk: 'medium', category: 'protein', preparationTips: 'Fiert sau copt. Peşte alb, sărac în mercur.', nutritionalBenefit: 'Proteine, iod, vitamina B12' },
  // Ouă (6+ luni, albus cu precauție)
  { key: 'egg_yolk', name_ro: 'Gălbenuș de ou', name_en: 'Egg yolk', minAgeMonths: 6, allergyRisk: 'low', category: 'protein', preparationTips: 'Fiert tare. Gălbenușul mai puțin alergenic decât albusul.', nutritionalBenefit: 'Colină, vitamina D, fier' },
  { key: 'egg_whole', name_ro: 'Ou întreg', name_en: 'Whole egg', minAgeMonths: 8, allergyRisk: 'high', category: 'protein', preparationTips: 'Fiert tare sau omletă. Introduce cu atenție — risc alergie.', nutritionalBenefit: 'Proteine complete, vitamina D, colină' },
  // Lactate (după 6 luni, lapte integral după 12 luni)
  { key: 'yogurt', name_ro: 'Iaurt natural', name_en: 'Yogurt', minAgeMonths: 6, allergyRisk: 'medium', category: 'dairy', preparationTips: 'Iaurt integral, fără zahăr sau arome. Amestecă cu fructe.', nutritionalBenefit: 'Calciu, proteine, probiotice' },
  { key: 'cottage_cheese', name_ro: 'Brânză de vaci', name_en: 'Cottage cheese', minAgeMonths: 6, allergyRisk: 'medium', category: 'dairy', preparationTips: 'Neprelucrată, fără sare. Textură fină.', nutritionalBenefit: 'Calciu, proteine, fosfor' },
  { key: 'cows_milk', name_ro: 'Lapte de vacă', name_en: 'Cow milk', minAgeMonths: 12, allergyRisk: 'medium', category: 'dairy', preparationTips: 'Numai după 12 luni ca băutură. Integral.', nutritionalBenefit: 'Calciu, vitamina D, proteine' },
  // Cereale (6+ luni)
  { key: 'rice_cereal', name_ro: 'Cereale orez', name_en: 'Rice cereal', minAgeMonths: 6, allergyRisk: 'low', category: 'grain', preparationTips: 'Fortifiat cu fier. Se amestecă cu lapte matern.', nutritionalBenefit: 'Fier, carbohidrați' },
  { key: 'oatmeal', name_ro: 'Fulgi de ovăz', name_en: 'Oatmeal', minAgeMonths: 6, allergyRisk: 'low', category: 'grain', preparationTips: 'Fierți bine, fini. Preferați celor de orez pentru fibre.', nutritionalBenefit: 'Fibre, fier, beta-glucan' },
  { key: 'pasta', name_ro: 'Paste', name_en: 'Pasta', minAgeMonths: 8, allergyRisk: 'low', category: 'grain', preparationTips: 'Fierte bine, forme mici. Cu sos de legume.', nutritionalBenefit: 'Carbohidrați, fier (dacă fortifiate)' },
  { key: 'bread', name_ro: 'Pâine', name_en: 'Bread', minAgeMonths: 8, allergyRisk: 'low', category: 'grain', preparationTips: 'Integrală, fără sare adăugată. Batoane moi.', nutritionalBenefit: 'Carbohidrați, fibre, fier' },
  // Alergeni majori
  { key: 'peanut', name_ro: 'Arahide', name_en: 'Peanut', minAgeMonths: 6, allergyRisk: 'high', category: 'protein', preparationTips: 'Introduceți devreme (sub ghidul LEAP). Pastă fluidă diluată. NICIODATĂ arahidele întregi.', nutritionalBenefit: 'Proteine, grăsimi sănătoase' },
  { key: 'tree_nuts', name_ro: 'Nuci/migdale', name_en: 'Tree nuts', minAgeMonths: 6, allergyRisk: 'high', category: 'protein', preparationTips: 'Pastă fluidă diluată. NICIODATĂ bucăți întregi — pericol sufocare.', nutritionalBenefit: 'Grăsimi sănătoase, vitamina E' },
  { key: 'shellfish', name_ro: 'Fructe de mare', name_en: 'Shellfish', minAgeMonths: 12, allergyRisk: 'high', category: 'protein', preparationTips: 'Introduce cu atenție maximă după 12 luni. Urmărește reacții.', nutritionalBenefit: 'Zinc, iod, omega-3' },
  { key: 'soy', name_ro: 'Soia', name_en: 'Soy', minAgeMonths: 6, allergyRisk: 'high', category: 'protein', preparationTips: 'Tofu moale sau edamame piure. Urmărește reacții.', nutritionalBenefit: 'Proteine, calciu, fier' },
  { key: 'wheat', name_ro: 'Grâu (gluten)', name_en: 'Wheat/Gluten', minAgeMonths: 6, allergyRisk: 'medium', category: 'grain', preparationTips: 'Introduce la 6 luni, nu înainte și nu tardiv. Pâine sau paste.', nutritionalBenefit: 'Carbohidrați, fibre, fier' },
];
