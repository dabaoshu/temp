/**
 * 统一响应格式工具函数
 * 所有接口返回统一使用 { code, data, message } 格式
 */

export interface ApiResponse<T = any> {
  code: number;
  data: T | null;
  message: string;
}

/**
 * 成功响应
 * @param data 响应数据
 * @param message 响应消息，默认为 "操作成功"
 * @returns 标准响应对象
 */
export function success<T = any>(
  data: T | null = null,
  message: string = "操作成功"
): ApiResponse<T> {
  return {
    code: 200,
    data,
    message,
  };
}

/**
 * 错误响应
 * @param message 错误消息
 * @param code 错误码，默认为 500
 * @param data 附加数据，默认为 null
 * @returns 标准响应对象
 */
export function error(
  message: string = "操作失败",
  code: number = 500,
  data: any = null
): ApiResponse {
  return {
    code,
    data,
    message,
  };
}

/**
 * 客户端错误响应（400）
 * @param message 错误消息
 * @param data 附加数据
 * @returns 标准响应对象
 */
export function badRequest(
  message: string = "请求参数错误",
  data: any = null
): ApiResponse {
  return error(message, 400, data);
}

/**
 * 未授权响应（401）
 * @param message 错误消息
 * @param data 附加数据
 * @returns 标准响应对象
 */
export function unauthorized(
  message: string = "未授权",
  data: any = null
): ApiResponse {
  return error(message, 401, data);
}

/**
 * 未找到响应（404）
 * @param message 错误消息
 * @param data 附加数据
 * @returns 标准响应对象
 */
export function notFound(
  message: string = "资源未找到",
  data: any = null
): ApiResponse {
  return error(message, 404, data);
}

/**
 * 服务器错误响应（500）
 * @param message 错误消息
 * @param data 附加数据
 * @returns 标准响应对象
 */
export function serverError(
  message: string = "服务器内部错误",
  data: any = null
): ApiResponse {
  return error(message, 500, data);
}
