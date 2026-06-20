import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Space(Base):
    __tablename__ = "spaces"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    color = Column(String(50), nullable=True) # HSL/Hex color for rendering
    description = Column(Text, nullable=True)
    progress = Column(Integer, default=0)
    image_url = Column(String(255), nullable=True)
    
    nodes = relationship("KnowledgeNode", back_populates="space", cascade="all, delete-orphan")

class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    embedding = Column(Text, nullable=True) # Stored as JSON-serialized list of floats for SQLite compatibility
    space_id = Column(String(36), ForeignKey("spaces.id", ondelete="SET NULL"), nullable=True)
    
    space = relationship("Space", back_populates="nodes")
    flashcards = relationship("Flashcard", back_populates="node", cascade="all, delete-orphan")

class Edge(Base):
    __tablename__ = "edges"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(String(36), ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String(50), default="related") # 'parent', 'child', 'prerequisite', 'related'

class Flashcard(Base):
    __tablename__ = "flashcards"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    node_id = Column(String(36), ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    image_url = Column(String(255), nullable=True)
    audio_url = Column(String(255), nullable=True)
    synonyms = Column(Text, nullable=True)
    scheduler = Column(String(50), default="fsrs") # 'fsrs', 'sm2', 'leitner'
    
    node = relationship("KnowledgeNode", back_populates="flashcards")
    reviews = relationship("FSRSReview", back_populates="card", cascade="all, delete-orphan")

class FSRSReview(Base):
    __tablename__ = "fsrs_reviews"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    card_id = Column(String(36), ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False)
    review_date = Column(DateTime, default=datetime.utcnow)
    rating = Column(Integer, nullable=False) # 1: Again, 2: Hard, 3: Good, 4: Easy
    state = Column(Integer, nullable=False) # 0: New, 1: Learning, 2: Review, 3: Relearning
    stability = Column(Float, nullable=False)
    difficulty = Column(Float, nullable=False)
    scheduler = Column(String(50), default="fsrs") # scheduler used for this review
    
    card = relationship("Flashcard", back_populates="reviews")
