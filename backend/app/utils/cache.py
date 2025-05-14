from pathlib import Path
import json

def get_cached_topics(search_term):
    cache_file = Path('../public/data/cached_topics') / f"{search_term}.json"
    if cache_file.exists():
        with open(cache_file, 'r') as f:
            return json.load(f)
    return None

def save_cached_topics(search_term, topics_data):
    cache_dir = Path('../public/data/cached_topics')
    cache_dir.mkdir(exist_ok=True)
    cache_file = cache_dir / f"{search_term}.json"
    with open(cache_file, 'w') as f:
        json.dump(topics_data, f) 