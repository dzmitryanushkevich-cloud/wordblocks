"""
Множественное число для слов темы.

Игрок читает с блока то, что видит: собрал ТУФЛИ — значит нашёл туфли, и
засчитать надо. Словарь игры собран из существительных в единственном числе,
поэтому формы множественного мы добавляем отдельно: в словарь (иначе солвер
их вообще не найдёт) и в карту `plural` в themes.json (иначе они не из темы).

    python3 tools/plural.py ru
    python3 tools/plural.py en

Правит src/content/<язык>/themes.json и dictionary.json на месте.
"""
import json
import sys

lang = sys.argv[1]
themes_path = f'src/content/{lang}/themes.json'
dict_path = f'src/content/{lang}/dictionary.json'
themes = json.load(open(themes_path, encoding='utf-8'))
dic = json.load(open(dict_path, encoding='utf-8'))
# Скрипт можно гонять много раз: сначала убираем формы, добавленные прошлым
# запуском, иначе словарь растёт от прогона к прогону.
previous = set((themes.get('plural') or {}).values())
dic['words'] = [w for w in dic['words'] if w not in previous]
known = set(dic['words'])

singles = sorted({w for words in themes['categories'].values() for w in words.split()})

if lang == 'ru':
    import pymorphy3
    morph = pymorphy3.MorphAnalyzer()

    def plural(word: str) -> str | None:
        for parse in morph.parse(word):
            if 'NOUN' not in parse.tag:
                continue
            form = parse.inflect({'plur', 'nomn'})
            # Вся игра живёт без Ё: СЁСТРЫ на плитках выглядели бы как СЕСТРЫ,
            # и словарь обязан хранить ровно то, что читается на блоке.
            if form and form.word.isalpha():
                flat = form.word.replace('ё', 'е')
                return flat if flat != word else None
            return None
        return None
else:
    # Английские правила плюс горсть исключений: словарь игры маленький,
    # и проверить каждое слово глазами проще, чем тащить морфологию.
    IRREGULAR = {
        'foot': 'feet', 'tooth': 'teeth', 'child': 'children', 'man': 'men',
        'woman': 'women', 'mouse': 'mice', 'goose': 'geese', 'ox': 'oxen',
        'leaf': 'leaves', 'loaf': 'loaves', 'knife': 'knives', 'wolf': 'wolves',
        'shelf': 'shelves', 'scarf': 'scarves', 'thief': 'thieves', 'life': 'lives',
        'person': 'people', 'cactus': 'cacti',
    }
    SAME = {'fish', 'sheep', 'deer', 'moose', 'salmon', 'trout', 'bison', 'series'}

    def plural(word: str) -> str | None:
        if word in SAME:
            return None
        if word in IRREGULAR:
            return IRREGULAR[word]
        if word.endswith(('s', 'x', 'z', 'ch', 'sh')):
            return word + 'es'
        if word.endswith('y') and word[-2] not in 'aeiou':
            return word[:-1] + 'ies'
        if word.endswith('o') and word[-2] not in 'aeiou':
            return word + 'es'
        return word + 's'

forms: dict[str, str] = {}
for word in singles:
    form = plural(word)
    # Форма, которая совпала с другим словом темы, только путала бы подписи.
    if not form or form == word or form in singles:
        continue
    forms[word] = form

added = [f for f in sorted(set(forms.values())) if f not in known]
dic['words'] = dic['words'] + added
themes['plural'] = dict(sorted(forms.items()))
json.dump(themes, open(themes_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(dic, open(dict_path, 'w', encoding='utf-8'), ensure_ascii=False)
print(f'{lang}: слов темы {len(singles)}, форм множественного {len(forms)}, добавлено в словарь {len(added)}')
print('примеры:', ', '.join(f'{k}→{v}' for k, v in list(forms.items())[:8]))
