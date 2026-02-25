````markdown
# 🎟️ Ticket Booking System (High Concurrency Simulation)

โปรเจกต์ระบบจองตั๋วคอนเสิร์ตที่ออกแบบมาเพื่อรองรับการใช้งานพร้อมกันจำนวนมาก (High Concurrency) โดยใช้สถาปัตยกรรมแบบ **Asynchronous Queue** เพื่อแก้ไขปัญหา Race Condition และป้องกันระบบล่มเมื่อมีผู้ใช้งานรุมกดบัตรในวินาทีเดียวกัน

---

## 🚀 จุดเด่นของระบบ (Key Features)

- **Asynchronous Queue Management:** ใช้โครงสร้างข้อมูลแบบ Queue (FIFO) ในการจัดการลำดับการจอง เพื่อลดภาระของ Database
- **Non-blocking Request Handling:** ระบบตอบกลับทันทีพร้อม `trackingId` ทำให้ผู้ใช้งานไม่ต้องรอคอยนาน (ลดโอกาสเกิด Timeout)
- **Atomic Operation:** ใช้ `$inc` ของ MongoDB เพื่อให้มั่นใจว่าจำนวนที่นั่งจะมีความแม่นยำ 100% แม้มีการจองพร้อมกันหลักแสนครั้ง
- **Scalable Architecture:** แยกส่วนการรับคำขอและการบันทึกข้อมูลออกจากกัน (Background Processing) ทำให้ระบบมีความเสถียรสูง

---

## 🛠️ Tech Stack

- **Backend:** [NestJS](https://nestjs.com/) (Node.js Framework)
- **Database:** [MongoDB](https://www.mongodb.com/) with Mongoose
- **Documentation:** [Swagger (OpenAPI)](https://swagger.io/)
- **Testing:** Axios-based Stress Test Script (Node.js)

---

## 📊 ผลการทดสอบประสิทธิภาพ (Stress Test Results)

จากการทดสอบจำลองสถานการณ์ "สงครามกดบัตร" (K-Pop Concert Simulation) ด้วยการส่งคำขอพร้อมกันจำนวนมากบนเครื่องเครื่องเดียว:

| หัวข้อการทดสอบ                  | รายละเอียด / ผลลัพธ์                                    |
| :------------------------------ | :------------------------------------------------------ |
| **จำนวน Request ทั้งหมด**       | 100,000 รายการ                                          |
| **ส่งเข้าคิวสำเร็จ (Enqueue)**  | **46,319 รายการ** (บนสภาวะเครื่องเดี่ยว)                |
| **ความเร็วเฉลี่ย (Throughput)** | **~280 - 300 Requests/sec**                             |
| **ความถูกต้องของข้อมูล**        | **Pass** - จำนวนที่นั่งถูกหักออกตรงตามจำนวนที่จองสำเร็จ |

> **หมายเหตุ:** ข้อผิดพลาดที่เกิดขึ้น (Network Error) ในช่วงท้ายของการทดสอบ เกิดจากขีดจำกัดของระบบปฏิบัติการ (OS Socket Limit) ไม่ใช่ข้อผิดพลาดจากตัวโปรแกรม

---

## 🏗️ ขั้นตอนการทำงาน (System Workflow)

1.  **Request:** ผู้ใช้ส่งคำขอจองตั๋วผ่าน `POST /bookings`
2.  **Queueing:** Server รับคำขอแล้วโยนเข้า **Internal Array Queue** ทันที พร้อมตอบกลับ `trackingId` ในหลักมิลลิวินาที
3.  **Processing:** ระบบ Background Worker ทยอยดึงงานจาก Queue มาบันทึกลง **MongoDB** อย่างต่อเนื่อง
4.  **Polling:** ผู้ใช้นำ `trackingId` มาเช็คสถานะการจองผ่าน `GET /bookings/status/:id`

---

## 📝 วิธีการติดตั้งและรันโปรเจกต์

### 1. ติดตั้ง Library ที่จำเป็น

```bash
npm install
```
````

### 2. ตั้งค่าไฟล์ .env

สร้างไฟล์ `.env` ที่ Root Directory แล้วใส่ค่าดังนี้:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key

```

### 3. รัน Server (Development Mode)

```bash
npm run start:dev

```

### 4. ตรวจสอบ API Documentation

เปิด Browser ไปที่: `http://localhost:3000/api/docs` เพื่อใช้งาน Swagger UI

---

## 🧪 วิธีการรัน Stress Test

1. ตรวจสอบไฟล์ `test.js` และใส่ Token ที่ถูกต้อง
2. รันคำสั่ง:

```bash
node test.js

```
