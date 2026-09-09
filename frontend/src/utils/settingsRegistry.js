export const SETTINGS_REGISTRY = [
  { key: 'HOSPITAL_CONTACT_EMAIL', group: 'HOSPITAL', label: 'Contact Email', type: 'email', default: '' },
  { key: 'HOSPITAL_PHONE', group: 'HOSPITAL', label: 'Phone Number', type: 'text', default: '' },
  { key: 'HOSPITAL_ADDRESS', group: 'HOSPITAL', label: 'Physical Address', type: 'textarea', default: '' },
  { key: 'INVOICE_PREFIX', group: 'BILLING', label: 'Invoice Prefix', type: 'text', default: 'INV-' },
  { key: 'DEFAULT_TAX_RATE', group: 'BILLING', label: 'Default Tax Rate (%)', type: 'number', default: '0' },
  { key: 'CURRENCY', group: 'LOCALIZATION', label: 'Currency', type: 'select', options: ['INR', 'USD', 'EUR', 'GBP'], default: 'INR' },
  { key: 'TIMEZONE', group: 'LOCALIZATION', label: 'Timezone', type: 'select', options: ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'UTC'], default: 'Asia/Kolkata' }
];

export const SETTINGS_GROUPS = ['HOSPITAL', 'BILLING', 'LOCALIZATION'];