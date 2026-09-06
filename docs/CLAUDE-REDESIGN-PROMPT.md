```text
Bạn là Claude trong vai trò frontend presentation specialist cho một Build GenLayer đã có functional baseline. Đây là manual user handoff; hãy làm trực tiếp trong project local được chỉ định, không tạo project khác.

PROJECT: E:\Genlayer-Projects\semantic-category-duel
IMPLEMENTED REVISION: 93b96b33289c5f8160292c5242c90b2f0d608fab
CLAUDE_DESIGN_ITERATION: presentation-layer-v1
SPECIFICATION: Semantic Category Duel — game công khai giữa hai wallet, sáu lượt nối từ; contract quyết định authority/turn/link/repeat/pass/resign/history/scoring, GenLayer validators chỉ phân loại word/category membership.

Trước khi sửa, bắt buộc đọc đầy đủ:
- E:\Genlayer-Projects\semantic-category-duel\RESEARCH-HANDOFF.md
- E:\Genlayer-Projects\semantic-category-duel\docs\IMPLEMENTATION-PLAN.md
- E:\Genlayer-Projects\semantic-category-duel\docs\RPC-BUDGET.md
- E:\Genlayer-Projects\semantic-category-duel\docs\CODE-EDIT-EVIDENCE.md
- E:\Genlayer-Projects\semantic-category-duel\frontend\src\App.tsx
- E:\Genlayer-Projects\semantic-category-duel\frontend\src\styles.css
- E:\Genlayer-Projects\semantic-category-duel\frontend\src\wallet.ts
- E:\Genlayer-Projects\semantic-category-duel\frontend\src\contract.ts
- E:\Genlayer-Projects\semantic-category-duel\frontend\src\pending.ts
- E:\Genlayer\brain\Engineering and UI Quality Rules.md, chỉ các section FRONTEND.PROJECT_SPECIFIC_DESIGN, FRONTEND.WALLET_SELECTOR, FRONTEND.TRANSACTION_PROGRESS, FRONTEND.RPC_BUDGET
- E:\Genlayer\brain\Reusable Frontend Build Patterns.md, chỉ các pattern frontend tương ứng
- https://docs.genlayer.com/developers/frontend/genlayer-js
- https://docs.genlayer.com/developers/frontend/transactions
- https://docs.genlayer.com/developers/frontend/wallets

SCOPE REDESIGN: làm presentation layer trở nên distinctive, judge-facing, polished và responsive; hoàn thiện wordmark/logo mark SC nếu cần; làm rõ hierarchy của hero, create-game form, inspect-game form, game board/ledger, wallet chooser, empty/error states và public transaction progress indicator. Duy trì concept dark editorial + acid green hiện có nếu nó vẫn là hướng tốt nhất. Dùng frontend-design skill nếu môi trường của bạn có skill đó.

ALLOWED FILES:
- frontend/src/App.tsx: chỉ markup/presentation/accessibility, không đổi business lifecycle
- frontend/src/styles.css
- frontend/index.html: title/meta/favicon presentation-only nếu cần
- Có thể tạo tối đa các asset presentation local dưới frontend/public/; không dùng remote runtime assets ngoài font hiện tại.

FORBIDDEN FILES AND ACTIONS:
- Không sửa contracts/, tests/, docs/, package.json, package-lock.json, vite.config.ts, tsconfig.json, .gitignore hoặc governance.
- Không sửa frontend/src/contract.ts, pending.ts, wallet.ts, types.ts, main.tsx.
- Không thêm dependency, router, analytics, backend, API, chain call, wallet, transaction, polling, cache hoặc storage logic.
- Không đổi product scope, ABI, approved state machine, RPC budget, chain ID, contract address mechanism, copy về trust boundary, hay release/deployment target.
- Không giả lập transaction success, wallet connection, deployed contract hoặc live data.
- Không commit, push, deploy hay gửi dữ liệu ra ngoài.
- Nếu có ambiguity ảnh hưởng architecture/scope/non-frontend logic, dừng và báo, không tự quyết.

ACCEPTANCE CRITERIA:
- Responsive ở desktop và mobile; không overflow; keyboard/focus rõ; reduced-motion giữ meaning.
- Wallet selector chỉ render wallet thực sự detected; fresh load vẫn disconnected.
- Transaction indicator vẫn có đủ literal phase mapping hiện tại, visible text + spinner khi pending, terminal states dừng spinner, `data-transaction-phase`, live region và alert semantics.
- Create/load/play/pass/join/evaluate/retry/resign controls không bị mất hoặc đổi eligibility.
- Public copy không hứa rewards, verified achievement hoặc final success trước finality + execution + authoritative readback.
- `npm test` và `npm run build` phải PASS; kiểm tra browser desktop/mobile và console error.

RETURN PACKAGE:
1. Tóm tắt design direction.
2. Danh sách chính xác file đã sửa/tạo.
3. Diff hoặc nội dung hoàn chỉnh của từng file thay đổi.
4. Lệnh và kết quả test/build/browser verification.
5. Các giới hạn/cảnh báo còn lại.

Output của bạn không phải approval hoặc test evidence. Codex sẽ review và tích hợp bounded diff.
```
