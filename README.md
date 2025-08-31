<div align="center">
    <img src="./public/deepgit_logo.png" alt="WESE Logo" width="150">
    <h1 align="center">DeepGit</h1>
</div>

# Overview
DeepGit is a free, open-source web application designed to help researchers and research software engineers discover and explore research software within specific domains. 

# Development

## Prerequisites
- Node.js (v16 or higher)
- npm (v8 or higher)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/data-exp-lab/deepgit.git
```

2. Install frontend dependencies:
```bash
cd deepgit
npm install
```

3. Install the backend dependencies:
```bash
cd backend
pip install -r requirements.txt
```

4. Start the development server:
```bash
cd ..
bash start.sh
```
# Acknowledgment
This work is supported by the Google Academic Research Grants (No.406556141), and the Gemini Academic Program.

DeepGit is built upon [Retina](https://ouestware.gitlab.io/retina/1.0.0-beta.4/#/) developed by [OuestWare](https://www.ouestware.com/en/)

# Citation
If you use DeepGit in your research, please cite:
```bibtex
@inproceedings{deepgit,
  title={DeepGit: Promoting Exploration and Discovery of Research Software with Human-Curated Graphs},
  author={Yilin Xia and Shin-Rong Tsai and Matthew Turk},
  booktitle={VLDB 2025 Workshop: DaSH: Data Science with Human in the Loop},
  year={2025},
  url={https://www.vldb.org/2025/Workshops/VLDB-Workshops-2025/DaSH/DaSH25_4.pdf}
}
```

# License 
The software is available under [GNU GPLv3 license](https://gitlab.com/ouestware/retina/-/blob/main/LICENSE).

# Contact
For any queries, please [open an issue](https://github.com/data-exp-lab/deepgit/issues) on GitHub or contact [Yilin Xia](https://github.com/yilinxia).