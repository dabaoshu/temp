/**
 * 配置管理模块
 * 处理配置文件的加载、默认配置和环境变量覆盖
 */

import fs from "fs";
import path from "path";
import { MinioConfig } from "./minio";

// 配置类型定义
export interface ServerConfig {
  port: number;
  host: string;
}

export interface JWTConfig {
  secret: string;
  algorithm: string;
}

export interface OnlyOfficeConfig {
  callbackUrl?: string;
  defaultLang: string;
  documentServerUrl: string;
  port: number;
  host: string;
}

export interface DocumentPermissions {
  edit: boolean;
  download: boolean;
  print: boolean;
  review: boolean;
  comment: boolean;
  chat: boolean;
}

export interface DocumentCustomization {
  comments: boolean;
  feedback: boolean;
  forcesave: boolean;
  submitForm: boolean;
}

export interface DocumentConfig {
  downloadPath: string;
  defaultPermissions: DocumentPermissions;
  defaultCustomization: DocumentCustomization;
}

export interface FileTypes {
  docx: string;
  xlsx: string;
  pptx: string;
}

export interface User {
  id: string;
  name: string;
}

export interface AppConfig {
  server: ServerConfig;
  jwt: JWTConfig;
  onlyoffice: OnlyOfficeConfig;
  minio: MinioConfig;
  document: DocumentConfig;
  fileTypes: FileTypes;
}

/**
 * 获取默认配置
 * 当配置文件不存在或加载失败时使用
 */
function getDefaultConfig(): AppConfig {
  return {
    server: {
      port: 3001,
      host: "0.0.0.0",
    },
    jwt: {
      secret: process.env.JWT_SECRET || "your_jwt_secret_key_here",
      algorithm: "HS256",
    },
    onlyoffice: {
      callbackUrl: process.env.ONLYOFFICE_CALLBACK_URL,
      documentServerUrl: process.env.ONLYOFFICE_DOCUMENT_SERVER_URL,
      port: 3333,
      host: "onlyoffice",
      defaultLang: "zh-CN",
    },
    minio: {
      endpoint: "minio",
      port: 9000,
      useSSL: false,
      accessKey: "minioadmin",
      secretKey: "minioadmin",
      bucket: "documents",
      usePresignedUrl: true, // 是否使用预签名 URL（私有 MinIO 必须启用）
      presignedUrlExpiry: 7 * 24 * 60 * 60, // 预签名 URL 有效期（秒），默认 7 天
    },
    document: {
      downloadPath: "./downloads",
      defaultPermissions: {
        edit: true,
        download: true,
        print: true,
        review: true,
        comment: true,
        chat: true,
      },
      defaultCustomization: {
        comments: true,
        feedback: false,
        forcesave: true,
        submitForm: true,
      },
    },
    fileTypes: {
      docx: "word",
      xlsx: "cell",
      pptx: "slide",
    },
  };
}

/**
 * 加载配置文件
 * 从 config.json 读取配置信息，如果文件不存在则使用默认配置
 */
function loadConfig(): AppConfig {
  // 配置文件在项目根目录，编译后在 dist 目录，需要向上查找
  const configPath = path.join(__dirname, "..", "config.json");

  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, "utf8");
      const config = JSON.parse(configData) as AppConfig;
      console.log("配置文件加载成功:", configPath);
      return config;
    } else {
      console.warn("配置文件不存在，使用默认配置:", configPath);
      return getDefaultConfig();
    }
  } catch (error: any) {
    console.error("加载配置文件失败，使用默认配置:", error.message);
    return getDefaultConfig();
  }
}

// 加载配置
let config = loadConfig();

// 从环境变量或配置中获取 JWT 密钥（优先使用环境变量）
export const JWT_SECRET = process.env.JWT_SECRET || config.jwt.secret;

// 如果从环境变量读取到配置，更新配置对象
if (process.env.JWT_SECRET) {
  config.jwt.secret = process.env.JWT_SECRET;
}

// 导出配置对象
export { config };
