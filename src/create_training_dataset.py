import pandas as pd
from pathlib import Path

INPUT = Path("output/sanketak_master_labeled.csv")
OUTPUT = Path("output/sanketak_training.csv")

df = pd.read_csv(INPUT)

# Keep only confidently labeled records
positive = df[df["SIF_POTENTIAL"] == 1]
negative = df[df["SIF_POTENTIAL"] == 0]
uncertain = df[df["SIF_POTENTIAL"] == -1]

# Use the smaller confident class as the balancing limit
n = min(len(positive), len(negative))

# Keep all available negative examples and the same number of positives
positive_sample = positive.sample(
    n=n,
    random_state=42
)

negative_sample = negative.sample(
    n=n,
    random_state=42
)

# Keep a smaller representative uncertain set
uncertain_n = min(
    1000,
    len(uncertain)
)

uncertain_sample = uncertain.sample(
    n=uncertain_n,
    random_state=42
)

training_df = pd.concat(
    [
        positive_sample,
        negative_sample,
        uncertain_sample
    ],
    ignore_index=True
)

# Shuffle
training_df = training_df.sample(
    frac=1,
    random_state=42
).reset_index(drop=True)

training_df.to_csv(
    OUTPUT,
    index=False,
    encoding="utf-8"
)

print("=" * 60)
print("BALANCED TRAINING DATASET CREATED")
print("=" * 60)

print("\nTotal records:", len(training_df))

print("\nLabel distribution:")
print(training_df["SIF_POTENTIAL"].value_counts())

print("\nPercentages:")
print(
    training_df["SIF_POTENTIAL"]
    .value_counts(normalize=True)
    .mul(100)
    .round(2)
)

print("\nOriginal dataset preserved:")
print(INPUT)

print("\nTraining dataset:")
print(OUTPUT)