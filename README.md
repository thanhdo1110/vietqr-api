
# VietQR API Server

API Server tạo mã QR chuyển khoản ngân hàng Việt Nam theo chuẩn VietQR.

## Tính năng

- Tạo mã QR chuyển khoản cho 65+ ngân hàng Việt Nam
- QR kích thước 1024x1024 pixels, độ nét cao nhất
- Tự động đồng bộ dữ liệu ngân hàng từ VietQR API (mặc định: 7 ngày/lần)
- Hỗ trợ cả GET và POST request
- Trả về hình ảnh PNG hoặc JSON payload

## Cấu trúc thư mục

```
qr-api/
├── config.json              # Cau hinh server
├── server.js                # Entry point - API Server
├── package.json             # Dependencies
├── README.md                # Tai lieu
│
├── src/                     # Ma nguon chinh
│   ├── dataSync.js          # Module dong bo du lieu ngan hang
│   ├── qrGenerator.js       # Module tao ma QR
│   └── utils/
│       ├── tlv.js           # TLV encoder (EMV standard)
│       └── crc.js           # CRC16 checksum
│
├── data/                    # Du lieu
│   ├── banks.json           # Danh sach ngan hang
│   └── logos/               # Logo ngan hang (PNG)
│
└── output/                  # Thu muc luu QR (tuy chon)
```


## Cài đặt

```bash
# Clone repository
git clone https://github.com/thanhdo1110/vietqr-api.git
cd vietqr-api

# Cai dat dependencies
npm install

# Chay server
npm start
```


Server sẽ chạy tại `http://localhost:3000`


## Cấu hình

Chỉnh sửa file `config.json`:

```json
{
    "server": {
        "port": 3000,
        "host": "0.0.0.0"
    },
    "qr": {
        "width": 1024,
        "margin": 2,
        "errorCorrectionLevel": "H"
    },
    "data": {
        "refreshIntervalDays": 7,
        "apiUrl": "https://api.vietqr.io/v2/banks",
        "banksFile": "data/banks.json",
        "logosDir": "data/logos"
    },
    "output": {
        "dir": "output"
    }
}
```

| Tham số | Mô tả |
|---------|-------|
| `server.port` | Cổng server (mặc định: 3000) |
| `server.host` | Địa chỉ host (mặc định: 0.0.0.0) |
| `qr.width` | Kích thước QR (mặc định: 1024) |
| `qr.margin` | Viền QR (mặc định: 2) |
| `qr.errorCorrectionLevel` | Mức sửa lỗi: L, M, Q, H (mặc định: H - cao nhất) |
| `data.refreshIntervalDays` | Chu kỳ đồng bộ dữ liệu (mặc định: 7 ngày) |


## Tài liệu API

### 1. Kiểm tra server

```
GET /
```

**Phản hồi:**
```json
{
    "status": "ok",
    "message": "VietQR API Server",
    "endpoints": {...}
}
```

---

### 2. Danh sách ngân hàng

```
GET /banks
```

**Phản hồi:**
```json
{
    "status": "ok",
    "count": 65,
    "data": [
        {
            "id": 17,
            "name": "Ngân hàng TMCP Công thương Việt Nam",
            "code": "ICB",
            "bin": "970415",
            "shortName": "VietinBank",
            "logoFile": "ICB.png",
            "transferSupported": true,
            "lookupSupported": true
        },
        ...
    ]
}
```

---

### 3. Thông tin ngân hàng theo mã

```
GET /banks/:code
```

**Ví dụ:**
```bash
curl http://localhost:3000/banks/MB
```

**Phản hồi:**
```json
{
    "status": "ok",
    "data": {
        "id": 21,
        "name": "Ngân hàng TMCP Quân đội",
        "code": "MB",
        "bin": "970422",
        "shortName": "MBBank",
        "logoFile": "MB.png",
        "transferSupported": true,
        "lookupSupported": true
    }
}
```

---

### 4. Tạo mã QR - GET

```
GET /qr?code=<ma_ngan_hang>&account=<so_tai_khoan>&name=<ten_nguoi_nhan>&amount=<so_tien>&format=<format>
```

**Tham số:**

| Tham số | Bắt buộc | Mô tả |
|---------|----------|-------|
| `code` | Có | Mã ngân hàng (VD: MB, VCB, TCB) |
| `account` | Có | Số tài khoản |
| `name` | Có | Tên người nhận (không dấu) |
| `amount` | Không | Số tiền (VND) |
| `format` | Không | `image` (mặc định) hoặc `json` |

**Ví dụ - Trả về hình ảnh:**
```bash
# Có số tiền
curl "http://localhost:3000/qr?code=MB&account=9999991110&name=DO%20TRUNG%20THANH&amount=100000" -o qr.png

# Không có số tiền
curl "http://localhost:3000/qr?code=VCB&account=1234567890&name=NGUYEN%20VAN%20A" -o qr.png
```

**Ví dụ - Trả về JSON:**
```bash
curl "http://localhost:3000/qr?code=MB&account=9999991110&name=DO%20TRUNG%20THANH&amount=100000&format=json"
```

**Phản hồi (JSON):**
```json
{
    "status": "ok",
    "data": {
        "payload": "00020101021138540010A000000727...",
        "bank": {
            "code": "MB",
            "name": "Ngân hàng TMCP Quân đội",
            "shortName": "MBBank",
            "bin": "970422"
        },
        "account": "9999991110",
        "accountName": "DO TRUNG THANH",
        "amount": "100000"
    }
}
```

---

### 5. Tạo mã QR - POST

```
POST /qr
Content-Type: application/json
```

**Body:**
```json
{
    "bankCode": "MB",
    "accountNumber": "9999991110",
    "accountName": "DO TRUNG THANH",
    "amount": 100000,
    "format": "image"
}
```

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| `bankCode` | Có | Mã ngân hàng |
| `accountNumber` | Có | Số tài khoản |
| `accountName` | Có | Tên người nhận |
| `amount` | Không | Số tiền (VND) |
| `format` | Không | `image` (mặc định) hoặc `json` |

**Ví dụ:**
```bash
# Trả về hình ảnh
curl -X POST http://localhost:3000/qr \
  -H "Content-Type: application/json" \
  -d '{"bankCode":"MB","accountNumber":"9999991110","accountName":"DO TRUNG THANH","amount":100000}' \
  -o qr.png

# Trả về JSON
curl -X POST http://localhost:3000/qr \
  -H "Content-Type: application/json" \
  -d '{"bankCode":"TCB","accountNumber":"0987654321","accountName":"TRAN THI B","format":"json"}'
```

---

### 6. Đồng bộ dữ liệu ngân hàng

```
GET /sync
```

Đồng bộ lại danh sách ngân hàng và logo từ VietQR API.

**Phản hồi:**
```json
{
    "status": "ok",
    "message": "Đã đồng bộ dữ liệu ngân hàng thành công"
}
```

---

### 7. Lấy logo ngân hàng

```
GET /logos/:filename
```

**Ví dụ:**
```bash
curl http://localhost:3000/logos/MB.png -o mb-logo.png
```

## Mã ngân hàng phổ biến


| Mã | Ngân hàng |
|------|-----------|
| `MB` | MBBank |
| `VCB` | Vietcombank |
| `TCB` | Techcombank |
| `BIDV` | BIDV |
| `VPB` | VPBank |
| `ACB` | ACB |
| `TPB` | TPBank |
| `STB` | Sacombank |
| `ICB` | VietinBank |
| `VBA` | Agribank |
| `HDB` | HDBank |
| `OCB` | OCB |
| `SHB` | SHB |
| `MSB` | MSB |
| `EIB` | Eximbank |
| `VIB` | VIB |
| `LPB` | LPBank |
| `SEAB` | SeABank |

Xem danh sách đầy đủ tại endpoint `/banks`.


## Cấu trúc mã QR (EMV QR Code)

Mã QR được tạo theo chuẩn EMVCo và VietQR:

```
00 - Định dạng payload: "01"
01 - Loại QR: "11" (QR tĩnh)
38 - Thông tin tài khoản VietQR:
    00 - GUID: "A000000727"
    01 - Thông tin người thụ hưởng:
        00 - BIN: "970422" (mã ngân hàng)
        01 - Số tài khoản: "9999991110"
    02 - Mã dịch vụ: "QRIBFTTA"
53 - Loại tiền: "704" (VND)
54 - Số tiền: "100000" (tùy chọn)
58 - Quốc gia: "VN"
59 - Tên người nhận: "DO TRUNG THANH"
60 - Thành phố/ngân hàng: "MBBank"
63 - CRC16 Checksum
```

## Mô-đun chi tiết


### src/dataSync.js

Mô-đun đồng bộ dữ liệu ngân hàng từ VietQR API.

```javascript
// Các hàm chính
syncBankData(config)    // Đồng bộ dữ liệu ngân hàng và logo
getLastSyncTime(config) // Lấy thời gian đồng bộ cuối
needsSync(config)       // Kiểm tra có cần đồng bộ không
```

### src/qrGenerator.js

Mô-đun tạo mã QR.

```javascript
// Các hàm chính
loadBanks(banksFile)           // Load danh sách ngân hàng
getBanks()                     // Lấy danh sách ngân hàng
findBankByCode(code)           // Tìm ngân hàng theo mã
findBankByBin(bin)             // Tìm ngân hàng theo BIN
generatePayload(options)       // Tạo EMV payload
generateQRBuffer(payload, config)  // Tạo QR buffer (PNG)
generateQRFile(payload, filename, config) // Lưu QR ra file
```

### src/utils/tlv.js

TLV (Tag-Length-Value) encoder theo chuẩn EMV.

```javascript
tlv(tag, value) // Mã hóa TLV
// Ví dụ: tlv("00", "01") => "000201"
```

### src/utils/crc.js

CRC16-CCITT checksum.

```javascript
crc16(payload) // Tính CRC16
// Ví dụ: crc16("00020101...6304") => "ABCD"
```

## Lỗi thường gặp

### 1. Không tìm thấy ngân hàng

```json
{
    "status": "error",
    "message": "Không tìm thấy ngân hàng với code: XYZ"
}
```

**Nguyên nhân:** Mã ngân hàng không hợp lệ.
**Giải pháp:** Kiểm tra danh sách tại `/banks`.

### 2. Thiếu tham số

```json
{
    "status": "error",
    "message": "Thiếu tham số. Cần: code, account, name. Tuỳ chọn: amount"
}
```

**Giải pháp:** Truyền đầy đủ các tham số bắt buộc.

### 3. Server không khởi động

**Nguyên nhân:** Port đã bị sử dụng.
**Giải pháp:** Đổi port trong `config.json`.

## License

MIT License

 

## Tham khảo

- [VietQR](https://vietqr.io)
- [EMVCo QR Code Specification](https://www.emvco.com/emv-technologies/qrcodes/)
