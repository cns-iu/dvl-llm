# r_executor/run_plumber.R
cat("R Plumber API starting...\n")
cat("Runtime .libPaths():\n")
print(.libPaths())

# Check if plumber is available.
if (!requireNamespace("plumber", quietly = TRUE)) {
  cat("FATAL: Plumber package not found at runtime.\n")
  cat("Please check Docker image build logs and R library paths.\n")
  stop("Plumber package not found. Cannot start API.", call. = FALSE)
}
library(plumber) # Load plumber
cat("Plumber package loaded successfully.\n")

# Check for app.R
app_file <- "app.R"
if (!file.exists(app_file)) {
  cat(paste("FATAL: API definition file '", app_file, "' not found in ", getwd(), ".\n", sep=""))
  stop("API definition file not found.", call. = FALSE)
}
cat(paste("Found API definition file:", app_file, "\n"))

pr <- plumb(app_file)
cat("Plumber API defined from app.R.\n")

cat(paste("Starting Plumber API on host 0.0.0.0 port 5002...\n"))
pr$run(host = "0.0.0.0", port = 5002)