// src/qrGenerator.js
// Module tao ma QR VietQR

const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const { tlv } = require("./utils/tlv");
const { crc16 } = require("./utils/crc");

let banks = [];

function loadBanks(banksFile) {
    const filePath = path.resolve(banksFile);
    if (fs.existsSync(filePath)) {
        banks = JSON.parse(fs.readFileSync(filePath, "utf8"));
        console.log(`[+] Da tai ${banks.length} ngan hang tu ${banksFile}`);
    } else {
        console.log(`[-] Khong tim thay file ${banksFile}`);
    }
}

function getBanks() {
    return banks;
}

function findBankByCode(code) {
    const upperCode = code.toUpperCase();
    return banks.find(b =>
        b.code.toUpperCase() === upperCode ||
        b.shortName.toUpperCase() === upperCode
    );
}

function findBankByBin(bin) {
    return banks.find(b => String(b.bin) === String(bin));
}

// Build VietQR Merchant Account Info (Tag 38)
function buildVietQRAccountInfo(bankBin, accountNumber) {
    const acqAndConsumer =
        tlv("00", bankBin) +
        tlv("01", accountNumber);

    const inner =
        tlv("00", "A000000727") +
        tlv("01", acqAndConsumer) +
        tlv("02", "QRIBFTTA");

    return tlv("38", inner);
}

function generatePayload({ bankCode, accountNumber, accountName, amount }) {
    const bank = findBankByCode(bankCode);
    if (!bank) {
        throw new Error(`Khong tim thay ngan hang voi code: ${bankCode}`);
    }

    const bankBin = bank.bin;
    const name = accountName.toUpperCase().slice(0, 25);
    const vietQRTag = buildVietQRAccountInfo(bankBin, accountNumber);

    let payload = "";
    payload += tlv("00", "01");
    payload += tlv("01", "11");
    payload += vietQRTag;
    payload += tlv("53", "704");

    if (amount) {
        payload += tlv("54", String(amount));
    }

    payload += tlv("58", "VN");
    payload += tlv("59", name);
    payload += tlv("60", bank.shortName || "HANOI");

    const payloadForCRC = payload + "6304";
    const crc = crc16(payloadForCRC);

    return {
        payload: payloadForCRC + crc,
        bank
    };
}

async function generateQRBuffer(payload, config) {
    const buffer = await QRCode.toBuffer(payload, {
        width: config.qr.width,
        margin: config.qr.margin,
        errorCorrectionLevel: config.qr.errorCorrectionLevel
    });
    return buffer;
}

async function generateQRFile(payload, filename, config) {
    const outputDir = path.resolve(config.output.dir);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outPath = path.join(outputDir, filename);
    await QRCode.toFile(outPath, payload, {
        width: config.qr.width,
        margin: config.qr.margin,
        errorCorrectionLevel: config.qr.errorCorrectionLevel
    });
    
    return outPath;
}

module.exports = {
    loadBanks,
    getBanks,
    findBankByCode,
    findBankByBin,
    generatePayload,
    generateQRBuffer,
    generateQRFile
};
