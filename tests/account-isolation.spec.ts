import { expect, test, type Page } from "@playwright/test";
import { loadEnv } from "vite";

const env = loadEnv("", process.cwd(), "");
const TEST_EMAIL_A =
  process.env.VITE_TEST_EMAIL_A ??
  process.env.VITE_TEST_EMAIL ??
  env.VITE_TEST_EMAIL_A ??
  env.VITE_TEST_EMAIL ??
  "";
const TEST_PASSWORD_A =
  process.env.VITE_TEST_PASSWORD_A ??
  process.env.VITE_TEST_PASSWORD ??
  env.VITE_TEST_PASSWORD_A ??
  env.VITE_TEST_PASSWORD ??
  "";
const TEST_EMAIL_B = process.env.VITE_TEST_EMAIL_B ?? env.VITE_TEST_EMAIL_B ?? "";
const TEST_PASSWORD_B =
  process.env.VITE_TEST_PASSWORD_B ?? env.VITE_TEST_PASSWORD_B ?? "";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function createScriptAndRename(page: Page, title: string, marker: string) {
  await page.getByRole("button", { name: "Start Writing" }).click();
  await expect(page).toHaveURL(/\/script\//);

  const firstBlock = page.locator("textarea").first();
  await expect(firstBlock).toBeVisible();
  await firstBlock.fill(`INT. ${marker} - DAY`);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const firstRow = page.locator("ul li").first();
  await firstRow.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("heading", { name: "Rename script" })).toBeVisible();
  await page.locator("input").first().fill(title);
  await page.getByRole("button", { name: "Save Name" }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("account isolation between user A and user B", async ({ page }) => {
  test.skip(
    !TEST_EMAIL_A ||
      !TEST_PASSWORD_A ||
      !TEST_EMAIL_B ||
      !TEST_PASSWORD_B ||
      TEST_EMAIL_A === TEST_EMAIL_B,
    "Set distinct VITE_TEST_EMAIL_A/VITE_TEST_PASSWORD_A and VITE_TEST_EMAIL_B/VITE_TEST_PASSWORD_B."
  );

  const runId = Date.now();
  const titleA = `Isolation A ${runId}`;
  const titleB = `Isolation B ${runId}`;

  await login(page, TEST_EMAIL_A, TEST_PASSWORD_A);
  await createScriptAndRename(page, titleA, `ISOLATION-A-${runId}`);
  await logout(page);

  await login(page, TEST_EMAIL_B, TEST_PASSWORD_B);
  await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
  await createScriptAndRename(page, titleB, `ISOLATION-B-${runId}`);
  await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
  await logout(page);

  await login(page, TEST_EMAIL_A, TEST_PASSWORD_A);
  await expect(page.getByText(titleA, { exact: true })).toBeVisible();
  await expect(page.getByText(titleB, { exact: true })).toHaveCount(0);
});
