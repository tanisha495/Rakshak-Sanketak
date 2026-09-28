"""
Corrected version: uses our actual database connection and schema via
app.services.intelligence_data and app.services.embedding, instead of a
hardcoded, mismatched psycopg connection.
"""

from app.services.embedding import generate_embedding
from app.services.intelligence_data import vector_search_db


def vector_search(new_report, db=None, exclude_report_id=None, top_k=3):
    if db is None:
        raise ValueError("A database session must be provided")
    embedding = generate_embedding(new_report)
    return vector_search_db(db, embedding, exclude_report_id=exclude_report_id, top_k=top_k)
