import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR = Path('data')
OUTPUT_DIR = Path('output')
OUTPUT_DIR.mkdir(exist_ok=True)

print('Loading MSHA...')
msha = pd.read_csv(DATA_DIR / 'Accidents.txt', sep='|', encoding='latin1', low_memory=False)
print('Loading OSHA...')
osha = pd.read_csv(DATA_DIR / 'January2015toNovember2025.csv', low_memory=False)
print('Loading OSHA Construction...')
construction = pd.read_excel(DATA_DIR / 'OSHA construction 4470 cases original.xlsx', engine='openpyxl')

print('\nOriginal sizes:')
print('MSHA:', len(msha))
print('OSHA:', len(osha))
print('Construction:', len(construction))

msha_std = pd.DataFrame({
    'REPORT_ID': 'MSHA_' + msha['DOCUMENT_NO'].astype(str),
    'SOURCE_DATASET': 'MSHA',
    'DATE': msha['ACCIDENT_DT'],
    'ACTIVITY': msha['ACTIVITY'],
    'HAZARD': msha['CLASSIFICATION'],
    'EXPOSURE': '',
    'FAILURE_MODE': msha['ACCIDENT_TYPE'],
    'BARRIER_FAILURE': '',
    'CONSEQUENCE': msha['NATURE_INJURY'],
    'EVIDENCE': msha['NARRATIVE'],
    'NARRATIVE': msha['NARRATIVE']
})

o_sha = osha
osha_std = pd.DataFrame({
    'REPORT_ID': 'OSHA_' + osha['ID'].astype(str),
    'SOURCE_DATASET': 'OSHA',
    'DATE': osha['EventDate'],
    'ACTIVITY': osha['SourceTitle'],
    'HAZARD': osha['EventTitle'],
    'EXPOSURE': osha['Part of Body Title'],
    'FAILURE_MODE': osha['EventTitle'],
    'BARRIER_FAILURE': '',
    'CONSEQUENCE': osha['NatureTitle'],
    'EVIDENCE': osha['Final Narrative'],
    'NARRATIVE': osha['Final Narrative']
})

construction_std = pd.DataFrame({
    'REPORT_ID': 'OSHA_CONSTRUCTION_' + construction['id'].astype(str),
    'SOURCE_DATASET': 'OSHA_CONSTRUCTION',
    'DATE': '',
    'ACTIVITY': construction['newkeys'],
    'HAZARD': construction['title'],
    'EXPOSURE': '',
    'FAILURE_MODE': construction['cause'],
    'BARRIER_FAILURE': '',
    'CONSEQUENCE': '',
    'EVIDENCE': construction['Summary2'],
    'NARRATIVE': construction['Summary2']
})

master = pd.concat([msha_std, osha_std, construction_std], ignore_index=True)
print('\nMerged:', len(master))
master = master.replace(['NO VALUE FOUND', 'NOVALUE FOUND', 'nan', 'NaN', '?'], np.nan)
master['NARRATIVE'] = master['NARRATIVE'].fillna('').astype(str)
master = master[master['NARRATIVE'].str.strip().str.len() > 20].copy()
master = master.drop_duplicates(subset=['NARRATIVE'], keep='first').reset_index(drop=True)
print('After cleaning/deduplication:', len(master))

construction_sample = master[master['SOURCE_DATASET'] == 'OSHA_CONSTRUCTION'].copy()
msha_data = master[master['SOURCE_DATASET'] == 'MSHA'].copy()
msha_sample = msha_data.groupby('HAZARD', group_keys=False).apply(lambda x: x.sample(n=max(1, round(20000 * len(x) / len(msha_data))), random_state=42))
if len(msha_sample) > 20000:
    msha_sample = msha_sample.sample(20000, random_state=42)

osha_data = master[master['SOURCE_DATASET'] == 'OSHA'].copy()
osha_sample = osha_data.groupby('HAZARD', group_keys=False).apply(lambda x: x.sample(n=max(1, round(15000 * len(x) / len(osha_data))), random_state=42))
if len(osha_sample) > 15000:
    osha_sample = osha_sample.sample(15000, random_state=42)

final_df = pd.concat([msha_sample, osha_sample, construction_sample], ignore_index=True)
final_df = final_df.sample(frac=1, random_state=42).reset_index(drop=True)
final_df['SIF_POTENTIAL'] = -1
final_df['SIF_RATIONALE'] = ''
final_df['SPLIT'] = np.where(np.arange(len(final_df)) % 5 == 0, 'test', 'train')

output_file = OUTPUT_DIR / 'sanketak_master_40k.csv'
final_df.to_csv(output_file, index=False, encoding='utf-8')
print('\nFINAL DATASET CREATED')
print('Rows:', len(final_df))
print('Columns:', len(final_df.columns))
print('\nSource distribution:')
print(final_df['SOURCE_DATASET'].value_counts())
print('\nSplit distribution:')
print(final_df['SPLIT'].value_counts())
print('\nSaved to:', output_file)
