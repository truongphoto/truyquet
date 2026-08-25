# BÁC SĨ TRUY QUÉT · TRƯỜNG GPP · v3.6.0 H1

- 8 màn mở khóa tuần tự; 3 cấp Dễ / Trung bình / Khó.
- Mỗi màn sinh tồn 180 giây (3 phút); Boss xuất hiện đúng giây 180.
- NPC G1 có nhiều archetype với tốc độ và quỹ đạo khác nhau; tổng tốc độ đã giảm để người chơi xử lý kịp.
- Màn 2/4/8 đã sửa lỗi cluster/mini gây NaN và thêm anti-stall tự sửa NPC lỗi.
- Khử nhiễm 0→50% được kéo chậm khoảng 3×; Boss chết làm sạch 50→100% trong 5 giây + lấp lánh 2 giây.
- Boss dị dạng, có mùi/hạt độc và vùng u tối cục bộ bí ẩn; gọi quân ở 75% / 50% / 25% máu.
- Vật phẩm thường và thưởng Boss có hiệu ứng vòng màu/lan sáng trực tiếp trên vũ khí.
- Boss Reward tích lũy 4 ô Q/W/E/R.
- CÀI TRÒ CHƠI = cài PWA/lối tắt; tự ẩn sau khi đã cài.
- NÂNG CẤP PHIÊN BẢN chỉ hiện khi Service Worker phát hiện bản mới; không còn hệ nâng chỉ số chiến dịch.
- Logo trong game giữ nguyên; icon cài đặt dùng bộ app-icon đã chốt.


## v3.6.0 H1
- Điện thoại mặc định **AUTO FIRE**: game tự bắn; người chơi tập trung né trái/phải, đổi vũ khí và dùng vật phẩm.
- Chạm trực tiếp NPC/Boss/SUPPLY để **khóa mục tiêu ưu tiên**. Vòng khóa nhiều lớp + nhãn LOCK hiển thị quanh mục tiêu; mục tiêu chết thì tự quay lại AUTO.
- AUTO có độ bám mục tiêu, không nhảy liên tục; NPC nguy hiểm gần người chơi được ưu tiên, Boss được bắn khi không còn NPC cấp bách.
- AUTO không bắn từ quá xa: chỉ khai hỏa khi NPC vào vùng giao chiến; ngưỡng Dễ rộng hơn, Khó buộc NPC tới gần hơn.
- PC có 2 chế độ ở menu phải: **AUTO** và **THỦ CÔNG**; ghi nhớ bằng localStorage và đổi được trong Pause.
- PC THỦ CÔNG giữ nguyên chuột ngắm + click/giữ để bắn.
- Bom Vitamin trong AUTO được giãn tối thiểu 1,45s giữa hai lần để tránh tự ném hết 3 quả quá nhanh.
- Mobile không hiển thị lựa chọn THỦ CÔNG; Pause ghi rõ AUTO cố định.
- Giữ nguyên cân bằng Boss v3.5, sa hình động, SUPPLY tăng cường, BXH client, hard cleanup sau Boss và toàn bộ hiệu ứng vật phẩm H1.

## v3.5.0 H1
- Sa hình bệnh viện tương tác; panel preview tự né khu đang trỏ, không che Khoa Cấp Cứu.
- Dẫn truyện 8 khu vực; gameplay chỉ bắt đầu sau nút **VÀO NGHÊNH CHIẾN**.
- Boss HP giữ mức H1 cao nhưng lượng đạn được giảm mạnh: Dễ 1–2, Trung bình 2–3, Khó chủ yếu 2–3 và rất hiếm 4 ở phase cuối; cảnh báo 0,66–0,88s và có khoảng nghỉ.
- Boss ngừng/hoãn bắn khi gọi quân ở 75% / 50% / 25% máu.
- SUPPLY tăng tổng lượt: Dễ tối đa 13, Trung bình 11, Khó 9; có bảo đảm không để khoảng trống quá lâu.
- NPC H1 vẫn giữ nhiều archetype, speed/spawn cao hơn G1 và anti-stall.
- Hard cleanup sau Boss để không còn đạn/impact bị đóng băng.
- Item FX mở rộng x3/x4; Khiên 12s bao phủ người chơi.
- PWA Install/Update giữ đúng ý nghĩa sản phẩm.
- Thêm giao diện BXH và lưu kỷ lục tùy chọn. BXH nhiều thiết bị tự bật khi cấu hình backend trong `leaderboard-config.js`; xem `LEADERBOARD-ONLINE-SETUP.md`.

