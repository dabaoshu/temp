FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装所有依赖（包括 devDependencies，因为需要 TypeScript 编译）
RUN npm install

# 复制 TypeScript 配置文件和源代码
COPY tsconfig.json ./
COPY src/ ./src/

# 复制配置文件（运行时需要）
COPY config.json ./
COPY default.config.json* ./

# 编译 TypeScript 代码
RUN npm run build

# 将配置文件复制到 dist 目录（编译后的代码从 __dirname 读取）
RUN cp config.json dist/ 2>/dev/null || true
RUN cp default.config.json dist/ 2>/dev/null || true

# 暴露端口
EXPOSE 3001

# 启动应用（使用编译后的 JavaScript）
CMD ["node", "dist/api-example.js"]
