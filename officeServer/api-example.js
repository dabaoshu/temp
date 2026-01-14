// OnlyOffice API 接口示例
// 这是一个 Node.js Express 示例，展示如何处理 OnlyOffice 回调
// 支持从 config.json 读取配置信息

const express = require('express')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const https = require('https')
const Minio = require('minio')
const jwt = require('jsonwebtoken')
const app = express()

app.use(express.json())

/**
 * 加载配置文件
 * 从 config.json 读取配置信息，如果文件不存在则使用默认配置
 */
function loadConfig() {
  const configPath = path.join(__dirname, 'config.json')
  
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(configData)
      console.log('配置文件加载成功:', configPath)
      return config
    } else {
      console.warn('配置文件不存在，使用默认配置:', configPath)
      return getDefaultConfig()
    }
  } catch (error) {
    console.error('加载配置文件失败，使用默认配置:', error.message)
    return getDefaultConfig()
  }
}

/**
 * 获取默认配置
 * 当配置文件不存在或加载失败时使用
 */
function getDefaultConfig() {
  return {
    server: {
      port: 3001,
      host: '0.0.0.0'
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      algorithm: 'HS256'
    },
    onlyoffice: {
      callbackUrl: process.env.ONLYOFFICE_CALLBACK_URL || 'http://api-server:3001/api/onlyoffice/callback',
      documentServerUrl: process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || 'http://localhost:3333',
      defaultLang: 'zh-CN'
    },
    minio: {
      endpoint: 'minio',
      port: 9000,
      useSSL: false,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
      bucket: 'documents'
    },
    document: {
      downloadPath: './downloads',
      defaultPermissions: {
        edit: true,
        download: true,
        print: true,
        review: true,
        comment: true
      },
      defaultCustomization: {
        chat: true,
        comments: true,
        feedback: false,
        forcesave: true,
        submitForm: true
      }
    },
    fileTypes: {
      docx: 'word',
      xlsx: 'cell',
      pptx: 'slide'
    }
  }
}

// 加载配置
const config = loadConfig()

// 从环境变量或配置中获取 JWT 密钥（优先使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || config.jwt.secret

// 如果从环境变量读取到配置，更新配置对象
if (process.env.JWT_SECRET) {
  config.jwt.secret = process.env.JWT_SECRET
}
if (process.env.ONLYOFFICE_CALLBACK_URL) {
  config.onlyoffice.callbackUrl = process.env.ONLYOFFICE_CALLBACK_URL
}
if (process.env.ONLYOFFICE_DOCUMENT_SERVER_URL) {
  config.onlyoffice.documentServerUrl = process.env.ONLYOFFICE_DOCUMENT_SERVER_URL
}

/**
 * 初始化 MinIO 客户端
 * @returns {Minio.Client|null} MinIO 客户端实例
 */
function initMinioClient() {
  try {
    const minioConfig = config.minio || {}
    if (!minioConfig.endpoint || !minioConfig.accessKey || !minioConfig.secretKey) {
      console.warn('MinIO 配置不完整，将使用本地文件系统')
      return null
    }

    const minioClient = new Minio.Client({
      endPoint: minioConfig.endpoint,
      port: minioConfig.port || 9000,
      useSSL: minioConfig.useSSL || false,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey
    })

    // 确保存储桶存在
    const bucketName = minioConfig.bucket || 'documents'
    minioClient.bucketExists(bucketName).then(exists => {
      if (!exists) {
        return minioClient.makeBucket(bucketName, 'us-east-1')
      }
    }).then(() => {
      console.log(`MinIO 存储桶 "${bucketName}" 已就绪`)
    }).catch(err => {
      console.error('MinIO 初始化失败:', err)
    })

    return minioClient
  } catch (error) {
    console.error('初始化 MinIO 客户端失败:', error)
    return null
  }
}

// 初始化 MinIO 客户端
const minioClient = initMinioClient()
const MINIO_BUCKET = (config.minio && config.minio.bucket) || 'documents'

/**
 * OnlyOffice 回调接口
 * 处理文档保存、状态更新等事件
 */
app.post('/api/onlyoffice/callback', (req, res) => {
  try {
    const { status, url, key, users, actions, fileUrl } = req.body
    
    console.log('收到 OnlyOffice 回调:', {
      status,
      key,
      users,
      actions,
      fileUrl
    })

    // 处理不同状态
    switch (status) {
      case 0:
        // 文档未找到
        console.log('文档未找到')
        break
        
      case 1:
        // 文档正在编辑
        console.log('文档正在编辑中')
        break
        
      case 2:
        // 文档准备保存
        console.log('文档准备保存，URL:', url, '文件URL:', fileUrl)
        // 下载文档并保存到 MinIO 或本地文件系统
        downloadDocument(url, fileUrl).catch(err => {
          console.error('保存文档失败:', err)
        })
        break
        
      case 3:
        // 文档保存错误
        console.error('文档保存错误')
        break
        
      case 4:
        // 文档关闭，没有变化
        console.log('文档已关闭，无变化')
        break
        
      case 6:
        // 文档正在保存
        console.log('文档正在保存中')
        break
        
      case 7:
        // 文档保存失败
        console.error('文档保存失败')
        break
        
      default:
        console.log('未知状态:', status)
    }


    

    // 返回成功响应
    res.json({ error: 0 })
    
  } catch (error) {
    console.error('处理回调时出错:', error)
    res.status(500).json({ error: 1, message: error.message })
  }
})

/**
 * 生成文档密钥
 * 生成唯一的文档标识符
 */
function generateDocumentKey() {
  return 'k' + Date.now() + Math.random().toString(36).substr(2, 9)
}

/**
 * 从 URL 下载文件到临时目录
 * @param {string} url - 文件下载地址
 * @returns {Promise<Buffer>} 文件内容
 */
async function downloadFileFromUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    }).on('error', reject)
  })
}

/**
 * 上传文件到 MinIO
 * @param {string} objectName - 对象名称（文件路径）
 * @param {Buffer} fileBuffer - 文件内容
 * @returns {Promise<string>} 文件 URL
 */
async function uploadToMinio(objectName, fileBuffer) {
  if (!minioClient) {
    throw new Error('MinIO 客户端未初始化')
  }

  try {
    await minioClient.putObject(MINIO_BUCKET, objectName, fileBuffer)
    const minioConfig = config.minio || {}
    const protocol = minioConfig.useSSL ? 'https' : 'http'
    const port = minioConfig.port || 9000
    const endpoint = minioConfig.endpoint || 'minio'
    
    // 返回内部访问 URL（用于 OnlyOffice 访问）
    return `${protocol}://${endpoint}:${port}/${MINIO_BUCKET}/${objectName}`
  } catch (error) {
    console.error('上传文件到 MinIO 失败:', error)
    throw error
  }
}

/**
 * 从 MinIO 获取文件 URL
 * @param {string} objectName - 对象名称（文件路径）
 * @returns {string} 文件 URL
 */
function getMinioFileUrl(objectName) {
  if (!minioClient) {
    throw new Error('MinIO 客户端未初始化')
  }

  const minioConfig = config.minio || {}
  const protocol = minioConfig.useSSL ? 'https' : 'http'
  const port = minioConfig.port || 9000
  const endpoint = minioConfig.endpoint || 'minio'
  
  // 返回内部访问 URL（用于 OnlyOffice 访问）
  return `${protocol}://${endpoint}:${port}/${MINIO_BUCKET}/${objectName}`
}

/**
 * 从 MinIO 获取公开访问 URL（带签名，有效期 7 天）
 * @param {string} objectName - 对象名称（文件路径）
 * @param {number} expiry - 过期时间（秒），默认 7 天
 * @returns {Promise<string>} 签名 URL
 */
async function getMinioPresignedUrl(objectName, expiry = 7 * 24 * 60 * 60) {
  if (!minioClient) {
    throw new Error('MinIO 客户端未初始化')
  }

  try {
    return await minioClient.presignedGetObject(MINIO_BUCKET, objectName, expiry)
  } catch (error) {
    console.error('获取 MinIO 签名 URL 失败:', error)
    throw error
  }
}

/**
 * 下载文档并保存到 MinIO
 * 从 OnlyOffice 服务器下载保存的文档并上传到 MinIO
 * @param {string} url - 文档下载地址
 * @param {string} fileUrl - 文件名或文件路径（可选）
 */
async function downloadDocument(url, fileUrl) {
  try {
    // 如果提供了 fileUrl，使用它作为文件名，否则使用时间戳生成文件名
    let objectName
    if (fileUrl) {
      // 从 fileUrl 中提取文件名，如果 fileUrl 是完整路径，只取文件名部分
      objectName = path.basename(fileUrl) || `document_${Date.now()}.docx`
    } else {
      objectName = `document_${Date.now()}.docx`
    }

    // 确保对象名称以时间戳为前缀，避免覆盖
    const timestamp = Date.now()
    objectName = `${timestamp}_${objectName}`

    // 从 URL 下载文件
    const fileBuffer = await downloadFileFromUrl(url)

    // 如果 MinIO 可用，上传到 MinIO
    if (minioClient) {
      const fileUrl = await uploadToMinio(objectName, fileBuffer)
      console.log('文档已保存到 MinIO:', fileUrl)
    } else {
      // 否则保存到本地文件系统
      const downloadPath = config.document.downloadPath || './downloads'
      const absoluteDownloadPath = path.isAbsolute(downloadPath) 
        ? downloadPath 
        : path.join(__dirname, downloadPath)

      if (!fs.existsSync(absoluteDownloadPath)) {
        fs.mkdirSync(absoluteDownloadPath, { recursive: true })
        console.log('创建下载目录:', absoluteDownloadPath)
      }

      const filepath = path.join(absoluteDownloadPath, objectName)
      fs.writeFileSync(filepath, fileBuffer)
      console.log('文档已保存到本地:', filepath)
    }
  } catch (error) {
    console.error('下载并保存文档时出错:', error)
  }
}

/**
 * 生成 JWT Token
 * 用于 OnlyOffice 文档编辑器的身份验证
 * @param {Object} payload - Token 载荷
 * @param {string} payload.key - 文档密钥
 * @param {Object} payload.user - 用户信息
 * @param {number} expiresIn - 过期时间（秒），默认 1 小时
 * @returns {string} JWT Token
 */
function generateJWTToken(payload, expiresIn = 3600) {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      algorithm: config.jwt.algorithm || 'HS256',
      expiresIn: expiresIn
    })
  } catch (error) {
    console.error('生成 JWT Token 失败:', error)
    throw error
  }
}

/**
 * 验证 JWT Token
 * 使用配置中的 JWT 密钥验证 token
 * @param {string} token - 需要验证的 token
 * @returns {Object|null} - 验证结果（解码后的载荷）
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: [config.jwt.algorithm || 'HS256']
    })
  } catch (error) {
    console.error('验证 token 失败:', error)
    return null
  }
}

/**
 * 创建文档配置
 * 根据请求参数和配置文件生成 OnlyOffice 编辑器配置
 */
app.post('/api/documents/create', (req, res) => {
  try {
    const { title, fileType, user, documentUrl } = req.body
    
    // 从配置中获取默认权限和自定义设置
    const defaultPermissions = config.document.defaultPermissions || {}
    const defaultCustomization = config.document.defaultCustomization || {}
    const callbackUrl = config.onlyoffice.callbackUrl
    const defaultLang = config.onlyoffice.defaultLang || 'zh-CN'
    
    const configResult = {
      document: {
        fileType: fileType || 'docx',
        key: generateDocumentKey(),
        title: title || '新建文档',
        url: documentUrl || 'https://your-server.com/documents/template.docx',
        permissions: {
          edit: defaultPermissions.edit !== undefined ? defaultPermissions.edit : true,
          download: defaultPermissions.download !== undefined ? defaultPermissions.download : true,
          print: defaultPermissions.print !== undefined ? defaultPermissions.print : true,
          review: defaultPermissions.review !== undefined ? defaultPermissions.review : true,
          comment: defaultPermissions.comment !== undefined ? defaultPermissions.comment : true
        }
      },
      documentType: getDocumentType(fileType),
      editorConfig: {
        mode: 'edit',
        lang: defaultLang,
        callbackUrl: callbackUrl,
        user: {
          id: user?.id || 'anonymous',
          name: user?.name || '匿名用户'
        },
        customization: {
          chat: defaultCustomization.chat !== undefined ? defaultCustomization.chat : true,
          comments: defaultCustomization.comments !== undefined ? defaultCustomization.comments : true,
          feedback: defaultCustomization.feedback !== undefined ? defaultCustomization.feedback : false,
          forcesave: defaultCustomization.forcesave !== undefined ? defaultCustomization.forcesave : true,
          submitForm: defaultCustomization.submitForm !== undefined ? defaultCustomization.submitForm : true
        }
      }
    }
    
    res.json({
      success: true,
      config: configResult
    })
    
  } catch (error) {
    console.error('创建文档配置失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取文档类型
 * 根据文件扩展名返回 OnlyOffice 文档类型
 * @param {string} fileType - 文件扩展名（如 docx, xlsx, pptx）
 * @returns {string} - OnlyOffice 文档类型（word, cell, slide）
 */
function getDocumentType(fileType) {
  const fileTypes = config.fileTypes || {}
  return fileTypes[fileType] || 'word'
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
app.post('/api/onlyoffice/config', async (req, res) => {
  try {
    const { documentId, userId, userName, mode = 'edit', permissions } = req.body

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: '文档 ID 不能为空'
      })
    }

    // 从文件扩展名推断文件类型
    const fileExtension = path.extname(documentId).toLowerCase().substring(1) || 'docx'
    const documentType = getDocumentType(fileExtension)

    // 生成文档密钥
    const documentKey = generateDocumentKey()

    // 获取文档 URL（从 MinIO 或配置的文档服务器）
    let documentUrl
    if (minioClient) {
      try {
        documentUrl = getMinioFileUrl(documentId)
      } catch (error) {
        console.error('获取 MinIO 文件 URL 失败:', error)
        return res.status(404).json({
          success: false,
          message: '文档不存在'
        })
      }
    } else {
      // 如果没有 MinIO，使用配置中的文档服务器 URL
      documentUrl = `${config.onlyoffice.documentServerUrl}/documents/${documentId}`
    }

    // 获取默认权限和自定义设置
    const defaultPermissions = config.document.defaultPermissions || {}
    const defaultCustomization = config.document.defaultCustomization || {}
    const callbackUrl = config.onlyoffice.callbackUrl
    const defaultLang = config.onlyoffice.defaultLang || 'zh-CN'
    const documentServerUrl = config.onlyoffice.documentServerUrl

    // 构建编辑器配置
    const editorConfig = {
      document: {
        fileType: fileExtension,
        key: documentKey,
        title: path.basename(documentId),
        url: documentUrl,
        permissions: {
          edit: permissions?.edit !== undefined ? permissions.edit : (defaultPermissions.edit !== undefined ? defaultPermissions.edit : true),
          download: permissions?.download !== undefined ? permissions.download : (defaultPermissions.download !== undefined ? defaultPermissions.download : true),
          print: permissions?.print !== undefined ? permissions.print : (defaultPermissions.print !== undefined ? defaultPermissions.print : true),
          review: permissions?.review !== undefined ? permissions.review : (defaultPermissions.review !== undefined ? defaultPermissions.review : true),
          comment: permissions?.comment !== undefined ? permissions.comment : (defaultPermissions.comment !== undefined ? defaultPermissions.comment : true)
        }
      },
      documentType: documentType,
      editorConfig: {
        mode: mode,
        lang: defaultLang,
        callbackUrl: callbackUrl,
        user: {
          id: userId || 'anonymous',
          name: userName || '匿名用户'
        },
        customization: {
          chat: defaultCustomization.chat !== undefined ? defaultCustomization.chat : true,
          comments: defaultCustomization.comments !== undefined ? defaultCustomization.comments : true,
          feedback: defaultCustomization.feedback !== undefined ? defaultCustomization.feedback : false,
          forcesave: defaultCustomization.forcesave !== undefined ? defaultCustomization.forcesave : true,
          submitForm: defaultCustomization.submitForm !== undefined ? defaultCustomization.submitForm : true
        }
      }
    }

    // 生成 JWT Token（如果启用了 JWT）
    let token = null
    if (JWT_SECRET && JWT_SECRET !== 'your_jwt_secret_key_here' && JWT_SECRET.length > 10) {
      try {
        const tokenPayload = {
          key: documentKey,
          user: {
            id: userId || 'anonymous',
            name: userName || '匿名用户'
          }
        }
        token = generateJWTToken(tokenPayload)
      } catch (error) {
        console.error('生成 JWT Token 失败:', error)
      }
    }

    res.json({
      success: true,
      config: editorConfig,
      token: token,
      documentServerUrl: documentServerUrl
    })

  } catch (error) {
    console.error('获取编辑器配置失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// 从配置中获取服务器端口和主机
const PORT = process.env.PORT || config.server.port || 3001
const HOST = process.env.HOST || config.server.host || '0.0.0.0'

// 启动服务器
app.listen(PORT, HOST, () => {
  console.log(`OnlyOffice API 服务器运行在 ${HOST}:${PORT}`)
  console.log('配置文件已加载，JWT 密钥:', JWT_SECRET ? '已设置' : '未设置')
})
