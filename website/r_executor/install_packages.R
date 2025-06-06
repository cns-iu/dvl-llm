# install_packages.R

message("Installing required CRAN packages...")

install.packages(c(
  "ggplot2", "plotly", "lattice", "ggvis", "highcharter", "dygraphs",
  "dplyr", "xts", "reshape2", "tidyr", "htmlwidgets",
  "scales", "lubridate", "DT", "knitr", "processx", "remotes"
), repos = "https://cloud.r-project.org", dependencies = TRUE)

message("Installing webshot2 from GitHub (requires remotes)...")

# Install webshot2 from GitHub using remotes
remotes::install_github("rstudio/webshot2")

# Verify installation
required_pkgs <- c(
  "ggplot2", "plotly", "lattice", "ggvis", "highcharter", "dygraphs",
  "dplyr", "xts", "reshape2", "tidyr", "htmlwidgets",
  "scales", "lubridate", "DT", "knitr", "processx", "webshot2"
)

missing <- required_pkgs[!sapply(required_pkgs, requireNamespace, quietly = TRUE)]

if (length(missing) > 0) {
  stop(paste("❌ The following packages failed to install:", paste(missing, collapse = ", ")), call. = FALSE)
}

message("✅ All packages successfully installed.")