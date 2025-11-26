# scrapper.py
import requests
from bs4 import BeautifulSoup
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def fetch_terms_text(url: str) -> str:
    """Enhanced web scraper with better error handling"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    try:
        logger.info(f"🔍 Fetching content from: {url}")
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(["script", "style", "nav", "header", "footer", "meta", "link", "button"]):
            element.decompose()
            
        # Get text and clean it
        text = soup.get_text(separator='\n')
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        logger.info(f"✅ Successfully extracted {len(text)} characters from {url}")
        return text[:12000]  # Limit text length
        
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Network error fetching {url}: {str(e)}")
        raise Exception(f"Failed to fetch document: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Error fetching {url}: {str(e)}")
        raise Exception(f"Failed to process document: {str(e)}")

def get_company_url(company_name: str, df) -> Optional[str]:
    """Get T&C URL for a company from the dataset"""
    try:
        company_data = df[df['Company Name'].str.lower() == company_name.lower()]
        if not company_data.empty:
            url = company_data.iloc[0]['Terms & Conditions']
            logger.info(f"📋 Found URL for {company_name}: {url}")
            return url
        else:
            logger.warning(f"❌ Company not found in dataset: {company_name}")
            return None
    except Exception as e:
        logger.error(f"❌ Error getting company URL for {company_name}: {e}")
        return None

def fetch_terms_for_company(company_name: str, df) -> tuple:
    """Fetch terms text for a specific company"""
    try:
        url = get_company_url(company_name, df)
        if not url:
            return None, f"Company '{company_name}' not found in dataset"
        
        text = fetch_terms_text(url)
        return text, None
        
    except Exception as e:
        logger.error(f"❌ Error fetching terms for {company_name}: {e}")
        return None, str(e)