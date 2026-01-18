const crypto = require("crypto");

// 生成一个安全的随机字节串
const secretKey = crypto.randomBytes(32).toString("base64");

console.log("JWT SECRET:", secretKey);

// docker cp 18b4a31ec93f:/etc/onlyoffice/documentserver/local.json  ./local.json 


docker run -d --name minio -p 9990:9000 -p 9090:9090 -v /home/minio/data:/data   -e "MINIO_ROOT_USER=admin"  -e "MINIO_ROOT_PASSWORD=Gtmap@123"  -e "MINIO_BROWSER=on" minio/minio:RELEASE.2025-04-22T22-12-26Z server /data --console-address ":9090"
