function tlv(tag, value) {
    const len = Buffer.byteLength(value, "utf8"); // chuẩn EMV: tính theo byte
    const length = len.toString().padStart(2, "0");
    return `${tag}${length}${value}`;
}

module.exports = { tlv };
