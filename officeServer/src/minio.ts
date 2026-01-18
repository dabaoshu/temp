/**
 * MinIO 客户端管理模块
 * 处理所有 MinIO 相关的操作，包括文件上传、下载、URL 生成等
 */

import * as Minio from "minio";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

// MinIO 配置接口
export interface MinioConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  usePresignedUrl: boolean;
  presignedUrlExpiry: number;
}

// MinIO 客户端实例
let minioClient: Minio.Client | null = null;
let bucketName: string = "documents";

/**
 * 初始化 MinIO 客户端
 * @param config MinIO 配置
 * @returns MinIO 客户端实例，如果配置不完整则返回 null
 */
export function initMinioClient(config: MinioConfig): Minio.Client | null {
  try {
    if (!config.endpoint || !config.accessKey || !config.secretKey) {
      console.warn("MinIO 配置不完整，将使用本地文件系统");
      return null;
    }

    // 从 endpoint 中提取纯主机名或 IP 地址（移除协议前缀）
    const client = new Minio.Client({
      endPoint: config.endpoint,
      port: config.port || 9000,
      useSSL: config.useSSL || false,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });

    // 保存客户端实例和存储桶名称
    minioClient = client;
    bucketName = config.bucket || "documents";

    // 确保存储桶存在
    client
      .bucketExists(bucketName)
      .then((exists) => {
        if (!exists) {
          return client.makeBucket(bucketName, "us-east-1");
        }
      })
      .then(() => {
        console.log(`MinIO 存储桶 "${bucketName}" 已就绪`);
      })
      .catch((err) => {
        console.error("MinIO 初始化失败:", err);
      });

    return client;
  } catch (error) {
    console.error("初始化 MinIO 客户端失败:", error);
    return null;
  }
}

/**
 * 获取 MinIO 客户端实例
 * @returns MinIO 客户端实例，如果未初始化则返回 null
 */
export function getMinioClient(): Minio.Client | null {
  return minioClient;
}

/**
 * 检查 MinIO 客户端是否可用
 * @returns 如果客户端已初始化且可用返回 true，否则返回 false
 */
export function isMinioAvailable(): boolean {
  return minioClient !== null;
}

/**
 * 获取存储桶名称
 * @returns 存储桶名称
 */
export function getBucketName(): string {
  return bucketName;
}

/**
 * 上传文件到 MinIO
 * @param objectName - 对象名称（文件路径）
 * @param fileBuffer - 文件内容
 * @param config - MinIO 配置
 * @returns 文件 URL
 */
export async function uploadToMinio(
  objectName: string,
  fileBuffer: Buffer,
  config: MinioConfig
): Promise<string> {
  if (!minioClient) {
    throw new Error("MinIO 客户端未初始化");
  }

  try {
    await minioClient.putObject(bucketName, objectName, fileBuffer);
    const protocol = config.useSSL ? "https" : "http";
    const port = config.port || 9000;
    const endpoint = config.endpoint;

    // 返回内部访问 URL（用于 OnlyOffice 访问）
    return `${protocol}://${endpoint}:${port}/${bucketName}/${objectName}`;
  } catch (error) {
    console.error("上传文件到 MinIO 失败:", error);
    throw error;
  }
}

/**
 * 从 MinIO 获取文件 URL
 * @param objectName - 对象名称（文件路径）
 * @param config - MinIO 配置
 * @returns 文件 URL
 */
export function getMinioFileUrl(
  objectName: string,
  config: MinioConfig
): string {
  if (!minioClient) {
    throw new Error("MinIO 客户端未初始化");
  }

  const protocol = config.useSSL ? "https" : "http";
  const port = config.port || 9000;
  const endpoint = config.endpoint;
  const url = `${protocol}://${endpoint}:${port}/${bucketName}/${objectName}`;
  console.log("getMinioFileUrl:", url);
  // 返回内部访问 URL（用于 OnlyOffice 访问）
  return url;
}

/**
 * 从 MinIO 获取预签名 URL（带签名，有效期可配置）
 * @param objectName - 对象名称（文件路径）
 * @param config - MinIO 配置
 * @param expiry - 过期时间（秒），如果未指定则从配置读取
 * @returns 签名 URL
 */
export async function getMinioPresignedUrl(
  objectName: string,
  config: MinioConfig,
  expiry: number | null = null
): Promise<string> {
  if (!minioClient) {
    throw new Error("MinIO 客户端未初始化");
  }

  try {
    // 如果未指定有效期，从配置中读取
    if (expiry === null) {
      expiry = config.presignedUrlExpiry || 7 * 24 * 60 * 60;
    }

    const url = await minioClient.presignedGetObject(
      bucketName,
      objectName,
      expiry
    );
    console.log(
      "getMinioPresignedUrl:decodeURIComponent",
      decodeURIComponent(url)
    );
    console.log("getMinioPresignedUrl:", url);

    return url;
  } catch (error) {
    console.error("获取 MinIO 签名 URL 失败:", error);
    throw error;
  }
}

/**
 * 检查文件是否存在
 * @param objectName - 对象名称（文件路径）
 * @returns Promise<boolean> 文件是否存在
 */
export async function fileExists(objectName: string): Promise<boolean> {
  if (!minioClient) {
    return false;
  }

  try {
    await minioClient.statObject(bucketName, objectName);
    return true;
  } catch (error: any) {
    if (error.code === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * 获取文件信息
 * @param objectName - 对象名称（文件路径）
 * @returns Promise<Object> 文件信息
 */
export async function getFileInfo(objectName: string): Promise<any> {
  if (!minioClient) {
    throw new Error("MinIO 客户端未初始化");
  }

  try {
    return await minioClient.statObject(bucketName, objectName);
  } catch (error) {
    console.error("获取文件信息失败:", error);
    throw error;
  }
}

/**
 * 删除文件
 * @param objectName - 对象名称（文件路径）
 * @returns Promise<void>
 */
export async function deleteFile(objectName: string): Promise<void> {
  if (!minioClient) {
    throw new Error("MinIO 客户端未初始化");
  }

  try {
    await minioClient.removeObject(bucketName, objectName);
  } catch (error) {
    console.error("删除文件失败:", error);
    throw error;
  }
}

/**
 * 从 URL 下载文件
 * @param url - 文件下载地址
 * @returns Promise<Buffer> 文件内容
 */
export async function downloadFileFromUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === "https:" ? https : http;

    client
      .get(url, (response) => {
        // 检查 HTTP 状态码
        if (response.statusCode && response.statusCode >= 400) {
          reject(
            new Error(
              `下载失败: HTTP ${response.statusCode} ${response.statusMessage}`
            )
          );
          return;
        }

        // 处理重定向
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          // 递归处理重定向
          return downloadFileFromUrl(response.headers.location)
            .then(resolve)
            .catch(reject);
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * 下载文档并保存到 MinIO 或本地文件系统
 * 从 OnlyOffice 服务器下载保存的文档并上传到 MinIO
 * @param url - 文档下载地址
 * @param config - MinIO 配置
 * @param downloadPath - 本地下载路径（当 MinIO 不可用时使用）
 * @param fileUrl - 文件名或文件路径（可选）
 * @returns Promise<string> 保存的文件 URL 或路径
 */
export async function downloadAndSaveDocument(
  url: string,
  config: MinioConfig,
  downloadPath: string = "./downloads",
  fileUrl?: string
): Promise<string> {
  try {
    // 如果提供了 fileUrl，使用它作为文件名，否则使用时间戳生成文件名
    let objectName: string;
    if (fileUrl) {
      // 从 fileUrl 中提取文件名，如果 fileUrl 是完整路径，只取文件名部分
      objectName = path.basename(fileUrl) || `document_${Date.now()}.docx`;
    } else {
      objectName = `document_${Date.now()}.docx`;
    }

    // 确保对象名称以时间戳为前缀，避免覆盖
    const timestamp = Date.now();
    // objectName = `${timestamp}_${objectName}`;
    // objectName = `${timestamp}_${objectName}`;

    // 从 URL 下载文件
    const fileBuffer = await downloadFileFromUrl(url);

    // 如果 MinIO 可用，上传到 MinIO
    if (minioClient) {
      const uploadedUrl = await uploadToMinio(objectName, fileBuffer, config);
      return uploadedUrl;
    } else {
      // 否则保存到本地文件系统
      const absoluteDownloadPath = path.isAbsolute(downloadPath)
        ? downloadPath
        : path.join(process.cwd(), downloadPath);

      if (!fs.existsSync(absoluteDownloadPath)) {
        fs.mkdirSync(absoluteDownloadPath, { recursive: true });
        console.log("创建下载目录:", absoluteDownloadPath);
      }

      const filepath = path.join(absoluteDownloadPath, objectName);
      fs.writeFileSync(filepath, fileBuffer);
      console.log("文档已保存到本地:", filepath);
      return filepath;
    }
  } catch (error) {
    console.error("下载并保存文档时出错:", error);
    throw error;
  }
}
