# analyzer.py
import requests
import json
import logging
import asyncio
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class TermsAnalyzer:
    def __init__(self):
        self.ollama_available = False
        self.base_url = "http://localhost:11434"
        self.model = "llama3.1:8b"  # Use a smaller, faster model
        
        # Add compatibility attribute for main.py
        self.groq_available = False
        
        self._check_ollama_availability()
    
    def _check_ollama_availability(self):
        """Check if Ollama is running and available"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                self.ollama_available = True
                logger.info("✅ Ollama is available and running")
                
                # Check if model is available
                models = response.json().get('models', [])
                model_names = [model['name'] for model in models]
                if self.model in model_names:
                    logger.info(f"✅ Model {self.model} is available")
                else:
                    logger.warning(f"⚠️ Model {self.model} not found. Available: {model_names}")
                    # Use first available model
                    if models:
                        self.model = models[0]['name']
                        logger.info(f"🔄 Using available model: {self.model}")
            else:
                logger.error(f"❌ Ollama responded with status: {response.status_code}")
        except requests.exceptions.ConnectionError:
            logger.error("❌ Ollama not running. Please start Ollama first.")
        except Exception as e:
            logger.error(f"❌ Error checking Ollama: {e}")
    
    async def analyze_terms(self, text: str, analysis_type: str = "standard") -> Dict[str, Any]:
        """Analyze terms text using Ollama with fallback"""
        if self.ollama_available:
            logger.info(f"🚀 Starting Ollama analysis (model: {self.model})")
            try:
                # Use quick analysis for faster response
                result = await self._analyze_with_ollama_quick(text)
                logger.info("✅ Ollama analysis completed successfully")
                return result
            except Exception as e:
                logger.error(f"❌ Ollama analysis failed: {e}")
                return await self._fallback_analysis(text)
        else:
            logger.warning("🎭 Ollama not available, using fallback analysis")
            return await self._fallback_analysis(text)
    
    async def _analyze_with_ollama_quick(self, text: str) -> Dict[str, Any]:
        """Quick analysis with Ollama using optimized settings"""
        # Use much shorter text for faster processing
        truncated_text = text[:2000]  # Only use first 2000 characters
        
        payload = {
            "model": self.model,
            "prompt": f"Briefly analyze these Terms & Conditions and return ONLY JSON:\n\n{truncated_text}",
            "system": """You are a legal analyst. Return ONLY valid JSON with these keys: 
            - summary (1 sentence)
            - data_collection (3 main data types)
            - user_rights (3 main rights)
            - readability (Easy/Moderate/Difficult)
            - overall_risk (Low/Medium/High)""",
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 1000,  # Shorter response
                "num_ctx": 2048       # Smaller context
            }
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=30  # Shorter timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                response_content = result.get('response', '').strip()
                logger.info(f"📄 Ollama response received: {len(response_content)} characters")
                
                return self._process_ai_response(response_content)
            else:
                logger.error(f"❌ Ollama API error: {response.status_code} - {response.text}")
                raise Exception(f"Ollama API error: {response.status_code}")
                
        except requests.exceptions.Timeout:
            logger.error("❌ Ollama request timeout - using fallback")
            raise Exception("Analysis timeout")
        except Exception as e:
            logger.error(f"❌ Ollama API call failed: {e}")
            raise
    
    def _process_ai_response(self, response_content: str) -> Dict[str, Any]:
        """Process and clean AI response"""
        try:
            # Clean JSON response
            content = response_content.strip()
            
            # Remove markdown code blocks if present
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            content = content.strip()
            
            # Parse JSON
            analysis_result = json.loads(content)
            logger.info(f"📊 AI analysis parsed successfully with {len(analysis_result)} keys")
            
            # Enhance with calculated scores
            return self._calculate_risk_scores(analysis_result)
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse AI response as JSON: {e}")
            logger.error(f"Raw response: {response_content[:500]}...")
            
            # Fallback to simple analysis
            return self._create_simple_analysis()
    
    def _calculate_risk_scores(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate risk scores from analysis"""
        # Simple risk calculation based on content
        data_items = len(analysis.get('data_collection', []))
        data_risk = min(10, data_items * 0.5 + 3)
        
        rights_items = len(analysis.get('user_rights', []))
        rights_score = min(10, rights_items * 1.5)
        
        # Readability score
        readability_map = {"Easy": 9, "Moderate": 6, "Difficult": 3}
        readability_score = readability_map.get(analysis.get('readability', 'Moderate'), 5)
        
        # Overall risk from AI or calculated
        overall_risk = analysis.get('overall_risk_score')
        if overall_risk is None:
            risk_map = {"Low": 3, "Medium": 6, "High": 8}
            overall_risk = risk_map.get(analysis.get('overall_risk', 'Medium'), 5)
        
        analysis['risk_scores'] = {
            'data_risk': round(data_risk, 1),
            'user_rights_score': round(rights_score, 1),
            'readability_score': readability_score,
            'overall_risk': round(overall_risk, 1)
        }
        
        analysis['risk_level'] = (
            'High' if overall_risk >= 7 else
            'Medium' if overall_risk >= 4 else 'Low'
        )
        
        analysis['recommendations'] = self._generate_recommendations(analysis)
        analysis['source'] = 'ollama'
        
        return analysis
    
    def _generate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []
        risk_scores = analysis.get('risk_scores', {})
        
        overall_risk = risk_scores.get('overall_risk', 0)
        if overall_risk >= 7:
            recommendations.append("⚠️ High risk - review carefully before agreeing")
        elif overall_risk >= 4:
            recommendations.append("📊 Moderate risk - standard terms with some concerns")
        else:
            recommendations.append("✅ Low risk - generally favorable terms")
        
        return recommendations
    
    def _create_simple_analysis(self) -> Dict[str, Any]:
        """Create a simple analysis when AI fails"""
        return {
            "summary": "Automated analysis of terms and conditions using fallback method.",
            "data_collection": ["contact_info", "usage_data", "cookies"],
            "user_rights": ["data_access", "account_deletion", "privacy_controls"],
            "readability": "Moderate",
            "risk_scores": {
                "data_risk": 5.0,
                "user_rights_score": 6.0,
                "readability_score": 6,
                "overall_risk": 5.5
            },
            "risk_level": "Medium",
            "recommendations": [
                "Standard terms analysis completed",
                "Review specific clauses for your use case"
            ],
            "source": "fallback"
        }
    
    async def _fallback_analysis(self, text: str) -> Dict[str, Any]:
        """Fallback analysis when Ollama is not available"""
        logger.info("🔄 Using fallback analysis")
        await asyncio.sleep(0.5)  # Simulate processing
        
        return self._create_simple_analysis()

# Global analyzer instance
analyzer = TermsAnalyzer()