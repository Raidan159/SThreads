import re
import hashlib
import json
import math

def get_embedding(text: str, dimension: int = 1024) -> str:
    """
    Generates a 1024-dimensional dense vector representing the text using the hashing trick.
    Returns a JSON string representation of the float list for easy storage in SQLite.
    """
    if not text:
        vector = [0.0] * dimension
        return json.dumps(vector)
        
    # Standardize and clean text
    text = text.lower()
    words = re.findall(r'\b\w+\b', text)
    
    # Feature hashing (hashing trick)
    vector = [0.0] * dimension
    for word in words:
        # We can hash each word and map it to [0, dimension - 1]
        h = hashlib.sha256(word.encode('utf-8')).hexdigest()
        idx = int(h, 16) % dimension
        # Use simple term frequency weight
        vector[idx] += 1.0
        
    # L2 Normalization (so cosine similarity is just the dot product)
    magnitude = math.sqrt(sum(v * v for v in vector))
    if magnitude > 0:
        vector = [v / magnitude for v in vector]
        
    return json.dumps(vector)

def cosine_similarity(v1_str: str, v2_str: str) -> float:
    """
    Computes cosine similarity between two JSON-serialized vector strings.
    """
    try:
        vec1 = json.loads(v1_str)
        vec2 = json.loads(v2_str)
        
        # Dot product
        dot = sum(a * b for a, b in zip(vec1, vec2))
        return float(dot)
    except Exception:
        return 0.0
