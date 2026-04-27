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

async function openEditorFromDashboard(page: Page) {
  const openRecentButton = page.getByRole("button", { name: "Open Recent" });
  if (await openRecentButton.isEnabled()) {
    await openRecentButton.click();
  } else {
    await page.getByRole("button", { name: "Start Writing" }).click();
  }
  await expect(page).toHaveURL(/\/script\//);
  await expect(page.locator("textarea").first()).toBeVisible();
}

async function buildEnoughContentForMultiplePages(page: Page) {
  const firstBlock = page.locator("textarea").first();
  await firstBlock.click();
  await firstBlock.fill("INT. PAGINATION TEST ROOM - DAY");
  await page.keyboard.press("Enter");

  const scriptPages = page.locator("main section").filter({
    has: page.locator("textarea"),
  });

  const longActionLine =
    "A long action line that keeps the page filling in a natural screenplay rhythm.";
  let paginated = false;

  for (let i = 0; i < 120; i += 1) {
    let currentBlock = page.locator("textarea:focus");
    if ((await currentBlock.count()) === 0) {
      currentBlock = page.locator("textarea").last();
      await currentBlock.click();
      currentBlock = page.locator("textarea:focus");
    }
    await expect(currentBlock).toBeFocused();
    await currentBlock.fill(`Action beat ${i + 1}. ${longActionLine} ${longActionLine}`);

    if ((i + 1) % 6 === 0) {
      const pageCount = await scriptPages.count();
      if (pageCount > 1) {
        paginated = true;
        break;
      }
    }

    await page.keyboard.press("Enter");
  }

  const finalPageCount = await scriptPages.count();
  expect(paginated || finalPageCount > 1).toBeTruthy();
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

  const titlePageToggleButton = page.getByRole("button", {
    name: "Title Page",
  });
  await titlePageToggleButton.click();
  await expect(page.getByPlaceholder("UNTITLED SCRIPT")).toBeVisible();

  const scriptTitleInput = page.getByPlaceholder("UNTITLED SCRIPT");
  await scriptTitleInput.fill("QA Test Script");
  await page.getByPlaceholder("Author Name").fill("QA Writer");
  await page.getByPlaceholder("Based on (optional)").fill("Original concept");
  await page
    .locator('textarea[placeholder*="contact@email.com"]')
    .fill("qa@example.com");
  await page.getByPlaceholder("Draft date").fill("April 27, 2026");

  await page.screenshot({
    path: testInfo.outputPath("title-page.png"),
    fullPage: true,
  });

  await titlePageToggleButton.click();

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

  await page.getByRole("button", { name: "Title Page" }).click();
  await expect(page.getByPlaceholder("UNTITLED SCRIPT")).toBeVisible();
  await expect(page.getByPlaceholder("Author Name")).toBeVisible();
  await expect(page.getByPlaceholder("Based on (optional)")).toBeVisible();

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

test("opening an existing script renders visible editor content", async ({ page }) => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set VITE_TEST_EMAIL and VITE_TEST_PASSWORD to run this QA flow."
  );

  await login(page);
  await page.getByRole("button", { name: "Start Writing" }).click();
  await expect(page).toHaveURL(/\/script\//);

  const firstBlock = page.locator("textarea").first();
  await firstBlock.fill("INT. OPENING TEST - DAY");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Open Recent" }).click();
  await expect(page).toHaveURL(/\/script\//);

  const scriptPages = page.locator("main section").filter({
    has: page.locator("textarea"),
  });
  await expect(scriptPages.first()).toBeVisible();
  await expect(page.locator("textarea").first()).toHaveValue("INT. OPENING TEST - DAY");
});

test("renders pages and supports typing across page boundaries with visible content", async ({
  page,
}) => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set VITE_TEST_EMAIL and VITE_TEST_PASSWORD to run this QA flow."
  );

  await login(page);
  await openEditorFromDashboard(page);
  await buildEnoughContentForMultiplePages(page);

  const scriptPages = page.locator("main section").filter({
    has: page.locator("textarea"),
  });
  const pageCount = await scriptPages.count();
  expect(pageCount).toBeGreaterThan(1);

  const firstPage = scriptPages.first();
  const secondPage = scriptPages.nth(1);
  await expect(firstPage).toBeVisible();
  await secondPage.scrollIntoViewIfNeeded();
  await expect(secondPage).toBeVisible();

  const boundaryBefore = firstPage.locator("textarea").last();
  const boundaryBeforeText =
    "Boundary before break.\nBoundary before break.\nBoundary before break.";
  await boundaryBefore.scrollIntoViewIfNeeded();
  await boundaryBefore.click();
  await boundaryBefore.fill(boundaryBeforeText);
  await page.keyboard.press("Enter");

  const focusedAfterEnter = page.locator("textarea:focus");
  await expect(focusedAfterEnter).toBeVisible();
  const boundaryAfterText = "Boundary after break.";
  await focusedAfterEnter.fill(boundaryAfterText);

  const values = await page.locator("textarea").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLTextAreaElement).value)
  );
  expect(values.some((value) => value.includes("Boundary before break."))).toBeTruthy();
  expect(values.some((value) => value.includes(boundaryAfterText))).toBeTruthy();
});
