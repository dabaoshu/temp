const crypto = require("crypto");

// 生成一个安全的随机字节串
const secretKey = crypto.randomBytes(32).toString("base64");

console.log("JWT SECRET:", secretKey);
