# main.py
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
import uuid
import logging
from datetime import datetime
import numpy as np
import asyncio
import PyPDF2
import io

# Import our modules
from scrapper import fetch_terms_text, get_company_url, fetch_terms_for_company
from analyzer import analyzer
from database import db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load dataset
try:
    df = pd.read_csv('TnC.csv')
    logger.info(f"✅ Loaded dataset with {len(df)} companies")
except Exception as e:
    logger.error(f"❌ Failed to load TnC.csv: {e}")
    df = pd.DataFrame()

app = FastAPI(
    title="AI Terms & Conditions Analyzer API",
    description="Ollama-powered analysis of Terms & Conditions",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "chrome-extension://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models - MUST BE DEFINED BEFORE ENDPOINTS THAT USE THEM
class AnalysisRequest(BaseModel):
    text: str
    url: str
    analysis_type: str = "standard"
    user_preferences: Optional[Dict[str, Any]] = None

class AnalysisResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    analysis_id: Optional[str] = None
    processing_time: Optional[float] = None

class CompanyResponse(BaseModel):
    id: int
    name: str
    url: str

class ComparisonRequest(BaseModel):  # MOVED BEFORE THE COMPARISON ENDPOINT
    companies: List[str]
    comparison_metrics: List[str] = ["data_risk", "user_rights", "readability"]

# Custom JSON encoder to handle numpy types
def convert_numpy_types(obj):
    """Convert numpy types to Python native types for JSON serialization"""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif pd.isna(obj):  # Handle NaN values
        return None
    return obj

def sanitize_data_for_json(data):
    """Recursively sanitize data for JSON serialization"""
    if isinstance(data, dict):
        return {k: sanitize_data_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_data_for_json(item) for item in data]
    else:
        return convert_numpy_types(data)

def extract_text_from_pdf(pdf_content: bytes) -> str:
    """Extract text content from PDF bytes"""
    try:
        pdf_file = io.BytesIO(pdf_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        return text.strip()
    except Exception as e:
        logger.error(f"❌ PDF text extraction failed: {e}")
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

# API Routes
@app.get("/")
async def root():
    return {
        "message": "AI Terms & Conditions Analyzer API", 
        "version": "2.0.0",
        "ai_available": analyzer.ollama_available,
        "companies_loaded": len(df) if df is not None else 0,
        "ai_provider": "ollama"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "ai_available": analyzer.ollama_available,
        "ai_provider": "ollama",
        "database_connected": True
    }

@app.get("/companies", response_model=List[CompanyResponse])
async def get_companies():
    """Get list of all companies in dataset"""
    if df.empty:
        raise HTTPException(status_code=500, detail="Dataset not loaded")
    
    companies = []
    for _, row in df.iterrows():
        # Convert numpy types to Python native types
        company_id = convert_numpy_types(row['Sl No'])
        company_name = convert_numpy_types(row['Company Name'])
        company_url = convert_numpy_types(row['Terms & Conditions'])
        
        companies.append({
            "id": company_id,
            "name": company_name,
            "url": company_url
        })
    
    logger.info(f"📋 Returning {len(companies)} companies")
    return companies

@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_terms(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Main analysis endpoint"""
    start_time = datetime.now()
    analysis_id = str(uuid.uuid4())
    
    try:
        logger.info(f"🔍 Analyzing terms from {request.url}")
        
        # Perform AI analysis
        analysis_result = await analyzer.analyze_terms(request.text, request.analysis_type)
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Store analysis in database (background task)
        background_tasks.add_task(db.store_analysis, analysis_id, request.url, analysis_result)
        
        logger.info(f"✅ Analysis completed in {processing_time:.2f}s")
        
        return AnalysisResponse(
            success=True,
            data=analysis_result,
            analysis_id=analysis_id,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"❌ Analysis error: {e}")
        return AnalysisResponse(
            success=False,
            error=str(e)
        )

@app.get("/api/analyze/url")
async def analyze_terms_by_url(url: str, analysis_type: str = "standard"):
    """Analyze terms from a URL directly"""
    try:
        logger.info(f"🌐 Analyzing URL: {url}")
        
        # Fetch terms text
        text = fetch_terms_text(url)
        
        # Analyze with AI
        analysis_result = await analyzer.analyze_terms(text, analysis_type)
        
        # Store in database
        analysis_id = str(uuid.uuid4())
        db.store_analysis(analysis_id, url, analysis_result)
        
        return {
            "success": True,
            "url": url,
            "analysis": analysis_result,
            "analysis_id": analysis_id,
            "text_preview": text[:200] + "..." if len(text) > 200 else text
        }
        
    except Exception as e:
        logger.error(f"❌ URL analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analyze/company/{company_name}")
async def analyze_company_terms(company_name: str, analysis_type: str = "standard"):
    """Analyze terms for a specific company from the dataset"""
    try:
        logger.info(f"🏢 Analyzing company: {company_name}")
        
        if df.empty:
            raise HTTPException(status_code=500, detail="Dataset not loaded")
        
        # Find company by name (case-insensitive)
        company_row = df[df['Company Name'].str.lower() == company_name.lower()]
        if company_row.empty:
            # Try partial match
            company_row = df[df['Company Name'].str.lower().str.contains(company_name.lower())]
            if company_row.empty:
                raise HTTPException(status_code=404, detail=f"Company '{company_name}' not found in dataset")
        
        company_data = company_row.iloc[0]
        company_url = convert_numpy_types(company_data['Terms & Conditions'])
        company_id = convert_numpy_types(company_data['Sl No'])
        actual_company_name = convert_numpy_types(company_data['Company Name'])
        
        logger.info(f"🔗 Found company: {actual_company_name} -> {company_url}")
        
        # Fetch terms for company
        text = fetch_terms_text(company_url)
        logger.info(f"📄 Fetched {len(text)} characters from {company_url}")
        
        # Analyze with AI
        analysis_result = await analyzer.analyze_terms(text, analysis_type)
        logger.info("🤖 AI analysis completed")
        
        # Store in database
        analysis_id = str(uuid.uuid4())
        db.store_analysis(analysis_id, company_url, analysis_result)
        
        # Sanitize response data
        response_data = {
            "success": True,
            "company": actual_company_name,
            "company_id": company_id,
            "url": company_url,
            "analysis": analysis_result,
            "analysis_id": analysis_id
        }
        
        return sanitize_data_for_json(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Company analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze/pdf")
async def analyze_pdf_terms(pdf: UploadFile = File(...), analysis_type: str = "standard"):
    """Analyze terms from a PDF file"""
    try:
        logger.info(f"📄 Analyzing PDF file: {pdf.filename}")
        
        # Check if it's a PDF
        if not pdf.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        # Read PDF content
        contents = await pdf.read()
        
        # Extract text from PDF
        pdf_text = extract_text_from_pdf(contents)
        
        if not pdf_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        logger.info(f"📖 Extracted {len(pdf_text)} characters from PDF")
        
        # Analyze with AI
        analysis_result = await analyzer.analyze_terms(pdf_text, analysis_type)
        
        # Store in database
        analysis_id = str(uuid.uuid4())
        db.store_analysis(analysis_id, f"pdf:{pdf.filename}", analysis_result)
        
        return {
            "success": True,
            "filename": pdf.filename,
            "analysis": analysis_result,
            "analysis_id": analysis_id,
            "text_preview": pdf_text[:200] + "..." if len(pdf_text) > 200 else pdf_text
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ PDF analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compare")
async def compare_companies(request: ComparisonRequest):
    """Compare multiple companies"""
    try:
        logger.info(f"⚖️ Comparing companies: {request.companies}")
        
        comparisons = []
        
        for company_name in request.companies:
            try:
                # Find company in dataset
                company_row = df[df['Company Name'].str.lower() == company_name.lower()]
                if company_row.empty:
                    comparisons.append({
                        "company": company_name,
                        "error": f"Company '{company_name}' not found in dataset",
                        "risk_level": "Error"
                    })
                    continue
                
                company_data = company_row.iloc[0]
                company_url = convert_numpy_types(company_data['Terms & Conditions'])
                
                # Fetch and analyze
                text = fetch_terms_text(company_url)
                analysis = await analyzer.analyze_terms(text, "standard")
                
                comparisons.append({
                    "company": convert_numpy_types(company_data['Company Name']),
                    "analysis": analysis,
                    "risk_scores": analysis.get('risk_scores', {}),
                    "risk_level": analysis.get('risk_level', 'Unknown')
                })
                
                # Small delay to avoid overwhelming the system
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Error analyzing {company_name}: {e}")
                comparisons.append({
                    "company": company_name,
                    "error": str(e),
                    "risk_level": "Error"
                })
        
        # Generate comparative insights
        comparison_insights = generate_comparison_insights(comparisons)
        
        response_data = {
            "comparisons": comparisons,
            "insights": comparison_insights,
            "metrics": request.comparison_metrics
        }
        
        return sanitize_data_for_json(response_data)
        
    except Exception as e:
        logger.error(f"❌ Comparison failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def generate_comparison_insights(comparisons: List[Dict]) -> List[str]:
    """Generate insights from comparative analysis"""
    insights = []
    
    valid_comparisons = [c for c in comparisons if 'risk_scores' in c and 'error' not in c]
    
    if len(valid_comparisons) >= 2:
        # Find best and worst for data risk
        try:
            best_data = min(valid_comparisons, key=lambda x: x['risk_scores'].get('data_risk', 10))
            worst_data = max(valid_comparisons, key=lambda x: x['risk_scores'].get('data_risk', 0))
            
            if best_data and worst_data:
                insights.append(f"📊 {best_data['company']} has the lowest data collection risk")
                insights.append(f"⚠️ {worst_data['company']} has the highest data collection risk")
        except:
            pass
        
        # Find best for user rights
        try:
            best_rights = max(valid_comparisons, key=lambda x: x['risk_scores'].get('user_rights_score', 0))
            if best_rights:
                insights.append(f"👍 {best_rights['company']} offers the best user rights")
        except:
            pass
    
    return insights

@app.get("/api/history")
async def get_analysis_history(limit: int = Query(20, ge=1, le=100)):
    """Get analysis history"""
    history = db.get_analysis_history(limit)
    
    # Sanitize history data
    sanitized_history = []
    for item in history:
        sanitized_item = {
            "id": convert_numpy_types(item.get('id')),
            "url": convert_numpy_types(item.get('url')),
            "domain": convert_numpy_types(item.get('domain')),
            "risk_score": convert_numpy_types(item.get('risk_score')),
            "created_at": convert_numpy_types(item.get('created_at'))
        }
        sanitized_history.append(sanitized_item)
    
    return {
        "history": sanitized_history,
        "total": len(sanitized_history)
    }

@app.get("/api/analysis/{analysis_id}")
async def get_analysis_by_id(analysis_id: str):
    """Get specific analysis by ID"""
    analysis = db.get_analysis_by_id(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    return {
        "success": True,
        "analysis_id": analysis_id,
        "data": analysis
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)