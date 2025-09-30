# DVL-LLM Model Use Case Validation
# Visualization Result Metadata Extraction
# This script crawls a project directory and extracts metadata from filenames to
# for an evaluation data set.

# Environment
library(tidyverse)
library(fs)

# Set paths
#getwd()
path_data <- c("./data/use_case_results/")

# Create list of files names
data <- list.files(path_data, all.files = T, 
                   full.names = F, recursive = T, 
                   include.dirs = F)

# Create initial data.frame for loop
filename <- basename(data)
# Get file extension
file_type <- tools::file_ext(filename)
# Remove extension for parsing
filename_base <- tools::file_path_sans_ext(filename)
# Create initial data.frame
results_data <- data.frame(filename, file_type, filename_base)
# Remove text logs from results.
results_data <-
  results_data[results_data$file_type!="txt",]

# Creates temporary object for file name metadata
tmp <- data.frame()

# For loop extracts metadata from file names
#i=1
for(i in 1:nrow(results_data)){
  # Split by common delimiters (underscore, hyphen, etc.)
  parts <- str_split(results_data$filename_base, "[_-]")[[i]]
  
  # Extract metadata
  fnb <- results_data$filename_base[i]
  use.case <- parts[1]
  model <- "Deepseek"
  lang <- parts[2]
  libr <- parts[3]
  iteration <- gsub("iter","", parts[4])
  refinement <- parts[5]
  
  tmp <- 
    rbind(tmp, cbind(fnb, use.case, model, lang, libr, iteration, refinement))
}
names(tmp)[1] <- "filename_base"

# Join tmp metadata to results
results_data <- 
  left_join(results_data,tmp, by="filename_base")

# Determine file type category
file_category <- 
    case_when(
      results_data$file_type %in% c("html", "htm") ~ "HTML Website",
      results_data$file_type %in% c("png", "jpg", "jpeg", "svg", "pdf") ~ "Static Visualization",
      results_data$file_type %in% c("py", "r", "js") ~ "Script File",
      TRUE ~ "Other"
    )
results_data <- cbind(results_data, file_category)

# Environment clean-up
rm(data, file_type, filename, filename_base, tmp, i, parts, fnb, use.case,
   model, lang, libr, iteration, refinement, file_category)

# combine the results
results_data <-
  results_data %>%
  arrange(use.case,model,lang,libr,iteration,refinement)  %>%
  mutate(rec = as.integer(row.names(results_data)),
         valid = "") %>%
  select(rec, use.case, model, lang, libr, filename, file_type, file_category,
         iteration, refinement, valid)

# Export to CSV
write_csv(results_data, "./data/use_case_validation/dvl-llm_model_usecase_results-validations.csv")
