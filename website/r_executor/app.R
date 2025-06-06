# r_executor/app.R

library(plumber)

#* Execute R code
#* @param code The R code to execute as a string.
#* @post /execute
function(req, res, code = "") {
  if (is.null(code) || nchar(trimws(code)) == 0) {
    res$status <- 400
    return(list(
      status = "error",
      message = "The 'code' parameter cannot be empty."
    ))
  }

  temp_script_file <- tempfile(tmpdir = "/tmp", fileext = ".R")
  writeLines(code, temp_script_file)

  output_dir <- "/app/data/output"
  time_before <- Sys.time()

  if (!requireNamespace("processx", quietly = TRUE)) {
    res$status <- 500
    return(list(
      status = "error",
      message = "processx package is missing. Check Dockerfile."
    ))
  }

  p <- processx::run(
    command = "Rscript",
    args = c("--vanilla", temp_script_file),
    stderr = "|",
    stdout = "|",
    timeout = 60,
    error_on_status = FALSE
  )

  file.remove(temp_script_file)

  final_status <- if (p$status == 0 && !p$timeout) "success" else "error"

  response_data <- list(
    status = final_status,
    exit_code = if (is.null(p$status)) -1 else p$status,
    stdout = trimws(p$stdout),
    stderr = trimws(p$stderr)
  )

  if (final_status == "success") {
    # Look for .html file modified after execution started
    html_files <- list.files(output_dir, pattern = "\\.html$", full.names = TRUE)
    if (length(html_files) > 0) {
      mtimes <- file.info(html_files)$mtime
      recent_files <- html_files[mtimes > time_before]
      if (length(recent_files) > 0) {
        newest <- recent_files[which.max(file.info(recent_files)$mtime)]
        response_data$output_html_path <- newest
      }
    }
  }

  if (p$timeout) {
    res$status <- 408
    response_data$stderr <- paste("Timeout: Code execution exceeded 60 seconds.", response_data$stderr)
    response_data$status <- "error"
  } else if (p$status != 0) {
    res$status <- 500
  } else {
    res$status <- 200
  }

  return(response_data)
}