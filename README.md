# 🔍 NeuLex – AI-Powered Terms & Conditions Analyzer

**Simplify Legal Documents with NLP & AI**  
*Built with FastAPI, React, Ollama, and modern NLP pipelines*

---

## 📌 Overview

NeuLex is an intelligent document analysis platform designed to extract, summarize, and evaluate legal terms & conditions using state-of-the-art NLP models. It helps users quickly understand complex legal jargon, assess compliance risks, and compare document versions—all through an interactive dashboard.

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| 📄 **Clause Detection** | Automatically identifies and tags key legal clauses |
| ⚖️ **Compliance Scoring** | Rates documents based on regulatory adherence |
| 📊 **Readability Metrics** | Evaluates text complexity and suggests improvements |
| 🔄 **Document Comparison** | Highlights differences between two versions of a document |
| 🧠 **AI Summarization** | Generates concise summaries of lengthy legal texts |
| 📈 **Risk Detection** | Flags high-risk clauses and potential liabilities |
| 🎨 **Interactive Dashboard** | Built with React for real-time insights and comparisons |

---

## 🛠️ Tech Stack

- **Backend:** Python, FastAPI, Ollama, Spacy, AsyncIO
- **Frontend:** React, Tailwind CSS, Chart.js
- **Database:** MySQL
- **NLP Models:** Fine-tuned transformer models via Ollama
- **Dev Tools:** GitHub, VS Code, Jupyter, Docker

---

## 📸 Screenshots
  
`![Dashboard](link-to-dashboard-image)`  
`![Comparison View](link-to-comparison-image)`

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL
- Ollama installed locally

### Backend Setup
git clone https://github.com/Adityasubhaditya/NeuLex.git
cd NeuLex/backend
pip install -r requirements.txt
uvicorn app.main:app --reload

### Frontend Setup
cd NeuLex/frontend
npm install
npm start
