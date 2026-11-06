// ============================================================
// THUẬT TOÁN TẠO & KIỂM TRA KEY NGẦM (SHOP TÚ BỈM)
// ============================================================
var SECRET_SALT = "TUBIM_911_SECRET_2026"; // Mật khẩu gốc của riêng bạn
var MASTER_ADMIN_KEY = "TUBIM-ADMIN-9999"; // Key VIP dự phòng mở mọi máy

function generateUserKey(userId) {
    var str = userId.trim() + "_" + SECRET_SALT;
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    var hex = Math.abs(hash).toString(16).toUpperCase();
    while (hex.length < 6) {
        hex = "0" + hex;
    }
    return "TB-" + hex.substring(0, 6);
}

var url = $request.url || "";
var match = url.match(/subscribers\/([^/?]+)/);
var currentUserId = match ? decodeURIComponent(match[1]) : "";

// Lưu UserID vào bộ nhớ để hiển thị trực tiếp bên trong giao diện Locket
if (currentUserId && typeof $persistentStore !== "undefined") {
    $persistentStore.write(currentUserId, "TUBIM_CURRENT_UID");
} else if (!currentUserId && typeof $persistentStore !== "undefined") {
    currentUserId = $persistentStore.read("TUBIM_CURRENT_UID") || "CHUA_LAY_DUOC_ID";
}

// Đọc Key khách đã nhập từ bên trong app Locket
var inputKey = "";
if (typeof $persistentStore !== "undefined") {
    inputKey = ($persistentStore.read("TUBIM_SAVED_KEY") || "").trim().toUpperCase();
}

var expectedKey = (currentUserId && currentUserId !== "CHUA_LAY_DUOC_ID") ? generateUserKey(currentUserId) : "";
var isAuthorized = (inputKey !== "") && (inputKey === expectedKey || inputKey === MASTER_ADMIN_KEY);

if (url.includes("/subscribers/") && !isAuthorized) {
    if (typeof $persistentStore !== "undefined") {
        $persistentStore.write("BLOCKED", "TUBIM_AUTH_STATUS");
    }
    // KHÔNG gửi thông báo ở Shadowrocket nữa, trả về nguyên bản để ép hiện bảng ID trong Locket
    $done({});
} else {
    if (isAuthorized && typeof $persistentStore !== "undefined") {
        $persistentStore.write("VERIFIED_BY_TUBIM", "TUBIM_AUTH_STATUS");
    }

    var obj = {};
    try {
        obj = JSON.parse($response.body || "{}");
    } catch (e) {
        $done({});
    }

    var tubimGoldData = {
        "is_sandbox": false,
        "ownership_type": "PURCHASED",
        "billing_issues_detected_at": null,
        "period_type": "normal",
        "expires_date": "2099-12-31T23:59:59Z",
        "grace_period_expires_date": null,
        "unsubscribe_detected_at": null,
        "original_purchase_date": "2024-01-01T00:00:00Z",
        "purchase_date": "2024-01-01T00:00:00Z",
        "store": "app_store"
    };

    var tubimEntitlement = {
        "grace_period_expires_date": null,
        "purchase_date": "2024-01-01T00:00:00Z",
        "product_identifier": "locket_199_1m",
        "expires_date": "2099-12-31T23:59:59Z"
    };

    if (obj && obj.subscriber) {
        obj.Attention = "Bản quyền Locket Gold thuộc về Shop Tú Bỉm!";
        obj.subscriber.subscriptions = obj.subscriber.subscriptions || {};
        obj.subscriber.entitlements = obj.subscriber.entitlements || {};

        obj.subscriber.subscriptions["locket_199_1m"] = tubimGoldData;
        obj.subscriber.subscriptions["locket_1600_1y"] = tubimGoldData;
        obj.subscriber.entitlements["Gold"] = tubimEntitlement;
        obj.subscriber.entitlements["pro"] = tubimEntitlement;
    }

    $done({ body: JSON.stringify(obj) });
}
