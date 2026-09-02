import { test, expect } from '@playwright/test';

test('prevents accidental navigation when invoice form is dirty', async ({ page }) => {
  // 1. Navigate and Log in
  await page.goto('http://localhost:5173/login');
  
  // NOTE: Adjust credentials if needed to match your local DB
  await page.getByLabel('Email').fill('admin@hospital.local');
  await page.getByLabel('Password').fill('admin123');
  // Leave Hospital ID blank if using SYSTEM_OWNER, or fill it if using HOSPITAL_ADMIN
  await page.getByLabel('Hospital ID').fill('e2e-test-hospital'); 
  await page.getByRole('button', { name: 'Sign in' }).click();
  
  await page.waitForURL('**/dashboard');

  // 2. Navigate via the UI (This keeps the SPA intact)
  await page.locator('nav').getByText('Billing').click();
  await page.waitForURL('**/invoices');
  await page.getByRole('button', { name: 'Generate Invoice' }).click();
  await page.waitForURL('**/invoices/new');

  // 3. Make the form dirty
  await page.getByPlaceholder('Description / Name').fill('General Checkup');

  // 4. Set up dialog listener for React Router's window.confirm
  let dialogAppeared = false;
  page.on('dialog', async dialog => {
    dialogAppeared = true;
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('unsaved changes');
    await dialog.dismiss(); // Click 'Cancel' to stay on the page
  });

  // 5. Attempt to navigate away via the sidebar
  await page.locator('nav').getByText('Dashboard').click();

  // Give the UI a millisecond to process the click and dialog
  await page.waitForTimeout(200);

  // 6. Verify the guard worked
  expect(dialogAppeared).toBe(true);
  await expect(page).toHaveURL(/.*\/invoices\/new/);
});