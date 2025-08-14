# Dockerfile
FROM dvl-llm-r-exec-base:latest

ENV RETICULATE_PYTHON=/usr/bin/python3

WORKDIR /app

RUN apt-get update && apt-get install -y python3 python3-pip python3-venv python3-dev

# Install kaleido via pip
RUN pip3 install --break-system-packages kaleido==0.1.0 numpy plotly

# Switch to R and configure reticulate to use system Python
RUN Rscript -e "install.packages('reticulate', repos='https://cloud.r-project.org')"
RUN Rscript -e "install.packages('ggvis', repos='https://cloud.r-project.org', dependencies=TRUE)"

## this is for lattice library for inline png within html.
RUN apt-get update && apt-get install -y \
    libcairo2-dev libpng-dev libjpeg-dev \
 && rm -rf /var/lib/apt/lists/*

RUN Rscript -e "install.packages('svglite', repos='https://cloud.r-project.org')"

# --- Headless Chromium for webshot2 ---
# --- Google Chrome repo (Ubuntu 24.04-friendly) ---
RUN apt-get update && apt-get install -y --no-install-recommends wget gpg ca-certificates && \
    install -m 0755 -d /etc/apt/keyrings && \
    wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/keyrings/google-chrome.gpg && \
    chmod 0644 /etc/apt/keyrings/google-chrome.gpg && \
    sh -c 'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list' && \
    apt-get update && \
    (apt-get install -y --no-install-recommends google-chrome-stable fonts-dejavu-core fonts-liberation libasound2t64 || \
     apt-get install -y --no-install-recommends google-chrome-stable fonts-dejavu-core fonts-liberation libasound2) && \
    rm -rf /var/lib/apt/lists/*

# Point chromote/webshot2 at Chrome with safe flags for containers
ENV CHROMOTE_CHROME=/usr/bin/google-chrome
ENV CHROMOTE_CHROME_ARGS="--headless=new,--no-sandbox,--disable-dev-shm-usage,--hide-scrollbars,--disable-gpu"

COPY app.R .
COPY run_plumber.R .

EXPOSE 5002
CMD ["Rscript", "/app/run_plumber.R"]