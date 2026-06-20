import json
import os
import shutil
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import engine, Base, get_db
from backend.models import Space, KnowledgeNode, Edge, Flashcard, FSRSReview
from backend.fsrs import FSRS
from backend.schedulers import SM2, Leitner, format_interval
from backend.embedding import get_embedding, cosine_similarity

# Check and auto-reset database if it exists but lacks the scheduler column in flashcards table
db_file = "./sthreads.db"
if os.path.exists(db_file):
    import sqlite3
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(flashcards)")
        cols = [c[1] for c in cursor.fetchall()]
        if cols and "scheduler" not in cols:
            conn.close()
            os.remove(db_file)
            print("Database schema outdated. Deleted sthreads.db for recreation.")
        else:
            conn.close()
    except Exception as e:
        print("Error checking database schema:", e)

# Initialize Database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SThreads API", version="1.0.0")

# Setup uploads directory and mount static files
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"], # Allow frontend dev origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fsrs = FSRS()

# Pydantic Schemas for Request/Response (FastAPI 0.98 style / Pydantic v1)
class SpaceCreate(BaseModel):
    title: str
    color: Optional[str] = None
    description: Optional[str] = None
    progress: Optional[int] = 0
    image_url: Optional[str] = None

class SpaceOut(BaseModel):
    id: str
    title: str
    color: Optional[str] = None
    description: Optional[str] = None
    progress: Optional[int] = 0
    image_url: Optional[str] = None
    class Config:
        orm_mode = True

class NodeCreate(BaseModel):
    title: str
    content: Optional[str] = None
    space_id: Optional[str] = None
    created_at: Optional[datetime] = None

class NodeOut(BaseModel):
    id: str
    title: str
    content: Optional[str] = None
    created_at: datetime
    space_id: Optional[str] = None
    class Config:
        orm_mode = True

class EdgeCreate(BaseModel):
    source_id: str
    target_id: str
    relation_type: Optional[str] = "related"

class EdgeOut(BaseModel):
    id: str
    source_id: str
    target_id: str
    relation_type: str
    class Config:
        orm_mode = True

class FlashcardCreate(BaseModel):
    node_id: str
    front: str
    back: str
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    synonyms: Optional[str] = None
    scheduler: Optional[str] = "fsrs"

class FlashcardOut(BaseModel):
    id: str
    node_id: str
    front: str
    back: str
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    synonyms: Optional[str] = None
    scheduler: str
    class Config:
        orm_mode = True

class ReviewSubmit(BaseModel):
    rating: int # 1: Again, 2: Hard, 3: Good, 4: Easy

class SimulationRequest(BaseModel):
    reviews: List[str]

# --- API ENDPOINTS ---

@app.get("/api/spaces", response_model=List[SpaceOut])
def get_spaces(db: Session = Depends(get_db)):
    return db.query(Space).all()

@app.post("/api/spaces", response_model=SpaceOut)
def create_space(space: SpaceCreate, db: Session = Depends(get_db)):
    db_space = Space(
        title=space.title,
        color=space.color,
        description=space.description,
        progress=space.progress,
        image_url=space.image_url
    )
    db.add(db_space)
    db.commit()
    db.refresh(db_space)
    return db_space

@app.get("/api/nodes", response_model=List[NodeOut])
def get_nodes(db: Session = Depends(get_db), before_date: Optional[datetime] = None):
    query = db.query(KnowledgeNode)
    if before_date:
        query = query.filter(KnowledgeNode.created_at <= before_date)
    return query.all()

@app.post("/api/nodes", response_model=NodeOut)
def create_node(node: NodeCreate, db: Session = Depends(get_db)):
    embedding_json = get_embedding(f"{node.title} {node.content or ''}")
    db_node = KnowledgeNode(
        title=node.title,
        content=node.content,
        space_id=node.space_id,
        created_at=node.created_at or datetime.utcnow(),
        embedding=embedding_json
    )
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node

@app.put("/api/nodes/{node_id}", response_model=NodeOut)
def update_node(node_id: str, node: NodeCreate, db: Session = Depends(get_db)):
    db_node = db.query(KnowledgeNode).filter(KnowledgeNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    db_node.title = node.title
    db_node.content = node.content
    db_node.space_id = node.space_id
    if node.created_at:
        db_node.created_at = node.created_at
        
    db_node.embedding = get_embedding(f"{node.title} {node.content or ''}")
    db.commit()
    db.refresh(db_node)
    return db_node

@app.delete("/api/nodes/{node_id}")
def delete_node(node_id: str, db: Session = Depends(get_db)):
    db_node = db.query(KnowledgeNode).filter(KnowledgeNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")
    db.delete(db_node)
    db.commit()
    return {"status": "success", "message": "Node deleted"}

@app.get("/api/edges", response_model=List[EdgeOut])
def get_edges(db: Session = Depends(get_db)):
    return db.query(Edge).all()

@app.post("/api/edges", response_model=EdgeOut)
def create_edge(edge: EdgeCreate, db: Session = Depends(get_db)):
    # Check if target and source exist
    src = db.query(KnowledgeNode).filter(KnowledgeNode.id == edge.source_id).first()
    tgt = db.query(KnowledgeNode).filter(KnowledgeNode.id == edge.target_id).first()
    if not src or not tgt:
        raise HTTPException(status_code=404, detail="Source or Target node not found")
        
    db_edge = Edge(source_id=edge.source_id, target_id=edge.target_id, relation_type=edge.relation_type)
    db.add(db_edge)
    db.commit()
    db.refresh(db_edge)
    return db_edge

@app.delete("/api/edges/{edge_id}")
def delete_edge(edge_id: str, db: Session = Depends(get_db)):
    db_edge = db.query(Edge).filter(Edge.id == edge_id).first()
    if not db_edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    db.delete(db_edge)
    db.commit()
    return {"status": "success", "message": "Edge deleted"}

@app.get("/api/flashcards", response_model=List[FlashcardOut])
def get_flashcards(db: Session = Depends(get_db)):
    return db.query(Flashcard).all()

@app.post("/api/upload")
def upload_file(file: UploadFile = File(...)):
    filename = file.filename
    import re
    filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/uploads/{filename}"}

@app.post("/api/flashcards", response_model=FlashcardOut)
def create_flashcard(card: FlashcardCreate, db: Session = Depends(get_db)):
    db_card = Flashcard(
        node_id=card.node_id,
        front=card.front,
        back=card.back,
        image_url=card.image_url,
        audio_url=card.audio_url,
        synonyms=card.synonyms,
        scheduler=card.scheduler or "fsrs"
    )
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    return db_card


# --- COMPLEX LOGIC ENDPOINTS ---

@app.get("/api/search")
def search_nodes(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """
    Hybrid Search: Exact substring Match score + Cosine similarity score
    """
    nodes = db.query(KnowledgeNode).all()
    if not nodes:
        return []
        
    query_emb = get_embedding(q)
    results = []
    
    for n in nodes:
        # Cosine similarity score
        cos_score = cosine_similarity(query_emb, n.embedding) if n.embedding else 0.0
        
        # Substring keyword matching score
        keyword_score = 0.0
        text_content = f"{n.title} {n.content or ''}".lower()
        q_clean = q.lower()
        if q_clean in text_content:
            keyword_score = 1.0
            # Higher score if matches title specifically
            if q_clean in n.title.lower():
                keyword_score = 1.5
                
        # Hybrid score weights
        score = 0.4 * cos_score + 0.6 * keyword_score
        
        if score > 0.05: # Minimum threshold
            results.append({
                "id": n.id,
                "title": n.title,
                "content": n.content,
                "space_id": n.space_id,
                "created_at": n.created_at,
                "score": score
            })
            
    # Sort by descending score
    results.sort(key=lambda x: x["score"], reverse=True)
    return results

@app.get("/api/reviews/today")
def get_due_reviews(db: Session = Depends(get_db)):
    """
    Get all reviews scheduled for today, including the context graph (1-2 hops).
    """
    all_cards = db.query(Flashcard).all()
    due_cards = []
    now = datetime.utcnow()
    
    for card in all_cards:
        # Fetch last review
        last_review = db.query(FSRSReview).filter(FSRSReview.card_id == card.id).order_by(FSRSReview.review_date.desc()).first()
        
        is_due = False
        stability = 0.0
        difficulty = 0.0
        
        sch = card.scheduler or "fsrs"
        
        if not last_review:
            is_due = True
        else:
            stability = last_review.stability
            difficulty = last_review.difficulty
            
            if sch == "fsrs":
                interval_days = fsrs.calculate_interval(stability)
            elif sch == "sm2":
                interval_days = last_review.state or 1
            elif sch == "leitner":
                box = last_review.state or 1
                interval_days = Leitner.BOX_INTERVALS.get(box, 1)
            else:
                interval_days = 1
                
            due_date = last_review.review_date + timedelta(days=interval_days)
            if due_date <= now:
                is_due = True
                
        if is_due:
            # Predict intervals for this card
            intervals = {}
            if sch == "fsrs":
                if not last_review:
                    for r in [1, 2, 3, 4]:
                        s_pred, d_pred, state_pred = fsrs.init_card_rating(r)
                        intervals[r] = format_interval(fsrs.calculate_interval(s_pred))
                else:
                    elapsed_days = max(0.1, (now - last_review.review_date).total_seconds() / (24 * 3600))
                    for r in [1, 2, 3, 4]:
                        s_pred, d_pred, state_pred = fsrs.update_card(
                            rating=r,
                            elapsed_days=elapsed_days,
                            s=last_review.stability,
                            d=last_review.difficulty,
                            state=last_review.state
                        )
                        intervals[r] = format_interval(fsrs.calculate_interval(s_pred))
            elif sch == "sm2":
                if not last_review:
                    for r in [1, 2, 3, 4]:
                        days_pred, ease_pred, reps_pred = SM2.init_card_rating(r)
                        intervals[r] = format_interval(days_pred)
                else:
                    prev_interval = last_review.state or 1
                    prev_ease = last_review.stability or 2.5
                    prev_reps = int(last_review.difficulty or 0)
                    for r in [1, 2, 3, 4]:
                        days_pred, ease_pred, reps_pred = SM2.update_card(r, prev_interval, prev_ease, prev_reps)
                        intervals[r] = format_interval(days_pred)
            elif sch == "leitner":
                if not last_review:
                    for r in [1, 2, 3, 4]:
                        days_pred, box_pred = Leitner.init_card_rating(r)
                        intervals[r] = format_interval(days_pred)
                else:
                    prev_box = last_review.state or 1
                    for r in [1, 2, 3, 4]:
                        days_pred, box_pred = Leitner.update_card(r, prev_box)
                        intervals[r] = format_interval(days_pred)
            else:
                intervals = {1: "1d", 2: "1d", 3: "1d", 4: "1d"}
                
            due_cards.append({
                "id": card.id,
                "node_id": card.node_id,
                "front": card.front,
                "back": card.back,
                "node_title": card.node.title,
                "stability": stability,
                "difficulty": difficulty,
                "image_url": card.image_url,
                "audio_url": card.audio_url,
                "synonyms": card.synonyms,
                "scheduler": sch,
                "predicted_intervals": intervals
            })
            
    # Compile a list of node IDs involved in due cards
    focus_node_ids = {c["node_id"] for c in due_cards}
    
    # Traverse graph (BFS, 2 hops) to find local network context
    subgraph_nodes = set(focus_node_ids)
    subgraph_edges = set()
    
    all_edges = db.query(Edge).all()
    
    # Hop 1
    hop1_nodes = set()
    for e in all_edges:
        if e.source_id in focus_node_ids or e.target_id in focus_node_ids:
            subgraph_edges.add(e)
            hop1_nodes.add(e.source_id)
            hop1_nodes.add(e.target_id)
            
    subgraph_nodes.update(hop1_nodes)
    
    # Hop 2
    hop2_nodes = set()
    for e in all_edges:
        if e.source_id in hop1_nodes or e.target_id in hop1_nodes:
            subgraph_edges.add(e)
            hop2_nodes.add(e.source_id)
            hop2_nodes.add(e.target_id)
            
    subgraph_nodes.update(hop2_nodes)
    
    # Fetch actual Node details and Edge details
    nodes_details = db.query(KnowledgeNode).filter(KnowledgeNode.id.in_(list(subgraph_nodes))).all()
    edges_details = list(subgraph_edges)
    
    return {
        "due_cards": due_cards,
        "subgraph": {
            "nodes": [
                {
                    "id": n.id,
                    "title": n.title,
                    "content": n.content,
                    "space_id": n.space_id,
                    "created_at": n.created_at
                } for n in nodes_details
            ],
            "edges": [
                {
                    "id": e.id,
                    "source_id": e.source_id,
                    "target_id": e.target_id,
                    "relation_type": e.relation_type
                } for e in edges_details
            ]
        }
    }

@app.post("/api/reviews/{card_id}/submit")
def submit_review(card_id: str, payload: ReviewSubmit, db: Session = Depends(get_db)):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
        
    rating = payload.rating
    now = datetime.utcnow()
    sch = card.scheduler or "fsrs"
    
    # Fetch last review to get current state, stability, difficulty
    last_review = db.query(FSRSReview).filter(FSRSReview.card_id == card_id).order_by(FSRSReview.review_date.desc()).first()
    
    if sch == "fsrs":
        if not last_review:
            s, d, state = fsrs.init_card_rating(rating)
        else:
            elapsed_time_delta = now - last_review.review_date
            elapsed_days = max(0.1, elapsed_time_delta.total_seconds() / (24 * 3600))
            s, d, state = fsrs.update_card(
                rating=rating,
                elapsed_days=elapsed_days,
                s=last_review.stability,
                d=last_review.difficulty,
                state=last_review.state
            )
        next_interval = fsrs.calculate_interval(s)
    elif sch == "sm2":
        if not last_review:
            next_interval, ease, reps = SM2.init_card_rating(rating)
        else:
            prev_interval = last_review.state or 1
            prev_ease = last_review.stability or 2.5
            prev_reps = int(last_review.difficulty or 0)
            next_interval, ease, reps = SM2.update_card(rating, prev_interval, prev_ease, prev_reps)
        s = ease
        d = float(reps)
        state = next_interval
    elif sch == "leitner":
        if not last_review:
            next_interval, box = Leitner.init_card_rating(rating)
        else:
            prev_box = last_review.state or 1
            next_interval, box = Leitner.update_card(rating, prev_box)
        s = 0.0
        d = float(box)
        state = box
    else:
        raise HTTPException(status_code=400, detail="Invalid scheduler type")
        
    db_review = FSRSReview(
        card_id=card_id,
        review_date=now,
        rating=rating,
        state=state,
        stability=s,
        difficulty=d,
        scheduler=sch
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    
    return {
        "status": "success",
        "new_stability": s,
        "new_difficulty": d,
        "next_interval_days": next_interval,
        "next_review_date": now + timedelta(days=next_interval)
    }

@app.post("/api/simulate")
def simulate_schedulers(payload: SimulationRequest):
    reviews = payload.reviews
    if not reviews:
        return []
        
    rating_map = {"Again": 1, "Hard": 2, "Good": 3, "Easy": 4}
    
    fsrs_history = []
    sm2_history = []
    leitner_history = []
    
    # FSRS state
    f_s, f_d, f_state = 0.0, 0.0, 0
    f_int = 0
    
    # SM-2 state
    s_int, s_ease, s_reps = 0, 2.5, 0
    
    # Leitner state
    l_int, l_box = 0, 1
    
    for i, r_str in enumerate(reviews):
        rating = rating_map.get(r_str, 3)
        
        # 1. FSRS Step
        if i == 0:
            f_s, f_d, f_state = fsrs.init_card_rating(rating)
        else:
            # assume elapsed days = previous interval
            f_s, f_d, f_state = fsrs.update_card(rating, float(f_int), f_s, f_d, f_state)
        f_int = fsrs.calculate_interval(f_s)
        fsrs_history.append({"review": r_str, "interval": f_int, "stability": f_s, "difficulty": f_d})
        
        # 2. SM-2 Step
        if i == 0:
            s_int, s_ease, s_reps = SM2.init_card_rating(rating)
        else:
            s_int, s_ease, s_reps = SM2.update_card(rating, s_int, s_ease, s_reps)
        sm2_history.append({"review": r_str, "interval": s_int, "ease_factor": s_ease, "repetitions": s_reps})
        
        # 3. Leitner Step
        if i == 0:
            l_int, l_box = Leitner.init_card_rating(rating)
        else:
            l_int, l_box = Leitner.update_card(rating, l_box)
        leitner_history.append({"review": r_str, "interval": l_int, "box": l_box})
        
    steps = []
    for i in range(len(reviews)):
        steps.append({
            "step": i + 1,
            "review": reviews[i],
            "fsrs": fsrs_history[i],
            "sm2": sm2_history[i],
            "leitner": leitner_history[i]
        })
        
    return steps

@app.get("/api/memory-health")
def get_memory_health(t_current: datetime = Query(...), db: Session = Depends(get_db)):
    """
    Get FSRS memory health (retrievability) for all nodes created_at <= t_current
    """
    if t_current.tzinfo is not None:
        t_current = t_current.replace(tzinfo=None)
        
    nodes = db.query(KnowledgeNode).filter(KnowledgeNode.created_at <= t_current).all()
    results = []
    
    for node in nodes:
        # Find flashcards for this node
        cards = db.query(Flashcard).filter(Flashcard.node_id == node.id).all()
        
        # If no cards, retrievability is 1.0 (or default null color)
        if not cards:
            results.append({
                "node_id": node.id,
                "retrievability": None
            })
            continue
            
        # Calculate average retrievability for cards of this node
        retrievabilities = []
        for card in cards:
            # Get reviews that happened strictly BEFORE t_current
            review = db.query(FSRSReview).filter(
                FSRSReview.card_id == card.id,
                FSRSReview.review_date <= t_current
            ).order_by(FSRSReview.review_date.desc()).first()
            
            if not review:
                # No reviews prior to t_current
                retrievabilities.append(1.0)
            else:
                sch = review.scheduler or card.scheduler or "fsrs"
                if sch == "fsrs":
                    s_health = review.stability
                elif sch == "sm2":
                    s_health = float(review.state or 1.0)
                elif sch == "leitner":
                    box = review.state or 1
                    s_health = float(Leitner.BOX_INTERVALS.get(box, 1))
                else:
                    s_health = 1.0
                
                if s_health <= 0:
                    s_health = 1.0
                    
                r = fsrs.calculate_retrievability(review.review_date, t_current, s_health)
                retrievabilities.append(r)
                
        avg_r = sum(retrievabilities) / len(retrievabilities) if retrievabilities else 1.0
        results.append({
            "node_id": node.id,
            "retrievability": avg_r
        })
        
    return results

@app.post("/api/seed")
def seed_data(db: Session = Depends(get_db)):
    """
    Seed initial data to create a gorgeous visualization from day 1!
    """
    # Clean tables
    db.query(FSRSReview).delete()
    db.query(Flashcard).delete()
    db.query(Edge).delete()
    db.query(KnowledgeNode).delete()
    db.query(Space).delete()
    db.commit()
    
    # 1. Create Spaces
    space_a = Space(
        title="Topic A", 
        color="210, 100%, 50%", 
        description="Card này bao gồm các chủ đề về lịch sử Jedi và nền văn minh Cộng hòa cổ đại.",
        progress=40,
        image_url=None
    )
    space_b = Space(
        title="Topic B", 
        color="200, 100%, 45%", 
        description="Hồ sơ lưu trữ về sự trỗi dậy của Đế chế Galactic và hạm đội quân sự.",
        progress=55,
        image_url=None
    )
    space_c = Space(
        title="Topic C", 
        color="195, 100%, 40%", 
        description="Card này bao gồm những chủ đề xoay quanh về việc nội trợ giặt đồ. Bạn đã hoàn thành được 70%, hãy tiếp tục nhé.",
        progress=70,
        image_url="/laundry.png"
    )
    
    db.add_all([space_a, space_b, space_c])
    db.commit()
    db.refresh(space_a)
    db.refresh(space_b)
    db.refresh(space_c)
    
    # Anchor dates around 2026-10-20 to 2026-10-25
    base_date = datetime(2026, 10, 20, 12, 0, 0)
    
    # 2. Create Knowledge Nodes
    nodes_data = [
        # 20 OCT
        {"title": "First Battle of Geonosis", "content": "The battle that started the Clone Wars. Obi-Wan, Anakin, and Padmé are rescued by the newly formed clone army.", "space": space_a, "offset": 0},
        {"title": "Escape from Kamino", "content": "Jango Fett escapes Kamino after a brief duel with Obi-Wan Kenobi in the heavy rain.", "space": space_a, "offset": 0},
        {"title": "Clone Wars Begin", "content": "The galaxy-wide conflict starts, pitting the Galactic Republic against the Confederacy of Independent Systems.", "space": space_a, "offset": 0.1},
        
        # 21 OCT
        {"title": "Siege of Mandalore", "content": "A crucial battle in the final days of the Clone Wars, where Ahsoka Tano and Captain Rex capture Maul.", "space": space_a, "offset": 1.0},
        {"title": "Battle of Coruscant", "content": "The Separatists raid the capital and capture Chancellor Palpatine. Anakin Skywalker defeats Count Dooku.", "space": space_c, "offset": 1.1},
        
        # 22 OCT
        {"title": "Duel on Mustafar", "content": "Anakin Skywalker and Obi-Wan Kenobi duel on the lava world of Mustafar. Anakin is critically burned and transformed.", "space": space_a, "offset": 2.0},
        {"title": "Rise of the Galactic Empire", "content": "Palpatine declares himself Emperor, reorganizing the Republic into the Galactic Empire.", "space": space_b, "offset": 2.1},
        
        # 23 OCT
        {"title": "Attack on Lothal", "content": "The Spectres rebel group launches a daring attack on the Imperial factories on Lothal.", "space": space_a, "offset": 3.0},
        {"title": "Galactic Civil War Begins", "content": "The formal rebellion starts rising against Imperial tyranny.", "space": space_b, "offset": 3.1},
        
        # 24 OCT
        {"title": "Battle of Yavin", "content": "Luke Skywalker destroys the Death Star with a proton torpedo, yielding a major victory for the Rebel Alliance.", "space": space_c, "offset": 4.0},
        {"title": "Duel on Cloud City", "content": "Darth Vader reveals his identity as Luke's father during their lightsaber duel in the carbon freezing chamber.", "space": space_a, "offset": 4.1},
        
        # 25 OCT
        {"title": "Battle of Hoth", "content": "The Empire discovers and raids the Echo Base on Hoth, forcing rebels to disperse.", "space": space_c, "offset": 5.0},
        {"title": "Rescue of Han Solo", "content": "Luke and friends rescue Han Solo from Jabba the Hutt's palace on Tatooine.", "space": space_a, "offset": 5.1},
        {"title": "Battle of Endor", "content": "The second Death Star is destroyed, Darth Vader is redeemed, and the Emperor is defeated.", "space": space_c, "offset": 5.2}
    ]
    
    nodes_instances = []
    for n in nodes_data:
        node_date = base_date + timedelta(days=n["offset"])
        embedding_json = get_embedding(f"{n['title']} {n['content']}")
        db_node = KnowledgeNode(
            title=n["title"],
            content=n["content"],
            space_id=n["space"].id,
            created_at=node_date,
            embedding=embedding_json
        )
        db.add(db_node)
        nodes_instances.append((n["title"], db_node))
        
    db.commit()
    
    # Map node titles to objects for edge creation
    nodes_map = {name: node for name, node in nodes_instances}
    
    # 3. Create Edges
    edges_data = [
        ("First Battle of Geonosis", "Clone Wars Begin", "prerequisite"),
        ("Escape from Kamino", "First Battle of Geonosis", "related"),
        ("Clone Wars Begin", "Siege of Mandalore", "parent"),
        ("Clone Wars Begin", "Battle of Coruscant", "parent"),
        ("Battle of Coruscant", "Duel on Mustafar", "prerequisite"),
        ("Duel on Mustafar", "Rise of the Galactic Empire", "related"),
        ("Rise of the Galactic Empire", "Galactic Civil War Begins", "parent"),
        ("Attack on Lothal", "Galactic Civil War Begins", "related"),
        ("Galactic Civil War Begins", "Battle of Yavin", "parent"),
        ("Battle of Yavin", "Duel on Cloud City", "prerequisite"),
        ("Duel on Cloud City", "Battle of Hoth", "related"),
        ("Battle of Hoth", "Rescue of Han Solo", "prerequisite"),
        ("Rescue of Han Solo", "Battle of Endor", "prerequisite")
    ]
    
    for src_title, tgt_title, rel in edges_data:
        if src_title in nodes_map and tgt_title in nodes_map:
            db_edge = Edge(
                source_id=nodes_map[src_title].id,
                target_id=nodes_map[tgt_title].id,
                relation_type=rel
            )
            db.add(db_edge)
            
    # 4. Create Flashcards & FSRS Review History
    # Let's add flashcards for:
    # 1. Battle of Coruscant
    card1 = Flashcard(
        node_id=nodes_map["Battle of Coruscant"].id,
        front="Who defeated Count Dooku during the Battle of Coruscant?",
        back="Anakin Skywalker, at the urging of Chancellor Palpatine.",
        synonyms="Count Dooku, Anakin Skywalker",
        image_url="/uploads/spaceship.png",
        scheduler="fsrs"
    )
    # 2. Battle of Yavin
    card2 = Flashcard(
        node_id=nodes_map["Battle of Yavin"].id,
        front="What was the critical vulnerability of the Death Star used during the Battle of Yavin?",
        back="A small, unshielded thermal exhaust port leading directly to the main reactor.",
        synonyms="thermal exhaust port, Death Star",
        scheduler="sm2"
    )
    # 3. Siege of Mandalore
    card3 = Flashcard(
        node_id=nodes_map["Siege of Mandalore"].id,
        front="Who led the Siege of Mandalore for the Republic?",
        back="Ahsoka Tano and Commander Rex.",
        synonyms="Ahsoka Tano, Commander Rex",
        scheduler="leitner"
    )
    
    db.add_all([card1, card2, card3])
    db.commit()
    db.refresh(card1)
    db.refresh(card2)
    db.refresh(card3)
    
    # Add review history so they have different FSRS stability/difficulty
    # Let's make Card 1 (Coruscant) have excellent stability (e.g. reviewed successfully)
    # Let's make Card 2 (Yavin) have bad stability (reviewed with Again recently)
    # Card 3 (Mandalore) is a new card (no review history)
    
    # Card 1 (Good memory health): Reviewed 2 days ago with rating 3 (Good)
    review_date_1 = base_date + timedelta(days=1) # 21 Oct 2026
    r1_s, r1_d, r1_state = fsrs.init_card_rating(3) # Initial good review
    db_rev1 = FSRSReview(
        card_id=card1.id,
        review_date=review_date_1,
        rating=3,
        state=r1_state,
        stability=r1_s,
        difficulty=r1_d,
        scheduler="fsrs"
    )
    db.add(db_rev1)
    
    # Card 2 (Bad memory health): Reviewed 3 days ago, and then failed (Again) 1 day ago
    # Using SM-2 algorithm:
    review_date_2a = base_date + timedelta(days=1)
    r2_int, r2_ease, r2_reps = SM2.init_card_rating(3)
    db_rev2a = FSRSReview(
        card_id=card2.id,
        review_date=review_date_2a,
        rating=3,
        state=r2_int,
        stability=r2_ease,
        difficulty=float(r2_reps),
        scheduler="sm2"
    )
    db.add(db_rev2a)
    db.commit()
    
    # Now review again with rating 1 (Again) 1 day later (22 Oct)
    review_date_2b = base_date + timedelta(days=2)
    r2_int_new, r2_ease_new, r2_reps_new = SM2.update_card(
        rating=1, # Again
        prev_interval=r2_int,
        prev_ease=r2_ease,
        prev_reps=r2_reps
    )
    db_rev2b = FSRSReview(
        card_id=card2.id,
        review_date=review_date_2b,
        rating=1,
        state=r2_int_new,
        stability=r2_ease_new,
        difficulty=float(r2_reps_new),
        scheduler="sm2"
    )
    db.add(db_rev2b)
    db.commit()
    
    return {"status": "success", "message": "Database seeded successfully with timeline nodes, cards, and review histories."}
