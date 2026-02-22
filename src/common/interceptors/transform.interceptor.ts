// src/common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // 🎯 1. Safe Check: ป้องกันกรณี data เป็น null หรือ undefined (เช่น หลังลบข้อมูล)
        if (!data) {
          return {
            success: true,
            data: [] as any,
            message: 'Operation successful',
          };
        }

        // 🎯 2. ตรวจสอบว่ามีโครงสร้าง message หรือ data มาอยู่แล้วหรือไม่
        const message = data.message || 'Success';

        // รองรับกรณีที่ข้อมูลถูกห่อมาแล้ว (เช่น จากฟังก์ชัน Pagination)
        const actualData = data.data !== undefined ? data.data : data;

        // 🎯 3. จัดการ Meta Data สำหรับงานที่เป็น List/Pagination
        const meta =
          data.total !== undefined
            ? {
                total: data.total,
                page: Number(data.page),
                limit: Number(data.limit),
              }
            : undefined;

        return {
          success: true,
          data: actualData,
          message: message,
          meta: meta,
        };
      }),
    );
  }
}
