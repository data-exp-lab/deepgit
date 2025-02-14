# Explanation of Edge Generation Between Repositories

## Overview
This process describes how to build edges (relationships) between GitHub repositories based on shared topics and semantic similarity.

<!-- ## Data Source
Due to GitHub API rate limits, we are currently using the [GitHub Public Repository Metadata](https://www.kaggle.com/datasets/pelmers/github-repository-metadata-with-5-stars?resource=download) from Kaggle to demonstrate our concept.  -->

## Steps
### Getting Knowledge Base
```
input: a topic
output: a set of repositories and its associated topics
```
1. **Start With a Topic ($X$)**  
  Begin with a specific topic $X$ (e.g., “visual-programming”).

1. **Extract a Set of GitHub Repositories ($R$)**  
  From the input topic $X$, gather all repositories that contain this topic. Denote this set as:  
  $R = \{ R_1, R_2, \dots, R_n \}$

   

1. **Generate a Set of Topics ($T$) From Repositories**  
  Each repository in $R$ may have additional tags. Collect all unique topics from these repositories to form a new set:  
  $T = \{ T_1, T_2, \dots, T_m \}$

1. **Refine the Topic Set to Obtain $T_{\text{enhanced}}$**  
  We refine the topic set $T$ to ensure that the topics remain closely related to $X$. This process considers three key dimensions:  

     - **Frequency Filter**: Ensures that selected topics align with common terminology used in development and how tool creators typically self-identify their projects.
     - **Word Similarity**: Ensures that selected tags are semantically relevant.
     - **Human-in-the-Loop Validation**: Involves expert review to guarantee the correctness and relevance of the selected topics.


1. **Retrieve the Final List of Repositories (Our Knowledge Base)**  
  With $T_{\text{enhanced}}$, we extract all repositories from GitHub that match the same criteria as before. The final result is a dataframe containing repositories and their associated topics, which will be used for constructing the graph.

 > [!WARNING]
> We only include repositories with more than 5 stars for demonstration purposes, excluding randomly created repositories.
> Step 4 can be iterated multiple times for thorough refinement, but we perform only one iteration for now.

### Defining Edges
```
input: a datafram (repo_fullname, associated topics)
output: a set of repositories and its associated topics
```
1. **Build Edges**  
  Repositories typically have connections based on shared topics. To mitigate noise in the graph, we set a threshold of $\geq 2$ shared topics in $T_{\text{enhanced}}$ before establishing an edge between two repositories. Additionally, we are more interested whether repository are connected because of overlapped topic other than the start field, we then set a threshold of $\geq 1$ non_relevant_shared_topics.


1. **Ingest the Graph Into Retina**  
  Finally, generate a GEXF file for the graph and use [Ipysigma](https://github.com/medialab/ipysigma) to visualize it.


> [!TIP]
> Iterating more in step 4 can help eliminate noise in step 1.