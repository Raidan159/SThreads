---
name: SThreads
description: Spaced Repetition PKM combining Canvas Timeline, Knowledge Graph, and Flashcards
colors:
  primary: "#2563eb"
  secondary: "#ea580c"
  lime-highlight: "#a3e635"
  neutral-bg: "#faf9f5"
  neutral-bg-secondary: "#f3efe0"
  neutral-bg-card: "rgba(255, 255, 255, 0.85)"
  neutral-text: "#2c2a29"
  neutral-text-secondary: "#6b6664"
  border: "rgba(44, 42, 41, 0.1)"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "#1d4ed8"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card-container:
    backgroundColor: "{colors.neutral-bg-card}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: SThreads

## 1. Overview

**Creative North Star: "Dòng thời gian tri thức (The Knowledge Thread)"**

Hệ thống thiết kế SThreads kết hợp sự tối giản gọn gàng của Notion và tính tương tác của timeline trực quan. Giao diện được thiết kế để truyền cảm hứng tự học thông qua một dòng thời gian liên tục với các nút kiến thức nổi khối. Sự tương phản sắc nét, bố cục thông thoáng và các highlight tinh tế bằng tông màu Vàng chanh (Lime) giúp người dùng tập trung tối đa vào kiến thức cần ghi nhớ mà không bị phân tâm bởi các thành phần dư thừa.

**Key Characteristics:**
- **Sắc nét và Tối giản**: Tận dụng tối đa khoảng trống, lưới gọn gàng, và triệt tiêu các đường viền hay khối màu không cần thiết.
- **Nổi khối trực quan**: Các thẻ nội dung và các nút timeline có chiều sâu rõ rệt để thu hút sự tương tác.
- **Micro-motion mượt mà**: Chuyển động và phóng thu của canvas timeline tự nhiên, đem lại cảm giác sinh động khi học tập.

## 2. Colors

Bảng màu sử dụng sự tương phản mạnh mẽ của chữ tối trên nền sáng dịu mắt, kết hợp màu xanh dương làm chủ đạo và chấm phá highlight bằng màu vàng chanh.

### Primary
- **Ocean Blue** (`{colors.primary}`): Sử dụng cho các hành động chính, nút kêu gọi và trạng thái active/chọn của các node kiến thức.

### Secondary
- **Sunset Orange** (`{colors.secondary}`): Được dùng để biểu thị các phần Spaced Repetition khẩn cấp, nhắc nhở hoặc các node phụ có tính chất tương phản.
- **Lime Highlight** (`{colors.lime-highlight}`): Tông màu vàng chanh dùng rất hạn chế để highlight văn bản quan trọng trong thẻ từ vựng hoặc các từ khóa cốt lõi cần nhớ.

### Neutral
- **Warm Sand Background** (`{colors.neutral-bg}`): Màu nền dịu mắt tạo cảm giác ấm áp và đỡ mỏi mắt khi học lâu.
- **Pale Clay** (`{colors.neutral-bg-secondary}`): Màu nền cho các thanh điều hướng cố định (như Sidebar).
- **Ink Primary** (`{colors.neutral-text}`): Màu chữ chính độ tương phản cao gần như đen.
- **Clay Secondary** (`{colors.neutral-text-secondary}`): Dành cho nhãn phụ và văn bản bổ trợ.

### Named Rules
**The 5% Highlight Rule.** Màu vàng chanh highlight (`{colors.lime-highlight}`) chỉ được xuất hiện trên tối đa 5% diện tích bất kỳ màn hình nào. Nó là điểm nhấn tập trung, không phải màu trang trí nền.

## 3. Typography

**Display Font:** Outfit (fallback: sans-serif)
**Body Font:** Inter (fallback: sans-serif)

**Character:** Sự kết hợp giữa nét hình học vững chãi, hiện đại của Outfit ở tiêu đề và sự dễ đọc, trung tính của Inter ở nội dung chính.

### Hierarchy
- **Display** (700, `{typography.display.fontSize}`, 1.2): Sử dụng cho các tiêu đề lớn của Không gian (Spaces) hoặc tiêu đề chính trên Timeline.
- **Headline** (700, 20px, 1.3): Tiêu đề thẻ flashcard hoặc tiêu đề các phần chính trong Sidebar.
- **Title** (600, 16px, 1.4): Tiêu đề danh sách node hoặc tên nhóm cài đặt.
- **Body** (400, `{typography.body.fontSize}`, 1.5): Nội dung chi tiết của node, định nghĩa từ vựng. Độ dài dòng tối đa giới hạn trong khoảng 65–75 ký tự.
- **Label** (600, 11px, 0.1em, uppercase): Dành cho kickers, nhãn nhỏ hoặc chỉ số kỹ thuật của flashcard.

## 4. Elevation

SThreads sử dụng phong cách **Trực quan nổi khối**, kết hợp nền phẳng tối giản và các bề mặt nổi có đổ bóng nhẹ để phân lớp thông tin rõ ràng.

### Shadow Vocabulary
- **Card Shadow** (`0 4px 12px rgba(44, 42, 41, 0.08)`): Đổ bóng trung bình giúp tách biệt thẻ flashcard và popup node khỏi lớp canvas nền.
- **Floating Shadow** (`0 10px 25px -5px rgba(44, 42, 41, 0.12)`): Đổ bóng lớn dành cho thanh công cụ nổi (Control Dock) hoặc Modal Overlay.

### Named Rules
**The Interaction Lift Rule.** Các thành phần tương tác (như thẻ hoặc node trên timeline) phải nổi lên cao hơn (tăng bóng mờ và dịch chuyển nhẹ) khi người dùng di chuột qua (hover), tạo cảm giác phản hồi vật lý chân thực.

## 5. Components

### Buttons
- **Shape:** Bo góc nhẹ nhã nhặn (`{rounded.sm}`)
- **Primary:** Nền xanh (`{colors.primary}`), chữ trắng, padding (`8px 12px`).
- **Hover / Focus:** Chuyển màu nền sang đậm hơn (`#1d4ed8`), dịch chuyển nhẹ lên 1px.

### Cards / Containers
- **Corner Style:** Bo góc lớn (`{rounded.lg}`)
- **Background:** Trắng đục mờ nhẹ (`{colors.neutral-bg-card}`) để lộ nhẹ lớp canvas nền phía sau.
- **Border:** Đường viền mảnh 1px (`{colors.border}`) bao quanh để tạo độ sắc nét.

### Inputs / Fields
- **Style:** Bo góc vừa (`{rounded.md}`), nền nhạt, viền mảnh.
- **Focus:** Viền đổi sang màu xanh (`{colors.primary}`) kèm hiệu ứng viền mờ 3px.

## 6. Do's and Don'ts

### Do:
- **Do** sử dụng chữ kích thước lớn (`{typography.display.fontSize}`) cho các thông tin quan trọng để người dùng dễ tập trung.
- **Do** giữ các khoảng trống rộng rãi xung quanh canvas timeline để giao diện có nhịp thở tối giản.
- **Do** thiết kế các chuyển động mượt mà bằng đường cong easing tự nhiên khi tương tác với các nút mốc thời gian.

### Don't:
- **Don't** sử dụng kiểu thiết kế bảng quản trị (dashboard) thông thường tẻ nhạt với quá nhiều chỉ số phụ.
- **Don't** dùng các khối màu đặc gây phân tâm hoặc các đường viền dày để chia khung.
- **Don't** sử dụng chữ xám mờ khó đọc làm ảnh hưởng đến độ tập trung của người dùng (luôn giữ độ tương phản tối thiểu 4.5:1).
- **Don't** tạo các tính năng thừa thãi hoặc các chi tiết trang trí không phục vụ trực tiếp cho việc học.
