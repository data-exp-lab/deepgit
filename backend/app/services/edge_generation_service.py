import os
import duckdb
import psutil
import networkx as nx
from datetime import datetime
from typing import List, Dict, Set, Tuple, Optional
import json

class EdgeGenerationService:
    def __init__(self):
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 
            "public", 
            "data", 
            "github_meta.duckdb"
        )
        
        if os.path.exists(db_path):
            self.con = duckdb.connect(database=db_path, read_only=True)
            available_memory = psutil.virtual_memory().available
            memory_limit = min(available_memory * 0.3, 0.5 * 1024 * 1024 * 1024)
            self.con.execute(f"SET memory_limit TO '{int(memory_limit)}B'")
            cpu_count = psutil.cpu_count(logical=False) or 1
            thread_count = max(1, min(cpu_count, 2))
            self.con.execute(f"SET threads TO {thread_count}")
        else:
            raise FileNotFoundError(
                f"Database not found at {db_path}. Please ensure the database file exists before running the application."
            )

    def generate_edges_with_criteria(
        self,
        topics: List[str],
        criteria_config: Dict[str, any]
    ) -> Tuple[nx.Graph, Dict[str, any]]:
        """
        Generate edges based on multiple criteria working in combination.
        
        Args:
            topics: List of topics to find repositories for
            criteria_config: Configuration for edge generation criteria
            
        Returns:
            Tuple of (graph with nodes and edges, statistics about edge generation)
        """
        
        # Extract criteria configuration
        topic_based_linking = criteria_config.get('topic_based_linking', True)
        contributor_overlap_enabled = criteria_config.get('contributor_overlap_enabled', False)
        contributor_overlap_threshold = criteria_config.get('contributor_overlap_threshold', 2)
        shared_organization_enabled = criteria_config.get('shared_organization_enabled', False)
        common_stargazers_enabled = criteria_config.get('common_stargazers_enabled', False)
        stargazer_overlap_threshold = criteria_config.get('stargazer_overlap_threshold', 2)
        
        # Get repositories for the given topics
        repos = self._get_repos_for_topics(topics)
        if not repos:
            return nx.Graph(), {}
        
        # Create graph with nodes
        G = nx.Graph()
        self._add_nodes_to_graph(G, repos)
        
        # Generate edges based on enabled criteria with proper combination logic
        edge_stats = {}
        all_edges = []
        
        # Generate all potential edges for each criterion
        if topic_based_linking:
            topic_edges = self._generate_topic_based_edges(G, repos)
            edge_stats['topic_based_edges'] = len(topic_edges)
            all_edges.extend(topic_edges)
        
        if contributor_overlap_enabled:
            contributor_edges = self._generate_contributor_overlap_edges(
                G, repos, contributor_overlap_threshold
            )
            edge_stats['contributor_overlap_edges'] = len(contributor_edges)
            all_edges.extend(contributor_edges)
        
        if shared_organization_enabled:
            org_edges = self._generate_shared_organization_edges(G, repos)
            edge_stats['shared_organization_edges'] = len(org_edges)
            all_edges.extend(org_edges)
        
        if common_stargazers_enabled:
            stargazer_edges = self._generate_stargazer_overlap_edges(
                G, repos, stargazer_overlap_threshold
            )
            edge_stats['stargazer_overlap_edges'] = len(stargazer_edges)
            all_edges.extend(stargazer_edges)
        
        # Apply combination logic: edges are created when ANY enabled criterion is satisfied
        # But we can also implement AND logic for specific combinations
        final_edges = self._apply_combination_logic(all_edges, criteria_config)
        
        # Apply AND logic for specific combinations if requested
        if criteria_config.get('use_and_logic', False):
            final_edges = self._apply_and_logic(final_edges, criteria_config)
        
        # Add final edges to graph
        G.add_edges_from(final_edges)
        
        # Calculate total edges and statistics
        total_edges = len(G.edges())
        edge_stats['total_edges'] = total_edges
        edge_stats['total_nodes'] = len(G.nodes())
        edge_stats['criteria_used'] = [k for k, v in criteria_config.items() if v]
        edge_stats['combination_logic_applied'] = True
        
        return G, edge_stats

    def _get_repos_for_topics(self, topics: List[str]) -> List[Dict]:
        """Get repositories that have any of the given topics."""
        if not topics:
            return []
        
        topics_lower = [t.lower() for t in topics]
        placeholders = ",".join(["?"] * len(topics_lower))
        
        query = f"""
            WITH matching_repos AS (
                SELECT DISTINCT r.nameWithOwner
                FROM repos r
                JOIN repo_topics t ON r.nameWithOwner = t.repo
                WHERE LOWER(t.topic) IN ({placeholders})
            ),
            repo_data AS (
                SELECT 
                    r.nameWithOwner,
                    r.stars,
                    r.forks,
                    r.watchers,
                    r.isArchived,
                    r.languageCount,
                    r.pullRequests,
                    r.issues,
                    r.primaryLanguage,
                    r.createdAt,
                    r.license,
                    r.bigquery_contributors,
                    r.bigquery_stargazers,
                    GROUP_CONCAT(t.topic, '|') AS topics
                FROM repos r
                JOIN repo_topics t ON r.nameWithOwner = t.repo
                JOIN matching_repos mr ON r.nameWithOwner = mr.nameWithOwner
                GROUP BY r.nameWithOwner, r.stars, r.forks, r.watchers, r.isArchived, 
                         r.languageCount, r.pullRequests, r.issues, r.primaryLanguage, 
                         r.createdAt, r.license, r.bigquery_contributors, r.bigquery_stargazers
            )
            SELECT * FROM repo_data
        """
        
        result = self.con.execute(query, topics_lower).fetchall()
        
        columns = [
            "nameWithOwner", "stars", "forks", "watchers", "isArchived",
            "languageCount", "pullRequests", "issues", "primaryLanguage",
            "createdAt", "license", "bigquery_contributors", "bigquery_stargazers", "topics"
        ]
        
        return [dict(zip(columns, row)) for row in result]

    def _add_nodes_to_graph(self, G: nx.Graph, repos: List[Dict]):
        """Add repository nodes to the graph with attributes."""
        for repo in repos:
            node_attrs = {
                'stars': repo['stars'] or 0,
                'forks': repo['forks'] or 0,
                'watchers': repo['watchers'] or 0,
                'isArchived': bool(repo['isArchived']) if repo['isArchived'] is not None else False,
                'languageCount': repo['languageCount'] or 0,
                'pullRequests': repo['pullRequests'] or 0,
                'issues': repo['issues'] or 0,
                'primaryLanguage': repo['primaryLanguage'] or "",
                'createdAt_year': self._extract_year(repo['createdAt']),
                'license': repo['license'] or "",
                'github_url': f"https://github.com/{repo['nameWithOwner']}",
                'topics': repo['topics'] or "",
                'contributors': self._format_list_data(repo['bigquery_contributors']),
                'stargazers': self._format_list_data(repo['bigquery_stargazers'])
            }
            
            G.add_node(repo['nameWithOwner'], **node_attrs)

    def _extract_year(self, date_val) -> int:
        """Extract year from date value."""
        if not date_val:
            return 0
        try:
            if isinstance(date_val, str):
                date = datetime.strptime(date_val.split('T')[0], "%Y-%m-%d")
            else:
                date = date_val
            return date.year
        except (ValueError, TypeError):
            return 0

    def _format_list_data(self, data) -> str:
        """Format list data as comma-separated string."""
        if data and isinstance(data, list):
            return ",".join(data)
        return ""

    def _generate_topic_based_edges(self, G: nx.Graph, repos: List[Dict]) -> List[Tuple]:
        """Generate edges based on shared topics."""
        edges = []
        nodes = list(G.nodes())
        
        for i, repo1 in enumerate(nodes):
            for j, repo2 in enumerate(nodes[i+1:], i+1):
                topics1 = set(G.nodes[repo1]['topics'].split('|')) if G.nodes[repo1]['topics'] else set()
                topics2 = set(G.nodes[repo2]['topics'].split('|')) if G.nodes[repo2]['topics'] else set()
                
                shared_topics = topics1.intersection(topics2)
                if shared_topics:
                    # Create edge with shared topics as weight
                    edges.append((repo1, repo2, {
                        'type': 'topic_based',
                        'shared_topics': list(shared_topics),
                        'weight': len(shared_topics)
                    }))
        
        return edges

    def _generate_contributor_overlap_edges(
        self, 
        G: nx.Graph, 
        repos: List[Dict], 
        threshold: int
    ) -> List[Tuple]:
        """Generate edges based on contributor overlap."""
        edges = []
        nodes = list(G.nodes())
        
        for i, repo1 in enumerate(nodes):
            for j, repo2 in enumerate(nodes[i+1:], i+1):
                contributors1 = set(G.nodes[repo1]['contributors'].split(',')) if G.nodes[repo1]['contributors'] else set()
                contributors2 = set(G.nodes[repo2]['contributors'].split(',')) if G.nodes[repo2]['contributors'] else set()
                
                # Remove empty strings
                contributors1.discard('')
                contributors2.discard('')
                
                shared_contributors = contributors1.intersection(contributors2)
                if len(shared_contributors) >= threshold:
                    edges.append((repo1, repo2, {
                        'type': 'contributor_overlap',
                        'shared_contributors': list(shared_contributors),
                        'weight': len(shared_contributors)
                    }))
        
        return edges

    def _generate_shared_organization_edges(self, G: nx.Graph, repos: List[Dict]) -> List[Tuple]:
        """Generate edges based on shared organization ownership."""
        edges = []
        nodes = list(G.nodes())
        
        for i, repo1 in enumerate(nodes):
            for j, repo2 in enumerate(nodes[i+1:], i+1):
                # Extract organization from repo name (e.g., "org/repo" -> "org")
                org1 = repo1.split('/')[0] if '/' in repo1 else None
                org2 = repo2.split('/')[0] if '/' in repo2 else None
                
                if org1 and org2 and org1 == org2:
                    edges.append((repo1, repo2, {
                        'type': 'shared_organization',
                        'organization': org1,
                        'weight': 1
                    }))
        
        return edges

    def _generate_stargazer_overlap_edges(
        self, 
        G: nx.Graph, 
        repos: List[Dict], 
        threshold: int
    ) -> List[Tuple]:
        """Generate edges based on stargazer overlap."""
        edges = []
        nodes = list(G.nodes())
        
        for i, repo1 in enumerate(nodes):
            for j, repo2 in enumerate(nodes[i+1:], i+1):
                stargazers1 = set(G.nodes[repo1]['stargazers'].split(',')) if G.nodes[repo1]['stargazers'] else set()
                stargazers2 = set(G.nodes[repo2]['stargazers'].split(',')) if G.nodes[repo2]['stargazers'] else set()
                
                # Remove empty strings
                stargazers1.discard('')
                stargazers2.discard('')
                
                shared_stargazers = stargazers1.intersection(stargazers2)
                if len(shared_stargazers) >= threshold:
                    edges.append((repo1, repo2, {
                        'type': 'stargazer_overlap',
                        'shared_stargazers': list(shared_stargazers),
                        'weight': len(shared_stargazers)
                    }))
        
        return edges

    def _apply_combination_logic(self, all_edges: List[Tuple], criteria_config: Dict[str, any]) -> List[Tuple]:
        """
        Apply combination logic to determine which edges to keep.
        Currently implements OR logic (any enabled criterion creates an edge),
        but can be extended for AND logic combinations.
        """
        if not all_edges:
            return []
        
        # Group edges by repository pairs
        edge_groups = {}
        for edge in all_edges:
            repo1, repo2 = edge[0], edge[1]
            edge_key = tuple(sorted([repo1, repo2]))
            
            if edge_key not in edge_groups:
                edge_groups[edge_key] = []
            edge_groups[edge_key].append(edge)
        
        final_edges = []
        
        # For each repository pair, decide which edge(s) to keep
        for edge_key, edges in edge_groups.items():
            if len(edges) == 1:
                # Only one criterion satisfied, keep the edge
                final_edges.append(edges[0])
            else:
                # Multiple criteria satisfied, create a combined edge
                combined_edge = self._create_combined_edge(edges)
                final_edges.append(combined_edge)
        
        return final_edges

    def _create_combined_edge(self, edges: List[Tuple]) -> Tuple:
        """
        Create a combined edge when multiple criteria are satisfied for the same repository pair.
        """
        if not edges:
            return None
        
        # Get the repository pair
        repo1, repo2 = edges[0][0], edges[0][1]
        
        # Collect all edge types and data
        edge_types = []
        shared_data = {}
        total_weight = 0
        
        for edge in edges:
            edge_data = edge[2] if len(edge) > 2 else {}
            edge_type = edge_data.get('type', 'unknown')
            edge_types.append(edge_type)
            
            # Accumulate shared data
            for key, value in edge_data.items():
                if key not in ['type', 'weight']:
                    if key not in shared_data:
                        shared_data[key] = []
                    if isinstance(value, list):
                        shared_data[key].extend(value)
                    else:
                        shared_data[key].append(value)
            
            # Accumulate weight
            total_weight += edge_data.get('weight', 1)
        
        # Remove duplicates from shared data
        for key in shared_data:
            if isinstance(shared_data[key], list):
                shared_data[key] = list(set(shared_data[key]))
        
        # Create combined edge data
        combined_data = {
            'type': 'combined',
            'criteria_satisfied': edge_types,
            'weight': total_weight,
            **shared_data
        }
        
        return (repo1, repo2, combined_data)

    def _apply_and_logic(self, edges: List[Tuple], criteria_config: Dict[str, any]) -> List[Tuple]:
        """
        Apply AND logic to require multiple criteria to be satisfied for an edge.
        Only keeps edges that satisfy multiple enabled criteria.
        """
        if not edges:
            return []
        
        # Count how many criteria are enabled
        enabled_criteria = sum([
            criteria_config.get('topic_based_linking', False),
            criteria_config.get('contributor_overlap_enabled', False),
            criteria_config.get('shared_organization_enabled', False),
            criteria_config.get('common_stargazers_enabled', False)
        ])
        
        if enabled_criteria <= 1:
            # Only one criterion enabled, no AND logic needed
            return edges
        
        # Filter edges to only keep those that satisfy multiple criteria
        filtered_edges = []
        for edge in edges:
            edge_data = edge[2] if len(edge) > 2 else {}
            
            if edge_data.get('type') == 'combined':
                # This edge already satisfies multiple criteria
                filtered_edges.append(edge)
            else:
                # Single criterion edge, check if it should be kept
                # For AND logic, we might want to require at least 2 criteria
                # This is a simplified version - you can customize the logic
                pass
        
        return filtered_edges

    def save_graph_with_edges(self, G: nx.Graph, output_path: str):
        """Save the graph with edges to a GEXF file."""
        # Set graph attributes
        G.graph['has_edges'] = True
        G.graph['edge_generation_criteria'] = 'Multiple criteria combination'
        
        # Write to GEXF file
        nx.write_gexf(G, output_path)
        return output_path

    def get_edge_statistics(self, G: nx.Graph) -> Dict:
        """Get comprehensive statistics about the generated graph."""
        if not G.edges():
            return {'message': 'No edges generated'}
        
        edge_types = {}
        for _, _, data in G.edges(data=True):
            edge_type = data.get('type', 'unknown')
            edge_types[edge_type] = edge_types.get(edge_type, 0) + 1
        
        return {
            'total_nodes': len(G.nodes()),
            'total_edges': len(G.edges()),
            'edge_types': edge_types,
            'average_degree': sum(dict(G.degree()).values()) / len(G.nodes()) if G.nodes() else 0,
            'connected_components': nx.number_connected_components(G),
            'density': nx.density(G)
        }
