docker cp 6b0e9001ebd3:/etc/onlyoffice/documentserver/nginx/ds.conf ./ds.conf
docker cp 6b0e9001ebd3://etc/onlyoffice/documentserver/nginx/includes/ds-docservice.conf ./ds-docservice.conf


1. 修改 ds-docservice.conf
bash
复制
# 进入容器或服务器
vim /etc/onlyoffice/documentserver/nginx/includes/ds-docservice.conf

# 修改第2-3行（脚本缓存保护）
rewrite ^(?<cache>\/web-apps\/apps\/(?!api\/).*)$ $the_scheme://$the_host$the_prefix/onlyoffice/8.1.x$cache redirect;

# 修改第69-71行，添加子路径location
location ^~ /onlyoffice {
  proxy_pass http://docservice;
}
2. 外部 Nginx 反向代理配置
nginx
复制
location ^~ /onlyoffice {
    proxy_pass http://127.0.0.1:8082/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    add_header Cache-Control no-cache;
}

# 缓存文件代理
location ^~ /cache/ {
    proxy_pass http://127.0.0.1:8082/cache/;
    # 相同头部配置...
}



<!-- 外部 -->
Nginx 子目录代理 ONLYOFFICE 配置（可用示例）
子目录部署需要你在前一层的代理服务器上配置转发规则，并携带关键头部信息。
只需增加 proxy_set_header X-Forwarded-Prefix /myeditor（根据实际配置,以下三处myeditor保持一致） ;具体如下：
ini 体验AI代码助手 代码解读复制代码
location /myeditor/ {

proxy_pass http://127.0.0.1:9000/;

# 代理头设置

proxy_set_header X-Forwarded-Prefix /myeditor;

proxy_set_header Host $host;

proxy_set_header X-Real-IP $remote_addr;

proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

proxy_set_header REMOTE-HOST $remote_addr;

proxy_set_header X-Forwarded-Proto $scheme;

proxy_set_header X-Forwarded-Port $server_port;

proxy_set_header X-Forwarded-Host $host;

# Websocket 支持

proxy_set_header Upgrade $http_upgrade;

proxy_set_header Connection "upgrade";

proxy_http_version 1.1;

# 超时设置

proxy_read_timeout 3600s;

proxy_send_timeout 3600s;

proxy_connect_timeout 60s;

# 缓冲和重定向

proxy_buffering off;

proxy_redirect off;

# Cookie 路径处理 - 如果后端应用需要

# proxy_cookie_path / /myeditor/;

# 缓存头

add_header X-Cache $upstream_cache_status;

add_header Cache-Control no-cache;

# SSL 相关

proxy_ssl_server_name on;

proxy_ssl_verify off;

}
