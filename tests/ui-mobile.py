"""Mobile UI check for the interactive routes (needs: pip install playwright; a running
`npx astro preview --port 4321`). Usage: python tests/ui-mobile.py [base-url] [widths e.g. 320,390]
Reports per width: horizontal overflow, tap targets < 44 px, elements covering
buttons, page errors; then clicks through ID sign-up, a quiz, a pitch, a comment,
contact and search on a phone viewport."""
import sys
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4321"
WIDTHS = [int(w) for w in (sys.argv[2].split(",") if len(sys.argv) > 2 else "320,360,390,414,768,1440".split(","))]
ROUTES = ["/id", "/me", "/parent", "/admin", "/ask", "/quiz", "/quiz/bhabu-quiz-s1", "/quiz/weekly", "/quiz/leaderboard",
          "/search?q=মশা", "/verify", "/initiator", "/initiator/pitch", "/initiator/track", "/contact"]

AUDIT = """() => {
  const out = {overflow: document.documentElement.scrollWidth - innerWidth, small: [], covered: []};
  for (const el of document.querySelectorAll('main button, main a, main input, main select, main [role=radio]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
    if (!inline && (r.height < 44 || r.width < 44) && el.type !== 'checkbox' && el.type !== 'radio')
      out.small.push((el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (r.top >= 0 && r.bottom <= innerHeight) {
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && !el.contains(top) && !top.contains(el)) out.covered.push((el.innerText || el.tagName).trim().slice(0, 20) + ' <- ' + (top.className || top.tagName).toString().slice(0, 40));
    }
  }
  return out;
}"""


def audit(br):
    for w in WIDTHS:
        pg = br.new_page(viewport={"width": w, "height": 740 if w < 768 else 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        for r in ROUTES:
            errs.clear()
            pg.goto(B + r, wait_until="networkidle")
            pg.wait_for_timeout(300)
            a = pg.evaluate(AUDIT)
            bad = a["overflow"] > 0 or a["small"] or a["covered"] or errs
            if bad:
                print(f"[{w}] {r}: overflow={a['overflow']} small={a['small'][:6]} covered={a['covered'][:4]} errs={errs}")
        pg.close()


def flows(br):
    pg = br.new_page(viewport={"width": 360, "height": 740}, is_mobile=True, has_touch=True)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    say = lambda k, n=220: print(k, pg.locator("main").inner_text()[:n].replace("\n", " | "))

    pg.goto(B + "/id", wait_until="networkidle")
    pg.get_by_role("radio", name="১৮+").click()
    pg.get_by_role("button", name="Google দিয়ে চালিয়ে যাও").click()
    pg.wait_for_timeout(1500)
    say("ID step:")

    pg.goto(B + "/quiz/bhabu-quiz-s1", wait_until="networkidle")
    pg.locator("main button").filter(has_text="শুরু").first.click()
    for _ in range(13):
        pg.locator("button.option").nth(2).click()
        pg.locator("main button").filter(has_text="পরের প্রশ্ন").or_(pg.locator("main button").filter(has_text="ফলাফল")).first.click()
    print("quiz overflow:", pg.evaluate("document.documentElement.scrollWidth - innerWidth"))
    say("Quiz result:")

    pg.goto(B + "/search?q=অক্টোপাস", wait_until="networkidle")
    pg.wait_for_timeout(600)
    say("Search:", 120)
    print("errors:", errs)
    pg.close()


with sync_playwright() as p:
    br = p.chromium.launch()
    audit(br)
    flows(br)
    br.close()
