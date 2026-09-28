import pandas as pd
from pathlib import Path

INPUT = Path('output/sanketak_master_clean.csv')
OUTPUT = Path('output/sanketak_master_labeled.csv')

df = pd.read_csv(INPUT)

text = (
    df['NARRATIVE'].fillna('').astype(str) + ' ' +
    df['ACTIVITY'].fillna('').astype(str) + ' ' +
    df['HAZARD'].fillna('').astype(str) + ' ' +
    df['FAILURE_MODE'].fillna('').astype(str) + ' ' +
    df['CONSEQUENCE'].fillna('').astype(str)
).str.lower()

def contains(pattern):
    return text.str.contains(pattern, regex=True, na=False)

# Positive evidence: focus on mechanisms that can plausibly cause severe harm.
high_hazard = contains(
    r'\b('
    r'explosion|exploded|dust explosion|gas explosion|'
    r'roof fall|roof collapse|ground fall|rock fall|'
    r'highwall collapse|highwall failure|'
    r'engulfed|buried|crushed|trapped|entrapped|'
    r'overturn|overturned|rollover|rolled over|tipped over|'
    r'hoist|hoisting|load fell|bucket fell|'
    r'electrocution|electric shock|power line|energized|arc flash|'
    r'fire|flame|ignition|'
    r'inundation|flood|water engulf|submerged|'
    r'drowning|fall from height|'
    r'struck by|caught between'
    r')\b'
)

worker_exposure = contains(
    r'\b('
    r'employee|employees|worker|workers|'
    r'miner|miners|operator|operators|driver|drivers|foreman|supervisor|crew|personnel|'
    r'working|operating|driving|inside|under|'
    r'trapped|entrapped|pinned|caught'
    r')\b'
)

escape_rescue = contains(
    r'\b('
    r'escaped|escape|rescued|rescue|extricated|evacuated|mayday|'
    r'trapped|pinned|removed from cab|removed from truck|'
    r'remained in truck|remained in cab'
    r')\b'
)

severe_mechanism = contains(
    r'\b('
    r'fatal|fatality|killed|died|death|'
    r'crushed|crushing|pinned|amputation|amputated|'
    r'electrocuted|engulfed|buried|submerged|drowning|'
    r'serious injury|fractured|fracture|'
    r'loss of consciousness|unconscious'
    r')\b'
)

high_risk_hazard = df['HAZARD'].fillna('').str.upper().isin([
    'FALL OF ROOF OR BACK',
    'FALL OF FACE/RIB/PILLAR/SIDE/HIGHWALL',
    'ENTRAPMENT',
    'ELECTRICAL',
    'IGNITION OR EXPLOSION OF GAS OR DUST',
    'EXPLODING VESSELS UNDER PRESSURE',
    'FIRE',
    'INUNDATION',
    'POWERED HAULAGE',
    'HOISTING',
    'EXPLOSIVES AND BREAKING AGENTS'
])

no_exposure = contains(
    r'\b('
    r'unoccupied|no employees?|no workers?|no personnel|'
    r'no one was|no one injured|no person|no people|'
    r'property damage only|away from active|not working in area|'
    r'no injury|no injuries'
    r')\b'
)

minor_event = contains(
    r'\b('
    r'minor cut|minor scratch|minor bruise|minor injury|'
    r'first aid only|no lost time'
    r')\b'
)

score = pd.Series(0, index=df.index, dtype='int64')
score += high_hazard.astype(int) * 2
score += worker_exposure.astype(int) * 2
score += escape_rescue.astype(int) * 3
score += severe_mechanism.astype(int) * 2
score += high_risk_hazard.astype(int) * 2
score -= no_exposure.astype(int) * 4
score -= minor_event.astype(int) * 3

df['SIF_SCORE'] = score
df['SIF_POTENTIAL'] = -1
df['SIF_RATIONALE'] = ''

# Conservative weak supervision:
# 0      = confident negative
# 1..5   = uncertain, excluded from model training
# >=7    = confident positive
positive = score >= 7
negative = score <= 0

df.loc[positive, 'SIF_POTENTIAL'] = 1
df.loc[positive, 'SIF_RATIONALE'] = (
    'Multiple strong SIF indicators: high-risk mechanism/hazard with '
    'worker exposure and/or severe/escape evidence.'
)

df.loc[negative, 'SIF_POTENTIAL'] = 0
df.loc[negative, 'SIF_RATIONALE'] = (
    'Insufficient SIF indicators or explicit evidence of low/no worker exposure.'
)

df.to_csv(OUTPUT, index=False, encoding='utf-8')

print('=' * 60)
print('CONSERVATIVE SIF LABELING COMPLETE')
print('=' * 60)
print('\nLabel distribution:')
print(df['SIF_POTENTIAL'].value_counts())
print('\nPercentages:')
print(df['SIF_POTENTIAL'].value_counts(normalize=True).mul(100).round(2))
print('\nScore distribution:')
print(df['SIF_SCORE'].describe())
print('\nSaved:', OUTPUT)
