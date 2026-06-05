import { test, expect } from '@playwright/test';

test.describe('Visual regression', () => {
  test('Login page se ve correctamente', async ({ page }) => {
    await page.goto('/');
    // Esperar a que el splash termine y el login aparezca
    await expect(page.getByPlaceholder('cajero@empresa.com')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
    await expect(page).toHaveScreenshot('login.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('Formulario de registro se ve correctamente', async ({ page }) => {
    await page.goto('/');
    // Navegar al registro haciendo clic en el enlace
    await page.getByText(/registr/i).click();
    await expect(page.getByText('Registro de Cajero')).toBeVisible();
    await expect(page.getByPlaceholder('Juan Pérez')).toBeVisible();
    await expect(page).toHaveScreenshot('register.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('Login cambia a modo PIN', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /PIN Cajero/i }).click();
    await expect(page.getByText(/Código PIN/i)).toBeVisible();
    await expect(page).toHaveScreenshot('login-pin-mode.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });
});
