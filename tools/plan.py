def combos_for(level, depth, need, rng):
    """Наборы категорий: по одной на блок, по возможности из разных семейств."""
    cap = tier_allowed(level)
    pool = [c for c in cat_list if clarity[c] <= cap]
    want = blocks_of(level)
    out = []
    # Семейств всего шесть, поэтому при шести-семи блоках повторы неизбежны:
    # сначала пробуем по одной категории на семейство, потом ослабляем.
    for limit in (1, 2, 3):
        for _ in range(400):
            rng.shuffle(pool)
            picked, families = [], collections.Counter()
            for c in pool:
                if families[fam_of[c]] >= (limit if len(picked) < want - 1 else limit + 1):
                    continue
                L = need[len(picked)]
                h = hist[(c, depth)][0]
                # Категория обслуживает ровно один блок, значит нужно хотя бы одно
                # слово подходящей длины — точной или соседней.
                if sum(h[k] for k in (L - 1, L, L + 1)) < 1:
                    continue
                picked.append(c)
                families[fam_of[c]] += 1
                if len(picked) == want:
                    break
            if len(picked) == want:
                out.append(tuple(picked))
        if len(out) >= 40:
            break
    # без повторов, порядок стабильный
    seen, uniq = set(), []
    for combo in out:
        key = frozenset(combo)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(combo)
    return uniq

import json, itertools, random, sys, re, collections

lang = sys.argv[1]
d = json.load(open(f'src/content/{lang}/themes.json', encoding='utf-8'))
cats, common, families = d['categories'], d['common'], d['families']
src = open(f'src/content/{lang}/index.ts', encoding='utf-8').read()
opening = [[int(x) for x in re.search(r'anchors: \[([\d, ]+)\]', l).group(1).split(',')]
           for l in src.splitlines() if 'anchors:' in l]
num = lambda k: int(re.search(rf'{k}: (\d+)', src).group(1))
base, per, cap = num('anchorBase'), num('anchorPerLevels'), num('anchorCap')
common_until, core_until = num('commonUntil'), num('coreUntil')

# Блоков на уровне — по кривой: короткое знакомство в начале и длинная партия
# к концу. То же расписание лежит в src/content/<язык>/index.ts (curve.blocks).
BLOCKS = [(1, 3), (3, 4), (5, 5), (11, 6), (21, 7)]

def blocks_of(level):
    count = BLOCKS[0][1]
    for start, n in BLOCKS:
        if level >= start:
            count = n
    return count

def anchors(level):
    want = blocks_of(level)
    if level <= len(opening):
        row = opening[level - 1]
        return [row[i % len(row)] for i in range(want)]
    step = (level - len(opening)) // per
    return [min(cap, max(6, base + step + (1 if i % 3 == 2 else 0))) for i in range(want)]

cat_list = list(cats)
fam_of = {c: f for f, cs in families.items() for c in cs}
clarity = d['clarity']

# Прозрачность категории тоже идёт по кривой: сначала только предметные
# категории из детского словаря, потом те, что требуют шага в сторону,
# и лишь к середине абстрактные вроде погоды, спорта и музыки.
def tier_allowed(level):
    if level <= 4:
        return 1
    if level <= 12:
        return 2
    return 3
core = d['core']

def words_of(cat, depth):
    if depth == 'core':
        return core.get(cat, '').split() or common.get(cat, '').split()
    if depth == 'common':
        return common.get(cat, '').split()
    return cats[cat].split()

hist = {}
for c in cat_list:
    for depth in ('core', 'common', 'all'):
        ws = words_of(c, depth)
        hist[(c, depth)] = (collections.Counter(len(w) for w in ws), len(ws),
                            sum(1 for w in ws if len(w) <= 4))

def depth_of(level):
    return 'core' if level <= core_until else 'common' if level <= common_until else 'all'

# Кривая смешивания: первые два уровня — одна очевидная категория, третий
# и четвёртый — родственная пара, дальше пары из разных семейств. Игрок должен
# сначала понять правило на «Зверях», а уже потом ловить «Посуду · Музыку».
SOLO_UNTIL = 0
KIN_UNTIL = 4
# В теме столько категорий, сколько блоков: каждый блок — своя категория,
# ни одна не повторяется внутри уровня. Пара и тройка выглядели однобоко:
# категории шли по кругу и возвращались.
solos = [(c,) for c in cat_list]
pairs = [(a, b) for a, b in itertools.combinations(cat_list, 2)]
# Наборы строим не перебором (их сотни тысяч), а жадно под каждый уровень:
# берём по одной категории из разных семейств, пока не наберём пять.

profile = {}
room_of = {}
# Сид перебирается руками: планов много, и среди них есть заметно более ровные.
# Выбранный проверен аудитом (npm run audit), поэтому зафиксирован.
SEED = int(__import__('os').environ.get('PLAN_SEED', '3'))
shuffler = random.Random(SEED)
for level in range(1, 31):
    depth = depth_of(level)
    need = anchors(level)
    rows = []
    for combo in combos_for(level, depth, need, shuffler):
        cnt = collections.Counter()
        total = 0
        for c in combo:
            h, n, _ = hist[(c, depth)]
            cnt.update(h)
            total += n
        # Соблазн короче якоря на три буквы и берётся из всей темы: коротких слов
        # в отдельной категории часто нет вовсе.
        tops = {a - 1 if a <= 5 else a - 2 for a in set(need)}
        if any(sum(cnt[k] for k in range(3, top + 1)) < 2 for top in tops):
            continue
        if total < 20:
            continue
        rows.append(combo)
    profile[level] = rows[:120]
    for combo in profile[level]:
        room_of[(level, combo)] = sum(
            sum(hist[(c, depth)][0][L] for L in range(min(need) - 1, max(need) + 1))
            for c in combo
        )
    if not rows:
        print('нет наборов для уровня', level, depth)

best = None
rng = random.Random(SEED + 8)
for _ in range(300):
    used = collections.Counter()
    seen = set()
    plan, prev, prev2, mixed = [], set(), set(), 0
    ok = True
    for level in range(1, 31):
        need = anchors(level)
        options = []
        for combo in profile[level]:
            # Полный запрет на повтор с предыдущим уровнем при пяти категориях
            # неисполним: свободных категорий просто не остаётся. Держим порог —
            # не больше двух общих, этого хватает, чтобы уровни не слипались.
            if len(prev & set(combo)) > max(2, blocks_of(level) // 2):
                continue
            # Категория, которая была на двух прошлых уровнях подряд, третий раз
            # не идёт: иначе транспорт стоит в первых четырёх уровнях кряду.
            if set(combo) & (prev & prev2):
                continue
            # Один и тот же набор дважды за тридцать уровней читается как экономия
            # на контенте, а вариантов хватает с запасом.
            if frozenset(combo) in seen:
                continue
            # На первых уровнях, кроме прозрачности, важен запас слов нужной
            # длины: чем его больше, тем дружелюбнее блоки — генератору есть
            # из чего выбирать, и в блок не лезут слова на грани узнаваемости.
            room = room_of[(level, combo)]
            weight = (
                -sum(used[c] for c in combo) * 3
                - sum(clarity[c] for c in combo) * (4 if level <= 8 else 0)
                + (room / 6 if level <= 4 else 0)
                # Первые два уровня выбираются без случайности: это лицо игры,
                # и на них должна стоять самая понятная категория с самым
                # большим запасом слов, а не та, которой повезло.
                + (0 if level <= SOLO_UNTIL else rng.random() * 2)
            )
            options.append((weight, combo))
        if not options:
            ok = False
            break
        options.sort(reverse=True, key=lambda o: o[0])
        combo = options[0][1]
        combo = tuple(sorted(combo, key=lambda c: (clarity[c], -hist[(c, depth_of(level))][1])))
        plan.append(list(combo))
        for c in combo:
            used[c] += 1
        seen.add(frozenset(combo))
        prev2 = prev
        prev = set(combo)
        mixed += 1 if len(combo) > 1 and fam_of[combo[0]] != fam_of[combo[1]] else 0
    if not ok:
        continue
    spread = max(used.values()) - min(used.values())
    key = (mixed, -spread)
    if best is None or key > best[0]:
        best = (key, plan, dict(used))

key, plan, used = best
print('пар из разных семейств:', key[0], 'из 30 | разброс частот:', -key[1])
for i, combo in enumerate(plan, 1):
    print(f'{i:>2} {" · ".join(combo):46} якоря {anchors(i)}')
print('частоты:', sorted(used.items(), key=lambda kv: -kv[1]))
json.dump(plan, open(f'/tmp/claude-0/plan-{lang}.json', 'w', encoding='utf-8'), ensure_ascii=False)
