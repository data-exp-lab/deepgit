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
        if criteria_config.get('strict_and_logic', False):
            # Apply strict AND logic (all criteria must be satisfied)
            final_edges = self._apply_strict_and_logic(all_edges, criteria_config)
        elif criteria_config.get('min_criteria_required', 0) > 1:
            # Apply flexible AND logic (at least N criteria must be satisfied)
            final_edges = self._apply_flexible_and_logic(all_edges, criteria_config)
        elif criteria_config.get('use_and_logic', False):
            # Apply regular AND logic (multiple criteria required)
            final_edges = self._apply_combination_logic(all_edges, criteria_config)
            
            # Filter to only keep combined edges (edges that satisfy multiple criteria)
            filtered_edges = []
            for edge in final_edges:
                if len(edge) >= 3:
                    edge_data = edge[2]
                    edge_type = edge_data.get('edge_type', 'unknown')
                    if edge_type == 'combined':
                        filtered_edges.append(edge)
            
            final_edges = filtered_edges
        else:
            # Apply OR logic (any criterion creates an edge)
            final_edges = self._apply_combination_logic(all_edges, criteria_config)
        
        # Add final edges to graph
        # Filter out None edges and ensure proper structure
        valid_edges = []
        for edge in final_edges:
            if edge is not None and len(edge) == 3:
                repo1, repo2, edge_data = edge
                if isinstance(edge_data, dict):
                    # Clean the edge data to ensure it's compatible with NetworkX
                    cleaned_edge_data = {}
                    for key, value in edge_data.items():
                        if isinstance(value, list):
                            # Convert lists to strings for NetworkX compatibility
                            cleaned_edge_data[key] = '|'.join([str(item) for item in value])
                        else:
                            cleaned_edge_data[key] = str(value)
                    valid_edges.append((repo1, repo2, cleaned_edge_data))
                else:
                    pass
            elif edge is not None:
                pass
        
        G.add_edges_from(valid_edges)
        
        # Calculate total edges and statistics
        total_edges = len(G.edges())
        edge_stats['total_edges'] = total_edges
        edge_stats['total_nodes'] = len(G.nodes())
        edge_stats['criteria_used'] = [k for k, v in criteria_config.items() if v]
        edge_stats['combination_logic_applied'] = True
        
        return G, edge_stats

    def create_edges_on_existing_graph(self, G: nx.Graph, criteria_config: Dict[str, any]) -> Dict[str, any]:
        """
        Create edges on an existing graph based on specified criteria.
        
        Args:
            G: Existing NetworkX graph with nodes
            criteria_config: Configuration for edge generation criteria
            
        Returns:
            Dictionary with statistics about created edges
        """
        
        # Extract criteria configuration
        topic_based_linking = criteria_config.get('topic_based_linking', False)
        topic_threshold = criteria_config.get('topic_threshold', 2)
        contributor_overlap_enabled = criteria_config.get('contributor_overlap_enabled', False)
        contributor_threshold = criteria_config.get('contributor_threshold', 1)
        shared_organization_enabled = criteria_config.get('shared_organization_enabled', False)
        common_stargazers_enabled = criteria_config.get('common_stargazers_enabled', False)
        stargazer_threshold = criteria_config.get('stargazer_threshold', 5)
        use_and_logic = criteria_config.get('use_and_logic', False)
        
        # Validate that at least one criterion is enabled
        enabled_criteria = [
            topic_based_linking,
            contributor_overlap_enabled,
            shared_organization_enabled,
            common_stargazers_enabled
        ]
        
        if not any(enabled_criteria):
            raise ValueError("At least one edge creation criterion must be enabled")
        
        # Remove all existing edges first
        G.remove_edges_from(list(G.edges()))
        
        # Get all nodes
        nodes = list(G.nodes())
        if len(nodes) < 2:
            return {'message': 'Not enough nodes to create edges'}
        
        # Generate edges based on enabled criteria
        edge_stats = {}
        all_edges = []
        
        # Generate all potential edges for each criterion
        if topic_based_linking:
            topic_edges = self._generate_topic_based_edges_from_graph(G, nodes, topic_threshold)
            edge_stats['topic_based_edges'] = len(topic_edges)
            all_edges.extend(topic_edges)
        
        if contributor_overlap_enabled:
            contributor_edges = self._generate_contributor_overlap_edges_from_graph(
                G, nodes, contributor_threshold
            )
            edge_stats['contributor_overlap_edges'] = len(contributor_edges)
            all_edges.extend(contributor_edges)
        
        if shared_organization_enabled:
            org_edges = self._generate_shared_organization_edges_from_graph(G, nodes)
            edge_stats['shared_organization_edges'] = len(org_edges)
            all_edges.extend(org_edges)
        
        if common_stargazers_enabled:
            stargazer_edges = self._generate_stargazer_overlap_edges_from_graph(
                G, nodes, stargazer_threshold
            )
            edge_stats['stargazer_overlap_edges'] = len(stargazer_edges)
            all_edges.extend(stargazer_edges)
        
        # Apply combination logic
        if criteria_config.get('strict_and_logic', False):
            # Apply strict AND logic (all criteria must be satisfied)
            final_edges = self._apply_strict_and_logic(all_edges, criteria_config)
        elif criteria_config.get('min_criteria_required', 0) > 1:
            # Apply flexible AND logic (at least N criteria must be satisfied)
            final_edges = self._apply_flexible_and_logic(all_edges, criteria_config)
        elif use_and_logic:
            # Apply regular AND logic (multiple criteria required)
            final_edges = self._apply_combination_logic(all_edges, criteria_config)
            
            # Filter to only keep combined edges (edges that satisfy multiple criteria)
            filtered_edges = []
            for edge in final_edges:
                if len(edge) >= 3:
                    edge_data = edge[2]
                    edge_type = edge_data.get('edge_type', 'unknown')
                    if edge_type == 'combined':
                        filtered_edges.append(edge)
            
            final_edges = filtered_edges
        else:
            # Apply OR logic (any criterion creates an edge)
            final_edges = self._apply_combination_logic(all_edges, criteria_config)
        
        # Add final edges to graph
        # Filter out None edges and ensure proper structure
        valid_edges = []
        for i, edge in enumerate(final_edges):
            if edge is not None and len(edge) == 3:
                repo1, repo2, edge_data = edge
                if isinstance(edge_data, dict):
                    # Clean the edge data to ensure it's compatible with NetworkX
                    cleaned_edge_data = {}
                    for key, value in edge_data.items():
                        if isinstance(value, list):
                            # Convert lists to strings for NetworkX compatibility
                            cleaned_edge_data[key] = '|'.join([str(item) for item in value])
                        else:
                            cleaned_edge_data[key] = str(value)
                    valid_edges.append((repo1, repo2, cleaned_edge_data))
                else:
                    pass
            elif edge is not None:
                pass
        
        G.add_edges_from(valid_edges)
        
        # Calculate total edges and statistics
        total_edges = len(G.edges())
        edge_stats['total_edges'] = total_edges
        edge_stats['total_nodes'] = len(G.nodes())
        edge_stats['criteria_used'] = [k for k, v in criteria_config.items() if v and k != 'use_and_logic']
        edge_stats['combination_logic_applied'] = True
        
        return edge_stats

    def _get_repos_for_topics(self, topics: List[str]) -> List[Dict]:
        """Get repositories that have any of the given topics."""
        if not topics:
            return []
        
        topics_lower = [t.lower() for t in topics]
        placeholders = ",".join(["?"] * len(topics_lower))
        
        # Create exact topic matching conditions
        conditions = []
        for topic in topics_lower:
            conditions.append(f"LOWER(t.topics) LIKE '%|{topic}|%' OR LOWER(t.topics) LIKE '{topic}|%' OR LOWER(t.topics) LIKE '%|{topic}' OR LOWER(t.topics) = '{topic}'")
        
        query = f"""
            WITH matching_repos AS (
                SELECT DISTINCT r.nameWithOwner
                FROM repos r
                JOIN repo_topics t ON r.nameWithOwner = t.repo
                WHERE ({" OR ".join(conditions)})
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
                    r.createdAt_year,
                    r.license,
                    r.bigquery_contributors,
                    r.bigquery_stargazers,
                    t.topics
                FROM repos r
                JOIN repo_topics t ON r.nameWithOwner = t.repo
                JOIN matching_repos mr ON r.nameWithOwner = mr.nameWithOwner
            )
            SELECT * FROM repo_data
        """
        
        result = self.con.execute(query).fetchall()
        
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
            if isinstance(date_val, int):
                return date_val
            elif isinstance(date_val, str):
                date = datetime.strptime(date_val.split('T')[0], "%Y-%m-%d")
                return date.year
            else:
                return date_val.year
        except (ValueError, TypeError):
            return 0

    def _parse_list_string(self, data_str: str) -> set:
        """
        Parse a string representation of a list into a set.
        Handles various formats: comma-separated, pipe-separated, or JSON-like.
        """
        if not data_str:
            return set()
        
        # Remove whitespace and normalize
        data_str = data_str.strip()
        
        # Handle empty string
        if not data_str:
            return set()
        
        # Try to parse as JSON-like list first
        if data_str.startswith('[') and data_str.endswith(']'):
            try:
                # Remove brackets and split by comma
                inner_content = data_str[1:-1].strip()
                if inner_content:
                    items = [item.strip().strip('"\'') for item in inner_content.split(',')]
                    return set(item for item in items if item)
                return set()
            except:
                pass
        
        # Handle pipe-separated values
        if '|' in data_str:
            items = [item.strip() for item in data_str.split('|')]
            return set(item for item in items if item)
        
        # Handle comma-separated values (default)
        if ',' in data_str:
            items = [item.strip() for item in data_str.split(',')]
            return set(item for item in items if item)
        
        # Single item
        return {data_str} if data_str else set()

    def _format_list_data(self, data) -> str:
        """Format list data as comma-separated string."""
        if not data:
            return ""
        if isinstance(data, list):
            return ",".join(data)
        elif isinstance(data, str):
            # Handle string representation of list
            if data.startswith('[') and data.endswith(']'):
                # Remove brackets and split by comma
                return data[1:-1]
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
                        'edge_type': 'topic_based',
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
                # Get contributors and clean the data
                contributors1_str = G.nodes[repo1].get('contributors', '')
                contributors2_str = G.nodes[repo2].get('contributors', '')
                
                # Parse contributors properly
                contributors1 = self._parse_list_string(contributors1_str)
                contributors2 = self._parse_list_string(contributors2_str)
                
                # Find overlap (order doesn't matter)
                shared_contributors = contributors1.intersection(contributors2)
                if len(shared_contributors) >= threshold:
                    edges.append((repo1, repo2, {
                        'edge_type': 'contributor_overlap',
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
                        'edge_type': 'shared_organization',
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
                # Get stargazers and clean the data
                stargazers1_str = G.nodes[repo1].get('stargazers', '')
                stargazers2_str = G.nodes[repo2].get('stargazers', '')
                
                # Parse stargazers properly
                stargazers1 = self._parse_list_string(stargazers1_str)
                stargazers2 = self._parse_list_string(stargazers2_str)
                
                # Find overlap (order doesn't matter)
                shared_stargazers = stargazers1.intersection(stargazers2)
                if len(shared_stargazers) >= threshold:
                    edges.append((repo1, repo2, {
                        'edge_type': 'stargazer_overlap',
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
            # Safely extract repository names
            if len(edge) < 2:
                continue  # Skip invalid edges
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
                if combined_edge:  # Only add if combined edge was created successfully
                    final_edges.append(combined_edge)
        
        return final_edges

    def _create_combined_edge(self, edges: List[Tuple]) -> Tuple:
        """
        Create a combined edge when multiple criteria are satisfied for the same repository pair.
        """
        if not edges:
            return None
        
        # Get the repository pair - safely handle edges with more than 3 elements
        first_edge = edges[0]
        if len(first_edge) < 2:
            return None
        
        repo1, repo2 = first_edge[0], first_edge[1]
        
        # Collect all edge types and data
        edge_types = []
        shared_data = {}
        total_weight = 0
        
        for i, edge in enumerate(edges):
            # Safely extract edge data - handle edges with more than 3 elements
            if len(edge) >= 3:
                edge_data = edge[2] if isinstance(edge[2], dict) else {}
            else:
                edge_data = {}
                
            # Handle both 'type' and 'edge_type' keys for backward compatibility
            edge_type = edge_data.get('edge_type', edge_data.get('type', 'unknown'))
            edge_types.append(edge_type)
            
            # Accumulate shared data
            for key, value in edge_data.items():
                if key not in ['edge_type', 'type', 'weight']:
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
            'edge_type': 'combined',
            'criteria_satisfied': edge_types,
            'weight': total_weight,
        }
        
        # Safely add shared data, ensuring all values are serializable
        for key, value in shared_data.items():
            if isinstance(value, list):
                # Ensure list contains only strings or numbers
                clean_value = []
                for item in value:
                    if isinstance(item, (str, int, float)):
                        clean_value.append(str(item))
                combined_data[key] = clean_value
            elif isinstance(value, (str, int, float, bool)):
                combined_data[key] = value
            else:
                # Convert other types to string
                combined_data[key] = str(value)
        
        result = (repo1, repo2, combined_data)
        return result

    def _apply_flexible_and_logic(self, all_edges: List[Tuple], criteria_config: Dict[str, any]) -> List[Tuple]:
        """
        Apply flexible AND logic to require a minimum number of criteria to be satisfied.
        Only keeps edges that satisfy at least the specified number of criteria.
        """
        if not all_edges:
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
            return all_edges
        
        # Get minimum criteria required (default to 2, or all if strict_and_logic is true)
        min_criteria_required = criteria_config.get('min_criteria_required', 2)
        if criteria_config.get('strict_and_logic', False):
            min_criteria_required = enabled_criteria
        
        # Group edges by repository pairs
        edge_groups = {}
        for edge in all_edges:
            # Safely extract repository names
            if len(edge) < 2:
                continue  # Skip invalid edges
            repo1, repo2 = edge[0], edge[1]
            edge_key = tuple(sorted([repo1, repo2]))
            
            if edge_key not in edge_groups:
                edge_groups[edge_key] = []
            edge_groups[edge_key].append(edge)
        
        # Only keep edges that satisfy at least min_criteria_required
        final_edges = []
        for edge_key, edges_for_pair in edge_groups.items():
            # Check if this repository pair satisfies enough criteria
            satisfied_criteria = set()
            
            for edge in edges_for_pair:
                edge_data = edge[2] if len(edge) >= 3 else {}
                edge_type = edge_data.get('edge_type', 'unknown')
                satisfied_criteria.add(edge_type)
            
            # Only keep if enough criteria are satisfied
            if len(satisfied_criteria) >= min_criteria_required:
                # Create a combined edge with all criteria
                combined_edge = self._create_combined_edge(edges_for_pair)
                if combined_edge is not None:
                    final_edges.append(combined_edge)
        
        return final_edges

    def _apply_strict_and_logic(self, all_edges: List[Tuple], criteria_config: Dict[str, any]) -> List[Tuple]:
        """
        Apply strict AND logic to require ALL enabled criteria to be satisfied for an edge.
        Only keeps edges that satisfy ALL enabled criteria simultaneously.
        """
        if not all_edges:
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
            return all_edges
        
        # Group edges by repository pairs
        edge_groups = {}
        for edge in all_edges:
            # Safely extract repository names
            if len(edge) < 2:
                continue  # Skip invalid edges
            repo1, repo2 = edge[0], edge[1]
            edge_key = tuple(sorted([repo1, repo2]))
            
            if edge_key not in edge_groups:
                edge_groups[edge_key] = []
            edge_groups[edge_key].append(edge)
        
        # Only keep edges that satisfy ALL enabled criteria
        final_edges = []
        for edge_key, edges_for_pair in edge_groups.items():
            # Check if this repository pair satisfies ALL enabled criteria
            satisfied_criteria = set()
            
            for edge in edges_for_pair:
                edge_data = edge[2] if len(edge) >= 3 else {}
                edge_type = edge_data.get('edge_type', 'unknown')
                satisfied_criteria.add(edge_type)
            
            # Check if ALL enabled criteria are satisfied
            required_criteria = set()
            if criteria_config.get('topic_based_linking', False):
                required_criteria.add('topic_based')
            if criteria_config.get('contributor_overlap_enabled', False):
                required_criteria.add('contributor_overlap')
            if criteria_config.get('shared_organization_enabled', False):
                required_criteria.add('shared_organization')
            if criteria_config.get('common_stargazers_enabled', False):
                required_criteria.add('stargazer_overlap')
            
            # Debug: Show what criteria this pair satisfied
            if len(edges_for_pair) > 1:
                pass
            
            # Only keep if ALL required criteria are satisfied
            if satisfied_criteria.issuperset(required_criteria):
                # Create a combined edge with all criteria
                combined_edge = self._create_combined_edge(edges_for_pair)
                if combined_edge is not None:
                    final_edges.append(combined_edge)
        
        # Debug: Show some examples of what criteria were satisfied
        if len(edge_groups) > 0:
            pass
        
        return final_edges

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
        
        # Group edges by repository pairs
        edge_groups = {}
        for edge in edges:
            # Safely extract repository names
            if len(edge) < 2:
                continue  # Skip invalid edges
            repo1, repo2 = edge[0], edge[1]
            edge_key = tuple(sorted([repo1, repo2]))
            
            if edge_key not in edge_groups:
                edge_groups[edge_key] = []
            edge_groups[edge_key].append(edge)
        
        # Only keep edges that satisfy multiple criteria
        final_edges = []
        for edge_key, edges_for_pair in edge_groups.items():
            # Check if this repository pair satisfies multiple criteria
            satisfied_criteria = set()
            
            for edge in edges_for_pair:
                edge_data = edge[2] if len(edge) >= 3 else {}
                edge_type = edge_data.get('edge_type', 'unknown')
                satisfied_criteria.add(edge_type)
            
            # Debug: Show what criteria this pair satisfied
            if len(edges_for_pair) > 1:
                pass
            
            # Only keep if multiple criteria are satisfied
            if len(satisfied_criteria) > 1:
                # Create a combined edge with all criteria
                combined_edge = self._create_combined_edge(edges_for_pair)
                if combined_edge is not None:
                    final_edges.append(combined_edge)
            else:
                pass
        
        return final_edges

    def _generate_topic_based_edges_from_graph(self, G: nx.Graph, nodes: List[str], threshold: int) -> List[Tuple]:
        """Generate edges based on shared topics from existing graph nodes."""
        edges = []
        
        for i, repo1 in enumerate(nodes):
            for j, repo2 in enumerate(nodes[i+1:], i+1):
                # Get topics from node attributes
                topics1_str = G.nodes[repo1].get('topics', '')
                topics2_str = G.nodes[repo2].get('topics', '')
                
                if topics1_str and topics2_str:
                    topics1 = set(topics1_str.split('|')) if '|' in topics1_str else set([topics1_str])
                    topics2 = set(topics2_str.split('|')) if '|' in topics2_str else set([topics2_str])
                    
                    # Remove empty strings
                    topics1.discard('')
                    topics2.discard('')
                    
                    shared_topics = topics1.intersection(topics2)
                    if len(shared_topics) >= threshold:
                        edges.append((repo1, repo2, {
                            'edge_type': 'topic_based',
                            'shared_topics': list(shared_topics),
                            'weight': len(shared_topics)
                        }))
        
        return edges

    def _generate_contributor_overlap_edges_from_graph(self, G: nx.Graph, nodes: List[str], threshold: int) -> List[Tuple]:
        """Generate edges based on contributor overlap from existing graph nodes."""
        edges = []
        
        for i, repo1 in enumerate(nodes):
            for j, repo2 in enumerate(nodes[i+1:], i+1):
                # Get contributors from node attributes
                contributors1_str = G.nodes[repo1].get('contributors', '')
                contributors2_str = G.nodes[repo2].get('contributors', '')
                
                if contributors1_str and contributors2_str:
                    # Parse contributors properly
                    contributors1 = self._parse_list_string(contributors1_str)
                    contributors2 = self._parse_list_string(contributors2_str)
                    
                    # Find overlap (order doesn't matter)
                    shared_contributors = contributors1.intersection(contributors2)
                    if len(shared_contributors) >= threshold:
                        edges.append((repo1, repo2, {
                            'edge_type': 'contributor_overlap',
                            'shared_contributors': list(shared_contributors),
                            'weight': len(shared_contributors)
                        }))
        
        return edges

    def _generate_shared_organization_edges_from_graph(self, G: nx.Graph, nodes: List[str]) -> List[Tuple]:
        """Generate edges based on shared organization from existing graph nodes."""
        edges = []
        
        for i, repo1 in enumerate(nodes):
            for j, repo2 in enumerate(nodes[i+1:], i+1):
                # Extract organization from repo name (e.g., "org/repo" -> "org")
                org1 = repo1.split('/')[0] if '/' in repo1 else None
                org2 = repo2.split('/')[0] if '/' in repo2 else None
                
                if org1 and org2 and org1 == org2:
                    edges.append((repo1, repo2, {
                        'edge_type': 'shared_organization',
                        'organization': org1,
                        'weight': 1
                    }))
        
        return edges

    def _generate_stargazer_overlap_edges_from_graph(self, G: nx.Graph, nodes: List[str], threshold: int) -> List[Tuple]:
        """Generate edges based on stargazer overlap from existing graph nodes."""
        edges = []
        
        for i, repo1 in enumerate(nodes):
            for j, repo2 in enumerate(nodes[i+1:], i+1):
                # Get stargazers from node attributes
                stargazers1_str = G.nodes[repo1].get('stargazers', '')
                stargazers2_str = G.nodes[repo2].get('stargazers', '')
                
                if stargazers1_str and stargazers2_str:
                    # Parse stargazers properly
                    stargazers1 = self._parse_list_string(stargazers1_str)
                    stargazers2 = self._parse_list_string(stargazers2_str)
                    
                    # Find overlap (order doesn't matter)
                    shared_stargazers = stargazers1.intersection(stargazers2)
                    if len(shared_stargazers) >= threshold:
                        edges.append((repo1, repo2, {
                            'edge_type': 'stargazer_overlap',
                            'shared_stargazers': list(shared_stargazers),
                            'weight': len(shared_stargazers)
                        }))
        
        return edges

    def _apply_and_logic_for_existing_graph(self, edges: List[Tuple], criteria_config: Dict[str, any]) -> List[Tuple]:
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
        
        # Group edges by repository pairs
        edge_groups = {}
        for edge in edges:
            # Safely extract repository names
            if len(edge) < 2:
                continue  # Skip invalid edges
            repo1, repo2 = edge[0], edge[1]
            edge_key = tuple(sorted([repo1, repo2]))
            
            if edge_key not in edge_groups:
                edge_groups[edge_key] = []
            edge_groups[edge_key].append(edge)
        
        # Only keep edges that satisfy multiple criteria
        final_edges = []
        for edge_key, edges_for_pair in edge_groups.items():
            if len(edges_for_pair) > 1:
                # Multiple criteria satisfied, create a combined edge
                combined_edge = self._create_combined_edge(edges_for_pair)
                if combined_edge is not None:  # Only add if combined edge was created successfully
                    final_edges.append(combined_edge)
        
        return final_edges

    def save_graph_with_edges(self, G: nx.Graph, output_path: str):
        """Save the graph with edges to a GEXF file."""
        # Set graph attributes
        G.graph['has_edges'] = True
        G.graph['edge_generation_criteria'] = 'Multiple criteria combination'
        
        # Ensure edge attributes are properly set
        for u, v, data in G.edges(data=True):
            # Convert complex data structures to strings for GEXF compatibility
            if 'shared_topics' in data and isinstance(data['shared_topics'], list):
                data['shared_topics'] = '|'.join(data['shared_topics'])
            if 'shared_contributors' in data and isinstance(data['shared_contributors'], list):
                data['shared_contributors'] = '|'.join(data['shared_contributors'])
            if 'shared_stargazers' in data and isinstance(data['shared_stargazers'], list):
                data['shared_stargazers'] = '|'.join(data['shared_stargazers'])
            if 'criteria_satisfied' in data and isinstance(data['criteria_satisfied'], list):
                data['criteria_satisfied'] = '|'.join(data['criteria_satisfied'])
        
        # Write to GEXF file
        nx.write_gexf(G, output_path)
        return output_path

    def get_detailed_edge_statistics(self, G: nx.Graph) -> Dict:
        """Get detailed statistics about edge types and their breakdown."""
        if not G.edges():
            return {'message': 'No edges generated'}
        
        edge_types = {}
        combined_edges = {}
        
        for _, _, data in G.edges(data=True):
            edge_type = data.get('edge_type', 'unknown')
            edge_types[edge_type] = edge_types.get(edge_type, 0) + 1
            
            # For combined edges, analyze what criteria were satisfied
            if edge_type == 'combined':
                criteria_satisfied = data.get('criteria_satisfied', [])
                if isinstance(criteria_satisfied, str):
                    criteria_satisfied = criteria_satisfied.split('|')
                
                criteria_key = '|'.join(sorted(criteria_satisfied))
                combined_edges[criteria_key] = combined_edges.get(criteria_key, 0) + 1
        
        # Calculate statistics
        total_edges = len(G.edges())
        total_nodes = len(G.nodes())
        
        stats = {
            'total_nodes': total_nodes,
            'total_edges': total_edges,
            'edge_type_breakdown': edge_types,
            'combined_edge_breakdown': combined_edges,
            'average_degree': sum(dict(G.degree()).values()) / total_nodes if total_nodes > 0 else 0,
            'connected_components': nx.number_connected_components(G),
            'density': nx.density(G),
            'percentage_combined': (edge_types.get('combined', 0) / total_edges * 100) if total_edges > 0 else 0
        }
        
        return stats

    def get_edge_statistics(self, G: nx.Graph) -> Dict:
        """Get comprehensive statistics about the generated graph."""
        if not G.edges():
            return {'message': 'No edges generated'}
        
        edge_types = {}
        for _, _, data in G.edges(data=True):
            edge_type = data.get('edge_type', 'unknown')
            edge_types[edge_type] = edge_types.get(edge_type, 0) + 1
        
        return {
            'total_nodes': len(G.nodes()),
            'total_edges': len(G.edges()),
            'edge_types': edge_types,
            'average_degree': sum(dict(G.degree()).values()) / len(G.nodes()) if G.nodes() else 0,
            'connected_components': nx.number_connected_components(G),
            'density': nx.density(G)
        }
