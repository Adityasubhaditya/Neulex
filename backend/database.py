# database.py
import sqlite3
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, db_path: str = 'tnc_analyzer.db'):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize database tables"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS analyses (
                id TEXT PRIMARY KEY,
                url TEXT,
                domain TEXT,
                analysis_data TEXT,
                risk_score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY,
                name TEXT UNIQUE,
                terms_url TEXT,
                last_analyzed TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info("✅ Database initialized successfully")
    
    def _get_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)
    
    def store_analysis(self, analysis_id: str, url: str, analysis_data: Dict[str, Any]):
        """Store analysis in database"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO analyses (id, url, domain, analysis_data, risk_score)
                VALUES (?, ?, ?, ?, ?)
            """, (
                analysis_id,
                url,
                self._extract_domain(url),
                json.dumps(analysis_data),
                analysis_data.get('risk_scores', {}).get('overall_risk', 5)
            ))
            
            conn.commit()
            conn.close()
            logger.info(f"💾 Stored analysis {analysis_id} for {url}")
            
        except Exception as e:
            logger.error(f"❌ Error storing analysis: {e}")
            raise
    
    def get_analysis_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get analysis history"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, url, domain, risk_score, created_at 
                FROM analyses 
                ORDER BY created_at DESC 
                LIMIT ?
            """, (limit,))
            
            history = []
            for row in cursor.fetchall():
                history.append({
                    "id": row[0],
                    "url": row[1],
                    "domain": row[2],
                    "risk_score": row[3],
                    "created_at": row[4]
                })
            
            conn.close()
            return history
            
        except Exception as e:
            logger.error(f"❌ Error fetching history: {e}")
            return []
    
    def get_analysis_by_id(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get specific analysis by ID"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("SELECT analysis_data FROM analyses WHERE id = ?", (analysis_id,))
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return json.loads(result[0])
            return None
            
        except Exception as e:
            logger.error(f"❌ Error fetching analysis {analysis_id}: {e}")
            return None
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            return url.split('//')[-1].split('/')[0]
        except:
            return url

# Global database instance
db = DatabaseManager()