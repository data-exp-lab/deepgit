import json
import os
from pathlib import Path
from typing import Dict, Any, Optional

class ConfigManager:
    """Manages application configuration from file and environment variables."""
    
    def __init__(self, config_path: str = None):
        """Initialize the configuration manager."""
        if config_path is None:
            # Default to config.json in the same directory as this file
            self.config_path = Path(__file__).parent / "config.json"
        else:
            self.config_path = Path(config_path)
        
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file and environment variables."""
        config = self._get_default_config()
        
        # Load from file if it exists
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    file_config = json.load(f)
                    config = self._merge_config(config, file_config)
            except Exception as e:
                print(f"Warning: Could not load config file {self.config_path}: {e}")
        
        # Override with environment variables
        config = self._apply_env_overrides(config)
        
        return config
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration values."""
        return {
            "ai_providers": {
                "openai": {
                    "api_key": "",
                    "model": "gpt-4",
                    "base_url": "https://api.openai.com/v1"
                },
                "azure_openai": {
                    "api_key": "",
                    "endpoint": "https://your-resource-name.openai.azure.com/",
                    "deployment_name": "",
                    "api_version": "2024-02-15-preview"
                },
                "google_genai": {
                    "api_key": "",
                    "model": "gemini-pro"
                },
                "anthropic": {
                    "api_key": "",
                    "model": "claude-3-sonnet-20240229"
                }
            },
            "github": {
                "token": "",
                "rate_limit_per_hour": 5000
            },
            "deepgit_ai": {
                "timeout_minutes": 50,
                "batch_size": 50,
                "cache_hours": 24,
                "max_repos_per_request": 1000,
                "strict_database_only": True,
                "include_database_context": True
            },
            "server": {
                "host": "127.0.0.1",
                "port": 5002,
                "debug": False,
                "timeout": 3600
            },
            "database": {
                "path": "kuzu",
                "auto_cleanup": True,
                "backup_enabled": False
            }
        }
    
    def _merge_config(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively merge configuration dictionaries."""
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_config(result[key], value)
            else:
                result[key] = value
        
        return result
    
    def _apply_env_overrides(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Apply environment variable overrides."""
        # OpenAI
        if os.getenv("OPENAI_API_KEY"):
            config["ai_providers"]["openai"]["api_key"] = os.getenv("OPENAI_API_KEY")
        if os.getenv("OPENAI_MODEL"):
            config["ai_providers"]["openai"]["model"] = os.getenv("OPENAI_MODEL")
        
        # Azure OpenAI
        if os.getenv("AZURE_OPENAI_API_KEY"):
            config["ai_providers"]["azure_openai"]["api_key"] = os.getenv("AZURE_OPENAI_API_KEY")
        if os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"):
            config["ai_providers"]["azure_openai"]["deployment_name"] = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
        if os.getenv("AZURE_OPENAI_ENDPOINT"):
            config["ai_providers"]["azure_openai"]["endpoint"] = os.getenv("AZURE_OPENAI_ENDPOINT")
        
        # Google GenAI
        if os.getenv("GOOGLE_API_KEY"):
            config["ai_providers"]["google_genai"]["api_key"] = os.getenv("GOOGLE_API_KEY")
        
        # Anthropic
        if os.getenv("ANTHROPIC_API_KEY"):
            config["ai_providers"]["anthropic"]["api_key"] = os.getenv("ANTHROPIC_API_KEY")
        
        # GitHub
        if os.getenv("GITHUB_TOKEN"):
            config["github"]["token"] = os.getenv("GITHUB_TOKEN")
        
        return config
    
    def get(self, key_path: str, default: Any = None) -> Any:
        """Get a configuration value using dot notation (e.g., 'ai_providers.openai.api_key')."""
        keys = key_path.split('.')
        value = self.config
        
        try:
            for key in keys:
                value = value[key]
            return value
        except (KeyError, TypeError):
            return default
    
    def get_ai_provider_config(self, provider: str) -> Dict[str, Any]:
        """Get configuration for a specific AI provider."""
        return self.get(f"ai_providers.{provider}", {})
    
    def get_github_token(self) -> str:
        """Get GitHub token from configuration."""
        return self.get("github.token", "")
    
    def get_deepgit_ai_config(self) -> Dict[str, Any]:
        """Get DeepGitAI configuration."""
        return self.get("deepgit_ai", {})
    
    def get_server_config(self) -> Dict[str, Any]:
        """Get server configuration."""
        return self.get("server", {})
    
    def get_database_config(self) -> Dict[str, Any]:
        """Get database configuration."""
        return self.get("database", {})
    
    def update_config(self, updates: Dict[str, Any]) -> None:
        """Update configuration with new values."""
        self.config = self._merge_config(self.config, updates)
    
    def save_config(self) -> bool:
        """Save current configuration to file."""
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
    
    def create_example_config(self) -> bool:
        """Create an example configuration file."""
        example_path = self.config_path.parent / "config.example.json"
        try:
            with open(example_path, 'w', encoding='utf-8') as f:
                json.dump(self._get_default_config(), f, indent=2, ensure_ascii=False)
            print(f"Example configuration created at: {example_path}")
            return True
        except Exception as e:
            print(f"Error creating example config: {e}")
            return False
    
    def validate_config(self) -> Dict[str, Any]:
        """Validate configuration and return validation results."""
        validation = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "missing_keys": []
        }
        
        # Check required AI provider keys
        required_providers = ["openai", "azure_openai", "google_genai", "anthropic"]
        for provider in required_providers:
            api_key = self.get(f"ai_providers.{provider}.api_key")
            if not api_key:
                validation["missing_keys"].append(f"ai_providers.{provider}.api_key")
                validation["warnings"].append(f"No API key configured for {provider}")
        
        # Check GitHub token
        github_token = self.get_github_token()
        if not github_token:
            validation["missing_keys"].append("github.token")
            validation["warnings"].append("No GitHub token configured")
        
        # Check if at least one AI provider has an API key
        has_ai_provider = any(
            self.get(f"ai_providers.{provider}.api_key") 
            for provider in required_providers
        )
        
        if not has_ai_provider:
            validation["errors"].append("At least one AI provider API key must be configured")
            validation["valid"] = False
        
        return validation

# Global configuration instance
config_manager = ConfigManager()
