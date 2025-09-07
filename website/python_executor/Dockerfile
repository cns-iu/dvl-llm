FROM python:3.10-slim-bookworm

# Install OS dependencies for:
# - Plotly image export (via Kaleido)
# - Altair image export (via vl-convert)
# - Bokeh PNG export (via Firefox + Geckodriver)
RUN apt-get update && apt-get install -y \
    curl wget git \
    libglib2.0-0 libnss3 libgconf-2-4 libxss1 \
    libasound2 libxtst6 libgtk-3-0 \
    libgl1-mesa-glx libxrender1 libxext6 libsm6 libexpat1 \
    fonts-liberation fonts-dejavu \
    firefox-esr \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    libxml2 \
    libxslt1.1 \
    libjpeg62-turbo \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

# Install Geckodriver for Bokeh PNG export
RUN GECKO_VERSION="v0.34.0" && \
    wget -q "https://github.com/mozilla/geckodriver/releases/download/${GECKO_VERSION}/geckodriver-${GECKO_VERSION}-linux-aarch64.tar.gz" && \
    tar -xzf "geckodriver-${GECKO_VERSION}-linux-aarch64.tar.gz" -C /usr/local/bin && \
    rm "geckodriver-${GECKO_VERSION}-linux-aarch64.tar.gz"

# Create non-root user
#RUN useradd -m safeuser

# Set work directory and copy app code
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

# Use non-root user for safety
#USER safeuser

# Start FastAPI app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5001"]