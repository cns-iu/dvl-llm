FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd -m safeuser
COPY app ./app
USER safeuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5001"]