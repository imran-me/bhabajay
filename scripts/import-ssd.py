"""Import finished ভাবা যায়! project posts from the brand folder into the site.

Usage:  python scripts/import-ssd.py "<path to Bhaba Jay folder>"

Reads only (never writes to the source folder). For every project listed in
SERIES below it pairs each dated caption .txt with its card images, converts
the first cards to WebP , and writes
database/seed/*.sql (text only). Images go OUTSIDE git to
<repo>/../bhabajay-media/<series>/ (or argv[2]) and are served from /media/.
"""
import json, re, sys, shutil
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
REPO = Path(__file__).resolve().parent.parent
IMG = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO.parent / 'bhabajay-media'
SEED = REPO / 'database' / 'seed'
MAX_CARDS = 2
WIDTH = 960

TEAL = {'from': '#0E7C7B', 'to': '#17A2A0', 'ink': 'light'}
CORAL = {'from': '#FF6B5B', 'to': '#FF9466', 'ink': 'light'}
MINT = {'from': '#BDEBD7', 'to': '#E8F7F0', 'ink': 'dark'}
DEEP = {'from': '#0B4F57', 'to': '#0E7C7B', 'ink': 'light'}

# project number: slug, title, tagline, subject, topic, doodle, colour, bg, description
SERIES = {
    14: ('goyenda-bhabu', 'গোয়েন্দা ভাবু', 'ছবিতে সূত্র, উত্তর পরের দিন', 'রহস্য + বিজ্ঞান', 'physics', 'eye', DEEP, 'deep',
         'প্রতিটা কেসে একটা অদ্ভুত ঘটনা, কয়েকটা সূত্র আর একটা প্রশ্ন। আগে নিজে মাথা খাটান, পরের দিন ভাবু খুলে বলে আসল কারণটা কী, আর তার পেছনের বিজ্ঞান।'),
    16: ('mon-bhalo-bhabu', 'মন ভালো ভাবু', 'মন খারাপের দিনেও কাজে লাগে এমন বিজ্ঞান', 'মন + অনুভূতি', 'health', 'heart', CORAL, 'coral',
         'অনুভূতির নাম দেওয়া, প্রকৃতিতে কুড়ি মিনিট, পোষা প্রাণীর সঙ্গে দশ মিনিট: ছোট ছোট অভ্যাস কীভাবে মন ভালো রাখে, গবেষণা কী বলে, সেটাই এই সিরিজ।'),
    17: ('dadur-khata', 'দাদুর খাতা', 'বাংলার বিজ্ঞানী আর ইতিহাসের গল্প', 'ইতিহাস + বিজ্ঞানী', 'history', 'book', TEAL, 'teal',
         'জগদীশচন্দ্র থেকে সত্যেন বসু, পুরোনো বাংলার আবিষ্কার আর মানুষ। দাদুর পুরোনো খাতার পাতা উল্টে দেখা, আমাদের মাটিতে বিজ্ঞান কতদূর গিয়েছিল।'),
    18: ('time-machine-tiffin-box', 'টাইম মেশিন টিফিন বক্স', 'টিফিন বক্স খুললেই অন্য যুগ', 'কল্পবিজ্ঞান', 'physics', 'sparkle', DEEP, 'deep',
         'একটা টিফিন বক্স, যার ঢাকনা খুললেই অতীত বা ভবিষ্যৎ। প্রতিটা পর্বে মজার গল্প, আর গল্পের ভেতরে লুকানো এক টুকরো সত্যিকারের বিজ্ঞান।'),
    20: ('rohosser-dwip', 'রহস্যের দ্বীপ', 'ধারাবাহিক রহস্য-উপন্যাস, পর্বে পর্বে', 'ধারাবাহিক গল্প', 'nature', 'leaf', TEAL, 'teal',
         'বঙ্গোপসাগরের এক অচেনা দ্বীপে আটকে পড়া একদল কৌতূহলী মানুষ। প্রতি পর্বে নতুন রহস্য, আর প্রতিটার সমাধান আসে বিজ্ঞান দিয়ে।'),
    21: ('dhaka-2100', 'ঢাকা ২১০০', 'আমাদের শহরের ভবিষ্যৎ, সংখ্যায়', 'ভবিষ্যৎ + জলবায়ু', 'nature', 'drop', TEAL, 'teal',
         '২০৫০-এ ঢাকা কত বড় হবে, ২১০০-তে সাগর কতটা উঠবে, মেট্রো কত মানুষ টানবে? গবেষণার সংখ্যা দিয়ে আমাদের শহরের সামনের দিনগুলো দেখা।'),
    23: ('ghore-boshe-biggan', 'ঘরে বসে বিজ্ঞান', 'রান্নাঘরের জিনিস দিয়ে আসল পরীক্ষা', 'হাতে-কলমে পরীক্ষা', 'chemistry', 'flask', CORAL, 'coral',
         'ডিম ভাসানো, গোলমরিচ দৌড়ানো, চিরুনির জাদু। ঘরে যা আছে তা দিয়েই পরীক্ষা করুন, তারপর দেখুন কেন এমন হলো।'),
    24: ('shorirer-bhetore', 'শরীরের ভেতরে', 'নিজের শরীরটাই সবচেয়ে আশ্চর্য যন্ত্র', 'মানবদেহ', 'body', 'heart', CORAL, 'coral',
         'হৃৎপিণ্ড দিনে কতবার ধুকপুক করে, হাড় কেন ইস্পাতের চেয়ে মজবুত, ঘুমের মধ্যে মস্তিষ্ক কী করে? শরীরের ভেতরের গল্প, সংখ্যা আর ছবিতে।'),
    25: ('moner-khela', 'মনের খেলা', 'মস্তিষ্ক আমাদের যেভাবে বোকা বানায়', 'মনোবিজ্ঞান', 'body', 'bulb', DEEP, 'deep',
         'কেন আমরা ভুল মনে রাখি, কেন একটা গান মাথা থেকে যায় না, কেন অন্যের হাই তোলা দেখে নিজেরও হাই ওঠে। মনোবিজ্ঞানের মজার পরীক্ষাগুলো সহজ ভাষায়।'),
    26: ('pranir-duniya', 'প্রাণীর দুনিয়া', 'চেনা প্রাণীর অচেনা ক্ষমতা', 'প্রাণী', 'biology', 'paw', TEAL, 'teal',
         'পেঁচার নিঃশব্দ ডানা, টিকটিকির আঠাহীন পা, জিরাফের লম্বা গলা। জুম করে দেখা আর সংখ্যার ম্যাজিক, দুই ভঙ্গিতে প্রাণীজগতের বিস্ময়।'),
    27: ('pokar-shohor', 'পোকার শহর', 'ছোট্ট শরীর, বিরাট কাজ', 'পোকামাকড়', 'biology', 'butterfly', MINT, 'mint',
         'পিঁপড়া, মৌমাছি, জোনাকি, প্রজাপতি। প্রতিটা পোকার আছে নিজের পেশা আর বিশেষ যন্ত্র। পোকার শহরের নিয়োগপত্র পড়ে দেখুন কে কী কাজ করে।'),
    28: ('neel-gobhire', 'নীল গভীরে', 'সাগরের নিচের অচেনা পৃথিবী', 'সমুদ্র + মাছ', 'nature', 'fish', TEAL, 'teal',
         'বঙ্গোপসাগর থেকে মহাসাগরের তলা পর্যন্ত। ইলিশের লম্বা যাত্রা, অন্ধকারে জ্বলা মাছ, তিমির গান। গভীরে নামলে যা দেখা যায়।'),
    29: ('praner-bangladesh', 'প্রাণের বাংলাদেশ', 'আমাদের দেশের জীববৈচিত্র্য', 'জীববৈচিত্র্য', 'nature', 'frog', MINT, 'mint',
         'সুন্দরবনের বাঘ থেকে হাওরের পাখি। বাংলাদেশের মাটি আর পানিতে কারা থাকে, কে বিপদে আছে, আর তাদের বাঁচাতে আমরা কী করতে পারি।'),
    30: ('sobuj-bondhu', 'সবুজ বন্ধু', 'গাছেরাও কথা বলে, নিজের ভাষায়', 'উদ্ভিদ', 'nature', 'leaf', MINT, 'mint',
         'লজ্জাবতী কেন গুটিয়ে যায়, সূর্যমুখী কেন সূর্যের দিকে তাকায়, বটগাছ কত বছর বাঁচে? খাতার পাতায় সাঁটা গাছের গল্প।'),
    31: ('mohakashe-bhabu', 'মহাকাশে ভাবু', 'মাথার ওপরের আকাশ, সংখ্যায় আর ছবিতে', 'মহাকাশ', 'space', 'planet', DEEP, 'deep',
         'পৃথিবী সেকেন্ডে কত কিলোমিটার ছোটে, সূর্যের আলো আসতে কত সময় লাগে, শুক্রের একদিন কত লম্বা। আকাশের দিকে তাকানোর নতুন কারণ।'),
    32: ('odrissho-mohabishwo', 'অদৃশ্য মহাবিশ্ব', 'যা দেখা যায় না, তা-ই বেশি', 'বড় পদার্থবিজ্ঞান', 'physics', 'atom', DEEP, 'deep',
         'ডার্ক ম্যাটার, ব্ল্যাক হোল, নিউট্রিনো। মহাবিশ্বের বেশিরভাগটাই আমাদের চোখে অদৃশ্য। বিজ্ঞানীরা তবু কীভাবে টের পান, সেটার গল্প।'),
    33: ('kibhabe-chole', 'কীভাবে চলে?', 'রোজকার যন্ত্রের ভেতরের বিজ্ঞান', 'দৈনন্দিন বিজ্ঞান + শক্তি', 'physics', 'bolt', CORAL, 'coral',
         'ফ্রিজ কীভাবে ঠান্ডা করে, ফ্যান কীভাবে ঘোরে, প্রেশার কুকারে রান্না কেন তাড়াতাড়ি হয়। প্যানেল খুলে দেখা যাক ভেতরে কী চলে।'),
    34: ('bigganir-moto-bhabi', 'বিজ্ঞানীর মতো ভাবি', 'প্রমাণ ছাড়া কথা নয়', 'বিজ্ঞানের পদ্ধতি', 'physics', 'telescope', TEAL, 'teal',
         'ফেয়ার টেস্ট, নিয়ন্ত্রণ দল, নমুনার আকার। বিজ্ঞানীরা কীভাবে সত্য যাচাই করেন, আর সেই কৌশল দিয়ে আমরা রোজকার গুজব কীভাবে ধরতে পারি।'),
    35: ('jontro-ar-ai', 'যন্ত্র আর এআই', 'যন্ত্র কীভাবে "ভাবে"', 'প্রযুক্তি + এআই', 'tech', 'bolt', TEAL, 'teal',
         'মোবাইল ক্যামেরা, জিপিএস, চ্যাটবট। আমাদের হাতের প্রযুক্তি আসলে কীভাবে কাজ করে, আর এআই কী পারে, কী পারে না।'),
    36: ('prithibi-amar-ghor', 'পৃথিবী আমার ঘর', 'জলবায়ু বদলাচ্ছে, আমরাও বদলাতে পারি', 'জলবায়ু + টেকসই উন্নয়ন', 'nature', 'drop', MINT, 'mint',
         'তাপমাত্রা, বৃষ্টি, নদী আর বাতাস। জলবায়ু পরিবর্তন বাংলাদেশে কী করছে, আর প্রতিদিনের কোন ছোট কাজটা সত্যিই কাজে লাগে।'),
    37: ('bhabur-bhabna', 'ভাবুর ভাবনা', 'সহজ প্রশ্ন, কঠিন উত্তর', 'নৈতিকতা + দর্শন', 'history', 'bulb', CORAL, 'coral',
         'সততা কি সবসময় লাভের, ভাগ করলে কেন ভালো লাগে, ন্যায্য মানে কী? দর্শনের বড় প্রশ্ন, গবেষণা আর রোজকার উদাহরণ দিয়ে।'),
    38: ('shobder-jadu', 'শব্দের জাদু', 'প্রতিটা শব্দের একটা ভ্রমণকাহিনি আছে', 'ভাষা + কবিতা', 'history', 'book', CORAL, 'coral',
         'চা, জানালা, আলমারি কোন দেশ থেকে এসে বাংলা হয়ে গেল? শব্দের উৎস, কবিতার ছন্দ আর বাংলা ভাষার মজার সব তথ্য।'),
    39: ('ronge-ronge-bangla', 'রঙে রঙে বাংলা', 'আমাদের শিল্প, রং আর ঐতিহ্য', 'শিল্প + সংস্কৃতি', 'history', 'sparkle', CORAL, 'coral',
         'রিকশা-চিত্র, নকশিকাঁথা, আলপনা, জামদানি। বাংলার শিল্পের পেছনের রসায়ন, অঙ্ক আর গল্প।'),
    40: ('rannaghorer-biggan-season-1', 'রান্নাঘরের বিজ্ঞান: সিজন ১', 'হাঁড়ি-কড়াইয়ের রসায়ন', 'রসায়ন + খাবার', 'food', 'pot', CORAL, 'coral',
         'রান্নাঘরই সবচেয়ে কাছের ল্যাব। ভাত, ডাল, পেঁয়াজ আর চায়ের কাপে প্রতিদিন যে বিজ্ঞান ঘটে, ছবি-কার্ডে।'),
}

EMOJI = re.compile('^[\\W_]+', re.UNICODE)
DATE = re.compile(r'^(\d{4}-\d{2}-\d{2}) (\d{4}) (.+)$')
URL = re.compile(r'https://\S+')
SKIP_DIR = ('superseded', 'draft', 'test', 'audit', 'old', 'reject')


def clean_title(line):
    t = line.strip()
    t = re.sub(r'^[^ঀ-৿A-Za-z0-9“"]+', '', t)
    return t.strip()


def slugify(s):
    s = re.sub(r'^(P\d+\s+)', '', s)
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    return s[:60]


def parse_caption(text):
    text = text.replace('\r', '')
    # drop scheduling / metadata lines (e.g. "পোস্ট: ১৭/০১/২০২৭, রবিবার বিকেল ৫টা")
    text = '\n'.join(l for l in text.split('\n') if not re.match(r'^\s*(পোস্ট|পোস্টের সময়|সময়|Post|Slot)\s*:', l))
    paras = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    title = clean_title(paras[0].split('\n')[0])
    rest = paras[0].split('\n')[1:]
    body = rest + paras[1:]
    out, labels = [], []
    for p in body:
        first = p.split('\n')[0]
        if first.startswith('সূত্র'):
            labels = [x.strip() for x in re.split(r'[·,]', first.split(':', 1)[-1]) if x.strip()]
            continue
        if (first.startswith('#') or 'ফলো করুন' in first or first.startswith('প্রশ্ন:') or first.startswith('💬')
                or ('কমেন্টে' in p and len(p) < 220)):
            continue
        out.append(p)
    if out and '\n' in out[0]:
        head, tail = out[0].split('\n', 1)
        out[0:1] = [head, tail]
    hook = out[0] if out else title
    return title, hook, out[1:] if len(out) > 1 else out, labels


def sources_for(src_md, date, stem):
    if not src_md.exists():
        return []
    txt = src_md.read_text(encoding='utf-8', errors='ignore')
    secs = re.split(r'\n(?=## )', txt)
    m = re.search(r'(\d{2})\b', stem)
    for sec in secs:
        head = sec.split('\n')[0]
        if not head.startswith('## '):
            continue
        if date in head or (stem and stem.split(' ')[0] in head and m and m.group(1) in head):
            res = []
            for line in sec.split('\n')[1:]:
                if not line.startswith('- ') or line[2:].lower().startswith('photo') or 'commons.wikimedia' in line:
                    continue
                u = URL.search(line)
                if u:
                    label = line[2:].split(':')[0].strip()[:40]
                    res.append({'label': label, 'url': u.group(0).rstrip(').,')})
            if res:
                return res[:4]
    row = table_row(txt, stem)
    if row and len(row) >= 3:
        cell = row[2]
        urls = re.findall(r'https://[^\s;)]+', cell) + ['https://' + u for u in re.findall(r'(?<![/\w])((?:[a-z0-9-]+\.)+[a-z]{2,}/[^\s;)]*)', cell)]
        res = []
        for part in re.split(r';\s*(?![^()]*\))', cell):
            label = re.split(r'[(,:]', part.strip())[0].strip()
            if not label or label.startswith('http') or re.match(r'^(?:[a-z0-9-]+\.)+[a-z]{2,}/', label):
                continue
            key = re.sub(r'[^a-z]', '', label.lower().split(' ')[0])
            url = next((u for u in urls if key and key[:5] in u.lower().replace('-', '')), '')
            res.append({'label': label[:40], 'url': url.rstrip('.,')})
        return res[:4]
    return []


def table_row(txt, stem):
    """Markdown table row whose first cell is the post number, e.g. '| 07 |' for 'P16 07 ...'."""
    m = re.search(r'\b(\d{2})\b', stem)
    if not m:
        return None
    for line in txt.split('\n'):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if line.startswith('|') and cells and cells[0] == m.group(1):
            return cells
    return None


def credits_for(src_md, date, stem=''):
    if not src_md.exists():
        return []
    txt = src_md.read_text(encoding='utf-8', errors='ignore')
    for sec in re.split(r'\n(?=## )', txt):
        if date in sec.split('\n')[0]:
            return [re.sub(r'^photo[^:]*:\s*', '', l[2:].strip(), flags=re.I)[:200] for l in sec.split('\n') if l.lower().startswith('- photo')][:3]
    row = table_row(txt, stem)
    if row and len(row) >= 4:
        return [c.strip()[:200] for c in row[-1].split('; ') if c.strip()][:3]
    return []


def convert(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        with Image.open(dst) as done:
            return done.width, done.height
    with Image.open(src) as im:
        im = im.convert('RGB')
        if im.width > WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=78, method=6)
        return im.width, im.height


def main():
    series_out, posts_out, myths_out = [], [], []
    projects = {int(re.match(r'Project (\d+)', d.name).group(1)): d for d in SRC.glob('Project *') if d.is_dir()}
    for num in sorted(SERIES) + [22]:
        pdir = projects.get(num)
        if not pdir:
            continue
        txts = sorted(t for t in pdir.rglob('*.txt')
                      if not any(k in str(t.relative_to(pdir)).lower() for k in SKIP_DIR) and DATE.match(t.stem))
        seen = set()
        for t in txts:
            m = DATE.match(t.stem)
            date, _, stem = m.groups()
            stem = re.sub(r'\s*-\s*caption$', '', stem)
            key = f'{date} {m.group(2)} {stem}'
            if key in seen:
                continue
            seen.add(key)
            title, hook, body, labels = parse_caption(t.read_text(encoding='utf-8', errors='ignore'))
            imgs = sorted(p for p in t.parent.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg')
                          and p.stem.startswith(key) and not re.match(r'^ (answer|reveal)', p.stem[len(key):]))
            srcs = sources_for(t.parent / 'Sources.md', date, stem) or [{'label': x, 'url': ''} for x in labels]
            if num == 22:
                myths_out.append((date, title, hook, body, srcs, imgs, labels))
                continue
            meta = SERIES[num]
            sslug = meta[0]
            pslug = f'{date[2:4]}{date[5:7]}{date[8:10]}-{slugify(stem)}'
            images = []
            for i, img in enumerate(imgs[:MAX_CARDS]):
                dst = IMG / sslug / f'{pslug}-{i + 1}.webp'
                w, h = convert(img, dst)
                images.append({'src': f'/media/{sslug}/{dst.name}', 'width': w, 'height': h,
                               'alt': f'{title}, কার্ড {i + 1}'})
            words = sum(len(x.split()) for x in [hook] + body)
            posts_out.append({
                'slug': pslug, 'seriesSlug': sslug, 'format': 'card', 'title': title, 'hook': hook,
                'body': body or [hook], 'sources': srcs, 'publishedAt': date, 'topic': meta[4],
                'readMinutes': max(1, round(words / 180)), 'art': {'doodle': meta[5], 'bg': meta[7]},
                'shares': 0, 'likes': 0, 'images': images,
                'imageCredits': credits_for(t.parent / 'Sources.md', date, stem),
            })
        if num != 22:
            meta = SERIES[num]
            ps = [p for p in posts_out if p['seriesSlug'] == meta[0]]
            if not ps:
                continue
            series_out.append({
                'slug': meta[0], 'title': meta[1], 'tagline': meta[2], 'subject': meta[3], 'topic': meta[4],
                'kind': 'cards', 'ownerId': 'core', 'team': ['core'], 'color': meta[6], 'doodle': meta[5],
                'launchedAt': min(p['publishedAt'] for p in ps), 'followers': 0, 'description': meta[8],
                'credits': ['লেখা, তথ্য যাচাই ও ছবি-কার্ড: ভাবা যায়! কোর টিম'],
                'cover': next((p['images'][0]['src'] for p in sorted(ps, key=lambda p: p['publishedAt']) if p['images']), None),
            })
    myths = build_myths(myths_out)
    write_sql(series_out, posts_out, myths)
    # text-only series metadata for the static SEO shells (/series/<slug>)
    lib = [{k: s[k] for k in ('slug', 'title', 'tagline', 'subject', 'topic', 'doodle', 'color', 'description', 'launchedAt')}
           for s in series_out]
    (REPO / 'src' / 'data' / 'library.json').write_text(json.dumps(lib, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(len(series_out), 'series', len(posts_out), 'posts', len(myths_out), 'myths')


VERDICT = {'মিথ': 'myth', 'সত্য': 'true', 'আংশিক': 'partial'}


def build_myths(items):
    out = []
    for n, (date, title, hook, body, srcs, imgs, _labels) in enumerate(items, start=101):
        claim = re.sub(r'^.*?[“"]', '', title).rstrip('”" ').strip() or title
        allp = [hook] + body
        ans = next((p for p in allp if p.startswith('উত্তর')), '')
        verdict = 'myth'
        head = ans.split(':', 1)[-1].strip()
        for k, v in VERDICT.items():
            if head.startswith(k):
                verdict = v
                break
        if 'আংশিক' in head[:20] or 'অর্ধেক' in head[:20]:
            verdict = 'partial'
        short = re.sub(r'^[^!।]*[!।]\s*', '', head) or head
        reasons = [p for p in allp if p is not ans and not p.startswith('আপনার কী মনে হয়') and 'কমেন্টে' not in p]
        slug = f'myth-{n - 100:02d}'
        images = []
        for i, img in enumerate(imgs[:MAX_CARDS]):
            dst = IMG / 'myth-na-sotti' / f'{slug}-{i + 1}.webp'
            w, h = convert(img, dst)
            images.append({'src': f'/media/myth-na-sotti/{dst.name}', 'width': w, 'height': h, 'alt': f'{claim}, কার্ড {i + 1}'})
        out.append({
            'id': n, 'slug': slug, 'claim': claim, 'question': f'“{claim}”, কথাটা কি সত্যি?', 'verdict': verdict,
            'short': short[:140], 'body': [head] + reasons, 'faq': [], 'topic': 'nature', 'sources': srcs,
            'aliases': [], 'shares': 0, 'publishedAt': date, 'images': images,
        })
    return out


def q(v):
    if v is None:
        return 'NULL'
    if isinstance(v, (int, float)):
        return str(v)
    if not isinstance(v, str):
        v = json.dumps(v, ensure_ascii=False)
    return "'" + v.replace('\\', '\\\\').replace("'", "''") + "'"


def write_sql(series, posts, myths):
    SEED.mkdir(parents=True, exist_ok=True)
    rows = [f"({q(s['slug'])},{q(s['title'])},{q(s['tagline'])},{q(s['subject'])},{q(s['topic'])},{q(s['doodle'])},"
            f"{q(s['color'])},{q(s['description'])},{q(s['cover'])},{q(s['launchedAt'])})" for s in series]
    (SEED / '01-series.sql').write_text(
        'SET NAMES utf8mb4;\nDELETE FROM bj_series;\nINSERT INTO bj_series (slug,title,tagline,subject,topic,doodle,color,description,cover,launched_at) VALUES\n'
        + ',\n'.join(rows) + ';\n', encoding='utf-8')
    out = ['SET NAMES utf8mb4;', 'DELETE FROM bj_posts;']
    for p in posts:
        out.append('INSERT INTO bj_posts (slug,series_slug,kind,title,hook,body,sources,images,image_credits,topic,doodle,bg,read_minutes,published_at) VALUES '
                   f"({q(p['slug'])},{q(p['seriesSlug'])},'card',{q(p['title'])},{q(p['hook'])},{q(p['body'])},{q(p['sources'])},"
                   f"{q(p['images'])},{q(p['imageCredits'])},{q(p['topic'])},{q(p['art']['doodle'])},{q(p['art']['bg'])},{p['readMinutes']},{q(p['publishedAt'])});")
    (SEED / '02-posts.sql').write_text('\n'.join(out) + '\n', encoding='utf-8')
    out = ['SET NAMES utf8mb4;', 'DELETE FROM bj_myths;']
    for m in myths:
        out.append('INSERT INTO bj_myths (id,slug,claim,question,verdict,short,body,sources,images,published_at) VALUES '
                   f"({m['id']},{q(m['slug'])},{q(m['claim'])},{q(m['question'])},{q(m['verdict'])},{q(m['short'])},"
                   f"{q(m['body'])},{q(m['sources'])},{q(m['images'])},{q(m['publishedAt'])});")
    (SEED / '03-myths.sql').write_text('\n'.join(out) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
