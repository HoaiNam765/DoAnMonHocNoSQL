# DoAnMonHocNoSQL
Nam Nhiên Vỹ Trường

Các bước khởi chạy chương trình
(Chuyển sang Command Prompt nếu báo lỗi "cannot be loaded because running scripts is disabled on this system")
1. Khởi chạy backend:
    cd backend
    npm run dev
Kết quả đúng khi kết nối được với database neo4j: 
    ✅ [Neo4j] Kết nối thành công tới Database!
    Address: p-mt-2e58c6e6c448-11-0086.production-orch-0703.neo4j.io:7687 | Agent: Neo4j/5.27-aura
    🚀 [Server] Đang chạy tại http://localhost:5000

2. Khởi chạy frontend:
    Mở 1 terminal khác (Command Prompt)
    cd frontend
    npm install
    npm run dev