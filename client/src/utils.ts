import { SquareValue } from "./types";

export function checkWinner(index: number, squares: SquareValue[], boardSize: number): boolean {
    const currentSign = squares[index];
    if(!currentSign) return false;

    // tính tọa độ hàng (row) và cột (col) của ô vừa đánh (hệ số từ 0)
    const row = Math.floor(index / boardSize);
    const col = index % boardSize;

    // 4 hướng cần kiểm tra đại diện bằng vector: [dịch dọc, dịch ngang]
  const directions = [
    [0, 1],   // ngang
    [1, 0],   // dọc
    [1, 1],   // chéo xuôi
    [1, -1],  // chéo ngược
  ]

  for (const [dRow, dCol] of directions) {
    let count = 1; // Tính chính ô vừa đánh là 1

    // Hướng tiến (Ví dụ: đi sang phải, đi xuống, đi xuống-phải)
    let r = row + dRow;
    let c = col + dCol;
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize && squares[r * boardSize + c] === currentSign) {
      count++;
      r += dRow;
      c += dCol;
    }

    // Hướng lùi ngược lại (Ví dụ: đi sang trái, đi lên, đi lên-trái)
    r = row - dRow;
    c = col - dCol;
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize && squares[r * boardSize + c] === currentSign) {
      count++;
      r -= dRow;
      c -= dCol;
    }

    // Nếu đạt đủ 5 ô liên tiếp trở lên (luật Gomoku chuẩn không chặn hai đầu)
    if (count >= 5) {
      return true;
    }
  }

  return false;
}