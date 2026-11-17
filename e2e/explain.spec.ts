import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// Project v1's core task, as a new reader does it: open a chapter, select a word, choose
// AI explain, read what it means in that sentence, save it, and find it in the notebook with
// its explanation. Uses reader A (see notebook-privacy.spec.ts) and the real Claude API:
// about $0.0005 the first time, nothing after, since the server keeps each explanation.

const EMAIL = process.env.E2E_READER_A_EMAIL ?? "";
const CHAPTER = 7;
const WORD = "entailed";

const card = (page: Page) => page.locator('section[aria-labelledby="explain-heading"]');
const saves = (r: { url(): string; request(): { method(): string } }) =>
  r.url().includes("/rest/v1/saved_words") && r.request().method() === "POST";

/**
 * Select `phrase` in the chapter's text the way a reader would, with a real DOM selection.
 * Re-renders right after load (the notebook arriving) replace the text and drop a selection
 * made too early, so select again until it holds.
 */
async function select(page: Page, phrase: string) {
  await expect(async () => {
    await page.locator(`[data-chapter="${CHAPTER}"]`).evaluate((root, phrase) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent?.indexOf(phrase) ?? -1;
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + phrase.length);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      throw new Error(`"${phrase}" isn't in the text`);
    }, phrase);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(phrase);
  }).toPass({ timeout: 15_000 });
}

test("signed out, /api/explain says so and calls nothing", async ({ request }) => {
  const res = await request.post("/api/explain", { data: { chapter: CHAPTER, paragraph: 0, selection: WORD } });
  expect(res.status()).toBe(401);
});

test("select a word, explain it, save it, find it in the notebook", async ({ page }) => {
  test.skip(!EMAIL, "Set E2E_READER_A_EMAIL in .env.local");
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: EMAIL });

  // Start clean, if an earlier run saved it: wait for Supabase to delete it before leaving.
  await page.goto("/notebook");
  await expect(page.getByRole("heading", { level: 1, name: "Notebook" })).toBeVisible();
  const remove = page.getByRole("button", { name: `Remove “${WORD}”` });
  if (await remove.count()) {
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/rest/v1/saved_words") && r.request().method() === "DELETE"),
      remove.click(),
    ]);
  }

  await page.goto(`/read/${CHAPTER}`);
  await select(page, WORD);
  await page.getByRole("button", { name: "AI explain", exact: true }).click();

  await expect(card(page).getByRole("heading", { name: `“${WORD}”` })).toBeVisible();
  // The answer, with where it came from: here, Wikipedia's article on the entail.
  await expect(card(page).getByText("Written by AI for this sentence")).toBeVisible({ timeout: 30_000 });
  await expect(card(page).getByRole("link", { name: /^Wikipedia:/ })).toBeVisible();

  const [saved] = await Promise.all([
    page.waitForResponse(saves),
    card(page).getByRole("button", { name: "Save to notebook" }).click(),
  ]);
  expect(saved.status(), "Supabase accepted the word with its explanation").toBe(201);
  await expect(card(page).getByText("In your notebook")).toBeVisible();

  // Loaded fresh from Supabase: the word, marked Explained, with the same note.
  await page.goto("/notebook");
  const entry = page.locator("li", { has: page.getByRole("heading", { level: 3, name: WORD, exact: true }) });
  await expect(entry.getByText("Explained", { exact: true })).toBeVisible();
  await expect(entry.getByText("Written by AI for this sentence")).toBeVisible();
});
