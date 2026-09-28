import pandas as pd
import joblib

from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score
)


# =========================================================
# PATHS
# =========================================================

INPUT = Path("output/sanketak_training.csv")
MODEL_OUTPUT = Path("output/sif_classifier.joblib")


# =========================================================
# 1. LOAD BALANCED TRAINING DATASET
# =========================================================

print("=" * 60)
print("LOADING TRAINING DATASET")
print("=" * 60)

df = pd.read_csv(INPUT)

print("Total records:", len(df))


# =========================================================
# 2. REMOVE UNCERTAIN RECORDS
# =========================================================
# -1 = uncertain / needs review
# The classifier is trained only on confident labels:
# 0 = Negative
# 1 = Positive

df = df[df["SIF_POTENTIAL"].isin([0, 1])].copy()

print("\nRecords used for classification:", len(df))

print("\nLabel distribution:")
print(df["SIF_POTENTIAL"].value_counts())


# =========================================================
# 3. COMBINE RELEVANT TEXT
# =========================================================

text_columns = [
    "NARRATIVE",
    "ACTIVITY",
    "HAZARD",
    "FAILURE_MODE",
    "CONSEQUENCE"
]

for col in text_columns:
    df[col] = df[col].fillna("").astype(str)

df["TEXT"] = (
    df["NARRATIVE"] + " " +
    df["ACTIVITY"] + " " +
    df["HAZARD"] + " " +
    df["FAILURE_MODE"] + " " +
    df["CONSEQUENCE"]
).str.lower()


X = df["TEXT"]
y = df["SIF_POTENTIAL"]


# =========================================================
# 4. TRAIN / TEST SPLIT
# =========================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\nTraining records:", len(X_train))
print("Testing records:", len(X_test))


# =========================================================
# 5. TF-IDF + LOGISTIC REGRESSION
# =========================================================

model = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            max_features=15000,
            ngram_range=(1, 2),
            min_df=2,
            sublinear_tf=True
        )
    ),
    (
        "classifier",
        LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            random_state=42
        )
    )
])


# =========================================================
# 6. TRAIN
# =========================================================

print("\nTraining model...")

model.fit(X_train, y_train)

print("Training complete.")


# =========================================================
# 7. EVALUATE
# =========================================================

y_pred = model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)

print("\n" + "=" * 60)
print("MODEL EVALUATION")
print("=" * 60)

print("\nAccuracy:", round(accuracy, 4))

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        y_pred,
        target_names=[
            "Negative",
            "Positive"
        ],
        digits=4
    )
)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))


# =========================================================
# 8. SAVE MODEL
# =========================================================

joblib.dump(
    model,
    MODEL_OUTPUT
)

print("\n" + "=" * 60)
print("MODEL SAVED")
print("=" * 60)

print("Saved to:", MODEL_OUTPUT)