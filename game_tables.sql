-- =========================================================================
-- 1. BẢNG ROOMS (Quản lý phòng chờ)
-- =========================================================================
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    room_code VARCHAR(10) NOT NULL UNIQUE,
    host_id INT NOT NULL,
    guest_id INT DEFAULT NULL,
    password VARCHAR(50) DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ràng buộc kiểm tra giá trị của status thay cho ENUM
    CONSTRAINT chk_rooms_status CHECK (status IN ('waiting', 'playing', 'closed')),

    -- Khóa ngoại liên kết tới bảng users
    CONSTRAINT fk_rooms_host FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_rooms_guest FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE SET NULL
);


-- =========================================================================
-- 2. BẢNG MATCHES (Quản lý tổng quan trận đấu)
-- =========================================================================
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    room_id INT DEFAULT NULL,
    player_x_id INT NOT NULL,
    player_o_id INT NOT NULL,
    current_turn_id INT NOT NULL,
    board_size INT DEFAULT 15,            -- Mặc định bàn cờ 15x15
    time_per_turn INT DEFAULT 30,          -- Mặc định 30 giây mỗi lượt
    winner_id INT DEFAULT NULL,
    result_status VARCHAR(20) DEFAULT 'ongoing',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP DEFAULT NULL,

    -- Ràng buộc kiểm tra giá trị của result_status thay cho ENUM
    CONSTRAINT chk_matches_result_status CHECK (result_status IN ('ongoing', 'win', 'draw', 'surrender', 'timeout')),

    -- Các khóa ngoại đảm bảo dữ liệu người chơi chính xác
    CONSTRAINT fk_matches_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    CONSTRAINT fk_matches_player_x FOREIGN KEY (player_x_id) REFERENCES users(id),
    CONSTRAINT fk_matches_player_o FOREIGN KEY (player_o_id) REFERENCES users(id),
    CONSTRAINT fk_matches_current_turn FOREIGN KEY (current_turn_id) REFERENCES users(id),
    CONSTRAINT fk_matches_winner FOREIGN KEY (winner_id) REFERENCES users(id)
);


-- =========================================================================
-- 3. BẢNG MATCH_MOVES (Chi tiết lịch sử các nước đi)
-- =========================================================================
CREATE TABLE match_moves (
    id SERIAL PRIMARY KEY,
    match_id INT NOT NULL,
    player_id INT NOT NULL,
    move_number INT NOT NULL,              -- Số thứ tự nước đi (1, 2, 3...)
    x_coordinate INT NOT NULL,             -- Tọa độ hàng
    y_coordinate INT NOT NULL,             -- Tọa độ cột
    symbol VARCHAR(2) NOT NULL,            -- Quân cờ được đánh: 'X' hoặc 'O'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ràng buộc kiểm tra ký tự đánh xuống chỉ được là X hoặc O
    CONSTRAINT chk_moves_symbol CHECK (symbol IN ('X', 'O')),

    -- Khóa ngoại liên kết tới trận đấu và người đi
    CONSTRAINT fk_moves_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT fk_moves_player FOREIGN KEY (player_id) REFERENCES users(id),

    -- Đảm bảo trong một trận đấu, số thứ tự nước đi không bị trùng lặp
    CONSTRAINT unique_match_move UNIQUE (match_id, move_number),
    -- Đảm bảo một ô cờ (X, Y) trong một trận đấu không thể bị đánh đè lên 2 lần
    CONSTRAINT unique_cell_per_match UNIQUE (match_id, x_coordinate, y_coordinate)
);


-- =========================================================================
-- 4. TẠO INDEXES ĐỂ TỐI ƯU TỐC ĐỘ TRUY VẤN (Chạy sau khi tạo xong bảng)
-- =========================================================================
CREATE INDEX idx_match_moves_match_id ON match_moves(match_id);
CREATE INDEX idx_matches_player_x ON matches(player_x_id);
CREATE INDEX idx_matches_player_o ON matches(player_o_id);
