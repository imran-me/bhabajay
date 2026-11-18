"""Import the real weekly quiz (Bhaba Jay Project 41) into src/data/quizzes.json.

Usage: python scripts/import-p41-quiz.py "<path to Project 41 Season folder>"
Reads the question/answer .txt + question card .png (never modifies the source),
writes WebP cards to ../bhabajay-media/quiz/p41/ (no media in git) and a 'season' quiz entry.
"""
import json, re, sys
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT.parent / "bhabajay-media" / "quiz" / "p41"  # outside git; uploaded to public_html/media/
OUT.mkdir(parents=True, exist_ok=True)
LET = {"ক": 0, "খ": 1, "গ": 2, "ঘ": 3}
BN = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")


def webp(png: Path, name: str) -> str:
    im = Image.open(png).convert("RGB")
    im.thumbnail((960, 1200))
    dst = OUT / f"{name}.webp"
    for q in (80, 70, 60, 50):
        im.save(dst, "WEBP", quality=q, method=6)
        if dst.stat().st_size < 300_000:
            break
    return f"/media/quiz/p41/{name}.webp"


questions = []
for qtxt in sorted(SRC.glob("* P41 Q?? * question.txt")):
    m = re.search(r"P41 Q(\d\d) (.+) question\.txt$", qtxt.name)
    num, topic = m.group(1), m.group(2)
    lines = [l.strip() for l in qtxt.read_text(encoding="utf-8").splitlines()]
    opts = [None] * 4
    for l in lines:
        mm = re.match(r"^([কখগঘ])\)\s*(.+)$", l)
        if mm:
            opts[LET[mm.group(1)]] = mm.group(2)
    body = [l for l in lines[1:] if l]
    q = body[0]
    credit = next((l for l in lines if l.startswith("ছবি:")), "")
    atxt = next(SRC.glob(f"* P41 Q{num} * answer.txt"))
    a = atxt.read_text(encoding="utf-8")
    ans = LET[re.search(r"সঠিক উত্তর:\s*\(([কখগঘ])\)", a).group(1)]
    why = re.search(r"কেন\?\s*\n(.*?)\n\s*\n", a, re.S)
    why = " ".join(re.sub(r"^[০-৯]+\.\s*", "", l.strip()) for l in why.group(1).splitlines() if l.strip()) if why else ""
    knew = re.search(r"^(জানতেন\?.*)$", a, re.M)
    fact = why + (" " + knew.group(1) if knew else "")
    img = webp(qtxt.with_suffix(".png"), f"q{num}-{re.sub(r'[^a-z0-9]+', '-', topic.lower()).strip('-')}")
    assert all(opts), qtxt.name
    questions.append({"id": f"p41-{num}", "q": q, "options": opts, "answer": ans, "fact": fact.strip(),
                      "image": img, "imageAlt": f"ভাবু কুইজ সপ্তাহ {num.translate(BN)}: {q}", "credit": credit.removeprefix("ছবি:").strip()})

data_path = ROOT / "src" / "data" / "quizzes.json"
data = json.loads(data_path.read_text(encoding="utf-8"))
data = [x for x in data if x["slug"] != "bhabu-quiz-s1"]
data.append({
    "slug": "bhabu-quiz-s1",
    "kind": "season",
    "title": "ভাবু কুইজ · সিজন ১",
    "blurb": f"ফেসবুকের সাপ্তাহিক ভাবু কুইজের আসল {str(len(questions)).translate(BN)}টি প্রশ্ন — অক্টোপাস থেকে সাগরের অক্সিজেন।",
    "secondsPerQuestion": 20,
    "questions": questions,
})
data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(len(questions), "questions")
