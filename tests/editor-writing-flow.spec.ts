import { expect, test, type Page } from "@playwright/test";
import { loadEnv } from "vite";

const env = loadEnv("", process.cwd(), "");
const TEST_EMAIL = process.env.VITE_TEST_EMAIL ?? env.VITE_TEST_EMAIL ?? "";
const TEST_PASSWORD =
  process.env.VITE_TEST_PASSWORD ?? env.VITE_TEST_PASSWORD ?? "";

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");

  const emailInput = page.getByLabel("Email");
  await expect(emailInput).toBeVisible();
  await emailInput.fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("human writing flow through dashboard and editor", async ({ page }, testInfo) => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set VITE_TEST_EMAIL and VITE_TEST_PASSWORD to run this QA flow."
  );

  await login(page);

  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Start Writing" }).click();
  await expect(page).toHaveURL(/\/script\//);

  const showTitlePageButton = page.getByRole("button", {
    name: "Show Title Page",
  });
  await showTitlePageButton.click();
  await expect(
    page.getByRole("button", { name: "Hide Title Page" })
  ).toBeVisible();

  const scriptTitleInput = page.getByPlaceholder("UNTITLED SCRIPT");
  await scriptTitleInput.fill("QA Test Script");
  await page.getByPlaceholder("Author Name").fill("QA Writer");
  await page.getByPlaceholder("Based on...").fill("Original concept");
  await page
    .locator('textarea[placeholder*="contact@email.com"]')
    .fill("qa@example.com");
  await page.getByPlaceholder("Draft date").fill("April 27, 2026");

  await page.screenshot({
    path: testInfo.outputPath("title-page.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Hide Title Page" }).click();

  const elementSelector = page.locator('select[title="Element Type"]');
  const firstBlock = page.locator("textarea").first();
  await firstBlock.click();
  await firstBlock.fill("");

  await page.keyboard.press("Shift+Tab");
  await expect(elementSelector).toHaveValue("scene_heading");

  await firstBlock.type("int");
  await expect(page.getByRole("button", { name: "INT.", exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(firstBlock).toHaveValue("INT.");
  await firstBlock.type(" APARTMENT - NIGHT");

  await page.keyboard.press("Enter");
  const secondBlock = page.locator("textarea").nth(1);
  await expect(secondBlock).toBeFocused();
  await secondBlock.type("Rain taps against the window.");

  await page.keyboard.press("Enter");
  const thirdBlock = page.locator("textarea").nth(2);
  await expect(thirdBlock).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(elementSelector).toHaveValue("character");
  await page.keyboard.press("Shift+Tab");
  await expect(elementSelector).toHaveValue("action");
  await page.keyboard.press("Tab");
  await expect(elementSelector).toHaveValue("character");

  await thirdBlock.type("MAYA");
  await page.keyboard.press("Enter");
  await expect(elementSelector).toHaveValue("dialogue");

  const dialogueBlock = page.locator("textarea").nth(3);
  await expect(dialogueBlock).toBeFocused();
  await dialogueBlock.type("I thought you left.");

  await page.keyboard.press("Enter");
  await expect(elementSelector).toHaveValue("action");

  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(elementSelector).toHaveValue("transition");

  const transitionBlock = page.locator("textarea").nth(4);
  await transitionBlock.type("cut");
  await expect(page.getByRole("button", { name: "CUT TO:" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(transitionBlock).toHaveValue("CUT TO:");

  await page.keyboard.press("Enter");
  await expect(elementSelector).toHaveValue("scene_heading");

  const finalSceneBlock = page.locator("textarea").nth(5);
  await finalSceneBlock.type("ext");
  await expect(page.getByRole("button", { name: "EXT.", exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(finalSceneBlock).toHaveValue("EXT.");
  await finalSceneBlock.type(" STREET - NIGHT");

  await page.screenshot({
    path: testInfo.outputPath("editor-page.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Open Recent" }).click();
  await expect(page).toHaveURL(/\/script\//);

  const textareas = page.locator("textarea");
  await expect(textareas.first()).toBeVisible();
  const blockValues = await textareas.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLTextAreaElement).value)
  );

  expect(
    blockValues.some((value) => value.includes("INT. APARTMENT - NIGHT"))
  ).toBeTruthy();
  expect(
    blockValues.some((value) => value.includes("Rain taps against the window."))
  ).toBeTruthy();
  expect(blockValues.some((value) => value.includes("MAYA"))).toBeTruthy();
  expect(
    blockValues.some((value) => value.includes("I thought you left."))
  ).toBeTruthy();
  expect(blockValues.some((value) => value.includes("CUT TO:"))).toBeTruthy();
  expect(
    blockValues.some((value) => value.includes("EXT. STREET - NIGHT"))
  ).toBeTruthy();

  await page.getByRole("button", { name: "Show Title Page" }).click();
  await expect(page.getByPlaceholder("UNTITLED SCRIPT")).toHaveValue(
    "QA Test Script"
  );
  await expect(page.getByPlaceholder("Author Name")).toHaveValue("QA Writer");
  await expect(page.getByPlaceholder("Based on...")).toHaveValue(
    "Original concept"
  );

  await page.screenshot({
    path: testInfo.outputPath("after-reopen.png"),
    fullPage: true,
  });
});

test("iPad-width layout smoke check", async ({ page }, testInfo) => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set VITE_TEST_EMAIL and VITE_TEST_PASSWORD to run this QA flow."
  );

  await page.setViewportSize({ width: 834, height: 1194 });
  await login(page);
  const openRecentButton = page.getByRole("button", { name: "Open Recent" });
  if (await openRecentButton.isEnabled()) {
    await openRecentButton.click();
  } else {
    await page.getByRole("button", { name: "Start Writing" }).click();
  }
  await expect(page).toHaveURL(/\/script\//);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2
  );
  expect(hasHorizontalOverflow).toBeFalsy();

  await page.screenshot({
    path: testInfo.outputPath("ipad-editor-smoke.png"),
    fullPage: true,
  });
});
