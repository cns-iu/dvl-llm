# Use an official R Plumber image with ARM64 support
FROM rstudio/plumber:latest

# Avoid prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies and R littler (for CMD)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    r-cran-littler \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    pandoc \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the R package installer script
COPY install_packages.R /tmp/install_packages.R
RUN Rscript /tmp/install_packages.R && rm /tmp/install_packages.R

# Create output folder and assign proper permissions
RUN mkdir -p /app/data/output && chown -R 1000:1000 /app/data

# Copy app files
COPY app.R .
COPY run_plumber.R /app/run_plumber.R
RUN chmod +x /app/run_plumber.R

# Expose port
EXPOSE 5002

# Start Plumber API
CMD ["Rscript", "/app/run_plumber.R"]