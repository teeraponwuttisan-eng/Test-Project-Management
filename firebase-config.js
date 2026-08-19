/* =========================================================
   ตั้งค่า Firebase — ไฟล์เดียวที่ต้องแก้เพื่อให้ทุกคนเห็นข้อมูลชุดเดียวกัน
   วิธีหาค่าเหล่านี้ดูใน README.md หัวข้อ "ตั้งค่า Firebase"
   ========================================================= */

// วางค่าจาก Firebase Console > Project settings > General > Your apps > SDK setup
export const firebaseConfig = {
  apiKey: "วางค่าของคุณที่นี่",
  authDomain: "วางค่าของคุณที่นี่",
  projectId: "วางค่าของคุณที่นี่",
  storageBucket: "วางค่าของคุณที่นี่",
  messagingSenderId: "วางค่าของคุณที่นี่",
  appId: "วางค่าของคุณที่นี่"
};

// ยังไม่ได้ตั้งค่า ถ้ายังเป็นค่า placeholder อยู่ ระบบจะสลับไปเก็บข้อมูลในเครื่องแทนชั่วคราว
export const isFirebaseConfigured =
  firebaseConfig.apiKey && firebaseConfig.apiKey !== "วางค่าของคุณที่นี่";
