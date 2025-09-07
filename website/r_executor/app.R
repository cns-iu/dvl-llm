# r_executor/app.R

library(plumber)
library(jsonlite)

# --- Error definitions ---
error_definitions <- list(
  `1000` = "Code Execution Error: The provided script failed during execution due to a runtime or syntax error.",
  `1100` = "Logical Error: The script ran without crashing but did not create the expected output file.",
  `1200` = "Security Violation: The submitted code contained forbidden keywords.",
  `2000` = "Service Level Error: The executor service encountered a problem."
)

# --- Forbidden keyword patterns ---
forbidden_patterns <- c(
  "\\bsystem\\(",
  "\\beval\\(",
  "\\bparse\\(",
  "\\bassign\\(",
  "\\bunlink\\(",
  "\\bsink\\(",
  "\\bshell\\(",
  "\\bsetwd\\(",
  "\\bfile\\.remove\\("
)

#* Execute R code with filename_prefix
#* @post /execute
function(req, res) {
  # Parse JSON body
  body <- tryCatch(fromJSON(req$postBody), error = function(e) NULL)
  if (is.null(body$code) || is.null(body$filename_prefix)) {
    res$status <- 400
    return(list(
      status = unbox("error"),
      error_code = unbox(2000),
      error_message = unbox("The 'code' and 'filename_prefix' parameters are required."),
      details = list(stdout = unbox(""), stderr = unbox(""))
    ))
  }

  code <- body$code
  filename_prefix <- body$filename_prefix

  # --- Check for forbidden patterns ---
  for (pattern in forbidden_patterns) {
    if (grepl(pattern, code)) {
      res$status <- 400
      return(list(
        status = unbox("error"),
        error_code = unbox(1200),
        error_message = unbox(paste0("Security Violation: Forbidden pattern '", pattern, "' detected.")),
        details = list(stdout = unbox(""), stderr = unbox(""))
      ))
    }
  }

  # --- File paths ---
  output_file <- file.path("/app/data/output", filename_prefix)
  temp_script_file <- tempfile(tmpdir = "/tmp", fileext = ".R")
  writeLines(code, temp_script_file)
  time_before <- Sys.time()

  # --- Ensure processx is available ---
  if (!requireNamespace("processx", quietly = TRUE)) {
    res$status <- 500
    return(list(
      status = unbox("error"),
      error_code = unbox(2000),
      error_message = unbox("processx package is missing. Please check the Docker build logs."),
      details = list(stdout = unbox(""), stderr = unbox(""))
    ))
  }

  # --- Run the script ---
  p <- processx::run(
    command = "Rscript",
    args = c("--vanilla", temp_script_file),
    stderr = "|",
    stdout = "|",
    timeout = 300,
    error_on_status = FALSE
  )

  file.remove(temp_script_file)

  # --- Collapse output to strings and unbox them ---
  out_str <- paste(trimws(p$stdout), collapse = "\n")
  err_str <- paste(trimws(p$stderr), collapse = "\n")

  # --- Timeout handling ---
  if (p$timeout) {
    res$status <- 408
    return(list(
      status = unbox("error"),
      error_code = unbox(2000),
      error_message = unbox("Execution timed out after 60 seconds."),
      details = list(stdout = unbox(out_str), stderr = unbox(err_str))
    ))
  }

  # --- Logical error: no output file ---
  if (p$status == 0 && !file.exists(output_file)) {
  Sys.sleep(0.5)  # Wait for the file system to catch up
  }
  if (p$status == 0 && !file.exists(output_file)) {
    res$status <- 500
    return(list(
      status = unbox("error"),
      error_code = unbox(1100),
      error_message = unbox(error_definitions$`1100`),
      details = list(stdout = unbox(out_str), stderr = unbox("Expected output file was not generated."))
    ))
  }

  # --- Runtime error ---
  if (p$status != 0) {
    res$status <- 500
    return(list(
      status = unbox("error"),
      error_code = unbox(1000),
      error_message = unbox(error_definitions$`1000`),
      details = list(stdout = unbox(out_str), stderr = unbox(err_str))
    ))
  }

  # --- Success ---
  res$status <- 200
  return(list(
    status = unbox("success"),
    code = unbox(code),
    output_html_path = unbox(output_file)
  ))
}

#* @get /health
function(req, res){
  data_dir <- "/app/data"
  out_dir  <- file.path(data_dir, "output")
  dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)

  testfile <- file.path(out_dir, paste0(".health_", as.integer(Sys.time())))
  ok  <- FALSE
  err <- NULL

  tryCatch({
    writeLines("ok", testfile)
    file.remove(testfile)
    ok <- TRUE
  }, error = function(e) {
    err <<- as.character(e)
  })

  if (dir.exists(data_dir) && dir.exists(out_dir) && ok) {
    return(list(status = "ok"))
  } else {
    res$status <- 503
    return(list(status = "unhealthy", error = err))
  }
}