const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const { tlv } = require("./utils/tlv");
const { crc16 } = require("./utils/crc");

// Load banks data
const banksPath = path.join(__dirname, "data", "banks.json");
const banks = JSON.parse(fs.readFileSync(banksPath, "utf8"));

// Tìm ngân hàng theo code (VD: MB, VCB, TCB, ...)
function findBankByCode(code) {
    const upperCode = code.toUpperCase();
    return banks.find(b => 
        b.code.toUpperCase() === upperCode || 
        b.shortName.toUpperCase() === upperCode
    );
}

// Build VietQR Merchant Account Info (Tag 38)
function buildVietQRAccountInfo(bankBin, accountNumber) {
    // Sub-field of tag 01: 00 = BIN, 01 = Account
    const acqAndConsumer =
        tlv("00", bankBin) +        // 00: BNB ID / BIN
        tlv("01", accountNumber);   // 01: Consumer ID / Account No

    const inner =
        tlv("00", "A000000727") +   // GUID VietQR
        tlv("01", acqAndConsumer) + // Beneficiary organization (BIN + Account)
        tlv("02", "QRIBFTTA");      // Service code: Transfer to Account

    return tlv("38", inner);
}

async function generateBankQR({ bankCode, accountNumber, accountName, amount }) {
    const bank = findBankByCode(bankCode);
    if (!bank) {
        throw new Error(`Không tìm thấy ngân hàng với code: ${bankCode}`);
    }

    const bankBin = bank.bin;

    // Chuẩn hóa tên: không dấu, in hoa, <= 25 ký tự là an toàn
    const name = accountName.toUpperCase().slice(0, 25);

    // VietQR Tag 38
    const vietQRTag = buildVietQRAccountInfo(bankBin, accountNumber);

    // Build EMV root
    let payload = "";
    payload += tlv("00", "01");      // Payload Format Indicator
    payload += tlv("01", "11");      // Static QR (11 = static, 12 = dynamic)

    payload += vietQRTag;            // Tag 38 – VietQR

    payload += tlv("53", "704");     // Currency: VND

    if (amount) {
        // amount phải là số, không dấu phẩy, không chấm
        const amt = String(amount);
        payload += tlv("54", amt);
    }

    payload += tlv("58", "VN");      // Country code
    payload += tlv("59", name);      // Account name
    payload += tlv("60", bank.shortName || "HANOI"); // City or bank short name

    // CRC16
    const payloadForCRC = payload + "6304";
    const crc = crc16(payloadForCRC);

    const finalPayload = payloadForCRC + crc;
    return { payload: finalPayload, bank };
}

async function exportQR(payload, filename = "vietqr.png") {
    const outPath = path.join(__dirname, filename);
    // Tạo QR 1024x1024 với error correction level H (cao nhất) để nét nhất
    await QRCode.toFile(outPath, payload, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'H'
    });
    console.log("✔ QR saved:", outPath);
    return outPath;
}

function printUsage() {
    console.log("\n📱 VietQR Generator - Tạo mã QR chuyển khoản ngân hàng");
    console.log("═══════════════════════════════════════════════════════\n");
    console.log("Cách dùng:");
    console.log("  node index.js <mã ngân hàng> <số tài khoản> <tên người nhận> [số tiền]\n");
    console.log("Ví dụ:");
    console.log("  node index.js MB 9999991110 \"DO TRUNG THANH\" 100000");
    console.log("  node index.js VCB 1234567890 \"NGUYEN VAN A\"");
    console.log("  node index.js TCB 0987654321 \"TRAN THI B\" 50000\n");
    console.log("Danh sách mã ngân hàng phổ biến:");
    console.log("  MB       - MBBank");
    console.log("  VCB      - Vietcombank");
    console.log("  TCB      - Techcombank");
    console.log("  BIDV     - BIDV");
    console.log("  VPB      - VPBank");
    console.log("  ACB      - ACB");
    console.log("  TPB      - TPBank");
    console.log("  STB      - Sacombank");
    console.log("  ICB      - VietinBank");
    console.log("  VBA      - Agribank");
    console.log("  ... và nhiều ngân hàng khác\n");
}

// Main
(async () => {
    const args = process.argv.slice(2);

    // Kiểm tra số lượng tham số
    if (args.length < 3) {
        printUsage();
        process.exit(1);
    }

    const [bankCode, accountNumber, accountName, amount] = args;

    try {
        const { payload, bank } = await generateBankQR({
            bankCode,
            accountNumber,
            accountName,
            amount: amount ? parseInt(amount, 10) : null
        });

        console.log("\n📱 VietQR Generator");
        console.log("═══════════════════════════════════════════════════════");
        console.log(`🏦 Ngân hàng: ${bank.name} (${bank.shortName})`);
        console.log(`🔢 Số tài khoản: ${accountNumber}`);
        console.log(`👤 Tên người nhận: ${accountName.toUpperCase()}`);
        if (amount) {
            console.log(`💰 Số tiền: ${parseInt(amount, 10).toLocaleString('vi-VN')} VND`);
        } else {
            console.log(`💰 Số tiền: Tùy người chuyển`);
        }
        console.log("═══════════════════════════════════════════════════════");
        console.log("PAYLOAD:", payload);
        console.log("");

        const filename = `vietqr-${bankCode.toUpperCase()}-${accountNumber}.png`;
        await exportQR(payload, filename);

    } catch (error) {
        console.error("❌ Lỗi:", error.message);
        process.exit(1);
    }
})();
