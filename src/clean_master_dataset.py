import pandas as pd
from pathlib import Path
INPUT = Path('output/sanketak_master_40k.csv')
OUTPUT = Path('output/sanketak_master_clean.csv')
df = pd.read_csv(INPUT)
df.columns = df.columns.str.strip()
text_cols = ['ACTIVITY','HAZARD','EXPOSURE','FAILURE_MODE','BARRIER_FAILURE','CONSEQUENCE','EVIDENCE','NARRATIVE']
for col in text_cols:
    df[col] = df[col].fillna('').astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()
df = df[df['NARRATIVE'].str.len() >= 20].copy()
df = df.drop_duplicates(subset='REPORT_ID', keep='first').reset_index(drop=True)
required = ['REPORT_ID','SOURCE_DATASET','DATE','ACTIVITY','HAZARD','EXPOSURE','FAILURE_MODE','BARRIER_FAILURE','CONSEQUENCE','EVIDENCE','NARRATIVE','SIF_POTENTIAL','SIF_RATIONALE','SPLIT']
missing = [c for c in required if c not in df.columns]
if missing: raise ValueError(f'Missing columns: {missing}')
df.to_csv(OUTPUT, index=False, encoding='utf-8')
print('CLEAN DATASET READY')
print('Rows:', len(df))
print('Columns:', len(df.columns))
print('Unique REPORT_ID:', df['REPORT_ID'].nunique())
print('\nSplit:')
print(df['SPLIT'].value_counts())
print('\nSaved:', OUTPUT)
