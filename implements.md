# SThread - Tài liệu Hướng dẫn Triển khai & Kiến trúc

## 1. Bối cảnh & Tầm nhìn Dự án
SThread là một hệ điều hành Quản lý Tri thức Cá nhân (PKM) kết hợp giữa Dòng thời gian Vô hạn (Infinite Timeline), Lưới Tri thức (Knowledge Graph), và hệ thống Lặp lại ngắt quãng (Spaced Repetition) dựa trên FSRS. Triết lý cốt lõi là lấy **Knowledge Node làm trung tâm**, không lấy Flashcard làm trung tâm. Mọi thao tác ôn tập đều phải được hiển thị trong ngữ cảnh lịch sử và cấu trúc liên kết mạng lưới của nó (Contextual Review - Ôn tập theo Ngữ cảnh).

## 2. Môi trường Phát triển & Tech Stack
Để đảm bảo hiệu năng cao nhất cho các phép toán vector và render đồ họa canvas, hệ thống yêu cầu sử dụng các công nghệ sau:

* **Môi trường:** WSL2 Ubuntu thông qua VS Code.
* **Backend Framework:** FastAPI (Python) để xử lý các API endpoint bất đồng bộ với hiệu năng cao.
* **Vector & Database Engine:** PostgreSQL kết hợp với `pgvector` hoặc Qdrant để lưu trữ các vector nhúng (embedding) của Node và thực thi tìm kiếm lai (Semantic + Keyword). Khuyên dùng mô hình BGE-M3 để tạo dense embeddings.
* **Frontend Framework:** React.js / Next.js.
* **Canvas & Visualization:** * *Chế độ Timeline:* PixiJS (WebGL) để xử lý render hàng ngàn node trên một canvas vô hạn, kết hợp kỹ thuật culling (chỉ render vùng trong tầm nhìn).
    * *Chế độ Graph:* React Flow hoặc D3.js để trực quan hóa mạng lưới đồ thị.

## 3. Lược đồ Cơ sở Dữ liệu Cốt lõi

### 3.1 `knowledge_nodes` (Các điểm kiến thức)
```sql
CREATE TABLE knowledge_nodes (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    embedding VECTOR(1024), -- Giả định dùng BGE-M3 hoặc tương đương
    space_id UUID
);
```

### 3.2 `edges` (Cấu trúc Lưới liên kết)

```sql
CREATE TABLE edges (
    id UUID PRIMARY KEY,
    source_id UUID REFERENCES knowledge_nodes(id),
    target_id UUID REFERENCES knowledge_nodes(id),
    relation_type VARCHAR(50) -- 'parent', 'child', 'prerequisite', 'related'
);
```

### 3.3 flashcards & fsrs_reviews (Thẻ nhớ và Lịch sử ôn tập)

```sql
CREATE TABLE flashcards (
    id UUID PRIMARY KEY,
    node_id UUID REFERENCES knowledge_nodes(id),
    front TEXT NOT NULL,
    back TEXT NOT NULL
);

CREATE TABLE fsrs_reviews (
    id UUID PRIMARY KEY,
    card_id UUID REFERENCES flashcards(id),
    review_date TIMESTAMP WITH TIME ZONE,
    rating INT, -- 1: Again, 2: Hard, 3: Good, 4: Easy
    state INT,
    stability FLOAT,
    difficulty FLOAT
);
```

## 4. Triển khai Các Thuật toán Trọng tâm
### 4.1 Semantic Zooming & Gom cụm (Timeline)
* Logic: Khi mức độ zoom của viewport (z) giảm xuống dưới một ngưỡng nhất định, frontend sẽ gửi yêu cầu lấy dữ liệu đã được gom cụm.

* Triển khai: Backend sử dụng thuật toán gom cụm không gian (spatial clustering) ở tầng DB hoặc nhóm các node theo space_id và các mốc thời gian (vd: Năm/Tháng) để trả về các "Bong bóng Không gian" thay vì từng node lẻ, giúp tối ưu hóa số lượng draw calls của WebGL.

### 4.2 Tích hợp FSRS theo Ngữ cảnh
* Logic: Triển khai thuật toán FSRS v4 chuẩn bằng Python trên backend FastAPI.

* Hiển thị Ngữ cảnh: Khi gọi endpoint /api/reviews/today, backend không chỉ trả về các flashcards tới hạn mà còn phải duyệt qua bảng edges (độ sâu 1 hoặc 2 bước nhảy) để trả về các knowledge_nodes lân cận. Frontend sẽ làm mờ toàn bộ canvas, chỉ highlight cụm đồ thị con này trong quá trình người dùng ôn tập.

### 4.3 Memory Replay (Cỗ máy Thời gian)
* Logic: Một thanh trượt (slider) trên frontend sẽ thiết lập trạng thái thời gian toàn cục T_current.

* Triển khai: * Canvas chỉ truy vấn và render các node có created_at <= T_current.

    * Màu sắc của Node (thể hiện mức độ ghi nhớ/sức khỏe trí nhớ) được tính toán động bằng cách chạy giả lập phương trình đường cong quên lãng của FSRS từ thời điểm review_date gần nhất cho đến T_current, bỏ qua hoàn toàn mọi lịch sử ôn tập diễn ra sau mốc T_current.

## 5. Các Giai đoạn Thực thi cho AI Agent
Phase 1: Nền tảng & APIs
* Khởi tạo dự án FastAPI và cấu hình kết nối tới PostgreSQL/Qdrant.

* Viết các model SQLAlchemy tương ứng với lược đồ cơ sở dữ liệu.

* Triển khai các endpoint CRUD cho Nodes, Spaces, và Edges.

Phase 2: Nạp Dữ liệu Kiến thức & AI
* Thiết lập pipeline nhúng (embedding pipeline). Khi một Node được tạo/cập nhật, tự động tạo vector nhúng và upsert vào vector database.

* Triển khai endpoint /api/search hỗ trợ Hybrid Search (Tìm kiếm Keyword kết hợp Cosine Similarity trên vectors).

Phase 3: Infinite Canvas (Frontend)
* Khởi tạo dự án React.

* Thiết lập viewport PixiJS với các chức năng pan, zoom, và ánh xạ tọa độ (Trục X = Thời gian, Trục Y = Không gian/Chủ đề).

* Triển khai kỹ thuật viewport culling: chỉ fetch và render các node nằm trong vùng khung hình camera đang hiển thị.

Phase 4: FSRS & Luồng Ôn tập
* Viết logic tính toán của thuật toán FSRS dưới backend.

* Xây dựng giao diện Contextual Review nổi trên nền canvas PixiJS.

* Kết nối thao tác nộp kết quả ôn tập (Again/Hard/Good/Easy) để cập nhật bảng fsrs_reviews và tính toán lại các chỉ số stability/difficulty.

Phase 5: Memory Replay
* Bổ sung component Thanh trượt Thời gian (Time Slider).

* Binding trạng thái của slider vào các tham số fetch của API để tự động vẽ lại Dòng thời gian và tính toán mô phỏng trạng thái trí nhớ một cách linh hoạt.