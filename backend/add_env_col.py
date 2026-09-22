from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE servers ADD COLUMN environment VARCHAR(50) DEFAULT 'Production'"))
        conn.commit()
        print("Successfully added environment column to servers table.")
    except Exception as e:
        print("Migration status:", e)
