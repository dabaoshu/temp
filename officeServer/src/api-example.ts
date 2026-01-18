// OnlyOffice API 接口示例
// 这是一个 Node.js Express 示例，展示如何处理 OnlyOffice 回调
// 支持从 config.json 读取配置信息

import express, { Request, Response } from "express";
import path from "path";
import jwt from "jsonwebtoken";
import cors from "cors";
import {
  success,
  badRequest,
  notFound,
  serverError,
  ApiResponse,
} from "./responseUtils";
import {
  initMinioClient,
  isMinioAvailable,
  getMinioFileUrl,
  getMinioPresignedUrl,
  downloadAndSaveDocument,
  fileExists,
} from "./minio";
import {
  config,
  JWT_SECRET,
  type AppConfig,
  type DocumentPermissions,
  type DocumentCustomization,
  type User,
  type FileTypes,
} from "./config";

const app = express();

interface ConfigRequest {
  fileId: string;
  userId?: string;
  userName?: string;
  mode?: string;
  permissions?: DocumentPermissions;
}

interface CallbackRequest {
  status: number;
  url?: string;
  key?: string;
  users?: any[];
  actions?: any[];
  fileUrl?: string;
}

// 配置 CORS
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // 允许所有来源（开发环境）
    // 生产环境建议配置具体的域名
    // if (!origin || process.env.NODE_ENV !== "production") {
    //   callback(null, true);
    // } else {
    //   // 生产环境可以配置允许的域名列表3333为onlyoffice的端口
    //   // 8000为前端端口
    //   const allowedOrigins = process.env.ALLOWED_ORIGINS
    //     ? process.env.ALLOWED_ORIGINS.split(",")
    //     : ["http://localhost:3333", "http://localhost:8000"];

    //   if (allowedOrigins.indexOf(origin) !== -1) {
    //     callback(null, true);
    //   } else {
    //     callback(new Error("不允许的 CORS 来源"));
    //   }
    // }
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
  ],
  exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// 应用 CORS 中间件
app.use(cors(corsOptions));

// 显式处理 OPTIONS 预检请求（作为额外保障）
app.options("*", cors(corsOptions));
app.use(express.json());

// 初始化 MinIO 客户端
initMinioClient(config.minio);

/**
 * OnlyOffice 回调接口
 * 处理文档保存、状态更新等事件
 */
app.post(
  "/onlyofficeServer/onlyoffice/callback",
  async (req: Request<{}, ApiResponse, CallbackRequest>, res: Response) => {
    try {
      const { status, key, users, actions, url } = req.body;
      console.log(req.query);
      console.log("收到 OnlyOffice 回调:", status, req.body, {
        status,
        key,
        users,
        actions,
      });
      const { fileUrl, downUrl } = req.query as {
        fileUrl: string;
        downUrl: string;
      };

      // 处理不同状态
      switch (status) {
        case 0:
          // 文档未找到
          console.log("文档未找到");
          break;

        case 1:
          // 文档正在编辑
          console.log("文档正在编辑中");
          break;

        case 2:
          // 编辑时回调
          // debugger;
          // // 文档准备保存
          // console.log("文档准备保存，URL:", downUrl, "文件URL:", fileUrl);
          // // 下载文档并保存到 MinIO 或本地文件系统
          // if (downUrl) {
          //   downloadAndSaveDocument(
          //     downUrl,
          //     config.minio,
          //     config.document.downloadPath,
          //     fileUrl
          //   ).catch((err) => {
          //     console.error("保存文档失败:", err);
          //   });
          // }
          break;

        case 3:
          // 文档保存错误
          console.error("文档保存错误");
          break;

        case 4:
          // 文档关闭，没有变化
          console.log("文档已关闭，无变化");
          break;

        case 6:
          // 文档正在保存
          console.log("文档正在保存中");
          const newUrl = url?.replace(
            config.onlyoffice.documentServerUrl,
            "http://" + config.onlyoffice.host
          );

          console.log("newUrl:", newUrl);
          console.log(
            "config.onlyoffice.documentServerUrl:",
            config.onlyoffice.documentServerUrl
          );
          if (downUrl) {
            const u = await downloadAndSaveDocument(
              newUrl,
              config.minio,
              config.document.downloadPath,
              fileUrl
            ).catch((err) => {
              console.error("保存文档失败:", err);
            });
            console.log("保存文档成功:", u);
          }
          break;

        case 7:
          // 文档保存失败
          console.error("文档保存失败");
          break;

        default:
          console.log("未知状态:", status);
      }

      // 返回成功响应
      res.json({ error: 0 });
    } catch (error: any) {
      console.error("处理回调时出错:", error);
      res.status(500).json(serverError(error.message));
    }
  }
);

/**
 * 生成文档密钥
 * 生成唯一的文档标识符
 */
function generateDocumentKey(): string {
  return "k" + Date.now() + Math.random().toString(36).substr(2, 9);
}

/**
 * 生成 JWT Token
 * 用于 OnlyOffice 文档编辑器的身份验证
 * @param {Object} editorConfig - Token 载荷
 * @param {number} expiresIn - 过期时间（秒），默认 1 小时
 * @returns {string} JWT Token
 */
function generateJWTToken(editorConfig: any, expiresIn: number = 3600): string {
  try {
    return jwt.sign(editorConfig, JWT_SECRET, {
      algorithm: (config.jwt.algorithm || "HS256") as jwt.Algorithm,
      expiresIn: expiresIn,
    });
  } catch (error) {
    console.error("生成 JWT Token 失败:", error);
    throw error;
  }
}

/**
 * 验证 JWT Token
 * 使用配置中的 JWT 密钥验证 token
 * @param {string} token - 需要验证的 token
 * @returns {Object|null} - 验证结果（解码后的载荷）
 */
function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: [(config.jwt.algorithm || "HS256") as jwt.Algorithm],
    });
  } catch (error) {
    console.error("验证 token 失败:", error);
    return null;
  }
}

/**
 * 获取文档类型
 * 根据文件扩展名返回 OnlyOffice 文档类型
 * @param {string} fileType - 文件扩展名（如 docx, xlsx, pptx）
 * @returns {string} - OnlyOffice 文档类型（word, cell, slide）
 */
function getDocumentType(fileType: string): string {
  const fileTypes = config.fileTypes || {};
  return fileTypes[fileType as keyof FileTypes] || "word";
}

/**
 * 获取 OnlyOffice 编辑器配置接口
 * 返回完整的编辑器配置供前端使用
 *
 * 请求参数：
 * - documentId: 文档 ID 或文件路径（在 MinIO 中的对象名称）
 * - userId: 用户 ID
 * - userName: 用户名称
 * - mode: 编辑模式（edit/view/review/comment/fillForms/embedded）
 * - permissions: 权限配置（可选，覆盖默认权限）
 */
app.post(
  "/onlyofficeServer/onlyoffice/config",
  async (req: Request<{}, ApiResponse, ConfigRequest>, res: Response) => {
    try {
      const { fileId, userId, userName, mode = "view", permissions } = req.body;
      console.log("fileId", req.body.mode);
      if (!fileId) {
        return res.status(400).json(badRequest("文档名不能为空"));
      }

      // 从文件扩展名推断文件类型
      const fileExtension =
        path.extname(fileId).toLowerCase().substring(1) || "docx";
      const documentType = getDocumentType(fileExtension);

      // 生成文档密钥
      const documentKey = generateDocumentKey();

      // 获取文档 URL（从 MinIO 或配置的文档服务器）
      let documentUrl: string;
      if (isMinioAvailable()) {
        try {
          const minioConfig = config.minio;
          // 如果配置了使用预签名 URL（私有 MinIO 必须使用），则生成预签名 URL
          if (minioConfig.usePresignedUrl !== false) {
            documentUrl = await getMinioPresignedUrl(fileId, minioConfig);
            console.log("使用预签名 URL 访问 MinIO 文件:", fileId, documentUrl);
          } else {
            // 否则使用内部 URL（仅适用于公开的 MinIO）
            documentUrl = getMinioFileUrl(fileId, minioConfig);
            console.log("使用内部 URL 访问 MinIO 文件:", fileId, documentUrl);
          }
        } catch (error: any) {
          console.error("获取 MinIO 文件 URL 失败:", error);
          return res.status(404).json(notFound("文档不存在或无法访问"));
        }
      } else {
        // 如果没有 MinIO，使用配置中的文档服务器 URL
        documentUrl = `${config.onlyoffice.documentServerUrl}/${config.minio.bucket}/${fileId}`;
      }

      // 获取默认权限和自定义设置
      const defaultPermissions = (config.document.defaultPermissions ||
        {}) as DocumentPermissions;
      const defaultCustomization = (config.document.defaultCustomization ||
        {}) as DocumentCustomization;
      const callbackUrl = `${config.onlyoffice.callbackUrl}?downUrl=${documentUrl}&fileUrl=${encodeURIComponent(fileId)}`;
      const defaultLang = config.onlyoffice.defaultLang || "zh-CN";
      const documentServerUrl = config.onlyoffice.documentServerUrl;

      // 根据 mode 决定是否可编辑（如果未明确指定 permissions.edit）
      // mode === "edit" 时允许编辑，其他模式不允许编辑
      const isEditMode = mode === "edit";
      const canEdit =
        permissions?.edit !== undefined
          ? permissions.edit
          : isEditMode
            ? true
            : defaultPermissions.edit !== undefined
              ? defaultPermissions.edit
              : false;

      // 构建编辑器配置
      const editorConfig = {
        document: {
          height: "100%",
          width: "100%",
          type: "desktop",
          fileType: fileExtension,
          key: documentKey,
          title: path.basename(fileId),
          url: documentUrl,
          permissions: {
            edit: canEdit,
            download:
              permissions?.download !== undefined
                ? permissions.download
                : defaultPermissions.download !== undefined
                  ? defaultPermissions.download
                  : true,
            print:
              permissions?.print !== undefined
                ? permissions.print
                : defaultPermissions.print !== undefined
                  ? defaultPermissions.print
                  : true,
            review:
              permissions?.review !== undefined
                ? permissions.review
                : defaultPermissions.review !== undefined
                  ? defaultPermissions.review
                  : true,
            comment:
              permissions?.comment !== undefined
                ? permissions.comment
                : defaultPermissions.comment !== undefined
                  ? defaultPermissions.comment
                  : true,
            chat:
              permissions?.chat !== undefined
                ? permissions.chat
                : defaultPermissions.chat !== undefined
                  ? defaultPermissions.chat
                  : true,
          },
        },
        documentType: documentType,
        editorConfig: {
          mode: mode,
          lang: defaultLang,
          callbackUrl: callbackUrl,
          user: {
            id: userId || "anonymous",
            name: userName || "匿名用户",
          },
          customization: {
            feedback:
              defaultCustomization.feedback !== undefined
                ? defaultCustomization.feedback
                : false,
            forcesave:
              defaultCustomization.forcesave !== undefined
                ? defaultCustomization.forcesave
                : true,
            submitForm:
              defaultCustomization.submitForm !== undefined
                ? defaultCustomization.submitForm
                : true,
          },
        },
      } as any;

      // 生成 JWT Token（如果启用了 JWT）
      let token: string | null = null;
      if (
        JWT_SECRET &&
        JWT_SECRET !== "your_jwt_secret_key_here" &&
        JWT_SECRET.length > 10
      ) {
        try {
          // const tokenPayload = {
          //   key: documentKey,
          //   user: {
          //     id: userId || "anonymous",
          //     name: userName || "匿名用户",
          //   },
          // };
          token = generateJWTToken(editorConfig);
          editorConfig.token = token;
        } catch (error) {
          console.error("生成 JWT Token 失败:", error);
        }
      }

      res.json(
        success(
          {
            config: editorConfig,
            token: token,
            documentServerUrl: documentServerUrl,
          },
          "编辑器配置获取成功"
        )
      );
    } catch (error: any) {
      console.error("获取编辑器配置失败:", error);
      res.status(500).json(serverError(error.message));
    }
  }
);

/**
 * 测试接口：获取 MinIO 预签名 URL
 * 用于本地测试 getMinioPresignedUrl 方法
 *
 * GET onlyofficeServer/test/presigned-url?file=文件名
 * 或
 * POST onlyofficeServer/test/presigned-url
 * Body: { "file": "文件名", "expiry": 过期时间（秒，可选） }
 */
app.get(
  "/onlyofficeServer/test/presigned-url",
  async (req: Request, res: Response) => {
    try {
      const { file, expiry } = req.query;

      if (!file || typeof file !== "string") {
        return res
          .status(400)
          .json(
            badRequest(
              "请提供文件名参数，例如: onlyofficeServer/test/presigned-url?file=test.docx"
            )
          );
      }

      if (!isMinioAvailable()) {
        return res
          .status(500)
          .json(serverError("MinIO 客户端未初始化，请检查配置"));
      }

      // 检查文件是否存在
      const exists = await fileExists(file);
      if (!exists) {
        return res.status(404).json(
          notFound(`文件 "${file}" 在 MinIO 中不存在`, {
            tip: "请先上传文件到 MinIO 存储桶",
          })
        );
      }

      // 生成预签名 URL
      const expirySeconds = expiry ? parseInt(expiry as string) : null;
      const presignedUrl = await getMinioPresignedUrl(
        file,
        config.minio,
        expirySeconds
      );

      res.json(
        success(
          {
            file: file,
            presignedUrl: presignedUrl,
            expiry:
              expirySeconds ||
              config.minio?.presignedUrlExpiry ||
              7 * 24 * 60 * 60,
            expiryHours:
              (expirySeconds ||
                config.minio?.presignedUrlExpiry ||
                7 * 24 * 60 * 60) / 3600,
            tip: "您可以在浏览器中打开此 URL 来测试文件访问",
          },
          "预签名 URL 生成成功"
        )
      );
    } catch (error: any) {
      console.error("测试预签名 URL 失败:", error);
      res.status(500).json(serverError(error.message));
    }
  }
);

app.post(
  "/onlyofficeServer/test/presigned-url",
  async (
    req: Request<{}, ApiResponse, { file?: string; expiry?: number }>,
    res: Response
  ) => {
    try {
      const { file, expiry } = req.body;

      if (!file) {
        return res
          .status(400)
          .json(badRequest('请提供文件名，例如: { "file": "test.docx" }'));
      }

      if (!isMinioAvailable()) {
        return res
          .status(500)
          .json(serverError("MinIO 客户端未初始化，请检查配置"));
      }

      // 检查文件是否存在
      const exists = await fileExists(file);
      if (!exists) {
        return res.status(404).json(
          notFound(`文件 "${file}" 在 MinIO 中不存在`, {
            tip: "请先上传文件到 MinIO 存储桶",
          })
        );
      }

      // 生成预签名 URL
      const expirySeconds = expiry ? parseInt(expiry.toString()) : null;
      const presignedUrl = await getMinioPresignedUrl(
        file,
        config.minio,
        expirySeconds
      );

      res.json(
        success(
          {
            file: file,
            presignedUrl: presignedUrl,
            expiry:
              expirySeconds ||
              config.minio?.presignedUrlExpiry ||
              7 * 24 * 60 * 60,
            expiryHours:
              (expirySeconds ||
                config.minio?.presignedUrlExpiry ||
                7 * 24 * 60 * 60) / 3600,
            tip: "您可以在浏览器中打开此 URL 来测试文件访问",
          },
          "预签名 URL 生成成功"
        )
      );
    } catch (error: any) {
      console.error("测试预签名 URL 失败:", error);
      res.status(500).json(serverError(error.message));
    }
  }
);

/**
 * 健康检查接口
 * 用于 Docker 健康检查和监控
 */
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "onlyoffice-api-server",
  });
});

// 从配置中获取服务器端口和主机
const PORT = process.env.PORT
  ? parseInt(process.env.PORT)
  : config.server.port || 3001;
const HOST = process.env.HOST || config.server.host || "0.0.0.0";

const os = require("os");
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (Array.isArray(iface)) {
      for (const addr of iface) {
        if (addr.family === "IPv4" && !addr.internal) {
          return addr.address;
        }
      }
    }
  }
  return "127.0.0.1";
}

// 启动服务器
app.listen(PORT, HOST, () => {
  console.log(`OnlyOffice API 服务器运行在 ${HOST}:${PORT}`);
  console.log("配置文件已加载，JWT 密钥:", JWT_SECRET ? "已设置" : "未设置");
  console.log("测试接口:");
  console.log(
    `  GET  http://localhost:${PORT}/onlyofficeServer/test/presigned-url?file=文件名`
  );
  console.log(
    `  POST http://localhost:${PORT}/onlyofficeServer/test/presigned-url`
  );
  const serverIP = getLocalIP();
  console.log(`当前服务器 IP 地址: ${serverIP}`);

  // 获取并打印当前服务器的 IP 地址
});
