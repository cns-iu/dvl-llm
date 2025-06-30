from typing import List
from app.models import UserStoryResponse

user_stories: List[UserStoryResponse] = [
    UserStoryResponse(
        id=1,
        userstory="Number of HRA SMEs over time",
        description="This dataset contains cumulative counts recorded annually across multiple SME categories. Each entry includes the year, group name, and corresponding cumulative count. The data is best visualized using a line chart to show how each group has progressed over time.",
        viz_types=["Line Chart"],
        image_url="https://i.pravatar.cc/48?u=1"
    ),
    UserStoryResponse(
        id=2,
        userstory="RUI volume and predict CTann using different CTann tools",
        description="Spatial data of a 10x10x10 mm tissue block placed in the left kidney, annotated with multiple UBERON terms and aligned using 3D translation and rotation, with the output presented in an interactive EUI component.",
        viz_types=["Text"],
        image_url="https://i.pravatar.cc/48?u=2"
    ),
    UserStoryResponse(
        id=3,
        userstory="Cell Summary file and predict 3D corridor in EUI",
        description="This dataset contains cell-level summaries used to predict the spatial origin of cells based on attributes like gene expression and annotations. The output is presented in an interactive EUI component.",
        viz_types=["Text"],
        image_url="https://i.pravatar.cc/48?u=3"
    ),
    UserStoryResponse(
        id=4,
        userstory="CTann Tool Outputs with Confidence Scores Using GTEx files",
        description="This dataset links individual cell barcodes to annotated cell types using ontology terms (e.g., CL IDs) and match confidence scores. It includes details like the dataset ID, organ (e.g., prostate), prediction tool used, cell label, matched cell type, and the degree of confidence. It helps identify cell populations such as luminal epithelial cells, smooth muscle cells, basal cells, and club cells within a given tissue sample.",
        viz_types=["TBD"],
        image_url="https://i.pravatar.cc/48?u=4"
    ),
    UserStoryResponse(
        id=5,
        userstory="Upload and Compare CTpop for Anatomical Structures with CTann Visualizations Using HRA ATLAS Data",
        description="This dataset includes summarized information about anatomical structures and their associated cell types. Each row represents a unique anatomical structure along with a count of associated cell summaries. The data is best visualized using a bar chart to compare the number of cell types across different anatomical structures.",
        viz_types=["Bar Chart"],
        image_url="https://i.pravatar.cc/48?u=5"
    ),
    UserStoryResponse(
        id=6,
        userstory="Identify and Remove Non-Specific Genes (High Across All CTs) and Visualize Effects via UMAPs at Multiple Thresholds",
        description="This analysis identifies and removes non-specific genes—those highly expressed across all cell types—and evaluates the impact of their removal on h5ad data structure using UMAP visualizations at multiple expression thresholds.",
        viz_types=["Clusters (umap)"],
        image_url="https://i.pravatar.cc/48?u=6"
    ),
    UserStoryResponse(
        id=7,
        userstory="Sankey Diagram of Donor Demographics from Experimental or HRApop Atlas Data",
        description="This dataset captures metadata linking donors, organs, tissue blocks, anatomical structures, and datasets. It is best visualized using a Sankey diagram to show the flow from donors to organs, structures, and datasets.",
        viz_types=["Sankey"],
        image_url="https://i.pravatar.cc/48?u=7"
    ),
    UserStoryResponse(
        id=8,
        userstory="Comparative Analysis of Healthy vs. Diseased Lung Tissue Using Violin Plots",
        description="This dataset contains spatial graphs of healthy and diseased tissues, showing cell types and their connections. It enables comparison of immune cell distributions, such as CD68+ Macrophages and Mast Cells, across conditions.",
        viz_types=["Split Violin"],
        image_url="https://i.pravatar.cc/48?u=8"
    ),
    UserStoryResponse(
        id=9,
        userstory="Upload CDE-Formatted Data and Explore Cell Neighborhood Graphs",
        description="This dataset includes cell types and their connections, showing relationships between cells like Macrophages, Lymphocytes, and Muscle/Fibroblasts. It is best visualized as a hierarchical tree to reveal structured groupings.",
        viz_types=["Hierarchical tree"],
        image_url="https://i.pravatar.cc/48?u=9"
    ),
    UserStoryResponse(
        id=10,
        userstory=" VCCF Visualization Using CDE Component with SWAT CTann Harmonization Integration",
        description="This dataset contains spatial coordinates and cell type labels from a tumor microenvironment, including cell types like Tumor/Epithelial, Lymphocyte(III), and PDL1+ Macrophage. It supports visualizations such as violin plots to explore cell type distribution and density across regions.",
        viz_types=["Histogram, Violin plot"],
        image_url="https://i.pravatar.cc/48?u=10"
    ),  
]
