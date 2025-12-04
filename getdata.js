// getBanks.js
// Tool tải danh sách ngân hàng VietQR + tải logo từng bank

import fs from "fs";
import https from "https";
import path from "path";

const API_URL = "https://api.vietqr.io/v2/banks";
const LOGO_DIR = "./logos";

// ========================
// Download JSON function
// ========================
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = "";

            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(new Error("Không parse được JSON từ API"));
                }
            });
        }).on("error", reject);
    });
}

// ========================
// Download image function
// ========================
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);

        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(filepath);
                return reject(`Lỗi HTTP ${res.statusCode} khi tải ảnh: ${url}`);
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

// ========================
// Main function
// ========================
async function run() {
    console.log("Dang tai danh sach ngan hang tu VietQR...");

    try {
        const result = await fetchJSON(API_URL);

        if (!result?.data || !Array.isArray(result.data)) {
            throw new Error("Kết quả API không hợp lệ");
        }

        const banks = result.data;

        // Tạo folder logos nếu chưa có
        if (!fs.existsSync(LOGO_DIR)) {
            fs.mkdirSync(LOGO_DIR);
        }

        console.log(`[i] Co tong cong ${banks.length} ngan hang. Bat dau tai logo...`);

        // Lưu dữ liệu chuẩn hóa
        const cleanData = [];

        for (const bank of banks) {
            const fileExt = path.extname(bank.logo) || ".png";
            const filename = `${bank.code}${fileExt}`;
            const filepath = `${LOGO_DIR}/${filename}`;

            try {
                await downloadImage(bank.logo, filepath);
                console.log(`[+] Tai logo: ${filename}`);
            } catch (err) {
                console.log(`[x] Loi tai logo ${bank.code}: ${err}`);
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

        fs.writeFileSync("banks.json", JSON.stringify(cleanData, null, 4), "utf8");
        console.log("[+] Da tao file banks.json");

        console.log("\n[+] Hoan tat! Toan bo logo da tai ve thu muc /logos");

    } catch (err) {
        console.error("[x] Loi:", err.message);
    }
}

run();
