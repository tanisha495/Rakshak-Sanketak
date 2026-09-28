from app.core.db import SessionLocal
from app.models.precedent import HistoricalPrecedent
import random

db = SessionLocal()
data = [
    ("Piper Alpha", "1988 North Sea platform explosion caused by permit-to-work failure.", "public record"),
    ("Bhopal", "1984 gas leak disaster linked to safety system bypass.", "public record"),
    ("Deepwater Horizon", "2010 blowout linked to procedure and equipment failures.", "public record"),
]
for name, desc, source in data:
    random.seed(sum(ord(c) for c in name))
    emb = [random.uniform(-1, 1) for _ in range(8)]
    db.add(HistoricalPrecedent(name=name, description=desc, source=source, embedding=emb))
db.commit()
print("Seeded precedents.")