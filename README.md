# Tasago FleetOps

Cổng quản lý dữ liệu vận hành đội xe của Tasago, xây dựng bằng **React 19, TypeScript, Vite, Tailwind CSS v4 và Express**. Ứng dụng hỗ trợ nhập dữ liệu từ Excel, tìm kiếm/lọc, theo dõi chỉ số vận hành, chỉnh sửa bản ghi, xuất báo cáo và đồng bộ dữ liệu dùng chung qua API máy chủ.

## Điểm chính của phiên bản hiện tại

Giao diện đã được chuyển sang một dashboard React thống nhất với phong cách **dark-navy, cyan và emerald**, tập trung vào khả năng đọc nhanh, thao tác ít bước và hiển thị tốt trên màn hình desktop lẫn mobile. Màn hình đăng nhập mới không còn chứa tài khoản hoặc mật khẩu mặc định trong mã nguồn; phiên được ký ở server và lưu trong cookie `HttpOnly`.

File `index.html` vẫn tồn tại trong repository vì đây là **entry point bắt buộc của Vite**. Nội dung legacy khổng lồ trước đây đã được loại bỏ và thay bằng shell tối giản chỉ chứa `#root` cùng script React. Vì vậy, phần “index” cũ đã được gỡ khỏi GitHub mà không làm hỏng build Vercel.

## Kiến trúc dữ liệu

```text
Browser React UI
      │ cookie HttpOnly + HTTPS
      ▼
Express API
      │
      ├── /api/auth/*          Đăng nhập, kiểm tra phiên, đăng xuất
      ├── /api/fleet-data      Đọc/ghi/xóa dữ liệu đội xe, yêu cầu đăng nhập
      └── /api/recognize-image OCR Gemini server-side, yêu cầu đăng nhập
```

API hiện lưu bản ghi trong file JSON tại `DATA_DIR/fleet_data.json`. Cách lưu này phù hợp với một máy chủ Node có filesystem bền vững hoặc persistent disk. **Filesystem của Vercel Serverless không nên được xem là kho dữ liệu lâu dài**; nếu backend chạy trên Vercel, hãy chuyển storage sang Supabase, PostgreSQL, S3 hoặc một dịch vụ database bền vững trước khi dùng production lâu dài.

## Chạy local

Yêu cầu Node.js 18 trở lên.

```bash
npm install
cp .env.example .env
npm run dev
```

Mở `http://localhost:3000`. Tạo các giá trị local trong `.env`:

```env
AUTH_SECRET=chuoi-bi-mat-dai-ngau-nhien
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mat-khau-manh-cua-ban
GEMINI_API_KEY=gemini-key-chi-dung-tren-server
FRONTEND_ORIGIN=http://localhost:3000
VITE_API_URL=
DATA_DIR=./data
```

`GEMINI_API_KEY` không được đưa vào trình duyệt. Chức năng OCR chỉ lấy key từ biến môi trường server.

## Deploy frontend trên Vercel và API trên máy chủ Node

Vercel có thể dùng để build và phân phối frontend. Nếu API Express chạy ở domain khác, hãy cấu hình:

```env
VITE_API_URL=https://api.example.com
```

Trên máy chủ API, cấu hình:

```env
AUTH_SECRET=chuoi-ngau-nhien-dai
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mat-khau-manh
FRONTEND_ORIGIN=https://your-project.vercel.app
GEMINI_API_KEY=server-only-gemini-key
DATA_DIR=/var/lib/tasago-fleetops/data
NODE_ENV=production
```

`FRONTEND_ORIGIN` phải khớp chính xác origin của website, không thêm dấu `/` cuối. Backend chỉ cấp CORS credentials cho origin này. Sau khi đổi biến `VITE_API_URL`, cần redeploy frontend Vercel vì đây là biến build-time.

### Build production

```bash
npm run lint
npm run build
npm start
```

Nếu frontend và API cùng origin, để trống `VITE_API_URL`. Nếu tách origin, cả hai domain phải dùng HTTPS để cookie `Secure` và `SameSite=None` hoạt động đúng.

## Bảo mật đã xử lý

| Khu vực | Biện pháp |
|---|---|
| Đăng nhập | Tài khoản lấy từ `ADMIN_USERNAME` và `ADMIN_PASSWORD`, không hardcode trong frontend |
| Phiên | HMAC session token trong cookie `HttpOnly`, `Secure` khi production, tự hết hạn sau 8 giờ |
| Brute force | Giới hạn 5 lần đăng nhập trong 15 phút theo IP trên mỗi instance |
| API dữ liệu | GET/POST/DELETE `/api/fleet-data` đều yêu cầu phiên hợp lệ |
| OCR | `/api/recognize-image` yêu cầu đăng nhập; không chấp nhận API key từ browser |
| CORS | Chỉ cho phép `FRONTEND_ORIGIN` đã cấu hình và có credentials |
| Headers | Tắt `X-Powered-By`, thêm `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` và `Permissions-Policy` |
| Payload | JSON server giới hạn 12 MB; ảnh OCR và mảng dữ liệu có giới hạn kích thước |
| GitHub | `.env`, `data/`, `dist/`, log và editor metadata không được commit |

Đây là lớp bảo vệ ứng dụng, không thay thế HTTPS, firewall, backup, secret rotation hoặc hệ thống database có phân quyền. Không đưa `AUTH_SECRET`, `ADMIN_PASSWORD`, `GEMINI_API_KEY` hoặc dữ liệu thật vào GitHub.

## API cơ bản

`GET /api/health` là endpoint kiểm tra tình trạng server và không yêu cầu đăng nhập.

`POST /api/auth/login` nhận JSON `{ "username": "...", "password": "..." }` và trả cookie phiên khi thành công.

`GET /api/auth/me` kiểm tra phiên hiện tại. `POST /api/auth/logout` xóa cookie.

`GET /api/fleet-data`, `POST /api/fleet-data` và `DELETE /api/fleet-data` yêu cầu cookie phiên hợp lệ. Frontend sử dụng `src/api.ts` để tự gửi `credentials: include`.

## Quy trình dữ liệu

Người dùng nhập hoặc chỉnh sửa dữ liệu trên giao diện React. Frontend giữ cache cục bộ để hỗ trợ trải nghiệm offline, sau đó gửi bản ghi lên Express API. Server cập nhật phiên bản, thời điểm cập nhật và file lưu trữ đã cấu hình. Khi có dữ liệu mới, frontend tự đồng bộ lại mỗi 5 giây trong phiên đăng nhập.

Để sử dụng dữ liệu bền vững trên production, nên thay adapter file JSON bằng Supabase/PostgreSQL hoặc gắn persistent disk cho máy chủ Node. Không nên dựa vào `data/` mặc định nếu backend được chạy trong môi trường serverless.

## Cấu trúc chính

```text
index.html                 Vite entry shell tối giản
src/App.tsx                Dashboard, auth state, filter và đồng bộ dữ liệu
src/components/            Header, KPI cards, filter, table và modal
src/components/LoginScreen.tsx  Màn hình đăng nhập hiện đại
src/api.ts                 API base URL và credentials helper
server.ts                  Express API và phục vụ production
serverAuth.ts              HMAC session, cookie và login rate limit
src/index.css              Design tokens, nền, focus state và accessibility
.env.example               Danh sách biến môi trường không chứa secret thật
```

## Kiểm tra trước khi push

```bash
npm run lint
npm run build
git diff --check
```

Sau khi build thành công, kiểm tra thủ công màn hình đăng nhập, thêm/sửa/xóa một bản ghi, import Excel, export Excel/CSV, refresh dữ liệu và đăng xuất. Khi deploy production, xác nhận request chưa đăng nhập nhận HTTP `401`, còn request sau đăng nhập nhận dữ liệu bình thường.

## Giấy phép và vận hành

Đây là ứng dụng nội bộ cho hoạt động vận hành Tasago. Người quản trị chịu trách nhiệm cấu hình secret, backup dữ liệu, cấp quyền truy cập và kiểm tra việc tuân thủ chính sách dữ liệu của doanh nghiệp.

## Tài liệu tham khảo

[1]: https://vercel.com/docs/environment-variables "Vercel Environment Variables"

[2]: https://vercel.com/docs/functions/runtimes "Vercel Function Runtimes"

Vercel ghi rõ biến môi trường được đọc trong build step hoặc lúc function chạy, và thay đổi biến chỉ áp dụng cho các deployment mới [1]. Tài liệu runtime cũng nêu filesystem của Vercel Functions là read-only, chỉ có `/tmp` writable tạm thời; vì vậy file JSON local không nên được xem là storage bền vững trên Vercel [2].

## Tải ảnh và đồng bộ vào bản ghi

Trong bảng dữ liệu, chọn **Chỉnh sửa** ở bản ghi cần cập nhật rồi dùng khu vực **Ảnh hồ sơ / chứng từ** để chọn ảnh JPG, PNG hoặc WebP. Ảnh được xử lý trực tiếp trong trình duyệt, thu nhỏ tối đa 1280 px và chuyển sang JPEG trước khi gửi. Khi bấm **Lưu và đồng bộ**, ảnh được lưu trong trường `imageDataUrl` của chính `DriverRecord`, sau đó đi qua `POST /api/fleet-data` cùng toàn bộ dữ liệu và được hiển thị lại dưới dạng thumbnail trong bảng.

Ảnh gốc tối đa 12 MB; ảnh sau nén tối đa khoảng 1,5 MB cho mỗi bản ghi. API chỉ chấp nhận data URL JPEG hợp lệ và giới hạn kích thước để tránh payload bất thường. Cache `localStorage` của trình duyệt không lưu chuỗi ảnh lớn; ảnh đầy đủ chỉ được gửi và đọc từ dữ liệu server. Nếu backend chạy trên Vercel Functions, cần chuyển ảnh sang object storage hoặc Supabase Storage để có lưu trữ bền vững; file JSON local không phù hợp cho dữ liệu production lâu dài.
