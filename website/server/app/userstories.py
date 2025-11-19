from typing import List
from app.models import UserStoryResponse

user_stories: List[UserStoryResponse] = [
    UserStoryResponse(
        id=1,
        userstory="Digital objects over time",
        description="This dataset contains cumulative counts recorded annually across multiple SME categories. Each entry includes the year, group name, and corresponding cumulative count. The data is best visualized using a line chart to show how each group has progressed over time.",
        viz_types=["Line Chart"],
        image_url="http://localhost:8000/sdata-output/USP1/1.png",
        category ="Temporal"
    ),
    UserStoryResponse(
        id=2,
        userstory="Cell type annotations predicted from registered tissue block volume",
        description="Spatial data of a 10x10x10 mm tissue block placed in the left kidney, annotated with multiple UBERON terms and aligned using 3D translation and rotation, with the output presented in an interactive EUI component.",
        viz_types=["Text"],
        image_url="http://localhost:8000/sdata-output/USP1/2.png",
        category ="Geospatial"
    ),
    UserStoryResponse(
        id=3,
        userstory="3D corridors predicted from tissue cell type populations",
        description="This dataset contains cell-level summaries used to predict the spatial origin of cells based on attributes like gene expression and annotations. The output is presented in an interactive EUI component.",
        viz_types=["Text"],
        image_url="http://localhost:8000/sdata-output/USP1/3.png",
        category ="Geospatial"
    ),
    UserStoryResponse(
        id=4,
        userstory="Cell type annotations confidence from GTEx",
        description="This dataset links individual cell barcodes to annotated cell types using ontology terms (e.g., CL IDs) and match confidence scores. It includes details like the dataset ID, organ (e.g., prostate), prediction tool used, cell label, matched cell type, and the degree of confidence. It helps identify cell populations such as luminal epithelial cells, smooth muscle cells, basal cells, and club cells within a given tissue sample.",
        viz_types=["TBD"],
        image_url="http://localhost:8000/sdata-output/USP1/4.png",
        category ="Textual"
    ),
    UserStoryResponse(
        id=5,
        userstory="Comparison of cell type populations",
        description="This dataset includes summarized information about anatomical structures and their associated cell types. Each row represents a unique anatomical structure along with a count of associated cell summaries. The data is best visualized using a bar chart to compare the number of cell types across different anatomical structures.",
        viz_types=["Bar Chart"],
        image_url="http://localhost:8000/sdata-output/USP1/5.png",
        category ="Textual"
    ),
    UserStoryResponse(
        id=6,
        userstory="Expression threshold filtering evaluation",
        description="This analysis identifies and removes non-specific genes—those highly expressed across all cell types—and evaluates the impact of their removal on h5ad data structure using UMAP visualizations at multiple expression thresholds.",
        viz_types=["Clusters (umap)"],
        image_url="http://localhost:8000/sdata-output/USP1/6.png",
        category ="Textual"
    ),
    UserStoryResponse(
        id=7,
        userstory="Demographic flow diagram",
        description="This dataset captures metadata linking donors, organs, tissue blocks, anatomical structures, and datasets. It is best visualized using a Sankey diagram to show the flow from donors to organs, structures, and datasets.",
        viz_types=["Sankey"],
        image_url="http://localhost:8000/sdata-output/USP1/7.png",
        category ="Textual"
    ),
    UserStoryResponse(
        id=8,
        userstory="Comparing lung tissue data",
        description="This dataset contains spatial graphs of healthy and diseased tissues, showing cell types and their connections. It enables comparison of immune cell distributions, such as CD68+ Macrophages and Mast Cells, across conditions.",
        viz_types=["Split Violin"],
        image_url="http://localhost:8000/sdata-output/USP1/8.png",
        category ="Textual"
    ),
    UserStoryResponse(
        id=9,
        userstory=" Exploring cell neighborhoods",
        description="This dataset includes cell types and their connections, showing relationships between cells like Macrophages, Lymphocytes, and Muscle/Fibroblasts. It is best visualized as a hierarchical tree to reveal structured groupings.",
        viz_types=["Hierarchical tree"],
        image_url="http://localhost:8000/sdata-output/USP1/9.png",
        category ="Networks"
    ),
    UserStoryResponse(
        id=10,
        userstory="Explore cell distance distributions",
        description="This dataset contains spatial coordinates and cell type labels from a tumor microenvironment, including cell types like Tumor/Epithelial, Lymphocyte(III), and PDL1+ Macrophage. It supports visualizations such as violin plots to explore cell type distribution and density across regions.",
        viz_types=["Histogram, Violin plot"],
        image_url="http://localhost:8000/sdata-output/USP1/10.png",
        category ="Networks"
    ),  
]
