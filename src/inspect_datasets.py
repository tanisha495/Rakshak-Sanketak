import pandas as pd
from pathlib import Path

DATA_DIR = Path("data")

for file in DATA_DIR.iterdir():

    print("\n" + "=" * 80)
    print(f"FILE: {file.name}")
    print("=" * 80)

    try:
        if file.suffix.lower() == ".csv":
            df = pd.read_csv(file, low_memory=False)

        elif file.suffix.lower() == ".txt":
            df = pd.read_csv(
                file,
                sep="|",
                encoding="latin1",
                low_memory=False
            )

        elif file.suffix.lower() == ".xlsx":
            df = pd.read_excel(file, engine="openpyxl")

        else:
            print("Skipped: unsupported file type")
            continue

        print("Rows:", len(df))
        print("Columns:", len(df.columns))

        print("\nCOLUMN NAMES:")
        for col in df.columns:
            print(" -", col)

        print("\nFIRST 2 ROWS:")
        print(df.head(2).to_string())

    except Exception as e:
        print("ERROR:", e)