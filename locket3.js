var SECRET_SALT = "TUBIM_911_SECRET_2026";
var MASTER_ADMIN_KEY = "TUBIM-ADMIN-9999";

function generateUserKey(userId) {
    var str = userId.trim() + "_" + SECRET_SALT;
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    var hex = Math.abs(hash).toString(16).toUpperCase();
    while (hex.length < 6) hex = "0" + hex;
    return "TB-" + hex.substring(0, 6);
}

// ============================================================
// PHẦN 0: BẮT KEY KHÁCH NHẬP TRỰC TIẾP TRONG APP LOCKET + FAKE US
// ============================================================
if (typeof $request !== "undefined" && typeof $response === "undefined") {
    var headers = $request.headers || {};
    var reqUrl = $request.url || "";
    var reqBody = $request.body || "";

    // 1. Tự động lấy UID nếu có trong request gửi đi của Locket
    var uidMatch = reqBody.match(/"(?:uid|user_id|userId)"\s*:\s*"([a-zA-Z0-9_-]{10,40})"/) || reqUrl.match(/users\/([a-zA-Z0-9_-]{10,40})/);
    if (uidMatch && uidMatch[1] && typeof $persistentStore !== "undefined") {
        $persistentStore.write(uidMatch[1], "TUBIM_CURRENT_UID");
    }

    // 2. Bắt mã Key (TB-XXXXXX hoặc TUBIM-ADMIN-9999) khi khách gõ vào ô Tìm kiếm bạn bè / Caption / Chat trong Locket
    var combinedInput = reqUrl + " " + reqBody;
    var keyMatch = combinedInput.match(/\b(TB-[0-9A-F]{6}|TUBIM-ADMIN-9999)\b/i);
    if (keyMatch && keyMatch[1] && typeof $persistentStore !== "undefined") {
        var enteredKey = keyMatch[1].toUpperCase();
        $persistentStore.write(enteredKey, "TUBIM_SAVED_KEY");

        var savedUid = $persistentStore.read("TUBIM_CURRENT_UID") || "";
        var validKey = savedUid ? generateUserKey(savedUid) : "";
        if (enteredKey === validKey || enteredKey === MASTER_ADMIN_KEY) {
            $persistentStore.write("VERIFIED_BY_TUBIM", "TUBIM_AUTH_STATUS");
        }
    }

    // 3. Fake Region sang US
    headers["Accept-Language"] = "en-US,en;q=0.9";
    headers["accept-language"] = "en-US,en;q=0.9";
    headers["X-Country-Code"] = "US";
    headers["CF-IPCountry"] = "US";
    headers["X-AppEngine-Country"] = "US";
    headers["X-Client-Region"] = "US";
    headers["X-Locket-Region"] = "US";

    if (reqBody) {
        try {
            reqBody = reqBody.replace(/"countryCode"\s*:\s*"[A-Za-z]+"/g, '"countryCode":"US"');
            reqBody = reqBody.replace(/"regionCode"\s*:\s*"[A-Za-z]+"/g, '"regionCode":"US"');
            reqBody = reqBody.replace(/"locale"\s*:\s*"[a-zA-Z_-]+"/g, '"locale":"en_US"');
            reqBody = reqBody.replace(/"languageCode"\s*:\s*"[a-zA-Z_-]+"/g, '"languageCode":"en-US"');
            reqBody = reqBody.replace(/"timeZone"\s*:\s*"[^"]+"/g, '"timeZone":"America/Los_Angeles"');
        } catch (e) {}
    }
    $done({ headers: headers, body: reqBody });
} else {
    // ============================================================
    // XỬ LÝ HTTP-RESPONSE (HIỆN ID & KIỂM TRA KEY NGAY TRONG LOCKET)
    // ============================================================
    var ua = ($request && $request.headers) ? ($request.headers["User-Agent"] || $request.headers["user-agent"] || "") : "Locket";
    var obj = {};
    try {
        obj = JSON.parse($response.body);
    } catch (e) {
        $done({});
    }

    if (ua.includes("Locket") || (obj && obj.entries)) {
        var savedUid = (typeof $persistentStore !== "undefined") ? ($persistentStore.read("TUBIM_CURRENT_UID") || "Đang tải ID...") : "Không rõ";
        var savedKey = (typeof $persistentStore !== "undefined") ? ($persistentStore.read("TUBIM_SAVED_KEY") || "").toUpperCase() : "";
        var expectedKey = (savedUid && savedUid !== "Đang tải ID...") ? generateUserKey(savedUid) : "";
        var isVerified = (savedKey !== "") && (savedKey === expectedKey || savedKey === MASTER_ADMIN_KEY);

        if (isVerified && typeof $persistentStore !== "undefined") {
            $persistentStore.write("VERIFIED_BY_TUBIM", "TUBIM_AUTH_STATUS");
        }

        var authStatus = (typeof $persistentStore !== "undefined") ? $persistentStore.read("TUBIM_AUTH_STATUS") : "";

        if (authStatus !== "VERIFIED_BY_TUBIM" && !isVerified) {
            obj.entries = obj.entries || {};
            // BẢNG POPUP HIỆN TRỰC TIẾP MÃ ID & HƯỚNG DẪN NHẬP KEY TRONG APP LOCKET
            obj.entries.feature_discovery_popup_config = JSON.stringify({
                tag: "CHƯA KÍCH HOẠT KEY 🔒",
                tag_gradient: true,
                tag_style: "gold_gradient",
                animation: "confetti",
                show_confetti: true,
                confetti_enabled: true,
                title: "ID: " + savedUid,
                feature_set: [{
                    title: "Cách nhập Key ngay trong Locket ✨",
                    body: "1. Chụp màn hình gửi Mã ID ở trên cho Shop Tú Bỉm.\n2. Mở mục Kết bạn (Tìm kiếm bạn bè) trong Locket, gõ mã Key (VD: TB-123456) vào ô tìm kiếm rồi thoát ra mở lại Locket là mở khóa!",
                    imageURL: "https://i.ibb.co/9LRn7VY/DORAEMON.jpg"
                }],
                primary_button_title: "Đã hiểu • Đi nhập Key 🔑",
                campaign: "lock_screen_" + new Date().getTime(),
                start_at: "2020-01-01T00:00:00",
                end_at: "2099-12-31T23:59:59",
                use_local_time_zone: true
            });

            // HIỆN MÃ ID NGAY TRÊN THANH CAPTION LOCKET ĐỂ KHÁCH DỄ NHÌN
            obj.entries.overlay_items = JSON.stringify([
                {
                    section: "🔒 CHƯA KÍCH HOẠT BẢN QUYỀN TÚ BỈM 🔒",
                    items: [
                        { overlay_id: "caption:locked_id", source: "remote", caption: { background: { colors: ["#8B0000", "#FF0000"] }, icon: { data: "🆔", type: "emoji" }, max_lines: 1, text: "ID của bạn: " + savedUid, text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:locked_guide", source: "remote", caption: { background: { colors: ["#000000", "#434343"] }, icon: { data: "🔑", type: "emoji" }, max_lines: 1, text: "Gõ Key (TB-xxxxxx) vào ô Tìm Bạn Bè để mở khóa ✨", text_color: "#FFD700", type: "static_content" } }
                    ]
                }
            ]);
            $done({ body: JSON.stringify(obj) });
        } else {
            // (Từ đây trở xuống giữ nguyên phần mở khóa 100% tính năng của bạn...)
            // ============================================================
            // KHI ĐÃ XÁC MINH ĐÚNG KHÁCH HÀNG -> MỞ KHÓA 100% TÍNH NĂNG
            // ============================================================
            obj.Attention = "Chúc mừng bạn! Đã lên Locket Prenium !";
            obj.country = "US";
            obj.country_code = "US";
            obj.region = "US";
            obj.locale = "en_US";
            obj.entries = obj.entries || {};

            var now = new Date();
            var hours = now.getHours();
            var day = now.getDate();
            var month = now.getMonth() + 1;
            var dateKey = "_" + day + "_" + month + "_" + now.getFullYear();

            // ============================================================
            // 0. ENGINE THÔNG BÁO TỰ ĐỘNG BUNG THEO TỪNG NGÀY (CÀI 1 LẦN - TỰ HIỆN)
            // ============================================================
            var popupTag = "LOCKET GOLD PRENIUM";
            var popupTitle = "Lên Gold rồi đó cục zàng 😎";
            var popupCardTitle = "Locket Tú Bỉm mãi sẵn sàng ✨";
            var popupCardBody = "Shop cảm ơnnnn 💛";
            var popupCampaign = "locket_gold_welcome_v3";

            if (month === 10 && (day === 19 || day === 20)) {
                popupTag = "HAPPY 20/10 💐";
                popupTitle = "Chúc Mừng Ngày Phụ Nữ VN 20/10 🌷";
                popupCardTitle = "Luôn xinh đẹp, rạng rỡ & hạnh phúc ✨";
                popupCardBody = "Gửi ngàn lời chúc yêu thương nhất tới bạn 💖";
                popupCampaign = "holiday_20_10" + dateKey;
            } else if (month === 10 && day >= 29 && day <= 31) {
                popupTag = "HAPPY HALLOWEEN 🎃";
                popupTitle = "Lễ Hội Hóa Trang Halloween 👻";
                popupCardTitle = "Trick or Treat • Cho kẹo hay bị ghẹo 🍬";
                popupCardBody = "Chúc bạn có một đêm Halloween thật cháy 🔥";
                popupCampaign = "holiday_halloween" + dateKey;
            } else if (month === 11 && (day === 19 || day === 20)) {
                popupTag = "TRI ÂN 20/11 🎓";
                popupTitle = "Chúc Mừng Ngày Nhà Giáo VN 20/11 📚";
                popupCardTitle = "Tôn sư trọng đạo • Tri ân thầy cô ✨";
                popupCardBody = "Chúc một ngày lễ 20/11 thật ý nghĩa 💐";
                popupCampaign = "holiday_20_11" + dateKey;
            } else if (month === 12 && (day === 24 || day === 25)) {
                popupTag = "MERRY CHRISTMAS 🎄";
                popupTitle = "Giáng Sinh An Lành & Ấm Áp 🎅❄️";
                popupCardTitle = "Chúc bạn mùa Giáng Sinh tràn ngập niềm vui 🦌";
                popupCardBody = "Merry Christmas & Happy Holidays 🎁";
                popupCampaign = "holiday_christmas" + dateKey;
            } else if ((month === 12 && day === 31) || (month === 1 && day === 1)) {
                popupTag = "HAPPY NEW YEAR 🎆";
                popupTitle = "Chúc Mừng Năm Mới 2027 🥂✨";
                popupCardTitle = "Khởi đầu mới • Vạn sự hanh thông 💫";
                popupCardBody = "Chúc năm mới tiền vô như nước, tình cảm ngập tràn 💛";
                popupCampaign = "holiday_newyear" + dateKey;
            } else if (month === 2 && day >= 5 && day <= 9) {
                popupTag = "CHÚC MỪNG NĂM MỚI 🧧";
                popupTitle = "Cung Chúc Tân Xuân Đinh Mùi 2027 🌸";
                popupCardTitle = "An Khang Thịnh Vượng • Vạn Sự Như Ý 🧧";
                popupCardBody = "Chúc bạn một mùa Tết đoàn viên ấm áp bên gia đình 🎆";
                popupCampaign = "holiday_tet_" + day + dateKey;
            } else if (month === 2 && day === 14) {
                popupTag = "HAPPY VALENTINE 💘";
                popupTitle = "Lễ Tình Nhân Ngọt Ngào 14/2 🍫💕";
                popupCardTitle = "Chúc tình yêu của bạn luôn đong đầy 🫶";
                popupCardBody = "Ai có đôi thì hạnh phúc, ai độc thân sớm thoát ế nha 💖";
                popupCampaign = "holiday_valentine" + dateKey;
            } else if (month === 3 && day === 8) {
                popupTag = "HAPPY WOMEN'S DAY 🌸";
                popupTitle = "Chúc Mừng Quốc Tế Phụ Nữ 8/3 👑";
                popupCardTitle = "Chúc một nửa thế giới luôn slay & tỏa sáng ✨";
                popupCardBody = "Luôn được yêu thương và chiều chuộng mỗi ngày 🌷";
                popupCampaign = "holiday_8_3" + dateKey;
            } else if ((month === 4 && day === 30) || (month === 5 && day === 1)) {
                popupTag = "ĐẠI LỄ 30/4 - 1/5 🇻🇳";
                popupTitle = "Chào Mừng Đại Lễ 30/4 & 1/5 🌟";
                popupCardTitle = "Tự hào Việt Nam • Kỳ nghỉ lễ vui vẻ 🇻🇳";
                popupCardBody = "Lên đồ đi chơi xả hơi thôi nào! ✈️";
                popupCampaign = "holiday_30_4" + dateKey;
            } else if (month === 6 && day === 1) {
                popupTag = "HAPPY 1/6 🎈";
                popupTitle = "Quốc Tế Thiếu Nhi 1/6 Vui Vẻ 🍭";
                popupCardTitle = "Lớn rồi nhưng vẫn thích nhận quà 1/6 🧸";
                popupCardBody = "Chúc em bé luôn vui tươi và hồn nhiên 🎀";
                popupCampaign = "holiday_1_6" + dateKey;
            } else if (month === 9 && day === 2) {
                popupTag = "QUỐC KHÁNH 2/9 🇻🇳";
                popupTitle = "Mừng Tết Độc Lập 2/9 🇻🇳✨";
                popupCardTitle = "Tôi Yêu Việt Nam 🌟";
                popupCardBody = "Chúc bạn kỳ nghỉ Quốc Khánh tràn đầy niềm vui 🎉";
                popupCampaign = "holiday_2_9" + dateKey;
            } else if ((now.getDay() === 5 || now.getDay() === 6 || now.getDay() === 0) && hours >= 18) {
                popupTag = "WEEKEND VIBES 🔥";
                popupTitle = "Cuối Tuần Rồi Xõa Thôi Cục Zàng 🍻";
                popupCardTitle = "Lên đồ dạo phố • Chiến game xuyên đêm 🎮🏎️";
                popupCardBody = "Chúc bạn tối cuối tuần thật cháy cùng Locket Tú Bỉm ✨";
                popupCampaign = "weekend_party" + dateKey;
            }

            if (popupCampaign.indexOf("holiday_") === 0 || popupCampaign.indexOf("weekend_party") === 0) {
                try {
                    if (typeof $persistentStore !== "undefined" && typeof $notification !== "undefined") {
                        var lastShown = $persistentStore.read("LOCKET_TUBIM_LAST_POPUP");
                        if (lastShown !== popupCampaign) {
                            $notification.post(popupTag + " • Locket Tú Bỉm", popupTitle, popupCardBody);
                            $persistentStore.write(popupCampaign, "LOCKET_TUBIM_LAST_POPUP");
                        }
                    }
                } catch (e) {}
            }

            // ============================================================
            // 1. CẤU HÌNH GOLD, FEATURE GATES, APP ICONS & POPUP CHÚC MỪNG
            // ============================================================
            Object.assign(obj.entries, {
                feature_gates: JSON.stringify({
                    app_icon_picker: "enabled",
                    camera_roll: "enabled",
                    camera_theme: "enabled",
                    locket_views: "enabled",
                    long_captions: "enabled",
                    longer_video: "enabled",
                    unlimited_friends: "enabled",
                    priority_support: "enabled",
                    profile_badge: "enabled",
                    remove_ads: "enabled",
                    video: "enabled",
                    video_captions: "enabled",
                    auto_captions: "enabled",
                    speech_to_text: "enabled",
                    custom_widget_frames: "enabled",
                    streak_recovery: "enabled",
                    camera_filters: "enabled",
                    filters: "enabled",
                    ar_filters: "enabled",
                    snap_camera_kit: "enabled",
                    filter_sheet: "enabled"
                }),
                upsell_features: JSON.stringify({
                    app_icon_picker: true,
                    camera_roll: true,
                    camera_theme: true,
                    locket_views: true,
                    remove_ads: true,
                    custom_widget_frames: true,
                    camera_filters: true,
                    ar_filters: true
                }),
                paywall_presentation_config: JSON.stringify({
                    uid: "paywall_testflight",
                    onboarding: false,
                    after_sent_moment: false,
                    on_foreground: false,
                    interval: 2592000,
                    profile_banner: true
                }),
                feature_discovery_popup_config: JSON.stringify({
                    tag: popupTag,
                    tag_gradient: true,
                    tag_style: "gold_gradient",
                    animation: "confetti",
                    show_confetti: true,
                    confetti_enabled: true,
                    title: popupTitle,
                    feature_set: [
                        {
                            title: popupCardTitle,
                            body: popupCardBody,
                            imageURL: "https://i.ibb.co/9LRn7VY/DORAEMON.jpg"
                        }
                    ],
                    primary_button_title: "Nhận lời chúc 🎉",
                    campaign: popupCampaign,
                    start_at: "2020-01-01T00:00:00",
                    end_at: "2099-12-31T23:59:59",
                    use_local_time_zone: true
                }),
                android_subscribe_gold_button_enabled: "false",
                profile_badge_visible: "true",
                lunar_new_year_app_icon_enabled: "true",
                app_icon_picker_enabled: "true",
                custom_app_icons_enabled: "true",
                gold_badge_style: "animated_gradient",
                profile_gold_ring_enabled: "true",
                unlocked_app_icons: JSON.stringify([
                    "default", "gold", "gold_black", "neon", "retro", "valentine",
                    "lunar_new_year", "halloween", "christmas", "cyberpunk", "pastel", "dark_mode"
                ])
            });

            // ============================================================
            // 2. CHẶN QUẢNG CÁO & TẮT TRACKING (SENTRY)
            // ============================================================
            Object.assign(obj.entries, {
                history_ads_mode: "off",
                history_ads_prefetch_count: "0",
                history_ads_prefetch_immediate: "false",
                history_ads_prefetch_reroute: "false",
                history_ads_dynamic_insertion: "false",
                history_ads_refresh_prefetch_on_foreground: "false",
                history_ads_floor_price: "0",
                history_ads_floor_price_att: "0",
                history_ad_log_displayed_on_background: "false",
                history_ads_debug_menu: "false",
                sentry_sample_rate: "0",
                sentry_network_tracing: "false",
                sentry_performance_tracking: "false",
                sentry_trace_sample_rate: "0",
                sentry_profiles_sample_rate: "0"
            });

            // ============================================================
            // 3. CAMERA 60FPS, NIGHT MODE, PHỤ ĐỀ VIDEO & UNLOCK FULL FILTER THẬT
            // ============================================================
            var realServerFilters = {};
            try {
                if (obj.entries && obj.entries.camera_filter_config) {
                    realServerFilters = JSON.parse(obj.entries.camera_filter_config);
                }
            } catch (e) {}

            var allRealFilterIds = [
                "okay_wig", "influencer", "looks_maxxing", "toothless", "bye_brows",
                "bowling_ball", "blonde_bleached", "beard", "bob_cut", "buns",
                "tatted", "mohawk", "braces", "slimed", "princess",
                "disco_lights", "cash_money", "happy_birthday", "cutesy", "sticker_face",
                "flower_crown", "love_bug", "wedding", "cowboy_cowgirl", "giraffe",
                "clown", "easter_bunney_cutout", "easter_chick_cutout", "bearded", "leprechaun",
                "lucky_face", "sweet_hearts", "elf_cutout", "santa_cutout", "frosty",
                "heart_glasses", "butterfly_crown", "angel_wings", "devil_horns",
                "cat_ears", "dog_ears", "bunny_ears", "alien_face", "big_eyes",
                "big_mouth", "crying_face", "sad_face", "angry_face", "nerd_glasses",
                "sunglasses", "crown", "tiara", "pirate", "superhero", "zombie",
                "vampire", "witch", "ghost", "skeleton", "pumpkin", "reindeer",
                "new_year_glasses", "fireworks", "confetti_face", "sparkles_face",
                "blush_cheeks", "freckles", "lip_gloss", "eyeliner", "lashes",
                "retro_cam", "vhs", "polaroid", "black_and_white", "sepia", "neon_glow"
            ];

            if (realServerFilters.picker_filters && Array.isArray(realServerFilters.picker_filters)) {
                for (var i = 0; i < realServerFilters.picker_filters.length; i++) {
                    var fId = realServerFilters.picker_filters[i];
                    if (allRealFilterIds.indexOf(fId) === -1) {
                        allRealFilterIds.unshift(fId);
                    }
                }
            }

            var defaultSheetFilters = [
                { title: { en: "🔥 All Filters (Full)", vn: "🔥 Toàn Bộ Filter" }, filter_ids: allRealFilterIds },
                { title: { en: "Goofy", vn: "🤡 Nhây & Bựa" }, filter_ids: ["okay_wig", "influencer", "looks_maxxing", "toothless", "bye_brows", "clown", "giraffe", "big_eyes", "big_mouth", "crying_face", "alien_face"] },
                { title: { en: "Looks", vn: "💇‍♀️ Biến Hình" }, filter_ids: ["bowling_ball", "blonde_bleached", "beard", "bob_cut", "buns", "tatted", "mohawk", "braces", "bye_brows", "sunglasses", "nerd_glasses", "lashes", "eyeliner", "lip_gloss"] },
                { title: { en: "Cute", vn: "🎀 Đáng Yêu" }, filter_ids: ["cutesy", "sticker_face", "flower_crown", "love_bug", "sweet_hearts", "blush_cheeks", "freckles", "butterfly_crown", "cat_ears", "dog_ears", "bunny_ears", "heart_glasses"] },
                { title: { en: "Celebrate", vn: "🎉 Tiệc Tùng" }, filter_ids: ["slimed", "princess", "disco_lights", "cash_money", "happy_birthday", "crown", "tiara", "new_year_glasses", "fireworks", "confetti_face", "sparkles_face"] },
                { title: { en: "Costumes", vn: "🎭 Hóa Trang" }, filter_ids: ["wedding", "cowboy_cowgirl", "giraffe", "clown", "devil_horns", "angel_wings", "pirate", "superhero", "zombie", "vampire", "witch", "ghost", "skeleton"] },
                { title: { en: "Holidays", vn: "🎃 Lễ Hội" }, filter_ids: ["easter_bunney_cutout", "easter_chick_cutout", "bearded", "leprechaun", "lucky_face", "sweet_hearts", "elf_cutout", "santa_cutout", "frosty", "pumpkin", "reindeer"] }
            ];

            if (realServerFilters.sheet_filters && Array.isArray(realServerFilters.sheet_filters)) {
                defaultSheetFilters = realServerFilters.sheet_filters.concat(defaultSheetFilters);
            }

            Object.assign(obj.entries, {
                user_country_code: "US",
                detected_country_code: "US",
                country_code: "US",
                region_code: "US",
                is_us_user: "true",
                filter_geo_restriction_enabled: "false",
                filter_region_lock: "false",
                bypass_filter_geo_check: "true",
                camera_filters_enabled: "true",
                snap_camera_kit_enabled: "true",
                filters_enabled: "true",
                ar_filters_enabled: "true",
                camera_filter_geo_override: JSON.stringify({
                    enabled: true,
                    is_enabled: true,
                    allowed_countries: ["US", "VN", "ALL", "GLOBAL"],
                    bypass_region_check: true,
                    experiments: {},
                    area_code_overrides: {}
                }),

                video_captions_enabled: "true",
                video_subtitles_enabled: "true",
                auto_video_captions_enabled: "true",
                auto_transcribe_video: "true",
                speech_to_text_captions_enabled: "true",
                video_overlays_enabled: "true",
                camera_roll_video_captions_enabled: "true",

                camera: JSON.stringify({
                    gold_max_duration: 60.0,
                    goldMaxDuration: 60.0,
                    max_duration: 60.0,
                    maxDuration: 60.0,
                    ultra_wide: true,
                    ultraWide: true,
                    volume_button: true,
                    volumeButton: true,
                    flash_button: true,
                    telephoto: true,
                    srgb: true,
                    lanczos: true,
                    quality_mbps: 12.0,
                    qualityMbps: 12.0,
                    fps: 60,
                    max_fps: 60,
                    video_fps: 60,
                    hevc_encoding: true,
                    hdr_video: true,
                    stabilization: true,
                    night_mode: true,
                    deep_fusion: true,
                    smart_hdr: true,
                    apple_proraw: true,
                    front_camera_mirroring: true,
                    low_light_boost: true,
                    captions_enabled: true,
                    auto_captions: true,
                    speech_recognition: true
                }),
                camera_roll: JSON.stringify({
                    gold_max_duration: 60.0,
                    goldMaxDuration: 60.0,
                    video_max_duration: 60.0,
                    videoMaxDuration: 60.0,
                    max_duration: 60.0,
                    maxDuration: 60.0,
                    trim_max_duration: 60.0,
                    trimMaxDuration: 60.0,
                    camera_roll_max_duration: 60.0,
                    quality_mbps: 12.0,
                    qualityMbps: 12.0,
                    fps: 60,
                    max_fps: 60,
                    video_fps: 60,
                    hevc_encoding: true,
                    hdr_video: true,
                    stabilization: true,
                    flash_button: true,
                    captions_enabled: true,
                    auto_captions: true
                }),
                live_photos: JSON.stringify({
                    capture: true,
                    video: true,
                    viewing: true,
                    catch_up: true,
                    widget_looping_mode: "never"
                }),
                camera_filter_config: JSON.stringify({
                    allows_custom_filters: true,
                    show_filter_button: true,
                    sheet_enabled: true,
                    open_sheet_immediately: true,
                    sheet_filters: defaultSheetFilters,
                    picker_filters: allRealFilterIds
                }),
                camera_roll_preview_enabled: "true",
                camera_roll_video_enabled: "true",
                camera_roll_video_upload_enabled: "true",
                internal_camera_roll_video_upload_enabled: "true",
                longer_camera_roll_videos_enabled: "true",
                video_sound_enabled: "true",
                microphone_enabled: "true",
                camera_microphone_enabled: "true",
                audio_session_deactivation_enabled: "true",
                zoom_enabled: "true",
                upload_main: "false",
                upload_main_image_quality: "1.0",
                upload_main_image_size: "2048",
                upload_thumbnail_image_quality: "0.9",
                upload_thumbnail_image_size: "1080",
                upload_video_max_bitrate: "12000000",
                upload_video_resolution: "1080",
                upload_video_fps: "60",
                disable_video_compression: "true",
                high_quality_video_uploads: "true"
            });

            // ============================================================
            // 4. BẠN BÈ, REACTION EMOJI & CAMERA THEMES
            // ============================================================
            Object.assign(obj.entries, {
                max_friends_count: "999999999",
                friend_limit_mode: "0",
                soft_friend_limit_threshold_count: "999999999",
                show_friend_limit_on_cam: "false",
                signup_max_friends_count: "999999999",
                celebrity_inbox_limit: "999999999",
                celebrity_inbox_enabled: "true",
                celebrity_vip_qr_redemption_enabled: "true",
                friend_limit_geo_override: JSON.stringify({ experiments: {}, area_code_overrides: {} }),
                moment_reactions_default_emojis: JSON.stringify(["❤️‍🔥", "🗿", "🤡", "🥺", "🫦", "💸", "👑", "🏎️"]),
                reaction_tray_emojis: JSON.stringify(["❤️‍🔥", "🗿", "🤡", "🥺", "🫦", "💸", "👑", "🏎️", "😭", "🔥"]),
                camera_themes_enabled: "true",
                custom_camera_themes: JSON.stringify([
                    { id: "gold_luxury", name: "Gold Luxury", primary_color: "#FFD700", secondary_color: "#1C1C1E" },
                    { id: "cyber_neon", name: "Cyber Neon", primary_color: "#00F2FE", secondary_color: "#4FACFE" },
                    { id: "porsche_red", name: "Guards Red", primary_color: "#D5001C", secondary_color: "#000000" }
                ]),
                new_friends_monitoring_enabled: "true",
                improved_friend_suggestions: "true",
                show_friend_suggestions_by_default: "true",
                emoji_friend_suggestions: "true",
                prompt_contact_permissions_on_search: "true",
                populate_phone_numbers_from_suggest_friends: "true",
                hide_friends_enabled: "true",
                hide_invite_links: "false",
                hide_skip_contacts: "true",
                show_all_contacts: "true",
                show_invite_suggestions: "true",
                show_no_friends_bottom_sheet: "false",
                signup_allow_skip_add_friends: "true",
                signup_custom_profile_picture: "true",
                user_data_export_enabled: "true",
                username_suggestions_enabled: "true"
            });

            // ============================================================
            // 5. MOMENTS, BẤT TỬ CHUỖI, GHOST MODE, YEARBOOK & VOICE NOTES
            // ============================================================
            try {
                var streak = JSON.parse(obj.entries.streak_config || "{}");
                streak.minimum_recovery_count = 0;
                streak.minimum_display_count = 0;
                streak.max_recoveries_per_month = 999;
                streak.free_recoveries_remaining = 999;
                streak.recovery_window_hours = 720;
                streak.auto_freeze_enabled = true;
                obj.entries.streak_config = JSON.stringify(streak);
            } catch (e) {}

            Object.assign(obj.entries, {
                streak_freeze_enabled: "true",
                unlimited_streak_recovery: "true",
                streak_restore_free: "true",
                moment_views_enabled: "true",
                moment_views_v2: "true",
                record_moment_views: "true",
                notify_moment_views: "false",
                send_read_receipts: "false",
                typing_indicators_send_enabled: "false",
                get_moment_views_as_cloud_function: "true",
                moment_reactions_v2: "true",
                chat_reactions_enabled: "true",
                conversation_reactions: "true",
                typing_indicators_enabled: "true",
                unsend_message_enabled: "true",
                reply_prototype_enabled: "true",
                messages_integration: "true",
                conversations_enabled: "true",
                fetch_moments_in_conversation: "true",
                hide_chat_button: "false",
                groups_enabled: "true",
                group_contact_invites_enabled: "true",
                groups_onboarding_accept_invite_preview_enabled: "true",
                chat_hyperlink_enabled_mode: "always_enabled",
                send_to_self_only_mode: "always_enabled",
                time_travel_rewind_v2_enabled: "true",
                conversation_drafts_enabled: "true",
                calendar_delete_moment_enabled: "true",
                calendar_rewind_enabled: "false",
                locket_yearbook_story_sharing_encouraged: "true",
                yearbook_2025_enabled: "true",
                yearbook_2026_enabled: "true",
                locket_wrapped_enabled: "true",
                memories_on_this_day_enabled: "true",
                time_machine_enabled: "true",
                calendar_memories_highlight: "true",
                voice_notes_enabled: "true",
                moment_voice_memo_enabled: "true",
                chat_voice_messages_enabled: "true",
                audio_captions_max_duration: "30",
                rollcall_enabled: "true",
                rollcall_comment_actions: "true",
                rollcall_profile_button: "true",
                rollcall_prompt_export_after_share: "true",
                rollcall_confirm_skip_tagging: "false",
                rollcall_tap_to_tag_enabled: "false"
            });

            // ============================================================
            // 6. WIDGET, THÔNG BÁO & BẬT HIỆU ỨNG ANIMATION TRONG APP
            // ============================================================
            var listFrames = [
                "https://i.ibb.co/xtK4tVYR/Code-Generated-Image-3.png",
                "https://i.ibb.co/7JqNdfDH/Code-Generated-Image-2.png",
                "https://i.ibb.co/9338Jh6V/Code-Generated-Image-1.png",
                "https://i.ibb.co/C5YV63v1/Code-Generated-Image.png",
                "https://i.ibb.co/1Yt1Dzzy/Shin-chan-1.png",
                "https://i.ibb.co/RTm5P1n9/kitty-1.png",
                "https://i.ibb.co/JjLZ3cvD/khung-ins.png"
            ];
            var randomFrame = listFrames[Math.floor(Math.random() * listFrames.length)];

            Object.assign(obj.entries, {
                widget_frame_event_max_images: "5",
                android_widget_frame_event_enabled: "true",
                widget_badge_enabled: "true",
                widget_badge_v2: "true",
                widget_stale_state_enabled: "false",
                widget_last_sent_indicator: "false",
                widget_sync_token_reload_mode: "clearTokenNever",
                widget_frame_event: JSON.stringify({
                    uid: "midautumn_2026",
                    url: randomFrame,
                    use_local_time_zone: true,
                    placement: "below",
                    start_at: "2020-01-01T00:00:00",
                    end_at: "2099-12-31T23:59:59"
                }),
                live_activity_onboarding: "true",
                live_activity_onboarding_variant: "friending",
                register_live_activity_push_to_start_token: "true",
                live_activity_remove_stale_start_token: "true",
                notification_preferences_live_activities: "true",
                notification_preferences: "true",
                notification_reply_body_visible: "true",
                prompt_notification_permissions_after_friending: "true",
                activity_bar_enabled: "true",
                journal_activity_bar_enabled: "true",
                journal_settings: JSON.stringify({
                    debug_menu_enabled: false,
                    focus_animation: true,
                    compact_header: true,
                    friends_button: false,
                    reverse_scroll_direction: false,
                    streak_visualization: true,
                    streak_visualization_style: "gradient",
                    streak_header_minimum_count: 0,
                    streak_visualization_minimum_count: 2,
                    overlay_indicators: { location: false, music: true, static_content: true, weather: true }
                }),
                qr_code_config: JSON.stringify({ profile_enabled: true, scanning_enabled: true }),
                custom_profile_pics: "true",
                profile_menu_v2_enabled: "true"
            });

            // ============================================================
            // 7. HỆ THỐNG, CACHE & ÉP LÀM MỚI LIÊN TỤC
            // ============================================================
            Object.assign(obj.entries, {
                cdn_domain_replacements: JSON.stringify({ "firebasestorage.googleapis.com": "cdn.locketcamera.com" }),
                cdn_domain_replacements_video: "true",
                storage_bucket: "gs://locket-img",
                storage_bucket_video: "gs://locket-video",
                image_cache_max_age_sec: "157680000",
                image_cache_max_size: "400000000",
                history_cache_age_days: "1000",
                user_cache_max_age_sec: "691200",
                friends_cache_max_age_sec: "2592000",
                image_fetch_cache: "true",
                image_cache_use_shared: "true",
                use_doc_dir_for_image_cache: "true",
                efficient_history_cache_invalidation: "true",
                timestamp_based_history_fetches: "true",
                get_latest_moment_v2: "true",
                fetch_users_from_cloud_function: "true",
                refresh_interval: "0",
                remote_config_refresh_interval: "0",
                minimum_fetch_interval_seconds: "0",
                force_refresh_on_foreground: "true",
                firestore_refresh_v2: "true",
                firestore_refresh_v3: "true",
                keychain_access_retries: "true",
                blocked_users_cached_sync_enabled: "true",
                beta_features_enabled: "true",
                join_testflight_enabled: "true",
                safety_center: "true",
                help_center: "true",
                support_v2: "true",
                privacy_choices_setting: "true",
                request_att_permission: "true",
                invite_link_preview_variant: "4",
                share_history_config: JSON.stringify({ prompt_enabled: false, fetching_enabled: true }),
                share_history_prompt_enabled: "false",
                use_thumbnails_for_sharing: "true",
                use_thumbnails_in_timeline: "true",
                persist_onboarding_step: "true",
                onboarding_contact_permission_step: "true"
            });

            // ============================================================
            // 8. OVERLAY, PHỤ ĐỀ VIDEO, TELEMETRY & KHO CUSTOM CAPTIONS
            // ============================================================
            var minutes = (now.getMinutes() < 10 ? "0" : "") + now.getMinutes();
            var daysOfWeek = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
            var currentDayName = daysOfWeek[now.getDay()];

            var dayPercent = Math.floor(((hours * 60 + now.getMinutes()) / 1440) * 100);
            var filledBlocks = Math.floor(dayPercent / 10);
            var progressBar = "█".repeat(filledBlocks) + "▒".repeat(10 - filledBlocks);

            var targetDate = new Date("2027-01-01T00:00:00");
            var daysLeft2027 = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));

            var tetDate = new Date("2027-02-06T00:00:00");
            var daysLeftTet = Math.ceil((tetDate - now) / (1000 * 60 * 60 * 24));

            var fortunes = [
                "Quẻ hôm nay: Đại Cát • Tiền tài rủng rỉnh 💰",
                "Quẻ hôm nay: Đào Hoa • Có người thầm nhớ 💘",
                "Quẻ hôm nay: Thuận Buồm Xuôi Gió ⛵",
                "Quẻ hôm nay: Quý Nhân Phù Trợ ✨",
                "Quẻ hôm nay: Vạn Sự Như Ý • Không dính Bug 🎯"
            ];
            var randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
            var randomRpm = Math.floor(Math.random() * 2000) + 6500;

            var autoStatusText = "Đang chill • " + hours + ":" + minutes;
            if (hours >= 22 || hours < 4) autoStatusText = hours + ":" + minutes + " • Cú đêm thức tỉnh 🦉";
            else if (hours >= 4 && hours < 9) autoStatusText = hours + ":" + minutes + " • Khởi động ngày mới ☕";
            else if (hours >= 11 && hours < 14) autoStatusText = hours + ":" + minutes + " • Nạp năng lượng buổi trưa 🍱";
            else if (hours >= 17 && hours < 22) autoStatusText = hours + ":" + minutes + " • Lên đồ dạo phố 🌃";

            var overlaySections = [
                {
                    section: "🎨 General",
                    items: [
                        { overlay_id: "caption:standard", source: "local", caption: { type: "standard" } },
                        { overlay_id: "caption:transcript", source: "local", caption: { type: "transcript" } },
                        { overlay_id: "caption:subtitles", source: "local", caption: { type: "subtitles" } },
                        { overlay_id: "caption:link", source: "local", caption: { type: "link" }, overlay_type: "caption" },
                        { overlay_id: "caption:review", source: "local", caption: { type: "review" } },
                        { overlay_id: "caption:poll", source: "local", caption: { type: "poll" } },
                        { overlay_id: "caption:music", source: "local", caption: { type: "music" } },
                        { overlay_id: "caption:location", source: "local", caption: { type: "location" } },
                        { overlay_id: "caption:weather", source: "local", caption: { type: "weather" } },
                        { overlay_id: "caption:time", source: "local", caption: { type: "time" } },
                        { overlay_id: "caption:streak", source: "local", caption: { type: "streak" } },
                        { overlay_id: "caption:star_sign", source: "local", caption: { type: "star_sign" } },
                        { overlay_id: "caption:color_palette", source: "local", caption: { type: "color_palette" } },
                        { overlay_id: "caption:live", source: "local", caption: { type: "live" } },
                        { overlay_id: "caption:locket_count", source: "local", caption: { type: "locket_count" } }
                    ]
                },
                {
                    section: "🎵 TikTok Trends & Vibes 🔥",
                    items: [
                        { overlay_id: "caption:tiktok_live", source: "remote", caption: { background: { colors: ["#FF0050", "#00F2FE"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "dot.radiowaves.left.and.right", color: "#FFFFFF" }, max_lines: 1, text: "LIVE • 99.9K mắt đang xem 👀", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:tiktok_fyp", source: "remote", caption: { background: { colors: ["#000000", "#1C1C1E"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "sparkles", color: "#00F2FE" }, max_lines: 1, text: "Xu hướng #xuhuong #fyp #viral 🔥", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:tiktok_pov", source: "remote", caption: { background: { colors: ["#232526", "#414345"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "video.fill", color: "#FF0050" }, max_lines: 1, text: "POV: Khi bạn lướt trúng chiếc ảnh này ✨", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:tiktok_sound", source: "remote", caption: { background: { colors: ["#141E30", "#243B55"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "music.note", color: "#00F2FE" }, max_lines: 1, text: "Âm thanh gốc - Hot Trend TikTok 🎶", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:tiktok_verified", source: "remote", caption: { background: { colors: ["#000000", "#2C2C2E"] }, icon: { type: "sf_symbol", data: "checkmark.seal.fill", color: "#20D5EC" }, max_lines: 1, text: "Tài khoản TikToker đã xác minh ✔️", text_color: "#FFFFFF", type: "static_content" } }
                    ]
                },
                {
                    section: "🎬 Phụ Đề & Lời Video (Video Subtitles) 🎙️",
                    items: [
                        { overlay_id: "caption:vid_turn_on_sound", source: "remote", caption: { background: { colors: ["#000000", "#1C1C1E"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "speaker.wave.3.fill", color: "#38EF7D" }, max_lines: 1, text: "Bật tiếng lên nghe tui nói nè 🔊", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:vid_singing", source: "remote", caption: { background: { colors: ["#1F1C2C", "#928DAB"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "music.mic", color: "#FFD700" }, max_lines: 1, text: "Đang hát nghêu ngao • Đừng chê nha 🎤🎶", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:vid_listen_carefully", source: "remote", caption: { background: { colors: ["#141E30", "#243B55"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "waveform", color: "#00F2FE" }, max_lines: 1, text: "Nghe kỹ đoạn này nha 🎧✨", text_color: "#00F2FE", type: "static_content" } },
                        { overlay_id: "caption:vid_talking", source: "remote", caption: { background: { colors: ["#3A1C71", "#D76D77"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "captions.bubble.fill", color: "#FFFFFF" }, max_lines: 1, text: "[Phụ đề]: Lời tâm sự từ đáy lòng 💬", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:vid_no_sound", source: "remote", caption: { background: { colors: ["#232526", "#414345"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "speaker.slash.fill", color: "#FF4B2B" }, max_lines: 1, text: "Clip không tiếng, nhìn biểu cảm là hiểu 🤫", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:vid_live_cam", source: "remote", caption: { background: { colors: ["#8B0000", "#FF2A2A"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "record.circle", color: "#FFFFFF" }, max_lines: 1, text: "REC • Quay trực tiếp không cắt ghép 🎥", text_color: "#FFFFFF", type: "static_content" } }
                    ]
                },
                {
                    section: "🎉 Chúc Mừng Ngày Lễ (Holiday Events) 🎆",
                    items: [
                        { overlay_id: "caption:holiday_20_10", source: "remote", caption: { background: { colors: ["#FF758C", "#FF7EB3", "#FFC3A0"] }, icon: { data: "💐", type: "emoji" }, max_lines: 1, text: "Chúc mừng 20/10 • Luôn xinh đẹp rạng rỡ 🌷", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:halloween_2026", source: "remote", caption: { background: { colors: ["#150804", "#C8540D"] }, icon: { data: "🎃", type: "emoji" }, max_lines: 1, text: "Halloween", localized_text: { en: "Halloween", vn: "Halloween" }, text_color: "#FFB182", type: "static_content" } },
                        { overlay_id: "caption:holiday_20_11", source: "remote", caption: { background: { colors: ["#1A2980", "#26D0CE"] }, icon: { data: "🎓", type: "emoji" }, max_lines: 1, text: "Mừng Ngày Nhà Giáo VN 20/11 📚", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:christmas_eve_2026", source: "remote", caption: { background: { colors: ["#2FA85F", "#176B3A"] }, icon: { data: "🕯️", type: "emoji" }, max_lines: 1, text: "Giáng sinh an lành", localized_text: { en: "Giáng sinh an lành", vn: "Giáng sinh an lành" }, text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:christmas_day_2026", source: "remote", caption: { background: { colors: ["#E53935", "#A81818"] }, icon: { data: "🎄", type: "emoji" }, max_lines: 1, text: "Merry Christmas 🎅❄️", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:new_years_eve_2026", source: "remote", caption: { background: { colors: ["#FFC64B", "#FFEDBF"] }, icon: { data: "🥂", type: "emoji" }, max_lines: 1, text: "Xin chào 2027!", localized_text: { en: "Xin chào 2027!", vn: "Xin chào 2027!" }, text_color: "#643F00", type: "static_content" } },
                        { overlay_id: "caption:new_years_day_2027", source: "remote", caption: { background: { colors: ["#3B00EC", "#823FFF"] }, icon: { data: "💫", type: "emoji" }, max_lines: 1, text: "Happy New Year 2027! 🎆", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:holiday_tet_am", source: "remote", caption: { background: { colors: ["#D31027", "#EA384D"] }, icon: { data: "🧧", type: "emoji" }, max_lines: 1, text: "Cung Chúc Tân Xuân • Vạn Sự Như Ý 🌸", text_color: "#FFD700", type: "static_content" } },
                        { overlay_id: "caption:holiday_valentine", source: "remote", caption: { background: { colors: ["#FF0844", "#FFB199"] }, icon: { data: "💘", type: "emoji" }, max_lines: 1, text: "Happy Valentine's Day 14/2 🍫💕", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:holiday_8_3", source: "remote", caption: { background: { colors: ["#F857A6", "#FF5858"] }, icon: { data: "👑", type: "emoji" }, max_lines: 1, text: "Happy Women's Day 8/3 🌸", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:holiday_30_4", source: "remote", caption: { background: { colors: ["#DA251D", "#B71C1C"] }, icon: { data: "🇻🇳", type: "emoji" }, max_lines: 1, text: "Chào Mừng Đại Lễ 30/4 - 1/5 🌟", text_color: "#FFD700", type: "static_content" } },
                        { overlay_id: "caption:holiday_2_9", source: "remote", caption: { background: { colors: ["#DA251D", "#FF9800"] }, icon: { data: "🇻🇳", type: "emoji" }, max_lines: 1, text: "Mừng Quốc Khánh 2/9 🇻🇳✨", text_color: "#FFD700", type: "static_content" } },
                        { overlay_id: "caption:autumn_2026", source: "remote", caption: { background: { colors: ["#FFE0A0", "#F6A53A"] }, icon: { data: "🍂", type: "emoji" }, max_lines: 1, text: "Xin chào Mùa Thu", localized_text: { en: "Xin chào Mùa Thu", vn: "Xin chào Mùa Thu" }, text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:new_years_day_2027_alternate", source: "remote", caption: { background: { colors: ["#FF0062", "#FF783F"] }, max_lines: 1, text: "2027", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:no_memory", source: "remote", caption: { background: { image: { type: "image", data: "https://public.locketcamera.com/locket-public/overlays/forgotten_island/forgotten_island_bg.png", source: "url" }, colors: ["#1A1A2E", "#16213E"] }, max_lines: 1, text: "NO MEMORY LEFT BEHIND", text_color: "#FFFFFFE6", type: "static_content" } }
                    ]
                },
                {
                    section: "⚡ Tự Động Hóa (Real-Time) ⏱️",
                    items: [
                        { overlay_id: "caption:realtime_status", source: "remote", caption: { background: { colors: ["#141E30", "#243B55"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "clock.badge.checkmark.fill", color: "#00F2FE" }, max_lines: 1, text: autoStatusText, text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:day_progress", source: "remote", caption: { background: { colors: ["#000000", "#434343"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "battery.100.bolt", color: "#38EF7D" }, max_lines: 1, text: "Hôm nay: " + progressBar + " " + dayPercent + "%", text_color: "#38EF7D", type: "static_content" } },
                        { overlay_id: "caption:day_of_week_vibe", source: "remote", caption: { background: { colors: ["#3A1C71", "#D76D77", "#FFAF7B"] }, icon: { data: "📅", type: "emoji" }, max_lines: 1, text: currentDayName + " rồi, lên kèo thôi!", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:countdown_2027", source: "remote", caption: { background: { colors: ["#8E2DE2", "#4A00E0"] }, icon: { data: "⏳", type: "emoji" }, max_lines: 1, text: "Còn " + daysLeft2027 + " ngày nữa tới 2027 ✨", text_color: "#FFD700", type: "static_content" } },
                        { overlay_id: "caption:countdown_tet", source: "remote", caption: { background: { colors: ["#D31027", "#EA384D"] }, icon: { data: "🧧", type: "emoji" }, max_lines: 1, text: "Còn " + daysLeftTet + " ngày nữa là tới Tết Âm 2027 🌸", text_color: "#FFD700", type: "static_content" } },
                        { overlay_id: "caption:daily_fortune", source: "remote", caption: { background: { colors: ["#1F1C2C", "#928DAB"], material_blur: "ultra_thin" }, icon: { data: "🔮", type: "emoji" }, max_lines: 1, text: randomFortune, text_color: "#FFD700", type: "static_content" } }
                    ]
                },
                {
                    section: "🏎️ Speed, Gaming & Coding 🎮",
                    items: [
                        { overlay_id: "caption:hud_telemetry", source: "remote", caption: { background: { colors: ["#000000", "#1C1C1E"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "gauge.with.dots.needle.100percent", color: "#00FF87" }, max_lines: 1, text: "SPORT+ • " + randomRpm + " RPM • TURBO 1.4 BAR 🏎️", text_color: "#00FF87", type: "static_content" } },
                        { overlay_id: "caption:dashcam_rec", source: "remote", caption: { background: { colors: ["#141E30", "#243B55"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "video.badge.checkmark", color: "#00F2FE" }, max_lines: 1, text: "REC ● [" + day + "/" + month + "/" + now.getFullYear() + " " + hours + ":" + minutes + "] • GPS ACTIVE", text_color: "#00F2FE", type: "static_content" } },
                        { overlay_id: "caption:sport_plus_mode", source: "remote", caption: { background: { colors: ["#000000", "#2C0000", "#8B0000"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "gauge.with.dots.needle.100percent", color: "#FF2A2A" }, max_lines: 1, text: "SPORT+ MODE ACTIVATED", text_color: "#FF2A2A", type: "static_content" } },
                        { overlay_id: "caption:911_dream", source: "remote", caption: { background: { colors: ["#1C1C1E", "#2C2C2E"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "car.rear.and.tire.marks", color: "#FFD700" }, max_lines: 1, text: "Chăm chỉ cày cuốc rước 911 🏁", text_color: "#FFD700", type: "static_content" } },
                        { overlay_id: "caption:night_drive", source: "remote", caption: { background: { colors: ["#0F2027", "#203A43", "#2C5364"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "road.lanes", color: "#00F2FE" }, max_lines: 1, text: "Night Drive • Đóng căng đét", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:ecu_tuning", source: "remote", caption: { background: { colors: ["#000000", "#0A2E36"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "cpu.fill", color: "#00FF87" }, max_lines: 1, text: "Đã mở tua • Full Công Suất", text_color: "#00FF87", type: "static_content" } },
                        { overlay_id: "caption:gaming_mode", source: "remote", caption: { background: { colors: ["#0F0C29", "#302B63", "#24243E"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "gamecontroller.fill", color: "#00FF87" }, max_lines: 1, text: "Đang trong trận, đừng gọi!", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:coding_vibe", source: "remote", caption: { background: { colors: ["#000000", "#130F40"], material_blur: "ultra_thin" }, icon: { type: "sf_symbol", data: "terminal.fill", color: "#38EF7D" }, max_lines: 1, text: "Code chạy rồi, đừng đụng vào!", text_color: "#38EF7D", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Decorative by Locket",
                    items: [
                        { overlay_id: "caption:toi_nho_em", source: "remote", caption: { background: { colors: ["#FFFFFF", "#6D9EEB"] }, max_lines: 1, text: "보고 싶어 🥺", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:party_time", source: "remote", caption: { background: { colors: ["#5EFFF5", "#FCFF57"] }, icon: { data: "🪩", type: "emoji" }, max_lines: 1, text: "Party Time!", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:good_morning", source: "remote", daily_start_hour: 5, daily_end_hour: 10, caption: { background: { colors: ["#EF7402", "#EABF0F"] }, icon: { data: "☀️", type: "emoji" }, max_lines: 1, text: "Good morning", text_color: "#FFFFFFE5", type: "static_content" } },
                        { overlay_id: "caption:goodnight", source: "remote", daily_start_hour: 19.5, daily_end_hour: 24, caption: { background: { colors: ["#370C6F", "#575CD4"] }, icon: { data: "🌙", type: "emoji" }, max_lines: 1, text: "Goodnight", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:miss_you", source: "remote", caption: { background: { colors: ["#EC0C00", "#FF493F"] }, icon: { data: "🥰", type: "emoji" }, max_lines: 1, text: "Miss you", text_color: "#FFFFFFDB", type: "static_content" } },
                        { overlay_id: "caption:ootd", source: "remote", caption: { background: { colors: ["#FFFFFF", "#DBDBDB"] }, icon: { data: "🕶", type: "emoji" }, max_lines: 1, text: "OOTD", text_color: "#101010E6", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Decorative by Tu Bim",
                    items: [
                        { overlay_id: "caption:Tubim07", source: "remote", caption: { background: { colors: ["#B8E7FF", "#A8F5D0", "#DCCBFF"] }, max_lines: 1, text: "💻 Tubim07", text_color: "#183153", type: "static_content" } },
                        { overlay_id: "caption:cu", source: "remote", caption: { background: { colors: ["#FFD6A5", "#FFF1A8", "#FFC4D6"] }, max_lines: 1, text: "Cu 🐎", text_color: "#633B24", type: "static_content" } },
                        { overlay_id: "caption:tuat", source: "remote", caption: { background: { colors: ["#2C1A0E", "#5D4037", "#D7A86E"] }, icon: { data: "🐕", type: "emoji" }, max_lines: 1, text: "Tuất", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:snake_vibes", source: "remote", caption: { background: { colors: ["#2E7D32", "#66BB6A"] }, icon: { data: "🐍", type: "emoji" }, max_lines: 1, text: "Snake Vibes", localized_text: { en: "Snake Vibes", vn: "Chất rắn" }, text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:du_an_ma", source: "remote", caption: { background: { colors: ["#263238", "#455A64"] }, icon: { data: "👻", type: "emoji" }, max_lines: 1, text: "dự án ma", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:love_vietnam", source: "remote", alt_text: "Tôi yêu Việt Nam", caption: { background: { image: { type: "image", data: "https://i.ibb.co/hxFLgLxt/vietnam.jpg", source: "url" }, colors: ["#DA251D", "#FFFF00"] }, icon: { type: "image", data: "https://storage.googleapis.com/locket-public/journal_calendar_assets/holiday_indicators/valentines_indicator%403x.png", source: "url" }, max_lines: 1, text: "Tôi yêu Việt Nam", text_color: "#FFD700", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Caption Icon",
                    items: [
                        { overlay_id: "caption:icon_halloween", source: "remote", caption: { background: { colors: ["#FF7B00", "#331A00"], material_blur: "ultra_thin" }, icon: { type: "image", data: "https://storage.googleapis.com/locket-public/journal_calendar_assets/holiday_indicators/halloween_indicator%403x.png", source: "url" }, max_lines: 1, text: "Happy Halloween", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:icon_christmas", source: "remote", caption: { background: { colors: ["#D32F2F", "#1B5E20"], material_blur: "ultra_thin" }, icon: { type: "image", data: "https://storage.googleapis.com/locket-public/journal_calendar_assets/holiday_indicators/christmas_indicator%403x.png", source: "url" }, max_lines: 1, text: "Merry Christmas", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:icon_st_patricks", source: "remote", caption: { background: { colors: ["#00C853", "#004D40"], material_blur: "ultra_thin" }, icon: { type: "image", data: "https://storage.googleapis.com/locket-public/journal_calendar_assets/holiday_indicators/st_patricks_indicator%403x.png", source: "url" }, max_lines: 1, text: "Happy St. Patrick's Day", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:icon_fall", source: "remote", caption: { background: { colors: ["#E65100", "#3E2723"], material_blur: "ultra_thin" }, icon: { type: "image", data: "https://storage.googleapis.com/locket-public/journal_calendar_assets/holiday_indicators/thanksgiving_indicator%403x.png", source: "url" }, max_lines: 1, text: "Happy Thanksgiving", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:icon_valentines", source: "remote", caption: { background: { colors: ["#FF4081", "#880E4F"], material_blur: "ultra_thin" }, icon: { type: "image", data: "https://storage.googleapis.com/locket-public/journal_calendar_assets/holiday_indicators/valentines_indicator%403x.png", source: "url" }, max_lines: 1, text: "Happy Valentine's", text_color: "#FFFFFF", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Tình yêu & Cơm chó 💕",
                    items: [
                        { overlay_id: "caption:em_nho_anhh", source: "remote", caption: { background: { colors: ["#FF6B81", "#FF8E9E", "#FFB3C6"] }, icon: { data: "🥺", type: "emoji" }, max_lines: 1, text: "em nhớ anhh", text_color: "#8C1938", type: "static_content" } },
                        { overlay_id: "caption:nho_anh_phien", source: "remote", caption: { background: { colors: ["#F0B5CB", "#F6D0DF", "#DCCAF0"] }, icon: { data: "🥺", type: "emoji" }, max_lines: 1, text: "nhớ anh tới mức hơi phiền", text_color: "#70445A", type: "static_content" } },
                        { overlay_id: "caption:i_love_you", source: "remote", caption: { background: { colors: ["#FF8FAB", "#FFC2D1", "#FFE5EC"] }, icon: { data: "💗", type: "emoji" }, max_lines: 1, text: "i love you", text_color: "#8A304F", type: "static_content" } },
                        { overlay_id: "caption:yeu_cuc_dang", source: "remote", caption: { background: { colors: ["#F2B5C8", "#F8D5D9", "#F6E5D2"] }, icon: { data: "🎀", type: "emoji" }, max_lines: 1, text: "yêu cục dàng", text_color: "#754454", type: "static_content" } },
                        { overlay_id: "caption:yeu_emmm", source: "remote", caption: { background: { colors: ["#F2AFC6", "#F7C9D9", "#E5CFF4"] }, icon: { data: "💗", type: "emoji" }, max_lines: 1, text: "Yeu Emmm", text_color: "#70445C", type: "static_content" } },
                        { overlay_id: "caption:yeu_anhhh", source: "remote", caption: { background: { colors: ["#B8C9F2", "#D5DDF8", "#E8CFF0"] }, icon: { data: "🫶", type: "emoji" }, max_lines: 1, text: "Yeu Anhhh", text_color: "#414C72", type: "static_content" } },
                        { overlay_id: "caption:baby_love", source: "remote", caption: { background: { colors: ["#FFB6C1", "#FF69B4", "#FF1493"] }, icon: { data: "🧸", type: "emoji" }, max_lines: 1, text: "Baby Love 💖", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:muon_duoc_om", source: "remote", caption: { background: { colors: ["#FF9A9E", "#FECFEF"] }, icon: { data: "🫂", type: "emoji" }, max_lines: 1, text: "Muốn được ôm", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:cho_hun_mieng", source: "remote", caption: { background: { colors: ["#F3AFC7", "#F8D0D8", "#F4C9BB"] }, icon: { data: "😘", type: "emoji" }, max_lines: 1, text: "cho hun miếng coi", text_color: "#754252", type: "static_content" } },
                        { overlay_id: "caption:me_anh_me_ngu", source: "remote", caption: { background: { colors: ["#C4C8EF", "#DED3F4", "#EBCDE4"] }, icon: { data: "💤", type: "emoji" }, max_lines: 1, text: "mê anh hơn mê ngủ", text_color: "#4F4770", type: "static_content" } },
                        { overlay_id: "caption:be_be_can_do", source: "remote", caption: { background: { colors: ["#FF8FAB", "#FFC2D1", "#FFE5EC"] }, icon: { data: "🎀", type: "emoji" }, max_lines: 1, text: "em bé cần được dỗ", text_color: "#812D4A", type: "static_content" } },
                        { overlay_id: "caption:iu_thi_noi", source: "remote", caption: { background: { colors: ["#FFD166", "#FFE8A3", "#FFF3D0"] }, icon: { data: "🤭", type: "emoji" }, max_lines: 1, text: "iu thì nói, đừng có ngại", text_color: "#704510", type: "static_content" } },
                        { overlay_id: "caption:iu_hong_thi_bao", source: "remote", caption: { background: { colors: ["#FF6B6B", "#FF9999", "#FFD1C9"] }, icon: { data: "🎀", type: "emoji" }, max_lines: 1, text: "iu hong thì bảo", text_color: "#812626", type: "static_content" } },
                        { overlay_id: "caption:anh_thuong_em", source: "remote", caption: { background: { colors: ["#A0C4FF", "#BDE0FE", "#DFF3FF"] }, icon: { data: "🥹", type: "emoji" }, max_lines: 1, text: "anh có thương em thiệt hong", text_color: "#23466F", type: "static_content" } },
                        { overlay_id: "caption:yeu_em_nhiem_vu", source: "remote", caption: { background: { colors: ["#B7E4C7", "#D8F3DC", "#F0FFF1"] }, icon: { data: "🫡", type: "emoji" }, max_lines: 1, text: "yêu em là nhiệm vụ cả đời", text_color: "#24563A", type: "static_content" } },
                        { overlay_id: "caption:crush_nhin", source: "remote", caption: { background: { colors: ["#CDB4DB", "#E2CFEA", "#F3E5F5"] }, icon: { data: "🫠", type: "emoji" }, max_lines: 1, text: "crush nhìn em một cái là xong", text_color: "#593B68", type: "static_content" } },
                        { overlay_id: "caption:ngoai_le_cua_em", source: "remote", caption: { background: { colors: ["#80CBC4", "#B2DFDB", "#E0F2F1"] }, icon: { data: "🫶", type: "emoji" }, max_lines: 1, text: "anh là ngoại lệ của em", text_color: "#205953", type: "static_content" } },
                        { overlay_id: "caption:dang_ban_tuong_tu", source: "remote", caption: { background: { colors: ["#1A2980", "#26D0CE"] }, icon: { data: "💭", type: "emoji" }, max_lines: 1, text: "Đang bận tương tư", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:mac_bay_tinh_yeu", source: "remote", caption: { background: { colors: ["#EE9CA7", "#FFDDE1"] }, icon: { data: "💘", type: "emoji" }, max_lines: 1, text: "Mắc bẫy tình yêu", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:minh_cuoi_nhau", source: "remote", caption: { background: { colors: ["#F0B8CD", "#F7D4DF", "#E7C9EF"] }, icon: { data: "💍", type: "emoji" }, max_lines: 1, text: "hông ấy mình cưới nhau đi", text_color: "#70465B", type: "static_content" } },
                        { overlay_id: "caption:wedding_time", source: "remote", caption: { background: { colors: ["#FFE4E1", "#E73C7E"] }, icon: { data: "💍", type: "emoji" }, max_lines: 1, text: "Wedding Time!", localized_text: { en: "Wedding Time!", vn: "Đám cưới nè!" }, text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:dating_time", source: "remote", caption: { background: { colors: ["#E91E63", "#F44336"] }, icon: { data: "💕", type: "emoji" }, max_lines: 1, text: "Dating Time!", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:tuong_love_hoa_ra_lop", source: "remote", caption: { background: { colors: ["#C9184A", "#FF4D6D", "#FFB3C6"] }, icon: { data: "❤️‍🩹", type: "emoji" }, max_lines: 1, text: "Tưởng love hoá ra lốp", text_color: "#64152F", type: "static_content" } },
                        { overlay_id: "caption:cam_thay_hanh_phuc", source: "remote", caption: { background: { colors: ["#EC407A", "#F8BBD0"] }, icon: { data: "🇻🇳", type: "emoji" }, max_lines: 1, text: "Cảm thấy hạnh phúc", localized_text: { en: "Feeling Happy", vn: "Cảm thấy hạnh phúc" }, text_color: "#FFFFFFE6", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Gen Z & Xéo xắt 💅",
                    items: [
                        { overlay_id: "caption:feeling_cute", source: "remote", caption: { background: { colors: ["#F8BBD0", "#E91E63"] }, icon: { data: "🌷", type: "emoji" }, max_lines: 1, text: "Feeling Cute", localized_text: { en: "Feeling Cute", vn: "Cảm thấy dthw" }, text_color: "#FFFFFFE5", type: "static_content" } },
                        { overlay_id: "caption:cutie_pie", source: "remote", caption: { background: { colors: ["#FFDEE9", "#FFB6C1", "#FF9AA2"] }, icon: { data: "🎀", type: "emoji" }, max_lines: 1, text: "Cutie Pie 🌸", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:hello_kitty", source: "remote", caption: { background: { colors: ["#FFD1DC", "#FFB7C5", "#FFC0CB"] }, icon: { data: "🌸", type: "emoji" }, max_lines: 1, text: "Hello Kitty 🐱", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:ngoan_xinh_iu", source: "remote", caption: { background: { colors: ["#F3C1D4", "#F8DDE5", "#E8CFF0"] }, icon: { data: "💗", type: "emoji" }, max_lines: 1, text: "ngoan xinh iu của ai đây", text_color: "#71465D", type: "static_content" } },
                        { overlay_id: "caption:xinh_dep_tuyet_voi", source: "remote", caption: { background: { colors: ["#FC5C7D", "#6A82FB"] }, icon: { data: "💅", type: "emoji" }, max_lines: 1, text: "Xinh đẹp tuyệt vời", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:hom_nay_slay", source: "remote", caption: { background: { colors: ["#C5B5E8", "#DDD0F2", "#F0C9DD"] }, icon: { type: "sf_symbol", data: "sparkles", color: "#514368" }, max_lines: 1, text: "hôm nay cũng slay", text_color: "#514368", type: "static_content" } },
                        { overlay_id: "caption:tinh_hoa_hoi_tu", source: "remote", caption: { background: { image: { type: "image", data: "star_sign_background", source: "local" }, colors: ["#FFD700", "#FF8C00"] }, icon: { type: "sf_symbol", data: "wand.and.sparkles", color: "#000000E6" }, max_lines: 1, text: "Tinh hoa hội tụ", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:xinh_gai_an_phim_1", source: "remote", caption: { background: { colors: ["#F77062", "#FE5196"] }, icon: { data: "💅", type: "emoji" }, max_lines: 1, text: "Xinh gái ấn phím 1", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:xinh_la_tai_nang", source: "remote", caption: { background: { colors: ["#F0B5CA", "#F5D2DD", "#EAD1F0"] }, icon: { data: "🎀", type: "emoji" }, max_lines: 1, text: "xinh là một loại tài năng", text_color: "#70435B", type: "static_content" } },
                        { overlay_id: "caption:dep_trai_co_gi_sai", source: "remote", caption: { background: { colors: ["#FF5722", "#FFC107"] }, icon: { data: "😎", type: "emoji" }, max_lines: 1, text: "Đẹp trai có gì sai", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:dep_khong_ly_do", source: "remote", caption: { background: { colors: ["#E5B7CD", "#F0D0DC", "#DCCCF0"] }, icon: { data: "🪞", type: "emoji" }, max_lines: 1, text: "đẹp không cần lý do", text_color: "#67455C", type: "static_content" } },
                        { overlay_id: "caption:cha_nay_tu_luyen_ghe", source: "remote", caption: { background: { colors: ["#FFDEE9", "#B5FFFC", "#FAD0C4", "#FFD1FF"] }, icon: { data: "🪞", type: "emoji" }, max_lines: 1, text: "Cha này tự luyến ghê", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:phu_tinh_khong_phu_ban", source: "remote", caption: { background: { colors: ["#8E2DE2", "#4A00E0"] }, icon: { data: "🕶️", type: "emoji" }, max_lines: 1, text: "Phụ tình không phụ bản", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:main_character", source: "remote", caption: { background: { colors: ["#D6B8E8", "#E8CDEB", "#F3D2D9"] }, icon: { type: "sf_symbol", data: "movieclapper.fill", color: "#5A4366" }, max_lines: 1, text: "main character của cuộc đời mình", text_color: "#5A4366", type: "static_content" } },
                        { overlay_id: "caption:vibe_khong_phai_ai", source: "remote", caption: { background: { colors: ["#80D8FF", "#A0F0E0", "#D9FFF5"] }, icon: { data: "🪩", type: "emoji" }, max_lines: 1, text: "vibe này ko phải ai cũng có", text_color: "#174C58", type: "static_content" } },
                        { overlay_id: "caption:khi_chat", source: "remote", caption: { background: { colors: ["#FFB36B", "#FFD49B", "#FFF0C2"] }, icon: { data: "😎", type: "emoji" }, max_lines: 1, text: "không hoàn hảo nhưng có khí chất", text_color: "#713D20", type: "static_content" } },
                        { overlay_id: "caption:sieu_cap_ba_khi", source: "remote", caption: { background: { colors: ["#EC407A", "#F44336"] }, icon: { data: "🐉", type: "emoji" }, max_lines: 1, text: "siêu cấp bá khí", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:ba_khi", source: "remote", caption: { background: { colors: ["#8EACCD", "#B5C8DE", "#D7C7E6"] }, icon: { data: "😎", type: "emoji" }, max_lines: 1, text: "bá khí ngang ngược", text_color: "#35475D", type: "static_content" } },
                        { overlay_id: "caption:du_ba_khi_chua", source: "remote", caption: { background: { colors: ["#CBB4DE", "#DFCBEA", "#F2E3F7"] }, icon: { data: "👑", type: "emoji" }, max_lines: 1, text: "Đủ bá khí chưa?", text_color: "#4C385C", type: "static_content" } },
                        { overlay_id: "caption:oach_xa_lach", source: "remote", caption: { background: { colors: ["#11998E", "#38EF7D"] }, icon: { data: "🥬", type: "emoji" }, max_lines: 1, text: "oách xà lách", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:cung_cung_di", source: "remote", caption: { background: { colors: ["#FF7043", "#FF8A50", "#FFCA70"] }, icon: { data: "🚀", type: "emoji" }, max_lines: 1, text: "Cũng cứng đi", text_color: "#592313", type: "static_content" } },
                        { overlay_id: "caption:ra_duong_ne_moi_anh", source: "remote", caption: { background: { colors: ["#BCC5D6", "#D7DEEA", "#EDE8F5"] }, icon: { data: "🕶️", type: "emoji" }, max_lines: 1, text: "Ra đường nể mỗi anh", text_color: "#384358", type: "static_content" } },
                        { overlay_id: "caption:nhin_la_biet_uy_tin", source: "remote", caption: { background: { colors: ["#2980B9", "#2C3E50"] }, icon: { data: "👌", type: "emoji" }, max_lines: 1, text: "Nhìn là biết uy tín", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:flex_den_hoi_tho_cuoi", source: "remote", caption: { background: { colors: ["#00BFA5", "#64E8C8", "#C4FFF0"] }, icon: { data: "💎", type: "emoji" }, max_lines: 1, text: "Flex đến hơi thở cuối", text_color: "#064D43", type: "static_content" } },
                        { overlay_id: "caption:tui_khong_hon_thua", source: "remote", caption: { background: { colors: ["#8E2430", "#C0394B", "#F08A8E"] }, icon: { data: "😎", type: "emoji" }, max_lines: 1, text: "tui không hơn thua, tui hơn hẳn", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:hon_hom_qua", source: "remote", caption: { background: { colors: ["#B9D7D0", "#D6E6D7", "#E8DFC6"] }, icon: { data: "🫶", type: "emoji" }, max_lines: 1, text: "tui không hơn ai, tui hơn hôm qua", text_color: "#3F554E", type: "static_content" } },
                        { overlay_id: "caption:khong_phai_gu", source: "remote", caption: { background: { colors: ["#FF6F91", "#FF9A9E", "#FFD1BA"] }, icon: { data: "💅", type: "emoji" }, max_lines: 1, text: "không phải gu của tất cả, may quá", text_color: "#70243D", type: "static_content" } },
                        { overlay_id: "caption:quan_trong_lam", source: "remote", caption: { background: { colors: ["#7566D9", "#9B8AFB", "#D2C8FF"] }, icon: { data: "💅", type: "emoji" }, max_lines: 1, text: "ủa tưởng mình quan trọng lắm?", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:cai_net_ky", source: "remote", caption: { background: { colors: ["#B7D96C", "#D9ED9A", "#F1F7C8"] }, icon: { data: "😒", type: "emoji" }, max_lines: 1, text: "cái nết kỳ ghê", text_color: "#35451B", type: "static_content" } },
                        { overlay_id: "caption:ghet_dua_kia_ghe", source: "remote", caption: { background: { colors: ["#52647A", "#7D91A8", "#BBC9D8"] }, icon: { data: "😒", type: "emoji" }, max_lines: 1, text: "ghét đứa kia ghê 😒", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:khong_ghet_khong_ua", source: "remote", caption: { background: { colors: ["#FFAB40", "#FFD180", "#FFF0C2"] }, icon: { data: "😒", type: "emoji" }, max_lines: 1, text: "không ghét, chỉ không ưa", text_color: "#633B12", type: "static_content" } },
                        { overlay_id: "caption:toi_song_the_day", source: "remote", caption: { background: { colors: ["#202124", "#525866", "#AAB2C0"] }, icon: { data: "😎", type: "emoji" }, max_lines: 1, text: "Tôi sống thế đấy", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:che_manh", source: "remote", caption: { background: { colors: ["#FF4E50", "#F9D423"] }, icon: { data: "👎", type: "emoji" }, max_lines: 1, text: "Chê mạnh", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:chua_du_wow", source: "remote", caption: { background: { colors: ["#FFD1DC", "#FFB7C5", "#FFE4E1"] }, icon: { data: "🎀", type: "emoji" }, max_lines: 1, text: "Chưa đủ wow", text_color: "#6E4254", type: "static_content" } },
                        { overlay_id: "caption:roi_let_luon", source: "remote", caption: { background: { colors: ["#FF9A9E", "#FECFEF", "#FBC2EB", "#A6C1EE"] }, icon: { data: "💅", type: "emoji" }, max_lines: 1, text: "rồi lét luôn", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:roi_gay_luon", source: "remote", caption: { background: { colors: ["#FF6EC7", "#7873F5", "#4ADEDE", "#FFE66D"] }, icon: { data: "🌈", type: "emoji" }, max_lines: 1, text: "rồi gay luôn", text_color: "#FFFFFFE6", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Meme & Hài hước 🤡",
                    items: [
                        { overlay_id: "caption:cuoi_vcl_m_oi", source: "remote", caption: { background: { colors: ["#F7971E", "#FFD200", "#FFEE58"] }, icon: { data: "😂", type: "emoji" }, max_lines: 1, text: "Cười vcl m oi", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:cuoi_xiu", source: "remote", caption: { background: { colors: ["#FFEB3B", "#FF9800"] }, icon: { data: "😎", type: "emoji" }, max_lines: 1, text: "Cười xỉu", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:luon_vui_tuoi", source: "remote", caption: { background: { colors: ["#00F2FE", "#4FACFE"] }, icon: { data: "🤡", type: "emoji" }, max_lines: 1, text: "Luôn vui tươi", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:nau_xoi", source: "remote", caption: { background: { colors: ["#B8E04A", "#D9F477", "#F5FFB8"] }, icon: { data: "🙀", type: "emoji" }, max_lines: 1, text: "Nấu xói", text_color: "#394713", type: "static_content" } },
                        { overlay_id: "caption:con_vien_la_lan", source: "remote", caption: { background: { colors: ["#A8C3A0", "#DCE5D1"] }, icon: { data: "🍂", type: "emoji" }, max_lines: 1, text: "côn viên lá làn", text_color: "#344536", type: "static_content" } },
                        { overlay_id: "caption:gian_dang_iu_hong", source: "remote", caption: { background: { colors: ["#A8E6CF", "#D4F1BE", "#FFF1B6"] }, icon: { data: "🪳", type: "emoji" }, max_lines: 1, text: "Gián đáng iu hong", text_color: "#315847", type: "static_content" } },
                        { overlay_id: "caption:am_cha_hui", source: "remote", caption: { background: { colors: ["#F1C0D2", "#F5D9E1", "#E7D1F2"] }, icon: { data: "🎀", type: "emoji" }, max_lines: 1, text: "ăm chã húi, bà chã hơm", text_color: "#70475C", type: "static_content" } },
                        { overlay_id: "caption:hong_drama", source: "remote", caption: { background: { colors: ["#8A2387", "#E94057", "#F27121"] }, icon: { data: "🍿", type: "emoji" }, max_lines: 1, text: "Hóng drama", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:ke_chuyen_nghe_choi", source: "remote", caption: { background: { colors: ["#8A2387", "#E94057"] }, icon: { data: "🍿", type: "emoji" }, max_lines: 1, text: "Kể chuyện nghe chơi", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:drama_ai_hong", source: "remote", caption: { background: { colors: ["#F0C4A8", "#F3D8B8", "#D8C6E5"] }, icon: { data: "🍿", type: "emoji" }, max_lines: 1, text: "thân ai nấy lo, drama ai nấy hóng", text_color: "#624736", type: "static_content" } },
                        { overlay_id: "caption:check_var", source: "remote", caption: { background: { colors: ["#11998E", "#38EF7D"] }, icon: { data: "📺", type: "emoji" }, max_lines: 1, text: "Check VAR liền", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:co_bien_co_bien", source: "remote", caption: { background: { colors: ["#FF512F", "#F09819", "#FFD200"] }, icon: { type: "sf_symbol", data: "light.beacon.max.fill", color: "#FFFFFFE6" }, max_lines: 1, text: "Có biến có biến", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:so_ho_la_bao", source: "remote", caption: { background: { colors: ["#F5B8A9", "#F6D0B2", "#E8BFCB"] }, icon: { data: "🚨", type: "emoji" }, max_lines: 1, text: "sơ hở là báo", text_color: "#713F40", type: "static_content" } },
                        { overlay_id: "caption:bot_bao", source: "remote", caption: { background: { colors: ["#7AA6C2", "#B0C9D9", "#DCE8EF"] }, icon: { data: "🚨", type: "emoji" }, max_lines: 1, text: "bớt báo giùm cái", text_color: "#29485D", type: "static_content" } },
                        { overlay_id: "caption:ai_so_thi_di_ve", source: "remote", caption: { background: { colors: ["#B71C1C", "#FF5722"] }, icon: { data: "🏃", type: "emoji" }, max_lines: 1, text: "ai sợ thì đi về", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:chay_ngay_di", source: "remote", caption: { background: { colors: ["#D31027", "#EA384D"] }, icon: { data: "🏃💨", type: "emoji" }, max_lines: 1, text: "Chạy ngay đi", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:len_chua_khong_biet_lay_ai", source: "remote", caption: { background: { colors: ["#D7CCC8", "#EFEBE9", "#F5F5F0"] }, icon: { data: "🙏🥺", type: "emoji" }, max_lines: 1, text: "lên chùa không biết lạy ai", text_color: "#5D4037", type: "static_content" } },
                        { overlay_id: "caption:dam_nhau_khong", source: "remote", caption: { background: { colors: ["#E53935", "#FF7043"] }, icon: { data: "🥊", type: "emoji" }, max_lines: 1, text: "đấm nhau không", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:hao_han", source: "remote", caption: { background: { colors: ["#292E49", "#8E3B46", "#E09F3E"] }, icon: { data: "🗡️", type: "emoji" }, max_lines: 1, text: "Hảo hán", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:mong_ton_hoa_sen", source: "remote", caption: { background: { colors: ["#D8B4E2", "#F8BBD0"] }, icon: { data: "🪷", type: "emoji" }, max_lines: 1, text: "Mong tôn hoa sen thấy cảnh này", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:con_cai_nit", source: "remote", caption: { background: { colors: ["#D7CCC8", "#8D6E63"] }, icon: { data: "🧶", type: "emoji" }, max_lines: 1, text: "còn cái nịt", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:minh_la_lop", source: "remote", caption: { background: { colors: ["#263238", "#455A64"] }, icon: { data: "🛞", type: "emoji" }, max_lines: 1, text: "Mình là lốp", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:hay_ra_de_qua_a", source: "remote", caption: { background: { colors: ["#FFF59D", "#80DEEA"] }, icon: { data: "🥺", type: "emoji" }, max_lines: 1, text: "Hay ra dẻ quá à!", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:mac_co_qua_hai_oi", source: "remote", caption: { background: { colors: ["#FFB74D", "#F8BBD0"] }, icon: { data: "😭", type: "emoji" }, max_lines: 1, text: "Mắc cỡ quá hai ơi", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:than_chua_ma_don", source: "remote", caption: { background: { colors: ["#607D8B", "#37474F"] }, icon: { data: "😔", type: "emoji" }, max_lines: 1, text: "Thân chưa mà dỡn", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:ai_muon", source: "remote", caption: { background: { colors: ["#FF6B35", "#FF9F1C", "#FFE0A3"] }, icon: { data: "🤨", type: "emoji" }, max_lines: 1, text: "ủa rồi ai mượn?", text_color: "#6B2814", type: "static_content" } },
                        { overlay_id: "caption:co_ra_dai_khong", source: "remote", caption: { background: { colors: ["#FF4D6D", "#FF8E72", "#FFD6A5"] }, icon: { data: "😭", type: "emoji" }, max_lines: 1, text: "có ra dại không", text_color: "#6B1833", type: "static_content" } },
                        { overlay_id: "caption:he_dieu_hanh_la", source: "remote", caption: { background: { colors: ["#287271", "#57A99A", "#B5E5D5"] }, icon: { data: "🤨", type: "emoji" }, max_lines: 1, text: "bạn mình nhưng hệ điều hành lạ", text_color: "#153F3D", type: "static_content" } },
                        { overlay_id: "caption:ai_cung_khac", source: "remote", caption: { background: { colors: ["#343A40", "#59636E", "#AAB4BE"] }, icon: { data: "🤡", type: "emoji" }, max_lines: 1, text: "ai rồi cũng khác, riêng bạn thì lạ", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:tuong_tuong", source: "remote", caption: { background: { colors: ["#3977D5", "#78A9F5", "#D0E4FF"] }, icon: { data: "🤡", type: "emoji" }, max_lines: 1, text: "tưởng gì, hóa ra tưởng tượng", text_color: "#173767", type: "static_content" } },
                        { overlay_id: "caption:be_hong_sai", source: "remote", caption: { background: { colors: ["#F4A7C3", "#FFD1DC", "#FFF0F3"] }, icon: { data: "😌", type: "emoji" }, max_lines: 1, text: "bé hông có sai, tại đời sai", text_color: "#802D50", type: "static_content" } },
                        { overlay_id: "caption:khong_vua_long", source: "remote", caption: { background: { colors: ["#D5A64B", "#E8C979", "#FFF0BF"] }, icon: { data: "😌", type: "emoji" }, max_lines: 1, text: "sống sao cho vừa lòng thiên hạ? thôi khỏi", text_color: "#594015", type: "static_content" } },
                        { overlay_id: "caption:boc_trung_sit_rit", source: "remote", caption: { background: { colors: ["#9C27B0", "#7B1FA2"] }, icon: { data: "🎁", type: "emoji" }, max_lines: 1, text: "Bóc trúng sít rịt", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:hen_lam_moi_xui_duoc_vay_a", source: "remote", caption: { background: { colors: ["#00BCD4", "#0097A7"] }, icon: { data: "😅", type: "emoji" }, max_lines: 1, text: "Hên lắm mới xui được vậy á", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:giam_suc_manh_con_tuong", source: "remote", caption: { background: { colors: ["#4CAF50", "#00BCD4"] }, icon: { data: "🎮", type: "emoji" }, max_lines: 1, text: "Giảm sức mạnh con tướng", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:phu_huynh_dung_xem", source: "remote", caption: { background: { colors: ["#FF0844", "#FFB199"] }, icon: { data: "🙈", type: "emoji" }, max_lines: 1, text: "Phụ huynh đừng xem", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:khong_van_de_gi_luon", source: "remote", caption: { background: { colors: ["#087E8B", "#39B8A5", "#B8F2E6"] }, icon: { data: "👌", type: "emoji" }, max_lines: 1, text: "Không vấn đề gì luôn", text_color: "#103F43", type: "static_content" } },
                        { overlay_id: "caption:xin_vinh_biet_cu", source: "remote", caption: { background: { colors: ["#232526", "#414345"] }, icon: { data: "🕯️", type: "emoji" }, max_lines: 1, text: "Xin vĩnh biệt cụ", text_color: "#FFFFFFE6", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Bất ổn & Hết cứu 🫠",
                    items: [
                        { overlay_id: "caption:bat_on_that_su", source: "remote", caption: { background: { colors: ["#636363", "#A2AB58"] }, icon: { data: "🫠", type: "emoji" }, max_lines: 1, text: "Bất ổn thật sự", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:nay_la_het_cuu", source: "remote", caption: { background: { colors: ["#607D8B", "#455A64"] }, icon: { type: "sf_symbol", data: "bolt.badge.xmark", color: "#FFFFFFE6" }, max_lines: 1, text: "Này là hết cứu", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:het_cuu_thiet", source: "remote", caption: { background: { colors: ["#B8C9E8", "#D5D5F0", "#E9CDE0"] }, icon: { data: "🫠", type: "emoji" }, max_lines: 1, text: "hết cứu thiệt chứ", text_color: "#454660", type: "static_content" } },
                        { overlay_id: "caption:toi_cong_chuyen", source: "remote", caption: { background: { colors: ["#F2B5A7", "#F6D1B5", "#E9C2D5"] }, icon: { data: "💀", type: "emoji" }, max_lines: 1, text: "tới công chuyện nữa rồi", text_color: "#634044", type: "static_content" } },
                        { overlay_id: "caption:toang_that_roi", source: "remote", caption: { background: { colors: ["#F44336", "#B71C1C"] }, icon: { data: "🐉", type: "emoji" }, max_lines: 1, text: "Toang thật rồi", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:toi_roi_toi_roi", source: "remote", caption: { background: { colors: ["#F7253E", "#FF6B35", "#FFC857"] }, icon: { data: "❗", type: "emoji" }, max_lines: 1, text: "Tới rồi tới rồi", text_color: "#58151B", type: "static_content" } },
                        { overlay_id: "caption:goi_xong_lun", source: "remote", caption: { background: { colors: ["#F3B6AF", "#F6D2C2", "#EAC8D9"] }, icon: { data: "😭", type: "emoji" }, max_lines: 1, text: "gòi xong lun á", text_color: "#6A4549", type: "static_content" } },
                        { overlay_id: "caption:xiu_ngang", source: "remote", caption: { background: { colors: ["#C0B7E5", "#D8D0F0", "#EACDE2"] }, icon: { data: "💀", type: "emoji" }, max_lines: 1, text: "xĩu ngang xĩu dọc", text_color: "#504567", type: "static_content" } },
                        { overlay_id: "caption:guc_nga", source: "remote", caption: { background: { colors: ["#3A1C71", "#D76D77"] }, icon: { data: "📉", type: "emoji" }, max_lines: 1, text: "Gục ngã", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:bat_luc", source: "remote", caption: { background: { colors: ["#2C3E50", "#3498DB"] }, icon: { data: "🏳️", type: "emoji" }, max_lines: 1, text: "Bất lực", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:rot_nuoc_mat", source: "remote", caption: { background: { colors: ["#1CB5E0", "#000046"] }, icon: { data: "😭", type: "emoji" }, max_lines: 1, text: "Rớt nước mắt", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:tien_dinh", source: "remote", caption: { background: { colors: ["#FF9A8B", "#FF6A88"] }, icon: { data: "🌪️", type: "emoji" }, max_lines: 1, text: "Tiền đình", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:nao_bao_tri", source: "remote", caption: { background: { colors: ["#B8E0D2", "#D8EAD8", "#C9D9F0"] }, icon: { data: "🧠", type: "emoji" }, max_lines: 1, text: "não đang bảo trì", text_color: "#35564F", type: "static_content" } },
                        { overlay_id: "caption:overthinking_vai_chuong", source: "remote", caption: { background: { colors: ["#2C3E50", "#4CA1AF"] }, icon: { data: "🤯", type: "emoji" }, max_lines: 1, text: "Overthinking vai chưởng", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:tram_cam_nhe", source: "remote", caption: { background: { colors: ["#1F1C2C", "#928DAB"] }, icon: { data: "🫠", type: "emoji" }, max_lines: 1, text: "Trầm cảm nhẹ", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:khong_cam_xuc", source: "remote", caption: { background: { colors: ["#434343", "#000000"] }, icon: { data: "🗿", type: "emoji" }, max_lines: 1, text: "Không cảm xúc", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:mieng_cuoi_long_khong", source: "remote", caption: { background: { colors: ["#526A82", "#8CA6B8", "#D5E3E8"] }, icon: { data: "🙂", type: "emoji" }, max_lines: 1, text: "miệng cười nhưng lòng thì không", text_color: "#233746", type: "static_content" } },
                        { overlay_id: "caption:hom_nay_toi_buon", source: "remote", caption: { background: { colors: ["#141E30", "#243B55"] }, icon: { data: "🥀", type: "emoji" }, max_lines: 1, text: "hôm nay tôi buồn", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:dem_nay_noi_buon", source: "remote", caption: { background: { colors: ["#283B66", "#526C9E", "#A9C1D9"] }, icon: { data: "🌙", type: "emoji" }, max_lines: 1, text: "đêm nay ai ôm nỗi buồn", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:em_on_ap_luc", source: "remote", caption: { background: { colors: ["#FFB26B", "#FFD08A", "#FFF0B5"] }, icon: { data: "🥲", type: "emoji" }, max_lines: 1, text: "em ổn, ổn áp lực", text_color: "#70401F", type: "static_content" } },
                        { overlay_id: "caption:mot_minh", source: "remote", caption: { background: { colors: ["#AEB8D1", "#C7C7DF", "#DED0E0"] }, icon: { data: "🫂", type: "emoji" }, max_lines: 1, text: "thôi thì mình lại một mình", text_color: "#45475F", type: "static_content" } },
                        { overlay_id: "caption:nan_nhan", source: "remote", caption: { background: { colors: ["#F3C7D9", "#F6D9D0", "#E5CFF0"] }, icon: { data: "🥹", type: "emoji" }, max_lines: 1, text: "tui là nạn nhân", text_color: "#70495D", type: "static_content" } },
                        { overlay_id: "caption:ai_cuu_tui", source: "remote", caption: { background: { colors: ["#F0B6B6", "#F5D0C3", "#E8C6DE"] }, icon: { data: "sos", type: "sf_symbol", color: "#6A4248" }, max_lines: 1, text: "òi ai cứu tui", text_color: "#6A4248", type: "static_content" } },
                        { overlay_id: "caption:song_gio_phu_doi_trai", source: "remote", caption: { background: { colors: ["#3A1C71", "#D76D77"] }, icon: { data: "🌪️", type: "emoji" }, max_lines: 1, text: "Sóng gió phủ đời trai", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:thuong_nguoi_khong_thuong", source: "remote", caption: { background: { colors: ["#C8A6C4", "#D9B9D0", "#E7C8D6"] }, icon: { data: "💔", type: "emoji" }, max_lines: 1, text: "thương người không thương mình", text_color: "#5D3F59", type: "static_content" } },
                        { overlay_id: "caption:tu_da_tinh", source: "remote", caption: { background: { colors: ["#52658F", "#9A8FBF", "#F2B6B8"] }, icon: { data: "🫠", type: "emoji" }, max_lines: 1, text: "lại tự mình đa tình", text_color: "#373653", type: "static_content" } },
                        { overlay_id: "caption:khong_du_tot", source: "remote", caption: { background: { colors: ["#AFC6D8", "#C8D5E2", "#E0D1DE"] }, icon: { type: "sf_symbol", data: "cloud.sun.rain.fill", color: "#455467" }, max_lines: 1, text: "chắc tại mình không đủ tốt", text_color: "#455467", type: "static_content" } },
                        { overlay_id: "caption:hy_vong_that_vong", source: "remote", caption: { background: { colors: ["#8E354A", "#C45D69", "#F0B6A8"] }, icon: { data: "🥀", type: "emoji" }, max_lines: 1, text: "một chút hy vọng, một đống thất vọng", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:het_duyen_het_thuong", source: "remote", caption: { background: { colors: ["#334E68", "#627D98", "#BCCCDC"] }, icon: { data: "💭", type: "emoji" }, max_lines: 1, text: "hết duyên hay hết thương?", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:nguoi_vui_nho", source: "remote", caption: { background: { colors: ["#455A64", "#78909C", "#CFD8DC"] }, icon: { data: "🩶", type: "emoji" }, max_lines: 1, text: "người vui có nhớ người buồn không", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:da_xem_chua_rep", source: "remote", caption: { background: { colors: ["#2979FF", "#64B5F6", "#BBDEFB"] }, icon: { data: "📱", type: "emoji" }, max_lines: 1, text: "đã xem, chưa rep, đã đau", text_color: "#15345C", type: "static_content" } },
                        { overlay_id: "caption:dung_im_lang", source: "remote", caption: { background: { colors: ["#FF8FA3", "#FFB3C6", "#FFE0E9"] }, icon: { data: "🥺", type: "emoji" }, max_lines: 1, text: "đừng im lặng với em mà", text_color: "#812D49", type: "static_content" } },
                        { overlay_id: "caption:nho_thi_nho", source: "remote", caption: { background: { colors: ["#E5A642", "#F4CB78", "#FFF0C2"] }, icon: { data: "🙂", type: "emoji" }, max_lines: 1, text: "nhớ thì nhớ, quay lại thì thôi", text_color: "#633F13", type: "static_content" } },
                        { overlay_id: "caption:em_hong_doi", source: "remote", caption: { background: { colors: ["#65A30D", "#A3C957", "#E2F0B0"] }, icon: { data: "🥲", type: "emoji" }, max_lines: 1, text: "em hong có dỗi, em chỉ buồn", text_color: "#2F4712", type: "static_content" } },
                        { overlay_id: "caption:doi_roi", source: "remote", caption: { background: { colors: ["#FF5F6D", "#FFC371"] }, icon: { data: "😤", type: "emoji" }, max_lines: 1, text: "Dỗi rồi", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:dung_choc_be", source: "remote", caption: { background: { colors: ["#F1BDD0", "#F8DCE5", "#E8D1F2"] }, icon: { data: "🥺", type: "emoji" }, max_lines: 1, text: "thui mừ đừng có chọc bé", text_color: "#70475D", type: "static_content" } },
                        { overlay_id: "caption:dung_lam_be_quao", source: "remote", caption: { background: { colors: ["#FF8A5B", "#FFB36B", "#FFE3A3"] }, icon: { data: "😾", type: "emoji" }, max_lines: 1, text: "đừng có làm bé quạo", text_color: "#71351F", type: "static_content" } },
                        { overlay_id: "caption:xin_lui_duoc_chua", source: "remote", caption: { background: { colors: ["#F6D365", "#FDA085"] }, icon: { data: "🥺", type: "emoji" }, max_lines: 1, text: "Xin lũi được chưa", text_color: "#000000", type: "static_content" } },
                        { overlay_id: "caption:biet_roi_kho", source: "remote", caption: { background: { colors: ["#FF7A59", "#FFAD73", "#FFE0A3"] }, icon: { data: "🥲", type: "emoji" }, max_lines: 1, text: "bíc gòi khổ lém", text_color: "#71351F", type: "static_content" } },
                        { overlay_id: "caption:hong_be_oi", source: "remote", caption: { background: { colors: ["#58C9A5", "#A4E6C8", "#E0F7D9"] }, icon: { data: "🥹", type: "emoji" }, max_lines: 1, text: "hong bé ơi", text_color: "#205844", type: "static_content" } },
                        { overlay_id: "caption:khum_biet_nua", source: "remote", caption: { background: { colors: ["#5367C5", "#8F9FE8", "#D5D8FF"] }, icon: { data: "🫠", type: "emoji" }, max_lines: 1, text: "khum có bíc nữa", text_color: "#29346F", type: "static_content" } },
                        { overlay_id: "caption:cai_deo_ma", source: "remote", caption: { background: { colors: ["#FF6B6B", "#FF8E53", "#FFD166"] }, icon: { data: "🤬", type: "emoji" }, max_lines: 1, text: "cái đéo má ??", text_color: "#542323", type: "static_content" } },
                        { overlay_id: "caption:cai_gi_vay_troi", source: "remote", caption: { background: { colors: ["#FF512F", "#FF8C42", "#FFD166"] }, icon: { data: "❗", type: "emoji" }, max_lines: 1, text: "Cái gì vậy trời", text_color: "#672016", type: "static_content" } },
                        { overlay_id: "caption:khong_the_tin_noi", source: "remote", caption: { background: { colors: ["#3867FF", "#725CFF", "#B9A5FF"] }, icon: { data: "❓", type: "emoji" }, max_lines: 1, text: "Không thể tin nổi", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:vl_m_oi", source: "remote", caption: { background: { colors: ["#20212D", "#51566D", "#A8B4C9"] }, icon: { data: "😳", type: "emoji" }, max_lines: 1, text: "vl m ơi?", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:ua_alo", source: "remote", caption: { background: { colors: ["#FFB347", "#FFD166", "#FFF0A8"] }, icon: { data: "questionmark", type: "sf_symbol", color: "#654018" }, max_lines: 1, text: "Ủa alo", text_color: "#654018", type: "static_content" } },
                        { overlay_id: "caption:alo_gi_da", source: "remote", caption: { background: { colors: ["#00A896", "#55CDB5", "#B8F0D8"] }, icon: { data: "😭", type: "emoji" }, max_lines: 1, text: "Ủa alo, gì dạ?", text_color: "#104B45", type: "static_content" } },
                        { overlay_id: "caption:ho", source: "remote", caption: { background: { colors: ["#E63946", "#F07167", "#FFB4A2"] }, icon: { data: "🤨", type: "emoji" }, max_lines: 1, text: "hỏ?", text_color: "#681D2A", type: "static_content" } },
                        { overlay_id: "caption:lai_phai_lo", source: "remote", caption: { background: { colors: ["#70C1B3", "#B7E4A8", "#F9F7A8"] }, icon: { data: "🫠", type: "emoji" }, max_lines: 1, text: "lại phải lọ", text_color: "#294B42", type: "static_content" } },
                        { overlay_id: "caption:noi_chuyen_met", source: "remote", caption: { background: { colors: ["#6D597A", "#9A789D", "#D5B8D2"] }, icon: { data: "🫠", type: "emoji" }, max_lines: 1, text: "nói chuyện nghe mắc mệt", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:het_noi_noi", source: "remote", caption: { background: { colors: ["#52734D", "#86A873", "#D5E6A8"] }, icon: { data: "🙄", type: "emoji" }, max_lines: 1, text: "đúng là hết nói nổi", text_color: "#263D27", type: "static_content" } },
                        { overlay_id: "caption:chan_bo_may_di", source: "remote", caption: { background: { colors: ["#6A0572", "#AB1745", "#FF7B54"] }, icon: { data: "🙄", type: "emoji" }, max_lines: 1, text: "Chan bố mày đi", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:tuyet_doi_khong_nghe", source: "remote", caption: { background: { colors: ["#FF416C", "#FF4B2B"] }, icon: { data: "🙉", type: "emoji" }, max_lines: 1, text: "Tuyệt đối không nghe", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:khong_thay_khong_nghe", source: "remote", caption: { background: { colors: ["#C4D9CB", "#E5E6D0", "#F3D9C5"] }, icon: { data: "🙈", type: "emoji" }, max_lines: 1, text: "không biết, không thấy, không nghe", text_color: "#425348", type: "static_content" } },
                        { overlay_id: "caption:noi_it_lo", source: "remote", caption: { background: { colors: ["#145A64", "#398A8C", "#B8E0D2"] }, icon: { data: "🤫", type: "emoji" }, max_lines: 1, text: "nói ít thôi, lộ hết bây giờ", text_color: "#12383D", type: "static_content" } },
                        { overlay_id: "caption:nguoi_im_lang_gap_nguoi_hay_noi", source: "remote", caption: { background: { colors: ["#232526", "#414345", "#6C7A89", "#B0BEC5"] }, icon: { data: "🤐", type: "emoji" }, max_lines: 1, text: "Người im lặng gặp người hay nói", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:noi_het_bi_mat_thi_co_yeu_hong", source: "remote", caption: { background: { colors: ["#D8B4E2", "#EAC7D8", "#C4D7F2"] }, icon: { data: "🤫", type: "emoji" }, max_lines: 1, text: "Nói hết bí mật thì có yêu hong", text_color: "#55415F", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Deadline & Tiền bạc 💸",
                    items: [
                        { overlay_id: "caption:deadline_ruot", source: "remote", caption: { background: { colors: ["#ED213A", "#93291E"] }, icon: { data: "🔥", type: "emoji" }, max_lines: 1, text: "Deadline dí tụt quần", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:doi_tru_deadline", source: "remote", caption: { background: { colors: ["#F0D1A4", "#F5E2BD", "#D5D9EF"] }, icon: { data: "📚", type: "emoji" }, max_lines: 1, text: "đời cho gì nhận nấy, trừ deadline", text_color: "#5B4A35", type: "static_content" } },
                        { overlay_id: "caption:di_lam_vi_dam_me", source: "remote", caption: { background: { colors: ["#FDC830", "#F37335"] }, icon: { data: "🤡", type: "emoji" }, max_lines: 1, text: "Đi làm vì đam mê", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:ca_o_ran_doc", source: "remote", caption: { background: { colors: ["#0F2027", "#1B5E20", "#66BB6A"] }, icon: { data: "🐍", type: "emoji" }, max_lines: 1, text: "Cả ổ rắn độc", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:nghien_cuu_khoa_hoc", source: "remote", caption: { background: { colors: ["#0F2027", "#2C5364"] }, icon: { data: "☕", type: "emoji" }, max_lines: 1, text: "Cần nạp cafein gấp", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:tien_dau_ma_tieu", source: "remote", caption: { background: { colors: ["#11998E", "#38EF7D"] }, icon: { data: "💸", type: "emoji" }, max_lines: 1, text: "Tiền đâu mà tiêu", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:luc_nao_co_tien_thi_moi_di_a", source: "remote", caption: { background: { colors: ["#0F2027", "#203A43", "#2C5364"] }, icon: { data: "💸", type: "emoji" }, max_lines: 1, text: "Lúc nào có tiền thì mới đi á", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:doc_so_tai_khoan", source: "remote", caption: { background: { colors: ["#1E90FF", "#00D4FF"] }, icon: { data: "💳", type: "emoji" }, max_lines: 1, text: "đọc số tài khoản", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:co_tien_lam_phien_thien_ha", source: "remote", caption: { background: { colors: ["#BFA06A", "#E8D5AD", "#F6EBDD"] }, icon: { data: "💰", type: "emoji" }, max_lines: 1, text: "Có tiền làm phiền thiên hạ", text_color: "#493824", type: "static_content" } },
                        { overlay_id: "caption:co_tien_noi_tiep", source: "remote", caption: { background: { colors: ["#075E54", "#16A085", "#B7E4C7"] }, icon: { data: "💸", type: "emoji" }, max_lines: 1, text: "có tiền thì nói chuyện tiếp", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:doc_lap_tai_chinh", source: "remote", caption: { background: { colors: ["#B8C8B3", "#D9DFC5", "#EAD9B7"] }, icon: { data: "💰", type: "emoji" }, max_lines: 1, text: "độc lập tài chính, độc thân tình cảm", text_color: "#405340", type: "static_content" } },
                        { overlay_id: "caption:cu_tu_tu_khoai_se_nhu", source: "remote", caption: { background: { colors: ["#56AB2F", "#A8E063"] }, icon: { data: "🥔", type: "emoji" }, max_lines: 1, text: "Cứ từ từ khoai sẽ nhừ", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:kiem_tra_nhan_pham", source: "remote", caption: { background: { colors: ["#654EA3", "#EAAFC8"] }, icon: { data: "🎲", type: "emoji" }, max_lines: 1, text: "Kiểm tra nhân phẩm", text_color: "#FFFFFFE6", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Daily & Đời sống ☕",
                    items: [
                        { overlay_id: "caption:ngay_moi_vui_ve", source: "remote", caption: { background: { colors: ["#FFB703", "#FFD166", "#FFF0A8"] }, icon: { data: "☀️", type: "emoji" }, max_lines: 1, text: "Ngày mới vui vẻ", text_color: "#69420A", type: "static_content" } },
                        { overlay_id: "caption:coffee_time", source: "remote", caption: { background: { colors: ["#4E342E", "#8D6E63"] }, icon: { data: "☕", type: "emoji" }, max_lines: 1, text: "Coffee Time!", localized_text: { en: "Coffee Time!", vn: "Giờ uống cà phê!" }, text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:matcha_latte", source: "remote", caption: { background: { colors: ["#C8E6C9", "#A5D6A7", "#81C784"] }, icon: { data: "🍃", type: "emoji" }, max_lines: 1, text: "Matcha Latte 🍵", text_color: "#1B5E20E6", type: "static_content" } },
                        { overlay_id: "caption:mixue_time", source: "remote", caption: { background: { colors: ["#FFF9C4", "#F8BBD0"] }, icon: { data: "🍦", type: "emoji" }, max_lines: 1, text: "Mixue Time!", localized_text: { en: "Mixue Time!", vn: "Giờ Mixue!" }, text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:tien_mua_tra_sua", source: "remote", caption: { background: { colors: ["#D7B77D", "#EAD6AA", "#F5E7CC"] }, icon: { data: "🧋", type: "emoji" }, max_lines: 1, text: "tiền không mua được tất cả, nhưng mua được trà sữa", text_color: "#5D472B", type: "static_content" } },
                        { overlay_id: "caption:an_com_chua", source: "remote", caption: { background: { colors: ["#FF9800", "#F57C00"] }, icon: { data: "🍽️", type: "emoji" }, max_lines: 1, text: "Ăn cơm chưa?", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:dinner_time", source: "remote", caption: { background: { colors: ["#FFCCBC", "#FF8A80"] }, icon: { data: "🍽️", type: "emoji" }, max_lines: 1, text: "Dinner Time!", localized_text: { en: "Dinner Time!", vn: "Giờ ăn tối!" }, text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:di_choi_khong", source: "remote", caption: { background: { colors: ["#E91E63", "#C2185B"] }, icon: { data: "✈️", type: "emoji" }, max_lines: 1, text: "Đi chơi không?", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:tuyet_voi_uong_nao", source: "remote", caption: { background: { colors: ["#F0C58E", "#F5D9A9", "#EBC6B8"] }, icon: { data: "🥂", type: "emoji" }, max_lines: 1, text: "tuyệt vời, uống nào!", text_color: "#65462D", type: "static_content" } },
                        { overlay_id: "caption:shopping_time", source: "remote", caption: { background: { colors: ["#B3E5FC", "#FFFFFF"] }, icon: { data: "🛍️", type: "emoji" }, max_lines: 1, text: "Shopping Time!", localized_text: { en: "Shopping Time!", vn: "Giờ mua sắm!" }, text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:cinema_time", source: "remote", caption: { background: { colors: ["#1A237E", "#455A64"] }, icon: { data: "🎬", type: "emoji" }, max_lines: 1, text: "Cinema Time!", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:tuyet_doi_dien_anh", source: "remote", caption: { background: { colors: ["#455A64", "#263238"] }, icon: { data: "📷", type: "emoji" }, max_lines: 1, text: "Tuyệt đối điện ảnh", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:qua_la_dien_anh", source: "remote", caption: { background: { colors: ["#26A69A", "#00897B"] }, icon: { data: "📷", type: "emoji" }, max_lines: 1, text: "Quá là điện ảnh", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:locket_time", source: "remote", caption: { background: { colors: ["#ECEFF1", "#B3E5FC"] }, icon: { data: "📷", type: "emoji" }, max_lines: 1, text: "Locket Time!", text_color: "#000000E6", type: "static_content" } },
                        { overlay_id: "caption:chilling_time", source: "remote", caption: { background: { colors: ["#E1BEE7", "#F8BBD0"] }, icon: { data: "🌴", type: "emoji" }, max_lines: 1, text: "Chilling Time!", localized_text: { en: "Chilling Time!", vn: "Giờ thư giãn!" }, text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:graduation_day", source: "remote", caption: { background: { colors: ["#1A237E", "#283593"] }, icon: { data: "🎓", type: "emoji" }, max_lines: 1, text: "Happy Graduation Day!", localized_text: { en: "Happy Graduation Day!", vn: "Chúc mừng tốt nghiệp!" }, text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:hoi_chieu_troi_mua", source: "remote", caption: { background: { image: { type: "image", data: "cloud_cover", source: "local" }, colors: ["#546E7A", "#263238"] }, icon: { data: "🌧️", type: "emoji" }, max_lines: 1, text: "Hồi chiều trời mưa...", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:rainy_day", source: "remote", caption: { background: { image: { type: "image", data: "cloud_cover", source: "local" }, colors: ["#6D4C41", "#8D6E63", "#BCAAA4"] }, icon: { data: "☕", type: "emoji" }, max_lines: 1, text: "Rainy Day ☕🌧️", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:cam_lanh", source: "remote", caption: { background: { colors: ["#2193B0", "#6DD5ED"] }, icon: { data: "🤧", type: "emoji" }, max_lines: 1, text: "Cảm lạnh", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:bau_troi_da_ly_huong", source: "remote", caption: { background: { colors: ["#B8A1D9", "#D8C6E8", "#A9B8E8"] }, icon: { type: "sf_symbol", data: "cloud.moon.fill", color: "#FFFFFF" }, max_lines: 1, text: "nhìn bầu trời màu dạ lý hương", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:night_vibes", source: "remote", caption: { background: { colors: ["#B993D6", "#8CA6DB", "#C9B1FF"] }, icon: { data: "🪐", type: "emoji" }, max_lines: 1, text: "Night Vibes 🌌", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:2am_thoughts", source: "remote", daily_start_hour: 1, daily_end_hour: 3, caption: { background: { colors: ["#0F2027", "#203A43", "#2C5364"] }, icon: { type: "sf_symbol", data: "cloud.bolt.fill", color: "#FFFFFFE6" }, max_lines: 1, text: "2:00 AM Thoughts 🌙", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:ngu_ngon", source: "remote", caption: { background: { colors: ["#3F51B5", "#1A237E"] }, icon: { type: "sf_symbol", data: "moon.zzz.fill", color: "#FFFFFFE6" }, max_lines: 1, text: "Ngủ ngon", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:sweet_dream", source: "remote", caption: { background: { colors: ["#A1C4FD", "#C2E9FB", "#E0F7FA"] }, icon: { data: "☁️", type: "emoji" }, max_lines: 1, text: "Sweet Dream 🧊", text_color: "#1A237EE6", type: "static_content" } },
                        { overlay_id: "caption:nhiem_vu_di_ngu", source: "remote", caption: { background: { colors: ["#172554", "#334EAC", "#91A7FF"] }, icon: { data: "🫡", type: "emoji" }, max_lines: 1, text: "nhiệm vụ hệ thống: đi ngủ", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:da_den_luc_tat_nguon", source: "remote", caption: { background: { colors: ["#283593", "#5C6BC0", "#B3C5FF"] }, icon: { data: "😴", type: "emoji" }, max_lines: 1, text: "đã đến lúc tắt nguồn", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:nao_nghi_lam_tay_van_online", source: "remote", caption: { background: { colors: ["#FF6B35", "#FF9F1C", "#FFE0A3"] }, icon: { data: "🤡", type: "emoji" }, max_lines: 1, text: "não nghỉ làm, tay vẫn online", text_color: "#672812", type: "static_content" } },
                        { overlay_id: "caption:buon_ngu_chua_chiu_ngu", source: "remote", caption: { background: { colors: ["#7B2CBF", "#B185DB", "#E0C3FC"] }, icon: { data: "🫠", type: "emoji" }, max_lines: 1, text: "buồn ngủ nhưng chưa chịu ngủ", text_color: "#39204F", type: "static_content" } },
                        { overlay_id: "caption:pin_nguoi_dung_con_1", source: "remote", caption: { background: { colors: ["#D62828", "#F77F00", "#FCBF49"] }, icon: { data: "🚨", type: "emoji" }, max_lines: 1, text: "cảnh báo: pin người dùng còn 1%", text_color: "#651515", type: "static_content" } },
                        { overlay_id: "caption:nhiem_vu_hom_nay_nam_im", source: "remote", caption: { background: { colors: ["#168AAD", "#52B69A", "#D9ED92"] }, icon: { data: "🛌", type: "emoji" }, max_lines: 1, text: "nhiệm vụ hôm nay: nằm im", text_color: "#17483F", type: "static_content" } },
                        { overlay_id: "caption:mai_tinh_nay_ngu", source: "remote", caption: { background: { colors: ["#343A40", "#6C757D", "#ADB5BD"] }, icon: { data: "💀", type: "emoji" }, max_lines: 1, text: "mai tính, nay ngủ", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:offline_de_hoi_sinh", source: "remote", caption: { background: { colors: ["#006D77", "#83C5BE", "#EDF6F9"] }, icon: { data: "💤", type: "emoji" }, max_lines: 1, text: "offline để hồi sinh", text_color: "#164E52", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Chứng nhận của Locket",
                    items: [
                        { overlay_id: "caption:locket_cuti", source: "remote", caption: { background: { colors: ["#35B5E8", "#19A1D8"] }, icon: { data: "checkmark.seal.fill", type: "sf_symbol" }, max_lines: 1, text: "Locket xác nhận bạn cutii", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:locket_xinh", source: "remote", caption: { background: { colors: ["#FFD45C", "#F5B91E"] }, icon: { data: "checkmark.seal.fill", type: "sf_symbol" }, max_lines: 1, text: "Locket xác nhận bạn xjnh gái", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:locket_dep", source: "remote", caption: { background: { colors: ["#258DEB", "#1672D4"] }, icon: { data: "checkmark.seal.fill", type: "sf_symbol" }, max_lines: 1, text: "Locket xác nhận bạn đẹp chai", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:locket_dangiu", source: "remote", caption: { background: { colors: ["#FF638B", "#F44772"] }, icon: { data: "checkmark.seal.fill", type: "sf_symbol" }, max_lines: 1, text: "Locket xác nhận bạn dangiu", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:gai_dep", source: "remote", caption: { background: { colors: ["#FF91AE", "#F8759B"] }, icon: { data: "checkmark.seal.fill", type: "sf_symbol" }, max_lines: 1, text: "Đã xác minh bạn là gái đẹp", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:trai_dep", source: "remote", caption: { background: { colors: ["#4A9FEF", "#267DD7"] }, icon: { data: "checkmark.seal.fill", type: "sf_symbol" }, max_lines: 1, text: "Đã xác minh bạn là trai đẹp", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:be_ngoan", source: "remote", caption: { background: { colors: ["#E9B9C5", "#D9A4B3"] }, icon: { data: "checkmark.seal.fill", type: "sf_symbol" }, max_lines: 1, text: "Đã xác nhận bạn là bé ngoan", text_color: "#FFFFFF", type: "static_content" } },
                        { overlay_id: "caption:tuyen_duong", source: "remote", caption: { background: { colors: ["#D94A77", "#B82D59"] }, icon: { data: "checkmark.seal.fill", type: "sf_symbol" }, max_lines: 1, text: "Locket tuyên dương bạn cute", text_color: "#FFFFFF", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Tâm Trạng & Suy 🌧️",
                    items: [
                        { overlay_id: "caption:ngoai_gia_nhung_nang_long", source: "remote", caption: { background: { colors: ["#2C3E50", "#4CA1AF"] }, icon: { data: "🌧️", type: "emoji" }, max_lines: 1, text: "ngoài giả vờ trưởng thành, trong âm thầm vụn vỡ", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:ap_luc_nhung_im_lang", source: "remote", caption: { background: { colors: ["#141E30", "#243B55"] }, icon: { data: "🎧", type: "emoji" }, max_lines: 1, text: "im lặng không phải là ổn, mà là chẳng biết kể cùng ai", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:chua_lanh", source: "remote", caption: { background: { colors: ["#D4FC79", "#96E6A1"] }, icon: { data: "🌱", type: "emoji" }, max_lines: 1, text: "đi chữa lành nhưng ví rách lành chưa?", text_color: "#1B4332", type: "static_content" } },
                        { overlay_id: "caption:dem_nao_cung_suy", source: "remote", caption: { background: { colors: ["#0F2027", "#203A43", "#2C5364"] }, icon: { data: "🌙", type: "emoji" }, max_lines: 1, text: "ban ngày cười nói, ban đêm suy tới sáng", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:tuoi_tre_chua_kip_chill", source: "remote", caption: { background: { colors: ["#E0C3FC", "#8EC5FC"] }, icon: { data: "😮‍💨", type: "emoji" }, max_lines: 1, text: "lớn rồi mới biết, bình yên đắt giá đến nhường nào", text_color: "#2B2D42", type: "static_content" } },
                        { overlay_id: "caption:overthinking", source: "remote", caption: { background: { colors: ["#4B6CB7", "#182848"] }, icon: { data: "🌀", type: "emoji" }, max_lines: 1, text: "bề ngoài vô tư, bên trong overthinking", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:chi_muon_bien_mat", source: "remote", caption: { background: { colors: ["#8E9EAB", "#EEF2F3"] }, icon: { data: "🌫️", type: "emoji" }, max_lines: 1, text: "có những ngày chỉ muốn tắt nguồn cả thế giới", text_color: "#2C3E50", type: "static_content" } },
                        { overlay_id: "caption:nguoi_la_tung_quen", source: "remote", caption: { background: { colors: ["#3A1C71", "#D76D77", "#FFAF7B"] }, icon: { data: "🥀", type: "emoji" }, max_lines: 1, text: "từ người thương hóa người dưng ngược lối", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:co_don_giua_pho", source: "remote", caption: { background: { colors: ["#1F1C2C", "#928DAB"] }, icon: { data: "🌃", type: "emoji" }, max_lines: 1, text: "thành phố thì lớn, mà sao lòng mình chật chội thế", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:mot_minh_van_on", source: "remote", caption: { background: { colors: ["#F6D365", "#FDA085"] }, icon: { data: "☕", type: "emoji" }, max_lines: 1, text: "một mình cũng tốt, đỡ phải mong chờ", text_color: "#5C2A1A", type: "static_content" } },
                        { overlay_id: "caption:met_moi_can_om", source: "remote", caption: { background: { colors: ["#C9D6FF", "#E2E2E2"] }, icon: { data: "🔋", type: "emoji" }, max_lines: 1, text: "năng lượng cạn kiệt, cần một cái ôm", text_color: "#333533", type: "static_content" } },
                        { overlay_id: "caption:dung_giao_tiep", source: "remote", caption: { background: { colors: ["#434343", "#000000"] }, icon: { data: "🔕", type: "emoji" }, max_lines: 1, text: "tạm ngưng kết nối, xin đừng làm phiền", text_color: "#FFFFFFE6", type: "static_content" } }
                    ]
                },
                {
                    section: "🎨 Lyric Music 🎵",
                    items: [
                        { overlay_id: "caption:lyric_vi_ham_me_giau_sang", source: "remote", caption: { background: { colors: ["#200122", "#6F0000"] }, icon: { data: "💸", type: "emoji" }, max_lines: 1, text: "Vì ham mê giàu sang, Kiều bán đi hạnh phúc đời mình", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:lyric_vi_ham_me_giau_sang_ngan", source: "remote", caption: { background: { colors: ["#232526", "#414345"] }, icon: { data: "🥀", type: "emoji" }, max_lines: 1, text: "Vì ham mê giàu sang...", text_color: "#FFD700", type: "static_content" } },
                        { overlay_id: "caption:lyric_dung_lam_trai_tim_anh_dau", source: "remote", caption: { background: { colors: ["#FF9A9E", "#FECFEF"] }, icon: { data: "💔", type: "emoji" }, max_lines: 1, text: "Đừng làm trái tim anh đau...", text_color: "#6B1D2F", type: "static_content" } },
                        { overlay_id: "caption:lyric_binh_yen", source: "remote", caption: { background: { colors: ["#A1C4FD", "#C2E9FB"] }, icon: { data: "🍃", type: "emoji" }, max_lines: 1, text: "Bình yên một thoáng cho tim mềm...", text_color: "#1D3557", type: "static_content" } },
                        { overlay_id: "caption:lyric_mong_yu", source: "remote", caption: { background: { colors: ["#A18CD1", "#FBC2EB"] }, icon: { data: "☁️", type: "emoji" }, max_lines: 1, text: "Hẹn gặp lại anh ở trong những giấc mơ", text_color: "#4A2545", type: "static_content" } },
                        { overlay_id: "caption:lyric_tung_quen", source: "remote", caption: { background: { colors: ["#667EEA", "#764BA2"] }, icon: { data: "🎵", type: "emoji" }, max_lines: 1, text: "Giờ thì mình là ai trong cuộc đời nhau?", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:lyric_nhung_loi_hua_bo_quen", source: "remote", caption: { background: { colors: ["#B79891", "#94716B"] }, icon: { data: "🍂", type: "emoji" }, max_lines: 1, text: "Những lời hứa bỏ quên...", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:lyric_sau_con_mua", source: "remote", caption: { background: { colors: ["#4CA1AF", "#C4E0E5"] }, icon: { data: "🌧️", type: "emoji" }, max_lines: 1, text: "Trời lại nắng sau cơn mưa mà...", text_color: "#1B3B44", type: "static_content" } },
                        { overlay_id: "caption:lyric_thien_ly_oi", source: "remote", caption: { background: { colors: ["#FDFCFB", "#E2D1C3"] }, icon: { data: "🌼", type: "emoji" }, max_lines: 1, text: "Thiên lý ơi, em có thể ở lại đây không?", text_color: "#5C4033", type: "static_content" } },
                        { overlay_id: "caption:lyric_cat_doi_noi_sau", source: "remote", caption: { background: { colors: ["#232526", "#414345"] }, icon: { data: "✂️", type: "emoji" }, max_lines: 1, text: "Cắt đôi nỗi sầu, anh buông tay cắt đôi nỗi sầu", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:lyric_id_072019", source: "remote", caption: { background: { colors: ["#2B5876", "#4E4376"] }, icon: { data: "⏳", type: "emoji" }, max_lines: 1, text: "Có người đứng từ xa chờ em về...", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:lyric_cho_toi_di_theo", source: "remote", caption: { background: { colors: ["#FFECD2", "#FCB69F"] }, icon: { data: "🌅", type: "emoji" }, max_lines: 1, text: "Cho tôi đi theo với, nơi anh đi về...", text_color: "#6B2D18", type: "static_content" } },
                        { overlay_id: "caption:lyric_co_em", source: "remote", caption: { background: { colors: ["#FF9A9E", "#FAD0C4"] }, icon: { data: "🌷", type: "emoji" }, max_lines: 1, text: "Từ ngày có em về, nhà mình toàn ánh trăng thề", text_color: "#73222B", type: "static_content" } },
                        { overlay_id: "caption:lyric_exit_sign", source: "remote", caption: { background: { colors: ["#000000", "#130F40"] }, icon: { data: "🚪", type: "emoji" }, max_lines: 1, text: "Bởi vì anh đã tìm được lối thoát cho riêng mình...", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:lyric_khong_the_say", source: "remote", caption: { background: { colors: ["#3E5151", "#DECBA4"] }, icon: { data: "🥃", type: "emoji" }, max_lines: 1, text: "Anh đã cố để quên em mà không thể say", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:lyric_hen_gap_em_duoi_anh_trang", source: "remote", caption: { background: { colors: ["#141E30", "#2A5298"] }, icon: { data: "🌕", type: "emoji" }, max_lines: 1, text: "Hẹn gặp em dưới ánh trăng...", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:lyric_no_in_my_eyes", source: "remote", caption: { background: { colors: ["#536976", "#292E49"] }, icon: { data: "👀", type: "emoji" }, max_lines: 1, text: "Nhìn vào đôi mắt em, thấy cả bầu trời...", text_color: "#FFFFFFE6", type: "static_content" } },
                        { overlay_id: "caption:lyric_chuyen_doi_ta", source: "remote", caption: { background: { colors: ["#D3CCE3", "#E9E4F0"] }, icon: { data: "📖", type: "emoji" }, max_lines: 1, text: "Chuyện đôi ta như những thước phim quay chậm", text_color: "#3F3351", type: "static_content" } }
                    ]
                }
            ];

            var priorityNames = ["🎨 General"];
            if (popupCampaign.indexOf("holiday_") === 0) {
                priorityNames.push("🎉 Chúc Mừng Ngày Lễ (Holiday Events) 🎆");
            }
            if (hours >= 22 || hours < 4) {
                priorityNames.push("🎨 Tâm Trạng & Suy 🌧️", "🎨 Lyric Music 🎵");
            } else if (popupCampaign.indexOf("weekend_party") === 0) {
                priorityNames.push("🏎️ Speed, Gaming & Coding 🎮", "🎵 TikTok Trends & Vibes 🔥");
            }

            overlaySections.sort(function (a, b) {
                var idxA = priorityNames.indexOf(a.section);
                var idxB = priorityNames.indexOf(b.section);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return 0;
            });

            Object.assign(obj.entries, {
                overlay_navigator_enabled: "true",
                overlays_v2_config: JSON.stringify({ suggestions_enabled: true }),
                captions_enabled: "true",
                long_captions_enabled: "true",
                max_caption_length: "500",
                music_caption_enabled: "true",
                music_caption_song_preview_enabled: "true",
                music_caption_v2_enabled: "true",
                music_caption_search_enabled: "true",
                music_caption_apple_music_enabled: "true",
                music_caption_spotify_enabled: "true",
                music_preview_duration_sec: "30",
                music_vinyl_animation_enabled: "true",
                link_caption_link_enabled: "true",
                overlay_dynamic_captions: JSON.stringify([
                    "standard", "transcript", "subtitles", "voice", "poll", "color_palette",
                    "review", "music", "location", "weather", "time", "streak", "star_sign",
                    "party_time", "locket_count", "good_morning", "goodnight", "ootd",
                    "miss_you", "custom", "halloween_2026"
                ]),
                overlay_items: JSON.stringify(overlaySections)
            });

            $done({ body: JSON.stringify(obj) });
        }
    } else {
        $done({ body: JSON.stringify(obj) });
    }
}
