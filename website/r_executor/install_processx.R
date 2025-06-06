# r_executor/install_processx.R
message("Attempting to install R package: processx")

install.packages(
  "processx",
  repos = "https://cloud.r-project.org/", # Use a reliable CRAN mirror
  Ncpus = 2, # Use 2 cores for installation if available
  dependencies = TRUE,
  clean = TRUE
)

# Verify installation
if (!requireNamespace("processx", quietly = TRUE)) {
  message("ERROR: processx package NOT found after installation attempt.")
  q(status = 1) # Fail the build if not found
}

message("processx package successfully installed/found.")