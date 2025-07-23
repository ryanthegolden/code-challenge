/**
 * 1) Using a simple for‐loop
 * Time Complexity: O(n) — iterates n times
 * Space Complexity: O(1) — only one accumulator variable
 */
function sum_to_n_a(n: number): number {
    let sum = 0;
    for (let i = 1; i <= n; i++) {
        sum += i;
    }
    return sum;
}

/**
 * 2) Recursive approach
 * Time Complexity: O(n) — makes n recursive calls
 * Space Complexity: O(n) — uses call stack of depth n
 *
 * Note: risks stack overflow for large n -> slower than iterative solution.
 */
function sum_to_n_b(n: number): number {
    if (n <= 0) {
        return 0;
    }
    return n + sum_to_n_b(n - 1);
}

/**
 * 3) Closed‑form formula (arithmetic series)
 * Time Complexity: O(1) — constant time
 * Space Complexity: O(1) — no extra storage
 *
 * This is the optimal solution: constant‑time, no risk of stack overflow.
 */
function sum_to_n_c(n: number): number {
    return (n * (n + 1)) / 2;
}
