const version = 'V1.0.3';

var modifiedHeaders = $request.headers;

function removeHeader(headers, key) {
    var lowerKey = key.toLowerCase();
    for (var k in headers) {
        if (k.toLowerCase() === lowerKey) {
            delete headers[k];
        }
    }
}

// 1. Xóa ETag của RevenueCat (ép trả về dữ liệu Gold mới nhất)
removeHeader(modifiedHeaders, "X-RevenueCat-ETag");

// 2. Xóa ETag & Cache của Firebase Remote Config (ép trả về Full JSON 200 OK để nạp Filter & Caption)
removeHeader(modifiedHeaders, "If-None-Match");
removeHeader(modifiedHeaders, "If-Modified-Since");

// 3. Ép không dùng bộ nhớ đệm trung gian
modifiedHeaders["Cache-Control"] = "no-cache, no-store, must-revalidate";
modifiedHeaders["Pragma"] = "no-cache";

$done({ headers: modifiedHeaders });
