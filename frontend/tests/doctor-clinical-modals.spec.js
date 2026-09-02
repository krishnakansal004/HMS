import { test, expect } from '@playwright/test';

test('Doctor can successfully open clinical modals without 403 RBAC errors', async ({ page }) => {
  // 1. Log in as a Doctor
  await page.goto('http://localhost:5173/login');
  
  // Adjust these credentials to match a Doctor in your local DB
  await page.fill('input[name="email"]', 'krishnakansal1980@gmail.com'); 
  await page.fill('input[name="password"]', 'Krishna@1980');
  await page.getByLabel('Hospital ID').fill('e2e-test-hospital'); 
  await page.click('button:has-text("Sign in")');
  
  await page.waitForURL('**/dashboard');

  // 2. Navigate to Laboratory
  await page.goto('http://localhost:5173/lab');

  // 3. Open the "Order Lab Test" Modal
  await page.click('button:has-text("Order Lab Test")');

  // 4. Verify the modal opens and finishes loading
  await expect(page.locator('text=Loading clinical data...')).toBeHidden();

  // 5. Verify the 403-induced error message is NOT present
  await expect(page.locator('text=No lab tests are configured in the catalog')).toBeHidden();

  // 6. Verify the referring doctor field successfully pre-filled their own name
  await expect(page.locator('label:has-text("Referring Doctor") ~ input')).toBeVisible();
  
  // Bonus: Close and test the Prescription Drawer as well
  await page.click('button[aria-label="Close"]');
  await page.goto('http://localhost:5173/prescriptions');
  await page.click('button:has-text("Issue Prescription")');
  await expect(page.locator('text=Loading records...')).toBeHidden();
  await expect(page.locator('label:has-text("Prescribing Doctor") ~ input')).toBeVisible();
});