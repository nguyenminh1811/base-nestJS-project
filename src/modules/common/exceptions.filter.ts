import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { isArray, isObject, ValidationError } from 'class-validator';
import { ApiError } from './classes/api-error';
import { ApiResult } from './classes/api-result';
import { IErrorResponse } from './interfaces/error-response.interface';
import { Response } from 'express';

const handleException = (exception: HttpException | RpcException | Error) => {
  const apiResult = new ApiResult<any>();
  apiResult.error(exception.message, 400);

  if (exception instanceof ApiError) {
    apiResult.data = exception.data;
    apiResult.message = exception.message;
    apiResult.errorCode = exception.message;
    apiResult.code = exception.getStatus();
  } else if (exception instanceof BadRequestException) {
    const response = exception.getResponse() as IErrorResponse;
    const errors = exception.message;
    apiResult.errorCode = exception.name;
    if (isObject(response)) {
      apiResult.message = isArray(response.message)
        ? response.message[0]
        : response.message;
      apiResult.errorCode = response.error;
    }
    if (
      Array.isArray(errors) &&
      errors.length > 0 &&
      errors[0] instanceof ValidationError
    ) {
      const messages = errors.map((error: ValidationError) => {
        return error.constraints
          ? error.constraints[Object.keys(error.constraints)[0]]
          : error.toString();
      });
      apiResult.message = messages.join('\n');
    }
  } else if (exception instanceof HttpException) {
    apiResult.code = exception.getStatus();
    apiResult.message = exception.message;
  } else if (typeof exception.message === 'object') {
    apiResult.message = exception.message;
  }
  return apiResult;
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const apiResult = handleException(exception);
    response.status(apiResult.code).json({ ...apiResult });
  }
}
