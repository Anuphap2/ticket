# 🎟️ Concert Ticket Booking System (High Concurrency)

ระบบจองตั๋วคอนเสิร์ตที่ออกแบบมาเพื่อรองรับการเข้าใช้งานพร้อมกันจำนวนมหาศาล (High Concurrency) โดยใช้สถาปัตยกรรมแบบ **Asynchronous Queue** และ **Atomic Operations** เพื่อแก้ปัญหาการจองเกิน (Overbooking) และรักษาความเสถียรของระบบในสภาวะที่มีโหลดการใช้งานสูงเป็นพิเศษ

## 🚀 จุดเด่นของระบบ (Key Features)

* **Asynchronous Queue Management**: ใช้โครงสร้างข้อมูลแบบ Queue (FIFO) ในการรับคำขอเข้าสู่ระบบทันทีแบบ Non-blocking ทำให้ Server ตอบกลับ `trackingId` ได้ในหลักมิลลิวินาที ลดโอกาสเกิด Request Timeout แม้มีผู้ใช้รุมกดบัตรพร้อมกัน
* **Atomic Inventory Updates**: ใช้ Operator `$inc` ของ MongoDB พร้อมเงื่อนไขการตรวจสอบสต็อกในระดับ Database เพื่อให้มั่นใจว่าจำนวนที่นั่งจะมีความแม่นยำ 100% และไม่มีการขายเกินจำนวน (No Overbooking)
* **Scalable Architecture**: แยกส่วนการรับคำขอ (Request Handling) และการบันทึกข้อมูล (Worker Processing) ออกจากกัน ทำให้ระบบมีความเสถียรสูงและจัดการภาระงานหนักได้ดี
* **Secure Authentication**: ปกป้องข้อมูลผู้ใช้ด้วยระบบ JWT (Access & Refresh Tokens) และการ Hash ข้อมูลสำคัญด้วย `argon2`

## 🏗️ ขั้นตอนการทำงาน (System Workflow)

1.  **Request**: ผู้ใช้ส่งคำขอจองตั๋วผ่าน `POST /bookings`
2.  **Queueing**: ระบบรับคำขอแล้วโยนเข้า **Internal Queue** ทันที พร้อมตอบกลับ `trackingId` เพื่อให้ผู้ใช้นำไปเช็คสถานะ
3.  **Processing**: ระบบ Background Worker ดึงงานจาก Queue มาทำ **Atomic Update** เพื่อหักที่นั่งและบันทึกลง MongoDB
4.  **Status Polling**: ผู้ใช้นำ `trackingId` มาเช็คสถานะการจองผ่าน `GET /bookings/status/:id`
5.  **Auto-Cancellation**: มีระบบ Timer ตรวจสอบการชำระเงิน หากไม่สำเร็จภายในเวลาที่กำหนด (เช่น 60 วินาที) ระบบจะคืนสต็อกเข้าสู่ระบบโดยอัตโนมัติ

## 📊 ผลการทดสอบประสิทธิภาพ (Stress Test Results)

จำลองสถานการณ์ "สงครามกดบัตร" (K-Pop Concert Simulation) บนเครื่องทดสอบเดี่ยวใน 2 ระดับ:

### 1. Burst Load Test (10,000 Requests)
* **จำนวน Request ทั้งหมด**: 10,000 รายการ
* **เข้าคิวสำเร็จ (Success)**: **9,772 รายการ**
* **ความเร็วสูงสุด (Peak Throughput)**: **~1,475.14 Requests/sec**
* **เวลาที่ใช้ทั้งหมด**: **6.78 วินาที**

### 2. Sustained Heavy Load Test (100,000 Requests)
* **จำนวน Request ทั้งหมด**: 100,000 รายการ
* **เข้าคิวสำเร็จ (Success)**: **41,181 รายการ**
* **ความเร็วเฉลี่ย (Average Throughput)**: **~957.45 Requests/sec**
* **เวลาที่ใช้ทั้งหมด**: **104.44 วินาที**
* **ความถูกต้องของข้อมูล**: **Pass** (จำนวนที่นั่งถูกหักออกตรงตามจำนวนที่จองสำเร็จ 100%)

> **หมายเหตุ**: Network Error ที่เกิดขึ้นในช่วงโหลดหนักสูงสุด มีสาเหตุหลักมาจากข้อจำกัดของระบบปฏิบัติการ (OS Socket Limit) ในการทดสอบบนเครื่องเดี่ยว ไม่ใช่ข้อผิดพลาดจาก Logic ของระบบ

## 🛠️ Tech Stack

* **Backend**: NestJS (Node.js Framework)
* **Database**: MongoDB with Mongoose
* **Security**: Argon2, JWT (Access & Refresh Tokens)
* **Payment**: Stripe Integration
* **Documentation**: Swagger (OpenAPI)
* **Testing**: Axios-based Stress Test Script

## 📝 วิธีการติดตั้งและรันโปรเจกต์

1.  **ติดตั้ง Library**:
    ```bash
    npm install
    ```
2.  **ตั้งค่า Environment**: สร้างไฟล์ `.env` ที่ Root Directory ตามตัวอย่างใน `.env.example`
3.  **รัน Server (Development)**:
    ```bash
    npm run start:dev
    ```
4.  **ตรวจสอบ API Documentation**: เข้าไปที่ `http://localhost:3000/api/docs` เพื่อใช้งาน Swagger UI

---
*โปรเจกต์นี้ออกแบบมาเพื่อแก้ปัญหา Race Condition และรองรับการทำงานแบบ High Concurrency อย่างมีประสิทธิภาพ*