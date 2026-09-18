"""
Сборка английского словаря игры.

Берём частотный список субтитров (hermitdave/FrequencyWords) и оставляем только
существительные в начальной форме — по WordNet. Имена собственные, множественные
числа и грубости отсеиваются.

    python tools/build-dictionary-en.py

Результат: src/content/en/dictionary.json  { coreCount, words }

WordNet ставится один раз:
    pip install nltk && python -c "import nltk; nltk.download('wordnet')"
"""
import json
import os
import re
import urllib.request

FREQ_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "content", "en", "dictionary.json")
CACHE = os.path.join(os.path.dirname(__file__), ".cache")
MIN_LEN, MAX_LEN = 3, 12
CORE = 4000

# Грубое и всё, что не хочется видеть в детской игре.
BANNED = {
    "ass", "shit", "fuck", "bitch", "damn", "hell", "dick", "cock", "pussy", "whore",
    "slut", "bastard", "crap", "piss", "porn", "rape", "nigger", "faggot", "cunt",
    "boob", "tit", "penis", "vagina", "sperm", "semen", "orgasm", "condom", "heroin",
    "cocaine", "murder", "murderer", "corpse", "suicide", "nazi", "jew", "negro",
    "retarded", "idiot", "moron", "bastards", "bloody", "booze", "drunk", "hooker",
    "arse", "nigga", "arsehole", "wanker", "prick", "bollocks", "bugger", "screwed",
}

# Обломки сокращений из субтитров: isn't → isn, you're → re.
FRAGMENTS = {
    "isn", "aren", "wasn", "weren", "doesn", "didn", "hasn", "hadn", "haven", "don",
    "wouldn", "couldn", "shouldn", "ain", "gonna", "gotta", "wanna", "gimme", "lemme",
    "cos", "cuz", "yeah", "nah", "huh", "hmm", "ugh", "oww", "shh",
}


def fetch(url: str, name: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        with urllib.request.urlopen(url, timeout=120) as response, open(path, "wb") as out:
            out.write(response.read())
    return path


def main() -> None:
    from nltk.corpus import wordnet as wn

    # Существительным считаем слово, у которого именно существительное — главное
    # значение. В WordNet почти у всего есть именной смысл («a good», «the will»),
    # поэтому сравниваем частоты значений по разметке корпуса.
    weight: dict[str, dict[str, int]] = {}
    proper: set[str] = set()
    for pos in ("n", "v", "a", "r"):
        for synset in wn.all_synsets(pos):
            instance = pos == "n" and bool(synset.instance_hypernyms())
            for lemma in synset.lemmas():
                name = lemma.name().lower()
                if "_" in name or "-" in name:
                    continue
                bucket = weight.setdefault(
                    name, {"n": 0, "other": 0, "nsyn": 0, "osyn": 0, "common": 0}
                )
                key = "n" if pos == "n" else "other"
                bucket[key] += lemma.count()
                bucket["nsyn" if pos == "n" else "osyn"] += 1
                if pos == "n" and not instance:
                    bucket["common"] += 1
                if instance:
                    proper.add(name)

    def is_noun(word: str) -> bool:
        w = weight.get(word)
        if not w or w["nsyn"] == 0:
            return False
        # Имя собственное без нарицательного значения (Кент, Израиль) — мимо.
        if word in proper and w["common"] == 0:
            return False
        # Разметка корпуса знает слово — верим ей; не знает — смотрим на число значений.
        if w["n"] or w["other"]:
            return w["n"] >= w["other"]
        return w["nsyn"] >= w["osyn"]

    words = []
    seen = set()
    for line in open(fetch(FREQ_URL, "en_50k.txt"), encoding="utf-8"):
        word = line.split(" ")[0].strip().lower()
        if not re.fullmatch(r"[a-z]+", word) or not (MIN_LEN <= len(word) <= MAX_LEN):
            continue
        if word in seen or word in BANNED or word in FRAGMENTS:
            continue
        if not is_noun(word):
            continue
        # Начальная форма: cats → cat, поэтому cats в словарь не попадает.
        if wn.morphy(word, "n") != word:
            continue
        seen.add(word)
        words.append(word)

    data = {"coreCount": min(CORE, len(words)), "words": words}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"слов: {len(words)}, узнаваемых: {data['coreCount']}")
    lengths = {}
    for w in words:
        lengths[len(w)] = lengths.get(len(w), 0) + 1
    print("по длине:", " ".join(f"{k}:{v}" for k, v in sorted(lengths.items())))


if __name__ == "__main__":
    main()
