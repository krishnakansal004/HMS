#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const names = [
  // A - Pain & Fever
  'Paracetamol', 'Ibuprofen', 'Diclofenac', 'Aceclofenac', 'Naproxen', 'Aspirin', 'Ketorolac', 'Nimesulide', 'Mefenamic Acid', 'Etoricoxib', 'Tramadol', 'Indomethacin',
  // B - Cold & Throat
  'Cetirizine', 'Loratadine', 'Fexofenadine', 'Levocetirizine', 'Phenylephrine', 'Chlorpheniramine', 'Diphenhydramine', 'Montelukast', 'Bromhexine', 'Ambroxol', 'Dextromethorphan', 'Guaifenesin',
  // C - Antibiotics
  'Amoxicillin', 'Azithromycin', 'Ciprofloxacin', 'Levofloxacin', 'Ofloxacin', 'Norfloxacin', 'Doxycycline', 'Tetracycline', 'Metronidazole', 'Tinidazole', 'Co-Amoxiclav', 'Cefixime', 'Cefpodoxime', 'Cefuroxime', 'Cephalexin', 'Clarithromycin', 'Erythromycin', 'Linezolid', 'Vancomycin', 'Meropenem',
  // D - Stomach & Acidity
  'Pantoprazole', 'Omeprazole', 'Rabeprazole', 'Esomeprazole', 'Lansoprazole', 'Ranitidine', 'Famotidine', 'Domperidone', 'Ondansetron', 'Itopride', 'Dicyclomine', 'Hyoscine', 'Simethicone', 'Activated Charcoal', 'ORS Powder', 'Loperamide', 'Racecadotril', 'Lactobacillus', 'Sucralfate', 'Digene',
  // E - Vitamins & Supplements
  'Vitamin B-Complex', 'Vitamin C', 'Vitamin D3', 'Vitamin E', 'Folic Acid', 'Iron Tablets', 'Calcium Supplements', 'Zinc Tablets', 'Multivitamins', 'Omega-3', 'Magnesium', 'Selenium',
  // F - Dermatology
  'Clotrimazole', 'Ketoconazole', 'Terbinafine', 'Miconazole', 'Neosporin', 'Fusidic Acid', 'Betnovate (Betamethasone)', 'Hydrocortisone', 'Calamine Lotion', 'Permethrin', 'Soframycin', 'Silver Sulfadiazine', 'Salicylic Acid', 'Benzoyl Peroxide',
  // G - Eye/Ear/Nose
  'Ciprofloxacin Eye Drops', 'Moxifloxacin Eye Drops', 'Carboxymethylcellulose', 'Olopatadine', 'Chloramphenicol Eye Ointment', 'Sodium Chloride Nasal Drops', 'Xylometazoline Nasal Drops', 'Neomycin Ear Drops', 'Ofloxacin Ear Drops', 'Antifungal Ear Drops',
  // H - BP / Sugar
  'Amlodipine', 'Telmisartan', 'Losartan', 'Atenolol', 'Metoprolol', 'Propranolol', 'Metformin', 'Glimepiride', 'Voglibose', 'Sitagliptin',
  // I - Other General
  'Electral', 'Glucon-D', 'Betadine', 'Hydrogen Peroxide', 'Iodex Balm', 'Volini Spray', 'Crepe Bandage', 'Cotton & Gauze', 'Sanitizer'
]

function randHex(len=6){
  return Math.random().toString(16).slice(2,2+len).toUpperCase()
}

const expiry = new Date()
expiry.setFullYear(expiry.getFullYear()+1)
expiry.setHours(0,0,0,0)
const expiryISO = expiry.toISOString()

const items = names.map((n,i) => ({
  name: n,
  batchNumber: `BATCH-${randHex(6)}`,
  expiryDate: expiryISO,
  supplierName: 'Sukhi Supplier',
  quantity: 500,
  reorderLevel: 10,
  gstRate: 0,
  purchasePrice: 50,
  sellingPrice: 100,
  active: true
}))

const outPath = path.join(process.cwd(), 'backend', 'scripts', 'imported_medicines.json')
fs.writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf-8')
console.log(`Wrote ${items.length} medicines to ${outPath}`)
