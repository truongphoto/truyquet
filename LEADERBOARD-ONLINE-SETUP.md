# Bảng xếp hạng nhiều thiết bị

Game v3.5.0 đã có giao diện, lưu kỷ lục tùy chọn và client GET/POST cho bảng xếp hạng.

Mặc định `leaderboard-config.js` để endpoint trống, vì GitHub Pages/PWA tĩnh không có cơ sở dữ liệu dùng chung. Khi endpoint trống, game chỉ lưu BXH trên máy bằng `localStorage` và giao diện ghi rõ trạng thái này.

Để bật BXH nhiều máy, đặt:

```js
window.BSTQ_LEADERBOARD_ENDPOINT = 'https://YOUR-SERVICE.example/api/leaderboard';
```

API cần hỗ trợ:

## GET
`GET /api/leaderboard?difficulty=normal&stage=1`

Trả về:

```json
{"entries":[{"name":"BacSiA","score":12500,"stage":1,"difficulty":"normal","rank":"S","bossSeconds":33.2,"createdAt":"2026-08-25T00:00:00Z"}]}
```

`stage` có thể bỏ để lấy nhiều màn.

## POST
`POST /api/leaderboard` với JSON:

```json
{"name":"BacSiA","score":12500,"stage":1,"difficulty":"normal","rank":"S","accuracy":88,"bossSeconds":33.2,"version":"3.5.0"}
```

Khuyến nghị backend:
- giới hạn tên 16 ký tự và lọc nội dung không phù hợp;
- chỉ chấp nhận difficulty easy/normal/hard, stage 0..7;
- kiểm tra score/thời gian hợp lý trước khi công khai;
- rate limit theo IP/device để giảm spam;
- chỉ dùng HTTPS và bật CORS cho domain game.
