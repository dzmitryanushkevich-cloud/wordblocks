"""
Сборка словаря существительных для WordBlocks.

Источники (оба открытые, скачиваются по сети):
  1. https://github.com/Harrix/Russian-Nouns  — список существительных в им. падеже
  2. https://github.com/hermitdave/FrequencyWords — частотный список (OpenSubtitles 2018)
Морфологическая проверка — pymorphy3 (данные OpenCorpora).

Правила отбора:
  - слово есть в списке существительных и встречается в частотном списке не реже 20 раз
  - pymorphy3 разбирает его как NOUN, sing, nomn, без пометок имён, фамилий, географии, аббревиатур
  - только буквы а-я, длина 3..9, Ё приводится к Е, не начинается на ь/ъ/ы
  - вручную вырезан список вульгарного, медицинского и оскорбительного

Результат: src/data/dictionary.json  { coreCount, words }
words отсортированы по убыванию частоты. Первые coreCount слов считаются узнаваемыми
и только они используются как якорные (целевые) слова фигур; остальные принимаются как ответ.

Запуск:  pip install pymorphy3 && python tools/build-dictionary.py
"""

import json, os, re, sys, urllib.request

NOUNS_URL = "https://raw.githubusercontent.com/Harrix/Russian-Nouns/main/dist/russian_nouns.txt"
FREQ_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_full.txt"
CACHE = os.path.join(os.path.dirname(__file__), ".cache")
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "dictionary.json")

MIN_FREQ = 20
MIN_LEN, MAX_LEN = 3, 9
CORE_COUNT = 4000

BLOCKLIST = {
    "аборт", "алкаш", "алкоголик", "бомж", "бордель", "вибратор", "виселица", "гашиш",
    "гильотина", "дебил", "девка", "дерьмо", "жид", "задница", "идиот", "кастрация",
    "кретин", "лесбиянка", "маньяк", "марихуана", "мерзавец", "мошонка", "мразь",
    "наркоман", "насильник", "нацист", "негодяй", "негр", "оргазм", "пенис", "потаскуха",
    "проститут", "секс", "сифилис", "сперма", "стерва", "суицид", "сука", "сутенер",
    "тварь", "терроризм", "ублюдок", "фаллос", "фашист", "хер", "шлюха", "эрекция",
    "гаденыш", "уродина", "уродка", "уродец",
    # исторически и эмоционально тяжёлое — не место в лёгкой головоломке
    "фюрер", "геноцид", "каратель", "палач", "пытка", "расстрел", "казнь", "каторга",
}

BAD_TAGS = {"Name", "Surn", "Patr", "Geox", "Abbr", "Init", "Orgn", "Trad", "Erro", "Dist"}
CYRILLIC = re.compile(r"^[а-я]+$")


def norm(s):
    return s.strip().lower().replace("ё", "е")


def fetch(url, name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print(f"скачиваю {name} ...", file=sys.stderr)
        urllib.request.urlretrieve(url, path)
    return path


def main():
    nouns = {norm(l) for l in open(fetch(NOUNS_URL, "nouns.txt"), encoding="utf-8") if l.strip()}
    freq = {}
    for line in open(fetch(FREQ_URL, "ru_full.txt"), encoding="utf-8"):
        parts = line.split()
        if len(parts) == 2:
            w = norm(parts[0])
            freq[w] = freq.get(w, 0) + int(parts[1])

    import pymorphy3
    morph = pymorphy3.MorphAnalyzer()

    rows = []
    for word in nouns:
        if not CYRILLIC.match(word) or not (MIN_LEN <= len(word) <= MAX_LEN):
            continue
        if word[0] in "ьъы" or word in BLOCKLIST:
            continue
        count = freq.get(word, 0)
        if count < MIN_FREQ:
            continue
        for parse in morph.parse(word):
            if parse.score < 0.4:
                continue
            tag = parse.tag
            grammemes = set(str(tag).replace(",", " ").split())
            if tag.POS == "NOUN" and "sing" in tag and "nomn" in tag and not (grammemes & BAD_TAGS):
                rows.append((word, count))
                break

    rows.sort(key=lambda r: -r[1])
    words = [w for w, _ in rows]
    data = {"coreCount": min(CORE_COUNT, len(words)), "words": words}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    by_len = {}
    for w in words:
        by_len[len(w)] = by_len.get(len(w), 0) + 1
    print(f"слов: {len(words)}, узнаваемых (core): {data['coreCount']}")
    print("по длине:", dict(sorted(by_len.items())))


if __name__ == "__main__":
    main()
