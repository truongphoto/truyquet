# ĐẶC TẢ FINAL v2.2.0 · KHÓA ẢNH NỀN

## 7 màn chính thức
1. KHOA DƯỢC – `assets/stage1.jpg`
2. KHOA CẤP CỨU – `assets/stage2.jpg`
3. KHOA HÔ HẤP – `assets/stage3.jpg`
4. KHOA NHI – `assets/stage4.jpg`
5. KHOA SẢN – `assets/stage5.jpg`
6. KHOA THẦN KINH – `assets/stage6.jpg`
7. TRẬN CHIẾN CUỐI CÙNG – `assets/stage7.jpg`

## Khóa nền
- 7 file trên lấy nguyên byte từ `ẢNH nền ok.rar`.
- Không chỉnh màu, không đổi chữ, không crop, không resave.
- `stage-final.jpg` là bản sao byte-for-byte của ảnh màn 7 để dùng khi cần fallback/victory.

## Môi trường nhiễm bẩn
- Không phủ u tối toàn màn.
- Vết loang, nhầy, vệt chảy, đốm bẩn và vũng dịch là lớp canvas runtime nằm trên ảnh gốc.
- Quái thường: Khử nhiễm 0% → tối đa 50%.
- Boss xuất hiện: giữ 50%.
- Hạ Boss: thanh tẩy 50% → 100% trong khoảng 3 giây; lớp nhiễm bẩn biến mất, ảnh gốc hiện nguyên vẹn.

## Vật phẩm
- SUPPLY NPC là nguồn vật phẩm; quái thường không random drop.
- Hồi phục: +2 Sinh tồn.
- Khiên: 6s. Drone: 10s. Adrenaline: 5s. Vaccine: 7s. Sterile Field: 6s. GPP Boost: 8s.
- Logo TRƯỜNG GPP là vật phẩm đặc biệt tổng hợp: kích hoạt đồng thời toàn bộ các hiệu ứng trên.

## UI
- Menu chính bỏ các dòng mô tả kỹ thuật như “FPS góc nhìn thứ nhất”.
- Chọn màn bằng chính 7 ảnh nền, có chú thích Màn + Tên khoa.
- Gameplay chỉ giữ HUD chiến đấu cần thiết.
- Pause có: Tiếp tục / Chơi lại màn / Cài đặt / Menu chính.
