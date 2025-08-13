# r_executor/run_plumber.R

cat("R Plumber API starting...\n")
cat("Current Working Directory: ", getwd(), "\n")
cat("Runtime .libPaths():\n")
print(.libPaths())

# Check if plumber is available
if (!requireNamespace("plumber", quietly = TRUE)) {
  cat("FATAL: plumber package not found at runtime.\n")
  stop("Plumber package not found. Cannot start API.", call. = FALSE)
}

library(plumber)

# Check for app.R
app_file <- "app.R"
if (!file.exists(app_file)) {
  cat(paste("FATAL: API definition file '", app_file, "' not found in ", getwd(), ".\n", sep = ""))
  stop("API definition file not found.", call. = FALSE)
}

cat(paste("Found API definition file:", app_file, "\n"))
pr <- plumb(app_file)
cat("API successfully defined from app.R\n")

# Start API
cat("Starting Plumber API on host 0.0.0.0 port 5002...\n")
pr$run(host = "0.0.0.0", port = 5002)