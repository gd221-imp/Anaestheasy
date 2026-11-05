// End-to-end journeys through the built app (dist/index.html) on an iPhone 14-sized screen.
// Run from tests/e2e: `npm test` (WebKit, needs `npx playwright install webkit`) or `npm run test:chrome`.
const {test, expect} = require('@playwright/test');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const APP = pathToFileURL(path.resolve(__dirname, '..', '..', 'dist', 'index.html')).href;

// Open the app as a returning user (skips the starting-point questions)
async function openAsReturningUser(page, hash = '') {
  await page.addInitScript(() => {
    if (!localStorage.getItem('pathway-profile')) localStorage.setItem('pathway-profile', JSON.stringify({email: 'test@nhs.net'}));
  });
  await page.goto(APP + hash);
  await page.waitForFunction(() => typeof ALL !== 'undefined');
}
const sheet = page => page.locator('#sheet');
const sheetTitle = page => page.locator('#sheet .sh-title');

test.describe('first visit', () => {
  test('starting-point questions place a core trainee and the progress survives a reload', async ({page}) => {
    await page.goto(APP);
    await expect(sheetTitle(page)).toHaveText('Getting started');

    // a non-NHS address is refused
    await page.fill('#pq-email', 'someone@gmail.com');
    await page.click('#pq-next');
    await expect(page.locator('#pq-err')).toContainText('NHS email');

    await page.fill('#pq-email', 'test@nhs.net');
    await page.click('#pq-next');
    // answer as an anaesthetic trainee who has passed the Primary and is in Stage 2 but not yet sat the Final
    const options = await page.evaluate(() => ({role: PQ.role.o[2], exam: PQ.exam.o[2]}));
    for (const answer of [options.role, options.exam, 'Yes', 'No']) {
      await page.locator('.ochip', {hasText: answer}).first().click();
    }
    await expect(page.locator('.result')).toBeVisible();
    await expect(page.locator('.result span')).toHaveText('Stage 2');
    await page.click('#pq-go');
    await expect(sheet(page)).toBeHidden();

    const before = await page.evaluate(() => ({done: state.done.length, profile: localStorage.getItem('pathway-profile')}));
    expect(before.done).toBeGreaterThan(10);
    expect(before.profile).toContain('test@nhs.net');

    await page.reload();
    await page.waitForFunction(() => typeof ALL !== 'undefined');
    await expect(sheet(page)).toBeHidden(); // no questions the second time
    expect(await page.evaluate(() => state.done.length)).toBe(before.done);
  });
});

test.describe('learning', () => {
  test('finishing the first stop earns coffees and unlocks the next stop', async ({page}) => {
    await openAsReturningUser(page);
    const first = await page.evaluate(() => ({id: ALL[0].id, next: ALL[1].id, xp: state.xp}));
    expect(await page.evaluate(id => isLocked(ALL.find(s => s.id === id)), first.next)).toBe(true);

    await page.evaluate(id => openSub(id, subsOf(ALL.find(s => s.id === id))[0].id), first.id);
    for (let i = 0; i < 60 && !(await page.locator('#brew').count()); i++) {
      if (await page.locator('#nextTab').count()) await page.click('#nextTab');
      else if (await page.locator('.opt').count() && (await page.locator('#next').isDisabled())) await page.locator('.opt').first().click();
      else await page.click('#next');
    }
    await expect(page.locator('#brew')).toBeVisible(); // the coffee-machine finish screen
    await page.click('#finish');

    const after = await page.evaluate(id => ({xp: state.xp, done: state.done.includes(id)}), first.id);
    expect(after.done).toBe(true);
    expect(after.xp).toBeGreaterThan(first.xp);
    await expect(page.locator('#xp')).toHaveText(String(after.xp));
    expect(await page.evaluate(id => isLocked(ALL.find(s => s.id === id)), first.next)).toBe(false);
  });

  test('contents search finds a stop and opens it', async ({page}) => {
    await openAsReturningUser(page);
    await page.click('#contentsBtn');
    await page.fill('#cq', 'ruptured');
    await page.locator('#sheet .crow', {hasText: 'Ruptured AAA'}).first().click();
    await expect(sheetTitle(page)).toContainText('Ruptured AAA');
  });

  test('a deep link opens the stop at the named tab', async ({page}) => {
    await openAsReturningUser(page, '#stop=st2-15&tab=Anaesthetic%20recipe');
    await expect(sheetTitle(page)).toContainText('Ruptured AAA');
    await expect(page.locator('#sheet .tchip.on')).toHaveText(/Anaesthetic recipe/);
  });
});

test.describe('calculators', () => {
  test('paeds drug sheet: 4 years and 16 kg gives paracetamol 240 mg', async ({page}) => {
    await openAsReturningUser(page);
    await page.click('#drugsBtn');
    await page.click('[data-dtab="paeds"]');
    await page.fill('#pa', '4');
    await page.fill('#pw', '16');
    const paracetamol = page.locator('#pout tr', {hasText: 'Paracetamol'}).first();
    await expect(paracetamol).toContainText('240 mg');
    await expect(page.locator('#pout')).not.toContainText('NaN');
  });

  test('60% tax check responds to a payslip entry', async ({page}) => {
    await openAsReturningUser(page);
    const id = await page.evaluate(() => ALL.find(s => s.cards.some(c => c.h === '60% tax check')).id);
    await page.goto(APP + `#stop=${id}&tab=${encodeURIComponent('60% tax check')}`);
    // the tracker lives in a shadow root on .taxmount; Playwright's locators reach inside it
    const tracker = page.locator('#sheet .taxmount');
    await expect(tracker.locator('#slipTaxable')).toBeVisible();
    const text = () => page.evaluate(() => document.querySelector('#sheet .taxmount').shadowRoot.textContent);
    const before = await text();
    await tracker.locator('#slipTaxable').fill('9000');
    await tracker.locator('#slipForm button[type="submit"]').click();
    await expect.poll(text).not.toBe(before);
    await expect.poll(text).not.toContain('NaN');
  });
});

test.describe('follow-ups', () => {
  test('a case is saved and a hospital number is refused', async ({page}) => {
    await openAsReturningUser(page);
    await page.click('#fuBtn');
    await page.fill('#fuLabel', 'Lap chole RXH 1234567');
    await page.click('#fuForm button[type="submit"]');
    await expect(page.locator('#fuErr')).toContainText('hospital or NHS number');
    await page.fill('#fuLabel', 'Lap chole, Theatre 4, difficult airway');
    await page.click('#fuForm button[type="submit"]');
    await expect(page.locator('.fumsg')).toContainText('Saved');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pathway-followups')).length)).toBe(1);
  });
});

test.describe('fits the screen', () => {
  // Nothing should make the page scroll sideways on a phone; wide tables must scroll inside their own box
  const screens = {
    'the path': null,
    Contents: () => openContents(),
    Curriculum: () => openCurriculum(),
    ARCP: () => openARCP(),
    'Adult drugs': () => openDrugs(),
    'Paeds drugs': () => openPaedDrugs(),
    Events: () => openEvents(),
    Forum: () => openForum(),
    'Follow-ups': () => openFollowups(),
    'A recipe': () => openSub('st2-15', '0'),
    'The 60% tax check': () => {
      const st = ALL.find(s => s.cards.some(c => c.h === '60% tax check'));
      openSub(st.id, subsOf(st).find(x => x.name === '60% tax check').id);
    }
  };
  for (const [name, open] of Object.entries(screens)) {
    test(`${name} does not scroll sideways`, async ({page}) => {
      await openAsReturningUser(page);
      if (open) await page.evaluate(open);
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const s = document.getElementById('sheet'),
          body = s && !s.hidden ? s.querySelector('.sh-body') : null;
        return {
          page: document.documentElement.scrollWidth - window.innerWidth,
          sheet: body ? body.scrollWidth - body.clientWidth : 0
        };
      });
      expect(r.page, 'page wider than the screen (px)').toBeLessThanOrEqual(0);
      expect(r.sheet, 'sheet wider than the screen (px)').toBeLessThanOrEqual(0);
    });
  }
});
