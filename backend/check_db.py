import os
from sqlalchemy import inspect
from app.core.database import engine, SessionLocal
from app.models.user import User
from app.models.metric import Metric
from app.models.alert import Alert
from app.models.setting import AppSetting

def check_database():
    print("==================================================")
    print("      DEVOPS MONITOR PRO - DATABASE INSPECTION     ")
    print("==================================================")
    print(f"Database Engine URL : {engine.url}")
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables Found        : {', '.join(tables)}")
    print("--------------------------------------------------")
    
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"\n[USERS TABLE] Total Records: {len(users)}")
        for u in users:
            print(f"  - ID: {u.id} | Username: {u.username:<10} | Email: {u.email:<25} | Role: {u.role}")

        settings_count = db.query(AppSetting).count()
        print(f"\n[APP SETTINGS TABLE] Total Configuration Keys: {settings_count}")

        alerts = db.query(Alert).all()
        print(f"\n[ALERTS TABLE] Total Incidents Logged: {len(alerts)}")
        for a in alerts[:5]:
            print(f"  - ID: {a.id} | Type: {a.alert_type:<15} | Severity: {a.severity:<10} | Acknowledged: {a.acknowledged}")

        metrics_count = db.query(Metric).count()
        print(f"\n[METRICS TABLE] Total Historical Telemetry Samples: {metrics_count}")
        
    finally:
        db.close()
    print("\n==================================================")

if __name__ == "__main__":
    check_database()
