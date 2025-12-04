// src/dataSync.js
// Module dong bo du lieu ngan hang tu VietQR API

const fs = require("fs");
const https = require("https");
const path = require("path");

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(new Error("Khong parse duoc JSON tu API"));
                }
            });
        }).on("error", reject);
    });
}

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const file = fs.createWriteStream(filepath);

        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                file.close();
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                return reject(`Loi HTTP ${res.statusCode} khi tai anh: ${url}`);
            }

            res.pipe(file);

            file.on("finish", () => {
                file.close();
                resolve();
            });
        }).on("error", (err) => {
            file.close();
            reject(err);
        });
    });
}

async function syncBankData(config) {
    const apiUrl = config.data.apiUrl;
    const banksFile = path.resolve(config.data.banksFile);
    const logosDir = path.resolve(config.data.logosDir);

    console.log("[*] Dang tai danh sach ngan hang tu VietQR...");

    try {
        const result = await fetchJSON(apiUrl);

        if (!result?.data || !Array.isArray(result.data)) {
            throw new Error("Ket qua API khong hop le");
        }

        const banks = result.data;

        // Tao folder logos neu chua co
        if (!fs.existsSync(logosDir)) {
            fs.mkdirSync(logosDir, { recursive: true });
        }

        // Tao folder cho banks.json neu chua co
        const banksDir = path.dirname(banksFile);
        if (!fs.existsSync(banksDir)) {
            fs.mkdirSync(banksDir, { recursive: true });
        }

        console.log(`[*] Co tong cong ${banks.length} ngan hang. Bat dau tai logo...`);

        const cleanData = [];

        for (const bank of banks) {
            const fileExt = path.extname(bank.logo) || ".png";
            const filename = `${bank.code}${fileExt}`;
            const filepath = path.join(logosDir, filename);

            try {
                await downloadImage(bank.logo, filepath);
                console.log(`[+] Tai logo: ${filename}`);
            } catch (err) {
                console.log(`[-] Loi tai logo ${bank.code}: ${err}`);
            }

            cleanData.push({
                id: bank.id,
                name: bank.name,
                code: bank.code,
                bin: bank.bin,
                shortName: bank.shortName,
                logoFile: filename,
                transferSupported: bank.transferSupported === 1,
                lookupSupported: bank.lookupSupported === 1
            });
        }

        fs.writeFileSync(banksFile, JSON.stringify(cleanData, null, 4), "utf8");
        console.log(`[+] Da tao file ${banksFile}`);
        console.log("[+] Hoan tat dong bo du lieu ngan hang!");

        return cleanData;

    } catch (err) {
        console.error("[-] Loi:", err.message);
        throw err;
    }
}

function getLastSyncTime(config) {
    const banksFile = path.resolve(config.data.banksFile);
    if (fs.existsSync(banksFile)) {
        const stats = fs.statSync(banksFile);
        return stats.mtime;
    }
    return null;
}

function needsSync(config) {
    const lastSync = getLastSyncTime(config);
    if (!lastSync) return true;

    const refreshInterval = config.data.refreshIntervalDays * 24 * 60 * 60 * 1000; // days to ms
    const now = new Date();
    return (now - lastSync) > refreshInterval;
}

module.exports = {
    syncBankData,
    getLastSyncTime,
    needsSync
};
