// server.js
// VietQR API Server

const express = require("express");
const path = require("path");
const fs = require("fs");

const config = require("./config.json");
const { syncBankData, needsSync } = require("./src/dataSync");
const {
    loadBanks,
    getBanks,
    findBankByCode,
    generatePayload,
    generateQRBuffer,
    generateQRFile
} = require("./src/qrGenerator");

const app = express();
app.use(express.json());

// Khoi tao
async function init() {
    console.log("[*] Khoi dong VietQR API Server...");

    // Kiem tra va dong bo du lieu neu can
    if (needsSync(config)) {
        console.log("[*] Du lieu can duoc cap nhat. Dang dong bo...");
        await syncBankData(config);
    } else {
        console.log("[+] Du lieu da cap nhat. Bo qua dong bo.");
    }

    // Load danh sach ngan hang
    loadBanks(config.data.banksFile);

    // Dat lich dong bo tu dong moi tuan
    const refreshInterval = config.data.refreshIntervalDays * 24 * 60 * 60 * 1000;
    setInterval(async () => {
        console.log("[*] Tu dong dong bo du lieu ngan hang...");
        try {
            await syncBankData(config);
            loadBanks(config.data.banksFile);
        } catch (err) {
            console.error("[-] Loi dong bo:", err.message);
        }
    }, refreshInterval);
}

// ========================
// API Routes
// ========================

// Health check
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "VietQR API Server",
        endpoints: {
            "GET /banks": "Danh sach ngan hang",
            "GET /banks/:code": "Thong tin ngan hang theo code",
            "GET /qr": "Tao QR code (query params: code, account, name, amount)",
            "POST /qr": "Tao QR code (body: bankCode, accountNumber, accountName, amount)",
            "GET /sync": "Dong bo du lieu ngan hang"
        }
    });
});

// Danh sach ngan hang
app.get("/banks", (req, res) => {
    const banks = getBanks();
    res.json({
        status: "ok",
        count: banks.length,
        data: banks
    });
});

// Thong tin ngan hang theo code
app.get("/banks/:code", (req, res) => {
    const bank = findBankByCode(req.params.code);
    if (!bank) {
        return res.status(404).json({
            status: "error",
            message: `Khong tim thay ngan hang voi code: ${req.params.code}`
        });
    }
    res.json({
        status: "ok",
        data: bank
    });
});

// Tao QR - GET method
app.get("/qr", async (req, res) => {
    try {
        const { code, account, name, amount } = req.query;

        if (!code || !account || !name) {
            return res.status(400).json({
                status: "error",
                message: "Thieu tham so. Can: code, account, name. Tuy chon: amount"
            });
        }

        const { payload, bank } = generatePayload({
            bankCode: code,
            accountNumber: account,
            accountName: name,
            amount: amount ? parseInt(amount, 10) : null
        });

        const format = req.query.format || "image";

        if (format === "json") {
            return res.json({
                status: "ok",
                data: {
                    payload,
                    bank: {
                        code: bank.code,
                        name: bank.name,
                        shortName: bank.shortName,
                        bin: bank.bin
                    },
                    account: account,
                    accountName: name.toUpperCase(),
                    amount: amount || null
                }
            });
        }

        // Tra ve hinh anh
        const buffer = await generateQRBuffer(payload, config);
        res.set("Content-Type", "image/png");
        res.set("Content-Disposition", `inline; filename="vietqr-${code}-${account}.png"`);
        res.send(buffer);

    } catch (err) {
        res.status(400).json({
            status: "error",
            message: err.message
        });
    }
});

// Tao QR - POST method
app.post("/qr", async (req, res) => {
    try {
        const { bankCode, accountNumber, accountName, amount, format } = req.body;

        if (!bankCode || !accountNumber || !accountName) {
            return res.status(400).json({
                status: "error",
                message: "Thieu tham so. Can: bankCode, accountNumber, accountName. Tuy chon: amount"
            });
        }

        const { payload, bank } = generatePayload({
            bankCode,
            accountNumber,
            accountName,
            amount: amount ? parseInt(amount, 10) : null
        });

        if (format === "json") {
            return res.json({
                status: "ok",
                data: {
                    payload,
                    bank: {
                        code: bank.code,
                        name: bank.name,
                        shortName: bank.shortName,
                        bin: bank.bin
                    },
                    account: accountNumber,
                    accountName: accountName.toUpperCase(),
                    amount: amount || null
                }
            });
        }

        // Tra ve hinh anh
        const buffer = await generateQRBuffer(payload, config);
        res.set("Content-Type", "image/png");
        res.set("Content-Disposition", `inline; filename="vietqr-${bankCode}-${accountNumber}.png"`);
        res.send(buffer);

    } catch (err) {
        res.status(400).json({
            status: "error",
            message: err.message
        });
    }
});

// Dong bo du lieu thu cong
app.get("/sync", async (req, res) => {
    try {
        console.log("[*] Dong bo du lieu theo yeu cau...");
        await syncBankData(config);
        loadBanks(config.data.banksFile);
        res.json({
            status: "ok",
            message: "Da dong bo du lieu ngan hang thanh cong"
        });
    } catch (err) {
        res.status(500).json({
            status: "error",
            message: err.message
        });
    }
});

// Serve logo files
app.use("/logos", express.static(path.resolve(config.data.logosDir)));

// Start server
init().then(() => {
    const { port, host } = config.server;
    app.listen(port, host, () => {
        console.log(`[+] Server dang chay tai http://${host}:${port}`);
        console.log("[+] API Endpoints:");
        console.log("    GET  /banks          - Danh sach ngan hang");
        console.log("    GET  /banks/:code    - Thong tin ngan hang");
        console.log("    GET  /qr             - Tao QR (query params)");
        console.log("    POST /qr             - Tao QR (JSON body)");
        console.log("    GET  /sync           - Dong bo du lieu");
        console.log("    GET  /logos/:file    - Lay logo ngan hang");
    });
}).catch(err => {
    console.error("[-] Loi khoi dong server:", err.message);
    process.exit(1);
});
