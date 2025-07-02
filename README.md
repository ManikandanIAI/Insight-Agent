# Insight Bot

**A Multi-Agent Finance Query Processing System**

## Overview
Insight Bot is a powerful multi-agent system designed to process and respond to finance-related queries efficiently. Leveraging advanced LLM multi-agent collaboration, it provides solutions for Finance, Company-specific and Market-related queries.

## Installation

### Prerequisites
Ensure you have Python installed (version 3.10+ recommended). You can download it from [python.org](https://www.python.org/downloads/).

### Steps to Install
1. Clone the repository:
   ```sh
   git clone git@github.com:IAI-solution/insight-agent.git
   cd insight-bot
   ```

2. Create a virtual environment (optional but recommended):
   ```sh
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```

## Usage
To start the Insight Bot App, run the following command:
```sh
uvicorn app:app
```